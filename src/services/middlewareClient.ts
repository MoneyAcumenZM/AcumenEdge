/**
 * TRADING API CLIENT — every call the app makes to the trading backend.
 *
 * Point it at any backend that implements the contract below:
 *
 *   VITE_API_BASE_URL        e.g. https://api.example.com   (REST)
 *   VITE_MIDDLEWARE_WS_URL   e.g. wss://api.example.com/ws  (live order updates)
 *
 * With VITE_API_BASE_URL unset, every call rejects with
 * `BACKEND_NOT_CONFIGURED` and screens show "not available"; with the WS URL
 * unset, live updates are simply off.
 *
 * ── General rules ──────────────────────────────────────────────────────────
 *  - JSON in and out. Errors: a non-2xx status with `{ "error": "message" }`
 *    (or `message`); the app shows that text to the user.
 *  - Every request carries `Authorization: Bearer <access token>` from the
 *    signed-in session. The server must take the user's identity from that
 *    token. Where a path or body below contains a userId it is for routing
 *    only: reject it if it isn't the token's user.
 *  - Money is a decimal number in ZMW. Every request times out after 8 s.
 *  - Where a response is a list, the app also accepts it wrapped as
 *    `{ "data": [...] }`.
 *
 * ── Endpoints the app calls ────────────────────────────────────────────────
 *
 * Status
 *   GET  /api/health
 *        → { status: "ok", fix: { connected, loggedIn }, csd: { connected } }
 *          Drives the "online" indicators. Polled every 30 s.
 *   GET  /api/csd/status
 *        → { csd: { lastAttempt: ISO date }, encryptionEnabled: boolean }
 *
 * Market data
 *   GET  /api/market/data
 *        → { [symbol]: Quote }         (all listed symbols)
 *   GET  /api/market/symbol/:symbol
 *        → Quote
 *          Quote = { symbol, last_price, live_price, bid_price, ask_price,
 *                    open_price, high_price, low_price, prev_close, volume,
 *                    change_percent, change_amount, timestamp: ISO date,
 *                    is_live: boolean }
 *   GET  /api/market/ohlcv/:symbol?days=N
 *        → { ohlcv: [ { trade_date: "YYYYMMDD" or ISO date, open_price,
 *                       high_price, low_price, close_price, volume } ] }
 *          Daily bars, oldest first.
 *   GET  /api/market/lasi?days=N
 *        → [ { date: "YYYY-MM-DD", close, open, high, low, volume } ]
 *          LuSE All Share Index history, oldest first.
 *   GET  /api/market/instruments
 *        → { [symbol]: { symbol, description, isin, securityType: "CS" | "CORP",
 *                        currency, maturityDate, couponRate } }
 *   GET  /api/market/sessions
 *        → [ { description } ]   current session first. `description` is a
 *          FIX TradSesStatus code ("2" = open, "4" = pre-open, "1"/"3" =
 *          closed) or a name such as "continuous", "pre_open", "closing".
 *          Orders are blocked unless the session is open.
 *   GET  /api/market/halts
 *        → [ { symbol } ]   symbols currently halted
 *
 * Orders
 *   POST /api/orders/client          header: Idempotency-Key: <uuid>
 *        body PlaceOrderInput = { clientId, symbol, side: "buy" | "sell",
 *             quantity, orderType: "limit" | "market", price?,
 *             qualifier?: "day" | "gtd" | "fok" | "ioc" }
 *        → { status: "ok", clOrdId, orderStatus: "pending" | "queued",
 *            fixSent: boolean, message? }
 *          The same Idempotency-Key must always return the same order: the
 *          app reuses the key when the user retries after a timeout.
 *          403 { message } when the market is closed (shown verbatim).
 *   GET  /api/orders/client/:userId/open
 *        → { orders: [ { client_order_id, symbol, side, quantity, status } ] }
 *   GET  /api/orders/client/:userId/history
 *        → { orders: [ { id, clOrdId, symbol, side, quantity, price,
 *                        timestamp: ISO date } ] }   executed trades
 *   GET  /api/orders/client/:userId/portfolio
 *        → { positions: [ { symbol, quantity, pendingQty, avgPrice, cost,
 *                           marketValue, pnl, pnlPct, currentPrice,
 *                           csdStatus: "csd_deposited" | "pending_deposit"
 *                                      | "not_deposited" } ] }
 *          `quantity` is the settled quantity; sells are checked against it.
 *   POST /api/orders/:clOrdId/cancel     body { userId }
 *
 * Account
 *   POST /api/auth/signup     body { full_name, email, phone, password }
 *        Creates the sign-in account (409 if the email exists). Used only
 *        when this API is configured; otherwise sign-up goes straight to the
 *        data backend. The account must be able to sign in immediately.
 *   POST /api/csd/register    no body; the user comes from the token.
 *        → { success: true, bpid }    (409 { bpid } if already registered)
 *          The server records csd_registered / csd_bpid /
 *          csd_registration_status on the profile itself.
 *   POST /api/audit/events    body { events: [ { action, entity?, entity_id?,
 *                                     metadata?, client_time } ] }
 *        The server adds the user (from the token), its own timestamp and
 *        the source IP, and stores the events.
 *
 * Admin (broker staff only — the server must check the role)
 *   GET  /api/admin/clients?page=&limit=
 *        → { clients: [ { user_id, full_name, email, phone, kyc_status,
 *                         csd_registration_status, created_at } ] }
 *   POST /api/admin/clients/:userId/approve   body { notes }
 *   POST /api/admin/clients/:userId/reject    body { reason }
 *
 * Live order updates (WebSocket)
 *   POST /api/ws/ticket   body { channel: "orders" } → { ticket }
 *        A short-lived, single-use ticket bound to the token's user.
 *   Then connect to VITE_MIDDLEWARE_WS_URL?ticket=<ticket> and the app sends
 *   { type: "subscribe", channel: "orders" }. Send frames as
 *   { channel: "orders", userId?, data: { status, reason?, filledQty?,
 *     quantity? } }. The server decides what a socket may receive from the
 *   ticket alone; the app never sends a user id.
 */

