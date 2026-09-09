import { useState, useMemo } from "react";
import { Plus, TrendingUp, TrendingDown, Building2, FileText, LineChart as LineChartIcon, GitCompare, Activity, ArrowLeftRight, X, TrendingUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, LineChart, Line } from "recharts";
import { formatZMW, formatPrice, changeColor, formatChangePct } from "@/lib/display/formatters";
import UniversalChart from "@/components/UniversalChart";
import { useStocks } from "@/hooks/useSupabaseQuery";
import { useAllMarketData } from "@/hooks/useMarketData";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { useStockPrice } from "@/hooks/useMarketData";
import { generateSampleTradeData } from "@/utils/buildCandles";

const lasiTimeRanges = ["1M", "3M", "6M", "1Y", "3Y", "5Y"];
const bondYieldData = [
{ date: "Jan 22", value: 11.5 }, { date: "Jan 24", value: 12.0 }, { date: "Jan 26", value: 11.8 },
{ date: "Jan 28", value: 12.2 }, { date: "Jan 30", value: 11.9 }, { date: "Feb 1", value: 12.1 },
{ date: "Feb 2", value: 11.7 }, { date: "Feb 3", value: 12.3 }, { date: "Feb 4", value: 12.0 },
{ date: "Feb 5", value: 11.8 }, { date: "Feb 6", value: 12.1 }, { date: "Feb 7", value: 11.9 },
{ date: "Feb 8", value: 12.2 }, { date: "Feb 9", value: 11.6 }, { date: "Feb 11", value: 12.0 },
{ date: "Feb 13", value: 11.8 }, { date: "Feb 15", value: 12.1 }, { date: "Feb 17", value: 12.3 },
{ date: "Feb 19", value: 11.9 }, { date: "Feb 21", value: 12.0 }];


const bondTradeData = bondYieldData.map((d, i) => ({
  date: `2025-02-${String(i + 1).padStart(2, '0')}`,
  price: d.value, volume: 0, open: d.value, high: d.value + 0.1, low: d.value - 0.1, close: d.value
}));

// Portfolio-vs-index historical snapshots are not yet persisted server-side.
// We render a placeholder card instead of fabricating fake performance data.




const sectorPerf = [
{ name: "Industrials", change: 12.5 }, { name: "Technology", change: 3.2 },
{ name: "Telecommunications", change: 2.5 }, { name: "Basic Materials", change: -1.8 },
{ name: "Financials", change: 0.8 }, { name: "Consumer Services", change: 1.5 },
{ name: "Consumer Goods", change: -0.5 }, { name: "Utilities", change: 2.1 }, { name: "Oil & Gas", change: -3.2 }];


const sectorColors = ["hsl(197, 82%, 52%)", "hsl(145, 63%, 38%)", "hsl(36, 90%, 52%)", "hsl(280, 60%, 55%)", "hsl(4, 80%, 50%)", "hsl(170, 70%, 40%)", "hsl(330, 60%, 50%)", "hsl(50, 80%, 50%)", "hsl(220, 60%, 55%)"];
const compareColors = ["hsl(197, 82%, 52%)", "hsl(145, 63%, 45%)", "hsl(36, 90%, 52%)"];

const bottomTabs = ["Performance", "Compare"];
const bottomIcons = [LineChartIcon, GitCompare];

