export interface TradeData {
  date: string;       // YYYY-MM-DD
  price: number;
  volume: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface StepPoint {
  time: string;
  value: number;
  isFlat: boolean;
}

// Parses a "YYYY-MM-DD" calendar date as a LOCAL date (year/month/day
// components directly), not through the Date string constructor, which
// treats a bare date as UTC midnight. Mixing the two would put trades into
// the wrong weekly candle for users at a negative UTC offset.
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function mondayOf(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalISODate(d);
}

function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildStepLineData(trades: TradeData[]): StepPoint[] {
  if (!trades.length) return [];

  const sorted = [...trades].sort((a, b) =>
    parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
  );

  const weekMap: Record<string, TradeData[]> = {};
  for (const trade of sorted) {
    const monday = mondayOf(trade.date);
    if (!weekMap[monday]) weekMap[monday] = [];
    weekMap[monday].push(trade);
  }

  let lastValue = sorted[0].close ?? sorted[0].price;
  const result: StepPoint[] = [];
  const current = parseLocalDate(mondayOf(sorted[0].date));
  const lastDate = parseLocalDate(sorted[sorted.length - 1].date);

  while (current <= lastDate) {
    const key = toLocalISODate(current);
    const week = weekMap[key];
    if (week) {
      lastValue = week[week.length - 1].close ?? week[week.length - 1].price;
      result.push({ time: key, value: lastValue, isFlat: false });
    } else {
      result.push({ time: key, value: lastValue, isFlat: true });
    }
    current.setDate(current.getDate() + 7);
  }

  return result;
}

export interface CandleData {
  time: string;      // YYYY-MM-DD (Monday of that week)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFlat: boolean;
}

export function buildWeeklyCandles(trades: TradeData[]): CandleData[] {
  if (!trades.length) return [];

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const grouped: Record<string, TradeData[]> = {};

  for (const t of sorted) {
    const monday = mondayOf(t.date);
    if (!grouped[monday]) grouped[monday] = [];
    grouped[monday].push(t);
  }

  // Get full range of weeks
  const allWeeks: string[] = [];
  const cur = parseLocalDate(mondayOf(sorted[0].date));
  const end = parseLocalDate(mondayOf(sorted[sorted.length - 1].date));
  while (cur <= end) {
    allWeeks.push(toLocalISODate(cur));
    cur.setDate(cur.getDate() + 7);
  }

  let lastClose = sorted[0].price;
  const candles: CandleData[] = [];

  for (const week of allWeeks) {
    const weekTrades = grouped[week];
    if (weekTrades && weekTrades.length > 0) {
      const prices = weekTrades.map(t => t.price);
      const opens = weekTrades.map(t => t.open ?? t.price);
      const highs = weekTrades.map(t => t.high ?? t.price);
      const lows = weekTrades.map(t => t.low ?? t.price);
      const closes = weekTrades.map(t => t.close ?? t.price);

      const open = opens[0];
      const close = closes[closes.length - 1];
      const high = Math.max(...highs, ...prices);
      const low = Math.min(...lows, ...prices);
      const volume = weekTrades.reduce((sum, t) => sum + t.volume, 0);

      lastClose = close;
      candles.push({ time: week, open, high, low, close, volume, isFlat: false });
    } else {
      candles.push({ time: week, open: lastClose, high: lastClose, low: lastClose, close: lastClose, volume: 0, isFlat: true });
    }
  }

  return candles;
}


/** Filter trade data by time period */
export function filterByPeriod(trades: TradeData[], period: string): TradeData[] {
  const now = new Date();
  let cutoff: Date;
  switch (period) {
    case "1W": cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7); break;
    case "1M": cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
    case "3M": cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
    case "6M": cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break;
    case "1Y": cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
    case "3Y": cutoff = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()); break;
    case "5Y": cutoff = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()); break;
    case "YTD": cutoff = new Date(now.getFullYear(), 0, 1); break;
    case "7D": cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7); break;
    default: cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }
  return trades.filter(t => new Date(t.date) >= cutoff);
}
