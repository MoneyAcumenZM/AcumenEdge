import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStocks } from '@/hooks/useSupabaseQuery';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { useStockPrice } from '@/hooks/useMarketData';
import { formatZMW, formatPrice } from '@/lib/display/formatters';
import { generateStockTradeData } from '@/utils/buildCandles';
import { useChartAnalysis, DrawingTool, Drawing } from '@/hooks/useChartAnalysis';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { hitTestDrawing } from '@/utils/chartHitTest';
import { DEFAULT_INDICATORS, IndicatorConfig, computeAllIndicators } from '@/utils/chartIndicators';
import StockLogo from '@/components/StockLogo';
import {
  ArrowLeft, Camera, Plus, Bell, MousePointer2, Crosshair, TrendingUp, Minus, ArrowUpRight,
  Square, Type, Trash2, PlusCircle, Settings, X, ZoomIn, ZoomOut,
  BarChart2, GitCommitHorizontal
} from 'lucide-react';

/* ─── Custom SVG Icons ─────────────────────────────────── */
const CompassIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
  </svg>
);

const FibIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="2" y1="4" x2="22" y2="4" />
    <line x1="2" y1="8.7" x2="22" y2="8.7" strokeDasharray="3 2" />
    <line x1="2" y1="12" x2="22" y2="12" strokeDasharray="3 2" />
    <line x1="2" y1="15.3" x2="22" y2="15.3" strokeDasharray="3 2" />
    <line x1="2" y1="20" x2="22" y2="20" />
    <text x="23" y="5" fontSize="5" fill="currentColor" stroke="none">0</text>
    <text x="23" y="13" fontSize="5" fill="currentColor" stroke="none">.5</text>
    <text x="23" y="21" fontSize="5" fill="currentColor" stroke="none">1</text>
  </svg>
);

const VLineIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="2" x2="12" y2="22" />
  </svg>
);

/* ─── Drawing color palette ────────────────────────────── */
const DRAWING_COLORS = [
  { label: 'Orange', value: '#ff9503' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'White', value: '#f9fafb' },
  { label: 'Orange', value: '#f97316' },
];

