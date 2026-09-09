// SIMULATION / DISPLAY ONLY — this module never determines what a user believes filled.
// Real fills come only from the exchange via fix-bridge-webhook.

import { Trade, Security } from './types';

export function calculateClosingVWAP(securityId: string, trades: Trade[], security: Security): number | null {
  const securityTrades = trades.filter(t => t.securityId === securityId);
  if (securityTrades.length === 0) return security.lastClosingPrice;

  let totalValue = 0, totalQuantity = 0;
  for (const trade of securityTrades) { totalValue += trade.executionPrice * trade.quantity; totalQuantity += trade.quantity; }
  const vwap = totalQuantity > 0 ? totalValue / totalQuantity : null;

  if (vwap !== null) {
    security.lastClosingPrice = Math.round(vwap * 100) / 100;
    security.currentVWAP = vwap;
  }
  return vwap;
}

export function calculateRunningVWAP(trades: Trade[], securityId: string): number | null {
  const securityTrades = trades.filter(t => t.securityId === securityId);
  if (securityTrades.length === 0) return null;
  let totalValue = 0, totalQuantity = 0;
  for (const trade of securityTrades) { totalValue += trade.executionPrice * trade.quantity; totalQuantity += trade.quantity; }
  return totalQuantity > 0 ? Math.round((totalValue / totalQuantity) * 100) / 100 : null;
}
