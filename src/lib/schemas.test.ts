import { describe, it, expect } from "vitest";
import { orderSchema, signInSchema } from "./schemas";

const STOCK_ID = "123e4567-e89b-12d3-a456-426614174000";

const baseOrder = {
  stock_id: STOCK_ID,
  side: "buy" as const,
  order_type: "limit" as const,
  qualifier: "day" as const,
  quantity: 100,
  limit_price: 4.5,
  expiry_date: null,
};

describe("orderSchema", () => {
  it("accepts a valid limit order", () => {
    expect(orderSchema.safeParse(baseOrder).success).toBe(true);
  });

  it("accepts a valid market order with no limit price", () => {
    const result = orderSchema.safeParse({ ...baseOrder, order_type: "market", limit_price: null });
    expect(result.success).toBe(true);
  });

  it("rejects a limit order with no limit price", () => {
    const result = orderSchema.safeParse({ ...baseOrder, order_type: "limit", limit_price: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some(e => e.path[0] === "limit_price")).toBe(true);
    }
  });

  it("rejects a GTD order with no expiry date", () => {
    const result = orderSchema.safeParse({ ...baseOrder, qualifier: "gtd", expiry_date: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some(e => e.path[0] === "expiry_date")).toBe(true);
    }
  });

  it("accepts a GTD order that does provide an expiry date", () => {
    const result = orderSchema.safeParse({ ...baseOrder, qualifier: "gtd", expiry_date: "2026-03-01" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID stock_id", () => {
    const result = orderSchema.safeParse({ ...baseOrder, stock_id: "ZSUG" });
    expect(result.success).toBe(false);
  });

  it("rejects a zero or negative quantity", () => {
    expect(orderSchema.safeParse({ ...baseOrder, quantity: 0 }).success).toBe(false);
    expect(orderSchema.safeParse({ ...baseOrder, quantity: -5 }).success).toBe(false);
  });

  it("rejects a fractional quantity", () => {
    expect(orderSchema.safeParse({ ...baseOrder, quantity: 100.5 }).success).toBe(false);
  });

  it("rejects a quantity above the 1,000,000 cap", () => {
    expect(orderSchema.safeParse({ ...baseOrder, quantity: 1_000_001 }).success).toBe(false);
  });

  it("rejects an invalid side/order_type/qualifier value", () => {
    expect(orderSchema.safeParse({ ...baseOrder, side: "hold" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...baseOrder, order_type: "stop" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...baseOrder, qualifier: "aon" }).success).toBe(false);
  });

  it("rejects a negative or zero limit price", () => {
    expect(orderSchema.safeParse({ ...baseOrder, limit_price: 0 }).success).toBe(false);
    expect(orderSchema.safeParse({ ...baseOrder, limit_price: -1 }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("accepts a valid email/password pair", () => {
    expect(signInSchema.safeParse({ email: "user@example.com", password: "x" }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(signInSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(signInSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(false);
  });
});
