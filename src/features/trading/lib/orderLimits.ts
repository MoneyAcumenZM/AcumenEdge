import { SECURITY_CONFIG } from '@/lib/security';

/**
 * Money checks applied before an order is sent, shared by both places an
 * order can be placed (the Trade page and the quick order ticket) so they
 * can never drift apart. Like every client-side check these are UX gates
 * only — the server must enforce the same rules itself.
 */
export interface OrderLimitInput {
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  symbol: string;
  quantity: number;
  /** Limit price, or null for a market order. */
  limitPrice: number | null;
  /** Latest known price, used for the deviation check and market-order value. */
  lastPrice: number | null | undefined;
  /** Order value before fees. */
  consideration: number;
  totalFees: number;
  /** Confirmed wallet balance, or null when it couldn't be loaded. */
  walletBalance: number | null;
  /** Settled shares of this stock the user holds. */
  heldQuantity: number;
}

/** Returns the reason the order must not be sent, or null if it passes. */
export function checkOrderLimits(o: OrderLimitInput): string | null {
  if (o.consideration > SECURITY_CONFIG.MAX_ORDER_VALUE_ZMW) {
    return 'Order value cannot exceed K500,000 per single order.';
  }
  if (o.orderType === 'limit' && o.limitPrice != null && o.lastPrice) {
    const deviation = Math.abs(o.limitPrice - o.lastPrice) / o.lastPrice;
    if (deviation > SECURITY_CONFIG.MAX_PRICE_DEVIATION_PCT) {
      return 'Your limit price is more than 20% from the current market price.';
    }
  }
  if (o.side === 'buy') {
    // An unknown balance is not a sufficient one.
    if (o.walletBalance == null) {
      return "Your wallet balance couldn't be loaded, so this order can't be checked against it. Please try again shortly.";
    }
    if (o.consideration + o.totalFees > o.walletBalance) {
      return 'Insufficient wallet balance for this order.';
    }
  }
  if (o.side === 'sell' && o.quantity > o.heldQuantity) {
    return `Insufficient holdings — you have ${o.heldQuantity.toLocaleString()} settled shares of ${o.symbol}.`;
  }
  return null;
}

/** Settled shares of a stock in the user's holdings (matched by id or symbol). */
export function settledQuantity(
  holdings: ReadonlyArray<{ stock_id: string; settled_qty?: number | null; quantity?: number | null; stocks?: { symbol?: string } | null }> | undefined,
  symbol: string,
  stockId?: string,
): number {
  const held = holdings?.find((h) => (stockId && h.stock_id === stockId) || h.stocks?.symbol === symbol);
  return held ? Number(held.settled_qty ?? held.quantity ?? 0) : 0;
}
