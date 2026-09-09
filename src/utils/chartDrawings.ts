import { Drawing } from '@/hooks/useChartAnalysis';

const PRIMARY = '#06b6d4';
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ef4444'];

export function renderDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  w: number,
  h: number,
  isSelected: boolean,
  priceRange: { min: number; max: number },
  dateRange: { start: number; end: number }
) {
  const pts = drawing.pts.map(p => ({ x: p.x * w, y: p.y * h }));
  ctx.save();

  if (isSelected) {
    ctx.shadowColor = PRIMARY;
    ctx.shadowBlur = 8;
  }

  ctx.strokeStyle = PRIMARY;
  ctx.lineWidth = isSelected ? 2 : 1.5;
  ctx.setLineDash([]);

  switch (drawing.tool) {
    case 'trendline': {
      if (pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      break;
    }
    case 'hline': {
      if (pts.length < 1) break;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, pts[0].y);
      ctx.lineTo(w, pts[0].y);
      ctx.stroke();
      // Price label
      const price = priceRange.max - (pts[0].y / h) * (priceRange.max - priceRange.min);
      ctx.fillStyle = PRIMARY;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(`K${price.toFixed(2)}`, w - 65, pts[0].y - 4);
      break;
    }
    case 'vline': {
      if (pts.length < 1) break;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, 0);
      ctx.lineTo(pts[0].x, h);
      ctx.stroke();
      break;
    }
    case 'rect': {
      if (pts.length < 2) break;
      const [a, b] = pts;
      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      break;
    }
    case 'fib': {
      if (pts.length < 2) break;
      const [a, b] = pts;
      FIB_LEVELS.forEach((level, i) => {
        const y = a.y + (b.y - a.y) * level;
        ctx.strokeStyle = FIB_COLORS[i];
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(Math.min(a.x, b.x), y);
        ctx.lineTo(Math.max(a.x, b.x), y);
        ctx.stroke();
        ctx.fillStyle = FIB_COLORS[i];
        ctx.font = '9px Inter, sans-serif';
        const price = priceRange.max - (y / h) * (priceRange.max - priceRange.min);
        ctx.fillText(`${(level * 100).toFixed(1)}% — K${price.toFixed(2)}`, Math.max(a.x, b.x) + 4, y + 3);
      });
      break;
    }
    case 'arrow': {
      if (pts.length < 2) break;
      const [a, b] = pts;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const headLen = 10;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - headLen * Math.cos(angle - Math.PI / 6), b.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - headLen * Math.cos(angle + Math.PI / 6), b.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case 'text': {
      if (pts.length < 1 || !drawing.text) break;
      ctx.fillStyle = '#f9fafb';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(drawing.text, pts[0].x, pts[0].y);
      if (isSelected) {
        const metrics = ctx.measureText(drawing.text);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = PRIMARY;
        ctx.strokeRect(pts[0].x - 2, pts[0].y - 14, metrics.width + 4, 18);
      }
      break;
    }
  }

  // Selection handles
  if (isSelected && pts.length > 0) {
    ctx.fillStyle = PRIMARY;
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}

export function computeIndicator(
  type: string,
  data: { close: number }[],
  period: number
): number[] {
  if (type === 'MA' || type === 'EMA') {
    if (type === 'MA') {
      return data.map((_, i) => {
        if (i < period - 1) return NaN;
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
        return sum / period;
      });
    }
    // EMA
    const k = 2 / (period + 1);
    const result: number[] = [data[0].close];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i].close * k + result[i - 1] * (1 - k));
    }
    return result;
  }
  if (type === 'RSI') {
    const result: number[] = new Array(data.length).fill(NaN);
    if (data.length < period + 1) return result;
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
    }
    avgGain /= period; avgLoss /= period;
    result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
      result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return result;
  }
  return [];
}
