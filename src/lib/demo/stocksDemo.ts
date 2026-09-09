// Demo seed data for Market and Stocks pages.
// Used as a fallback when the live Supabase/middleware feed returns no rows.

export type DemoStock = {
  id: string;
  symbol: string;
  name: string;
  isin: string;
  sector: string;
  currency: string;
  min_trade_qty: number;
  lot_size: number;
  settlement_days: number;
  last_price: number;
  bid_price: number;
  ask_price: number;
  open_price: number;
  high_price: number;
  low_price: number;
  prev_close: number;
  change_amount: number;
  change_percent: number;
  volume: number;
  is_active: boolean;
  price_updated_at: string;
};

const now = () => new Date().toISOString();

const make = (
  symbol: string,
  name: string,
  sector: string,
  last: number,
  prev: number,
  vol: number,
): DemoStock => {
  const change = +(last - prev).toFixed(2);
  const pct = +((change / prev) * 100).toFixed(2);
  const high = +(last * 1.012).toFixed(2);
  const low = +(last * 0.988).toFixed(2);
  return {
    id: `demo-${symbol}`,
    symbol,
    name,
    isin: `ZM000000${symbol.slice(0, 4)}`,
    sector,
    currency: 'ZMW',
    min_trade_qty: 1,
    lot_size: 1,
    settlement_days: 3,
    last_price: last,
    bid_price: +(last - 0.05).toFixed(2),
    ask_price: +(last + 0.05).toFixed(2),
    open_price: prev,
    high_price: high,
    low_price: low,
    prev_close: prev,
    change_amount: change,
    change_percent: pct,
    volume: vol,
    is_active: true,
    price_updated_at: now(),
  };
};

export const DEMO_STOCKS: DemoStock[] = [
  make('ZSUG', 'Zambia Sugar Plc', 'Agriculture', 4.85, 4.70, 142500),
  make('ZNCO', 'Zambia National Commercial Bank', 'Banking', 2.18, 2.22, 980200),
  make('STAN', 'Standard Chartered Bank Zambia', 'Banking', 3.95, 3.88, 312400),
  make('CECZ', 'Copperbelt Energy Corporation', 'Energy', 1.42, 1.42, 220100),
  make('REIZ', 'Real Estate Investments Zambia', 'Real Estate', 6.10, 5.92, 58300),
  make('LAFA', 'Lafarge Zambia Plc', 'Manufacturing', 1.85, 1.91, 76900),
  make('PUMA', 'Puma Energy Zambia', 'Energy', 2.65, 2.58, 184000),
  make('SHOP', 'Shoprite Holdings Zambia', 'Retail', 67.50, 66.20, 9400),
  make('AECI', 'AECI Mining Chemicals', 'Mining', 12.40, 12.85, 41200),
  make('PRIB', 'Prima Reinsurance Plc', 'Banking', 0.95, 0.92, 532100),
  make('ZMBF', 'Zambeef Products Plc', 'Agriculture', 5.30, 5.15, 128700),
  make('AIRT', 'Airtel Networks Zambia', 'Telecommunications', 8.40, 8.20, 412800),
];
