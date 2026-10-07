import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const postAuditEvents = vi.fn();
let configured = true;

vi.mock("@/services/middlewareClient", () => ({
  middlewareClient: { postAuditEvents: (...args: unknown[]) => postAuditEvents(...args) },
  get isTradingApiConfigured() {
    return configured;
  },
}));

async function loadAudit() {
  vi.resetModules();
  return import("./audit");
}

beforeEach(() => {
  postAuditEvents.mockReset();
  configured = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("logAudit", () => {
  it("reports session-ending events to the backend immediately", async () => {
    const { logAudit } = await loadAudit();
    postAuditEvents.mockResolvedValue({ accepted: 1 });
    await logAudit("SIGN_OUT");
    expect(postAuditEvents).toHaveBeenCalledTimes(1);
    const [events] = postAuditEvents.mock.calls[0];
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("SIGN_OUT");
  });

  it("never puts a user id in the event — the server takes the actor from the token", async () => {
    const { logAudit } = await loadAudit();
    postAuditEvents.mockResolvedValue({});
    await logAudit("SIGN_IN");
    expect(postAuditEvents.mock.calls[0][0][0]).not.toHaveProperty("user_id");
  });

  it("batches ordinary events and sends them together on the timer", async () => {
    vi.useFakeTimers();
    const { logAudit } = await loadAudit();
    postAuditEvents.mockResolvedValue({});
    await logAudit("PROFILE_VIEWED");
    await logAudit("PII_REVEALED", "profiles", "u1", { field: "nrc_passport" });
    expect(postAuditEvents).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(postAuditEvents).toHaveBeenCalledTimes(1);
    expect(postAuditEvents.mock.calls[0][0].map((e: { action: string }) => e.action)).toEqual([
      "PROFILE_VIEWED",
      "PII_REVEALED",
    ]);
  });

  it("keeps events that failed to deliver and sends them again with the next batch", async () => {
    const { logAudit } = await loadAudit();
    postAuditEvents.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({});

    await logAudit("SIGN_IN");
    expect(console.error).toHaveBeenCalled();

    await logAudit("SIGN_OUT");
    const retried = postAuditEvents.mock.calls[1][0].map((e: { action: string }) => e.action);
    expect(retried).toEqual(["SIGN_IN", "SIGN_OUT"]);
  });

  it("sends nothing when no backend is configured", async () => {
    configured = false;
    const { logAudit } = await loadAudit();
    await logAudit("SIGN_IN");
    expect(postAuditEvents).not.toHaveBeenCalled();
  });
});
