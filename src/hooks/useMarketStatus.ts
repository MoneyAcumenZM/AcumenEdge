/**
 * Legacy wrapper — delegates to the canonical useMarketStatus in
 * `useSupabaseQuery.ts` so every consumer sees the same session phase.
 * Exposes convenience booleans that older callers rely on.
 */
import { useMarketStatus as useCanonicalMarketStatus } from './useSupabaseQuery';

export interface MarketStatus {
  session_phase: string;
  trading_allowed: boolean;
  updated_at: string;
  description?: string;
  halted_symbols?: string[];
}

export function useMarketStatus() {
  const { data } = useCanonicalMarketStatus();
  const phase = data?.session_phase || 'closed';

  const isMarketOpen = phase === 'continuous';
  const isPreMarket = phase === 'pre_open_auction';
  const isHalted = phase === 'halted';
  const isClosed = !isMarketOpen && !isPreMarket && !isHalted;

  const getNextOpenText = () => {
    const now = new Date();
    const catOffset = 2 * 60;
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const catMinutes = utcMinutes + catOffset;
    const dayOfWeek = now.getUTCDay();
    let adjustedDay = dayOfWeek;
    if (catMinutes >= 24 * 60) adjustedDay = (dayOfWeek + 1) % 7;
    if (adjustedDay === 5 && catMinutes >= 840) return 'Opens Monday 09:00 CAT';
    if (adjustedDay === 6) return 'Opens Monday 09:00 CAT';
    if (adjustedDay === 0) return 'Opens Monday 09:00 CAT';
    return 'Opens tomorrow 09:00 CAT';
  };

  return {
    status: data as MarketStatus | undefined,
    isMarketOpen,
    isPreMarket,
    isHalted,
    isClosed,
    getNextOpenText,
  };
}
