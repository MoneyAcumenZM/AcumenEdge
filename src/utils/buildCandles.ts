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

export function buildStepLineData(trades: TradeData[]): StepPoint[] {
  if (!trades.length) return [];

  const sorted = [...trades].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  function getMondayOf(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  const weekMap: Record<string, TradeData[]> = {};
  for (const trade of sorted) {
    const monday = getMondayOf(trade.date);
    if (!weekMap[monday]) weekMap[monday] = [];
    weekMap[monday].push(trade);
  }

  let lastValue = sorted[0].close ?? sorted[0].price;
  const result: StepPoint[] = [];
  const current = new Date(getMondayOf(sorted[0].date));
  const lastDate = new Date(sorted[sorted.length - 1].date);

  while (current <= lastDate) {
    const key = current.toISOString().split('T')[0];
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

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export function buildWeeklyCandles(trades: TradeData[]): CandleData[] {
  if (!trades.length) return [];

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const grouped: Record<string, TradeData[]> = {};

  for (const t of sorted) {
    const monday = getMonday(new Date(t.date));
    if (!grouped[monday]) grouped[monday] = [];
    grouped[monday].push(t);
  }

  // Get full range of weeks
  const startDate = new Date(sorted[0].date);
  const endDate = new Date(sorted[sorted.length - 1].date);
  const allWeeks: string[] = [];
  const cur = new Date(getMonday(startDate));
  const end = new Date(getMonday(endDate));
  while (cur <= end) {
    allWeeks.push(cur.toISOString().slice(0, 10));
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

/** Generate realistic LuSE sample trade data */
export function generateSampleTradeData(
  startPrice = 16500,
  endPrice = 26314,
  months = 11
): TradeData[] {
  const trades: TradeData[] = [];
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const totalDays = months * 30;
  const dailyTrend = (endPrice - startPrice) / totalDays;
  let price = startPrice;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    const month = d.getMonth();
    // Simulate dead weeks in June and August
    const isDeadPeriod = (month === 5 && d.getDate() > 10 && d.getDate() < 25) ||
                         (month === 7 && d.getDate() > 5 && d.getDate() < 20);
    if (isDeadPeriod && Math.random() > 0.15) continue;

    // October dip
    const isDip = month === 9 && d.getDate() > 5 && d.getDate() < 20;

    const volatility = price * 0.012;
    const trend = isDip ? -dailyTrend * 2 : dailyTrend;
    price += trend + (Math.random() - 0.48) * volatility;
    price = Math.max(price * 0.95, price);

    const open = price + (Math.random() - 0.5) * volatility * 0.3;
    const close = price;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(500 + Math.random() * 3000);

    trades.push({
      date: d.toISOString().slice(0, 10),
      price: +price.toFixed(2),
      volume,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
    });
  }

  return trades;
}

/** Generate sample data for a specific stock with a given base price */
export function generateStockTradeData(basePrice: number, months = 11): TradeData[] {
  const endPrice = basePrice * (1 + (Math.random() * 0.4 - 0.1));
  return generateSampleTradeData(basePrice * 0.85, endPrice, months);
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
