import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Wallet, Loader2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { PortfolioHolding, formatZMW } from "@/lib/tradingUtils";
import circleLogo from "@/assets/circle-logo-new.svg";
import cardPattern from "@/assets/card-pattern.svg";
import { useHoldings } from "@/hooks/useSupabaseQuery";
import PortfolioPerformanceChart from "@/components/PortfolioPerformanceChart";

const ATSPortfolio = () => {
  const { data: holdingsRaw = [], isLoading: loading } = useHoldings();
  const holdings = holdingsRaw as unknown as PortfolioHolding[];

  // Positions come from the middleware (see useHoldings → /api/orders/client/:userId/portfolio).
  // Real-time updates are driven by middleware ORDER_UPDATE messages handled in
  // ATSMyOrders / AuthContext, which invalidate this query when a fill arrives.
  // No Supabase realtime subscription on portfolio_holdings (that table is not real-time).

  const totalValue = useMemo(() => holdings.reduce((sum, h) => {
    const stockPrice = (h.stocks as any)?.last_price || 0;
    return sum + h.quantity * stockPrice;
  }, 0), [holdings]);

  const totalCost = useMemo(() => holdings.reduce((sum, h) => sum + (h.total_cost || 0), 0), [holdings]);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? totalGain / totalCost * 100 : 0;

  const hasPendingSettlement = holdings.some((h) => h.pending_qty > 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>);

  return (
    <div className="space-y-6">
      {/* Portfolio Value Card */}
      <div className="gradient-portfolio rounded-2xl p-5 sm:p-6 relative overflow-hidden card-glow border border-white/15">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-[105%] w-[70%]">
            <img src={cardPattern} alt="" className="w-full h-full object-contain"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.12 }} />
          </div>
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-[105%] w-[70%]">
            <img src={cardPattern} alt="" className="w-full h-full object-contain"
            style={{ filter: 'brightness(0) saturate(100%) invert(58%) sepia(89%) saturate(1200%) hue-rotate(360deg) brightness(103%) contrast(106%)', opacity: 0.08, mixBlendMode: 'screen' }} />
          </div>
        </div>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.1) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.04) 100%)' }} />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Portfolio Value</p>
            <img src={circleLogo} alt="Circle" width={48} height={40} loading="eager" fetchPriority="high" className="w-10 h-8 sm:w-12 sm:h-10 object-contain drop-shadow-lg" />
          </div>
          <div className="flex items-baseline gap-1.5 sm:gap-2 mb-2">
            <span className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">{formatZMW(totalValue)}</span>
            <span className="text-[10px] sm:text-xs text-primary">ZMW</span>
          </div>
          <span className={`${totalGain >= 0 ? 'badge-success' : 'badge-destructive'} text-[10px] sm:text-xs inline-flex items-center gap-1`}>
            {totalGain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {totalGain >= 0 ? '+' : ''}{formatZMW(totalGain)} ({totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Portfolio Performance Chart */}
      <PortfolioPerformanceChart />

      {/* Settling banner */}
      {hasPendingSettlement &&
      <div className="bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
          <p className="text-xs text-warning font-medium">Trades settling — shares will be credited to your CSD account</p>
        </div>
      }

      {/* Actions */}
      <div className="flex gap-3">
        <Link to="/trade" className="ring-btn flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium">
          <ArrowLeftRight className="w-4 h-4" /> Trade
        </Link>
      </div>

      {/* Holdings */}
      <div className="space-y-4">
        <h3 className="font-semibold text-white">Holdings</h3>

        {holdings.length === 0 ?
        <div className="py-14 text-center">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-white/70" />
            <p className="font-semibold text-warning">No Holdings Yet</p>
            <p className="text-sm mt-1 text-primary-foreground">Place your first trade to start building your portfolio</p>
            <Link to="/trade" className="ring-btn mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium">
              <ArrowLeftRight className="w-3 h-3" /> Start Trading
            </Link>
          </div> :

        <div className="hairline-y">
            {holdings.map((h) => {
            const stock = h.stocks as any;
            const stockPrice = stock?.last_price || 0;
            const value = h.quantity * stockPrice;
            const gain = value - (h.total_cost || 0);
            const gainPct = h.total_cost && h.total_cost > 0 ? gain / h.total_cost * 100 : 0;
            const isPositive = gain >= 0;

            return (
              <div key={h.id} className="py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground text-sm">{stock?.symbol || '—'}</p>
                      {h.csd_status === 'csd_deposited' && <span className="text-[10px] text-primary">CSD Deposited</span>}
                      {h.csd_status === 'pending_deposit' && <span className="text-[10px] text-warning flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Settling T+3</span>}
                      {h.csd_status === 'not_deposited' && <span className="text-[10px] text-muted-foreground">Not in CSD</span>}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold flex items-center gap-1 justify-end ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {isPositive ? '+' : ''}{gainPct.toFixed(2)}%
                      </p>
                      <p className={`text-xs font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {isPositive ? '+' : ''}{formatZMW(gain)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shares</span>
                      <span className="font-medium text-primary">{h.settled_qty.toLocaleString()}</span>
                    </div>
                    {h.pending_qty > 0 &&
                  <div className="flex justify-between">
                        <span className="text-muted-foreground">Pending</span>
                        <span className="font-medium text-warning">+{h.pending_qty.toLocaleString()} settling</span>
                      </div>
                  }
                  </div>

                  <div className="flex items-end justify-between pt-2 border-t border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Total Value</p>
                      <p className="text-lg font-bold text-primary">{formatZMW(value)}</p>
                    </div>
                  </div>
                </div>);
          })}
          </div>
        }
      </div>
    </div>);
};

export default ATSPortfolio;
