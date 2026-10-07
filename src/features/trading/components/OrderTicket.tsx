import { useEffect, useMemo, useRef, useState } from "react";
import { useIdempotencyKey } from "@/hooks/useIdempotencyKey";
import { X, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { middlewareClient, ApiError, type PlaceOrderInput } from "@/services/middlewareClient";
import { errorMessage } from "@/lib/apiShape";
import { db } from "@/integrations/data/client";
import { useMarketStatus, useWallet, useHoldings } from "@/hooks/useDataQuery";
import { useAccountRestrictions } from "@/features/auth/hooks/useAccountRestrictions";
import { checkOrderLimits, settledQuantity } from "@/features/trading/lib/orderLimits";
import { HapticFeedback } from "@/services/haptics";
import { calcFees, calcSettlementDate, isCsdRegistered } from "@/lib/tradingUtils";

export interface OrderTicketStock {
  symbol: string;
  name?: string;
  last_price?: number | null;
  currency?: string | null;
}

interface OrderTicketProps {
  stock: OrderTicketStock | null;
  open: boolean;
  onClose: () => void;
}

const fmtZMW = (v: number) =>
  new Intl.NumberFormat("en-ZM", { style: "currency", currency: "ZMW", minimumFractionDigits: 2 }).format(v);

const OrderTicket = ({ stock, open, onClose }: OrderTicketProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: marketStatus } = useMarketStatus();
  const { canTrade } = useAccountRestrictions();
  const { data: wallet } = useWallet();
  const { data: holdings } = useHoldings();
  const walletBalance = wallet ? Number(wallet.balance) : null;
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState<string>("");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ payload?: PlaceOrderInput; status?: number; body?: unknown; error?: string } | null>(null);
  const { keyFor, settle } = useIdempotencyKey();
  const [debugOpen, setDebugOpen] = useState(false);
  // The checked order awaiting the user's confirmation; null while editing.
  const [review, setReview] = useState<PlaceOrderInput | null>(null);

  // Known-closed phases. Unknown/null leaves submit enabled — server will 403
  // if closed.
  const isMarketClosedKnown = marketStatus != null && marketStatus.trading_allowed === false;

  // Reset / prefill when a different symbol is opened. The last price is
  // read through a ref so that a live price tick (or the parent passing a
  // fresh `stock` object) doesn't re-run this and wipe what the user typed.
  const symbol = stock?.symbol;
  const lastPriceRef = useRef(stock?.last_price);
  lastPriceRef.current = stock?.last_price;
  useEffect(() => {
    if (open && symbol) {
      setSide("buy");
      setQuantity("");
      setOrderType("limit");
      setPrice(lastPriceRef.current != null ? String(lastPriceRef.current) : "");
      setReview(null);
    }
  }, [open, symbol]);

  const qty = Number(quantity) || 0;
  const px = Number(price) || 0;
  const estValue = useMemo(() => (orderType === "limit" ? qty * px : 0), [qty, px, orderType]);

  if (!open || !stock) return null;

  const validate = (): string | null => {
    if (!user) return "You must be signed in";
    if (!canTrade) return "Trading is not currently available on your account. Contact support for details.";
    if (isMarketClosedKnown) return "The market is currently closed. Orders are accepted 09:00–14:00 CAT.";
    if (qty < 1) return "Quantity must be at least 1";
    if (orderType === "limit" && px <= 0) return "Enter a valid limit price";
    // Same money checks as the Trade page. A market order is valued at the
    // last known price.
    const unitPrice = orderType === "limit" ? px : Number(stock.last_price ?? 0);
    const consideration = qty * unitPrice;
    return checkOrderLimits({
      side,
      orderType,
      symbol: stock.symbol,
      quantity: qty,
      limitPrice: orderType === "limit" ? px : null,
      lastPrice: stock.last_price,
      consideration,
      totalFees: consideration > 0 ? calcFees(consideration, side).totalFees : 0,
      walletBalance,
      heldQuantity: settledQuantity(holdings, stock.symbol),
    });
  };

  // Step 1: run every check, then show the confirmation summary. Nothing is
  // sent until the user confirms it.
  const reviewOrder = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!user) return;

    // Fresh auth + profile gating
    const { data: authData } = await db.auth.getUser();
    const clientId = authData?.user?.id;
    if (!clientId) { toast.error('You must be signed in'); return; }

    const { data: freshProfile, error: profileError } = await db
      .from('profiles')
      .select('csd_registered, csd_registration_status, account_status, kyc_status')
      .eq('id', clientId)
      .maybeSingle();

    if (profileError) {
      toast.error("We couldn't check your account status just now. Please try again.");
      return;
    }

    // Re-checked against a fresh read of the profile, with the same rule as
    // useAccountRestrictions (and so the Trade page).
    if (!freshProfile || !isCsdRegistered(freshProfile)) {
      toast.error("Your investment account is still being set up. You'll be able to trade once your CSD account is active.");
      return;
    }
    if (freshProfile.account_status === 'suspended' || freshProfile.account_status === 'banned') {
      toast.error('Your account is restricted. Contact support.');
      return;
    }
    if (freshProfile.kyc_status !== 'approved') {
      toast.error('Your identity verification is pending.');
      return;
    }

    const payload: PlaceOrderInput = {
      clientId,
      symbol: stock.symbol.toUpperCase().trim(),
      side: side.toLowerCase() as 'buy' | 'sell',
      quantity: qty,
      orderType: orderType.toLowerCase() as 'limit' | 'market',
      ...(orderType === 'limit' ? { price: px } : {}),
    };
    setReview(payload);
  };

  // Step 2: send the confirmed order.
  const sendOrder = async () => {
    const payload = review;
    if (!payload) return;
    const clientId = payload.clientId;

    setSubmitting(true);
    setDebugInfo({ payload });
    try {
      const result = await middlewareClient.placeClientOrder(payload, keyFor(JSON.stringify(payload)));
      settle();
      setDebugInfo({ payload, status: 200, body: result });

      const status = (result?.orderStatus || "").toLowerCase();
      if (status === "pending" && result?.fixSent) {
        toast.success("Order submitted to the Lusaka Stock Exchange");
      } else if (status === "queued") {
        toast.warning("Order received and queued — we'll process it shortly");
      } else if (result?.status === "ok") {
        toast.success(result?.message || "Order submitted");
      } else {
        toast.error(result?.error || "Could not place order");
        setSubmitting(false);
        setReview(null);
        return;
      }

      HapticFeedback.success();
      queryClient.invalidateQueries({ queryKey: ["orders", clientId] });
      onClose();
    } catch (e) {
      // A response from the server is a definitive answer; only a timeout or
      // network failure leaves the outcome unknown and keeps the key so a
      // retry can't duplicate the order.
      if (e instanceof ApiError) settle();
      const status = e instanceof ApiError ? e.status : undefined;
      const body = e instanceof ApiError ? e.body : null;
      // FIX I: 403 from middleware means market closed — surface body.message verbatim.
      const message =
        status === 403 && typeof body?.message === 'string' && body.message
          ? body.message
          : (typeof body?.error === 'string' && body.error) || errorMessage(e, "Failed to place order");
      setDebugInfo({ payload, status, body, error: message });
      toast.error(message);
      // Back to the form either way; after a timeout the same order keeps its
      // idempotency key, so confirming it again can't create a duplicate.
      setReview(null);
      if (import.meta.env.DEV) setDebugOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-background/70 backdrop-blur-xs" />
      <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Order Ticket</p>
            <h2 className="text-lg font-bold text-foreground">{stock.symbol}</h2>
            {stock.name && <p className="text-xs text-muted-foreground truncate">{stock.name}</p>}
            {stock.last_price != null && (
              <p className="text-xs text-primary mt-0.5">Last: {fmtZMW(Number(stock.last_price))}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="Close">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {review ? (() => {
          const unitPrice = review.price ?? Number(stock.last_price ?? 0);
          const value = review.quantity * unitPrice;
          const fees = value > 0 ? calcFees(value, review.side) : null;
          return (
            <div className="space-y-4">
              <h3 className="font-bold text-foreground">Confirm Order</h3>
              <div className="bg-secondary/50 rounded-xl px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Action</span><span className={`font-bold ${review.side === 'buy' ? 'text-success' : 'text-destructive'}`}>{review.side.toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span className="text-foreground font-medium">{stock.symbol}{stock.name ? ` — ${stock.name}` : ''}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="text-foreground">{review.orderType === 'limit' ? 'Limit' : 'Market'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span className="text-foreground">{review.quantity.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="text-foreground">{review.price != null ? fmtZMW(review.price) : 'Market'}</span></div>
                {fees && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">{review.orderType === 'market' ? 'Est. value' : 'Order value'}</span><span className="text-foreground">{fmtZMW(value)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Fees</span><span className="text-foreground">{fmtZMW(fees.totalFees)}</span></div>
                    <div className="flex justify-between font-medium pt-1 border-t border-border"><span className="text-foreground">{review.side === 'buy' ? 'Total cost' : 'Net proceeds'}</span><span className="text-primary">{fmtZMW(fees.netValue)}</span></div>
                  </>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Est. settlement</span><span className="text-primary">{calcSettlementDate(new Date())}</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setReview(null)} disabled={submitting} className="flex-1 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium disabled:opacity-50">Back</button>
                <button onClick={sendOrder} disabled={submitting}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${review.side === 'buy' ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'} disabled:opacity-60`}>
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Placing...' : 'Confirm Order'}
                </button>
              </div>
            </div>
          );
        })() : (
        <>
        {/* Side */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setSide("buy")} className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${side === "buy" ? "bg-success/15 text-success border border-success/30" : "bg-secondary text-muted-foreground"}`}>BUY</button>
          <button onClick={() => setSide("sell")} className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${side === "sell" ? "bg-destructive/15 text-destructive border border-destructive/30" : "bg-secondary text-muted-foreground"}`}>SELL</button>
        </div>

        {/* Quantity */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Quantity</label>
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0"
            className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary" />
        </div>

        {/* Order Type */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Order Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setOrderType("limit")} className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${orderType === "limit" ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary text-muted-foreground"}`}>Limit</button>
            <button onClick={() => setOrderType("market")} className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${orderType === "market" ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary text-muted-foreground"}`}>Market</button>
          </div>
        </div>

        {/* Limit Price */}
        {orderType === "limit" && (
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Limit Price (ZMW)</label>
            <input type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00"
              className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary" />
          </div>
        )}

        {/* Estimated value + fee summary */}
        <div className="bg-secondary/50 rounded-xl px-4 py-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Estimated Value</span>
            <span className="text-sm font-bold text-foreground">{orderType === "limit" ? fmtZMW(estValue) : "Market"}</span>
          </div>
          {orderType === "limit" && estValue > 0 && (() => {
            const fees = calcFees(estValue, side);
            return (
              <>
                <div className="flex justify-between text-muted-foreground"><span>SEC 0.125%</span><span>{fmtZMW(fees.secFee)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>LuSE 0.25%</span><span>{fmtZMW(fees.luseFee)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Broker 1%</span><span>{fmtZMW(fees.brokerFee)}</span></div>
                <div className="flex justify-between font-medium pt-1 border-t border-border">
                  <span className="text-foreground">{side === 'buy' ? 'Total cost' : 'Net proceeds'}</span>
                  <span className="text-primary">{fmtZMW(fees.netValue)}</span>
                </div>
              </>
            );
          })()}
        </div>

        <button onClick={reviewOrder} disabled={submitting || isMarketClosedKnown}
          className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity ${side === "buy" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"} ${(submitting || isMarketClosedKnown) ? "opacity-60" : "hover:opacity-90"}`}>
          {`Place ${side.toUpperCase()} Order`}
        </button>
        {/* Inline market-closed notice (mirrors server enforcement) */}
        {isMarketClosedKnown && (
          <p className="text-[11px] text-muted-foreground text-center -mt-1">
            Market closed — orders accepted 09:00–14:00 CAT
          </p>
        )}
        </>
        )}

        {import.meta.env.DEV && (
          <div className="border border-border rounded-xl">
            <button
              type="button"
              onClick={() => setDebugOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted-foreground"
            >
              <span>🐞 Debug (dev only)</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
            </button>
            {debugOpen && (
              <div className="px-3 pb-3 space-y-2 text-[10px] font-mono">
                <div>
                  <p className="text-muted-foreground">clientId (auth UUID):</p>
                  <p className="text-foreground break-all">{user?.id || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Outgoing payload:</p>
                  <pre className="bg-secondary rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(debugInfo?.payload ?? {
                    clientId: user?.id,
                    symbol: stock.symbol.toUpperCase().trim(),
                    side: side.toLowerCase(),
                    quantity: qty,
                    orderType,
                    ...(orderType === 'limit' ? { price: px } : {}),
                  }, null, 2)}</pre>
                </div>
                {debugInfo?.status != null && (
                  <div><p className="text-muted-foreground">Status:</p><p className="text-foreground">{debugInfo.status}</p></div>
                )}
                {debugInfo?.body != null && (
                  <div>
                    <p className="text-muted-foreground">Response body:</p>
                    <pre className="bg-secondary rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(debugInfo.body, null, 2)}</pre>
                  </div>
                )}
                {debugInfo?.error && (
                  <div><p className="text-muted-foreground">Error:</p><p className="text-destructive break-all">{debugInfo.error}</p></div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTicket;
