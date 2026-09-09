import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { middlewareClient } from '@/services/middlewareClient';
import { getWallet } from '@/services/dpoService';

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
    queryFn: async () => {
      const res = await middlewareClient.getClientPortfolio(user!.id);
      const positions = res?.positions || [];
      // Map to the existing UI shape so views need minimal changes.
      return positions.map((p: any) => ({
        id: p.symbol,
        stock_id: p.symbol,
        quantity: Number(p.quantity || 0),
        settled_qty: Number(p.quantity || 0),
        pending_qty: Number(p.pendingQty ?? p.pending_qty ?? 0),
        average_cost: Number(p.avgPrice || 0),
        total_cost: Number(p.cost || 0),
        current_value: Number(p.marketValue || 0),
        gain_loss: Number(p.pnl || 0),
        gain_loss_pct: Number(p.pnlPct || 0),
        csd_status: (p.csdStatus ?? p.csd_status ?? 'csd_deposited') as any,
        stocks: { symbol: p.symbol, name: p.symbol, last_price: Number(p.currentPrice || 0) },
      }));
    },
    enabled: !!user,
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
    enabled: !!user,
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
      const { data } = await supabase.from('orders')
        .select('id, stock_id, side, order_type, qualifier, quantity, limit_price, expiry_date, status, rejection_reason, client_order_id, settlement_date, filled_quantity, filled_price, fill_value, consideration, luse_fee, broker_fee, levy, total_fees, net_value, created_at, updated_at, stocks(id, symbol, name, isin)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .range(0, 99);
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
      const { data } = await supabase.from('orders')
        .select('id, stock_id, side, order_type, qualifier, quantity, limit_price, status, created_at, stocks(symbol, name)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);
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
      const { data, count } = await supabase.from('transactions')
        .select('id, type, description, amount, balance_after, reference, created_at', { count: 'exact' })
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
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
      const { data } = await supabase.from('notifications')
        .select('id, title, body, type, is_read, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .range(0, 49);
      return data || [];
    },
    enabled: !!user,
  });
}

// ─── In-memory stocks cache with timestamp ───
let _stocksCache: any[] | null = null;
let _stocksCacheTime = 0;
const STOCKS_CACHE_TTL = 60_000; // 1 minute — lets live price refresh timely

// ─── Stocks list (home screen uses limit 5, market page uses full) ───
export function useStocks(limit: number = 50) {
  return useQuery({
    queryKey: [...queryKeys.stocks, limit],
    queryFn: async () => {
      // If cache is fresh enough, skip fetch entirely
      if (_stocksCache && Date.now() - _stocksCacheTime < STOCKS_CACHE_TTL && limit <= (_stocksCache.length || 0)) {
        return _stocksCache.slice(0, limit);
      }
      const { DEMO_STOCKS } = await import('@/lib/demo/stocksDemo');
      try {
        const { data } = await Promise.race([
          supabase.from('stocks')
            .select('id, symbol, name, isin, sector, currency, min_trade_qty, lot_size, settlement_days, last_price, bid_price, ask_price, open_price, high_price, low_price, prev_close, change_amount, change_percent, volume, is_active, price_updated_at')
            .eq('is_active', true)
            .order('symbol')
            .limit(limit),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]);
        const result = (data && data.length > 0) ? data : DEMO_STOCKS.slice(0, limit);
        if (limit >= 50) {
          _stocksCache = result;
          _stocksCacheTime = Date.now();
        }
        return result;
      } catch {
        // On timeout/error, return cached data if available, else demo seed
        if (_stocksCache) return _stocksCache.slice(0, limit);
        return DEMO_STOCKS.slice(0, limit);
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    placeholderData: () => _stocksCache?.slice(0, limit) ?? undefined,
  });
}

// ─── Market Status (from middleware /api/fix/sessions) ───
export function useMarketStatus() {
  return useQuery({
    queryKey: queryKeys.marketStatus,
    queryFn: async () => {
      try {
        const result = await middlewareClient.sessions();
        const sessions = result?.data || result || [];
        const current = Array.isArray(sessions) ? sessions[0] : sessions;
        const desc = current?.description || current?.session || '';

        let phase = 'closed';
        let tradingAllowed = false;
        const d = (desc || '').toLowerCase().trim();

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

        return { session_phase: phase, trading_allowed: tradingAllowed, updated_at: new Date().toISOString(), description: desc };
      } catch {
        return { session_phase: 'closed', trading_allowed: false, updated_at: new Date().toISOString() };
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
      const { data } = await supabase.from('portfolio_snapshots')
        .select('snapshot_date, total_value')
        .eq('user_id', user!.id)
        .gte('snapshot_date', sinceStr)
        .order('snapshot_date', { ascending: true })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });
}

// ─── Notification Preferences ───
export function useNotificationPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.notificationPreferences(user?.id || ''),
    queryFn: async () => {
      const { data } = await supabase.from('notification_preferences')
        .select('id, trade_executed, price_alerts, market_alerts, weekly_summary, deposit_withdrawal')
        .eq('user_id', user!.id)
        .single();
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
      const { data } = await supabase.from('watchlist')
        .select('id, stock_id, created_at, stocks(id, symbol, name, last_price, change_percent, change_amount, bid_price, ask_price, isin, sector, volume)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
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
