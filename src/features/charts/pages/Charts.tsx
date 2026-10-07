import { useState, useMemo } from "react";
import { Plus, LineChart as LineChartIcon, GitCompare, Activity, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from "recharts";
import { formatPrice, changeColor, formatChangePct } from "@/lib/display/formatters";
import UniversalChart from "@/features/charts/components/UniversalChart";
import { useStocks } from "@/hooks/useDataQuery";
import { usePriceHistory, useLasiHistory } from "@/features/market/hooks/usePriceHistory";
import { useStockPrice } from "@/features/market/hooks/useMarketData";
import PortfolioPerformanceChart from "@/features/portfolio/components/PortfolioPerformanceChart";

const lasiTimeRanges = ["1M", "3M", "6M", "1Y", "3Y", "5Y"];

const compareColors = ["hsl(197, 82%, 52%)", "hsl(145, 63%, 45%)", "hsl(36, 90%, 52%)"];

const bottomTabs = ["Performance", "Compare"];
const bottomIcons = [LineChartIcon, GitCompare];

const Charts = () => {
  const { data: allStocks = [] } = useStocks();
  const navigate = useNavigate();
  const [bottomTab, setBottomTab] = useState("Performance");
  const [stockSheetOpen, setStockSheetOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [compareStocks, setCompareStocks] = useState<string[]>([]);
  const [compareChartType, setCompareChartType] = useState<'line' | 'area' | 'stepline'>('line');

  // Index history from the trading API; when it's unavailable the chart
  // shows an "unavailable" message (see below).
  const { data: lasiTradeData = [], isLoading: lasiLoading } = useLasiHistory(365 * 3);
  const lasiChange = useMemo(() => {
    if (lasiTradeData.length < 2) return null;
    const first = lasiTradeData[0].close ?? lasiTradeData[0].price;
    const last = lasiTradeData[lasiTradeData.length - 1].close ?? lasiTradeData[lasiTradeData.length - 1].price;
    return { amount: last - first, pct: first !== 0 ? ((last - first) / first) * 100 : 0 };
  }, [lasiTradeData]);
  const selectedSec = selectedStock ? allStocks.find((s) => s.symbol === selectedStock) : null;
  const { data: stockHistory = [] } = usePriceHistory(selectedStock || undefined, '3M');
  const { data: livePrice } = useStockPrice(selectedStock || '');
  // FIX G: middleware mapPriceData exposes live_price (trade→bid→null) and is_live.
  const livePriceValue = livePrice?.live_price ?? null;
  const isLive = livePrice?.is_live === true;

  // Real per-stock history for the comparison chart, rebased to 100 at the
  // start of the window. Hooks can't be called in a loop over a dynamic array,
  // so three fixed slots are used (usePriceHistory no-ops via `enabled` when
  // its symbol is undefined, which is safe/cheap for unused slots).
  const compareHistoryA = usePriceHistory(compareStocks[0], '1M');
  const compareHistoryB = usePriceHistory(compareStocks[1], '1M');
  const compareHistoryC = usePriceHistory(compareStocks[2], '1M');
  const compareLoading = [compareHistoryA, compareHistoryB, compareHistoryC].some((h, i) => compareStocks[i] && h.isLoading);

  const compareData = useMemo(() => {
    if (compareStocks.length === 0) return [];
    const histories = [compareHistoryA.data, compareHistoryB.data, compareHistoryC.data];
    const allDates = new Set<string>();
    compareStocks.forEach((_, idx) => (histories[idx] || []).forEach((r) => allDates.add(r.date)));
    const sortedDates = Array.from(allDates).sort();
    if (sortedDates.length === 0) return [];

    const baseByTicker: Record<string, number | undefined> = {};
    compareStocks.forEach((ticker, idx) => {
      const series = histories[idx] || [];
      baseByTicker[ticker] = series.length ? (series[0].close ?? series[0].price) : undefined;
    });

    return sortedDates.map((date) => {
      const d = new Date(date);
      const point: Record<string, string | number> = { date: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}` };
      compareStocks.forEach((ticker, idx) => {
        const series = histories[idx] || [];
        const row = series.find((r) => r.date === date);
        const base = baseByTicker[ticker];
        if (row && base) {
          point[ticker] = Math.round(((row.close ?? row.price) / base) * 10000) / 100;
        }
      });
      return point;
    });
  }, [compareStocks, compareHistoryA.data, compareHistoryB.data, compareHistoryC.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => setStockSheetOpen(true)}
        className="ring-btn flex items-center gap-2 px-4 h-11 text-sm font-medium">
          <Plus className="w-4 h-4" /> View Stock
        </button>
        <button
          onClick={() => navigate(`/analysis/${selectedStock || allStocks[0]?.symbol || 'AECI'}`)}
          className="ring-btn w-11 h-11 flex items-center justify-center"
          title="Analysis Mode">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
          </svg>
        </button>
      </div>

      {/* Selected stock chart */}
      {selectedSec &&
      <div className="hairline-top pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-foreground">{selectedSec.symbol} — {selectedSec.name}</p>
              <p className="text-lg font-bold text-foreground">{formatPrice(livePriceValue ?? selectedSec.last_price, selectedSec.currency)}{isLive && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 align-middle" />}</p>
            </div>
            <button onClick={() => setSelectedStock(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <UniversalChart
          data={stockHistory.length > 1 ? stockHistory : undefined}
          height={200}
          timePeriods={["1W", "1M", "3M", "1Y"]}
          defaultPeriod="1M"
          formatValue={(v) => `K${v.toFixed(2)}`}
          gradientId="charts-stock-grad" />
          {stockHistory.length < 2 && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">Live price chart will populate during market hours (10:00 – 14:00 CAT)</p>
          )}
        </div>
      }

      {/* LASI Chart — directly on the background */}
      <div className="hairline-top pt-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-white">LuSE All Share Index</span>
          <Activity className="w-4 h-4 text-white" />
        </div>
        {lasiChange ? (
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-sm font-normal ${lasiChange.amount >= 0 ? 'text-success' : 'text-destructive'}`}>
              {lasiChange.amount >= 0 ? '+' : ''}{lasiChange.amount.toFixed(2)} ({lasiChange.pct >= 0 ? '+' : ''}{lasiChange.pct.toFixed(2)}%)
            </span>
          </div>
        ) : (
          <div className="mb-2" />
        )}
        {lasiTradeData.length > 1 ? (
          <UniversalChart
            data={lasiTradeData}
            height={260}
            timePeriods={lasiTimeRanges}
            defaultPeriod="1Y"
            formatValue={(v) => v.toLocaleString()}
            gradientId="lasi-chart-grad"
            showVolume />
        ) : (
          <div className="h-[260px] flex items-center justify-center text-center px-6">
            <p className="text-sm text-muted-foreground">
              {lasiLoading ? 'Loading index history…' : 'Index history is currently unavailable.'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom selector — white ring pattern */}
      <div className="grid grid-cols-2 gap-2">
        {bottomTabs.map((tab, i) => {
          const Icon = bottomIcons[i];
          return (
            <button key={tab} onClick={() => setBottomTab(tab)}
            className={`ring-btn ${bottomTab === tab ? 'ring-btn-active' : ''} flex items-center justify-center gap-2 py-3 text-xs font-medium`}>
              <Icon className="w-4 h-4" />
              <span>{tab}</span>
            </button>);

        })}
      </div>

      {/* Performance tab */}
      {bottomTab === "Performance" &&
      <div className="hairline-top pt-5">
          {/* Same daily portfolio_snapshots chart as the Portfolio screen. */}
          <PortfolioPerformanceChart />
        </div>
      }


      {/* Compare tab - with actual comparison chart */}
      {bottomTab === "Compare" &&
      <div className="hairline-top pt-5">
          <h3 className="font-semibold text-white mb-1">Stock Comparison</h3>
          <p className="text-xs text-muted-foreground mb-4">Compare normalized price performance of up to 3 stocks (rebased to 100).</p>
          
          {/* Chart type toggle (no candlesticks for comparison) */}
          <div className="flex gap-1 mb-3">
            {(['line', 'area', 'stepline'] as const).map((type) =>
          <button key={type} onClick={() => setCompareChartType(type)}
          className={`ring-btn ${compareChartType === type ? 'ring-btn-active' : ''} px-3 py-1.5 text-xs font-medium`}>
                {type === 'line' ? 'Line' : type === 'area' ? 'Area' : 'Step'}
              </button>
          )}
          </div>

          {compareStocks.length < 3 &&
        <select onChange={(e) => {if (e.target.value && !compareStocks.includes(e.target.value)) setCompareStocks([...compareStocks, e.target.value]);e.target.value = "";}}
        className="w-full ring-btn px-4 py-3 text-sm focus:outline-hidden mb-3">
              <option value="">Add stock to compare</option>
              {allStocks.filter((s) => !compareStocks.includes(s.symbol)).map((s) =>
          <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>
          )}
            </select>
        }

          {compareStocks.length > 0 &&
        <div className="flex gap-2 flex-wrap mb-4">
              {compareStocks.map((t, idx) => {
            const sec = allStocks.find((s) => s.symbol === t);
            return (
              <div key={t} className="flex items-center gap-2 ring-btn px-3 py-1.5">
                    <span className="w-3 h-0.5 inline-block rounded" style={{ background: compareColors[idx] }} />
                    <span className="text-xs font-bold text-foreground">{t}</span>
                    <span className="text-xs text-muted-foreground">{sec ? formatPrice(sec.last_price, sec.currency) : ''}</span>
                    <button onClick={() => setCompareStocks(compareStocks.filter((s) => s !== t))} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>);

          })}
            </div>
        }

          {compareStocks.length > 0 && compareData.length > 0 ?
        <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                {compareChartType === 'area' ?
            <AreaChart data={compareData}>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(205, 18%, 50%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(205, 18%, 50%)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(210, 28%, 11%)", border: "1px solid hsl(210, 22%, 16%)", borderRadius: 8, fontSize: 12 }} />
                    {compareStocks.map((ticker, idx) =>
              <Area key={ticker} type="monotone" dataKey={ticker} stroke={compareColors[idx]} strokeWidth={2} fill={compareColors[idx]} fillOpacity={0.1} name={ticker} />
              )}
                  </AreaChart> :

            <LineChart data={compareData}>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(205, 18%, 50%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(205, 18%, 50%)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(210, 28%, 11%)", border: "1px solid hsl(210, 22%, 16%)", borderRadius: 8, fontSize: 12 }} />
                    {compareStocks.map((ticker, idx) =>
              <Line key={ticker} type={compareChartType === 'stepline' ? 'stepAfter' : 'monotone'} dataKey={ticker} stroke={compareColors[idx]} strokeWidth={2} dot={false} name={ticker} />
              )}
                  </LineChart>
            }
              </ResponsiveContainer>
            </div> :
        compareStocks.length === 0 ?
        <p className="text-sm text-muted-foreground text-center py-8">Select up to 3 stocks to compare their performance</p> :
        <p className="text-sm text-muted-foreground text-center py-8">
          {compareLoading ? 'Loading price history…' : 'Price history is currently unavailable for the selected stocks.'}
        </p>}

          {compareStocks.length > 0 &&
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              {compareStocks.map((t, idx) =>
          <span key={t} className="flex items-center gap-1">
                  <span className="w-3 h-0.5 inline-block rounded" style={{ background: compareColors[idx] }} /> {t}
                </span>
          )}
            </div>
        }
        </div>
      }

      {/* Stock selector bottom sheet */}
      {stockSheetOpen &&
      <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50" onClick={() => setStockSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up" style={{ maxHeight: '50vh' }}>
            <div className="bg-card rounded-t-2xl border-t border-border px-5 pt-5 pb-8 safe-bottom overflow-y-auto" style={{ maxHeight: '50vh' }}>
              <div className="flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
              <h3 className="font-semibold text-foreground mb-3">Select Stock</h3>
              <div className="space-y-1">
                {allStocks.map((s) => {
                const change = s.change_percent ?? 0;
                return (
                  <button key={s.symbol} onClick={() => {setSelectedStock(s.symbol);setStockSheetOpen(false);}}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-secondary transition-colors">
                      <div>
                        <p className="text-sm font-bold text-foreground">{s.symbol}</p>
                        <p className="text-xs text-muted-foreground">{s.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{formatPrice(s.last_price, s.currency)}</p>
                        <p className={`text-xs ${changeColor(change)}`}>{formatChangePct(change)}</p>
                      </div>
                    </button>);

              })}
              </div>
            </div>
          </div>
        </>
      }
    </div>);

};

export default Charts;