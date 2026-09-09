/**
 * MIDDLEWARE / TRADING API CLIENT
 *
 * This is the single place the frontend talks to the trading backend
 * (market data, orders, portfolio, CSD, settlement, admin). It is written as
 * a real HTTP client and is **backend-agnostic**: point it at any API that
 * implements the documented paths below.
 *
 *   VITE_API_BASE_URL        e.g. https://api.example.com   (REST base)
 *   VITE_MIDDLEWARE_WS_URL   e.g. wss://api.example.com/ws  (optional, live pushes)
 *
 * When VITE_API_BASE_URL is blank, every REST call rejects with
 * `BACKEND_NOT_CONFIGURED` and WebSocket subscriptions are no-ops. Callers
 * already handle that path (fallback prices, empty lists, disabled actions),
 * so the UI stays clickable with no network traffic.
 *
 * Contract notes for whoever wires the backend:
 *  - All responses are JSON. Non-2xx should carry `{ error: string }`.
 *  - Auth: the current session access token is sent as `Authorization: Bearer`.
 *  - Money is sent/received as decimal numbers in ZMW; the server is the
 *    authority for fees, balances and fills.
 *  - Every request is aborted after REQUEST_TIMEOUT_MS.
 *
 * Endpoint map (relative to VITE_API_BASE_URL):
 *   GET  /api/health
 *   GET  /api/fix/status
 *   GET  /api/fix/trades
 *   GET  /api/csd/status
 *   POST /api/csd/register                     { userId }
 *   GET  /api/market/data
 *   GET  /api/market/symbol/:symbol
 *   GET  /api/market/orderbook/:symbol
 *   GET  /api/market/ohlcv/:symbol?days=
 *   GET  /api/market/snapshots
 *   GET  /api/market/lasi?days=
 *   GET  /api/market/bonds?days=
 *   GET  /api/market/fx?days=
 *   GET  /api/market/instruments
 *   GET  /api/market/sessions
 *   GET  /api/market/session-status
 *   GET  /api/market/halts
 *   POST /api/orders/client                    (place order, see PlaceOrderInput)
 *   GET  /api/orders/client/:userId/open
 *   GET  /api/orders/client/:userId/history
 *   GET  /api/orders/client/:userId/portfolio
 *   POST /api/orders/:clOrdId/cancel           { userId }
 *   GET  /api/settlement/client/:userId?limit=
 *   GET  /api/settlement
 *   GET  /api/admin/clients?page=&limit=
 *   GET  /api/admin/clients/:userId
 *   POST /api/admin/clients/:userId/approve    { notes }
 *   POST /api/admin/clients/:userId/reject     { reason }
 *   POST /api/auth/signin | /api/auth/signup | /api/auth/otp/request
 *        /api/auth/otp/verify | /api/auth/refresh
 *   POST /api/translate | /api/translate/batch
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

function buildUrl(path: string, query?: Query) {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; query?: Query } = {},
): Promise<T> {
  if (!BASE) throw new Error(BACKEND_NOT_CONFIGURED);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(path, opts.query), {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });

    const text = await res.text();
    const data = text ? safeJson(text) : null;

    if (!res.ok) {
      const message =
        (data && (data.error || data.message)) || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('The server took too long to respond.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ─────────────────────────────────────────────────────────── types
export interface MiddlewareOrder {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: 'market' | 'limit';
  price?: string;
  accountId: string;
  clientId: string;
}

export interface MiddlewareOrderResponse {
  success: boolean;
  clOrdId?: string;
  fixSent?: boolean;
  orderStatus?: string;
  queued?: boolean;
  status?: string;
  error?: string;
}

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
  positions: any[];
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPct: number;
}

export interface SettlementResponse {
  rows: any[];
  summary: {
    total: number;
    pending: number;
    dueToday: number;
    settled: number;
    pendingValue: number;
  };
}

// ─────────────────────────────────────────────────────────── client
export const middlewareClient = {
  // health / status
  health: () => request<any>('/api/health'),
  fixStatus: () => request<any>('/api/fix/status'),
  csdStatus: () => request<any>('/api/csd/status'),
  sessions: () => request<any>('/api/market/sessions'),
  sessionStatus: () => request<any>('/api/market/session-status'),
  halts: () => request<any>('/api/market/halts'),

  // reference / market data
  instruments: () => request<any>('/api/market/instruments'),
  getMarketData: () => request<any>('/api/market/data'),
  getSymbol: (symbol: string) => request<any>(`/api/market/symbol/${encodeURIComponent(symbol)}`),
  getOrderBook: (symbol: string) =>
    request<any>(`/api/market/orderbook/${encodeURIComponent(symbol)}`),
  getOhlcv: (symbol: string, days = 90) =>
    request<any>(`/api/market/ohlcv/${encodeURIComponent(symbol)}`, { query: { days } }),
  getSnapshots: () => request<any>('/api/market/snapshots'),
  getLasiHistory: (days = 90) => request<any>('/api/market/lasi', { query: { days } }),
  getBondsHistory: (days = 30) => request<any>('/api/market/bonds', { query: { days } }),
  getFxHistory: (days = 30) => request<any>('/api/market/fx', { query: { days } }),

  // trading
  placeClientOrder: (o: PlaceOrderInput) =>
    request<PlaceOrderResult>('/api/orders/client', { method: 'POST', body: o }),
  getClientOpenOrders: (userId: string) =>
    request<{ orders: any[] }>(`/api/orders/client/${encodeURIComponent(userId)}/open`),
  getClientHistory: (userId: string) =>
    request<{ orders: any[] }>(`/api/orders/client/${encodeURIComponent(userId)}/history`),
  cancelClientOrder: (clOrdId: string, userId: string) =>
    request<any>(`/api/orders/${encodeURIComponent(clOrdId)}/cancel`, {
      method: 'POST',
      body: { userId },
    }),
  getTrades: () => request<any>('/api/fix/trades'),
  getClientPortfolio: (userId: string) =>
    request<PortfolioResponse>(`/api/orders/client/${encodeURIComponent(userId)}/portfolio`),

  // settlement
  getMarketSettlement: (userId: string, limit = 100) =>
    request<SettlementResponse>(`/api/settlement/client/${encodeURIComponent(userId)}`, {
      query: { limit },
    }),
  listSettlements: () => request<any>('/api/settlement'),

  // CSD
  csdRegister: (userId: string) =>
    request<{ status?: string; success: boolean; bpid?: string; statusCode?: string; error?: string }>(
      '/api/csd/register',
      { method: 'POST', body: { userId } },
    ),

  // admin
  adminListClients: (page = 1, limit = 50) =>
    request<any>('/api/admin/clients', { query: { page, limit } }),
  adminGetClient: (userId: string) =>
    request<any>(`/api/admin/clients/${encodeURIComponent(userId)}`),
  adminApproveClient: (userId: string, notes = '') =>
    request<any>(`/api/admin/clients/${encodeURIComponent(userId)}/approve`, {
      method: 'POST',
      body: { notes },
    }),
  adminRejectClient: (userId: string, reason: string) =>
    request<any>(`/api/admin/clients/${encodeURIComponent(userId)}/reject`, {
      method: 'POST',
      body: { reason },
    }),

  // auth (optional — only if the backend owns identity instead of the data client)
  signIn: (identifier: string, password: string) =>
    request<any>('/api/auth/signin', { method: 'POST', body: { identifier, password } }),
  requestOTP: (identifier: string) =>
    request<{ message: string; channel: string; message_id?: string }>('/api/auth/otp/request', {
      method: 'POST',
      body: { identifier },
    }),
  verifyOTP: (identifier: string, token: string) =>
    request<any>('/api/auth/otp/verify', { method: 'POST', body: { identifier, token } }),
  refreshSession: (refresh_token: string) =>
    request<any>('/api/auth/refresh', { method: 'POST', body: { refresh_token } }),
  signupWithPhone: (data: { full_name: string; phone?: string; email?: string; password: string }) =>
    request<any>('/api/auth/signup', { method: 'POST', body: data }),

  // translation (falls through to the original text when unavailable)
  translateText: async (text: string, target: string, source = 'en'): Promise<string> => {
    if (!BASE) return text;
    try {
      const r = await request<{ text?: string }>('/api/translate', {
        method: 'POST',
        body: { text, target, source },
      });
      return r?.text ?? text;
    } catch {
      return text;
    }
  },
  translateBatch: async (texts: string[], target: string, source = 'en'): Promise<string[]> => {
    if (!BASE) return texts;
    try {
      const r = await request<{ texts?: string[] }>('/api/translate/batch', {
        method: 'POST',
        body: { texts, target, source },
      });
      return r?.texts ?? texts;
    } catch {
      return texts;
    }
  },
};

// ─────────────────────────────────────────────── live updates (WebSocket)
/**
 * Generic subscription helper. Opens a socket to VITE_MIDDLEWARE_WS_URL,
 * sends a `{ type: 'subscribe', ... }` frame and forwards matching messages.
 * Returns a cleanup function. No-op when the WS URL is not configured.
 */
