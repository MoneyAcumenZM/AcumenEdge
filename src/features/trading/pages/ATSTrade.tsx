import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Search, ChevronDown, AlertCircle, Info, Loader2, Calendar, X, Clock, XCircle, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountRestrictions } from "@/features/auth/hooks/useAccountRestrictions";
import { Stock, calcFees, calcSettlementDate, formatZMW, OrderSide, OrderType, OrderQualifier } from "@/lib/tradingUtils";
import { orderSchema } from "@/lib/schemas";
import { sanitizeError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { useIdempotencyKey } from "@/hooks/useIdempotencyKey";
import { checkOrderLimits, settledQuantity } from "@/features/trading/lib/orderLimits";
import { middlewareClient, ApiError, type PlaceOrderInput } from "@/services/middlewareClient";
import { PAPER_TRADING_MODE } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { useStocks, useMarketStatus, queryKeys, useWallet, useHoldings } from "@/hooks/useDataQuery";
import { useAllMarketData } from "@/features/market/hooks/useMarketData";
import { useQueryClient } from "@tanstack/react-query";
import { HapticFeedback } from "@/services/haptics";
import { toast } from "sonner";

const qualifierTooltips: Record<string, string> = {
  day: "Your order is active for today's trading session only.",
  gtd: "Your order stays active until the date you choose, up to 14 days.",
  fok: "Either your entire order gets filled right now, or it is cancelled completely.",
  ioc: "Your order must be filled immediately or cancelled on the spot.",
};

const ATSTrade = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { canTrade, csdPending } = useAccountRestrictions();
  const { keyFor, settle } = useIdempotencyKey();
  const [searchParams] = useSearchParams();
  const isSubmitting = useRef(false);
  const queryClient = useQueryClient();

  const { data: stocksRaw = [] } = useStocks();
  const stocks = stocksRaw as unknown as Stock[];
  const { data: marketStatus } = useMarketStatus();
  const { data: wallet } = useWallet();
  const { data: holdings } = useHoldings();
  const walletBalance = wallet ? Number(wallet.balance) : null;
  const { data: liveMap } = useAllMarketData();

  const [stockId, setStockId] = useState("");
  const [secSearch, setSecSearch] = useState("");
  const [secDropdownOpen, setSecDropdownOpen] = useState(false);
  const [side, setSide] = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [qualifier, setQualifier] = useState<OrderQualifier>("day");
  const [volume, setVolume] = useState("");
  const [price, setPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showQualifierInfo, setShowQualifierInfo] = useState<string | null>(null);

  // Auto-fill from URL (ticker, side, type, qty, price — supports resubmit)
  useEffect(() => {
    const ticker = searchParams.get('ticker');
    if (ticker && stocks.length > 0) {
      const match = stocks.find(s => s.symbol?.toUpperCase() === ticker.toUpperCase());
      if (match) setStockId(match.id);
    }
    const urlSide = searchParams.get('side');
    if (urlSide === 'buy' || urlSide === 'sell') setSide(urlSide);
    const urlType = searchParams.get('type');
    if (urlType === 'market' || urlType === 'limit') setOrderType(urlType);
    const urlQty = searchParams.get('qty');
    if (urlQty && Number(urlQty) > 0) setVolume(urlQty);
    const urlPrice = searchParams.get('price');
    if (urlPrice && Number(urlPrice) > 0) setPrice(urlPrice);
  }, [searchParams, stocks]);

  // NO per-page realtime listener — market status handled centrally in AuthContext

  const selectedStock = stocks.find(s => s.id === stockId);
  const filteredStocks = stocks.filter(s =>
    s.symbol.toLowerCase().includes(secSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(secSearch.toLowerCase())
  );

  const consideration = useMemo(() => {
    if (!volume || Number(volume) <= 0) return 0;
    const p = orderType === 'market' ? (selectedStock?.last_price || 0) : Number(price) || 0;
    return Number(volume) * p;
  }, [volume, price, orderType, selectedStock]);

  const fees = useMemo(() => consideration > 0 ? calcFees(consideration, side) : null, [consideration, side]);
  const settlementDate = useMemo(() => calcSettlementDate(new Date()), []);

  // csdPending comes from useAccountRestrictions, which reads the real
  // profile.csd_registered / csd_registration_status fields.
  const csdGated = csdPending;

  // Pre-submit check — block Submit when the market phase is known-closed.
  // If the phase is unknown (middleware unreachable), leave the button enabled
  // and let the server respond with 403 (handled below).
  const isMarketClosedKnown = marketStatus != null && marketStatus.trading_allowed === false;

  const boardSplit = useMemo(() => {
    if (!volume || Number(volume) <= 0 || !selectedStock) return null;
    const qty = Number(volume);
    const lotSize = selectedStock?.lot_size ?? 100;
    const equityBoardQty = Math.floor(qty / lotSize) * lotSize;
    const oddLotQty = qty % lotSize;
    return { equityBoardQty, oddLotQty, lotSize };
  }, [volume, selectedStock]);

  // Live price strip data
  const livePrice = selectedStock ? liveMap?.[selectedStock.symbol] : undefined;
  const displayPrice = livePrice?.live_price ?? livePrice?.last_price ?? selectedStock?.last_price;
  const displayBid = livePrice?.bid_price ?? selectedStock?.bid_price;
  const displayAsk = livePrice?.ask_price ?? selectedStock?.ask_price;

  const handleSubmit = useCallback(async () => {
    const errs: string[] = [];

    // Pre-submit gates. These are UX gates only — the server must
    // independently re-validate every one of them.
    // No profile means KYC, CSD and restriction status are all unknown —
    // and unknown is not the same as cleared.
    if (!profile) {
      setErrors(["Your account details couldn't be loaded, so this order can't be checked. Please try again shortly."]);
      return;
    }
    if (!canTrade) {
      setErrors(['Trading is not currently available on your account. Contact support for details.']);
      return;
    }
    if (csdGated) {
      setErrors(['Your CSD (investor) account registration is still pending. Trading unlocks once it completes.']);
      return;
    }
    if (isMarketClosedKnown) {
      setErrors(['The market is currently closed. Orders are accepted 09:00–14:00 CAT.']);
      return;
    }

    // Zod validation
    const validation = orderSchema.safeParse({
      stock_id: stockId,
      side,
      order_type: orderType,
      qualifier,
      quantity: Number(volume),
      limit_price: orderType === 'limit' ? Number(price) : null,
      expiry_date: qualifier === 'gtd' ? expiryDate : null,
    });

    if (!validation.success) {
      validation.error.errors.forEach(e => errs.push(e.message));
      setErrors(errs);
      return;
    }

    // Order value, price deviation, balance and holdings — the same checks
    // the quick order ticket applies (see lib/orderLimits.ts).
    if (selectedStock) {
      const limitError = checkOrderLimits({
        side,
        orderType,
        symbol: selectedStock.symbol,
        quantity: Number(volume),
        limitPrice: orderType === 'limit' ? Number(price) : null,
        lastPrice: selectedStock.last_price,
        consideration,
        totalFees: fees?.totalFees ?? 0,
        walletBalance,
        heldQuantity: settledQuantity(holdings, selectedStock.symbol, selectedStock.id),
      });
      if (limitError) {
        setErrors([limitError]);
        return;
      }
    }

    setErrors([]);
    setConfirmOpen(true);
  }, [stockId, volume, price, orderType, qualifier, expiryDate, side, consideration, selectedStock, profile, canTrade, csdGated, isMarketClosedKnown, walletBalance, fees, holdings]);

  const confirmOrder = useCallback(async () => {
    if (!user || isSubmitting.current) return;
    isSubmitting.current = true;
    setLoading(true);

    // No separate client-side timeout here: middlewareClient's request() already
    // aborts every call after REQUEST_TIMEOUT_MS (8s). A second timer that only
    // cleared local state could tell the user to retry while the original
    // request was still in flight, inviting a duplicate order.
    try {
      // Optimistic update — add pending order to cache immediately
      const optimisticOrder = {
        id: `temp-${Date.now()}`,
        stock_id: stockId,
        side,
        order_type: orderType,
        qualifier,
        quantity: Number(volume),
        limit_price: orderType === 'limit' ? Number(price) : null,
        expiry_date: qualifier === 'gtd' ? expiryDate : null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stocks: selectedStock ? { id: selectedStock.id, symbol: selectedStock.symbol, name: selectedStock.name, isin: selectedStock.isin } : null,
        filled_quantity: 0, filled_price: null, fill_value: null,
        consideration: null, luse_fee: null, broker_fee: null, levy: null, total_fees: null, net_value: null,
        rejection_reason: null, client_order_id: null, settlement_date: null,
      };
      queryClient.setQueryData(queryKeys.orders(user.id), (old: unknown[] | undefined) => [optimisticOrder, ...(old || [])]);

      // Route through middleware (the only order path). Middleware persists
      // the order row in Supabase itself — do NOT double-write here.
      const order: PlaceOrderInput = {
        clientId: user.id,
        symbol: selectedStock?.symbol || '',
        side,
        quantity: Number(volume),
        orderType,
        ...(orderType === 'limit' ? { price: Number(price) } : {}),
        qualifier,
      };
      // The key stays the same for as long as the order's parameters do, so
      // confirming again after a timeout replays this order rather than
      // placing a second one.
      const mwResponse = await middlewareClient.placeClientOrder(order, keyFor(JSON.stringify(order)));
      settle();

      const status = (mwResponse?.orderStatus || '').toLowerCase();
      const ok = mwResponse?.status === 'ok' || status === 'pending' || status === 'queued';
      if (!ok) {
        // Roll back optimistic update
        queryClient.invalidateQueries({ queryKey: queryKeys.orders(user.id) });
        HapticFeedback.error();
        throw new Error(mwResponse?.error || 'Order submission failed');
      }

      HapticFeedback.success();

      // The app never writes to the orders table itself: the trading API is the
      // only writer. The optimistic cache updates below cover the gap until its
      // row arrives.

      // Optimistic insert into the live open-orders cache so /my-orders shows it immediately
      if (mwResponse?.clOrdId) {
        queryClient.setQueryData(['client-open-orders', user.id], (prev: { orders?: unknown[] } | undefined) => {
          const orders = prev?.orders || [];
          const optimistic = {
            id: `opt-${mwResponse.clOrdId}`,
            client_order_id: mwResponse.clOrdId,
            symbol: selectedStock?.symbol || '',
            side,
            quantity: Number(volume),
            limit_price: orderType === 'limit' ? Number(price) : null,
            price: orderType === 'limit' ? Number(price) : null,
            order_type: orderType,
            status: status === 'queued' ? 'queued' : 'pending',
            created_at: new Date().toISOString(),
          };
          return { ...(prev || {}), orders: [optimistic, ...orders] };
        });
      }

      await logAudit('ORDER_PLACED', 'orders', mwResponse?.clOrdId || null, {
        side, symbol: selectedStock?.symbol, quantity: Number(volume), order_type: orderType,
        fixSent: mwResponse?.fixSent, middleware: true, clOrdId: mwResponse?.clOrdId,
      });

      // Invalidate so the real row from middleware insert replaces our optimistic one
      queryClient.invalidateQueries({ queryKey: queryKeys.orders(user.id) });
      queryClient.invalidateQueries({ queryKey: ['client-open-orders', user.id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.holdings(user.id) });

      setConfirmOpen(false);
      navigate('/my-orders');
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders(user.id) });
      // Any response from the server is a definitive answer. Only a timeout
      // or network failure leaves the outcome unknown, and then the key is
      // kept so that trying again can't duplicate the order.
      if (error instanceof ApiError) settle();
      // FIX I: surface middleware 403 (market closed) message verbatim.
      const closedMessage = error instanceof ApiError && error.status === 403 ? error.body?.message : undefined;
      if (typeof closedMessage === 'string' && closedMessage) {
        setErrors([closedMessage]);
        toast.error(closedMessage);
      } else {
        setErrors([sanitizeError(error)]);
      }
      setConfirmOpen(false);
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  }, [user, stockId, side, orderType, qualifier, volume, price, expiryDate, navigate, selectedStock, queryClient, keyFor, settle]);

  const minExpiry = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const maxExpiry = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  // KYC gate — show pending/rejected screen instead of trade form.
  // Deny by default: once the profile has loaded, anything other than an
  // explicit 'approved' (including a missing status) is treated as pending.
  const kycStatus = profile ? (profile.kyc_status || 'pending') : undefined;
  if (kycStatus && kycStatus !== 'approved') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
        <div className="w-full max-w-sm space-y-6 text-center">
          {kycStatus === 'rejected' ? (
            <>
              <XCircle className="w-14 h-14 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">Trading Unavailable</h1>
              <div className="mx-auto w-16 h-0.5 bg-amber-400 rounded-full" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your account application was not approved. Trading features are not available.
              </p>
              {profile?.kyc_rejection_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-destructive"><span className="font-bold">REASON:</span> {profile.kyc_rejection_reason}</p>
                </div>
              )}
              <div className="bg-secondary/50 border border-border rounded-xl px-4 py-3 flex items-center justify-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Contact{' '}
                   <a href="mailto:trading@moneyacumenadvisory.com" className="text-primary font-medium">
                     trading@moneyacumenadvisory.com
                  </a>{' '}to appeal.
                </p>
              </div>
            </>
          ) : (
            <>
              <Clock className="w-14 h-14 text-amber-400 animate-pulse mx-auto" />
              <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">Account Under Review</h1>
              <div className="mx-auto w-16 h-0.5 bg-amber-400 rounded-full" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your account is being verified by the Money Acumen Advisory compliance team. Trading will be enabled once approved.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This typically takes 1–2 business days. You'll be notified when your account is ready.
              </p>
              <div className="bg-secondary/50 border border-border rounded-xl px-4 py-3 flex items-center justify-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Questions? Contact{' '}
                   <a href="mailto:trading@moneyacumenadvisory.com" className="text-primary font-medium">
                     trading@moneyacumenadvisory.com
                  </a>
                </p>
              </div>
            </>
          )}
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-block">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 keyboard-aware">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Trade</h1>
          {PAPER_TRADING_MODE && (
            <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px]">Simulated</Badge>
          )}
        </div>
      </div>


      <div className="space-y-4">
        {/* Company dropdown */}
        <div className="relative">
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">COMPANY</label>
          <button onClick={() => setSecDropdownOpen(!secDropdownOpen)}
            className="ring-btn w-full flex items-center justify-between px-4 py-3 text-sm">
            <span className={stockId ? "text-foreground font-medium" : "text-muted-foreground"}>
              {stockId ? `${selectedStock?.symbol} — ${selectedStock?.name}` : "Select company..."}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {secDropdownOpen && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input value={secSearch} onChange={e => setSecSearch(e.target.value)} placeholder="Search..."
                    className="w-full bg-secondary rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden" />
                </div>
                {filteredStocks.map(s => (
                  <button key={s.id} onClick={() => { setStockId(s.id); setSecDropdownOpen(false); setSecSearch(""); }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-secondary/80 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-foreground">{s.symbol}</span>
                        <span className="text-xs text-muted-foreground ml-2">{s.name}</span>
                      </div>
                      <span className="text-xs text-foreground font-medium">K{s.last_price?.toFixed(2)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Price strip */}
        {selectedStock && (
          <div className="flex items-center gap-3 bg-primary/5 rounded-lg px-3 py-2 text-xs">
            <span className="text-muted-foreground">Last: <span className="text-foreground font-medium">{displayPrice != null ? formatZMW(Number(displayPrice)) : '—'}</span></span>
            <span className="text-muted-foreground">Bid: <span className="text-foreground font-medium">{displayBid != null ? formatZMW(Number(displayBid)) : '—'}</span></span>
            <span className="text-muted-foreground">Ask: <span className="text-foreground font-medium">{displayAsk != null ? formatZMW(Number(displayAsk)) : '—'}</span></span>
          </div>
        )}

        {/* Side */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Side</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setSide("buy"); HapticFeedback.light(); }} className={`ring-btn py-3 text-sm font-semibold ${side === "buy" ? "ring-btn-active text-success" : "text-white/60"}`}>BUY</button>
            <button onClick={() => { setSide("sell"); HapticFeedback.light(); }} className={`ring-btn py-3 text-sm font-semibold ${side === "sell" ? "ring-btn-active text-destructive" : "text-white/60"}`}>SELL</button>
          </div>
        </div>

        {/* Volume */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Volume (shares)</label>
          <input type="number" value={volume} onChange={e => setVolume(e.target.value)}
            placeholder="Min 1 share" min="1"
            className="ring-btn w-full px-4 py-3 text-sm placeholder:text-white/40 focus:outline-hidden" />
        </div>

        {/* Board Split */}
        {boardSplit && Number(volume) > 0 && (
          <div className="hairline-top pt-3 space-y-1.5 text-xs">
            <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Board Splitting</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Equity Board (lots of {boardSplit.lotSize})</span>
              <span className="text-foreground font-medium">{boardSplit.equityBoardQty.toLocaleString()} shares</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Odd Lot Board</span>
              <span className={`font-medium ${boardSplit.oddLotQty > 0 ? 'text-warning' : 'text-foreground'}`}>{boardSplit.oddLotQty.toLocaleString()} shares</span>
            </div>
            {boardSplit.oddLotQty > 0 && (
              <p className="text-[10px] text-warning mt-1">⚠ Odd lots may take longer to fill as they trade on a separate board</p>
            )}
          </div>
        )}

        {/* Price Type */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Price Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setOrderType("limit")} className={`ring-btn py-2.5 text-sm font-medium ${orderType === "limit" ? "ring-btn-active" : "text-white/60"}`}>Limit</button>
            <button onClick={() => setOrderType("market")} disabled={marketStatus && !marketStatus.trading_allowed}
              className={`ring-btn py-2.5 text-sm font-medium disabled:opacity-40 ${orderType === "market" ? "ring-btn-active" : "text-white/60"}`}>Market</button>
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Price (ZMW)</label>
          {orderType === 'market' ? (
            <div className="ring-btn px-4 py-3 text-sm text-white/60">At market price (~K{selectedStock?.last_price?.toFixed(2) || '0.00'})</div>
          ) : (
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder={selectedStock ? `K${selectedStock.last_price?.toFixed(2)}` : 'Enter price'}
              className="ring-btn w-full px-4 py-3 text-sm placeholder:text-white/40 focus:outline-hidden" />
          )}
        </div>

        {/* Qualifier */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Order Qualifier</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['day', 'gtd', 'fok', 'ioc'] as OrderQualifier[]).map(q => (
              <div key={q} className="relative">
                <button onClick={() => setQualifier(q)}
                  className={`ring-btn w-full py-2.5 text-xs font-medium ${qualifier === q ? "ring-btn-active" : "text-white/60"}`}>
                  {q.toUpperCase()}
                </button>
                <button onClick={() => setShowQualifierInfo(showQualifierInfo === q ? null : q)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-card border border-border rounded-full flex items-center justify-center">
                  <Info className="w-2.5 h-2.5 text-muted-foreground" />
                </button>
                {showQualifierInfo === q && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-card border border-border rounded-lg p-2 shadow-lg">
                    <p className="text-[10px] text-muted-foreground">{qualifierTooltips[q]}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* GTD date */}
        {qualifier === 'gtd' && (
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              <Calendar className="w-3 h-3 inline mr-1" /> Expiry Date
            </label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              min={minExpiry} max={maxExpiry}
              className="ring-btn w-full px-4 py-3 text-sm focus:outline-hidden" />
          </div>
        )}

        {/* Fee breakdown */}
        {fees && consideration > 0 && (
          <div className="hairline-top pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Order Value</span><span className="text-foreground font-medium">{formatZMW(consideration)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">SEC Fee (0.125%)</span><span className="text-foreground">{formatZMW(fees.secFee)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">LuSE Fee (0.25%)</span><span className="text-foreground">{formatZMW(fees.luseFee)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Broker Fee (1%)</span><span className="text-foreground">{formatZMW(fees.brokerFee)}</span></div>
            <div className="border-t border-border my-1" />
            <div className="flex justify-between"><span className="text-muted-foreground">Total Fees (1.375%)</span><span className="text-foreground font-medium">{formatZMW(fees.totalFees)}</span></div>
            <div className="flex justify-between font-bold">
              <span className="text-foreground">{side === 'buy' ? 'Total Cost' : 'Net Proceeds'}</span>
              <span className="text-primary">{formatZMW(fees.netValue)}</span>
            </div>
            <div className="flex justify-between pt-1"><span className="text-muted-foreground">Wallet balance</span><span className="text-muted-foreground">{formatZMW(walletBalance ?? 0)}</span></div>
            {side === 'buy' && walletBalance != null && (consideration + (fees?.totalFees ?? 0)) > walletBalance && (
              <p className="text-[11px] text-warning mt-1">Insufficient balance — server will re-verify at submission.</p>
            )}
          </div>
        )}

        {/* Settlement */}
        {consideration > 0 && (
          <div className="text-xs">
            <span className="text-primary font-medium">Est. settlement (T+3): {settlementDate}</span>
            <p className="text-muted-foreground mt-0.5">Shares credited to your CSD account on this date</p>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{e}</p>
            ))}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading}
          className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${side === 'buy' ? 'bg-success text-white' : 'bg-destructive text-white'} disabled:opacity-50`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Post Order'}
        </button>
        {/* FIX I: inline market-closed notice — server enforces 09:00–14:00 CAT */}
        {isMarketClosedKnown && (
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Market closed — orders accepted 09:00–14:00 CAT
          </p>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl p-5 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Confirm Order</h3>
              <button onClick={() => setConfirmOpen(false)} className="p-2 -m-2" aria-label="Close">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Action</span><span className={`font-bold ${side === 'buy' ? 'text-success' : 'text-destructive'}`}>{side.toUpperCase()} {Number(volume).toLocaleString()} shares</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span className="text-foreground font-medium">{selectedStock?.symbol}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="text-foreground">{orderType} | {qualifier.toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="text-foreground">{orderType === 'limit' ? formatZMW(Number(price)) : 'Market'}</span></div>
              {fees && <>
                <div className="flex justify-between"><span className="text-muted-foreground">Order Value</span><span className="text-foreground">{formatZMW(consideration)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Fees (1.375%)</span><span className="text-foreground">{formatZMW(fees.totalFees)}</span></div>
              </>}
              <div className="flex justify-between"><span className="text-muted-foreground">Est. settlement</span><span className="text-primary">{settlementDate}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium">Cancel</button>
              <button onClick={() => { HapticFeedback.medium(); confirmOrder(); }} disabled={loading}
                className={`flex-1 py-3 rounded-xl text-sm font-bold text-white ${side === 'buy' ? 'bg-success' : 'bg-destructive'} disabled:opacity-50`}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ATSTrade;
