import { describe, it, expect } from "vitest";
import { calcFees, calcSettlementDate, calcSettlementDateISO } from "./tradingUtils";

// Money and date maths used on the trade ticket: fees and settlement dates.

describe("calcFees", () => {
  it("computes SEC 0.125% + LuSE 0.25% + Broker 1% on a round number", () => {
    const fees = calcFees(10_000, "buy");
    expect(fees.secFee).toBeCloseTo(12.5, 2);
    expect(fees.luseFee).toBeCloseTo(25, 2);
    expect(fees.brokerFee).toBeCloseTo(100, 2);
    expect(fees.totalFees).toBeCloseTo(137.5, 2);
  });

  it("adds fees to consideration for a buy", () => {
    const fees = calcFees(10_000, "buy");
    expect(fees.netValue).toBeCloseTo(10_000 + fees.totalFees, 2);
  });

  it("subtracts fees from consideration for a sell", () => {
    const fees = calcFees(10_000, "sell");
    expect(fees.netValue).toBeCloseTo(10_000 - fees.totalFees, 2);
  });

  it("returns zero fees for zero consideration", () => {
    const fees = calcFees(0, "buy");
    expect(fees.secFee).toBe(0);
    expect(fees.luseFee).toBe(0);
    expect(fees.brokerFee).toBe(0);
    expect(fees.totalFees).toBe(0);
    expect(fees.netValue).toBe(0);
  });

  it("never produces a fractional-ngwee result (rounds in integer minor units)", () => {
    // A value chosen to produce a non-terminating fee fraction in naive
    // float math (e.g. 33.33 * 0.00125), to catch any regression back to
    // computing fees in decimal ZMW instead of integer ngwee.
    const fees = calcFees(33.33, "buy");
    for (const v of [fees.secFee, fees.luseFee, fees.brokerFee, fees.totalFees, fees.netValue]) {
      const cents = Math.round(v * 100);
      expect(cents / 100).toBeCloseTo(v, 10);
    }
  });

  it("keeps totalFees as the exact sum of the three component fees (no independent rounding drift)", () => {
    const fees = calcFees(999.99, "sell");
    const sumMinor = Math.round(fees.secFee * 100) + Math.round(fees.luseFee * 100) + Math.round(fees.brokerFee * 100);
    expect(Math.round(fees.totalFees * 100)).toBe(sumMinor);
  });
});

describe("calcSettlementDate / calcSettlementDateISO", () => {
  it("adds 3 business days, skipping weekends (Mon trade -> Thu settle)", () => {
    // Monday 2 Feb 2026
    const monday = new Date(2026, 1, 2);
    const iso = calcSettlementDateISO(monday);
    expect(iso).toBe("2026-02-05"); // Thursday
  });

  it("skips a weekend fully contained in the T+3 window (Thu trade -> Tue settle)", () => {
    // Thursday 5 Feb 2026
    const thursday = new Date(2026, 1, 5);
    const iso = calcSettlementDateISO(thursday);
    expect(iso).toBe("2026-02-10"); // Tuesday (Fri, then skip Sat/Sun, then Mon, Tue = 3 business days)
  });

  it("never lands on a Saturday or Sunday", () => {
    for (let day = 1; day <= 28; day++) {
      const d = new Date(2026, 1, day);
      const iso = calcSettlementDateISO(d);
      const settled = new Date(iso + "T00:00:00");
      expect([0, 6]).not.toContain(settled.getDay());
    }
  });

  it("calcSettlementDate and calcSettlementDateISO agree on the same calendar date", () => {
    const d = new Date(2026, 1, 2);
    const iso = calcSettlementDateISO(d);
    const display = calcSettlementDate(d);
    // calcSettlementDate is locale-formatted; just confirm it embeds the
    // same day-of-month as the ISO result rather than duplicating the
    // locale formatting logic here.
    const expectedDay = new Date(iso + "T00:00:00").getDate();
    expect(display).toContain(String(expectedDay));
  });
});