function subscribe(
  payload: Record<string, unknown>,
  match: (msg: any) => boolean,
  onUpdate: (data: any) => void,
): () => void {
  if (!WS_URL) return () => {};

  let socket: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;

  const connect = () => {
    if (closed) return;
    try {
      socket = new WebSocket(WS_URL);
    } catch {
      return;
    }
    socket.onopen = () => {
      attempts = 0;
      socket?.send(JSON.stringify({ type: 'subscribe', ...payload }));
    };
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (match(msg)) onUpdate(msg.data ?? msg);
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onclose = () => {
      if (closed) return;
      const delay = Math.min(30000, 1000 * 2 ** attempts++);
      retry = setTimeout(connect, delay);
    };
    socket.onerror = () => socket?.close();
  };

  connect();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    socket?.close();
  };
}

export function subscribeOrderUpdates(userId: string, onUpdate: (data: any) => void): () => void {
  return subscribe(
    { channel: 'orders', userId },
    (m) => m?.channel === 'orders' || m?.type === 'order_update',
    onUpdate,
  );
}

export function subscribeOrderBookUpdates(
  symbol: string,
  onUpdate: (data: any) => void,
): () => void {
  return subscribe(
    { channel: 'orderbook', symbol },
    (m) =>
      (m?.channel === 'orderbook' || m?.type === 'orderbook_update') &&
      (!m?.symbol || m.symbol === symbol),
    onUpdate,
  );
}

// ── Legacy-compatible helpers ─────────────────
export async function checkMiddlewareHealth(): Promise<{
  status: string;
  mode?: string;
  fixLoggedIn?: boolean;
}> {
  if (!BASE) return { status: 'offline', fixLoggedIn: false };
  try {
    const r: any = await middlewareClient.health();
    return { status: r?.status || 'ok', mode: r?.mode, fixLoggedIn: !!r?.fixLoggedIn };
  } catch {
    return { status: 'offline', fixLoggedIn: false };
  }
}

export async function getMarketData() {
  try {
    const data = await middlewareClient.getMarketData();
    return { success: true, ...(data as object) };
  } catch (e: any) {
    return { success: false, error: e?.message || BACKEND_NOT_CONFIGURED };
  }
}

export async function getStockPrice(symbol: string) {
  try {
    const data = await middlewareClient.getSymbol(symbol);
    return { success: true, ...(data as object) };
  } catch (e: any) {
    return { success: false, error: e?.message || BACKEND_NOT_CONFIGURED };
  }
}

export async function testMiddlewareConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!BASE) return { ok: false, error: BACKEND_NOT_CONFIGURED };
  try {
    await middlewareClient.health();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}
