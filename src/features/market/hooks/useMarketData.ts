import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStocks, type StockListItem } from '@/hooks/useDataQuery';
import { middlewareClient } from '@/services/middlewareClient';
import { db } from '@/integrations/data/client';
import { asRecord, type ApiRecord } from '@/lib/apiShape';

/** One symbol's quote, from the live feed or the `stocks` table fallback. */
export interface Quote {
  symbol?: string;
  description?: string | null;
  last_price?: number | null;
  live_price?: number | null;
  bid_price?: number | null;
  ask_price?: number | null;
  open_price?: number | null;
  high_price?: number | null;
  low_price?: number | null;
  prev_close?: number | null;
  previous_close?: number | null;
  volume?: number | null;
  change_percent?: number | null;
  // Alternate spellings some feeds use for the same two fields.
  changePercent?: number | null;
  change?: number | null;
  change_amount?: number | null;
  timestamp?: string | null;
  is_live?: boolean;
}

/** Quotes keyed by symbol. */
export type QuoteMap = Record<string, Quote>;

// Some backends wrap the payload in `{ data: ... }`, some don't.
const unwrap = (result: ApiRecord): ApiRecord => {
  const inner = result?.data;
  return inner && typeof inner === 'object' ? asRecord(inner) : asRecord(result);
};

/**
 * Tries the middleware first (live FIX data). If the middleware is offline
 * (network error / ATS down), falls back to the Supabase `stocks` table
 * which the middleware refreshes every 5 seconds. Fallback rows are tagged
 * with `is_live: false` so the UI can show an "offline data" indicator.
 */
export function useAllMarketData() {
  return useQuery({
    queryKey: ['market-all'],
    queryFn: async (): Promise<QuoteMap> => {
      try {
        const result = await middlewareClient.getMarketData();
        return unwrap(result) as QuoteMap;
      } catch {
        const { data, error } = await db
          .from('stocks')
          .select('symbol, name, last_price, bid_price, ask_price, open_price, high_price, low_price, volume, change_percent, price_updated_at')
          .eq('is_active', true);
        // Both sources failed: report that, rather than an empty price map
        // that looks like "no stocks".
        if (error) throw error;
        const mapped: QuoteMap = {};
        for (const row of data || []) {
          mapped[row.symbol] = {
            symbol: row.symbol,
            description: row.name,
            last_price: row.last_price,
            live_price: row.last_price,
            bid_price: row.bid_price,
            ask_price: row.ask_price,
            open_price: row.open_price,
            high_price: row.high_price,
            low_price: row.low_price,
            volume: row.volume ?? 0,
            change_percent: row.change_percent,
            timestamp: row.price_updated_at,
            is_live: false,
          };
        }
        return mapped;
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}



export function useStockPrice(symbol: string) {
  return useQuery({
    queryKey: ['market-symbol', symbol],
    queryFn: async (): Promise<Quote | null> => {
      try {
        const result = await middlewareClient.getSymbol(symbol);
        return unwrap(result) as Quote;
      } catch {
        const { data, error } = await db
          .from('stocks')
          .select('symbol, name, last_price, bid_price, ask_price, open_price, high_price, low_price, volume, change_percent, price_updated_at')
          .eq('symbol', symbol)
          .maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return {
          symbol: data.symbol,
          description: data.name,
          last_price: data.last_price,
          live_price: data.last_price,
          bid_price: data.bid_price,
          ask_price: data.ask_price,
          open_price: data.open_price,
          high_price: data.high_price,
          low_price: data.low_price,
          volume: data.volume ?? 0,
          change_percent: data.change_percent,
          timestamp: data.price_updated_at,
          is_live: false,
        };
      }
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!symbol,
  });
}

/** A stock from the `stocks` table with the live quote laid over it. */
export type LiveStock = StockListItem & { is_live: boolean };

/**
 * The one rule for combining a stock's details (name, sector, currency —
 * from the data backend) with its live quote (from the trading API). Each
 * live field wins when present; otherwise the table's value is kept. Market,
 * Watchlist, Sectors and the Home gainers/losers all use this, so they always
 * show the same price and change for a stock.
 */
export function mergeQuote(stock: StockListItem, quote: Quote = {}): LiveStock {
  const livePrice = quote.live_price ?? quote.last_price ?? null;
  const price = livePrice ?? stock.last_price;
  const prev = quote.prev_close ?? quote.previous_close ?? stock.prev_close ?? null;
  const changeFromPrev = prev != null && price != null && Number(prev) !== 0
    ? ((Number(price) - Number(prev)) / Number(prev)) * 100
    : null;
  return {
    ...stock,
    last_price: price,
    bid_price: quote.bid_price ?? stock.bid_price,
    ask_price: quote.ask_price ?? stock.ask_price,
    open_price: quote.open_price ?? stock.open_price,
    high_price: quote.high_price ?? stock.high_price,
    low_price: quote.low_price ?? stock.low_price,
    volume: quote.volume ?? stock.volume,
    prev_close: prev,
    change_percent: quote.change_percent ?? quote.changePercent ?? changeFromPrev ?? stock.change_percent,
    change_amount: quote.change_amount ?? quote.change ?? stock.change_amount,
    price_updated_at: quote.timestamp ?? stock.price_updated_at,
    is_live: livePrice != null && quote.is_live !== false,
  };
}

/** Every active stock, with live prices where the trading API has them. */
export function useLiveStocks() {
  const stocks = useStocks();
  const live = useAllMarketData();
  const quotes = live.data;
  const data = useMemo(
    () => (stocks.data ?? []).map((s) => mergeQuote(s, quotes?.[s.symbol])),
    [stocks.data, quotes],
  );
  return {
    data,
    isLoading: stocks.isLoading && live.isLoading,
    dataUpdatedAt: live.dataUpdatedAt,
  };
}
