import { useState, useMemo, useEffect, useCallback } from "react";
import { TrendingUp, BarChart2, GitCommitHorizontal } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, LineChart, Line } from
"recharts";
import type { TradeData, StepPoint } from "@/utils/buildCandles";
import { buildWeeklyCandles, filterByPeriod, generateSampleTradeData, buildStepLineData } from "@/utils/buildCandles";
import { formatKwacha } from "@/utils/chartAxisConfig";

const STORAGE_KEY = "circle_chart_preference";
const BULL_COLOR = "#ff9503";
const BEAR_COLOR = "#22c55e";
const STEP_ACTIVE_COLOR = "#ff9503";
const STEP_FLAT_COLOR = "#334155";

type ChartType = "line" | "candlestick" | "stepline";

function getStoredPref(): ChartType {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "candlestick" || v === "stepline") return v;
    return "line";
  } catch {return "line";}
}

// Global event for syncing across instances
const listeners = new Set<(t: ChartType) => void>();
function broadcastPref(t: ChartType) {
  localStorage.setItem(STORAGE_KEY, t);
  listeners.forEach((fn) => fn(t));
}

export interface UniversalChartProps {
  data?: TradeData[];
  title?: string;
  height?: number;
  showVolume?: boolean;
  defaultType?: ChartType;
  timePeriods?: string[];
  defaultPeriod?: string;
  color?: string;
  formatValue?: (v: number) => string;
  showToggle?: boolean;
  showTimePeriods?: boolean;
  gradientId?: string;
}