/* ─── Tool config ──────────────────────────────────────── */
const TOOLS: { tool: DrawingTool; icon: any; label: string; isCustomSvg?: boolean }[] = [
  { tool: 'cursor', icon: MousePointer2, label: 'Cursor' },
  { tool: 'crosshair', icon: Crosshair, label: 'Crosshair' },
  { tool: 'trendline', icon: TrendingUp, label: 'Trend Line' },
  { tool: 'hline', icon: Minus, label: 'Horizontal Line' },
  { tool: 'rect', icon: Square, label: 'Rectangle' },
  { tool: 'fib', icon: FibIcon, label: 'Fibonacci', isCustomSvg: true },
  { tool: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  { tool: 'text', icon: Type, label: 'Text Label' },
  { tool: 'vline', icon: VLineIcon, label: 'Vertical Line', isCustomSvg: true },
];

const TIME_PERIODS = ['1M', '3M', '6M', '1Y', '3Y', '5Y'];
const CHART_TYPES: { key: 'line' | 'candlestick' | 'stepline'; icon: any; label: string }[] = [
  { key: 'line', icon: TrendingUp, label: 'Area' },
  { key: 'candlestick', icon: BarChart2, label: 'Candlestick' },
  { key: 'stepline', icon: GitCommitHorizontal, label: 'Step Line' },
];

const TOOL_CURSORS: Record<string, string> = {
  cursor: 'default', crosshair: 'crosshair', trendline: 'crosshair',
  hline: 'row-resize', vline: 'col-resize', rect: 'crosshair',
  fib: 'crosshair', arrow: 'crosshair', text: 'text',
};

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ['#22c55e', '#a3e635', '#facc15', '#fb923c', '#f87171', '#c084fc', '#22c55e'];

/* ─── Shared chart metrics (ref) ───────────────────────── */
interface ChartMetrics {
  lo: number; hi: number;
  padT: number; padB: number; padL: number; padR: number;
  cW: number; n: number; W: number; H: number;
  visibleData: { o: number; h: number; l: number; c: number; vol: number; date: string }[];
}

const emptyMetrics: ChartMetrics = { lo: 0, hi: 100, padT: 20, padB: 28, padL: 10, padR: 10, cW: 10, n: 0, W: 800, H: 400, visibleData: [] };

/* ─── Helpers ──────────────────────────────────────────── */
function p2y(p: number, lo: number, hi: number, H: number, padT: number, padB: number) {
  return padT + (1 - (p - lo) / (hi - lo)) * (H - padT - padB);
}
function y2p(y: number, lo: number, hi: number, H: number, padT: number, padB: number) {
  return hi - ((y - padT) / (H - padT - padB)) * (hi - lo);
}

/* ════════════════════════════════════════════════════════ */
const AnalysisPage = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { data: allStocks = [] } = useStocks();
  const security = (allStocks as any[]).find((s: any) => s.symbol === symbol);

  const analysis = useChartAnalysis();
  const alerts = usePriceAlerts(symbol || '');

  /* ─── State ──────────────────────────────────────────── */
  const [period, setPeriod] = useState('1Y');
  const [chartType, setChartType] = useState<'line' | 'candlestick' | 'stepline'>('candlestick');
  const [stockSelectorOpen, setStockSelectorOpen] = useState(false);
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDirection, setAlertDirection] = useState<'above' | 'below' | 'at'>('above');
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [actionMenu, setActionMenu] = useState<{ drawingId: string; x: number; y: number } | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [, forceRender] = useState(0);

  /* ─── Refs ───────────────────────────────────────────── */
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartMetricsRef = useRef<ChartMetrics>(emptyMetrics);
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const chartDirtyRef = useRef(true);
  const chartRafRef = useRef(0);
  const drawingStartRef = useRef<{ x: number; y: number } | null>(null);
  const showCrosshairRef = useRef(false);
  const movingDrawingRef = useRef<{ drawing: Drawing; anchor: { dx: number; dy: number } } | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, offset: 0 });

  /* ─── Portrait check ─────────────────────────────────── */
  useEffect(() => {
    const check = () => setIsPortrait(window.innerWidth < 768 && window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    try { (screen.orientation as any)?.lock?.('landscape'); } catch {}
    return () => { try { (screen.orientation as any)?.unlock?.(); } catch {} };
  }, []);

  useEffect(() => { if (symbol) analysis.loadDrawings(symbol); }, [symbol]);
  useEffect(() => { if (symbol) analysis.saveDrawings(symbol); }, [analysis.drawings, symbol]);
  useEffect(() => { if (!localStorage.getItem('hasSeenAnalysisTutorial')) setShowTutorial(true); }, []);

  /* ─── Trade data from Supabase ─────────────────────── */
  const { data: priceHistory = [] } = usePriceHistory(symbol, period);
  const tradeData = useMemo(() => {
    if (priceHistory.length > 1) return priceHistory;
    // Fallback: generate sample data from current price if no history yet
    if (!security) return [];
    const basePrice = security.last_price ?? 10;
    const months = period === '1M' ? 1 : period === '3M' ? 3 : period === '6M' ? 6 : period === '1Y' ? 12 : period === '3Y' ? 36 : 60;
    return generateStockTradeData(basePrice, months);
  }, [priceHistory, security, period]);

  /* ─── Visible data with zoom/pan ─────────────────────── */
  const visibleData = useMemo(() => {
    if (!tradeData.length) return [];
    const cnt = Math.max(20, Math.floor(tradeData.length / zoom));
    const maxP = Math.max(0, tradeData.length - cnt);
    const off = Math.max(0, Math.min(maxP, panOffset));
    const slice = tradeData.slice(Math.max(0, tradeData.length - cnt - off), tradeData.length - off || undefined);
    return slice.map(d => ({
      o: d.open ?? d.price, h: d.high ?? d.price,
      l: d.low ?? d.price, c: d.close ?? d.price,
      vol: d.volume, date: d.date,
    }));
  }, [tradeData, zoom, panOffset]);

  /* ═══════════════════════════════════════════════════════
     CHART CANVAS RENDER (bottom layer — static)
     ═══════════════════════════════════════════════════════ */
  const renderChartCanvas = useCallback(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas || !visibleData.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const data = visibleData;
    const n = data.length;
    if (n < 2) return;

    const padL = 10, padR = 10, padT = 20, padB = 28;
    const cW = (W - padL - padR) / n;

    let lo = Infinity, hi = -Infinity;
    data.forEach(c => { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; });
    const rng = hi - lo; lo -= rng * 0.06; hi += rng * 0.06;

    const isIndex = symbol === 'LASI';
    if (!isIndex) hi = Math.min(hi, 1000);

    chartMetricsRef.current = { lo, hi, padT, padB, padL, padR, cW, n, W, H, visibleData: data };

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = padT + (i / 5) * (H - padT - padB);
      ctx.strokeStyle = '#1a2332';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = '#374151'; ctx.font = '10px Inter, system-ui';
      ctx.fillText(`K${y2p(y, lo, hi, H, padT, padB).toFixed(2)}`, 3, y - 3);
    }

    // Date labels
    const vs = Math.max(1, Math.floor(n / 7));
    for (let i = 0; i < n; i += vs) {
      const x = padL + (i + 0.5) * cW;
      ctx.strokeStyle = '#1a2332';
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
      const d2 = new Date(data[i].date);
      ctx.fillStyle = '#4b5563'; ctx.font = '9px Inter, system-ui';
      ctx.fillText(d2.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), x - 14, H - 8);
    }

    // Compute indicators
    const indData = computeAllIndicators(
      data.map(d => ({ open: d.o, high: d.h, low: d.l, close: d.c, volume: d.vol })),
      indicators
    );

    // BB fill
    if (indData['BB_upper'] && indData['BB_lower']) {
      const bb_up = indData['BB_upper'], bb_lo = indData['BB_lower'];
      ['BB_upper', 'BB_lower'].forEach(key => {
        ctx.beginPath(); ctx.strokeStyle = 'rgba(139,92,246,.4)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        let s = false;
        indData[key].forEach((v, i) => { if (isNaN(v)) return; const x = padL + (i + .5) * cW, y = p2y(v, lo, hi, H, padT, padB); s ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), s = true); });
        ctx.stroke(); ctx.setLineDash([]);
      });
      ctx.beginPath();
      let s = false;
      bb_up.forEach((v, i) => { if (isNaN(v)) return; const x = padL + (i + .5) * cW, y = p2y(v, lo, hi, H, padT, padB); s ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), s = true); });
      for (let i = bb_lo.length - 1; i >= 0; i--) { if (isNaN(bb_lo[i])) continue; const x = padL + (i + .5) * cW, y = p2y(bb_lo[i], lo, hi, H, padT, padB); ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fillStyle = 'rgba(139,92,246,.04)'; ctx.fill();
    }

    // ── CHART TYPES ──
    if (chartType === 'candlestick') {
      data.forEach((c, i) => {
        const x = padL + (i + 0.5) * cW;
        const bW = Math.max(2, cW * 0.55);
        const up = c.c >= c.o;
        const candleColor = up ? '#ff9503' : '#22c55e';
        ctx.strokeStyle = candleColor; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, p2y(c.h, lo, hi, H, padT, padB)); ctx.lineTo(x, p2y(c.l, lo, hi, H, padT, padB)); ctx.stroke();
        const yO = p2y(c.o, lo, hi, H, padT, padB), yC = p2y(c.c, lo, hi, H, padT, padB);
        ctx.fillStyle = candleColor;
        ctx.fillRect(x - bW / 2, Math.min(yO, yC), bW, Math.max(2, Math.abs(yC - yO)));
      });
    } else if (chartType === 'line') {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(255,149,3,0.3)');
      grad.addColorStop(0.65, 'rgba(255,149,3,0.08)');
      grad.addColorStop(1, 'rgba(13,17,23,0.0)');
      ctx.beginPath();
      data.forEach((c, i) => {
        const x = padL + (i + .5) * cW, y = p2y(c.c, lo, hi, H, padT, padB);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(padL + (n - .5) * cW, H - padB);
      ctx.lineTo(padL + .5 * cW, H - padB);
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath();
      data.forEach((c, i) => {
        const x = padL + (i + .5) * cW, y = p2y(c.c, lo, hi, H, padT, padB);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#ff9503'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    } else {
      // Step line with dots
      ctx.beginPath(); ctx.strokeStyle = '#ff9503'; ctx.lineWidth = 2;
      data.forEach((c, i) => {
        const x = padL + (i + .5) * cW, y = p2y(c.c, lo, hi, H, padT, padB);
        if (i === 0) { ctx.moveTo(x, y); } else {
          const px = padL + (i - .5) * cW;
          ctx.lineTo(px, y);
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      data.forEach((c, i) => {
        const x = padL + (i + .5) * cW, y = p2y(c.c, lo, hi, H, padT, padB);
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff9503'; ctx.fill();
        ctx.strokeStyle = '#0d1117'; ctx.lineWidth = 1.5; ctx.stroke();
      });
    }

    // MA/EMA/VWAP overlay indicators
    for (const ind of indicators) {
      if (!ind.enabled || ind.type === 'RSI' || ind.type === 'BB' || ind.type === 'Volume') continue;
      const values = indData[ind.label];
      if (!values) continue;
      ctx.strokeStyle = ind.color; ctx.lineWidth = 1.4;
      ctx.setLineDash(ind.type === 'VWAP' ? [4, 3] : []);
      ctx.beginPath();
      let started = false;
      values.forEach((v, i) => {
        if (isNaN(v)) return;
        const x = padL + (i + .5) * cW, y = p2y(v, lo, hi, H, padT, padB);
        started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), started = true);
      });
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Volume bars
    if (indData['Volume']) {
      const mv = Math.max(...data.map(c => c.vol));
      data.forEach((c, i) => {
        const x = padL + (i + .5) * cW, bH = (c.vol / mv) * (H - padB) * .15;
        ctx.fillStyle = c.c >= c.o ? 'rgba(255,149,3,0.2)' : 'rgba(34,197,94,0.2)';
        ctx.fillRect(x - cW * .4, H - padB - bH, cW * .8, bH);
      });
    }

    // Committed drawings (non-selected ones on chart canvas)
    analysis.drawings.forEach(d => {
      if (d.id === analysis.selectedId) return;
      renderDrawingOnCanvas(ctx, d, W, H, lo, hi, padT, padB, false);
    });

    // Price alert tags on chart
    alerts.activeAlerts.forEach(a => {
      const ay = p2y(a.targetPrice, lo, hi, H, padT, padB);
      if (ay < padT || ay > H - padB) return;
      // Dashed line across chart
      ctx.save();
      ctx.strokeStyle = a.direction === 'above' ? '#22c55e' : a.direction === 'below' ? '#ef4444' : '#f97316';
      ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(padL, ay); ctx.lineTo(W - 80, ay); ctx.stroke();
      ctx.setLineDash([]);
      // Tag pill
      const lbl = `🔔 K${a.targetPrice.toFixed(2)} ${a.direction}`;
      ctx.font = 'bold 9px Inter, system-ui';
      const tw = ctx.measureText(lbl).width + 12;
      ctx.fillStyle = a.direction === 'above' ? 'rgba(34,197,94,0.2)' : a.direction === 'below' ? 'rgba(239,68,68,0.2)' : 'rgba(249,115,22,0.2)';
      ctx.beginPath(); (ctx as any).roundRect?.(W - tw - 82, ay - 8, tw, 16, 3); ctx.fill();
      ctx.strokeStyle = a.direction === 'above' ? '#22c55e' : a.direction === 'below' ? '#ef4444' : '#f97316';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); (ctx as any).roundRect?.(W - tw - 82, ay - 8, tw, 16, 3); ctx.stroke();
      ctx.fillStyle = a.direction === 'above' ? '#22c55e' : a.direction === 'below' ? '#ef4444' : '#f97316';
      ctx.textAlign = 'left';
      ctx.fillText(lbl, W - tw - 76, ay + 3);
      ctx.restore();
    });

    // Price axis: last price highlight
    const last = data[data.length - 1];
    const ly = p2y(last.c, lo, hi, H, padT, padB);
    ctx.fillStyle = '#ff9503';
    ctx.beginPath();
    (ctx as any).roundRect?.(W - 76, ly - 9, 72, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Inter, system-ui';
    ctx.fillText(`K${last.c.toFixed(2)}`, W - 72, ly + 3);
  }, [visibleData, chartType, analysis.drawings, analysis.selectedId, indicators, symbol, alerts.activeAlerts]);

  /* ═══════════════════════════════════════════════════════
     INTERACTION CANVAS RENDER (top layer — 60fps)
     ═══════════════════════════════════════════════════════ */
  const renderInteractionCanvas = useCallback(() => {
    const canvas = interactionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const m = chartMetricsRef.current;
    const mx = mouseRef.current.x, my = mouseRef.current.y;

    // ── Crosshair ──
    if (showCrosshairRef.current && analysis.activeTool === 'crosshair' && m.n > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,149,3,0.35)'; ctx.lineWidth = 0.8; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.stroke();
      ctx.setLineDash([]);

      const hoverPrice = y2p(my, m.lo, m.hi, H, m.padT, m.padB);
      const priceLbl = `K ${hoverPrice.toFixed(2)}`;
      ctx.font = 'bold 10px Inter, system-ui';
      const lblW = ctx.measureText(priceLbl).width + 14;
      ctx.fillStyle = 'rgba(255,149,3,0.9)';
      ctx.beginPath(); (ctx as any).roundRect?.(W - lblW - 2, my - 9, lblW, 18, 3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      ctx.fillText(priceLbl, W - lblW + 5, my + 3);

      const ci = Math.floor((mx - m.padL) / m.cW);
      if (ci >= 0 && ci < m.n) {
        const c = m.visibleData[ci];
        const dateLbl = new Date(c.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        ctx.font = 'bold 9px Inter, system-ui';
        const dW = ctx.measureText(dateLbl).width + 14;
        ctx.fillStyle = 'rgba(255,149,3,0.9)';
        ctx.beginPath(); (ctx as any).roundRect?.(mx - dW / 2, H - m.padB + 2, dW, 14, 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(dateLbl, mx, H - m.padB + 12);
        ctx.textAlign = 'left';

        // ── Floating OHLC tooltip ──
        const BOX_W = 155, BOX_H = 115, OFFSET = 14;
        const flipLeft = mx + OFFSET + BOX_W > W - 80;
        const bx = flipLeft ? mx - OFFSET - BOX_W : mx + OFFSET;
        let by = my - BOX_H / 2;
        if (by < 4) by = 4;
        if (by + BOX_H > H - 4) by = H - BOX_H - 4;

        ctx.fillStyle = 'rgba(13,17,23,0.95)';
        ctx.strokeStyle = 'rgba(255,149,3,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); (ctx as any).roundRect?.(bx, by, BOX_W, BOX_H, 7); ctx.fill(); ctx.stroke();

        ctx.fillStyle = 'rgba(13,17,23,0.95)';
        ctx.beginPath();
        if (!flipLeft) {
          ctx.moveTo(bx, by + BOX_H / 2 - 5); ctx.lineTo(bx - 6, by + BOX_H / 2); ctx.lineTo(bx, by + BOX_H / 2 + 5);
        } else {
          ctx.moveTo(bx + BOX_W, by + BOX_H / 2 - 5); ctx.lineTo(bx + BOX_W + 6, by + BOX_H / 2); ctx.lineTo(bx + BOX_W, by + BOX_H / 2 + 5);
        }
        ctx.fill();

        let lx = bx + 12, ly2 = by + 18;
        ctx.font = '10px Inter, system-ui'; ctx.fillStyle = '#6b7280'; ctx.textAlign = 'left';
        ctx.fillText(dateLbl, lx, ly2); ly2 += 14;
        ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(bx + 8, ly2 - 4); ctx.lineTo(bx + BOX_W - 8, ly2 - 4); ctx.stroke();
        ly2 += 4;

        const rows = [
          { label: 'Open', value: `K ${c.o.toFixed(2)}`, color: '#f9fafb' },
          { label: 'High', value: `K ${c.h.toFixed(2)}`, color: '#22c55e' },
          { label: 'Low', value: `K ${c.l.toFixed(2)}`, color: '#ef4444' },
          { label: 'Close', value: `K ${c.c.toFixed(2)}`, color: '#ff9503' },
        ];
        rows.forEach(row => {
          ctx.fillStyle = '#6b7280'; ctx.font = '10px Inter, system-ui'; ctx.textAlign = 'left';
          ctx.fillText(row.label, lx, ly2);
          ctx.fillStyle = row.color; ctx.font = 'bold 10px Courier New, monospace'; ctx.textAlign = 'right';
          ctx.fillText(row.value, bx + BOX_W - 12, ly2);
          ctx.textAlign = 'left'; ly2 += 14;
        });
        ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(bx + 8, ly2 - 2); ctx.lineTo(bx + BOX_W - 8, ly2 - 2); ctx.stroke();
        ly2 += 6;
        ctx.fillStyle = '#6b7280'; ctx.font = '10px Inter, system-ui'; ctx.textAlign = 'left';
        ctx.fillText('Price', lx, ly2);
        ctx.fillStyle = '#ff9503'; ctx.font = 'bold 10px Courier New, monospace'; ctx.textAlign = 'right';
        ctx.fillText(`K ${hoverPrice.toFixed(2)}`, bx + BOX_W - 12, ly2);
      }
      ctx.restore();
    }

    // ── Live drawing preview ──
    if (drawingStartRef.current && analysis.activeTool !== 'cursor' && analysis.activeTool !== 'crosshair') {
      const fp = drawingStartRef.current;
      const fpx = fp.x * W, fpy = fp.y * H;
      ctx.save();
      ctx.globalAlpha = 0.8;

      if (analysis.activeTool === 'trendline') {
        ctx.strokeStyle = '#ff9503'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
        ctx.beginPath(); ctx.moveTo(fpx, fpy); ctx.lineTo(mx, my); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#ff9503'; ctx.beginPath(); ctx.arc(fpx, fpy, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff9503'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.stroke();
      } else if (analysis.activeTool === 'rect') {
        const rx = Math.min(fpx, mx), ry = Math.min(fpy, my);
        const rw = Math.abs(mx - fpx), rh = Math.abs(my - fpy);
        ctx.fillStyle = 'rgba(255,149,3,0.05)'; ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = 'rgba(255,149,3,0.65)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.strokeRect(rx, ry, rw, rh); ctx.setLineDash([]);
        ctx.fillStyle = '#6b7280'; ctx.font = '10px Inter, system-ui';
        ctx.fillText(`${Math.round(rw)} × ${Math.round(rh)}`, mx + 8, my - 6);
      } else if (analysis.activeTool === 'arrow') {
        const angle = Math.atan2(my - fpy, mx - fpx);
        ctx.strokeStyle = '#ff9503'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
        ctx.beginPath(); ctx.moveTo(fpx, fpy); ctx.lineTo(mx, my); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#ff9503';
        ctx.beginPath(); ctx.moveTo(mx, my);
        ctx.lineTo(mx - 10 * Math.cos(angle - 0.4), my - 10 * Math.sin(angle - 0.4));
        ctx.lineTo(mx - 10 * Math.cos(angle + 0.4), my - 10 * Math.sin(angle + 0.4));
        ctx.closePath(); ctx.fill();
      } else if (analysis.activeTool === 'fib') {
        ctx.setLineDash([3, 3]);
        FIB_LEVELS.forEach((l, li) => {
          const y = fpy + (my - fpy) * l;
          ctx.strokeStyle = FIB_COLORS[li]; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = FIB_COLORS[li]; ctx.font = '9px Inter, system-ui';
          ctx.fillText(`${(l * 100).toFixed(1)}%`, 6, y - 2);
        });
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // ── Selected drawing highlight ──
    if (analysis.selectedId) {
      const sel = analysis.drawings.find(d => d.id === analysis.selectedId);
      if (sel) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,149,3,0.6)'; ctx.shadowBlur = 10;
        renderDrawingOnCanvas(ctx, sel, W, H, m.lo, m.hi, m.padT, m.padB, true);
        ctx.shadowBlur = 0;
        sel.pts.forEach(pt => {
          ctx.beginPath(); ctx.arc(pt.x * W, pt.y * H, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ff9503'; ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        });
        ctx.restore();
      }
    }

    // ── Moving drawing ──
    const moving = movingDrawingRef.current;
    if (moving) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      renderDrawingOnCanvas(ctx, moving.drawing, W, H, m.lo, m.hi, m.padT, m.padB, false);
      ctx.restore();
    }
  }, [analysis.activeTool, analysis.drawings, analysis.selectedId]);

  /* ─── Schedule interaction render (rAF) ──────────────── */
  const scheduleInteractionRender = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(renderInteractionCanvas);
  }, [renderInteractionCanvas]);

  /* ─── Mark chart dirty ───────────────────────────────── */
  const markChartDirty = useCallback(() => {
    chartDirtyRef.current = true;
    if (chartRafRef.current) cancelAnimationFrame(chartRafRef.current);
    chartRafRef.current = requestAnimationFrame(() => {
      if (chartDirtyRef.current) {
        renderChartCanvas();
        chartDirtyRef.current = false;
        scheduleInteractionRender();
      }
    });
  }, [renderChartCanvas, scheduleInteractionRender]);

  /* ─── Trigger chart redraw on data/settings changes ──── */
  useEffect(() => { markChartDirty(); }, [visibleData, chartType, indicators, analysis.drawings, analysis.selectedId, alerts.activeAlerts]);

  /* ─── Resize observer ────────────────────────────────── */
  useEffect(() => {
    const el = chartCanvasRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => markChartDirty());
    ro.observe(el);
    return () => ro.disconnect();
  }, [markChartDirty]);

  /* ═══════════════════════════════════════════════════════
     POINTER HANDLERS
     ═══════════════════════════════════════════════════════ */
  const getCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = interactionCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ('touches' in e) {
      if (e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      else if (e.changedTouches.length > 0) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
      else return null;
    } else { cx = e.clientX; cy = e.clientY; }
    return { x: cx - rect.left, y: cy - rect.top, w: rect.width, h: rect.height, cx, cy };
  }, []);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const c = getCoords(e);
    if (!c) return;
    if ('touches' in e) e.preventDefault();

    if (movingDrawingRef.current) {
      const mv = movingDrawingRef.current;
      analysis.addDrawing({ tool: mv.drawing.tool, pts: mv.drawing.pts, text: mv.drawing.text, color: mv.drawing.color });
      movingDrawingRef.current = null;
      markChartDirty();
      return;
    }

    if (analysis.activeTool === 'cursor') {
      let found = false;
      for (const d of analysis.drawings) {
        if (hitTestDrawing(d, c.x, c.y, c.w, c.h)) {
          analysis.setSelectedId(d.id);
          setActionMenu({ drawingId: d.id, x: c.cx, y: c.cy });
          setColorPickerOpen(false);
          found = true;
          break;
        }
      }
      if (!found) {
        analysis.setSelectedId(null);
        setActionMenu(null);
        setColorPickerOpen(false);
        isPanningRef.current = true;
        panStartRef.current = { x: c.x, offset: panOffset };
      }
      return;
    }

    if (analysis.activeTool === 'crosshair') return;

    const nx = c.x / c.w, ny = c.y / c.h;
    if (analysis.activeTool === 'hline') { analysis.addDrawing({ tool: 'hline', pts: [{ x: 0, y: ny }] }); return; }
    if (analysis.activeTool === 'vline') { analysis.addDrawing({ tool: 'vline', pts: [{ x: nx, y: 0 }] }); return; }
    if (analysis.activeTool === 'text') { setTextInput({ x: c.x, y: c.y, value: '' }); return; }

    if (!drawingStartRef.current) {
      drawingStartRef.current = { x: nx, y: ny };
    } else {
      analysis.addDrawing({ tool: analysis.activeTool as any, pts: [drawingStartRef.current, { x: nx, y: ny }] });
      drawingStartRef.current = null;
    }
  }, [analysis, getCoords, panOffset, markChartDirty]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const c = getCoords(e);
    if (!c) return;
    if ('touches' in e) e.preventDefault();
    mouseRef.current = { x: c.x, y: c.y };

    showCrosshairRef.current = analysis.activeTool === 'crosshair';

    if (isPanningRef.current && analysis.activeTool === 'cursor') {
      const dx = c.x - panStartRef.current.x;
      const m = chartMetricsRef.current;
      const candleDelta = Math.round(dx / (m.cW || 10));
      setPanOffset(Math.max(0, panStartRef.current.offset + candleDelta));
    }

    if (movingDrawingRef.current) {
      const mv = movingDrawingRef.current;
      const nx = c.x / c.w, ny = c.y / c.h;
      const dx = nx - mv.anchor.dx;
      const dy = ny - mv.anchor.dy;
      mv.drawing = {
        ...mv.drawing,
        pts: mv.drawing.pts.map(p => ({ x: p.x + dx, y: p.y + dy })),
      };
      mv.anchor = { dx: nx, dy: ny };
    }

    if (analysis.activeTool === 'cursor' && !isPanningRef.current) {
      const canvas = interactionCanvasRef.current;
      if (canvas) {
        const hit = analysis.drawings.some(d => hitTestDrawing(d, c.x, c.y, c.w, c.h));
        canvas.style.cursor = hit ? 'pointer' : 'default';
      }
    }

    scheduleInteractionRender();
  }, [analysis, getCoords, scheduleInteractionRender]);

  const handlePointerUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isPanningRef.current = false;
  }, []);

  /* ─── Text submit ────────────────────────────────────── */
  const handleTextSubmit = useCallback(() => {
    if (textInput && textInput.value.trim()) {
      const canvas = interactionCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      analysis.addDrawing({ tool: 'text', pts: [{ x: textInput.x / rect.width, y: textInput.y / rect.height }], text: textInput.value });
    }
    setTextInput(null);
  }, [textInput, analysis]);

  /* ─── Screenshot ─────────────────────────────────────── */
  const handleScreenshot = useCallback(async () => {
    const chart = chartCanvasRef.current;
    if (!chart) return;
    try {
      const merged = document.createElement('canvas');
      merged.width = chart.width; merged.height = chart.height;
      const mctx = merged.getContext('2d')!;
      mctx.drawImage(chart, 0, 0);
      if (interactionCanvasRef.current) mctx.drawImage(interactionCanvasRef.current, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => merged.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      if (navigator.share) {
        const file = new File([blob], `Circle_Analysis_${symbol}_${new Date().toISOString().split('T')[0]}.png`, { type: 'image/png' });
        await navigator.share({ files: [file] });
      } else {
        const a = document.createElement('a'); a.href = url; a.download = `Circle_Analysis_${symbol}_${new Date().toISOString().split('T')[0]}.png`; a.click();
      }
      URL.revokeObjectURL(url);
    } catch {}
  }, [symbol]);

  /* ─── Tool change → cursor ───────────────────────────── */
  const handleToolChange = useCallback((tool: DrawingTool) => {
    analysis.setActiveTool(tool);
    setActionMenu(null);
    setColorPickerOpen(false);
    drawingStartRef.current = null;
    showCrosshairRef.current = false;
    if (interactionCanvasRef.current) {
      interactionCanvasRef.current.style.cursor = TOOL_CURSORS[tool] ?? 'default';
    }
    scheduleInteractionRender();
  }, [analysis, scheduleInteractionRender]);

  /* ─── Move action ────────────────────────────────────── */
  const startMoveDrawing = useCallback((drawingId: string) => {
    const d = analysis.drawings.find(dd => dd.id === drawingId);
    if (!d) return;
    const canvas = interactionCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = mouseRef.current.x / rect.width, ny = mouseRef.current.y / rect.height;
    movingDrawingRef.current = {
      drawing: JSON.parse(JSON.stringify(d)),
      anchor: { dx: nx, dy: ny },
    };
    analysis.removeDrawing(drawingId);
    setActionMenu(null);
    setColorPickerOpen(false);
    if (canvas) canvas.style.cursor = 'grabbing';
    markChartDirty();
  }, [analysis, markChartDirty]);

  /* ─── Change drawing color ───────────────────────────── */
  const changeDrawingColor = useCallback((drawingId: string, color: string) => {
    analysis.updateDrawing(drawingId, { color });
    setColorPickerOpen(false);
    setActionMenu(null);
  }, [analysis]);

  const filteredSecurities = searchQuery
    ? (allStocks as any[]).filter((s: any) => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : (allStocks as any[]);

  const { data: liveSymbol } = useStockPrice(symbol || '');
  // FIX G: read mapped live_price (trade→bid→null). Fall back to Supabase last_price.
  const livePriceValue = (liveSymbol as any)?.live_price ?? null;
  const isLive = (liveSymbol as any)?.is_live === true;
  const price = livePriceValue ?? security?.last_price ?? 0;
  const change = security?.change_percent ?? 0;

  if (!security) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d1117]">
        <div className="text-center">
          <p className="text-muted-foreground">Stock not found</p>
          <button onClick={() => navigate('/charts')} className="mt-4 text-primary text-sm">← Back to Charts</button>
        </div>
      </div>
    );
  }

  if (isPortrait) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0d1117] flex flex-col items-center justify-center gap-6 p-8">
        <div className="w-16 h-16 border-2 border-primary rounded-xl flex items-center justify-center animate-pulse">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff9503" strokeWidth="2">
            <path d="M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z"/>
            <path d="M12 8l4 4-4 4"/>
          </svg>
        </div>
        <p className="text-foreground text-lg font-semibold text-center">Rotate your phone for the best experience</p>
        <p className="text-muted-foreground text-sm text-center">Analysis Mode works best in landscape orientation</p>
      </div>
    );
  }

  /* ─── Tutorial steps ─────────────────────────────────── */
  const tutorialSteps = [
    { title: 'Welcome to Analysis Mode', icon: '🎯', content: 'A professional-grade charting environment with drawing tools, indicators, and real-time analysis. Let\'s walk through everything.' },
    { title: 'Drawing Tools', icon: '✏️', content: 'Use the toolbar on the left to draw on the chart:\n\n• Cursor — Select and move drawings\n• Crosshair — Track price & date\n• Trend Line — Connect two points\n• Horizontal Line — Mark support/resistance\n• Rectangle — Highlight zones\n• Fibonacci — Key retracement levels\n• Arrow — Point out patterns\n• Text — Add notes\n• Vertical Line — Mark time events' },
    { title: 'Chart Types', icon: '📊', content: 'Switch between chart types at the bottom:\n\n• Area — Smooth trend visualization\n• Candlestick — OHLC price action\n• Step Line — Discrete price levels\n\nEach shows the same data differently.' },
    { title: 'Indicators', icon: '📈', content: 'Add technical indicators via the Indicators button:\n\n• MA (20, 50) — Moving averages for trend\n• EMA (12) — Exponential moving average\n• Bollinger Bands — Volatility envelope\n• VWAP — Volume-weighted average\n• RSI — Momentum oscillator\n• Volume — Trading volume bars' },
    { title: 'Price Alerts', icon: '🔔', content: 'Set alerts with the bell icon:\n\n• "Above" — Triggers when price rises past target\n• "Below" — Triggers when price drops below\n• "At this price" — Triggers at exact level\n\nAlerts appear as tagged lines on the chart.' },
    { title: 'Customization', icon: '🎨', content: 'Click any drawing with the Cursor tool to:\n\n• Change Color — Pick from 6 colors\n• Duplicate — Copy the drawing\n• Move — Drag to a new position\n• Delete — Remove from chart\n\nAll drawings are saved automatically.' },
    { title: 'Zoom & Navigate', icon: '🔍', content: 'Use the zoom buttons (+/-) at the bottom right. Drag the chart with the Cursor tool to pan through time. Change timeframes (1M to 5Y) at the bottom.' },
    { title: 'Screenshot & Share', icon: '📷', content: 'Tap the camera icon to capture your analysis as an image. On mobile, it uses the native share sheet. On desktop, it downloads a PNG file.' },
  ];

  const currentTutStep = tutorialSteps[tutorialStep] || tutorialSteps[0];

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col" style={{ animation: 'slideUp 0.3s ease-out' }}>
      {/* Top Bar */}
      <div className="h-11 flex items-center justify-between px-3 border-b border-[#1f2937] shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/charts')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <StockLogo ticker={security.symbol} size="sm" />
            <div>
              <span className="text-sm font-bold text-foreground">{security.symbol}</span>
              <span className="text-xs text-muted-foreground ml-2">{formatZMW(price)}</span>
              <span className={`text-xs ml-1 ${change >= 0 ? 'text-success' : 'text-destructive'}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleScreenshot} className="p-1.5 rounded-lg hover:bg-[#1f2937] text-muted-foreground hover:text-foreground" title="Screenshot">
            <Camera className="w-4 h-4" />
          </button>
          <button onClick={() => setStockSelectorOpen(true)} className="p-1.5 rounded-lg hover:bg-[#1f2937] text-muted-foreground hover:text-foreground" title="Switch Stock">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => setAlertPanelOpen(true)} className="p-1.5 rounded-lg hover:bg-[#1f2937] text-muted-foreground hover:text-foreground relative" title="Price Alerts">
            <Bell className="w-4 h-4" />
            {alerts.activeAlerts.length > 0 && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-destructive" />}
          </button>
          <button onClick={() => { setShowTutorial(true); setTutorialStep(0); }} className="p-1.5 rounded-lg hover:bg-[#1f2937] text-muted-foreground hover:text-foreground" title="Settings & Help">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Left toolbar */}
        <div className="w-11 border-r border-[#1f2937] flex flex-col items-center py-2 gap-1 shrink-0 overflow-y-auto hide-scrollbar">
          {TOOLS.map((t, i) => (
            <div key={t.tool}>
              {i === 2 && <div className="w-6 h-px bg-[#1f2937] my-1" />}
              {i === 8 && <div className="w-6 h-px bg-[#1f2937] my-1" />}
              <button
                onClick={() => handleToolChange(t.tool)}
                className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center transition-colors ${analysis.activeTool === t.tool ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-[#1f2937]'}`}
                title={t.label}
              >
                {t.isCustomSvg ? <t.icon className="w-4 h-4" /> : <t.icon className="w-4 h-4" />}
              </button>
            </div>
          ))}
          <div className="w-6 h-px bg-[#1f2937] my-1" />
          <button
            onClick={() => setClearConfirmOpen(true)}
            className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Clear All"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Chart canvas area — dual canvas stack */}
        <div className="flex-1 relative min-w-0" style={{ touchAction: analysis.activeTool !== 'cursor' ? 'none' : 'auto' }}>
          <canvas ref={chartCanvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 1, pointerEvents: 'none' }} />
          <canvas
            ref={interactionCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 2, cursor: TOOL_CURSORS[analysis.activeTool] ?? 'default' }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={() => { showCrosshairRef.current = false; isPanningRef.current = false; scheduleInteractionRender(); }}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={(e) => { handlePointerUp(e); if (analysis.activeTool === 'crosshair') { showCrosshairRef.current = false; scheduleInteractionRender(); } else { const c = getCoords(e); if (c) handlePointerDown(e); } }}
          />

          {/* Text input overlay */}
          {textInput && (
            <input
              autoFocus
              value={textInput.value}
              onChange={e => setTextInput({ ...textInput, value: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') setTextInput(null); }}
              onBlur={handleTextSubmit}
              className="absolute bg-transparent border-b border-primary text-foreground text-sm px-1 focus:outline-none"
              style={{ left: textInput.x, top: textInput.y - 14, minWidth: 80, zIndex: 10 }}
              placeholder="Type label..."
            />
          )}

          {/* Zoom buttons */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-1" style={{ zIndex: 10 }}>
            <button onClick={() => { setZoom(z => Math.min(z * 1.15, 5)); }} className="w-7 h-7 rounded bg-[#111827] border border-[#1f2937] flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setZoom(z => Math.max(z * 0.87, 0.5)); }} className="w-7 h-7 rounded bg-[#111827] border border-[#1f2937] flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action menu with color picker */}
          {actionMenu && (
            <div className="absolute z-20 bg-[#1a2235] border border-primary/30 rounded-lg shadow-xl overflow-hidden min-w-[140px]"
              style={{ left: Math.min(actionMenu.x, window.innerWidth - 160), top: Math.min(actionMenu.y - 60, window.innerHeight - 200) }}>
              <p className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-[#1f2937] bg-[#111827]">
                {analysis.drawings.find(d => d.id === actionMenu.drawingId)?.tool}
              </p>
              <button onClick={() => setColorPickerOpen(!colorPickerOpen)}
                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-primary/10 hover:text-primary flex items-center gap-2 transition-colors">
                🎨 Change Color
              </button>
              {colorPickerOpen && (
                <div className="px-3 py-2 flex gap-1.5 border-t border-[#1f2937]">
                  {DRAWING_COLORS.map(c => (
                    <button key={c.value} onClick={() => changeDrawingColor(actionMenu.drawingId, c.value)}
                      className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white transition-colors"
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              )}
              <button onClick={() => {
                const d = analysis.drawings.find(dd => dd.id === actionMenu.drawingId);
                if (d) analysis.addDrawing({ tool: d.tool, pts: d.pts.map(p => ({ x: p.x + 0.02, y: p.y + 0.02 })), text: d.text, color: d.color });
                setActionMenu(null); setColorPickerOpen(false);
              }} className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-primary/10 hover:text-primary flex items-center gap-2 transition-colors">
                ⟳ Duplicate
              </button>
              <button onClick={() => {
                startMoveDrawing(actionMenu.drawingId);
              }} className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-primary/10 hover:text-primary flex items-center gap-2 transition-colors">
                ✥ Move
              </button>
              <button onClick={() => {
                analysis.removeDrawing(actionMenu.drawingId);
                setActionMenu(null); setColorPickerOpen(false);
              }} className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors">
                🗑 Delete
              </button>
            </div>
          )}

          {/* Drawing hint */}
          {drawingStartRef.current && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-primary/10 border border-primary/30 text-primary text-[11px] px-3.5 py-1.5 rounded-full pointer-events-none" style={{ zIndex: 10 }}>
              Click to place — click again to finish
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="h-11 flex items-center justify-between px-3 border-t border-[#1f2937] shrink-0">
        <div className="flex items-center gap-1">
          {TIME_PERIODS.map(t => (
            <button key={t} onClick={() => setPeriod(t)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${period === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex bg-[#111827] rounded-lg p-0.5 gap-0.5">
            {CHART_TYPES.map(ct => (
              <button key={ct.key} onClick={() => setChartType(ct.key)}
                className={`p-1.5 rounded-md flex items-center gap-1 text-[10px] font-medium transition-colors ${chartType === ct.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                title={ct.label}>
                <ct.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{ct.label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setIndicatorPanelOpen(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors">
            <PlusCircle className="w-3.5 h-3.5" /> Indicators
          </button>
        </div>
      </div>

      {/* ── Panels ────────────────────────────────────────── */}

      {/* Stock Selector */}
      {stockSelectorOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setStockSelectorOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-[#111827] rounded-t-2xl border-t border-[#1f2937] max-h-[60vh] overflow-hidden flex flex-col animate-slide-up">
            <div className="p-4 border-b border-[#1f2937]">
              <div className="flex justify-center mb-3"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
              <div className="relative">
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search stocks..."
                  className="w-full bg-[#0d1117] rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                <Crosshair className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {filteredSecurities.map((s: any) => {
                const ch = s.change_percent ?? 0;
                return (
                  <button key={s.symbol} onClick={() => {
                    if (symbol) analysis.saveDrawings(symbol);
                    navigate(`/analysis/${s.symbol}`);
                    setStockSelectorOpen(false); setSearchQuery('');
                  }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#1f2937] transition-colors">
                    <StockLogo ticker={s.symbol} size="sm" lazy />
                    <div className="flex-1 text-left min-w-0">
                      <span className="text-sm font-bold text-foreground">{s.symbol}</span>
                      <p className="text-xs text-muted-foreground truncate">{s.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatPrice(s.last_price, s.currency)}</p>
                      <p className={`text-xs ${ch >= 0 ? 'text-success' : 'text-destructive'}`}>{ch >= 0 ? '+' : ''}{ch.toFixed(2)}%</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Alert Panel */}
      {alertPanelOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setAlertPanelOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-[#111827] rounded-t-2xl border-t border-[#1f2937] max-h-[60vh] overflow-y-auto animate-slide-up p-5">
            <div className="flex justify-center mb-3"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
            <h3 className="font-semibold text-foreground mb-3">Price Alerts — {security.symbol}</h3>
            {alerts.activeAlerts.length > 0 ? (
              <div className="space-y-2 mb-4">
                {alerts.activeAlerts.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-[#0d1117] rounded-lg px-3 py-2">
                    <div><p className="text-sm text-foreground">{formatZMW(a.targetPrice)} — {a.direction}</p><p className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</p></div>
                    <button onClick={() => alerts.removeAlert(a.id)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">No active alerts for {security.symbol}</p>
            )}
            <div className="space-y-3">
              <input type="number" value={alertPrice} onChange={e => setAlertPrice(e.target.value)} placeholder="K 0.00"
                className="w-full bg-[#0d1117] rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <div className="flex gap-2">
                <button onClick={() => setAlertDirection('above')}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium ${alertDirection === 'above' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-[#0d1117] text-muted-foreground'}`}>Above</button>
                <button onClick={() => setAlertDirection('below')}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium ${alertDirection === 'below' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-[#0d1117] text-muted-foreground'}`}>Below</button>
                <button onClick={() => setAlertDirection('at')}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium ${alertDirection === 'at' ? 'bg-warning/15 text-warning border border-warning/30' : 'bg-[#0d1117] text-muted-foreground'}`}>At this price</button>
              </div>
              <button onClick={() => { const p = parseFloat(alertPrice); if (p > 0) { alerts.addAlert(p, alertDirection as 'above' | 'below'); setAlertPrice(''); } }}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold">Set Alert</button>
            </div>
          </div>
        </>
      )}

      {/* Indicators Panel */}
      {indicatorPanelOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setIndicatorPanelOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-[#111827] rounded-t-2xl border-t border-[#1f2937] max-h-[60vh] overflow-y-auto animate-slide-up p-5">
            <div className="flex justify-center mb-3"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
            <h3 className="font-semibold text-foreground mb-1">Indicators</h3>
            <p className="text-xs text-muted-foreground mb-4">Add technical indicators to your chart</p>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Overlays</p>
              {indicators.filter(i => ['MA', 'EMA', 'BB', 'VWAP'].includes(i.type)).map(ind => (
                <div key={ind.label} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: ind.color }} />
                    <span className="text-sm text-foreground">{ind.label}</span>
                  </div>
                  <button onClick={() => setIndicators(prev => prev.map(i => i.label === ind.label ? { ...i, enabled: !i.enabled } : i))}
                    className={`w-10 h-5 rounded-full transition-colors ${ind.enabled ? 'bg-primary' : 'bg-[#1f2937]'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${ind.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-4 mb-2">Oscillators</p>
              {indicators.filter(i => ['RSI', 'Volume'].includes(i.type)).map(ind => (
                <div key={ind.label} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: ind.color }} />
                    <span className="text-sm text-foreground">{ind.label}</span>
                  </div>
                  <button onClick={() => setIndicators(prev => prev.map(i => i.label === ind.label ? { ...i, enabled: !i.enabled } : i))}
                    className={`w-10 h-5 rounded-full transition-colors ${ind.enabled ? 'bg-primary' : 'bg-[#1f2937]'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${ind.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Clear confirmation */}
      {clearConfirmOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setClearConfirmOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-[#111827] border border-[#1f2937] rounded-2xl p-6 w-80">
            <h3 className="font-semibold text-foreground mb-2">Clear All Drawings?</h3>
            <p className="text-sm text-muted-foreground mb-4">This will remove all drawings for {security.symbol}. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setClearConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm text-foreground bg-[#1f2937]">Cancel</button>
              <button onClick={() => { analysis.clearAll(); setClearConfirmOpen(false); }} className="flex-1 py-2.5 rounded-xl text-sm bg-destructive text-white font-bold">Clear All</button>
            </div>
          </div>
        </>
      )}

      {/* Tutorial - Multi-step */}
      {showTutorial && (
        <>
          <div className="fixed inset-0 bg-black/80 z-[70]" />
          <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[70] bg-[#111827] border border-[#1f2937] rounded-2xl p-4 sm:p-6 sm:max-w-md sm:w-[calc(100%-2rem)] flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)', maxWidth: 'calc(100vw - 2rem)' }}>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0">{currentTutStep.icon}</span>
                <h3 className="font-semibold text-foreground text-sm sm:text-lg truncate">{currentTutStep.title}</h3>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{tutorialStep + 1}/{tutorialSteps.length}</span>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line leading-relaxed flex-1 min-h-0 overflow-y-auto mb-3">
              {currentTutStep.content}
            </div>
            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mb-3 shrink-0">
              {tutorialSteps.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-colors ${i === tutorialStep ? 'bg-primary' : 'bg-[#1f2937]'}`} />
              ))}
            </div>
            <div className="flex gap-2 shrink-0">
              {tutorialStep > 0 && (
                <button onClick={() => setTutorialStep(s => s - 1)}
                  className="flex-1 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm text-foreground bg-[#1f2937]">Back</button>
              )}
              {tutorialStep < tutorialSteps.length - 1 ? (
                <button onClick={() => setTutorialStep(s => s + 1)}
                  className="flex-1 py-2 sm:py-2.5 bg-primary text-primary-foreground rounded-xl text-xs sm:text-sm font-bold">Next</button>
              ) : (
                <button onClick={() => { setShowTutorial(false); setTutorialStep(0); localStorage.setItem('hasSeenAnalysisTutorial', '1'); }}
                  className="flex-1 py-2 sm:py-2.5 bg-primary text-primary-foreground rounded-xl text-xs sm:text-sm font-bold">
                  Start Analyzing
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   SHARED DRAWING RENDERER (used by both canvases)
   ═══════════════════════════════════════════════════════ */
function renderDrawingOnCanvas(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  W: number, H: number,
  lo: number, hi: number,
  padT: number, padB: number,
  isSelected: boolean
) {
  const pts = drawing.pts.map(p => ({ x: p.x * W, y: p.y * H }));
  ctx.save();
  const customColor = drawing.color;
  const baseCol = isSelected ? '#ff9503' : customColor || 'rgba(255,149,3,0.88)';
  ctx.strokeStyle = baseCol;
  ctx.fillStyle = isSelected ? 'rgba(255,149,3,0.12)' : customColor ? `${customColor}12` : 'rgba(255,149,3,0.07)';
  ctx.lineWidth = isSelected ? 2.2 : 1.5;
  ctx.setLineDash([]);

  if (isSelected) { ctx.shadowColor = 'rgba(255,149,3,0.5)'; ctx.shadowBlur = 8; }

  switch (drawing.tool) {
    case 'trendline':
      if (pts.length >= 2) {
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
        ctx.shadowBlur = 0;
        pts.slice(0, 2).forEach(p => {
          ctx.beginPath(); ctx.arc(p.x, p.y, isSelected ? 5 : 3, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? '#ff9503' : customColor || '#ff9503'; ctx.fill();
          if (isSelected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); }
        });
      }
      break;
    case 'hline':
      if (pts.length >= 1) {
        ctx.strokeStyle = isSelected ? '#fb923c' : customColor || 'rgba(251,146,60,.88)';
        ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(0, pts[0].y); ctx.lineTo(W - 80, pts[0].y); ctx.stroke(); ctx.setLineDash([]);
        const price = y2p(pts[0].y, lo, hi, H, padT, padB);
        ctx.fillStyle = isSelected ? '#fb923c' : customColor || 'rgba(251,146,60,0.7)';
        ctx.font = (isSelected ? 'bold ' : '') + '10px Inter, system-ui';
        ctx.fillText(`K${price.toFixed(2)}`, W - 170, pts[0].y - 3);
      }
      break;
    case 'vline':
      if (pts.length >= 1) {
        ctx.strokeStyle = customColor || baseCol;
        ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(pts[0].x, padT); ctx.lineTo(pts[0].x, H - padB); ctx.stroke(); ctx.setLineDash([]);
      }
      break;
    case 'rect':
      if (pts.length >= 2) {
        const x = Math.min(pts[0].x, pts[1].x), y = Math.min(pts[0].y, pts[1].y);
        const w = Math.abs(pts[1].x - pts[0].x), h = Math.abs(pts[1].y - pts[0].y);
        ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
        if (isSelected) {
          ctx.shadowBlur = 0;
          [[pts[0].x, pts[0].y], [pts[1].x, pts[0].y], [pts[0].x, pts[1].y], [pts[1].x, pts[1].y]].forEach(([hx, hy]) => {
            ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fillStyle = '#ff9503'; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
          });
        }
      }
      break;
    case 'fib':
      if (pts.length >= 2) {
        const FIB_L = [0, .236, .382, .5, .618, .786, 1];
        const FIB_C = ['#22c55e', '#a3e635', '#facc15', '#fb923c', '#f87171', '#c084fc', '#22c55e'];
        FIB_L.forEach((l, li) => {
          const y = pts[0].y + (pts[1].y - pts[0].y) * l;
          ctx.strokeStyle = customColor || FIB_C[li]; ctx.globalAlpha = isSelected ? .8 : .55; ctx.lineWidth = isSelected ? 1.2 : .9; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - 80, y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
          ctx.fillStyle = customColor || FIB_C[li]; ctx.font = (isSelected ? 'bold ' : '') + '9px Inter, system-ui';
          const price = y2p(y, lo, hi, H, padT, padB);
          ctx.fillText(`${(l * 100).toFixed(1)}%  K${price.toFixed(2)}`, 6, y - 2);
        });
      }
      break;
    case 'arrow':
      if (pts.length >= 2) {
        const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y, a = Math.atan2(dy, dx);
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[1].x - 10 * Math.cos(a - .4), pts[1].y - 10 * Math.sin(a - .4));
        ctx.lineTo(pts[1].x - 10 * Math.cos(a + .4), pts[1].y - 10 * Math.sin(a + .4));
        ctx.closePath(); ctx.fillStyle = isSelected ? '#ff9503' : customColor || '#ff9503'; ctx.fill();
      }
      break;
    case 'text':
      if (pts.length >= 1 && drawing.text) {
        ctx.fillStyle = customColor || '#f9fafb'; ctx.font = '14px Inter, sans-serif';
        ctx.fillText(drawing.text, pts[0].x, pts[0].y);
        if (isSelected) {
          const tw = ctx.measureText(drawing.text).width;
          ctx.setLineDash([3, 3]); ctx.strokeStyle = '#ff9503';
          ctx.strokeRect(pts[0].x - 2, pts[0].y - 14, tw + 4, 18);
        }
      }
      break;
  }

  ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.restore();
}

export default AnalysisPage;
