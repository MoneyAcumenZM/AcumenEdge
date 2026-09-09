import { useQuery } from '@tanstack/react-query';
import { middlewareClient } from '@/services/middlewareClient';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tries the middleware first (live FIX data). If the middleware is offline
 * (network error / ATS down), falls back to the Supabase `stocks` table
 * which the middleware refreshes every 5 seconds. Fallback rows are tagged
 * with `is_live: false` so the UI can show an "offline data" indicator.
 */
export function useAllMarketData() {
  return useQuery({
    queryKey: ['market-all'],
    queryFn: async () => {
      try {
        const result = await middlewareClient.getMarketData();
        return result?.data || result || {};
      } catch {
        const { data } = await supabase
          .from('stocks')
          .select('symbol, name, last_price, bid_price, ask_price, open_price, high_price, low_price, volume, change_percent, price_updated_at')
          .eq('is_active', true);
        const mapped: Record<string, any> = {};
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
    queryFn: async () => {
      try {
        const result = await middlewareClient.getSymbol(symbol);
        return result?.data || result;
      } catch {
        const { data } = await supabase
          .from('stocks')
          .select('symbol, name, last_price, bid_price, ask_price, open_price, high_price, low_price, volume, change_percent, price_updated_at')
          .eq('symbol', symbol)
          .maybeSingle();
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
