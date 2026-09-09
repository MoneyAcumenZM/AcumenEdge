// SIMULATION / DISPLAY ONLY — this module never determines what a user believes filled.
// Real fills come only from the exchange via fix-bridge-webhook.

import { Order, OrderBook, Trade, Security } from './types';

let tradeCounter = 0;
function generateTradeId(): string {
  return `trade-${Date.now()}-${++tradeCounter}`;
}

interface AuctionResult {
  openingPrice: number | null;
  trades: Trade[];
  unmatchedBids: Order[];
  unmatchedAsks: Order[];
  openingVWAP: number | null;
}

export function runOpeningAuction(securityId: string, orderBook: OrderBook, security: Security): AuctionResult {
  const bids = [...orderBook.bids].filter(o => o.type === 'LIMIT' && o.price != null);
  const asks = [...orderBook.asks].filter(o => o.type === 'LIMIT' && o.price != null);

  if (bids.length === 0 || asks.length === 0) {
    return { openingPrice: null, trades: [], unmatchedBids: bids, unmatchedAsks: asks, openingVWAP: null };
  }

  const allPrices = new Set<number>();
  bids.forEach(b => allPrices.add(b.price!));
  asks.forEach(a => allPrices.add(a.price!));
  const sortedPrices = Array.from(allPrices).sort((a, b) => a - b);

  let bestPrice: number | null = null;
  let maxVolume = 0;

  for (const price of sortedPrices) {
    const cumBuyVol = bids.filter(b => b.price! >= price).reduce((sum, b) => sum + (b.quantity - b.filledQuantity), 0);
    const cumSellVol = asks.filter(a => a.price! <= price).reduce((sum, a) => sum + (a.quantity - a.filledQuantity), 0);
    const executableVol = Math.min(cumBuyVol, cumSellVol);
    if (executableVol > maxVolume || (executableVol === maxVolume && price > (bestPrice ?? 0))) {
      maxVolume = executableVol;
      bestPrice = price;
    }
  }

  if (bestPrice === null || maxVolume === 0) {
    return { openingPrice: null, trades: [], unmatchedBids: bids, unmatchedAsks: asks, openingVWAP: null };
  }

  const trades: Trade[] = [];
  const eligibleBids = bids.filter(b => b.price! >= bestPrice!).sort((a, b) => {
    if (b.price! !== a.price!) return b.price! - a.price!;
    return a.timestamp.getTime() - b.timestamp.getTime();
  });
  const eligibleAsks = asks.filter(a => a.price! <= bestPrice!).sort((a, b) => {
    if (a.price! !== b.price!) return a.price! - b.price!;
    return a.timestamp.getTime() - b.timestamp.getTime();
  });

  let remainingVolume = maxVolume;
  let bidIdx = 0, askIdx = 0;

  while (remainingVolume > 0 && bidIdx < eligibleBids.length && askIdx < eligibleAsks.length) {
    const bid = eligibleBids[bidIdx];
    const ask = eligibleAsks[askIdx];
    const tradeQty = Math.min(bid.quantity - bid.filledQuantity, ask.quantity - ask.filledQuantity, remainingVolume);
    if (tradeQty <= 0) break;

    trades.push({ id: generateTradeId(), buyOrderId: bid.id, sellOrderId: ask.id, securityId, executionPrice: bestPrice, quantity: tradeQty, timestamp: new Date(), session: 'OPENING_AUCTION' });
    bid.filledQuantity += tradeQty;
    ask.filledQuantity += tradeQty;
    remainingVolume -= tradeQty;

    if (bid.filledQuantity >= bid.quantity) { bid.status = 'FILLED'; bidIdx++; } else { bid.status = 'PARTIAL'; }
    if (ask.filledQuantity >= ask.quantity) { ask.status = 'FILLED'; askIdx++; } else { ask.status = 'PARTIAL'; }
  }

  let totalValue = 0, totalQty = 0;
  for (const t of trades) { totalValue += t.executionPrice * t.quantity; totalQty += t.quantity; }
  const openingVWAP = totalQty > 0 ? totalValue / totalQty : null;

  security.currentVWAP = openingVWAP;
  security.lastPrice = bestPrice;
  if (totalQty > 0) { security.dayHigh = bestPrice; security.dayLow = bestPrice; security.totalVolume += totalQty; }

  return { openingPrice: bestPrice, trades, unmatchedBids: bids.filter(b => b.status !== 'FILLED'), unmatchedAsks: asks.filter(a => a.status !== 'FILLED'), openingVWAP };
}
