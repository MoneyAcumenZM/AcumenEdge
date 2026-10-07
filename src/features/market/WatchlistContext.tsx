import React, { createContext, useContext, useCallback } from 'react';
import { db } from '@/integrations/data/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWatchlistQuery, queryKeys } from '@/hooks/useDataQuery';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type WatchlistQueryRow = NonNullable<ReturnType<typeof useWatchlistQuery>['data']>[number];
// An optimistic row has no joined stock until the server's row replaces it.
type WatchlistRow = Omit<WatchlistQueryRow, 'stocks'> & { stocks: WatchlistQueryRow['stocks'] | null };

interface WatchlistContextValue {
  watchlist: WatchlistRow[];
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

  const watchedStockIds = watchlist.map((w) => w.stock_id);

  // Both branches update the cache optimistically and roll it back, with a
  // message, if the write fails.
  const toggleWatchlist = useCallback(async (stockId: string) => {
    if (!user) return;
    const existing = watchlist.find((w) => w.stock_id === stockId);
    if (existing) {
      queryClient.setQueryData(queryKeys.watchlist(user.id), (old: WatchlistRow[] | undefined) =>
        (old || []).filter((w) => w.stock_id !== stockId)
      );
      const { error } = await db.from('watchlist').delete().eq('user_id', user.id).eq('stock_id', stockId);
      if (error) {
        queryClient.setQueryData(queryKeys.watchlist(user.id), (old: WatchlistRow[] | undefined) => [existing, ...(old || [])]);
        toast.error("Couldn't remove from watchlist. Please try again.");
      }
    } else {
      const optimistic: WatchlistRow = { id: `temp-${Date.now()}`, stock_id: stockId, created_at: new Date().toISOString(), stocks: null };
      queryClient.setQueryData(queryKeys.watchlist(user.id), (old: WatchlistRow[] | undefined) => [optimistic, ...(old || [])]);
      const { error } = await db.from('watchlist').insert({ user_id: user.id, stock_id: stockId });
      if (error) {
        queryClient.setQueryData(queryKeys.watchlist(user.id), (old: WatchlistRow[] | undefined) => (old || []).filter((w) => w.id !== optimistic.id));
        toast.error("Couldn't add to watchlist. Please try again.");
        return;
      }
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
