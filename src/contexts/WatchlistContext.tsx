import React, { createContext, useContext, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlistQuery, queryKeys } from '@/hooks/useSupabaseQuery';
import { useQueryClient } from '@tanstack/react-query';

interface WatchlistContextValue {
  watchlist: any[];
  watchedStockIds: string[];
  toggleWatchlist: (stockId: string) => void;
  isWatched: (stockId: string) => boolean;
  isLoading: boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: watchlist = [], isLoading } = useWatchlistQuery();

  const watchedStockIds = watchlist.map((w: any) => w.stock_id);

  const toggleWatchlist = useCallback(async (stockId: string) => {
    if (!user) return;
    const existing = watchlist.find((w: any) => w.stock_id === stockId);
    if (existing) {
      // Optimistic remove
      queryClient.setQueryData(queryKeys.watchlist(user.id), (old: any[]) =>
        (old || []).filter((w: any) => w.stock_id !== stockId)
      );
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('stock_id', stockId);
    } else {
      // Optimistic add
      const optimistic = { id: `temp-${Date.now()}`, user_id: user.id, stock_id: stockId, created_at: new Date().toISOString(), stocks: null };
      queryClient.setQueryData(queryKeys.watchlist(user.id), (old: any[]) => [optimistic, ...(old || [])]);
      await supabase.from('watchlist').insert({ user_id: user.id, stock_id: stockId });
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist(user.id) });
    }
  }, [user, watchlist, queryClient]);

  const isWatched = useCallback((stockId: string) => watchedStockIds.includes(stockId), [watchedStockIds]);

  return (
    <WatchlistContext.Provider value={{ watchlist, watchedStockIds, toggleWatchlist, isWatched, isLoading }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider');
  return ctx;
}
