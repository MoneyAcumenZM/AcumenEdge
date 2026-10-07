import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { isCsdRegistered } from '@/lib/tradingUtils';

export type AccountStatus = 'active' | 'suspended' | 'banned' | 'trading_restricted' | 'withdrawal_restricted' | null;

function formatRestrictionUntil(until: string | null | undefined): string {
  if (!until) return 'until further notice';
  try {
    const date = new Date(until);
    if (isNaN(date.getTime())) return 'until further notice';
    return `until ${format(date, 'dd MMM yyyy, HH:mm')}`;
  } catch {
    return 'until further notice';
  }
}

function getRestrictionBanner(status: AccountStatus, reason?: string | null, until?: string | null): string | null {
  const timeframe = formatRestrictionUntil(until);
  const reasonText = reason ? ` Reason: ${reason}.` : '';
  const contact = 'Contact Money Acumen Advisory at trading@moneyacumenadvisory.com for assistance.';

  if (status === 'banned') return `Your account has been permanently closed.${reasonText} ${contact}`;
  if (status === 'suspended') return `Your account is temporarily suspended ${timeframe}.${reasonText} ${contact}`;
  if (status === 'trading_restricted') return `Trading on your account is restricted ${timeframe}.${reasonText} ${contact}`;
  if (status === 'withdrawal_restricted') return `Withdrawals are restricted ${timeframe}.${reasonText} ${contact}`;
  return null;
}

export function useAccountRestrictions() {
  const { profile } = useAuth();
  const status = (profile?.account_status as AccountStatus) || 'active';
  const reason = profile?.restriction_reason ?? null;
  const until = profile?.restriction_until ?? null;

  // Client-side UX gates only — the server must independently re-validate
  // every trade/withdrawal/deposit regardless of what this hook returns.
  const isBanned = status === 'banned';
  const isSuspended = status === 'suspended';
  const isRestrictionActive = (() => {
    if (!until) return true;
    const untilDate = new Date(until);
    if (isNaN(untilDate.getTime())) return true;
    return untilDate.getTime() > Date.now();
  })();

  const tradingRestricted = isBanned || isSuspended || (status === 'trading_restricted' && isRestrictionActive);
  const withdrawalRestricted = isBanned || isSuspended || (status === 'withdrawal_restricted' && isRestrictionActive);

  const csdPending = profile ? !isCsdRegistered(profile) : false;

  // Why this user can't open an order ticket right now, or null if they can.
  const tradeBlockedReason = !profile
    ? 'Sign in to trade'
    : tradingRestricted
      ? 'Your account is currently restricted. Contact support.'
      : profile.kyc_status !== 'approved'
        ? 'Your identity verification is pending.'
        : csdPending
          ? 'Complete your account setup to trade'
          : null;

  return {
    accountStatus: status,
    canTrade: !tradingRestricted && !csdPending,
    canWithdraw: !withdrawalRestricted,
    canDeposit: !isBanned && !isSuspended,
    isBanned,
    isSuspended,
    restrictionBanner: getRestrictionBanner(status, reason, until),
    restrictionUntil: until,
    restrictionReason: reason,
    csdPending,
    tradeBlockedReason,
  };
}

