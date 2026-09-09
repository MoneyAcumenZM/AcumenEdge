import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const sectorData = [
  { name: "Banking", change: 0.11, marketCap: "K22.3B" },
  { name: "Mining", change: -3.45, marketCap: "K12.5B" },
  { name: "Agriculture", change: -0.31, marketCap: "K6.2B" },
  { name: "Manufacturing", change: -2.34, marketCap: "K2.8B" },
  { name: "Energy", change: 2.10, marketCap: "K7.3B" },
  { name: "Telecom", change: 2.50, marketCap: "K3.2B" },
  { name: "Insurance", change: 1.27, marketCap: "K1.2B" },
  { name: "Real Estate", change: 1.19, marketCap: "K420M" },
  { name: "Retail", change: 0.83, marketCap: "K15.0B" },
];

const timeFilters = ["Day", "Week", "Month", "Year"];

const SectorPerformance = () => {
  const [timeFilter, setTimeFilter] = useState("Day");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground text-base">Sector Performance</h3>
        <div className="flex gap-1.5">
          {timeFilters.map((t) => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-3 py-1.5 text-[10px] font-semibold ring-btn ${timeFilter === t ? "ring-btn-active" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[280px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sectorData} layout="vertical" margin={{ left: 0, right: 12 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(150, 18%, 45%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10, fill: "hsl(200, 20%, 93%)" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "hsl(140, 80%, 6%)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "hsl(200, 20%, 93%)" }}
              formatter={(value: number) => [`${value > 0 ? '+' : ''}${value.toFixed(2)}%`, 'Change']}
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
              <p className="text-[10px] text-muted-foreground">Market cap {s.marketCap}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-xl border border-white/10 bg-background/60 text-[11px] font-bold ${s.change >= 0 ? "text-success" : "text-destructive"}`}>
              {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SectorPerformance;
