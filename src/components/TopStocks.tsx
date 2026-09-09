import { Link } from "react-router-dom";
import StockLogo from "@/components/StockLogo";
import { useStocks } from "@/hooks/useSupabaseQuery";

const stockTickers = ["AIRTEL", "CHIL", "ZSUG", "ZANACO", "ZAMBEEF"];

// FIX H: replaced useATS() (local mock) with useStocks() (Supabase, fed by middleware seeding).
const TopStocks = () => {
  const { data: stocks = [] } = useStocks();
  const allStocks = stocks as any[];

  const topStocks = stockTickers
    .map((sym) => allStocks.find((s) => s.symbol === sym))
    .filter(Boolean) as any[];

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-foreground text-lg">Top Movers</h3>
      {topStocks.map((stock) => {
        const last = stock.last_price ?? 0;
        const prev = stock.prev_close ?? stock.previous_close ?? last;
        const change = prev ? ((last - prev) / prev) * 100 : 0;
        const positive = change >= 0;

        return (
          <Link
            key={stock.id || stock.symbol}
            to={`/stock/${stock.symbol}`}
            className="bg-card rounded-xl px-5 py-4 flex items-center gap-3 justify-between hover:bg-secondary/50 transition-colors cursor-pointer block">
            <StockLogo ticker={stock.symbol} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{stock.symbol}</span>
                {stock.sector && <span className="text-xs px-2 py-0.5 rounded text-destructive-foreground bg-muted">{stock.sector}</span>}
              </div>
              <p className="text-sm mt-0.5 truncate" style={{ color: '#ff8b03' }}>{stock.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-foreground">K{Number(last).toFixed(2)}</p>
              <p className={`text-sm flex items-center justify-end gap-1 ${positive ? 'text-success' : 'text-destructive'}`}>
                <TrendIcon positive={positive} /> {positive ? '+' : ''}{change.toFixed(2)}%
              </p>
            </div>
          </Link>);

      })}
    </div>);

};

const TrendIcon = ({ positive }: {positive: boolean;}) =>
<svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="inline">
    {positive ?
  <path d="M2 10L6 6L8 8L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> :
  <path d="M2 4L6 8L8 6L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  }
  </svg>;

export default TopStocks;
