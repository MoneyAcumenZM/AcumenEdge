import { describe, it, expect } from "vitest";
import { checkOrderLimits, settledQuantity, type OrderLimitInput } from "./orderLimits";

const buy: OrderLimitInput = {
  side: "buy", orderType: "limit", symbol: "ZNCO", quantity: 100, limitPrice: 2.2, lastPrice: 2.2,
  consideration: 220, totalFees: 3.03, walletBalance: 10_000, heldQuantity: 0,
};

describe("checkOrderLimits", () => {
  it("passes an ordinary affordable buy", () => {
    expect(checkOrderLimits(buy)).toBeNull();
  });

  it("blocks orders above the single-order maximum", () => {
    expect(checkOrderLimits({ ...buy, consideration: 500_001, walletBalance: 1_000_000 })).toMatch(/cannot exceed K500,000/);
  });

  it("blocks a limit price more than 20% from the market", () => {
    expect(checkOrderLimits({ ...buy, limitPrice: 2.7 })).toMatch(/more than 20%/);
    expect(checkOrderLimits({ ...buy, limitPrice: 2.6 })).toBeNull();
  });

  it("does not apply the deviation check to market orders", () => {
    expect(checkOrderLimits({ ...buy, orderType: "market", limitPrice: null })).toBeNull();
  });

  it("blocks a buy when the balance is unknown", () => {
    expect(checkOrderLimits({ ...buy, walletBalance: null })).toMatch(/couldn't be loaded/);
  });

  it("blocks a buy whose cost including fees exceeds the balance", () => {
    expect(checkOrderLimits({ ...buy, walletBalance: 222 })).toMatch(/Insufficient wallet balance/);
    expect(checkOrderLimits({ ...buy, walletBalance: 223.03 })).toBeNull();
  });

  it("blocks a sell of more shares than are held, and ignores the balance for sells", () => {
    const sell = { ...buy, side: "sell" as const, walletBalance: null };
    expect(checkOrderLimits({ ...sell, heldQuantity: 99 })).toMatch(/Insufficient holdings — you have 99/);
    expect(checkOrderLimits({ ...sell, heldQuantity: 100 })).toBeNull();
  });
});

describe("settledQuantity", () => {
  const holdings = [{ stock_id: "ZNCO", settled_qty: 300, quantity: 500, stocks: { symbol: "ZNCO" } }];
  it("uses settled shares, matched by symbol or id", () => {
    expect(settledQuantity(holdings, "ZNCO")).toBe(300);
    expect(settledQuantity(holdings, "X", "ZNCO")).toBe(300);
  });
  it("is zero when the stock isn't held or holdings didn't load", () => {
    expect(settledQuantity(holdings, "CECZ")).toBe(0);
    expect(settledQuantity(undefined, "ZNCO")).toBe(0);
  });
});
