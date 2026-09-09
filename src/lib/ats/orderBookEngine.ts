// SIMULATION / DISPLAY ONLY — this module never determines what a user believes filled.
// Real fills come only from the exchange via fix-bridge-webhook.

import { Order, OrderBook, Trade, Security, SessionState } from './types';
import { validateOrder } from './validation';
import { matchOrder } from './continuousMatching';
import { calculateRunningVWAP } from './closingVWAP';

let orderCounter = 0;
function generateOrderId(): string {
  return `ord-${Date.now()}-${++orderCounter}`;
}

export class OrderBookEngine {
  private books: Map<string, OrderBook> = new Map();
  private securities: Map<string, Security> = new Map();
  private allTrades: Trade[] = [];
  private allOrders: Order[] = [];
  private listeners: Array<() => void> = [];
  private newTradesBuffer: Trade[] = [];

  constructor(securities: Security[]) {
    for (const sec of securities) {
      this.securities.set(sec.id, { ...sec });
      this.books.set(sec.id, { securityId: sec.id, bids: [], asks: [] });
    }
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private notify() { for (const l of this.listeners) l(); }

  getSecurities(): Security[] { return Array.from(this.securities.values()); }
  getSecurity(id: string): Security | undefined { return this.securities.get(id); }
  getOrderBook(securityId: string): OrderBook { return this.books.get(securityId) || { securityId, bids: [], asks: [] }; }
  getAllTrades(): Trade[] { return [...this.allTrades]; }
  getTradesForSecurity(securityId: string): Trade[] { return this.allTrades.filter(t => t.securityId === securityId); }
  getAllOrders(): Order[] { return [...this.allOrders]; }
  getNewTrades(): Trade[] { const t = [...this.newTradesBuffer]; this.newTradesBuffer = []; return t; }

  addOrder(orderInput: Omit<Order, 'id' | 'timestamp' | 'filledQuantity' | 'status' | 'rejectionReason'>, session: SessionState): Order {
    const security = this.securities.get(orderInput.securityId);
    if (!security) {
      const rejected: Order = { ...orderInput, id: generateOrderId(), timestamp: new Date(), filledQuantity: 0, status: 'REJECTED', rejectionReason: 'Security not found' };
      this.allOrders.push(rejected);
      this.notify();
      return rejected;
    }

    const book = this.getOrderBook(orderInput.securityId);

    if (orderInput.board === 'EQUITY' && orderInput.quantity % 100 !== 0) {
      const roundLot = Math.floor(orderInput.quantity / 100) * 100;
      const oddLot = orderInput.quantity % 100;
      const orders: Order[] = [];
      if (roundLot > 0) orders.push(this.addOrder({ ...orderInput, quantity: roundLot, board: 'EQUITY' }, session));
      if (oddLot > 0) orders.push(this.addOrder({ ...orderInput, quantity: oddLot, board: 'ODD_LOT' }, session));
      return orders[0];
    }

    const order: Order = { ...orderInput, id: generateOrderId(), timestamp: new Date(), filledQuantity: 0, status: 'PENDING', rejectionReason: null };

    const validation = validateOrder(order, security, session, book);
    if (!validation.valid) {
      order.status = 'REJECTED';
      order.rejectionReason = validation.rejectionReason;
      this.allOrders.push(order);
      this.notify();
      return order;
    }

    if (order.disclosedQuantity && order.disclosedQuantity < order.quantity) {
      order.hiddenQuantity = order.quantity - order.disclosedQuantity;
      order.quantity = order.disclosedQuantity;
    }

    this.allOrders.push(order);

    if (order.side === 'BUY') { book.bids.push(order); this.sortBids(book.bids); }
    else { book.asks.push(order); this.sortAsks(book.asks); }

    if (session === 'CONTINUOUS') {
      const result = matchOrder(order, book, security);
      this.allTrades.push(...result.trades);
      this.newTradesBuffer.push(...result.trades);

      for (const child of result.icebergChildOrders) {
        this.allOrders.push(child);
        if (child.side === 'BUY') { book.bids.push(child); this.sortBids(book.bids); }
        else { book.asks.push(child); this.sortAsks(book.asks); }
      }

      book.bids = book.bids.filter(o => o.status !== 'FILLED' && o.status !== 'CANCELLED');
      book.asks = book.asks.filter(o => o.status !== 'FILLED' && o.status !== 'CANCELLED');

      if (result.trades.length > 0) {
        security.currentVWAP = calculateRunningVWAP(this.allTrades, security.id);
      }
    }

    this.notify();
    return order;
  }

  cancelOrder(orderId: string): boolean {
    const order = this.allOrders.find(o => o.id === orderId);
    if (!order || order.status === 'FILLED' || order.status === 'CANCELLED') return false;
    order.status = 'CANCELLED';
    const book = this.books.get(order.securityId);
    if (book) {
      book.bids = book.bids.filter(o => o.id !== orderId);
      book.asks = book.asks.filter(o => o.id !== orderId);
    }
    this.notify();
    return true;
  }

  amendOrder(orderId: string, newPrice?: number, newQuantity?: number, session: SessionState = 'CONTINUOUS'): Order | null {
    const original = this.allOrders.find(o => o.id === orderId);
    if (!original || original.status === 'FILLED' || original.status === 'CANCELLED') return null;
    this.cancelOrder(orderId);
    return this.addOrder({
      securityId: original.securityId, clientAccount: original.clientAccount, brokerId: original.brokerId,
      side: original.side, type: original.type, quantity: newQuantity ?? original.quantity,
      price: newPrice ?? original.price, timeInForce: original.timeInForce, expiryDate: original.expiryDate,
      qualifier: original.qualifier, disclosedQuantity: original.disclosedQuantity,
      hiddenQuantity: original.hiddenQuantity, board: original.board,
    }, session);
  }

  updateSecurityStatus(securityId: string, status: Security['tradingStatus']): void {
    const sec = this.securities.get(securityId);
    if (sec) { sec.tradingStatus = status; this.notify(); }
  }

  resetDailyStats(): void {
    for (const sec of this.securities.values()) {
      sec.dayHigh = null; sec.dayLow = null; sec.totalVolume = 0;
      sec.currentVWAP = null; sec.lastPrice = null; sec.tradingStatus = 'CLOSED';
    }
    this.allTrades = [];
    for (const book of this.books.values()) { book.bids = []; book.asks = []; }
    this.notify();
  }

  private sortBids(bids: Order[]): void {
    bids.sort((a, b) => {
      if (a.type === 'MARKET' && b.type !== 'MARKET') return -1;
      if (b.type === 'MARKET' && a.type !== 'MARKET') return 1;
      if ((b.price || 0) !== (a.price || 0)) return (b.price || 0) - (a.price || 0);
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }

  private sortAsks(asks: Order[]): void {
    asks.sort((a, b) => {
      if (a.type === 'MARKET' && b.type !== 'MARKET') return -1;
      if (b.type === 'MARKET' && a.type !== 'MARKET') return 1;
      if ((a.price || 0) !== (b.price || 0)) return (a.price || 0) - (b.price || 0);
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }
}