const Charts = () => {
  const { data: allStocks = [] } = useStocks();
  const navigate = useNavigate();
  const [secTab, setSecTab] = useState<"bonds" | "tbills">("bonds");
  const [bottomTab, setBottomTab] = useState("Performance");
  const [perfRange, setPerfRange] = useState("1M");
  const [stockSheetOpen, setStockSheetOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [compareStocks, setCompareStocks] = useState<string[]>([]);
  const [compareChartType, setCompareChartType] = useState<'line' | 'area' | 'stepline'>('line');

  const lasiTradeData = useMemo(() => generateSampleTradeData(16000, 26314, 14), []);
  const liveData = useAllMarketData() as any;
  const liveMap = (liveData?.data ?? liveData) as Record<string, any> | undefined;

  const heatmapTiles = useMemo(() => {
    return (allStocks as any[])
      .slice(0, 20)
      .map((s: any) => ({
        ticker: s.symbol,
        change: Number(liveMap?.[s.symbol]?.change_percent ?? s.change_percent ?? 0),
      }));
  }, [allStocks, liveMap]);


  const selectedSec = selectedStock ? (allStocks as any[]).find((s: any) => s.symbol === selectedStock) : null;
  const { data: stockHistory = [] } = usePriceHistory(selectedStock || undefined, '3M');
  const { data: livePrice } = useStockPrice(selectedStock || '');
  // FIX G: middleware mapPriceData exposes live_price (trade→bid→null) and is_live.
  const livePriceValue = (livePrice as any)?.live_price ?? null;
  const isLive = (livePrice as any)?.is_live === true;

  // Generate normalized comparison data (rebased to 100)
  const compareData = useMemo(() => {
    if (compareStocks.length === 0) return [];
    const days = 30;
    const points: any[] = [];
    const baseValues: Record<string, number> = {};

    compareStocks.forEach((ticker) => {
      const sec = (allStocks as any[]).find((s: any) => s.symbol === ticker);
      baseValues[ticker] = sec?.last_price || 100;
    });

    for (let i = 0; i < days; i++) {
      const d = new Date();d.setDate(d.getDate() - (days - i));
      const point: any = { date: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}` };
      compareStocks.forEach((ticker, idx) => {
        // Simulate normalized price movement
        const noise = (Math.random() - 0.48) * 4;
        const base = i === 0 ? 100 : points[i - 1]?.[ticker] || 100;
        point[ticker] = Math.round((base + noise) * 100) / 100;
      });
      points.push(point);
    }
    return points;
  }, [compareStocks, allStocks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => setStockSheetOpen(true)}
        className="ring-btn flex items-center gap-2 px-4 h-11 text-sm font-medium">
          <Plus className="w-4 h-4" /> View Stock
        </button>
        <button
          onClick={() => navigate(`/analysis/${selectedStock || (allStocks as any[])[0]?.symbol || 'AECI'}`)}
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
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm text-destructive font-normal">-34.63 (-0.13%)</span>
        </div>
        <p className="text-xs text-success mb-2">+56.63% over 1Y</p>
        <UniversalChart
          data={lasiTradeData}
          height={260}
          timePeriods={lasiTimeRanges}
          defaultPeriod="1Y"
          formatValue={(v) => v.toLocaleString()}
          gradientId="lasi-chart-grad"
          showVolume />
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
      <div className="hairline-top pt-5 text-center">
          <h3 className="font-semibold mb-2 text-white">Portfolio vs Market Performance</h3>
          <p className="text-sm text-muted-foreground">Portfolio history coming soon</p>
          <p className="text-xs text-muted-foreground mt-1">Daily portfolio snapshots will appear here once the middleware has recorded enough history for your account.</p>
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
        className="w-full ring-btn px-4 py-3 text-sm focus:outline-none mb-3">
              <option value="">Add stock to compare</option>
              {(allStocks as any[]).filter((s: any) => !compareStocks.includes(s.symbol)).map((s: any) =>
          <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>
          )}
            </select>
        }

          {compareStocks.length > 0 &&
        <div className="flex gap-2 flex-wrap mb-4">
              {compareStocks.map((t, idx) => {
            const sec = (allStocks as any[]).find((s: any) => s.symbol === t);
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
        null}

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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setStockSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up" style={{ maxHeight: '50vh' }}>
            <div className="bg-card rounded-t-2xl border-t border-border px-5 pt-5 pb-8 safe-bottom overflow-y-auto" style={{ maxHeight: '50vh' }}>
              <div className="flex justify-center mb-4"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
              <h3 className="font-semibold text-foreground mb-3">Select Stock</h3>
              <div className="space-y-1">
                {(allStocks as any[]).map((s: any) => {
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