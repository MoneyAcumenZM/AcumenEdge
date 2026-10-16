/**
 * Per-stock trading halts, as seen by order entry.
 *
 * The halts feed used to drive only a banner. Order entry now asks here
 * whether a symbol may be traded, and unknown is not the same as cleared:
 * if the feed could not be read, the answer is "can't confirm", the same
 * fail-closed rule the market session check already follows.
 */
export interface HaltState {
  halted_symbols?: string[];
  halts_known?: boolean;
}

export type HaltCheck =
  | { blocked: false }
  | { blocked: true; reason: 'halted' | 'unknown'; message: string };

export function checkHalt(status: HaltState | null | undefined, symbol: string | null | undefined): HaltCheck {
  const sym = (symbol ?? '').trim().toUpperCase();
  if (!sym) return { blocked: false };
  // No status loaded yet is handled by the session check; this is only
  // about a halts feed that was tried and failed.
  if (!status) return { blocked: false };
  if (status.halts_known === false) {
    return {
      blocked: true,
      reason: 'unknown',
      message: "We can't confirm the trading status of this stock right now. Please try again shortly.",
    };
  }
  if ((status.halted_symbols ?? []).some((h) => h.trim().toUpperCase() === sym)) {
    return { blocked: true, reason: 'halted', message: `Trading in ${sym} is halted. Orders can't be placed until it resumes.` };
  }
  return { blocked: false };
}
