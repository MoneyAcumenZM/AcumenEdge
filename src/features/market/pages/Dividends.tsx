import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Building2, Percent, Briefcase, DollarSign } from "lucide-react";
import { db } from "@/integrations/data/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHoldings } from "@/hooks/useDataQuery";
import { formatZMW } from "@/lib/display/formatters";

// Dividend and coupon income = the user's wallet transactions with type
// "dividend" or "coupon" over the last 12 months. The backend writes these
// when it credits a payment to the wallet; `description` names the
// security. Until any exist, every figure shows "—".
const INCOME_TYPES = ["dividend", "coupon"];

function useIncome() {
  const { user } = useAuth();
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  return useQuery({
    queryKey: ["income", user?.id],
    queryFn: async () => {
      const { data, error } = await db.from("transactions")
        .select("id, type, description, amount, created_at")
        .eq("user_id", user!.id)
        .in("type", INCOME_TYPES)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

const Dividends = () => {
  const { data: payments = [], isLoading, isError } = useIncome();
  const { data: holdings = [] } = useHoldings();

  const summary = useMemo(() => {
    const total = payments.reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);
    const bySource = new Map<string, { type: string; amount: number; count: number; last: string }>();
    for (const p of payments) {
      const key = p.description || p.type;
      const e = bySource.get(key) ?? { type: p.type, amount: 0, count: 0, last: p.created_at };
      e.amount += Math.abs(Number(p.amount) || 0);
      e.count += 1;
      if (p.created_at > e.last) e.last = p.created_at;
      bySource.set(key, e);
    }
    const sources = [...bySource.entries()].map(([name, e]) => ({ name, ...e })).sort((a, b) => b.amount - a.amount);
    const portfolioValue = holdings.reduce((sum, h) => sum + Number(h.current_value ?? 0), 0);
    return {
      total,
      sources,
      dividendSources: sources.filter((x) => x.type === "dividend").length,
      couponSources: sources.filter((x) => x.type === "coupon").length,
      yieldPct: portfolioValue > 0 ? (total / portfolioValue) * 100 : null,
    };
  }, [payments, holdings]);

  const has = payments.length > 0;
  const money = (v: number) => (has ? formatZMW(v) : "—");
  const pct = summary.yieldPct != null && has ? `${summary.yieldPct.toFixed(2)}%` : "—";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Percent className="w-6 h-6 text-white" />
          <h1 className="text-2xl font-bold text-foreground">Dividend & Coupon Payments</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">Track income from stocks, bonds & treasury bills</p>
      </div>

      {/* Total Annual Income */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-5 h-5 text-primary" />
          <span className="text-sm text-muted-foreground">Income, last 12 months</span>
        </div>
        <p className="text-3xl font-bold text-primary mb-4">{money(summary.total)}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-secondary rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Monthly (avg)</p>
            <p className="font-bold text-foreground">{money(summary.total / 12)}</p>
          </div>
          <div className="bg-secondary rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Quarterly (avg)</p>
            <p className="font-bold text-foreground">{money(summary.total / 4)}</p>
          </div>
          <div className="bg-secondary rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Portfolio Yield</p>
            <p className="font-bold text-primary">{pct}</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Dividends</span>
          </div>
          <p className="font-bold text-foreground">{has ? summary.dividendSources : "—"}</p>
          <p className="text-xs text-muted-foreground">stocks</p>
        </div>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Coupons</span>
          </div>
          <p className="font-bold text-foreground">{has ? summary.couponSources : "—"}</p>
          <p className="text-xs text-muted-foreground">securities</p>
        </div>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Percent className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Avg Yield</span>
          </div>
          <p className="font-bold text-foreground">{pct}</p>
        </div>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Briefcase className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Assets</span>
          </div>
          <p className="font-bold text-foreground">{has ? summary.sources.length : "—"}</p>
          <p className="text-xs text-muted-foreground">income-paying</p>
        </div>
      </div>

      {/* Income Sources */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Income Sources</h3>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading payments…</p>
        ) : !has ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">{isError ? "Payments couldn't be loaded" : "No payments yet"}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {isError ? "Please try again shortly." : "Dividends and coupons paid to your wallet will appear here."}
            </p>
          </div>
        ) : (
          <div className="hairline-y">
            {summary.sources.map((src) => (
              <div key={src.name} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{src.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {src.type === "coupon" ? "Coupon" : "Dividend"} · {src.count} {src.count === 1 ? "payment" : "payments"} · last {new Date(src.last).toLocaleDateString("en-ZM", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className="text-sm font-bold text-success shrink-0">{formatZMW(src.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dividends;
