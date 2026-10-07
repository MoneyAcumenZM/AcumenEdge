import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, X, History, Loader2, RefreshCw, RotateCcw, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Order, getStatusDisplay, formatZMW } from "@/lib/tradingUtils";
import { logAudit } from "@/lib/audit";
import { useOrders, queryKeys } from "@/hooks/useDataQuery";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { subscribeOrderUpdates, middlewareClient } from "@/services/middlewareClient";
import { HapticFeedback } from "@/services/haptics";
import { toast } from "sonner";
import { asRecord, asString, errorMessage } from "@/lib/apiShape";

const statusBadgeColors: Record<string, string> = {
  gray: "bg-secondary text-muted-foreground",
  blue: "bg-primary/10 text-primary",
  amber: "bg-warning/10 text-warning",
  green: "bg-success/10 text-success",
  red: "bg-destructive/10 text-destructive",
  orange: "bg-warning/10 text-warning",
  cyan: "bg-primary/10 text-primary",
};

// Rows as the backend sends them, made safe to display: status in lower
// case ("FILLED" → "filled") and money/quantity fields as numbers even if
// they arrive as strings (some databases return decimals as text).
const num = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const normaliseOrder = (o: Order): Order => ({
  ...o,
  status: String(o.status ?? '').toLowerCase() as Order['status'],
  order_type: (o.order_type ?? 'limit') as Order['order_type'],
  qualifier: (o.qualifier ?? 'day') as Order['qualifier'],
  quantity: num(o.quantity) ?? 0,
  filled_quantity: num(o.filled_quantity) ?? 0,
  limit_price: num(o.limit_price),
  filled_price: num(o.filled_price),
  fill_value: num(o.fill_value),
  total_fees: num(o.total_fees),
  net_value: num(o.net_value),
});

