import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHoldings } from "@/hooks/useSupabaseQuery";
import { TrendingUp, TrendingDown, BarChart2, Briefcase } from "lucide-react";

function useMarketIndex() {
  return useQuery({
    queryKey: ["marketIndex"],
    queryFn: async () => {
      const { data } = await supabase
        .from("market_index")
        .select("value, change_amount, change_percent, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

function relTime(d: string | null) {
  if (!d) return "";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const MarketPerformancePanel = () => {
  const { data: idx } = useMarketIndex();
  const { data: holdings = [] } = useHoldings();

  const portfolio = useMemo(() => {
    const totalValue = (holdings as any[]).reduce((s: number, h: any) => s + (h.current_value || 0), 0);
    const totalCost = (holdings as any[]).reduce((s: number, h: any) => s + (h.total_cost || 0), 0);
    const gainLoss = totalValue - totalCost;
    const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
    return { totalValue, gainLoss, gainLossPct, hasHoldings: (holdings as any[]).length > 0 };
  }, [holdings]);

  const lasiPct = idx?.change_percent ?? 0;
  const portPct = portfolio.gainLossPct;
  const diff = portPct - lasiPct;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {/* LASI Card */}
        <div className="bg-card rounded-xl p-3 border border-border/50">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart2 className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-semibold text-foreground">LASI</span>
          </div>
          <p className="text-[8px] text-muted-foreground mb-1">All Share Index</p>
          <p className="text-lg font-bold text-foreground leading-tight">
            {idx?.value != null ? Number(idx.value).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {lasiPct >= 0 ? <TrendingUp className="w-3 h-3 text-success" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
            <span className={`text-[10px] font-semibold ${lasiPct >= 0 ? "text-success" : "text-destructive"}`}>
              {lasiPct >= 0 ? "+" : ""}{Number(idx?.change_amount ?? 0).toFixed(2)} ({lasiPct >= 0 ? "+" : ""}{lasiPct.toFixed(2)}%)
            </span>
          </div>
          <p className="text-[7px] text-muted-foreground mt-1">Lusaka Securities Exchange</p>
          {idx?.recorded_at && <p className="text-[7px] text-muted-foreground">As of {relTime(idx.recorded_at)}</p>}
        </div>

        {/* Portfolio Card */}
        <div className="bg-card rounded-xl p-3 border border-border/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Briefcase className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-semibold text-foreground">Portfolio</span>
          </div>
          <p className="text-[8px] text-muted-foreground mb-1">My Performance</p>
          <p className="text-lg font-bold text-foreground leading-tight">
            ZMW {portfolio.totalValue.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {portfolio.hasHoldings ? (
            <div className="flex items-center gap-1 mt-0.5">
              {portPct >= 0 ? <TrendingUp className="w-3 h-3 text-success" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
              <span className={`text-[10px] font-semibold ${portPct >= 0 ? "text-success" : "text-destructive"}`}>
                {portPct >= 0 ? "+" : ""}ZMW {portfolio.gainLoss.toFixed(2)} ({portPct >= 0 ? "+" : ""}{portPct.toFixed(2)}%)
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-0.5">No positions yet</p>
          )}
        </div>
      </div>

      {/* Comparison bar */}
      <div className="bg-card rounded-lg px-3 py-2 border border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[9px]">
          <span className="text-muted-foreground">LASI</span>
          <span className={lasiPct >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
            {lasiPct >= 0 ? "+" : ""}{lasiPct.toFixed(2)}%
          </span>
          <span className="text-muted-foreground">vs</span>
          <span className="text-muted-foreground">Portfolio</span>
          <span className={portPct >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
            {portPct >= 0 ? "+" : ""}{portPct.toFixed(2)}%
          </span>
        </div>
        <span className={`text-[9px] font-semibold ${diff >= 0 ? "text-success" : "text-warning"}`}>
          {diff >= 0 ? `Beating market by ${diff.toFixed(2)}%` : `Market ahead by ${Math.abs(diff).toFixed(2)}%`}
        </span>
      </div>
    </div>
  );
};

export default MarketPerformancePanel;
