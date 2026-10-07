import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { db } from '@/integrations/data/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { middlewareClient, isTradingApiConfigured } from '@/services/middlewareClient';
import { getWallet } from '@/services/dpoService';
import { asRecord, asRecords, asString } from '@/lib/apiShape';
import type { PortfolioHolding, Stock } from '@/lib/tradingUtils';
import type { Tables } from '@/integrations/data/schema';

/** A position as the portfolio views render it (mapped from the trading API). */
export type HoldingView = Omit<PortfolioHolding, 'user_id' | 'stocks'> & {
  stocks: Pick<Stock, 'symbol' | 'name' | 'last_price'>;
};

/**
 * A row of the stocks list. `prev_close` is not a column of `stocks` — it
 * is only ever present on rows enriched from a live snapshot.
 */
export type StockListItem = Omit<Tables<'stocks'>, 'created_at'> & { prev_close?: number | null };

export interface MarketStatusView {
  session_phase: string;
  trading_allowed: boolean;
  updated_at: string;
  description?: string;
  halted_symbols: string[];
}

const CSD_STATUSES: ReadonlyArray<PortfolioHolding['csd_status']> = ['csd_deposited', 'pending_deposit', 'not_deposited'];

// ─── Shared query keys ───
export const queryKeys = {
  holdings: (userId: string) => ['holdings', userId] as const,
  orders: (userId: string) => ['orders', userId] as const,
  recentOrders: (userId: string) => ['recentOrders', userId] as const,
  transactions: (userId: string, page: number) => ['transactions', userId, page] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  stocks: ['stocks'] as const,
  marketStatus: ['marketStatus'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  portfolioSnapshots: (userId: string, days: number) => ['portfolioSnapshots', userId, days] as const,
  notificationPreferences: (userId: string) => ['notificationPreferences', userId] as const,
  watchlist: (userId: string) => ['watchlist', userId] as const,
  priceAlerts: (userId: string) => ['priceAlerts', userId] as const,
  wallet: (userId: string) => ['wallet', userId] as const,
};

// ─── Holdings (from middleware — single source of truth) ───
// The Supabase portfolio_holdings table is not updated in real time after fills.
// Positions must always be fetched from /api/orders/client/{userId}/portfolio.
export function useHoldings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.holdings(user?.id || ''),
    queryFn: async (): Promise<HoldingView[]> => {
      const res = await middlewareClient.getClientPortfolio(user!.id);
      const positions = asRecords(res?.positions);
      // Map to the existing UI shape so views need minimal changes.
      return positions.map((p) => {
        const symbol = asString(p.symbol);
        const csdStatus = p.csdStatus ?? p.csd_status;
        return {
        id: symbol,
        stock_id: symbol,
        quantity: Number(p.quantity || 0),
        settled_qty: Number(p.quantity || 0),
        pending_qty: Number(p.pendingQty ?? p.pending_qty ?? 0),
        average_cost: Number(p.avgPrice || 0),
        total_cost: Number(p.cost || 0),
        current_value: Number(p.marketValue || 0),
        gain_loss: Number(p.pnl || 0),
        gain_loss_pct: Number(p.pnlPct || 0),
        csd_status: CSD_STATUSES.find((s) => s === csdStatus) ?? 'csd_deposited',
        stocks: { symbol, name: symbol, last_price: Number(p.currentPrice || 0) },
        };
      });
    },
    // Not run at all without a trading API: there is nothing to ask, and a
    // query that only ever fails would keep re-entering its loading state.
    enabled: !!user && isTradingApiConfigured,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

// ─── Wallet (middleware authoritative) ───
export function useWallet() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.wallet(user?.id || ''),
    queryFn: () => getWallet(),
    enabled: !!user && isTradingApiConfigured,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

// ─── Orders (paginated) ───
export function useOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.orders(user?.id || ''),
    queryFn: async () => {
      // Throwing on error lets TanStack Query's isError state distinguish
      // "failed to load" from "you have no orders".
      const { data, error } = await db.from('orders')
        .select('id, stock_id, side, order_type, qualifier, quantity, limit_price, expiry_date, status, rejection_reason, client_order_id, settlement_date, filled_quantity, filled_price, fill_value, consideration, luse_fee, broker_fee, levy, total_fees, net_value, created_at, updated_at, stocks(id, symbol, name, isin)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .range(0, 99);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ─── Recent Orders (limit 3) ───
export function useRecentOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.recentOrders(user?.id || ''),
    queryFn: async () => {
      const { data, error } = await db.from('orders')
        .select('id, stock_id, side, order_type, qualifier, quantity, limit_price, status, created_at, stocks(symbol, name)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

// ─── Paginated Transactions ───
export function useTransactions(page: number, enabled: boolean) {
  const { user } = useAuth();
  const PAGE_SIZE = 20;
  return useQuery({
    queryKey: queryKeys.transactions(user?.id || '', page),
    queryFn: async () => {
      const { data, count, error } = await db.from('transactions')
        .select('id, type, description, amount, balance_after, reference, created_at', { count: 'exact' })
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { data: data || [], total: count || 0, pageSize: PAGE_SIZE };
    },
    enabled: !!user && enabled,
  });
}

// ─── Notifications (with cooldown via queryFn) ───
export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.notifications(user?.id || ''),
    queryFn: async () => {
      const { data, error } = await db.from('notifications')
        .select('id, title, body, type, is_read, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .range(0, 49);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

// ─── In-memory stocks cache with timestamp ───
let _stocksCache: StockListItem[] | null = null;
let _stocksCacheTime = 0;
const STOCKS_CACHE_TTL = 60_000; // 1 minute — lets live price refresh timely

// ─── Stocks list (home screen uses limit 5, market page uses full) ───
// Only real rows are ever shown. There is no substitute data of any kind:
// a failed or timed-out fetch returns the last real result if there is one,
// otherwise an empty list.
export function useStocks(limit: number = 500) {
  return useQuery({
    queryKey: [...queryKeys.stocks, limit],
    queryFn: async (): Promise<StockListItem[]> => {
      // If cache is fresh enough, skip fetch entirely
      if (_stocksCache && Date.now() - _stocksCacheTime < STOCKS_CACHE_TTL && limit <= (_stocksCache.length || 0)) {
        return _stocksCache.slice(0, limit);
      }
      try {
        const { data, error } = await Promise.race([
          db.from('stocks')
            .select('id, symbol, name, isin, sector, currency, min_trade_qty, lot_size, settlement_days, last_price, bid_price, ask_price, open_price, high_price, low_price, change_amount, change_percent, volume, is_active, price_updated_at')
            .eq('is_active', true)
            .order('symbol')
            .limit(limit),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]);
        if (error) throw error;
        const result: StockListItem[] = data ?? [];
        if (limit >= 50 && result.length > 0) {
          _stocksCache = result;
          _stocksCacheTime = Date.now();
        }
        return result;
      } catch {
        // On timeout/error, return the last real data if available, else empty.
        if (_stocksCache) return _stocksCache.slice(0, limit);
        return [];
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    placeholderData: () => _stocksCache?.slice(0, limit) ?? undefined,
  });
}

// ─── Market Status (from middleware /api/fix/sessions + /api/market/halts) ───
export function useMarketStatus() {
  return useQuery({
    queryKey: queryKeys.marketStatus,
    queryFn: async (): Promise<MarketStatusView> => {
      // Halts feed the per-symbol halt banner (ATSMarketBanner). Best-effort: a
      // halts failure shouldn't block the rest of market status from resolving.
      const haltedSymbols: string[] = await middlewareClient.halts()
        .then((r) => {
          const body = asRecord(r);
          const rows = asRecords(body.data ?? body.halts ?? r);
          return rows.map((h) => asString(h.symbol)).filter(Boolean);
        })
        .catch(() => []);

      try {
        const result = await middlewareClient.sessions();
        const sessions = asRecord(result).data ?? result;
        const current = asRecord(Array.isArray(sessions) ? sessions[0] : sessions);
        const desc = asString(current.description) || asString(current.session);

        let phase = 'closed';
        let tradingAllowed = false;
        const d = desc.toLowerCase().trim();

        // FIX numeric TradSesStatus codes
        if (d === '2') { phase = 'continuous'; tradingAllowed = true; }
        else if (d === '4') { phase = 'pre_open_auction'; tradingAllowed = false; }
        else if (d === '3' || d === '1') { phase = 'closed'; tradingAllowed = false; }
        // String descriptions
        else if (['fullmarket','continuous','open','trading','full_market','continuous_trading'].includes(d)) {
          phase = 'continuous'; tradingAllowed = true;
        } else if (['premarketauction','pre_open','pre_open_auction','openingauction',
                    'opening_auction','popen','preopen','premarket'].includes(d)) {
          phase = 'pre_open_auction'; tradingAllowed = false;
        } else if (['closingauction','closing_auction','postclose','postmarket'].includes(d)) {
          phase = 'closing'; tradingAllowed = false;
        } else {
          phase = 'closed'; tradingAllowed = false;
        }

        // Note: a non-empty halted_symbols list does NOT imply the whole
        // exchange session is halted — a single-stock halt shouldn't block
        // trading market-wide. session_phase stays driven by the session
        // endpoint alone; halted_symbols is surfaced separately for
        // per-symbol banner messaging (see ATSMarketBanner).
        return { session_phase: phase, trading_allowed: tradingAllowed, updated_at: new Date().toISOString(), description: desc, halted_symbols: haltedSymbols };
      } catch {
        return { session_phase: 'closed', trading_allowed: false, updated_at: new Date().toISOString(), halted_symbols: haltedSymbols };
      }
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

// ─── Portfolio Snapshots ───
export function usePortfolioSnapshots(days: number) {
  const { user } = useAuth();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];

  return useQuery({
    queryKey: queryKeys.portfolioSnapshots(user?.id || '', days),
    queryFn: async () => {
      const { data, error } = await db.from('portfolio_snapshots')
        .select('snapshot_date, total_value')
        .eq('user_id', user!.id)
        .gte('snapshot_date', sinceStr)
        .order('snapshot_date', { ascending: true })
        // One snapshot per day: the whole selected period, up to the longest
        // range offered (90 days). A smaller limit would cut off the most
        // recent days, because the rows are sorted oldest first.
        .limit(days + 1);
      if (error) throw error;
      return data || [];
    },
    // Keep the current chart on screen while another range loads.
    placeholderData: keepPreviousData,
    enabled: !!user,
  });
}

// ─── Notification Preferences ───
export function useNotificationPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.notificationPreferences(user?.id || ''),
    queryFn: async () => {
      // maybeSingle: a user who has never saved preferences has no row,
      // which is a null result rather than an error.
      const { data, error } = await db.from('notification_preferences')
        .select('id, trade_executed, price_alerts, market_alerts, weekly_summary, deposit_withdrawal')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

// ─── Watchlist (paginated) ───
export function useWatchlistQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.watchlist(user?.id || ''),
    queryFn: async () => {
      const { data, error } = await db.from('watchlist')
        .select('id, stock_id, created_at, stocks(id, symbol, name, last_price, change_percent, change_amount, bid_price, ask_price, isin, sector, volume)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

// ─── Debounce hook ───
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
