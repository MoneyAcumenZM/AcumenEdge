import { useMemo } from "react";
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export interface OHLCPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

const BULL_COLOR = "#ff9503";
const BEAR_COLOR = "#22c55e";

/** Generate OHLC data from a base price with random walk */
export function generateOHLC(basePrice: number, days: number, volatility = 0.02): OHLCPoint[] {
  const points: OHLCPoint[] = [];
  let prevClose = basePrice * 0.9;
  for (let i = 0; i < days; i++) {
    const open = prevClose + (Math.random() - 0.5) * basePrice * volatility * 0.5;
    const move1 = open + (Math.random() - 0.45) * basePrice * volatility * 2;
    const move2 = open + (Math.random() - 0.55) * basePrice * volatility * 2;
    const high = Math.max(open, move1, move2) + Math.random() * basePrice * volatility * 0.3;
    const low = Math.min(open, move1, move2) - Math.random() * basePrice * volatility * 0.3;
    const close = low + Math.random() * (high - low);
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    prevClose = close;
    points.push({
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      open: +open.toFixed(2),
      high: +Math.max(high, open, close).toFixed(2),
      low: +Math.min(low, open, close).toFixed(2),
      close: +close.toFixed(2),
    });
  }
  return points;
}

/** Generate OHLC data for large indices (LASI style) */
export function generateIndexOHLC(baseValue: number, days: number): OHLCPoint[] {
  const points: OHLCPoint[] = [];
  let prevClose = baseValue * 0.85;
  for (let i = 0; i < days; i++) {
    const open = prevClose + (Math.random() - 0.42) * 150;
    const move = (Math.random() - 0.42) * 300;
    const close = open + move;
    const high = Math.max(open, close) + Math.random() * 100;
    const low = Math.min(open, close) - Math.random() * 100;
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    prevClose = close;
    points.push({
      date: `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}`,
      open: Math.round(open),
      high: Math.round(Math.max(high, open, close)),
      low: Math.round(Math.min(low, open, close)),
      close: Math.round(close),
    });
  }
  return points;
}

// Custom candlestick shape
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const { open, close, high, low } = payload;
  const isBull = close >= open;
  const color = isBull ? BULL_COLOR : BEAR_COLOR;

  // Y scale: we need to map prices to pixel positions
  // The bar is rendered between open and close already via the stacked approach,
  // but we use a custom shape for the full candle
  const yScale = props.yAxis;
  if (!yScale) return null;

  const bodyTop = yScale.scale(Math.max(open, close));
  const bodyBottom = yScale.scale(Math.min(open, close));
  const wickTop = yScale.scale(high);
  const wickBottom = yScale.scale(low);
  const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
  const centerX = x + width / 2;

  return (
    <g>
      {/* Wick */}
      <line x1={centerX} y1={wickTop} x2={centerX} y2={wickBottom} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect
        x={x + width * 0.15}
        y={bodyTop}
        width={width * 0.7}
        height={bodyHeight}
        fill={isBull ? color : color}
        stroke={color}
        strokeWidth={0.5}
        rx={1}
      />
    </g>
  );
};

interface CandlestickChartProps {
  data: OHLCPoint[];
  height?: number;
  formatValue?: (v: number) => string;
  tooltipLabel?: string;
}

