import { useState, useEffect, useCallback } from 'react';
import { SessionState, HaltType, SessionInfo } from '@/lib/ats/types';
import { MARKET_ALWAYS_OPEN } from '@/lib/config';

/**
 * LuSE Trading Schedule (CAT = UTC+2):
 * - Pre-market: 09:00–10:00 (Day Orders only)
 * - Full market: 10:00–14:00 (all order types)
 * - Market closed: 14:00–09:00 next trading day
 * - Weekends: closed
 */

export function useSessionController() {
  const [session, setSession] = useState<SessionState>('CLOSED');
  const [haltState, setHaltState] = useState<HaltType>(null);
  const [timeToNextSession, setTimeToNextSession] = useState(0);
  const [auctionRan, setAuctionRan] = useState(false);

  const getCATTime = useCallback(() => {
    const now = new Date();
    const catOffset = 2 * 60;
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const catMinutes = utcMinutes + catOffset;
    const catHours = Math.floor(catMinutes / 60) % 24;
    const catMins = catMinutes % 60;
    const dayOfWeek = now.getUTCDay();
    let adjustedDay = dayOfWeek;
    if (catMinutes >= 24 * 60) adjustedDay = (dayOfWeek + 1) % 7;
    return { hours: catHours, minutes: catMins, dayOfWeek: adjustedDay, totalMinutes: catHours * 60 + catMins };
  }, []);

  const determineSession = useCallback((): SessionState => {
    if (MARKET_ALWAYS_OPEN) return 'CONTINUOUS';

    const { totalMinutes, dayOfWeek } = getCATTime();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (!isWeekday) return 'CLOSED';

    // Pre-market: 09:00–10:00 (540–600 minutes)
    if (totalMinutes >= 540 && totalMinutes < 600) return 'OPENING_AUCTION';
    // Full market: 10:00–14:00 (600–840 minutes)
    if (totalMinutes >= 600 && totalMinutes < 840) return 'CONTINUOUS';
    // Closed
    return 'CLOSED';
  }, [getCATTime]);

  const calculateTimeToNext = useCallback((): number => {
    const { totalMinutes, dayOfWeek } = getCATTime();
    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const daysToMonday = dayOfWeek === 0 ? 1 : 2;
      return (daysToMonday * 24 * 60 + 540 - totalMinutes) * 60; // next pre-market at 09:00
    }
    // Before pre-market (09:00 = 540 min)
    if (totalMinutes < 540) return (540 - totalMinutes) * 60;
    // In pre-market, time to full market (10:00 = 600 min)
    if (totalMinutes < 600) return (600 - totalMinutes) * 60;
    // In full market, time to close (14:00 = 840 min)
    if (totalMinutes < 840) return (840 - totalMinutes) * 60;
    // After close, time to next pre-market (09:00 next day)
    return (24 * 60 - totalMinutes + 540) * 60;
  }, [getCATTime]);

  useEffect(() => {
    const tick = () => {
      setSession(determineSession());
      setTimeToNextSession(calculateTimeToNext());
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [determineSession, calculateTimeToNext]);

  useEffect(() => {
    const checkMidnight = () => {
      const { hours, minutes } = getCATTime();
      if (hours === 0 && minutes === 0) setAuctionRan(false);
    };
    const interval = setInterval(checkMidnight, 60000);
    return () => clearInterval(interval);
  }, [getCATTime]);

  const isMarketOpen = session === 'CONTINUOUS' || session === 'OPENING_AUCTION';
  const setHalt = useCallback((halt: HaltType) => { setHaltState(halt); }, []);

  const info: SessionInfo = { session, timeToNextSession, isMarketOpen, haltState };
  return { ...info, setHalt, auctionRan };
}
