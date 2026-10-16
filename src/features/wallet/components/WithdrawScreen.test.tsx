import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const requestStepUp = vi.fn();
const requestWithdrawal = vi.fn();
vi.mock("@/services/dpoService", () => ({
  requestStepUp: (...a: unknown[]) => requestStepUp(...a),
  requestWithdrawal: (...a: unknown[]) => requestWithdrawal(...a),
  normalisePhone: (v: string) => "260" + v.replace(/\D/g, "").replace(/^(260|0)/, ""),
}));
vi.mock("@/features/auth/services/pinService", () => ({
  isPINEnabled: () => true,
  isPINLocked: () => ({ locked: false, secondsRemaining: 0 }),
  verifyPIN: vi.fn(async (_u: string, pin: string) => pin === "4821"),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: { phone: "260971234567" } }),
}));
vi.mock("@/features/auth/hooks/useAccountRestrictions", () => ({
  useAccountRestrictions: () => ({ canWithdraw: true }),
}));
vi.mock("@/hooks/useDataQuery", () => ({
  useWallet: () => ({ data: { balance: 1000 }, isLoading: false, isFetched: true }),
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

import WithdrawScreen from "./WithdrawScreen";

function renderScreen() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <WithdrawScreen onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function reachConfirm() {
  fireEvent.click(screen.getByText("Mobile Money"));
  fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "100" } });
  fireEvent.click(screen.getByText("Continue"));
  await screen.findByText("Confirm Withdrawal");
}

async function enterPinAndConfirm(pin = "4821") {
  fireEvent.change(screen.getByPlaceholderText("••••"), { target: { value: pin } });
  fireEvent.click(screen.getByText(/Confirm & Withdraw/));
}

beforeEach(() => {
  sessionStorage.clear();
  requestStepUp.mockReset();
  requestWithdrawal.mockReset();
});

describe("WithdrawScreen step-up", () => {
  it("sends nothing to the server when the PIN is wrong on the device", async () => {
    renderScreen();
    await reachConfirm();
    await enterPinAndConfirm("0000");
    await screen.findByText("Incorrect PIN.");
    expect(requestStepUp).not.toHaveBeenCalled();
    expect(requestWithdrawal).not.toHaveBeenCalled();
  });

  it("does not withdraw when the server refuses the PIN", async () => {
    requestStepUp.mockResolvedValue({ success: false, code: "step_up_invalid", error: "Wrong PIN" });
    renderScreen();
    await reachConfirm();
    await enterPinAndConfirm();
    await screen.findByText("Incorrect PIN.");
    expect(requestWithdrawal).not.toHaveBeenCalled();
  });

  it("withdraws with the server's step-up token, tied to this amount and destination", async () => {
    requestStepUp.mockResolvedValue({ success: true, token: "tok-1" });
    requestWithdrawal.mockResolvedValue({ success: true, status: "pending" });
    renderScreen();
    await reachConfirm();
    await enterPinAndConfirm();
    await screen.findByText("Withdrawal Requested");
    expect(requestStepUp).toHaveBeenCalledWith({ pin: "4821", amount: 100, method: "mobile_money", destination: "260971234567" });
    expect(requestWithdrawal.mock.calls[0][0]).toMatchObject({ amount: 100, stepUpToken: "tok-1" });
  });

  it("asks for the PIN again when the server says the step-up expired", async () => {
    requestStepUp.mockResolvedValue({ success: true, token: "tok-1" });
    requestWithdrawal.mockResolvedValue({ success: false, code: "step_up_expired", outcomeUnknown: false });
    renderScreen();
    await reachConfirm();
    await enterPinAndConfirm();
    await screen.findByText(/Enter your PIN again/);
    expect(screen.queryByText("Withdrawal Requested")).toBeNull();
  });
});

describe("WithdrawScreen idempotency", () => {
  it("replays the same key after a 5xx, then uses a new key once the server has answered", async () => {
    requestStepUp.mockResolvedValue({ success: true, token: "tok" });
    requestWithdrawal
      .mockResolvedValueOnce({ success: false, httpStatus: 502, outcomeUnknown: true, error: "Request failed (502)" })
      .mockResolvedValueOnce({ success: false, httpStatus: 422, outcomeUnknown: false, error: "Insufficient balance" })
      .mockResolvedValueOnce({ success: true, status: "pending" });
    renderScreen();
    await reachConfirm();

    await enterPinAndConfirm();
    await screen.findByText(/couldn't confirm whether your withdrawal went through/);
    const first = requestWithdrawal.mock.calls[0][0].idempotencyKey;

    // Retry: the 502 may have committed, so the key must be the same.
    fireEvent.click(screen.getByText(/Confirm & Withdraw/));
    await waitFor(() => expect(requestWithdrawal).toHaveBeenCalledTimes(2));
    expect(requestWithdrawal.mock.calls[1][0].idempotencyKey).toBe(first);
    await screen.findByText("Insufficient balance");

    // A clear refusal released the key: the next attempt is a new intent.
    fireEvent.click(screen.getByText("Continue"));
    await screen.findByText("Confirm Withdrawal");
    await enterPinAndConfirm();
    await waitFor(() => expect(requestWithdrawal).toHaveBeenCalledTimes(3));
    expect(requestWithdrawal.mock.calls[2][0].idempotencyKey).not.toBe(first);
  });

  it("keeps the key if the screen is closed and reopened before retrying", async () => {
    requestStepUp.mockResolvedValue({ success: true, token: "tok" });
    requestWithdrawal.mockResolvedValue({ success: false, outcomeUnknown: true, networkError: true });
    const first = renderScreen();
    await reachConfirm();
    await enterPinAndConfirm();
    await waitFor(() => expect(requestWithdrawal).toHaveBeenCalledTimes(1));
    const key = requestWithdrawal.mock.calls[0][0].idempotencyKey;
    first.unmount();

    renderScreen();
    await reachConfirm();
    await enterPinAndConfirm();
    await waitFor(() => expect(requestWithdrawal).toHaveBeenCalledTimes(2));
    expect(requestWithdrawal.mock.calls[1][0].idempotencyKey).toBe(key);
  });
});