const CandlestickChart = ({ data, height = 200, formatValue, tooltipLabel = "Price" }: CandlestickChartProps) => {
  // We need a dummy dataKey for the Bar, and render everything via shape
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        // dummy value for bar height - full range
        range: d.high - d.low,
        base: d.low,
      })),
    [data]
  );

  const [minVal, maxVal] = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const d of data) {
      if (d.low < min) min = d.low;
      if (d.high > max) max = d.high;
    }
    const pad = (max - min) * 0.05;
    return [min - pad, max + pad];
  }, [data]);

  const fmt = formatValue || ((v: number) => v.toLocaleString());

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} barCategoryGap="20%">
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "hsl(205, 18%, 50%)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(205, 18%, 50%)" }}
            axisLine={false}
            tickLine={false}
            domain={[minVal, maxVal]}
            tickFormatter={fmt}
            yAxisId="price"
          />
          <Tooltip
            contentStyle={{
              background: "hsl(210, 28%, 11%)",
              border: "1px solid hsl(210, 22%, 16%)",
              borderRadius: 8,
              fontSize: 12,
            }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as OHLCPoint;
              if (!d) return null;
              const isBull = d.close >= d.open;
              return (
                <div
                  style={{
                    background: "hsl(210, 28%, 11%)",
                    border: "1px solid hsl(210, 22%, 16%)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                  }}
                >
                  <p style={{ color: "hsl(200, 20%, 93%)", fontWeight: 600, marginBottom: 4 }}>{label}</p>
                  <p style={{ color: "hsl(205, 18%, 50%)" }}>O: {fmt(d.open)}</p>
                  <p style={{ color: "hsl(205, 18%, 50%)" }}>H: {fmt(d.high)}</p>
                  <p style={{ color: "hsl(205, 18%, 50%)" }}>L: {fmt(d.low)}</p>
                  <p style={{ color: isBull ? BULL_COLOR : BEAR_COLOR, fontWeight: 600 }}>
                    C: {fmt(d.close)}
                  </p>
                </div>
              );
            }}
          />
          {/* Invisible bars just to establish the coordinate system, real rendering via shape */}
          <Bar dataKey="range" yAxisId="price" barSize={8} fill="transparent" isAnimationActive={false}>
            {chartData.map((entry, index) => {
              const isBull = entry.close >= entry.open;
              return (
                <Cell
                  key={index}
                  fill="transparent"
                />
              );
            })}
          </Bar>
          {/* Custom candlestick overlay using a second bar with shape */}
        </ComposedChart>
      </ResponsiveContainer>
      {/* SVG overlay approach - render candles manually */}
    </div>
  );
};

// Better approach: use a simple SVG-based candlestick within ResponsiveContainer
export const CandlestickChartSVG = ({ data, height = 200, formatValue, tooltipLabel = "Price" }: CandlestickChartProps) => {
  const fmt = formatValue || ((v: number) => v.toLocaleString());
  
  const [minVal, maxVal] = useMemo(() => {
    if (!data.length) return [0, 100];
    let min = Infinity, max = -Infinity;
    for (const d of data) {
      if (d.low < min) min = d.low;
      if (d.high > max) max = d.high;
    }
    const pad = (max - min) * 0.08 || 1;
    return [min - pad, max + pad];
  }, [data]);

  // Use recharts ComposedChart with a custom rendering approach
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "hsl(205, 18%, 50%)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(205, 18%, 50%)" }}
            axisLine={false}
            tickLine={false}
            domain={[minVal, maxVal]}
            tickFormatter={fmt}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as OHLCPoint;
              if (!d) return null;
              const isBull = d.close >= d.open;
              return (
                <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
                  <p className="text-foreground font-semibold mb-1">{label}</p>
                  <p className="text-muted-foreground">Open: {fmt(d.open)}</p>
                  <p className="text-muted-foreground">High: {fmt(d.high)}</p>
                  <p className="text-muted-foreground">Low: {fmt(d.low)}</p>
                  <p className="font-semibold" style={{ color: isBull ? BULL_COLOR : BEAR_COLOR }}>
                    Close: {fmt(d.close)}
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="high"
            fill="transparent"
            isAnimationActive={false}
            shape={(props: any) => {
              const { x, y, width, payload, background } = props;
              if (!payload) return null;
              const { open, close, high, low } = payload;
              const isBull = close >= open;
              const color = isBull ? BULL_COLOR : BEAR_COLOR;

              // Get y-axis scale from the chart
              const yScale = (val: number) => {
                const chartHeight = props.height || 200;
                // background gives us the full area
                if (background) {
                  const { y: bgY, height: bgH } = background;
                  return bgY + bgH - ((val - minVal) / (maxVal - minVal)) * bgH;
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
                  <rect
                    x={cx - bw / 2}
                    y={bodyTop}
                    width={bw}
                    height={bodyH}
                    fill={color}
                    stroke={color}
                    strokeWidth={1}
                    rx={1}
                  />
                </g>
              );
            }}
            background={{ fill: "transparent" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CandlestickChart;
