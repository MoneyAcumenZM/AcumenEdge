import { useState } from "react";
import { BookOpen, ChevronDown, Search } from "lucide-react";

const securities = [
  { code: "ZSUG", name: "Zambia Sugar Plc", lastTraded: 18.50, refPrice: 18.20, openPrice: 18.30, vwap: 18.42 },
  { code: "ZCCM", name: "ZCCM Investments Holdings", lastTraded: 42.00, refPrice: 41.50, openPrice: 41.80, vwap: 41.92 },
  { code: "ZANACO", name: "Zambia National Commercial Bank", lastTraded: 3.85, refPrice: 3.80, openPrice: 3.82, vwap: 3.83 },
];

type OrderLevel = { price: number; volume: number; cumulative: number };

const generateMockOrders = (basePrice: number, side: "bid" | "ask"): OrderLevel[] => {
  const levels: OrderLevel[] = [];
  let cum = 0;
  for (let i = 0; i < 8; i++) {
    const offset = (i + 1) * 0.05;
    const p = side === "bid" ? +(basePrice - offset).toFixed(2) : +(basePrice + offset).toFixed(2);
    const vol = Math.floor(Math.random() * 5000 + 500);
    cum += vol;
    levels.push({ price: p, volume: vol, cumulative: cum });
  }
  return levels;
};

const OrderBook = () => {
  const [selectedCode, setSelectedCode] = useState("ZSUG");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const sec = securities.find((s) => s.code === selectedCode)!;
  const bids = generateMockOrders(sec.lastTraded, "bid");
  const asks = generateMockOrders(sec.lastTraded, "ask");
  const maxCum = Math.max(bids[bids.length - 1]?.cumulative || 1, asks[asks.length - 1]?.cumulative || 1);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Order Book</h1>
        <p className="text-muted-foreground text-sm">Live bid/ask depth</p>
      </div>


      {/* Security selector */}
      <div className="relative">
        <button onClick={() => setDropdownOpen(!dropdownOpen)} className="w-full flex items-center justify-between bg-card rounded-xl px-4 py-3 text-sm">
          <span className="text-foreground font-medium">{selectedCode} — {sec.name}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-card border border-border rounded-xl shadow-lg">
            {securities.map((s) => (
              <button key={s.code} onClick={() => { setSelectedCode(s.code); setDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-secondary/80 text-sm">
                <span className="font-medium text-foreground">{s.code}</span>
                <span className="text-muted-foreground ml-2">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Price info bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Last Traded", value: `K${sec.lastTraded.toFixed(2)}` },
          { label: "Reference", value: `K${sec.refPrice.toFixed(2)}` },
          { label: "Opening", value: `K${sec.openPrice.toFixed(2)}` },
          { label: "VWAP", value: `K${sec.vwap.toFixed(2)}` },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-xl px-3 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
            <p className="text-sm font-bold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Order book table */}
      <div className="bg-card rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_1fr] text-xs text-muted-foreground uppercase tracking-wider px-4 py-2.5 border-b border-border">
          <div className="flex justify-between"><span>Cum Vol</span><span>Bid Vol</span></div>
          <div className="text-center">Price</div>
          <div className="flex justify-between"><span>Ask Vol</span><span>Cum Vol</span></div>
        </div>

        {/* Rows */}
        <div className="relative">
          {Array.from({ length: 8 }).map((_, i) => {
            const bid = bids[i];
            const ask = asks[i];
            const bidWidth = (bid.cumulative / maxCum) * 100;
            const askWidth = (ask.cumulative / maxCum) * 100;

            return (
              <div key={i} className="grid grid-cols-[1fr_80px_1fr] relative text-sm px-4 py-2 border-b border-border/50 last:border-0">
                {/* Bid background */}
                <div className="absolute left-0 top-0 bottom-0 bg-success/8" style={{ width: `calc(50% * ${bidWidth / 100})` }} />
                {/* Ask background */}
                <div className="absolute right-0 top-0 bottom-0 bg-destructive/8" style={{ width: `calc(50% * ${askWidth / 100})` }} />

                <div className="flex justify-between relative z-10">
                  <span className="text-xs text-muted-foreground">{bid.cumulative.toLocaleString()}</span>
                  <span className="text-xs text-success font-medium">{bid.volume.toLocaleString()}</span>
                </div>
                <div className="text-center relative z-10">
                  <span className="text-xs font-bold text-foreground">K{(i === 0 ? sec.lastTraded : (bid.price + ask.price) / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between relative z-10">
                  <span className="text-xs text-destructive font-medium">{ask.volume.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">{ask.cumulative.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrderBook;
