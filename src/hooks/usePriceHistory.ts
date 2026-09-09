import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { middlewareClient } from '@/services/middlewareClient';
import type { TradeData } from '@/utils/buildCandles';

/** Intraday ticks for today — backed by stock_price_history (Supabase). */
export function useIntradayHistory(symbol: string | undefined) {
  return useQuery({
    queryKey: ['price-history-intraday', symbol],
    queryFn: async (): Promise<TradeData[]> => {
      if (!symbol) return [];
      const { data } = await supabase
        .from('stock_price_history')
        .select('recorded_at, last_price, open_price, high_price, low_price, volume')
        .eq('symbol', symbol)
        .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: true })
        .limit(1000);

      if (!data?.length) return [];
      return data
        .filter((r: any) => r.last_price != null)
        .map((r: any) => ({
          date: r.recorded_at,
          price: Number(r.last_price),
          volume: Number(r.volume ?? 0),
          open: r.open_price != null ? Number(r.open_price) : Number(r.last_price),
          high: r.high_price != null ? Number(r.high_price) : Number(r.last_price),
          low: r.low_price != null ? Number(r.low_price) : Number(r.last_price),
          close: Number(r.last_price),
        }));
    },
    enabled: !!symbol,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

/**
 * Daily OHLCV.
 * Priority:
 *   1. Live  → GET /api/market/ohlcv/:symbol?days=N
 *   2. Fallback (ATS offline) → Supabase `ohlcv` table.
 */
export function usePriceHistory(symbol: string | undefined, period: string = '1M') {
  const days = periodToDays(period);
  return useQuery({
    queryKey: ['price-history', symbol, period],
    queryFn: async (): Promise<TradeData[]> => {
      if (!symbol) return [];

      // 1) Try middleware (live ATS).
      try {
        const result = await middlewareClient.getOhlcv(symbol, days);
        const rows = result?.ohlcv || result?.data?.ohlcv || result?.data || [];
        if (Array.isArray(rows) && rows.length) {
          return rows
            .filter((r: any) => r.close_price != null)
            .map((r: any) => {
              // trade_date arrives as "YYYYMMDD" (e.g. "20260519"); normalize to ISO date.
              const raw = String(r.trade_date);
              const date = /^\d{8}$/.test(raw)
                ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
                : raw.split('T')[0];
              return {
                date,
                price: Number(r.close_price),
                volume: Number(r.volume ?? 0),
                open: Number(r.open_price ?? r.close_price),
                high: Number(r.high_price ?? r.close_price),
                low: Number(r.low_price ?? r.close_price),
                close: Number(r.close_price),
              };
            });
        }
      } catch {
        // fall through to Supabase fallback
      }

      // 2) Supabase `ohlcv` table (offline fallback).
      const { data } = await (supabase as any)
        .from('ohlcv')
        .select('trade_date, open_price, high_price, low_price, close_price, vwap, volume')
        .eq('symbol', symbol)
        .order('trade_date', { ascending: true })
        .limit(days);

      if (!data?.length) return [];
      return data
        .filter((r: any) => r.close_price != null)
        .map((r: any) => ({
          date: String(r.trade_date).split('T')[0],
          price: Number(r.close_price),
          volume: Number(r.volume ?? 0),
          open: Number(r.open_price ?? r.close_price),
          high: Number(r.high_price ?? r.close_price),
          low: Number(r.low_price ?? r.close_price),
          close: Number(r.close_price),
        }));
    },
    enabled: !!symbol,
    staleTime: 60_000,
  });
}

function periodToDays(period: string): number {
  switch (period) {
    case '1W': case '7D': return 7;
    case '1M': return 30;
    case '3M': return 90;
    case '6M': return 180;
    case '1Y': return 365;
    case '3Y': return 1095;
    case '5Y': return 1825;
    case 'YTD': return Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
    default: return 30;
  }
}

/** Build 5-minute OHLC candles from raw tick data */
export function buildFiveMinCandles(ticks: TradeData[]) {
  if (!ticks.length) return [];
  const buckets: Record<string, TradeData[]> = {};
  for (const t of ticks) {
    const d = new Date(t.date);
    d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
    const key = d.toISOString();
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(t);
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, trades]) => {
      const o = trades[0].open ?? trades[0].price;
      const c = trades[trades.length - 1].close ?? trades[trades.length - 1].price;
      const h = Math.max(...trades.map(t => t.high ?? t.price));
      const l = Math.min(...trades.map(t => t.low ?? t.price));
      const v = trades.reduce((s, t) => s + t.volume, 0);
      if ([o, h, l, c].some(v => v == null)) return null;
      return { date: key, price: c, volume: v, open: o, high: h, low: l, close: c };
    })
    .filter(Boolean) as TradeData[];
}
