import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useWatchlist } from "@/features/market/WatchlistContext";
import { useLiveStocks } from "@/features/market/hooks/useMarketData";
import { useAccountRestrictions } from "@/features/auth/hooks/useAccountRestrictions";
import { Star, Eye, ArrowLeftRight } from "lucide-react";
import StockLogo from "@/features/market/components/StockLogo";
import OrderTicket, { type OrderTicketStock } from "@/features/trading/components/OrderTicket";
import { formatPrice, formatChangePct, changeColor } from "@/lib/display/formatters";
import { Skeleton } from "@/components/ui/skeleton";

const Watchlist = () => {
  const { watchlist, toggleWatchlist } = useWatchlist();
  const { tradeBlockedReason } = useAccountRestrictions();
  const { data: allStocks, isLoading } = useLiveStocks();
  const [ticketStock, setTicketStock] = useState<OrderTicketStock | null>(null);

  const openTicket = (s: OrderTicketStock) => {
    if (tradeBlockedReason) { toast.warning(tradeBlockedReason); return; }
    setTicketStock({ symbol: s.symbol, name: s.name, last_price: s.last_price, currency: s.currency });
  };

  // Get full stock info for watched items
  const watchedStocks = watchlist
    .flatMap((w) => {
      // Always the live-merged row, so the price matches the Market screen.
      const stock = allStocks.find((s) => s.id === w.stock_id || s.symbol === w.stocks?.symbol);
      return stock ? [{ ...w, stock }] : [];
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
          {watchedStocks.map((item) => {
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
