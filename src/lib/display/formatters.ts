// Display formatting and masking utilities for client-facing UI
// ALL components must use these functions — never format raw engine values inline in JSX

// ─── ID Masking ─────────────────────────────────────────────────────
export function formatOrderId(rawId: string): string {
  const match = rawId.match(/(\d+)$/);
  const counter = match ? parseInt(match[1], 10) : 0;
  return `ORD-${String(counter).padStart(6, '0')}`;
}

export function formatTradeId(rawId: string): string {
  const match = rawId.match(/(\d+)$/);
  const counter = match ? parseInt(match[1], 10) : 0;
  return `TRD-${String(counter).padStart(6, '0')}`;
}

export function formatSettlementId(rawId: string): string {
  const match = rawId.match(/(\d+)$/);
  const counter = match ? parseInt(match[1], 10) : 0;
  return `SET-${String(counter).padStart(6, '0')}`;
}

export function formatClearanceId(rawId: string): string {
  const match = rawId.match(/(\d+)$/);
  const counter = match ? parseInt(match[1], 10) : 0;
  return `CLR-${String(counter).padStart(6, '0')}`;
}

// ─── CSD Account Masking ────────────────────────────────────────────
export function maskCSDAccount(accountNumber: string): string {
  if (!accountNumber) return '';
  const last2 = accountNumber.slice(-2);
  return `CSD-••••${last2}`;
}

// ─── ISIN Masking ───────────────────────────────────────────────────
export function maskIsin(isin: string): string {
  if (!isin || isin.length < 4) return isin;
  const last4 = isin.slice(-4);
  return `ZM${'••••••'}${last4}`;
}

// ─── Currency Formatting ────────────────────────────────────────────
export function formatZMW(amount: number): string {
  return `K${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Null-safe price formatter. Returns "—" for null/undefined, prefixes with currency. */
export function formatPrice(amount: number | null | undefined, currency: string = 'ZMW'): string {
  if (amount == null) return '—';
  const prefix = currency === 'USD' ? '$' : 'K';
  return `${prefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Relative time string from a date, e.g. "3 mins ago" */
export function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

/** Change percent colour class */
export function changeColor(pct: number | null | undefined): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct > 0) return 'text-success';
  if (pct < 0) return 'text-destructive';
  return 'text-muted-foreground';
}

