import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMiddleware } from "@/contexts/MiddlewareContext";
import { formatPrice, changeColor, formatChangePct } from "@/lib/display/formatters";
import PortfolioCard from "@/components/PortfolioCard";
import StockLogo from "@/components/StockLogo";
import {
  AlertTriangle, ArrowDownUp, Activity, CandlestickChart, Wallet,
  TrendingUp, TrendingDown, ListChecks, Bookmark, CircleUser,
  Landmark, PieChart, Radio, PartyPopper
} from "lucide-react";
import { useHoldings, useStocks } from "@/hooks/useSupabaseQuery";
import { middlewareClient } from "@/services/middlewareClient";

import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const quickActions = [
  { icon: ArrowDownUp, label: "Trade", path: "/trade" },
  { icon: Activity, label: "Market", path: "/market" },
  { icon: CandlestickChart, label: "Analysis", path: "/charts" },
  { icon: Wallet, label: "Portfolio", path: "/portfolio" },
  { icon: ListChecks, label: "Orders", path: "/my-orders" },
  { icon: Bookmark, label: "Watchlist", path: "/watchlist" },
  { icon: Landmark, label: "Bonds", path: "/bonds" },
  { icon: PieChart, label: "Sectors", path: "/sectors" },
  { icon: Radio, label: "News", path: "/market-news" },
  { icon: CircleUser, label: "Profile", path: "/profile" },
];

type GainLoss = "gainers" | "losers";

