// Shared trading utility functions

export type OrderStatus = 'pending' | 'submitting' | 'active' | 'open' | 'queued' | 'partial' | 'partial_fill' | 'filled' | 'cancel_requested' | 'cancelled' | 'rejected' | 'expired' | 'settlement_pending' | 'settled';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderQualifier = 'day' | 'gtd' | 'fok' | 'ioc';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  nrc_passport: string | null;
  tpin: string | null;
  physical_address: string | null;
  province: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  date_of_birth: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_relation: string | null;
  sor_account: string | null;
  broker_bpid: string;
  member_bank_sca: string;
  platform_code: string;
  csd_registered: boolean;
  csd_registered_at: string | null;
  kyc_status: 'pending' | 'under_review' | 'approved' | 'rejected';
  kyc_rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  account_status?: 'active' | 'suspended' | 'banned' | 'trading_restricted' | 'withdrawal_restricted' | null;
  restriction_reason?: string | null;
  restriction_until?: string | null;
}

export interface Stock {
  id: string;
  symbol: string;
  name: string;
  isin: string;
  sector: string | null;
  currency: string;
  min_trade_qty: number;
  lot_size: number;
  settlement_days: number;
  last_price: number | null;
  bid_price: number | null;
  ask_price: number | null;
  open_price: number | null;
  high_price: number | null;
  low_price: number | null;
  change_amount: number | null;
  change_percent: number | null;
  volume: number;
  is_active: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  stock_id: string;
  stocks?: Stock;
  side: OrderSide;
  order_type: OrderType;
  qualifier: OrderQualifier;
  quantity: number;
  limit_price: number | null;
  expiry_date: string | null;
  status: OrderStatus;
  rejection_reason: string | null;
  client_order_id: string | null;
  ats_reference: string | null;
  settlement_date: string | null;
  settlement_cycle: string;
  sor_account: string | null;
  broker_bpid: string | null;
  filled_quantity: number;
  filled_price: number | null;
  fill_value: number | null;
  filled_at: string | null;
  settled_at: string | null;
  consideration: number | null;
  luse_fee: number | null;
  broker_fee: number | null;
  levy: number | null;
  total_fees: number | null;
  net_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioHolding {
  id: string;
  user_id: string;
  stock_id: string;
  stocks?: Stock;
  quantity: number;
  settled_qty: number;
  pending_qty: number;
  average_cost: number | null;
  total_cost: number | null;
  current_value: number | null;
  gain_loss: number | null;
  gain_loss_pct: number | null;
  csd_status: 'csd_deposited' | 'pending_deposit' | 'not_deposited';
}

export interface MarketStatus {
  session_phase: 'pre_open_auction' | 'open_auction' | 'continuous' | 'intraday_auction' | 'closing_auction' | 'post_close' | 'closed';
  trading_allowed: boolean;
  updated_at: string;
}

export function calcSettlementDate(tradeDate: Date): string {
  let count = 0;
  const d = new Date(tradeDate);
  while (count < 3) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return d.toLocaleDateString('en-ZM', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function calcSettlementDateISO(tradeDate: Date): string {
  let count = 0;
  const d = new Date(tradeDate);
  while (count < 3) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return d.toISOString().split('T')[0];
}

// Fees: SEC 0.125%, LuSE 0.25%, Broker 1%, Total 1.375%.
// DISPLAY ONLY — the server (submit-order + _shared/money.ts) is authoritative.
// Computed in integer ngwee to avoid floating-point drift; formula unchanged.
export function calcFees(consideration: number, side: OrderSide) {
  const considerationMinor = Math.round(consideration * 100);
  const secFeeMinor = Math.round((considerationMinor * 125) / 100_000);
  const luseFeeMinor = Math.round((considerationMinor * 250) / 100_000);
  const brokerFeeMinor = Math.round((considerationMinor * 1000) / 100_000);
  const totalFeesMinor = secFeeMinor + luseFeeMinor + brokerFeeMinor;
  const netValueMinor = side === 'buy'
    ? considerationMinor + totalFeesMinor
    : considerationMinor - totalFeesMinor;
  return {
    secFee: secFeeMinor / 100,
    luseFee: luseFeeMinor / 100,
    brokerFee: brokerFeeMinor / 100,
    totalFees: totalFeesMinor / 100,
    netValue: netValueMinor / 100,
  };
}


export function formatZMW(amount: number): string {
  return 'K' + amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getStatusDisplay(status: OrderStatus): { label: string; color: string } {
  const map: Record<OrderStatus, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'gray' },
    submitting: { label: 'Submitting', color: 'gray' },
    active: { label: 'Active', color: 'blue' },
    open: { label: 'Open', color: 'blue' },
    queued: { label: 'Queued', color: 'gray' },
    partial: { label: 'Partial Fill', color: 'amber' },
    partial_fill: { label: 'Partial Fill', color: 'amber' },
    filled: { label: 'Filled', color: 'green' },
    cancel_requested: { label: 'Cancelling...', color: 'red' },
    cancelled: { label: 'Cancelled', color: 'gray' },
    rejected: { label: 'Rejected', color: 'red' },
    expired: { label: 'Expired', color: 'orange' },
    settlement_pending: { label: 'Settling (T+3)', color: 'cyan' },
    settled: { label: 'Settled', color: 'green' },
  };
  return map[status] || { label: status, color: 'gray' };
}

export const OPEN_ORDER_STATUSES: OrderStatus[] = ['active', 'open', 'queued', 'pending', 'submitting', 'partial', 'partial_fill', 'cancel_requested'];
export const FILLED_ORDER_STATUSES: OrderStatus[] = ['filled', 'partial_fill', 'settlement_pending', 'settled'];
