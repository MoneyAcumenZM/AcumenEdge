import { useState } from "react";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { Search, Star, ArrowLeftRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import ATSMarketBanner from "@/components/ATSMarketBanner";
import StockLogo from "@/components/StockLogo";
import OrderTicket, { type OrderTicketStock } from "@/components/OrderTicket";
import { formatPrice, formatChangePct, changeColor, relativeTime } from "@/lib/display/formatters";
import { useDebounce, useStocks } from "@/hooks/useSupabaseQuery";
import { useAllMarketData } from "@/hooks/useMarketData";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const Market = () => {
  const { toggleWatchlist, isWatched } = useWatchlist();
  const { profile } = useAuth();
  const { data: meta = [], isLoading: metaLoading } = useStocks();
  const { data: live = {}, isLoading: liveLoading, dataUpdatedAt } = useAllMarketData();
  const isLoading = liveLoading && metaLoading;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [ticketStock, setTicketStock] = useState<OrderTicketStock | null>(null);

  const openTicket = (s: any) => {
    if (!profile) { toast.error("Sign in to trade"); return; }
    if (profile.account_status === "suspended" || profile.account_status === "banned") {
      toast.error("Your account is currently restricted. Contact support.");
      return;
    }
    if (profile.kyc_status !== "approved") {
      toast.warning("Your identity verification is pending.");
      return;
    }
    if (!profile.csd_registered) {
      toast.warning("Complete your account setup to trade");
      return;
    }
    setTicketStock({ symbol: s.symbol, name: s.name, last_price: s.last_price, currency: s.currency });
  };

  // Merge: Supabase metadata (name/sector/currency) + MW live (price/bid/ask/vol/change).
  const merged = (meta as any[]).map((m: any) => {
    const l = (live as Record<string, any>)[m.symbol] || {};
    const liveOk = l.last_price != null || l.live_price != null;
    return {
      id: m.id ?? m.symbol,
      symbol: m.symbol,
      name: m.name,
      sector: m.sector,
      currency: m.currency,
      last_price: l.live_price ?? l.last_price ?? m.last_price,
      bid_price: l.bid_price ?? m.bid_price,
      ask_price: l.ask_price ?? m.ask_price,
      open_price: l.open_price ?? m.open_price,
      high_price: l.high_price ?? m.high_price,
      low_price: l.low_price ?? m.low_price,
      volume: l.volume ?? m.volume,
      change_percent: l.change_percent ?? l.changePercent ?? m.change_percent,
      change_amount: l.change ?? l.change_amount ?? m.change_amount,
      price_updated_at: l.timestamp ?? m.price_updated_at,
      is_live: liveOk && l.is_live !== false,
    };
  });

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
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Search stocks..." />
        </div>
      </div>

      {dataUpdatedAt > 0 && (
        <p className="text-[9px] text-muted-foreground text-right">Updated {relativeTime(new Date(dataUpdatedAt).toISOString())}</p>
      )}

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
          {filtered.map((stock: any) => {
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
