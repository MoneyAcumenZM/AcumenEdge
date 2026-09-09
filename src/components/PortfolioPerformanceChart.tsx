import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { usePortfolioSnapshots } from '@/hooks/useSupabaseQuery';
import { formatZMW } from '@/lib/tradingUtils';

const ranges = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

const PortfolioPerformanceChart = () => {
  const [selectedRange, setSelectedRange] = useState(7);
  const { data: snapshots = [], isLoading } = usePortfolioSnapshots(selectedRange);

  const chartData = useMemo(() =>
    snapshots.map((s: any) => ({
      date: new Date(s.snapshot_date).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short' }),
      value: Number(s.total_value),
    })),
    [snapshots]
  );

  const pctChange = useMemo(() => {
    if (chartData.length < 2) return 0;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [chartData]);

  const isPositive = pctChange >= 0;

  if (isLoading) return null;

  if (chartData.length < 7) {
    return (
      <div className="bg-card rounded-xl p-6 text-center space-y-3">
        <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          Performance history will appear here after your first week of trading.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">Portfolio Performance</h3>
        <div className="flex gap-1">
          {ranges.map(r => (
            <button
              key={r.days}
              onClick={() => setSelectedRange(r.days)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedRange === r.days
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold flex items-center gap-1 ${isPositive ? 'text-success' : 'text-destructive'}`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {isPositive ? '+' : ''}{pctChange.toFixed(2)}%
        </span>
        <span className="text-xs text-muted-foreground">past {selectedRange} days</span>
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              formatter={(val: number) => [formatZMW(val), 'Value']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={isPositive ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PortfolioPerformanceChart;
