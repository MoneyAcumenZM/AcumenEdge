import { describe, it, expect } from "vitest";
import { buildWeeklyCandles, buildStepLineData, filterByPeriod, type TradeData } from "./buildCandles";

const trade = (date: string, price: number, extra: Partial<TradeData> = {}): TradeData => ({
  date, price, volume: 100, open: price, high: price, low: price, close: price, ...extra,
});

describe("buildWeeklyCandles", () => {
  it("returns an empty array for empty input", () => {
    expect(buildWeeklyCandles([])).toEqual([]);
  });

  it("groups trades in the same week into a single candle with correct OHLC", () => {
    // Monday 2 Feb 2026 through Wednesday 4 Feb 2026 — same week.
    const trades = [
      trade("2026-02-02", 10, { open: 10, high: 11, low: 9, close: 10.5 }),
      trade("2026-02-03", 10.5, { open: 10.5, high: 12, low: 10, close: 11.5 }),
      trade("2026-02-04", 11.5, { open: 11.5, high: 11.8, low: 11, close: 11.2 }),
    ];
    const candles = buildWeeklyCandles(trades);
    expect(candles).toHaveLength(1);
    const [c] = candles;
    expect(c.open).toBe(10);       // first trade's open
    expect(c.close).toBe(11.2);    // last trade's close
    expect(c.high).toBe(12);       // max across the week
    expect(c.low).toBe(9);         // min across the week
    expect(c.volume).toBe(300);    // summed
    expect(c.isFlat).toBe(false);
  });

  it("fills weeks with no trades as flat candles carrying the prior close forward", () => {
    const trades = [
      trade("2026-02-02", 10, { close: 10 }), // week of Feb 2
      trade("2026-02-23", 15, { close: 15 }), // week of Feb 23 — 3 weeks later
    ];
    const candles = buildWeeklyCandles(trades);
    expect(candles).toHaveLength(4); // Feb 2, 9, 16, 23
    expect(candles[0].isFlat).toBe(false);
    expect(candles[1].isFlat).toBe(true);
    expect(candles[1].open).toBe(10);
    expect(candles[1].close).toBe(10);
    expect(candles[2].isFlat).toBe(true);
    expect(candles[3].isFlat).toBe(false);
    expect(candles[3].close).toBe(15);
  });

  it("falls back to `price` when open/high/low/close are omitted", () => {
    const candles = buildWeeklyCandles([{ date: "2026-02-02", price: 42, volume: 5 }]);
    expect(candles[0].open).toBe(42);
    expect(candles[0].high).toBe(42);
    expect(candles[0].low).toBe(42);
    expect(candles[0].close).toBe(42);
  });
});

describe("buildStepLineData", () => {
  it("returns an empty array for empty input", () => {
    expect(buildStepLineData([])).toEqual([]);
  });

  it("carries the last known value forward through weeks with no trades", () => {
    const trades = [
      trade("2026-02-02", 10, { close: 10 }),
      trade("2026-02-23", 20, { close: 20 }),
    ];
    const steps = buildStepLineData(trades);
    expect(steps).toHaveLength(4);
    expect(steps[0].value).toBe(10);
    expect(steps[0].isFlat).toBe(false);
    expect(steps[1].value).toBe(10);
    expect(steps[1].isFlat).toBe(true);
    expect(steps[3].value).toBe(20);
    expect(steps[3].isFlat).toBe(false);
  });
});

describe("filterByPeriod", () => {
  const trades = [
    trade("2020-01-01", 1),
    trade(new Date().toISOString().split("T")[0], 2), // today
  ];

  it("keeps only trades within the requested window", () => {
    const filtered = filterByPeriod(trades, "1M");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].price).toBe(2);
  });

  it("an unrecognised period falls back to a 1-year window rather than returning everything", () => {
    const filtered = filterByPeriod(trades, "not-a-real-period");
    expect(filtered).toHaveLength(1);
  });
});
