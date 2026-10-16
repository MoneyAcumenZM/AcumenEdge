import { describe, it, expect } from "vitest";
import {
  parseApi,
  parseWalletTransactions,
  placeOrderResultSchema,
  portfolioSchema,
  tradeHistorySchema,
  walletSchema,
} from "./apiSchemas";
import { ResponseShapeError } from "./idempotency";

describe("walletSchema", () => {
  it("accepts a numeric or decimal-string balance", () => {
    expect(parseApi(walletSchema, { balance: 1250.5, currency: "ZMW" }, "wallet").balance).toBe(1250.5);
    expect(parseApi(walletSchema, { balance: "1250.50", currency: "ZMW" }, "wallet").balance).toBe(1250.5);
    expect(parseApi(walletSchema, { balance: 0, currency: "ZMW" }, "wallet").balance).toBe(0);
  });

  it("refuses a balance that is missing, null, empty or not a number, instead of showing 0", () => {
    for (const balance of [undefined, null, "", "abc", "NaN", NaN, Infinity, {}, [], true]) {
      expect(() => parseApi(walletSchema, { balance, currency: "ZMW" }, "wallet")).toThrow(ResponseShapeError);
    }
    expect(() => parseApi(walletSchema, {}, "wallet")).toThrow(ResponseShapeError);
    expect(() => parseApi(walletSchema, null, "wallet")).toThrow(ResponseShapeError);
  });

  it("names what was being read and where it went wrong", () => {
    try {
      parseApi(walletSchema, { currency: "ZMW" }, "wallet");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ResponseShapeError);
      expect((e as ResponseShapeError).what).toBe("wallet");
      expect((e as ResponseShapeError).issues).toContain("balance");
    }
  });
});

describe("parseWalletTransactions", () => {
  it("keeps good rows and counts the bad ones instead of hiding them", () => {
    const good = { id: 1, type: "withdrawal", amount: "50", status: "pending", createdAt: "2026-10-01T10:00:00Z" };
    const { transactions, rejected } = parseWalletTransactions([good, { id: 2 }, null]);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].id).toBe("1");
    expect(transactions[0].amount).toBe(50);
    expect(rejected).toBe(2);
  });
});

describe("portfolioSchema", () => {
  const position = {
    symbol: "ZNCO", quantity: 100, pendingQty: 0, avgPrice: 5.5, cost: 550,
    marketValue: 600, pnl: 50, pnlPct: 9.09, currentPrice: 6, csdStatus: "csd_deposited",
  };

  it("accepts a complete position", () => {
    const { positions } = parseApi(portfolioSchema, { positions: [position] }, "portfolio");
    expect(positions[0].marketValue).toBe(600);
  });

  it("accepts an empty portfolio", () => {
    expect(parseApi(portfolioSchema, { positions: [] }, "portfolio").positions).toEqual([]);
  });

  it("refuses a position whose money field is missing or unreadable", () => {
    for (const field of ["quantity", "avgPrice", "cost", "marketValue", "pnl", "pnlPct", "currentPrice", "symbol"]) {
      const broken = { ...position } as Record<string, unknown>;
      delete broken[field];
      expect(() => parseApi(portfolioSchema, { positions: [broken] }, "portfolio")).toThrow(ResponseShapeError);
    }
    expect(() => parseApi(portfolioSchema, { positions: [{ ...position, marketValue: null }] }, "portfolio")).toThrow(ResponseShapeError);
    expect(() => parseApi(portfolioSchema, { positions: [{ ...position, quantity: -5 }] }, "portfolio")).toThrow(ResponseShapeError);
  });

  it("refuses an unknown settlement status instead of defaulting it to deposited", () => {
    expect(() => parseApi(portfolioSchema, { positions: [{ ...position, csdStatus: "weird" }] }, "portfolio")).toThrow(ResponseShapeError);
  });

  it("refuses a response with no positions list", () => {
    expect(() => parseApi(portfolioSchema, {}, "portfolio")).toThrow(ResponseShapeError);
    expect(() => parseApi(portfolioSchema, { raw: "<html>502</html>" }, "portfolio")).toThrow(ResponseShapeError);
  });
});

describe("placeOrderResultSchema", () => {
  it("accepts the documented answers", () => {
    expect(parseApi(placeOrderResultSchema, { status: "ok", clOrdId: "A1", orderStatus: "pending", fixSent: true }, "order").clOrdId).toBe("A1");
    expect(parseApi(placeOrderResultSchema, { error: "Insufficient funds" }, "order").error).toBe("Insufficient funds");
  });

  it("refuses an answer that says nothing", () => {
    for (const body of [{}, { raw: "Bad Gateway" }, null, "ok"]) {
      expect(() => parseApi(placeOrderResultSchema, body, "order")).toThrow(ResponseShapeError);
    }
  });
});

describe("tradeHistorySchema", () => {
  const trade = { id: "1", symbol: "ZNCO", side: "buy", quantity: 10, price: 5 };

  it("accepts a bare list, { orders } and { data }", () => {
    expect(parseApi(tradeHistorySchema, [trade], "history")).toHaveLength(1);
    expect(parseApi(tradeHistorySchema, { orders: [trade] }, "history")).toHaveLength(1);
    expect(parseApi(tradeHistorySchema, { data: [trade] }, "history")).toHaveLength(1);
  });

  it("refuses a trade with no price, so it never shows as worth K0.00", () => {
    expect(() => parseApi(tradeHistorySchema, [{ ...trade, price: undefined }], "history")).toThrow(ResponseShapeError);
  });
});