/** Format change percent with +/- prefix */
export function formatChangePct(pct: number | null | undefined): string {
  if (pct == null) return '—';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

// ─── Board Labels ───────────────────────────────────────────────────
const boardLabels: Record<string, string> = {
  EQUITY: 'Main Board',
  ODD_LOT: 'Odd Lot',
  DEBT: 'Debt Market',
  CROSSING: 'Block Trade',
};

export function friendlyBoard(board: string): string {
  return boardLabels[board] || board;
}

// ─── Session Labels ─────────────────────────────────────────────────
const sessionLabels: Record<string, string> = {
  PRE_OPEN: 'Pre-Opening',
  OPENING_AUCTION: 'Opening Auction',
  CONTINUOUS: 'Market Open',
  CLOSED: 'Market Closed',
};

export function friendlySession(session: string): string {
  return sessionLabels[session] || session;
}

// ─── Trading Status Labels ──────────────────────────────────────────
const tradingStatusLabels: Record<string, string> = {
  PRE_OPEN: 'Pre-Opening',
  OPEN: 'Trading',
  HALTED: 'Halted',
  SUSPENDED: 'Suspended',
  CLOSED: 'Closed',
};

export function friendlyTradingStatus(status: string): string {
  return tradingStatusLabels[status] || status;
}

// ─── Order Status Labels ────────────────────────────────────────────
const orderStatusLabels: Record<string, string> = {
  PENDING: 'Open',
  PARTIAL: 'Partially Filled',
  FILLED: 'Filled',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

export function friendlyOrderStatus(status: string): string {
  return orderStatusLabels[status] || status;
}

// ─── Settlement Status ──────────────────────────────────────────────
const settlementStatusLabels: Record<string, string> = {
  PENDING: 'Settling',
  SETTLED: 'Settled',
  FAILED: 'Settlement Issue — Contact Broker',
  CANCELLED: 'Cancelled',
};

export function friendlySettlementStatus(status: string): string {
  return settlementStatusLabels[status] || status;
}

// ─── Account Type Labels ────────────────────────────────────────────
const accountTypeLabels: Record<string, string> = {
  INDIVIDUAL: 'Personal Account',
  INSTITUTIONAL: 'Corporate Account',
  BROKER_OWN: 'Broker Account',
};

export function friendlyAccountType(accountType: string): string {
  return accountTypeLabels[accountType] || accountType;
}

// ─── SWIFT Message Type Labels (Broker Admin only) ──────────────────
const swiftTypeLabels: Record<string, string> = {
  MT541: 'Buy Clearance Sent',
  MT543: 'Sell Clearance Sent',
  MT545: 'Buy Confirmed',
  MT547: 'Sell Confirmed',
  MT548: 'Status Update',
  MT535: 'Holdings Refresh',
  MT509: 'Trade Notification',
  MT540: 'Buy Instruction',
  MT542: 'Sell Instruction',
  MT544: 'Buy Confirmation',
  MT546: 'Sell Confirmation',
  MT537: 'Statement Pending',
};

export function friendlySWIFTType(messageType: string): string {
  return swiftTypeLabels[messageType] || messageType;
}

// ─── Rejection Reason Sanitization ──────────────────────────────────
const rejectionMap: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /MARKET orders not allowed during PRE_OPEN/i, message: 'Market orders are not accepted during the pre-opening session. Please use a limit order.' },
  { pattern: /Price .* outside .*±25%.*last close.*\((.+)\)/i, message: 'Your price is outside today\'s permitted range.' },
  { pattern: /LIMIT orders must have a valid price/i, message: 'Please enter a price for your limit order.' },
  { pattern: /Odd lot quantity must be between 1 and 99/i, message: 'Odd lot orders must be between 1 and 99 shares.' },
  { pattern: /Security .* is HALTED/i, message: 'Trading in this security is currently halted.' },
  { pattern: /Security .* is SUSPENDED/i, message: 'Trading in this security is currently suspended.' },
  { pattern: /GTD expiry cannot exceed 15 business days/i, message: 'Orders can remain open for a maximum of 15 business days.' },
  { pattern: /Insufficient.*Holdings/i, message: 'You do not have enough shares available to place this sell order.' },
  { pattern: /Account not registered under your brokerage/i, message: 'This account could not be verified. Please contact your broker.' },
  { pattern: /Account .* is frozen/i, message: 'Your account is currently restricted. Please contact Infinity Brokers.' },
  { pattern: /Security not found/i, message: 'This security could not be found. Please try again.' },
  { pattern: /Price.*outside.*spread/i, message: 'Your price is outside today\'s permitted range.' },
  { pattern: /tick/i, message: 'Price must be in K0.01 increments.' },
];

export function friendlyRejectionReason(reason: string | null | undefined): string {
  if (!reason) return 'Order could not be submitted. Please review your details or contact support.';
  for (const { pattern, message } of rejectionMap) {
    if (pattern.test(reason)) {
      // Try to extract the range if present
      const rangeMatch = reason.match(/\((K[\d.,]+ – K[\d.,]+)\)/);
      if (rangeMatch) return `${message} Allowed: ${rangeMatch[1]}`;
      return message;
    }
  }
  return 'Order could not be submitted. Please review your details or contact support.';
}

// ─── Date Formatting ────────────────────────────────────────────────
export function friendlySettlementDate(date: Date): string {
  return `Settles ${date.toLocaleDateString('en-ZM', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export function friendlyDepositDate(date: Date): string {
  return `Held since ${date.toLocaleDateString('en-ZM', { month: 'long', year: 'numeric' })}`;
}

// ─── Generic error sanitizer ────────────────────────────────────────
export function sanitiseErrorForClient(error: unknown): string {
  return 'Something went wrong. Please refresh or contact support.';
}

// ─── Submission Step Labels ─────────────────────────────────────────
export function friendlySubmissionStep(stage: string): string {
  switch (stage) {
    case 'csd_account': return 'Verifying Account';
    case 'csd_clearance': return 'Securing Order';
    case 'ats_submission': return 'Placing Order';
    default: return 'Processing your order, please wait...';
  }
}

// ─── Filled quantity display ────────────────────────────────────────
export function friendlyFilled(filled: number, total: number): string {
  if (filled === 0) return '';
  if (filled >= total) return 'Fully filled';
  return `${filled.toLocaleString()} of ${total.toLocaleString()} filled`;
}