function useHomeNews() {
  return useQuery({
    queryKey: ["home-news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("market_news" as any)
        .select("id, title, summary, category, published_at")
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(3);
      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

const Index = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { status: mwStatus } = useMiddleware();
  const { data: holdings = [] } = useHoldings();
  const { data: recentOrdersData } = useQuery({
    queryKey: ['dashboard-open-orders', user?.id],
    queryFn: () => middlewareClient.getClientOpenOrders(user!.id),
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const recentOrders = (recentOrdersData?.orders || []).slice(0, 3);
  const { data: allStocks = [] } = useStocks(5);
  
  const [glTab, setGlTab] = useState<GainLoss>("gainers");
  const isMobile = useIsMobile();
  const [csdBannerDismissed, setCsdBannerDismissed] = useState(false);

  // Check for unread CSD notification
  const { data: csdNotification } = useQuery({
    queryKey: ['csd-notification', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('notifications')
        .select('id, body, title')
        .eq('user_id', user.id)
        .eq('type', 'csd')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const handleDismissCsdBanner = async () => {
    setCsdBannerDismissed(true);
    if (csdNotification?.id) {
      await supabase.from('notifications').update({ is_read: true } as any).eq('id', csdNotification.id);
    }
  };

  const showCsdBanner = !csdBannerDismissed && csdNotification && profile?.csd_registered;

  const fixedRef = useRef<HTMLDivElement>(null);
  const [fixedHeight, setFixedHeight] = useState(0);

  useEffect(() => {
    if (!isMobile) return;
    const measure = () => {
      if (fixedRef.current) setFixedHeight(fixedRef.current.getBoundingClientRect().height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (fixedRef.current) observer.observe(fixedRef.current);
    return () => observer.disconnect();
  }, [isMobile]);

  const totalPortfolioValue = useMemo(
    () => holdings.reduce((sum: number, h: any) => sum + h.quantity * ((h.stocks as any)?.last_price || 0), 0),
    [holdings]
  );

  const movers = useMemo(() => {
    const sorted = [...(allStocks as any[])].filter((s: any) => s.change_percent != null);
    if (glTab === "gainers") {
      return sorted.filter((s: any) => s.change_percent > 0).sort((a: any, b: any) => b.change_percent - a.change_percent).slice(0, 5);
    }
    return sorted.filter((s: any) => s.change_percent < 0).sort((a: any, b: any) => a.change_percent - b.change_percent).slice(0, 5);
  }, [allStocks, glTab]);

  const renderQuickIcons = () => (
    <div className="grid grid-cols-5 gap-y-5 gap-x-2">
      {quickActions.map(({ icon: Icon, label, path }) => (
        <Link key={label} to={path} className="flex flex-col items-center gap-2 group">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-105 group-active:scale-95 bg-background/60 border border-white/10"
          >
            <Icon className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[9px] text-muted-foreground font-medium leading-tight pb-0.5">{label}</span>
        </Link>
      ))}
    </div>
  );

  // Mobile: everything scrolls together (no sticky/fixed layers)
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen -mt-4 -mx-4">
        <div
          ref={fixedRef}
          className="px-4 pb-1"
          style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
        >
          {showCsdBanner && (
            <button
              onClick={() => { handleDismissCsdBanner(); navigate('/profile'); }}
              className="w-full bg-success/15 border border-success/30 rounded-xl px-4 py-2 flex items-center gap-2 mb-2 text-left"
            >
              <PartyPopper className="w-4 h-4 text-success shrink-0" />
              <p className="text-xs text-success font-medium flex-1">Your CSD account is ready! BPID: {(profile as any)?.csd_bpid}</p>
              <span className="text-[9px] text-success/70">Tap to view →</span>
            </button>
          )}
          <PortfolioCard />
          <div className="mt-5 mb-0 pb-3">
            {renderQuickIcons()}
          </div>
        </div>

        <div className="flex-1 px-4 pb-4 space-y-5" style={{ paddingTop: 8, paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>



          {recentOrders.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Recent Orders</h3>
                <Link to="/my-orders" className="text-[10px] font-medium text-primary">View All</Link>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 hide-scrollbar">
                {(recentOrders as any[]).map((order: any) => {
                  const sym = order.symbol;
                  const side = (order.side || '').toLowerCase();
                  const status = order.status || 'pending';
                  return (
                    <div key={order.client_order_id} className="shrink-0 w-36 bg-card rounded-xl p-2.5 border border-border/40">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold text-foreground">{sym || "—"}</span>
                        <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${side === "buy" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          {side.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground">{Number(order.quantity).toLocaleString()} shares</p>
                      <p className={`text-[9px] font-medium mt-0.5 ${
                        status === "filled" ? "text-success" :
                        status === "cancelled" || status === "rejected" ? "text-destructive" :
                        status === "queued" || status === "submitting" || status === "pending" ? "text-warning" :
                        "text-primary"
                      }`}>
                        {status === 'open' || status === 'active' ? 'Live on Exchange' :
                         status === 'cancel_requested' ? 'Cancelling' :
                         status === 'partial_fill' || status === 'partial' ? 'Partial Fill' :
                         status === 'queued' ? 'Queued' :
                         status === 'pending' || status === 'submitting' ? 'Pending' :
                         status.charAt(0).toUpperCase() + status.slice(1)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Gainers / Losers — directly on background */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1">
                <button onClick={() => setGlTab("gainers")} className={`px-3.5 py-1.5 text-[10px] font-semibold ring-btn ${glTab === "gainers" ? "ring-btn-active" : ""}`}>
                  <TrendingUp className="w-3 h-3 inline mr-1" />Gainers
                </button>
                <button onClick={() => setGlTab("losers")} className={`px-3.5 py-1.5 text-[10px] font-semibold ring-btn ${glTab === "losers" ? "ring-btn-active" : ""}`}>
                  <TrendingDown className="w-3 h-3 inline mr-1" />Losers
                </button>

              </div>
            </div>
            <div className="divide-y divide-border/30">
              {movers.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">No movers yet</p>}
              {movers.map((m: any) => (
                <Link key={m.symbol} to={`/stock/${m.symbol}`} className="flex items-center gap-2 justify-between py-2.5">
                  <StockLogo ticker={m.symbol} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">{m.symbol}</p>
                    <p className="text-[9px] text-primary truncate">{m.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-foreground">{formatPrice(m.last_price, m.currency)}</p>
                    <p className={`text-[10px] font-medium ${changeColor(m.change_percent)}`}>
                      {formatChangePct(m.change_percent)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div className="flex flex-col min-h-screen -mt-4 md:-mt-6 -mx-4 md:-mx-6 lg:-mx-8">
      <div className="px-4 md:px-6 lg:px-8 pt-0 pb-2">
        {(!mwStatus || mwStatus === 'offline') && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive font-medium">Exchange connection unavailable — trading temporarily suspended</p>
          </div>
        )}
        {profile?.kyc_status === "pending" && (
          <div className="bg-warning/10 border border-warning/20 rounded-xl px-4 py-2 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            <p className="text-xs text-warning font-medium">Account Under Review — Verification takes 1-2 business days.</p>
          </div>
        )}
        <PortfolioCard />
        <div className="mt-3 mb-1">
          {renderQuickIcons()}
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 lg:px-8 pt-3 pb-4 space-y-4">


        {recentOrders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Recent Orders</h3>
              <Link to="/my-orders" className="text-[10px] font-medium text-primary">View All</Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {(recentOrders as any[]).map((order: any) => {
                const sym = order.symbol;
                const side = (order.side || '').toLowerCase();
                return (
                  <div key={order.client_order_id} className="shrink-0 w-36 bg-card rounded-xl p-2.5 border border-border/40">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold text-foreground">{sym || "—"}</span>
                      <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${side === "buy" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {side.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">{Number(order.quantity).toLocaleString()} shares</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              <button onClick={() => setGlTab("gainers")} className={`px-3.5 py-1.5 text-[10px] font-semibold ring-btn ${glTab === "gainers" ? "ring-btn-active" : ""}`}>
                <TrendingUp className="w-3 h-3 inline mr-1" />Gainers
              </button>
              <button onClick={() => setGlTab("losers")} className={`px-3.5 py-1.5 text-[10px] font-semibold ring-btn ${glTab === "losers" ? "ring-btn-active" : ""}`}>
                <TrendingDown className="w-3 h-3 inline mr-1" />Losers
              </button>

            </div>
          </div>
          <div className="divide-y divide-border/30">
            {movers.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">No movers yet</p>}
            {movers.map((m: any) => (
              <Link key={m.symbol} to={`/stock/${m.symbol}`} className="flex items-center gap-2 justify-between py-2.5">
                <StockLogo ticker={m.symbol} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{m.symbol}</p>
                  <p className="text-[9px] text-primary truncate">{m.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-foreground">{formatPrice(m.last_price, m.currency)}</p>
                  <p className={`text-[10px] font-medium ${changeColor(m.change_percent)}`}>
                    {formatChangePct(m.change_percent)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
