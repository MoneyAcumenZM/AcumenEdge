import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { useStocks } from "@/hooks/useSupabaseQuery";
import { useAllMarketData } from "@/hooks/useMarketData";
import { useAuth } from "@/contexts/AuthContext";
import { Star, Eye, ArrowLeftRight } from "lucide-react";
import StockLogo from "@/components/StockLogo";
import OrderTicket, { type OrderTicketStock } from "@/components/OrderTicket";
import { formatPrice, formatChangePct, changeColor, relativeTime } from "@/lib/display/formatters";
import { Skeleton } from "@/components/ui/skeleton";

const Watchlist = () => {
  const { watchlist, toggleWatchlist } = useWatchlist();
  const { profile } = useAuth();
  const { data: allStocks = [], isLoading } = useStocks();
  const { data: liveData } = useAllMarketData();
  const [ticketStock, setTicketStock] = useState<OrderTicketStock | null>(null);

  const openTicket = (s: any) => {
    if (!profile) { toast.error("Sign in to trade"); return; }
    if (profile.account_status === "suspended" || profile.account_status === "banned") { toast.error("Your account is currently restricted. Contact support."); return; }
    if (profile.kyc_status !== "approved") { toast.warning("Your identity verification is pending."); return; }
    if (!profile.csd_registered) { toast.warning("Complete your account setup to trade"); return; }
    setTicketStock({ symbol: s.symbol, name: s.name, last_price: s.last_price, currency: s.currency });
  };

  // Merge live middleware snapshot fields onto the Supabase stock record.
  // FIX G: Live priority = trade.price → bid.price → null; if null, fall back to Supabase last_price.
  // isLive flag drives the live-indicator dot — only true when middleware returned a real number.
  const mergeLive = (stock: any) => {
    const snap = liveData?.[stock.symbol];
    const livePrice = snap?.live_price ?? null;
    const displayPrice = livePrice ?? stock.last_price ?? null;
    const isLive = livePrice !== null;
    const prev = snap?.prev_close ?? stock.prev_close ?? stock.previous_close;
    const change_percent =
      prev != null && displayPrice != null && Number(prev) !== 0
        ? ((Number(displayPrice) - Number(prev)) / Number(prev)) * 100
        : stock.change_percent;
    return {
      ...stock,
      last_price: displayPrice,
      bid_price: snap?.bid_price ?? stock.bid_price,
      ask_price: snap?.ask_price ?? stock.ask_price,
      prev_close: prev ?? stock.prev_close,
      change_percent,
      is_live: isLive,
    };
  };

  // Get full stock info for watched items
  const watchedStocks = watchlist
    .map((w: any) => {
      const baseStock = w.stocks || (allStocks as any[]).find((s: any) => s.id === w.stock_id);
      if (!baseStock) return null;
      return { ...w, stock: mergeLive(baseStock) };
    })
    .filter(Boolean);

  return (
    <div className="space-y-5 mobile-contain">
      <div className="flex items-center gap-2">
        <Eye className="w-6 h-6 text-white" strokeWidth={1.5} />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
          <p className="text-muted-foreground text-sm">Watch market performance</p>
        </div>
      </div>

      {isLoading ? (
        <div className="hairline-y">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-1 py-3.5">
              <div className="flex items-center gap-3">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
                <div className="space-y-1.5 text-right">
                  <Skeleton className="h-3 w-16 ml-auto" />
                  <Skeleton className="h-2.5 w-12 ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : watchedStocks.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <Star className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="font-semibold text-foreground text-lg">No items in watchlist</p>
          <p className="text-sm text-muted-foreground mt-1">Tap the star icon on any stock in the Market to add it here</p>
        </div>
      ) : (
        <div className="hairline-y">
          {watchedStocks.map((item: any) => {
            const stock = item.stock;
            const change = stock.change_percent;

            return (
              <div key={item.id} className="px-1 py-3.5 relative">
                <Link to={`/stock/${stock.symbol}`} className="block">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(stock.id); }}
                      className="shrink-0 z-10 p-3 -m-3"
                    >
                      <Star className="w-4 h-4 fill-white text-white" />
                    </button>
                    <StockLogo ticker={stock.symbol} size="sm" lazy />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground">{stock.symbol}</p>
                      <p className="text-xs truncate mt-0.5 text-muted-foreground">{stock.name}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-bold text-foreground">{formatPrice(stock.last_price, stock.currency)}</p>
                      <p className={`text-xs font-medium ${changeColor(change)}`}>
                        {formatChangePct(change)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openTicket(stock); }}
                      className="ml-2 p-2 ring-btn shrink-0"
                      title="Trade"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}


      <OrderTicket stock={ticketStock} open={!!ticketStock} onClose={() => setTicketStock(null)} />
    </div>
  );
};

export default Watchlist;
