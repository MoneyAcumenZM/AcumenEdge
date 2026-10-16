import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const placeClientOrder = vi.fn();
vi.mock("@/services/middlewareClient", async (orig) => ({
  ...(await orig<typeof import("@/services/middlewareClient")>()),
  middlewareClient: { placeClientOrder: (...a: unknown[]) => placeClientOrder(...a) },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/features/auth/hooks/useAccountRestrictions", () => ({ useAccountRestrictions: () => ({ canTrade: true }) }));
vi.mock("@/integrations/data/client", () => ({
  db: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { csd_registered: true, csd_registration_status: "approved", account_status: "active", kyc_status: "approved" },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

let marketStatus: Record<string, unknown>;
vi.mock("@/hooks/useDataQuery", () => ({
  useMarketStatus: () => ({ data: marketStatus }),
  useWallet: () => ({ data: { balance: 100000 } }),
  useHoldings: () => ({ data: [] }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { toast } from "sonner";
import { ApiError } from "@/services/middlewareClient";
import OrderTicket from "./OrderTicket";

const open = (symbol = "ZNCO") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OrderTicket open onClose={() => {}} stock={{ symbol, name: "Zanaco", last_price: 5 }} />
    </QueryClientProvider>,
  );

const fill = () => fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "10" } });

beforeEach(() => {
  sessionStorage.clear();
  placeClientOrder.mockReset();
  vi.mocked(toast.error).mockReset();
  marketStatus = { session_phase: "continuous", trading_allowed: true, halted_symbols: [], halts_known: true };
});

describe("OrderTicket halts", () => {
  it("blocks a halted stock and says why", () => {
    marketStatus = { ...marketStatus, halted_symbols: ["ZNCO"] };
    open("ZNCO");
    expect(screen.getByRole("alert").textContent).toMatch(/ZNCO is halted/);
    expect((screen.getByText("Place BUY Order") as HTMLButtonElement).disabled).toBe(true);
  });

  it("lets other stocks through while one is halted", () => {
    marketStatus = { ...marketStatus, halted_symbols: ["ZNCO"] };
    open("SHOP");
    expect((screen.getByText("Place BUY Order") as HTMLButtonElement).disabled).toBe(false);
  });

  it("blocks when the halts feed could not be read", () => {
    marketStatus = { ...marketStatus, halts_known: false };
    open("ZNCO");
    expect(screen.getByRole("alert").textContent).toMatch(/can't confirm the trading status/);
    expect((screen.getByText("Place BUY Order") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("OrderTicket idempotency", () => {
  async function confirm() {
    fill();
    fireEvent.click(screen.getByText("Place BUY Order"));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Order" }));
  }

  it("replays the same key after a 502, because the order may already exist", async () => {
    placeClientOrder.mockRejectedValue(new ApiError("Request failed (502)", 502, null));
    open();
    await confirm();
    await waitFor(() => expect(placeClientOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/couldn't confirm whether your order was placed/);
    const first = placeClientOrder.mock.calls[0][1];

    fireEvent.click(screen.getByText("Place BUY Order"));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Order" }));
    await waitFor(() => expect(placeClientOrder).toHaveBeenCalledTimes(2));
    expect(placeClientOrder.mock.calls[1][1]).toBe(first);
  });

  it("uses a new key after a clear refusal", async () => {
    placeClientOrder.mockRejectedValue(new ApiError("Insufficient funds", 422, { error: "Insufficient funds" }));
    open();
    await confirm();
    await waitFor(() => expect(placeClientOrder).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const first = placeClientOrder.mock.calls[0][1];

    fireEvent.click(screen.getByText("Place BUY Order"));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm Order" }));
    await waitFor(() => expect(placeClientOrder).toHaveBeenCalledTimes(2));
    expect(placeClientOrder.mock.calls[1][1]).not.toBe(first);
  });
});
