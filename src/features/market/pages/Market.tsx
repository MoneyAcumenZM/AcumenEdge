import { useState } from "react";
import { useWatchlist } from "@/features/market/WatchlistContext";
import { Search, Star, ArrowLeftRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import ATSMarketBanner from "@/features/market/components/ATSMarketBanner";
import StockLogo from "@/features/market/components/StockLogo";
import OrderTicket, { type OrderTicketStock } from "@/features/trading/components/OrderTicket";
import { formatPrice, formatChangePct, changeColor, relativeTime } from "@/lib/display/formatters";
import { useDebounce } from "@/hooks/useDataQuery";
import { useLiveStocks } from "@/features/market/hooks/useMarketData";
import { useAccountRestrictions } from "@/features/auth/hooks/useAccountRestrictions";
import { Skeleton } from "@/components/ui/skeleton";

const Market = () => {
  const { toggleWatchlist, isWatched } = useWatchlist();
  const { tradeBlockedReason } = useAccountRestrictions();
  const { data: merged, isLoading, dataUpdatedAt } = useLiveStocks();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [ticketStock, setTicketStock] = useState<OrderTicketStock | null>(null);

  const openTicket = (s: OrderTicketStock) => {
    if (tradeBlockedReason) { toast.warning(tradeBlockedReason); return; }
    setTicketStock({ symbol: s.symbol, name: s.name, last_price: s.last_price, currency: s.currency });
  };

  const filtered = merged.filter((s) =>
    s.symbol.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (s.name || '').toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  return (
    <div className="space-y-4 mobile-contain">
      <ATSMarketBanner />

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary" placeholder="Search stocks..." />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link to="/securities" className="text-[10px] font-medium text-primary">All securities</Link>
        {dataUpdatedAt > 0 && (
          <p className="text-[9px] text-muted-foreground">Updated {relativeTime(new Date(dataUpdatedAt).toISOString())}</p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl px-3 py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
                <div className="space-y-1.5 text-right">
                  <Skeleton className="h-3 w-16 ml-auto" />
                  <Skeleton className="h-2.5 w-12 ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="hairline-y">
          {filtered.map((stock) => {
            const watched = isWatched(stock.id);

            return (
              <div key={stock.id} className="px-1 py-3.5 relative">
                <Link to={`/stock/${stock.symbol}`} className="block">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist(stock.id); }}
                      className="shrink-0 z-10 p-3 -m-3"
                    >
                      <Star className={`w-4 h-4 transition-colors ${watched ? 'fill-white text-white' : 'text-muted-foreground hover:text-white'}`} />
                    </button>
                    <StockLogo ticker={stock.symbol} size="sm" lazy />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground text-sm">{stock.symbol}</p>
                      <p className="text-[10px] truncate text-muted-foreground">{stock.name}</p>
                    </div>
                    <div className="text-right shrink-0 ml-1">
                      <p className="font-bold text-foreground text-sm">{formatPrice(stock.last_price, stock.currency)}</p>
                      <p className={`text-[10px] font-medium ${changeColor(stock.change_percent)}`}>
                        {formatChangePct(stock.change_percent)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openTicket(stock); }}
                      className="ml-2 shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 ring-btn text-[10px] font-bold"
                      title="Trade"
                    >
                      <ArrowLeftRight className="w-3 h-3" /> Trade
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-[9px]">
                    <span className="text-success">Bid: {formatPrice(stock.bid_price, stock.currency)}</span>
                    <span className="text-destructive">Ask: {formatPrice(stock.ask_price, stock.currency)}</span>
                  </div>
                </Link>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm">No stocks found matching "{debouncedSearch}"</p>
            </div>
          )}
        </div>
      )}


      <OrderTicket stock={ticketStock} open={!!ticketStock} onClose={() => setTicketStock(null)} />
    </div>
  );
};

export default Market;