const UniversalChart = ({
  data,
  title,
  height = 220,
  showVolume = false,
  timePeriods,
  defaultPeriod,
  color = "#ff9503",
  formatValue,
  showToggle = true,
  showTimePeriods = true,
  gradientId
}: UniversalChartProps) => {
  const [chartType, setChartType] = useState<ChartType>(getStoredPref);
  const [period, setPeriod] = useState(defaultPeriod || (timePeriods?.[0] ?? "1Y"));

  // Sync across all chart instances
  useEffect(() => {
    const handler = (t: ChartType) => setChartType(t);
    listeners.add(handler);
    return () => {listeners.delete(handler);};
  }, []);

  const handleToggle = useCallback((t: ChartType) => {
    broadcastPref(t);
  }, []);

  // Use provided data or generate sample
  const rawData = useMemo(() => data && data.length > 0 ? data : generateSampleTradeData(), [data]);

  // Filter by period
  const filteredData = useMemo(() => {
    return showTimePeriods ? filterByPeriod(rawData, period) : rawData;
  }, [rawData, period, showTimePeriods]);

  // Build candles from filtered data
  const candles = useMemo(() => buildWeeklyCandles(filteredData), [filteredData]);

  // Build step line data
  const stepData = useMemo(() => buildStepLineData(filteredData), [filteredData]);

  // Line chart data
  const lineData = useMemo(() => {
    return filteredData.map((d) => ({
      date: d.date.slice(5), // MM-DD
      price: d.close ?? d.price,
      volume: d.volume
    }));
  }, [filteredData]);

  const fmt = formatValue || ((v: number) => formatKwacha(v));
  const gid = gradientId || `uc-grad-${Math.random().toString(36).slice(2, 8)}`;

  const [minVal, maxVal] = useMemo(() => {
    let prices: number[];
    if (chartType === "candlestick") {
      prices = candles.flatMap((c) => [c.high, c.low]);
    } else if (chartType === "stepline") {
      prices = stepData.map((d) => d.value);
    } else {
      prices = lineData.map((d) => d.price);
    }
    if (!prices.length) return [0, 100];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min) * 0.05 || 1;
    return [min - pad, max + pad];
  }, [chartType, candles, lineData, stepData]);

  return (
    <div>
      {/* Header row: title + toggle + time periods */}
      {(showToggle || showTimePeriods && timePeriods) &&
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          {title && <h4 className="text-sm font-medium text-primary-foreground">{title}</h4>}
          <div className="flex items-center gap-2 ml-auto">
            {showTimePeriods && timePeriods &&
          <div className="flex gap-1">
                {timePeriods.map((t) =>
            <button key={t} onClick={() => setPeriod(t)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${period === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {t}
                  </button>
            )}
              </div>
          }
            {showToggle &&
          <div className="flex bg-secondary rounded-lg p-0.5 gap-0.5">
                <button
              onClick={() => handleToggle("line")}
              title="Trend View"
              className={`p-1.5 rounded-md transition-all ${chartType === "line" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <TrendingUp className="w-3.5 h-3.5" />
                </button>
                <button
              onClick={() => handleToggle("candlestick")}
              title="Detail View"
              className={`p-1.5 rounded-md transition-all ${chartType === "candlestick" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <BarChart2 className="w-3.5 h-3.5" />
                </button>
                <button
              onClick={() => handleToggle("stepline")}
              title="Truth View"
              className={`p-1.5 rounded-md transition-all ${chartType === "stepline" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <GitCommitHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
          }
          </div>
        </div>
      }

      {/* Chart area */}
      <div style={{ height }}>
        {chartType === "line" ?
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={lineData}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(205, 18%, 50%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(205, 18%, 50%)" }} axisLine={false} tickLine={false} domain={[minVal, maxVal]} tickFormatter={fmt} />
              <Tooltip
              contentStyle={{ background: "hsl(210, 28%, 11%)", border: "1px solid hsl(210, 22%, 16%)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [fmt(v), "Price"]} />
              <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2} fill={`url(#${gid})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer> :

        chartType === "stepline" ?
        <StepLineView stepData={stepData} height={height} minVal={minVal} maxVal={maxVal} fmt={fmt} /> :

        <CandlestickView candles={candles} height={height} minVal={minVal} maxVal={maxVal} fmt={fmt} />
        }
      </div>
    </div>);
};

// Step Line sub-component
const StepLineView = ({ stepData, height, minVal, maxVal, fmt





}: {stepData: StepPoint[];height: number;minVal: number;maxVal: number;fmt: (v: number) => string;}) => {
  const chartData = useMemo(() => stepData.map((d) => ({
    ...d,
    date: d.time.slice(5)
  })), [stepData]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <defs>
          <linearGradient id="step-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={STEP_ACTIVE_COLOR} stopOpacity={0.15} />
            <stop offset="95%" stopColor={STEP_ACTIVE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(205, 18%, 50%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: "hsl(205, 18%, 50%)" }} axisLine={false} tickLine={false} domain={[minVal, maxVal]} tickFormatter={fmt} />
        <Tooltip
          contentStyle={{ background: "hsl(210, 28%, 11%)", border: "1px solid hsl(210, 22%, 16%)", borderRadius: 8, fontSize: 12 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            if (!d) return null;
            return (
              <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="text-foreground font-semibold mb-1">Week of: {d.time || label}</p>
                <p className="text-muted-foreground">Price: {fmt(d.value)}</p>
                <p className={d.isFlat ? "text-muted-foreground" : "text-primary"}>
                  {d.isFlat ? "No trades (carried forward)" : "Active trading week"}
                </p>
              </div>);

          }} />
        
        <Line
          type="stepAfter"
          dataKey="value"
          stroke={STEP_ACTIVE_COLOR}
          strokeWidth={2}
          dot={(props: any) => {
            const { cx, cy, payload } = props;
            if (!payload) return null;
            return (
              <circle
                cx={cx} cy={cy} r={payload.isFlat ? 0 : 3}
                fill={payload.isFlat ? STEP_FLAT_COLOR : STEP_ACTIVE_COLOR}
                stroke={payload.isFlat ? "none" : STEP_ACTIVE_COLOR}
                strokeWidth={1} />);


          }}
          activeDot={{ r: 4, fill: STEP_ACTIVE_COLOR, stroke: "#fff", strokeWidth: 1 }} />
        
      </LineChart>
    </ResponsiveContainer>);

};

// Candlestick sub-component using Recharts ComposedChart with custom Bar shape
const CandlestickView = ({ candles, height, minVal, maxVal, fmt
}: {candles: {time: string;open: number;high: number;low: number;close: number;volume: number;isFlat: boolean;}[];height: number;minVal: number;maxVal: number;fmt: (v: number) => string;}) => {
  const chartData = useMemo(() => candles.map((c) => ({
    ...c,
    date: c.time.slice(5)
  })), [candles]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(205, 18%, 50%)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: "hsl(205, 18%, 50%)" }} axisLine={false} tickLine={false} domain={[minVal, maxVal]} tickFormatter={fmt} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            if (!d) return null;
            const isBull = d.close >= d.open;
            const changePct = d.open > 0 ? (d.close - d.open) / d.open * 100 : 0;
            return (
              <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="text-foreground font-semibold mb-1">Week of: {d.time || label}</p>
                <p className="text-muted-foreground">Open: {fmt(d.open)}</p>
                <p className="text-muted-foreground">High: {fmt(d.high)}</p>
                <p className="text-muted-foreground">Low: {fmt(d.low)}</p>
                <p className="font-semibold" style={{ color: isBull ? BULL_COLOR : BEAR_COLOR }}>Close: {fmt(d.close)}</p>
                <p className="text-muted-foreground">Volume: {d.volume.toLocaleString()}</p>
                <p className={changePct >= 0 ? "text-success" : "text-destructive"}>
                  Change: {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                </p>
              </div>);
          }} />
        <Bar
          dataKey="high"
          fill="transparent"
          isAnimationActive={false}
          shape={(props: any) => {
            const { x, width, payload, background } = props;
            if (!payload) return null;
            const { open, close, high, low, isFlat } = payload;
            const isBull = close >= open;
            const color = isFlat ? "#4b5563" : isBull ? BULL_COLOR : BEAR_COLOR;

            const yScale = (val: number) => {
              if (background) {
                const { y: bgY, height: bgH } = background;
                return bgY + bgH - (val - minVal) / (maxVal - minVal) * bgH;
              }
              return 0;
            };

            const bodyTop = yScale(Math.max(open, close));
            const bodyBottom = yScale(Math.min(open, close));
            const wickTop = yScale(high);
            const wickBottom = yScale(low);
            const bodyH = Math.max(bodyBottom - bodyTop, 1);
            const cx = x + width / 2;
            const bw = Math.max(width * 0.6, 3);

            return (
              <g>
                <line x1={cx} y1={wickTop} x2={cx} y2={wickBottom} stroke={color} strokeWidth={1} />
                <rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH}
                fill={color} stroke={color} strokeWidth={1} rx={1} />
              </g>);
          }}
          background={{ fill: "transparent" }} />
      </ComposedChart>
    </ResponsiveContainer>);
};

export default UniversalChart;