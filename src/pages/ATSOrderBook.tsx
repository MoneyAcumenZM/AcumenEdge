import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStocks } from "@/hooks/useSupabaseQuery";
import { ChevronDown } from "lucide-react";
import ATSMarketBanner from "@/components/ATSMarketBanner";
import { formatZMW } from "@/lib/display/formatters";
import { middlewareClient, subscribeOrderBookUpdates } from "@/services/middlewareClient";

const ATSOrderBook = () => {
  const { data: securitiesRaw = [] } = useStocks();
  const securities = (securitiesRaw as any[]).map((s: any) => ({
    id: s.id,
    ticker: s.symbol,
    name: s.name,
  }));
  const [selectedId, setSelectedId] = useState(securities[0]?.id || "");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const queryClient = useQueryClient();

  const sec = securities.find(s => s.id === selectedId) || securities[0];
  const symbol = sec?.ticker || '';

  useEffect(() => {
    if (!selectedId && securities[0]?.id) setSelectedId(securities[0].id);
  }, [securities, selectedId]);

  // Live middleware order book — falls back to nothing on failure.
  const { data: liveBook } = useQuery({
    queryKey: ['orderbook', symbol],
    queryFn: async () => {
      const r = await middlewareClient.getOrderBook(symbol);
      return r?.data || r;
    },
    enabled: !!symbol,
    staleTime: 2_000,
    refetchInterval: 5_000,
  });

  // WebSocket: ORDER_BOOK_UPDATE → invalidate live book for this symbol.
  useEffect(() => {
    if (!symbol) return;
    const cleanup = subscribeOrderBookUpdates(symbol, (payload) => {
      queryClient.setQueryData(['orderbook', symbol], payload);
    });
    return cleanup;
  }, [symbol, queryClient]);

  // Prefer live middleware data when present. Each level: { price, size }.
  const bidLevels = useMemo(() => {
    const rows: Array<{ price: number; size: number }> = liveBook?.bids || [];
    return rows
      .map(r => ({ price: Number(r.price), volume: Number(r.size), orders: 1 }))
      .sort((a, b) => b.price - a.price)
      .slice(0, 10);
  }, [liveBook]);

  const askLevels = useMemo(() => {
    const rows: Array<{ price: number; size: number }> = liveBook?.asks || [];
    return rows
      .map(r => ({ price: Number(r.price), volume: Number(r.size), orders: 1 }))
      .sort((a, b) => a.price - b.price)
      .slice(0, 10);
  }, [liveBook]);

  // Cumulative volumes
  let bidCum = 0;
  const bidWithCum = bidLevels.map(b => { bidCum += b.volume; return { ...b, cumulative: bidCum }; });
  let askCum = 0;
  const askWithCum = askLevels.map(a => { askCum += a.volume; return { ...a, cumulative: askCum }; });
  const maxCum = Math.max(bidCum || 1, askCum || 1);
  const maxRows = Math.max(bidWithCum.length, askWithCum.length, 1);

  const bestBid = liveBook?.bestBid ?? bidLevels[0]?.price ?? null;
  const bestAsk = liveBook?.bestAsk ?? askLevels[0]?.price ?? null;
  const spread = liveBook?.spread ?? (bestBid != null && bestAsk != null ? bestAsk - bestBid : null);
  const lastTrade = liveBook?.lastTrade ?? null;
  const high = liveBook?.high ?? null;
  const low = liveBook?.low ?? null;
  const volume = liveBook?.volume ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Order Book</h1>
        <p className="text-muted-foreground text-sm">Live market depth</p>
      </div>
      <ATSMarketBanner />

      {/* Security selector */}
      <div className="relative">
        <button onClick={() => setDropdownOpen(!dropdownOpen)} className="w-full flex items-center justify-between bg-card rounded-xl px-4 py-3 text-sm">
          <span className="text-foreground font-medium">{sec?.ticker} — {sec?.name}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {securities.map(s => (
              <button key={s.id} onClick={() => { setSelectedId(s.id); setDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-secondary/80 text-sm">
                <span className="font-medium text-foreground">{s.ticker}</span>
                <span className="text-muted-foreground ml-2">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Price info */}
      {sec && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Last", value: lastTrade != null ? formatZMW(Number(lastTrade)) : '—' },
            { label: "Spread", value: spread != null ? formatZMW(Number(spread)) : '—' },
            { label: "High / Low", value: high != null && low != null ? `${formatZMW(Number(high))} / ${formatZMW(Number(low))}` : '—' },
            { label: "Volume", value: Number(volume).toLocaleString() },
          ].map(item => (
            <div key={item.label} className="bg-card rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
              <p className="text-sm font-bold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Order book - aggregated, anonymous */}
      <div className="bg-card rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_60px_80px_60px_1fr] text-[10px] text-muted-foreground uppercase tracking-wider px-4 py-2.5 border-b border-border">
          <div className="flex justify-between"><span>Cum Vol</span><span>Bid Vol</span></div>
          <div className="text-center">#</div>
          <div className="text-center">Price</div>
          <div className="text-center">#</div>
          <div className="flex justify-between"><span>Ask Vol</span><span>Cum Vol</span></div>
        </div>

        {bidWithCum.length === 0 && askWithCum.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No orders in book</div>
        ) : (
          <div className="relative">
            {Array.from({ length: Math.max(maxRows, 5) }).map((_, i) => {
              const bid = bidWithCum[i];
              const ask = askWithCum[i];
              const bidWidth = bid ? (bid.cumulative / maxCum) * 100 : 0;
              const askWidth = ask ? (ask.cumulative / maxCum) * 100 : 0;

              return (
                <div key={i} className="grid grid-cols-[1fr_60px_80px_60px_1fr] relative text-sm px-4 py-2 border-b border-border/50 last:border-0">
                  {bid && <div className="absolute left-0 top-0 bottom-0 bg-success/8" style={{ width: `calc(50% * ${bidWidth / 100})` }} />}
                  {ask && <div className="absolute right-0 top-0 bottom-0 bg-destructive/8" style={{ width: `calc(50% * ${askWidth / 100})` }} />}
                  <div className="flex justify-between relative z-10">
                    <span className="text-xs text-muted-foreground">{bid?.cumulative.toLocaleString() || ''}</span>
                    <span className="text-xs text-success font-medium">{bid?.volume.toLocaleString() || ''}</span>
                  </div>
                  <div className="text-center relative z-10">
                    <span className="text-[10px] text-muted-foreground">{bid?.orders || ''}</span>
                  </div>
                  <div className="text-center relative z-10">
                    <span className="text-xs font-bold text-foreground">
                      {bid?.price != null ? formatZMW(bid.price) : ask?.price != null ? formatZMW(ask.price) : ''}
                    </span>
                  </div>
                  <div className="text-center relative z-10">
                    <span className="text-[10px] text-muted-foreground">{ask?.orders || ''}</span>
                  </div>
                  <div className="flex justify-between relative z-10">
                    <span className="text-xs text-destructive font-medium">{ask?.volume.toLocaleString() || ''}</span>
                    <span className="text-xs text-muted-foreground">{ask?.cumulative.toLocaleString() || ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ATSOrderBook;