// Settlement dates are bare YYYY-MM-DD: read as that calendar day, not as
// midnight UTC (which would show the previous day behind UTC).
const shortDate = (d: string | null | undefined) => {
  if (!d) return '';
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  const date = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(d);
  return date.toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ATSMyOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"open" | "history">("open");
  const { data: ordersRaw = [], isLoading: loading, isError, refetch } = useOrders();
  const orders = (ordersRaw as unknown as Order[]).map(normaliseOrder);

  // Realtime handled by AuthContext — no extra channels needed

  // Middleware WebSocket: ORDER_UPDATE → invalidate caches + targeted toasts
  useEffect(() => {
    if (!user?.id) return;
    const cleanup = subscribeOrderUpdates(user.id, (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders(user.id) });
      queryClient.invalidateQueries({ queryKey: ['client-open-orders', user.id] });
      const status = asString(data.status) || asString(asRecord(data.order).status);
      // Refresh positions from the trading API whenever an order fills (fully or partly).
      if (status === 'filled' || status === 'partial_fill' || status === 'partial') {
        queryClient.invalidateQueries({ queryKey: queryKeys.holdings(user.id) });
      }
      if (!status) return;
      switch (status) {
        case 'filled':
          toast.success('Order filled');
          break;
        case 'rejected':
          toast.error('Order rejected: ' + (asString(data.reason) || 'Exchange declined'));
          break;
        case 'CANCELLED':
        case 'cancelled':
          toast('Order cancelled');
          break;
        case 'partial':
        case 'partial_fill': {
          const filled = asString(data.filledQty ?? data.filled_qty ?? data.filled_quantity, '?');
          const qty = asString(data.quantity ?? data.qty, '?');
          toast(`Partial fill — ${filled} of ${qty}`);
          break;
        }
      }
    });
    return cleanup;
  }, [user?.id, queryClient]);

  // Open/active vs filled/completed — partial_fill must appear in BOTH where relevant.
  const openStatuses = ['active', 'open', 'queued', 'pending', 'submitting', 'partial', 'partial_fill', 'cancel_requested'];
  const historyStatuses = ['filled', 'partial_fill', 'cancelled', 'canceled', 'rejected', 'expired', 'replaced', 'settlement_pending', 'settled'];

  // An unrecognised status is treated as still open, so no order ever
  // disappears from the screen.
  const openOrders = orders.filter(o => openStatuses.includes(o.status) || !historyStatuses.includes(o.status));
  const historyOrders = orders.filter(o => historyStatuses.includes(o.status));

  const handleCancel = async (order: Order) => {
    if (!confirm('Cancel this order? This cannot be undone.')) return;
    queryClient.setQueryData(queryKeys.orders(user!.id), (old: Array<{ id: string }> | undefined) =>
      (old || []).map((o) => o.id === order.id ? { ...o, status: 'cancel_requested' } : o)
    );

    if (user) {
      await logAudit('ORDER_CANCEL_REQUESTED', 'orders', order.id);
    }

    try {
      if (!order.client_order_id) {
        toast.error('Order not yet confirmed by exchange — please wait a moment and try again.');
        queryClient.invalidateQueries({ queryKey: queryKeys.orders(user!.id) });
        return;
      }
      const clOrdId = order.client_order_id;
      HapticFeedback.light();
      await middlewareClient.cancelClientOrder(clOrdId, user!.id);
      HapticFeedback.medium();
      queryClient.invalidateQueries({ queryKey: queryKeys.orders(user!.id) });
      queryClient.invalidateQueries({ queryKey: ['client-open-orders', user!.id] });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not cancel order'));
      queryClient.invalidateQueries({ queryKey: queryKeys.orders(user!.id) });
    }
  };

  const handleResubmit = (order: Order) => {
    const stock = order.stocks;
    const params = new URLSearchParams();
    if (stock?.symbol) params.set('ticker', stock.symbol);
    params.set('side', order.side);
    params.set('type', order.order_type);
    params.set('qty', String(order.quantity));
    if (order.limit_price) params.set('price', String(order.limit_price));
    navigate(`/trade?${params.toString()}`);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Orders</h1>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.orders(user!.id) })}
          className="ring-btn w-10 h-10 flex items-center justify-center"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setTab("open")}
          className={`ring-btn ${tab === "open" ? "ring-btn-active" : "text-white/60"} py-3 text-sm font-medium`}>
          Open Orders {openOrders.length > 0 && <span className="ml-1 text-[10px] text-white/70">({openOrders.length})</span>}
        </button>
        <button onClick={() => setTab("history")}
          className={`ring-btn ${tab === "history" ? "ring-btn-active" : "text-white/60"} py-3 text-sm font-medium`}>
          Trade History {historyOrders.length > 0 && <span className="ml-1 text-[10px] text-white/70">({historyOrders.length})</span>}
        </button>
      </div>

      {isError && (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Your orders couldn't be loaded. Check your connection and try again.</p>
          <button onClick={() => refetch()} className="px-4 py-2 ring-btn text-xs font-semibold">Try again</button>
        </div>
      )}

      {!isError && tab === "open" && (
        <>
          {openOrders.length === 0 ? (
            <div className="py-14 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-semibold text-foreground text-lg">No open orders</p>
              <p className="text-sm text-muted-foreground mt-1">Submit an order from the Trade page</p>
            </div>
          ) : (
            <div className="hairline-y">
              {openOrders.map(order => {
                const stock = order.stocks;
                const status = getStatusDisplay(order.status);
                const isSubmitting = order.status === 'submitting' || order.status === 'cancel_requested';
                return (
                  <div key={order.id} className="py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{stock?.symbol || '—'}</span>
                        <span className="text-xs text-muted-foreground">— {stock?.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${order.side === 'buy' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                          {order.side.toUpperCase()}
                        </span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusBadgeColors[status.color]}`}>
                        {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.order_type.toUpperCase()} {order.qualifier.toUpperCase()} | {order.quantity.toLocaleString()} shares
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Price: {order.limit_price ? formatZMW(order.limit_price) : 'Market'}
                      {order.settlement_date && ` | Settlement: ${shortDate(order.settlement_date)}`}
                    </p>
                    {(order.status === 'partial' || order.status === 'partial_fill') && order.filled_quantity > 0 && (
                      <p className="text-xs text-warning">Filled: {order.filled_quantity.toLocaleString()} of {order.quantity.toLocaleString()}{order.filled_price ? ` @ ${formatZMW(order.filled_price)}` : ''}</p>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-[10px] text-muted-foreground">{timeAgo(order.created_at)}</span>
                      {['pending', 'open', 'queued', 'active', 'partial', 'partial_fill'].includes(order.status) && (
                        <button onClick={() => handleCancel(order)}
                          className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 font-medium">
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {!isError && tab === "history" && (
        <>
          {historyOrders.length === 0 ? (
            <div className="py-14 text-center">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-semibold text-foreground text-lg">No completed trades yet</p>
            </div>
          ) : (
            <div className="hairline-y">
              {historyOrders.map(order => {
                const stock = order.stocks;
                const status = getStatusDisplay(order.status);
                const isExpired = order.status === 'expired';
                return (
                  <div key={order.id} className="py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{stock?.symbol || '—'}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${order.side === 'buy' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                          {order.side.toUpperCase()}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isExpired ? 'bg-secondary text-muted-foreground' : statusBadgeColors[status.color]
                        }`}>
                          {status.label}
                        </span>
                        {isExpired && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3.5 h-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px]">
                              <p className="text-xs">This order was not executed within 24 hours and has been cancelled. You can resubmit it below.</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.quantity.toLocaleString()} shares @ {order.filled_price ? formatZMW(order.filled_price) : order.limit_price ? formatZMW(order.limit_price) : 'Market'}
                    </p>
                    {(order.status === 'filled' || order.status === 'settled' || order.status === 'settlement_pending') && order.fill_value && (
                      <p className="text-xs text-muted-foreground">
                        Fill Value: {formatZMW(order.fill_value)} | Fees: {formatZMW(order.total_fees || 0)} | Net: {formatZMW(order.net_value || 0)}
                      </p>
                    )}
                    {order.status === 'rejected' && order.rejection_reason && (
                      <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-1.5">{order.rejection_reason}</p>
                    )}
                    {order.status === 'settlement_pending' && (
                      <p className="text-xs text-warning">Shares settling{order.settlement_date ? ` — credited by ${shortDate(order.settlement_date)}` : ''}</p>
                    )}
                    {isExpired && (
                      <button
                        onClick={() => handleResubmit(order)}
                        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium pt-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Resubmit Order
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ATSMyOrders;
