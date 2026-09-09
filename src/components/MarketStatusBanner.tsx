import { useState, useEffect } from "react";
import { Lock, Unlock, Clock } from "lucide-react";

/**
 * LuSE Trading Schedule (CAT = UTC+2):
 * Pre-market: 09:00–10:00 (Day Orders only)
 * Full market: 10:00–14:00 (all order types)
 * Closed: 14:00–09:00
 */

type SessionPhase = 'closed' | 'pre_market' | 'open';

const getMarketInfo = (): { phase: SessionPhase; label: string; countdown: string; badgeColor: string; badgeLabel: string } => {
  const now = new Date();
  const catOffset = 2 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const catMinutes = utcMinutes + catOffset;
  const totalMinutes = Math.floor(catMinutes) % (24 * 60);
  const day = now.getUTCDay();
  let adjustedDay = day;
  if (catMinutes >= 24 * 60) adjustedDay = (day + 1) % 7;
  const isWeekday = adjustedDay >= 1 && adjustedDay <= 5;

  // Pre-market: 09:00-10:00 (540-600)
  if (isWeekday && totalMinutes >= 540 && totalMinutes < 600) {
    const remaining = 600 - totalMinutes;
    return {
      phase: 'pre_market',
      label: 'Pre-market session active. Day orders only. All order types from 10:00.',
      countdown: `${remaining}m to full market`,
      badgeColor: 'bg-warning/15 text-warning border-warning/30',
      badgeLabel: 'Pre-Market Session',
    };
  }

  // Open: 10:00-14:00 (600-840)
  if (isWeekday && totalMinutes >= 600 && totalMinutes < 840) {
    const remaining = 840 - totalMinutes;
    const h = Math.floor(remaining / 60);
    const m = remaining % 60;
    return {
      phase: 'open',
      label: 'Market is open. All order types accepted.',
      countdown: `Closes in ${h}h ${m}m`,
      badgeColor: 'bg-success/15 text-success border-success/30',
      badgeLabel: 'Market Open',
    };
  }

  // Closed — calculate next open
  const next = new Date(now);
  const catHours = Math.floor(totalMinutes / 60);

  if (isWeekday && totalMinutes < 540) {
    // Today before pre-market
  } else {
    // Move to next weekday
    do { next.setDate(next.getDate() + 1); } while (next.getDay() === 0 || next.getDay() === 6);
  }
  next.setUTCHours(7, 0, 0, 0); // 09:00 CAT = 07:00 UTC
  const diff = next.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const dayName = next.toLocaleDateString('en-ZM', { weekday: 'long' });

  return {
    phase: 'closed',
    label: `Market closed. Opens ${dayName} at 09:00 CAT.`,
    countdown: `${h}h ${m}m`,
    badgeColor: 'bg-secondary text-muted-foreground border-border',
    badgeLabel: 'Market Closed',
  };
};

const MarketStatusBanner = () => {
  const [info, setInfo] = useState(getMarketInfo);

  useEffect(() => {
    const interval = setInterval(() => setInfo(getMarketInfo()), 30000);
    return () => clearInterval(interval);
  }, []);

  const Icon = info.phase === 'open' ? Unlock : info.phase === 'pre_market' ? Clock : Lock;

  return (
    <div className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${info.badgeColor}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold">{info.badgeLabel}</span>
          <span className="text-[10px] opacity-70">{info.countdown}</span>
        </div>
        <p className="text-[10px] opacity-80">{info.label}</p>
      </div>
    </div>
  );
};

export default MarketStatusBanner;
