import { supabase } from '@/integrations/supabase/client';

let marketStatusCache: any = null;
let marketStatusFetchedAt = 0;
const MARKET_CACHE_TTL = 60 * 60 * 1000;

export async function getMarketStatus() {
  const now = Date.now();
  if (marketStatusCache && now - marketStatusFetchedAt < MARKET_CACHE_TTL) {
    return marketStatusCache;
  }
  const { data } = await supabase
    .from('market_status')
    .select('session_phase, trading_allowed, updated_at')
    .eq('exchange', 'LuSE')
    .single();
  marketStatusCache = data;
  marketStatusFetchedAt = now;
  return data;
}

export function setMarketStatusCache(data: any) {
  marketStatusCache = data;
  marketStatusFetchedAt = Date.now();
}
