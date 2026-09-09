import { Drawing } from '@/hooks/useChartAnalysis';

export function hitTestDrawing(
  drawing: Drawing,
  clickX: number,
  clickY: number,
  canvasWidth: number,
  canvasHeight: number,
  threshold = 10
): boolean {
  const pts = drawing.pts.map(p => ({ x: p.x * canvasWidth, y: p.y * canvasHeight }));

  switch (drawing.tool) {
    case 'hline': {
      const y = pts[0]?.y ?? 0;
      return Math.abs(clickY - y) < threshold;
    }
    case 'vline': {
      const x = pts[0]?.x ?? 0;
      return Math.abs(clickX - x) < threshold;
    }
    case 'trendline':
    case 'arrow': {
      if (pts.length < 2) return false;
      return distToSegment(clickX, clickY, pts[0], pts[1]) < threshold;
    }
    case 'rect': {
      if (pts.length < 2) return false;
      const [a, b] = pts;
      const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
      const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
      return clickX >= minX - threshold && clickX <= maxX + threshold && clickY >= minY - threshold && clickY <= maxY + threshold;
    }
    case 'fib': {
      if (pts.length < 2) return false;
      const [a, b] = pts;
      const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      return fibLevels.some(level => {
        const y = a.y + (b.y - a.y) * level;
        return Math.abs(clickY - y) < threshold && clickX >= Math.min(a.x, b.x) - threshold && clickX <= Math.max(a.x, b.x) + threshold;
      });
    }
    case 'text': {
      if (pts.length < 1) return false;
      return Math.abs(clickX - pts[0].x) < 50 && Math.abs(clickY - pts[0].y) < 20;
    }
    default:
      return false;
  }
}

function distToSegment(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}
