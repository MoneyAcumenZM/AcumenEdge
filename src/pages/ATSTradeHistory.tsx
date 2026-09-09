import { History, Loader2, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { middlewareClient } from "@/services/middlewareClient";
import { useAuth } from "@/contexts/AuthContext";
import { formatZMW } from "@/lib/tradingUtils";

function useTradesFromMiddleware(userId?: string) {
  return useQuery({
    queryKey: ["client-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const result = await middlewareClient.getClientHistory(userId!);
        return (result as any)?.data || result || [];
      } catch {
        return [];
      }
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

const ATSTradeHistory = () => {
  const { user } = useAuth();
  const { data: trades = [], isLoading } = useTradesFromMiddleware(user?.id);
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-6 h-6 text-white" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trade History</h1>
            <p className="text-muted-foreground text-sm">Your executed trades</p>
          </div>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["client-history", user?.id] })}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {(trades as any[]).length === 0 ? (
        <div className="bg-card rounded-xl p-10 text-center">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-foreground text-lg">No executed trades yet</p>
          <p className="text-sm text-muted-foreground mt-1">Trades will appear here once orders are matched</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(trades as any[]).map((trade: any, i: number) => {
            const value = (trade.quantity || 0) * (trade.price || trade.executionPrice || 0);
            const time = trade.timestamp || trade.transactTime;
            return (
              <div key={trade.id || trade.clOrdId || i} className="bg-card rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{trade.symbol || '—'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      trade.side === '1' || trade.side === 'buy' || trade.side === 'BUY'
                        ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {trade.side === '1' || trade.side === 'buy' || trade.side === 'BUY' ? 'BUY' : 'SELL'}
                    </span>
                  </div>
                  <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">Executed</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Qty</p>
                    <p className="font-medium text-foreground">{(trade.quantity || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Price</p>
                    <p className="font-medium text-foreground">{formatZMW(trade.price || trade.executionPrice || 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Value</p>
                    <p className="font-medium text-foreground">{formatZMW(value)}</p>
                  </div>
                  {time && (
                    <div>
                      <p className="text-muted-foreground">Time</p>
                      <p className="font-medium text-foreground text-[10px]">
                        {new Date(time).toLocaleTimeString('en-ZM', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ATSTradeHistory;
