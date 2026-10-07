import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useLiveStocks } from "@/features/market/hooks/useMarketData";

// Sector performance computed from the live stocks list (same prices as
// the Market screen): stocks grouped by `sector`, averaging today's
// change_percent. There's no time-window filter
// or market cap, because neither historical sector data nor shares
// outstanding is available client-side.
const SectorPerformance = () => {
  const { data: stocks, isLoading } = useLiveStocks();

  const sectorData = (() => {
    const bySector = new Map<string, { sum: number; count: number }>();
    for (const s of stocks) {
      const sector = s.sector || "Other";
      const change = Number(s.change_percent);
      if (!Number.isFinite(change)) continue;
      const entry = bySector.get(sector) || { sum: 0, count: 0 };
      entry.sum += change;
      entry.count += 1;
      bySector.set(sector, entry);
    }
    return Array.from(bySector.entries())
      .map(([name, { sum, count }]) => ({ name, change: sum / count, count }))
      .sort((a, b) => b.change - a.change);
  })();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground text-base">Sector Performance</h3>
        <span className="text-[10px] text-muted-foreground">Today</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading sector data…</p>
      ) : sectorData.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Sector data is currently unavailable.</p>
      ) : (
        <>
          <div className="h-[280px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(150, 18%, 45%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10, fill: "hsl(200, 20%, 93%)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(140, 80%, 6%)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "hsl(200, 20%, 93%)" }}
                  formatter={(value: number) => [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, 'Avg. change']}
                />
                <Bar dataKey="change" radius={[0, 4, 4, 0]} barSize={18}>
                  {sectorData.map((entry, i) => (
                    <Cell key={i} fill={entry.change >= 0 ? 'hsl(33, 95%, 50%)' : 'hsl(4, 80%, 50%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="hairline-y">
            {sectorData.map((s) => (
              <div key={s.name} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground">{s.count} {s.count === 1 ? 'security' : 'securities'}</p>
                </div>
                <span className={`px-3 py-1.5 rounded-xl border border-white/10 bg-background/60 text-[11px] font-bold ${s.change >= 0 ? "text-success" : "text-destructive"}`}>
                  {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default SectorPerformance;
