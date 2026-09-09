# Connecting a Backend to AcumenEdge Circle (frontend)

The app currently runs **frontend-only**. All data access goes through one
module, so wiring a real backend is an env-var change, not a refactor.

## 1. The single switch

`src/integrations/supabase/client.ts`

- Reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- Both set and the URL is http(s) → a real Supabase client is created
  (PKCE flow, session in `sessionStorage`).
- Either missing → falls back to `src/integrations/supabase/localClient.ts`,
  a localStorage-backed stub that implements the same surface
  (`from().select/insert/update/delete`, `auth`, `channel`, `functions`,
  `storage`) and makes **zero** network calls.

`isBackendConfigured` is exported if any UI wants to show a "demo mode" hint.

To go live:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=<ref>
```

Restart the dev server / rebuild. Nothing else in `src/` needs to change.

## 2. Tables the frontend expects

Schema shapes live in `src/integrations/supabase/types.ts` (keep it in sync,
or regenerate from the new project). Tables read/written by the UI:

| Table | Used by |
| --- | --- |
| `profiles` | auth bootstrap, Profile page, KYC fields |
| `stocks` | Market, Charts, Screener, Watchlist |
| `stock_prices` | intraday/historical charts |
| `orders` | Trade ticket, Orders page, order lifecycle |
| `trades` | trade history |
| `holdings` | Portfolio, wallet valuation |
| `portfolio_snapshots` | performance history chart |
| `watchlist` | Watchlist page, star toggles |
| `price_alerts` | alerts on charts + notifications |
| `wallet_transactions` | wallet ledger, deposits/withdrawals |
| `bank_accounts` | withdrawals (max 2 per user) |
| `notifications`, `notification_preferences` | notification centre + settings |
| `market_news` | Market News page + home widget |
| `user_roles` | admin-only screens (roles must live here, never on `profiles`) |

Every table needs RLS scoped to `auth.uid()`, plus explicit
`GRANT`s to `authenticated` (and `anon` only for genuinely public reads such
as `stocks` / `market_news`).

## 3. Server-side pieces to re-create

The frontend calls these via `supabase.functions.invoke`. Until they exist the
stub returns a clear "not available" error, so the UI degrades instead of
crashing.

- `submit-order`: validated order placement (atomic balance/holdings check).
- `fix-bridge-webhook`: execution/fill ingestion, idempotent.
- `dpo-callback`: payment gateway callback; the **authoritative** wallet credit.
- `get-circle-accounts`: admin-only, verified JWT, PII stripped.
- `seed-stock-prices`: historical price backfill for charts.

Money must be handled in integer ngwee server-side (see the previous
`_shared/money.ts` pattern), never floats.

## 4. Optional middleware (LuSE / FIX / payments)

`src/services/middlewareClient.ts` is currently a disabled stub: every REST
method rejects with "Middleware is disabled" and WebSocket subscriptions are
no-ops, so callers use their fallbacks (`stocks.last_price`, empty order lists).

To re-enable, restore the fetch implementations behind
`VITE_API_BASE_URL` / `VITE_MIDDLEWARE_WS_URL` and keep the rule that the
browser never calls LuSE directly, always proxy through server functions.

## 5. Payments (Zynle Pay)

`src/services/dpoService.ts` holds the frontend contract:

- `initiateDeposit` → mobile money returns `awaiting_approval`; card returns a
  hosted `payUrl` (opened in-app on Capacitor).
- `verifyDeposit` is polled for ~3 minutes purely for UX. The gateway callback
  is what actually credits the wallet.
- Withdrawals require available balance plus a fresh PIN, max 2 saved bank
  accounts.

All requests use an 8s `AbortController` timeout.

## 6. Sanity checklist after connecting

1. Sign in with a real user; `sessionStorage` holds the session (never localStorage).
2. Profile loads, KYC status renders.
3. Market list and a chart populate.
4. Place a test order → appears in Orders with correct status colour.
5. Deposit flow reaches the gateway and the wallet reflects the callback.
6. Realtime: an inserted `notifications` row appears without refresh.

---

## Where every screen gets its data (integration map)

The frontend has exactly three seams. Implement these and the whole app goes live,
no component changes needed.

| Seam | File | Env var |
| --- | --- | --- |
| Auth + tables (profiles, watchlist, alerts, notifications, news) | `src/integrations/supabase/client.ts` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Market data, charts, orders, portfolio, settlement, CSD, admin | `src/services/middlewareClient.ts` | `VITE_API_BASE_URL`, `VITE_MIDDLEWARE_WS_URL` (optional) |
| Wallet, deposits, withdrawals | `src/services/dpoService.ts` | `VITE_API_BASE_URL` |

Both service files carry the full endpoint map, request/response shapes and the
server-side rules (authoritative deposit callback, integer ngwee, order gating)
in their header comments. Read those first.

### Behaviour when env vars are blank
- REST calls reject with `BACKEND_NOT_CONFIGURED` / resolve as
  `{ success: false, error: PAYMENTS_UNCONFIGURED }`.
- WebSocket subscriptions are no-ops and return a cleanup function.
- Screens render, charts show empty/fallback series, and every button remains
  clickable and shows the error surface instead of hanging.

### Auth token propagation
`AuthContext` pushes the current session access token into both service clients
(`setApiAccessToken`, `setPaymentsAccessToken`) on every auth state change, so
requests go out as `Authorization: Bearer <token>`.

### Feature flags for UI
- `isBackendConfigured` (data client): auth/tables available.
- `isTradingApiConfigured` (middleware client): orders/market data available.
- `isPaymentsConfigured` (payments): deposit/withdraw available.

### Live updates
`subscribeOrderUpdates(userId, cb)` and `subscribeOrderBookUpdates(symbol, cb)`
open one socket to `VITE_MIDDLEWARE_WS_URL`, send
`{ type: 'subscribe', channel, ... }` and reconnect with exponential backoff
(capped at 30s). Server frames should look like
`{ channel: 'orders' | 'orderbook', symbol?, data: {...} }`.

---

## Frontend security posture

Client-side checks are a UX layer only. The backend must re-validate everything.

- **Sanitisers**: `src/utils/sanitize.ts` (text, name, email, phone, amount,
  search, account number, PIN) and `src/lib/sanitize.ts` (DOMPurify text, URL,
  filename, injection probe). Apply them in the input `onChange`, not just on
  submit, so bad characters never reach state.
- **Schemas**: `src/utils/validation.ts` (login, signup, trade, deposit,
  withdraw, profile) and `src/lib/schemas.ts` (signup steps, order, sign-in).
  Use `validate(schema, data)`; check `result.success === false` for errors.
- **Applied at**: sign-in (schema + sanitised email, `maxLength` caps),
  deposit (numeric-only amount, single decimal point, 12-char cap, phone
  formatter), withdrawal (numeric amount, sanitised bank name/branch,
  alphanumeric account number, sanitised mobile number), order ticket and
  sign-up (already schema-driven).
- **No unsafe HTML**: no `dangerouslySetInnerHTML` with user content anywhere;
  any future rich text must go through DOMPurify first.
- **Open-redirect guard**: the sign-in `next` parameter is only honoured when
  it is a same-origin relative path.
- **Headers** (`index.html`): `Content-Security-Policy` (`object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, broad `connect-src` so any backend
  host works), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy` allowing camera only for KYC selfies and denying
  microphone/geolocation. `frame-ancestors *` is intentional so the Lovable
  preview can embed the app; tighten it in production hosting if desired.
- **Backend must still enforce**: row-level authorisation, order limits and
  market-hours gates, deposit crediting via the gateway callback only,
  withdrawal balance + fresh-PIN checks, and integer-ngwee money maths.
