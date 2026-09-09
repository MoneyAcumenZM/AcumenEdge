// SIMULATION / DISPLAY ONLY — this module never determines what a user believes filled.
// Real fills come only from the exchange via fix-bridge-webhook.

import { Order, OrderBook, Trade, Security } from './types';

let tradeCounter = 0;
function generateTradeId(): string {
  return `ctrade-${Date.now()}-${++tradeCounter}`;
}

interface MatchResult {
  trades: Trade[];
  remainingOrder: Order | null;
  icebergChildOrders: Order[];
}

export function matchOrder(incoming: Order, orderBook: OrderBook, security: Security): MatchResult {
  const trades: Trade[] = [];
  const icebergChildOrders: Order[] = [];
  const isBuy = incoming.side === 'BUY';
  const oppositeBook = isBuy ? orderBook.asks : orderBook.bids;

  if (incoming.qualifier === 'FOK') {
    const availableQty = calculateAvailableQuantity(incoming, oppositeBook);
    if (availableQty < incoming.quantity - incoming.filledQuantity) {
      incoming.status = 'CANCELLED';
      return { trades, remainingOrder: null, icebergChildOrders };
    }
  }

  let remainingQty = incoming.quantity - incoming.filledQuantity;

  while (remainingQty > 0 && oppositeBook.length > 0) {
    const resting = oppositeBook[0];
    const restingRemaining = resting.quantity - resting.filledQuantity;
    if (restingRemaining <= 0) { oppositeBook.shift(); continue; }
    if (!isPriceCompatible(incoming, resting)) break;

    const executionPrice = determineExecutionPrice(incoming, resting, oppositeBook);
    const tradeQty = Math.min(remainingQty, restingRemaining);

    trades.push({ id: generateTradeId(), buyOrderId: isBuy ? incoming.id : resting.id, sellOrderId: isBuy ? resting.id : incoming.id, securityId: security.id, executionPrice, quantity: tradeQty, timestamp: new Date(), session: 'CONTINUOUS' });

    incoming.filledQuantity += tradeQty;
    resting.filledQuantity += tradeQty;
    remainingQty -= tradeQty;

    if (resting.filledQuantity >= resting.quantity) {
      resting.status = 'FILLED';
      if (resting.hiddenQuantity && resting.hiddenQuantity > 0) {
        const nextTranche = Math.min(resting.disclosedQuantity || resting.hiddenQuantity, resting.hiddenQuantity);
        resting.hiddenQuantity -= nextTranche;
        icebergChildOrders.push({ ...resting, id: `iceberg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, quantity: nextTranche, filledQuantity: 0, status: 'PENDING', timestamp: new Date(), hiddenQuantity: resting.hiddenQuantity > 0 ? resting.hiddenQuantity : null });
      }
      oppositeBook.shift();
    } else {
      resting.status = 'PARTIAL';
    }
  }

  if (incoming.filledQuantity >= incoming.quantity) { incoming.status = 'FILLED'; }
  else if (incoming.filledQuantity > 0) { incoming.status = 'PARTIAL'; }

  if (incoming.qualifier === 'FAK' && incoming.filledQuantity < incoming.quantity) {
    incoming.status = incoming.filledQuantity > 0 ? 'PARTIAL' : 'CANCELLED';
    return { trades, remainingOrder: null, icebergChildOrders };
  }

  if (incoming.type === 'MARKET' && incoming.filledQuantity < incoming.quantity) {
    incoming.status = incoming.filledQuantity > 0 ? 'PARTIAL' : 'CANCELLED';
    return { trades, remainingOrder: null, icebergChildOrders };
  }

  for (const trade of trades) {
    security.totalVolume += trade.quantity;
    security.lastPrice = trade.executionPrice;
    if (security.dayHigh === null || trade.executionPrice > security.dayHigh) security.dayHigh = trade.executionPrice;
    if (security.dayLow === null || trade.executionPrice < security.dayLow) security.dayLow = trade.executionPrice;
  }

  const remainingOrder = incoming.status === 'PENDING' || incoming.status === 'PARTIAL' ? incoming : null;
  return { trades, remainingOrder, icebergChildOrders };
}

function isPriceCompatible(incoming: Order, resting: Order): boolean {
  if (incoming.type === 'MARKET') return true;
  if (resting.type === 'MARKET') return true;
  if (incoming.side === 'BUY') return incoming.price! >= resting.price!;
  return incoming.price! <= resting.price!;
}

function determineExecutionPrice(incoming: Order, resting: Order, oppositeBook: Order[]): number {
  if (incoming.type === 'LIMIT' && resting.type === 'LIMIT') return resting.price!;
  if (incoming.type === 'LIMIT' && resting.type === 'MARKET') {
    const betterLimit = oppositeBook.find((o, i) => i > 0 && o.type === 'LIMIT' && o.price != null);
    if (betterLimit) {
      return incoming.side === 'BUY' ? Math.min(incoming.price!, betterLimit.price!) : Math.max(incoming.price!, betterLimit.price!);
    }
    return incoming.price!;
  }
  if (incoming.type === 'MARKET' && resting.type === 'LIMIT') return resting.price!;
  return resting.price || incoming.price || 0;
}

function calculateAvailableQuantity(incoming: Order, oppositeBook: Order[]): number {
  let available = 0;
  for (const resting of oppositeBook) {
    if (!isPriceCompatible(incoming, resting)) break;
    available += resting.quantity - resting.filledQuantity;
  }
  return available;
}