export const BACKEND_NOT_CONFIGURED = 'BACKEND_NOT_CONFIGURED';
export const REQUEST_TIMEOUT_MS = 8000;

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';
const WS_URL = (import.meta.env.VITE_MIDDLEWARE_WS_URL as string | undefined) || '';

/** True when a trading backend is wired up. UI can use this to hide actions. */
export const isTradingApiConfigured = Boolean(BASE);

/** Set by the auth layer so requests are authenticated. */
let accessToken: string | null = null;
export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

type Query = Record<string, string | number | boolean | undefined>;

/**
 * A JSON object whose exact shape is owned by the backend. Fields are
 * `unknown` on purpose: callers have to narrow them (see lib/apiShape.ts)
 * before they reach UI state, rather than trusting whatever came back.
 */
export interface ApiRecord {
  [key: string]: unknown;
}

/** Thrown for every non-2xx response, carrying the status and parsed body. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: ApiRecord | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function buildUrl(path: string, query?: Query) {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}?${qs}` : url;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** Lets the request outlive the page (used for the unload audit flush). */
  keepalive?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!BASE) throw new Error(BACKEND_NOT_CONFIGURED);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(path, opts.query), {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
      keepalive: opts.keepalive,
    });

    const text = await res.text();
    const data = text ? safeJson(text) : null;

    if (!res.ok) {
      const body = data && typeof data === 'object' ? (data as ApiRecord) : null;
      const message = body?.error || body?.message;
      throw new ApiError(
        typeof message === 'string' && message ? message : `Request failed (${res.status})`,
        res.status,
        body,
      );
    }
    return data as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('The server took too long to respond.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ─────────────────────────────────────────────────────────── types
export interface PlaceOrderInput {
  clientId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: 'limit' | 'market';
  price?: number;
  qualifier?: 'day' | 'gtd' | 'fok' | 'ioc';
}

export interface PlaceOrderResult {
  status?: string;
  clOrdId?: string;
  orderStatus?: string;
  fixSent?: boolean;
  queued?: boolean;
  message?: string;
  error?: string;
}

export interface PortfolioResponse {
  positions: ApiRecord[];
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPct: number;
}

export interface CsdRegisterResult {
  status?: string | number;
  success: boolean;
  bpid?: string;
  statusCode?: string;
  error?: string;
}

/** One client-reported audit event. The server adds actor, time and IP. */
export interface AuditEvent {
  action: string;
  entity?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  /** When the event happened on the device — informational only. */
  client_time: string;
}

// ─────────────────────────────────────────────────────────── client
export const middlewareClient = {
  // health / status
  health: () => request<ApiRecord>('/api/health'),
  csdStatus: () => request<ApiRecord>('/api/csd/status'),
  sessions: () => request<unknown>('/api/market/sessions'),
  halts: () => request<unknown>('/api/market/halts'),

  // reference / market data
  instruments: () => request<unknown>('/api/market/instruments'),
  getMarketData: () => request<ApiRecord>('/api/market/data'),
  getSymbol: (symbol: string) => request<ApiRecord>(`/api/market/symbol/${encodeURIComponent(symbol)}`),
  getOhlcv: (symbol: string, days = 90) =>
    request<unknown>(`/api/market/ohlcv/${encodeURIComponent(symbol)}`, { query: { days } }),
  getLasiHistory: (days = 90) => request<unknown>('/api/market/lasi', { query: { days } }),

  // trading
  // `idempotencyKey` is generated once per order intent by the caller and
  // reused for every retry of that same intent, so a timeout, double-tap or
  // lost response can never turn one order into two.
  placeClientOrder: (o: PlaceOrderInput, idempotencyKey: string) =>
    request<PlaceOrderResult>('/api/orders/client', {
      method: 'POST',
      body: o,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  getClientOpenOrders: (userId: string) =>
    request<{ orders: ApiRecord[] }>(`/api/orders/client/${encodeURIComponent(userId)}/open`),
  getClientHistory: (userId: string) =>
    request<{ orders: ApiRecord[] }>(`/api/orders/client/${encodeURIComponent(userId)}/history`),
  cancelClientOrder: (clOrdId: string, userId: string) =>
    request<ApiRecord>(`/api/orders/${encodeURIComponent(clOrdId)}/cancel`, {
      method: 'POST',
      body: { userId },
    }),
  getClientPortfolio: (userId: string) =>
    request<PortfolioResponse>(`/api/orders/client/${encodeURIComponent(userId)}/portfolio`),

  // CSD
  csdRegister: () => request<CsdRegisterResult>('/api/csd/register', { method: 'POST' }),

  // audit
  postAuditEvents: (events: AuditEvent[], keepalive = false) =>
    request<{ accepted?: number }>('/api/audit/events', {
      method: 'POST',
      body: { events },
      keepalive,
    }),

  // admin
  adminListClients: (page = 1, limit = 50) =>
    request<ApiRecord>('/api/admin/clients', { query: { page, limit } }),
  adminApproveClient: (userId: string, notes = '') =>
    request<ApiRecord>(`/api/admin/clients/${encodeURIComponent(userId)}/approve`, {
      method: 'POST',
      body: { notes },
    }),
  adminRejectClient: (userId: string, reason: string) =>
    request<ApiRecord>(`/api/admin/clients/${encodeURIComponent(userId)}/reject`, {
      method: 'POST',
      body: { reason },
    }),

  // account
  signupWithPhone: (data: { full_name: string; phone?: string; email?: string; password: string }) =>
    request<ApiRecord>('/api/auth/signup', { method: 'POST', body: data }),
};

// ─────────────────────────────────────────────── live updates (WebSocket)
/**
 * Generic subscription helper. Fetches a single-use ticket over the
 * authenticated REST channel, opens a socket to VITE_MIDDLEWARE_WS_URL with
 * it, sends a `{ type: 'subscribe', ... }` frame and forwards matching
 * messages. A fresh ticket is fetched for every (re)connect. Returns a
 * cleanup function. No-op when the WS URL is not configured.
 *
 * The subscribe frame never names a user: whose data a socket may see is
 * decided by the server from the ticket, not by anything the client sends.
 */
function subscribe(
  payload: Record<string, unknown>,
  match: (msg: ApiRecord) => boolean,
  onUpdate: (data: ApiRecord) => void,
): () => void {
  if (!WS_URL) return () => {};

  let socket: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;

  const scheduleReconnect = () => {
    if (closed) return;
    const delay = Math.min(30000, 1000 * 2 ** attempts++);
    retry = setTimeout(connect, delay);
  };

  const connect = async () => {
    if (closed) return;
    let ticket: string | undefined;
    try {
      ticket = (await request<{ ticket?: string }>('/api/ws/ticket', { method: 'POST', body: payload }))?.ticket;
    } catch {
      ticket = undefined;
    }
    if (closed) return;
    if (!ticket) {
      // No ticket means no authenticated socket — never fall back to an
      // anonymous connection.
      scheduleReconnect();
      return;
    }
    try {
      socket = new WebSocket(`${WS_URL}${WS_URL.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`);
    } catch {
      scheduleReconnect();
      return;
    }
    socket.onopen = () => {
      attempts = 0;
      socket?.send(JSON.stringify({ type: 'subscribe', ...payload }));
    };
    socket.onmessage = (e) => {
      try {
        const msg: unknown = JSON.parse(e.data);
        if (!msg || typeof msg !== 'object') return;
        const record = msg as ApiRecord;
        if (!match(record)) return;
        const data = record.data;
        onUpdate(data && typeof data === 'object' ? (data as ApiRecord) : record);
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onclose = scheduleReconnect;
    socket.onerror = () => socket?.close();
  };

  connect();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    socket?.close();
  };
}

/**
 * Order updates for the signed-in user. `userId` is not sent to the server;
 * it is only used to drop any frame that names a different user, in case a
 * misbehaving server fans out more than it should.
 */
export function subscribeOrderUpdates(userId: string, onUpdate: (data: ApiRecord) => void): () => void {
  return subscribe(
    { channel: 'orders' },
    (m) => {
      if (m.channel !== 'orders' && m.type !== 'order_update') return false;
      const owner = m.userId ?? m.user_id;
      return owner == null || owner === userId;
    },
    onUpdate,
  );
}

// ── Connection check ─────────────────
export async function testMiddlewareConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!BASE) return { ok: false, error: BACKEND_NOT_CONFIGURED };
  try {
    await middlewareClient.health();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : undefined };
  }
}
