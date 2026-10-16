import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Service = typeof import("./dpoService");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

async function load(): Promise<Service> {
  vi.resetModules();
  vi.stubEnv("VITE_API_BASE_URL", "https://api.test");
  return import("./dpoService");
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const withdrawal = {
  amount: 100,
  method: "mobile_money" as const,
  mobileNumber: "0971234567",
  mobileProvider: "Airtel" as const,
  idempotencyKey: "key-1",
  stepUpToken: "tok-1",
};

describe("requestWithdrawal", () => {
  it("sends the idempotency key and the step-up token as headers, not in the body", async () => {
    const { requestWithdrawal } = await load();
    fetchMock.mockResolvedValue(json(200, { transactionId: "t1", status: "pending" }));
    const result = await requestWithdrawal(withdrawal);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/wallet/withdraw");
    expect(init.headers["Idempotency-Key"]).toBe("key-1");
    expect(init.headers["X-Step-Up-Token"]).toBe("tok-1");
    expect(init.body).not.toContain("tok-1");
    expect(init.body).not.toContain("key-1");
    expect(JSON.parse(init.body).mobileNumber).toBe("260971234567");
    expect(result).toMatchObject({ success: true, transactionId: "t1", status: "pending" });
    expect(result.outcomeUnknown).toBeFalsy();
  });

  it.each([500, 502, 503, 504])("leaves the outcome unknown after a %i, so the key is kept", async (status) => {
    const { requestWithdrawal } = await load();
    fetchMock.mockResolvedValue(json(status, { error: "upstream" }));
    const result = await requestWithdrawal(withdrawal);
    expect(result.success).toBe(false);
    expect(result.outcomeUnknown).toBe(true);
  });

  it("leaves the outcome unknown when the connection drops", async () => {
    const { requestWithdrawal } = await load();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await requestWithdrawal(withdrawal)).outcomeUnknown).toBe(true);
  });

  it("leaves the outcome unknown when a 200 cannot be read", async () => {
    const { requestWithdrawal } = await load();
    fetchMock.mockResolvedValue(new Response("<html>ok</html>", { status: 200 }));
    const result = await requestWithdrawal(withdrawal);
    expect(result.success).toBe(false);
    expect(result.outcomeUnknown).toBe(true);
  });

  it("treats a clear refusal as final, so the key can be released", async () => {
    const { requestWithdrawal } = await load();
    fetchMock.mockResolvedValue(json(422, { error: "Insufficient balance" }));
    const result = await requestWithdrawal(withdrawal);
    expect(result).toMatchObject({ success: false, error: "Insufficient balance", httpStatus: 422 });
    expect(result.outcomeUnknown).toBe(false);
  });

  it("reports a missing step-up as a step-up problem, not an expired session", async () => {
    const { requestWithdrawal } = await load();
    fetchMock.mockResolvedValue(json(403, { error: "Step-up required", code: "step_up_required" }));
    const result = await requestWithdrawal(withdrawal);
    expect(result.sessionExpired).toBeFalsy();
    expect(result.code).toBe("step_up_required");
  });

  it("still treats a bare 401 or 403 as an expired session", async () => {
    const { requestWithdrawal } = await load();
    for (const status of [401, 403]) {
      fetchMock.mockResolvedValue(json(status, { error: "nope" }));
      expect((await requestWithdrawal(withdrawal)).sessionExpired).toBe(true);
    }
  });
});

describe("requestStepUp", () => {
  const params = { pin: "4821", amount: 100, method: "mobile_money" as const, destination: "260971234567" };

  it("posts the PIN and the withdrawal it is for, and returns the token", async () => {
    const { requestStepUp } = await load();
    fetchMock.mockResolvedValue(json(200, { token: "tok-9", expiresIn: 120 }));
    const result = await requestStepUp(params);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/auth/step-up");
    expect(JSON.parse(init.body)).toEqual({ purpose: "withdrawal", ...params });
    expect(result).toEqual({ success: true, token: "tok-9" });
  });

  it("surfaces a wrong PIN as a step-up error, not a lapsed session", async () => {
    const { requestStepUp } = await load();
    fetchMock.mockResolvedValue(json(401, { error: "Wrong PIN", code: "step_up_invalid" }));
    const result = await requestStepUp(params);
    expect(result.success).toBe(false);
    expect(result.sessionExpired).toBeFalsy();
    expect(result.code).toBe("step_up_invalid");
  });

  it("does not accept a response without a token", async () => {
    const { requestStepUp } = await load();
    fetchMock.mockResolvedValue(json(200, {}));
    const result = await requestStepUp(params);
    expect(result.success).toBe(false);
    expect(result.token).toBeUndefined();
  });
});

describe("getWallet", () => {
  it("returns the confirmed balance", async () => {
    const { getWallet } = await load();
    fetchMock.mockResolvedValue(json(200, { balance: "1250.50", currency: "ZMW", transactions: [] }));
    expect(await getWallet()).toMatchObject({ balance: 1250.5, currency: "ZMW", transactions: [] });
  });

  it("throws, rather than reporting K0.00, when the balance is missing or unreadable", async () => {
    const { getWallet } = await load();
    for (const body of [{ currency: "ZMW" }, { balance: null, currency: "ZMW" }, { balance: "abc", currency: "ZMW" }, {}]) {
      fetchMock.mockResolvedValue(json(200, body));
      await expect(getWallet()).rejects.toThrow();
    }
  });

  it("throws on a server error", async () => {
    const { getWallet } = await load();
    fetchMock.mockResolvedValue(json(503, { error: "down" }));
    await expect(getWallet()).rejects.toThrow();
  });
});

describe("verifyDeposit", () => {
  it("never reports success for an answer it cannot read", async () => {
    const { verifyDeposit } = await load();
    fetchMock.mockResolvedValue(json(200, { newBalance: "lots" }));
    expect((await verifyDeposit("tok")).success).toBe(false);
  });
});

describe("deposit initiation", () => {
  it("refuses an answer with neither a payment link nor a token", async () => {
    const { initiateDeposit, initiateMobileDeposit } = await load();
    fetchMock.mockResolvedValue(json(200, {}));
    expect((await initiateDeposit({ amount: 100 })).success).toBe(false);
    expect((await initiateMobileDeposit({ amount: 100, mobileNumber: "0971234567", provider: "MTN" })).success).toBe(false);
  });

  it("accepts the documented answers", async () => {
    const { initiateDeposit, initiateMobileDeposit } = await load();
    fetchMock.mockResolvedValueOnce(json(200, { payUrl: "https://pay.test/x", transactionToken: "t", reference: "r" }));
    expect(await initiateDeposit({ amount: 100 })).toMatchObject({ success: true, payUrl: "https://pay.test/x" });
    fetchMock.mockResolvedValueOnce(json(200, { transactionToken: "t", status: "awaiting_approval" }));
    expect(await initiateMobileDeposit({ amount: 100, mobileNumber: "0971234567", provider: "MTN" })).toMatchObject({ success: true, transactionToken: "t" });
  });
});
