import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

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

  // Frontend-only build: no backend enforcement, so nothing is restricted
  // and no restriction banners are surfaced.
  void getRestrictionBanner;

  return {
    accountStatus: status,
    canTrade: true,
    canWithdraw: true,
    canDeposit: true,
    isBanned: false,
    isSuspended: false,
    restrictionBanner: null as string | null,
    restrictionUntil: until,
    restrictionReason: reason,
    csdPending: false,
  };
}

