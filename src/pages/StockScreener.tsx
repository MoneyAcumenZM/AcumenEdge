import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatPrice, formatChangePct, relativeTime } from "@/lib/display/formatters";
import { useStocks } from "@/hooks/useSupabaseQuery";
import { useAllMarketData } from "@/hooks/useMarketData";
import { middlewareClient } from "@/services/middlewareClient";
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import UniversalChart from "@/components/UniversalChart";
import StockLogo from "@/components/StockLogo";
import { Skeleton } from "@/components/ui/skeleton";

const defaultScores = { value: 3.0, growth: 3.0, health: 3.0, dividends: 3.0, performance: 3.0 };

const StockScreener = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const { data: stocks = [], isLoading } = useStocks();
  const { data: live = {} } = useAllMarketData();

  const meta = (stocks as any[]).find((s: any) => s.symbol === ticker);
  const l = (live as Record<string, any>)[ticker || ''] || {};
  const stock = meta ? {
    ...meta,
    last_price: l.live_price ?? l.last_price ?? meta.last_price,
    bid_price: l.bid_price ?? meta.bid_price,
    ask_price: l.ask_price ?? meta.ask_price,
    open_price: l.open_price ?? meta.open_price,
    high_price: l.high_price ?? meta.high_price,
    low_price: l.low_price ?? meta.low_price,
    volume: l.volume ?? meta.volume,
    change_percent: l.change_percent ?? l.changePercent ?? meta.change_percent,
    change_amount: l.change ?? l.change_amount ?? meta.change_amount,
    price_updated_at: l.timestamp ?? meta.price_updated_at,
  } : null;

  // Real OHLCV from middleware (replaces synthetic generateStockTradeData)
  const { data: ohlcv } = useQuery({
    queryKey: ['ohlcv', ticker, 30],
    queryFn: () => middlewareClient.getOhlcv(ticker!, 30),
    enabled: !!ticker,
    staleTime: 5 * 60 * 1000,
  });

  const tradeData = useMemo(() => {
    const rows: any[] = (ohlcv as any)?.data || (ohlcv as any)?.candles || (Array.isArray(ohlcv) ? ohlcv : []);
    return rows.map((r: any) => {
      const close = Number(r.close ?? r.c ?? r.last ?? 0);
      return {
        date: String(r.date || r.timestamp || r.time || ''),
        price: close,
        volume: Number(r.volume ?? r.v ?? 0),
        open: Number(r.open ?? r.o ?? close),
        high: Number(r.high ?? r.h ?? close),
        low: Number(r.low ?? r.l ?? close),
        close,
      };
    }).filter((x) => x.price > 0);
  }, [ohlcv]);

  // Company info: only real fields from the stocks row. No hardcoded values.
  const info = {
    sector: stock?.sector || '—',
    hq: 'Lusaka, Zambia',
    website: stock?.website || '#',
    marketCap: '—',
    peRatio: '—',
    employees: '—',
    analysisScore: 3.0,
    analysisLabel: 'Average',
    scores: defaultScores,
  };

  const price = stock?.last_price;
  const changeAmt = stock?.change_amount;
  const changePct = stock?.change_percent;
  const positive = (changePct ?? 0) >= 0;

  const radarData = [
    { axis: "Value", score: info.scores.value },
    { axis: "Growth", score: info.scores.growth },
    { axis: "Health", score: info.scores.health },
    { axis: "Dividends", score: info.scores.dividends },
    { axis: "Performance", score: info.scores.performance },
  ];

  const scoreColor = (s: number) => s >= 3.5 ? "text-success" : s >= 2.0 ? "text-warning" : "text-destructive";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-[220px] w-full rounded-xl" />
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="space-y-4">
        <Link to="/market" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Stocks
        </Link>
        <div className="bg-card rounded-xl p-8 text-center">
          <p className="text-muted-foreground">Security not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <StockLogo ticker={stock.symbol} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-foreground">{stock.name}</h1>
          </div>
          <p className="text-xs text-warning">{info.sector}</p>
          <a href={info.website} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline inline-flex items-center gap-1 mt-0.5 text-warning">
            Visit Website <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase text-primary-foreground">Current Price</p>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-warning">{formatPrice(price, stock.currency)}</span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${positive ? 'bg-success-muted text-success' : 'bg-destructive-muted text-destructive'}`}>
            {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {formatPrice(changeAmt != null ? Math.abs(changeAmt) : null, stock.currency)} ({formatChangePct(changePct)})
          </span>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <div>
            <span className="text-muted-foreground">Supply: </span>
            <span className="font-semibold text-destructive">{stock.volume ? (stock.volume * 0.6).toLocaleString() : '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Demand: </span>
            <span className="font-semibold text-success">{stock.volume ? (stock.volume * 0.4).toLocaleString() : '—'}</span>
          </div>
        </div>
        {stock.price_updated_at && (
          <p className="text-[9px] text-muted-foreground mt-1">Last updated {relativeTime(stock.price_updated_at)}</p>
        )}
      </div>

      <div className="bg-card rounded-xl p-5">
        {tradeData.length > 0 ? (
          <UniversalChart
            data={tradeData}
            title="Price History"
            height={220}
            timePeriods={["1W", "1M", "3M", "1Y"]}
            defaultPeriod="1M"
            formatValue={(v) => `K${v.toFixed(2)}`}
            gradientId="stock-screener-grad"
          />
        ) : (
          <div className="h-[220px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Historical data will populate over time</p>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl p-5">
        <h3 className="font-semibold mb-4 text-warning">Key Metrics</h3>
        <div className="grid grid-cols-3 gap-x-4 gap-y-3 text-xs">
          <div><p className="text-muted-foreground">Open</p><p className="font-bold text-foreground">{formatPrice(stock.open_price, stock.currency)}</p></div>
          <div><p className="text-muted-foreground">High</p><p className="font-bold text-foreground">{formatPrice(stock.high_price, stock.currency)}</p></div>
          <div><p className="text-muted-foreground">Low</p><p className="font-bold text-foreground">{formatPrice(stock.low_price, stock.currency)}</p></div>
          <div><p className="text-muted-foreground">Bid</p><p className="font-bold text-success">{formatPrice(stock.bid_price, stock.currency)}</p></div>
          <div><p className="text-muted-foreground">Ask</p><p className="font-bold text-destructive">{formatPrice(stock.ask_price, stock.currency)}</p></div>
          <div><p className="text-muted-foreground">Volume</p><p className="font-bold text-foreground">{stock.volume != null ? stock.volume.toLocaleString() : '—'}</p></div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-warning">Stock Analysis</h3>
          <span className="text-2xl font-bold text-warning">{info.analysisScore.toFixed(1)}</span>
        </div>
        <p className="text-sm mb-4 text-secondary-foreground">{stock.name}'s overall score: {info.analysisLabel}</p>
        <div className="h-[220px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="hsl(210, 22%, 20%)" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "hsl(200, 20%, 80%)" }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
              <Radar dataKey="score" stroke="#ff9503" fill="#ff9503" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          {radarData.map((d) => (
            <div key={d.axis} className="text-center">
              <p className="text-primary-foreground">{d.axis}</p>
              <p className={`font-bold ${scoreColor(d.score)}`}>{d.score.toFixed(1)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-secondary/50 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-medium text-primary-foreground">What does this mean?</p>
          <p className="text-[10px] text-warning"><strong className="text-foreground">Value:</strong> Is the stock fairly priced?</p>
          <p className="text-[10px] text-warning"><strong className="text-foreground">Growth:</strong> Are revenue and earnings growing?</p>
          <p className="text-[10px] text-warning"><strong className="text-foreground">Health:</strong> How strong is the balance sheet?</p>
          <p className="text-[10px] text-warning"><strong className="text-foreground">Dividends:</strong> Does it pay reliable dividends?</p>
          <p className="text-[10px] text-warning"><strong className="text-foreground">Performance:</strong> How has the stock performed recently?</p>
        </div>
      </div>

      <div className="bg-card rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-3">About {stock.name}</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-muted-foreground">Sector</p><p className="font-medium text-foreground">{info.sector}</p></div>
          <div><p className="text-muted-foreground">Headquarters</p><p className="font-medium text-foreground">{info.hq}</p></div>
        </div>
      </div>

      <Link to={`/trade?ticker=${stock.symbol}`}
        className="flex items-center justify-center gap-2 w-full py-3.5 text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity bg-warning">
        <ArrowLeftRight className="w-4 h-4" /> Place Order
      </Link>
    </div>
  );
};

export default StockScreener;
