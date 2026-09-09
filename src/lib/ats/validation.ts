// SIMULATION / DISPLAY ONLY — this module never determines what a user believes filled.
// Real fills come only from the exchange via fix-bridge-webhook.

import { Order, Security, SessionState, OrderBook, ValidationResult } from './types';

export function validateOrder(
  order: Partial<Order>,
  security: Security,
  session: SessionState,
  _orderBook: OrderBook
): ValidationResult {
  if (security.tradingStatus === 'HALTED' || security.tradingStatus === 'SUSPENDED') {
    return { valid: false, rejectionReason: `Security ${security.ticker} is ${security.tradingStatus}` };
  }

  if (session === 'CLOSED') {
    return { valid: false, rejectionReason: 'Market is closed. No orders accepted.' };
  }

  if (session === 'PRE_OPEN') {
    if (order.type === 'MARKET') return { valid: false, rejectionReason: 'MARKET orders not allowed during PRE_OPEN' };
    if (order.qualifier === 'FOK') return { valid: false, rejectionReason: 'FOK orders not allowed during PRE_OPEN' };
    if (order.qualifier === 'FAK') return { valid: false, rejectionReason: 'FAK orders not allowed during PRE_OPEN' };
    if (order.disclosedQuantity != null && order.disclosedQuantity > 0) return { valid: false, rejectionReason: 'Iceberg orders not allowed during PRE_OPEN' };
    if (order.board === 'ODD_LOT') return { valid: false, rejectionReason: 'Odd lot orders not allowed during PRE_OPEN' };
  }

  if (!security.isNewlyListed && order.type === 'LIMIT' && order.price != null) {
    const lowerBound = security.lastClosingPrice * (1 - security.priceSpreadLimit);
    const upperBound = security.lastClosingPrice * (1 + security.priceSpreadLimit);
    if (order.price < lowerBound || order.price > upperBound) {
      return { valid: false, rejectionReason: `Price K${order.price.toFixed(2)} outside ±25% of last close K${security.lastClosingPrice.toFixed(2)} (K${lowerBound.toFixed(2)} – K${upperBound.toFixed(2)})` };
    }
  }

  if (order.price != null) {
    const remainder = Math.round((order.price % security.tickSize) * 100) / 100;
    if (remainder !== 0) return { valid: false, rejectionReason: `Price must be divisible by tick size ${security.tickSize}` };
  }

  if (!order.quantity || order.quantity <= 0) return { valid: false, rejectionReason: 'Quantity must be greater than 0' };

  if (order.board === 'ODD_LOT' && (order.quantity < 1 || order.quantity > 99)) {
    return { valid: false, rejectionReason: 'Odd lot quantity must be between 1 and 99' };
  }

  if (order.type === 'LIMIT' && (order.price == null || order.price <= 0)) {
    return { valid: false, rejectionReason: 'LIMIT orders must have a valid price' };
  }

  if (order.type === 'MARKET' && order.price != null) {
    return { valid: false, rejectionReason: 'MARKET orders must not specify a price' };
  }

  if (order.disclosedQuantity != null && order.disclosedQuantity > 0) {
    if (order.disclosedQuantity >= (order.quantity || 0)) {
      return { valid: false, rejectionReason: 'Iceberg disclosed quantity must be less than total quantity' };
    }
  }

  if (order.timeInForce === 'GTD') {
    if (!order.expiryDate) return { valid: false, rejectionReason: 'GTD orders must have an expiry date' };
    const maxExpiry = addBusinessDays(new Date(), 15);
    if (order.expiryDate > maxExpiry) return { valid: false, rejectionReason: 'GTD expiry cannot exceed 15 business days' };
  }

  if (security.isNewlyListed && order.type !== 'LIMIT') {
    return { valid: false, rejectionReason: 'Newly listed securities only accept LIMIT orders' };
  }

  return { valid: true, rejectionReason: null };
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}
