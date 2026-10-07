import { useParams, Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { formatPrice, formatChangePct, relativeTime } from "@/lib/display/formatters";
import { useStocks } from "@/hooks/useDataQuery";
import { useAllMarketData, type Quote } from "@/features/market/hooks/useMarketData";
import { usePriceHistory } from "@/features/market/hooks/usePriceHistory";
import UniversalChart from "@/features/charts/components/UniversalChart";
import StockLogo from "@/features/market/components/StockLogo";
import { Skeleton } from "@/components/ui/skeleton";

const StockScreener = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const { data: stocks = [], isLoading } = useStocks();
  const { data: live = {} } = useAllMarketData();

  const meta = stocks.find((s) => s.symbol === ticker);
  const l: Quote = live[ticker || ''] || {};
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

  // Same price-history source and parser as the charts (API first, then the
  // `ohlcv` table), so the backend only has to provide one shape.
  const { data: tradeData = [] } = usePriceHistory(ticker, '1M');

  // Company info: only real fields from the stocks row. Anything the data
  // doesn't provide (market cap, P/E, employees) shows '—'.
  const info = {
    sector: stock?.sector || '—',
    hq: 'Lusaka, Zambia',
    marketCap: '—',
    peRatio: '—',
    employees: '—',
  };

  const price = stock?.last_price;
  const changeAmt = stock?.change_amount;
  const changePct = stock?.change_percent;
  const positive = (changePct ?? 0) >= 0;

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
        <h3 className="font-semibold text-warning mb-2">Stock Analysis</h3>
        <p className="text-sm text-muted-foreground">
          Fundamental analysis (value, growth, balance-sheet health, dividends,
          recent performance) isn't available yet — it needs company financial
          data this app doesn't currently have a source for.
        </p>
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
