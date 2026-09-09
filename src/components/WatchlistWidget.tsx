import { Link } from 'react-router-dom';
import { Star, ArrowLeftRight } from 'lucide-react';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { formatZMW } from '@/lib/tradingUtils';
import StockLogo from '@/components/StockLogo';

const WatchlistWidget = () => {
  const { watchlist } = useWatchlist();

  if (watchlist.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Watchlist</h3>
        </div>
        <Link to="/watchlist" className="text-xs text-primary hover:underline">View all</Link>
      </div>
      {watchlist.slice(0, 5).map((item: any) => {
        const stock = item.stocks;
        if (!stock) return null;
        const change = stock.change_percent || 0;
        const positive = change >= 0;
        return (
          <div key={item.id} className="bg-card rounded-xl px-4 py-3 flex items-center gap-3 justify-between">
            <StockLogo ticker={stock.symbol} size="sm" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-foreground text-sm">{stock.symbol}</span>
              <p className="text-[10px] truncate text-primary">{stock.name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-foreground text-sm">{formatZMW(stock.last_price || 0)}</p>
              <p className={`text-[10px] font-medium ${positive ? 'text-success' : 'text-destructive'}`}>
                {positive ? '+' : ''}{change.toFixed(2)}%
              </p>
            </div>
            <Link
              to={`/trade?ticker=${stock.symbol}`}
              className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
              title="Trade"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
            </Link>
          </div>
        );
      })}
    </div>
  );
};

export default WatchlistWidget;
