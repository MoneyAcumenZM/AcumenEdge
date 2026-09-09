# AcumenEdge (MoneyAcumen)

Frontend for **MoneyAcumen**, a LuSE-focused trading and investment app. The
web app is built with Vite + React + TypeScript and packaged for Android / iOS
via **Median.co** (webview wrapper). The codebase originated in **Lovable** and
is still editable there; do not remove the Lovable dev tooling unless you are
also detaching the project from Lovable.

---

## About the app

**AcumenEdge** is a retail trading and investment app for the **Lusaka
Securities Exchange (LuSE)**. It ships as a Progressive Web App and as native
Android / iOS builds wrapped by Median.co.

### Scope of this deliverable

This repository is the **frontend-only build**. That is the entire scope of
the task. Every screen, component, flow, and interaction is implemented and
production-ready. There is no backend in this repo and none is required to run,
demo, or ship the UI: the app boots against a `localStorage`-backed stub that
implements the same client surface as Supabase, so a fresh clone runs
end-to-end with zero configuration.

Backend, market-data, and payments integrations are **out of scope for this
codebase**. Three well-defined seams are already carved out in the source and
documented in `BACKEND.md` so a separate backend workstream (Supabase project,
LuSE trading-tunnel middleware, DPO / Zynle payments) can plug in without any
frontend changes.

### What's in the app

**Onboarding & account**
- Email/password sign-up + sign-in, forgot / reset password
- KYC-gated account states (`AccountPending`, `AccountRejected`)
- First-login setup flow, PIN setup / lock screen, biometric unlock (Capacitor)
- Profile management with sanitised inputs and schema validation

**Market & discovery**
- Market home with index, top movers, sector performance, market status banner
- Securities list, Sectors, Bonds & Bills (with bond detail page)
- Stock Screener with filters
- Charts (candlestick + universal chart component) with intraday / historical
- Market News + Announcements feed
- Analysis page, Dividends, Sessions schedule
- Watchlist (star toggles + dedicated Watchlist page + home widget)
- Price alerts wired into charts and notifications

**Trading (LuSE ATS parity)**
- Order Ticket with buy/sell, order-type, quantity, price validation
- ATS Trade, ATS Order Book, ATS My Orders, ATS Trade History
- Standalone Order Book page for depth view
- Order lifecycle states with colour-coded status
- Live subscription hooks for order + order-book updates (WebSocket-ready)

**Portfolio & wallet**
- Portfolio card + full portfolio page with holdings and P&L
- Portfolio performance chart from snapshots
- Wallet ledger (Transaction History) with deposits + withdrawals
- Deposit screen (mobile money + card via DPO), Deposit Complete / Cancelled routes
- Withdraw screen with saved bank accounts (max 2) and PIN re-verification
- Settlements and CSD communication log widget
- SWIFT Monitor screen

**Admin**
- Admin clients screen (role-gated via `user_roles` table, per `BACKEND.md`)

**Notifications**
- OneSignal web push + Capacitor native push
- In-app notification centre and preferences
- Permission banner, popup, live activity service

**Cross-cutting**
- Auth context that pushes the session token into every service client
- Error boundary, session-warning banner, maintenance route
- App tutorial / onboarding walkthrough
- Full PWA: manifest, service worker, offline-capable shell
- Strict CSP + sanitisation + Zod schemas on every input
- Native niceties: haptics, splash, status bar, image cache, network watcher

### Integration seams (for a future backend workstream)

Out of scope for this repo, but pre-wired so the frontend needs no changes
when a backend team picks them up. Full contracts in `BACKEND.md`.

| Seam | Where it plugs in | Enabled by |
| --- | --- | --- |
| **Auth + tables** | `src/integrations/supabase/client.ts` | Provisioning a Supabase project (schema in `BACKEND.md` §2, RLS on) and setting `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| **LuSE trading tunnel** | `src/services/middlewareClient.ts` | Standing up the middleware (REST + WebSocket) that fronts LuSE FIX and setting `VITE_API_BASE_URL` + `VITE_MIDDLEWARE_WS_URL` |
| **Payments (DPO / Zynle Pay)** | `src/services/dpoService.ts` | Implementing the deposit / verify / withdraw endpoints plus the authoritative `dpo-callback` Edge Function |

While each seam is unset the UI degrades gracefully. Screens render, buttons
stay clickable, and calls resolve with a clear "not configured" error instead
of hanging or crashing. This is deliberate: it lets the frontend be reviewed,
demoed, and shipped independently of the backend.

---

## Stack at a glance

| Layer | Tech |
| --- | --- |
| Frontend | Vite, React 18, TypeScript, React Router, TanStack Query |
| UI | Tailwind CSS, shadcn/ui, Radix, lucide-react |
| Data / auth | Supabase (or a local stub when env vars are blank) |
| Native shell (web-first) | Capacitor plugins (haptics, notifications, biometrics, status bar…) |
| Native app packaging | **Median.co**, wraps the web build as Android + iOS |
| Push | OneSignal (web) + Capacitor push notifications |
| Payments | DPO / Zynle Pay (via backend middleware, see `BACKEND.md`) |
| Package manager | **npm** |

The Median wrapper script `<script src="https://cdn.median.co/latest/median.min.js">`
is loaded from `index.html` and is required for the mobile builds.

---

## Prerequisites

- **Node.js** 20+ and **npm** 10+
- A Supabase project (optional; the app runs in "local stub" mode with blank env vars)
- Access to the Median.co dashboard (for producing Android/iOS builds)

---

## Getting started

```sh
# 1. Clone
git clone <YOUR_GIT_URL>
cd AcumenEdge

# 2. Install
npm install

# 3. Configure env
cp .env.example .env
# open .env and fill in your Supabase URL / anon key (see below)

# 4. Run
npm run dev            # http://localhost:8080
```

### Available scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 8080 |
| `npm run build` | Production build → `dist/` |
| `npm run build:dev` | Development-mode build (source maps, no minify) |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint |
| `npm test` | Vitest (one-shot) |
| `npm run test:watch` | Vitest in watch mode |

### Dev environment notes

**Windows + WSL developers: clone into the WSL filesystem, not `/mnt/c/`.**
Running Vite against a project sitting on the Windows drive (`/mnt/c/Users/...`)
routes every file read through WSL's 9P translation layer and makes the dev
server 10–100× slower (server startup ~5s vs ~350ms, HMR feels unresponsive).
Clone into `~/` on the Linux side instead:

```sh
# In WSL, not in a /mnt/c/... path
cd ~
git clone <YOUR_GIT_URL> acumenedge
cd acumenedge
npm install
npm run dev
```

Same rule for macOS/Linux users of course. No action needed there. On native
Windows (PowerShell / cmd) run Node directly on Windows; only the WSL ↔ NTFS
bridge is the slow path.

**Port.** Vite is pinned to `8080` in `vite.config.ts`. If it's already in use
Vite will pick the next free port and print it; check the console.

**Local-stub mode.** With a blank `.env` (or one where `VITE_SUPABASE_URL` is
empty / not a valid `http(s)://` URL), the app boots against a
`localStorage`-backed data client. All screens render, auth "works", data
persists across reloads on your machine. This is the intended demo mode for
reviewing the frontend before a backend exists.

---

## Environment variables

Copy `.env.example` → `.env`. Everything is prefixed `VITE_` so Vite exposes it
to the client. **Never put a service-role key or any server-side secret here.**

| Var | Required? | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Optional | Real Supabase project URL. Blank = local stub, no network. |
| `VITE_SUPABASE_ANON_KEY` | Optional | Supabase anon key. Blank = local stub. |
| `VITE_SUPABASE_PROJECT_ID` | Optional | Supabase project ref (used for typing/tooling). |
| `VITE_ONESIGNAL_APP_ID` | Optional | OneSignal web push App ID. |
| `VITE_VAPID_PUBLIC_KEY` | Optional | OneSignal VAPID **public** key (safe to expose). |
| `VITE_DPO_CURRENCY` | Optional | Currency code for payments (defaults to `ZMW`). |

Middleware env vars (`VITE_API_BASE_URL`, `VITE_MIDDLEWARE_WS_URL`,
`VITE_API_KEY`) are **intentionally left unset** in this build. The middleware
client is a no-op stub. See `BACKEND.md` for how to re-enable it.

### "Blank env vars" behaviour

`src/integrations/supabase/client.ts` inspects the Supabase env at boot. If the
URL/anon key aren't valid, it swaps in `localClient.ts`, a `localStorage`-backed
stub that implements the same surface (`from().select/insert/update/delete`,
`auth`, `channel`, `functions`, `storage`) and makes **zero** network calls.
This lets the whole UI render without a backend, and it's the default demo mode.

---

## Backend

The frontend is the only thing in this repo. Full backend contract, table
schemas, RLS expectations, Edge Functions to re-create, and the payments flow
are documented in **[`BACKEND.md`](./BACKEND.md)**. Read that first if you're
wiring a fresh Supabase project.

---

## Packaging for mobile (Median.co)

The web build is wrapped by [Median.co](https://median.co) into native iOS and
Android apps. There is **no `android/` or `ios/` folder in this repo**. Median
does the wrapping from a hosted URL / uploaded bundle.

Rough flow:

1. `npm run build` produces `dist/`.
2. Deploy `dist/` (or your Vercel/Netlify/etc. URL) somewhere Median can reach.
3. In the Median dashboard, point the app at the hosted URL and rebuild the
   Android `.aab` / iOS `.ipa`.
4. Median injects `median.min.js` (already referenced from `index.html`) so
   JS-Bridge features (status bar, haptics, splash, native tabs) work.

Capacitor plugins (`@capacitor/*`) are also installed in `package.json`. They
provide the native surface for parity if you ever choose to build a Capacitor
shell alongside / instead of Median. Nothing in `src/` assumes one wrapper over
the other; services check for the plugin at runtime and no-op on plain web.

### Native config touchpoints

- `capacitor.config.ts`: appId (`com.trader.app`), splash / status-bar colours.
  Median re-implements these from its own dashboard, but keep this file in sync
  so a future Capacitor build matches.
- `public/manifest.webmanifest`: PWA manifest.
- `public/_headers`: production CSP + security headers (deployed by hosts that
  honour `_headers`, e.g. Netlify / Cloudflare Pages).
- `index.html`: CSP meta tag, OG/Twitter cards, Median script, PWA icons.

---

## Working with Lovable

This project is still editable in Lovable. Two things must stay in place for
Lovable to work:

1. `lovable-tagger` in `vite.config.ts` (dev-only plugin, no runtime impact).
2. The `/.lovable/oauth/consent` public path allow-list entry in `src/App.tsx`.
3. `frame-ancestors` in `public/_headers` allowing `*.lovable.app` /
   `*.lovableproject.com`.

Changes pushed to this repo will reflect in Lovable, and vice-versa.

---

## Project layout

```
├── BACKEND.md              # Full backend contract, read this
├── capacitor.config.ts     # Native shell config (mirror in Median dashboard)
├── db/                     # SQL: RLS hardening migration
├── public/                 # Static assets, _headers, manifest, sw.js
├── src/
│   ├── App.tsx             # Routes + auth-gated layout
│   ├── main.tsx
│   ├── assets/             # Logos (webp preferred over png)
│   ├── components/         # UI + feature components
│   ├── contexts/           # Auth, theme, etc.
│   ├── hooks/
│   ├── integrations/
│   │   └── supabase/       # client.ts + localClient.ts stub
│   ├── lib/                # sanitise, schemas, utils
│   ├── pages/              # Route components (Market, Trade, Portfolio…)
│   ├── services/           # middlewareClient, dpoService, biometrics, push…
│   ├── theme/
│   └── utils/
└── vite.config.ts
```

---

## Security posture (frontend)

The client sanitises and schema-validates all user input before hitting state,
enforces a strict CSP via `<meta>` (index.html) + `_headers` (production),
denies `dangerouslySetInnerHTML` with user content, and guards the sign-in
`next=` redirect to same-origin paths only. **All of this is UX-layer only**.
`BACKEND.md` describes the checks the server must re-do (RLS, order limits,
market-hours gating, gateway-callback-only wallet credits, integer ngwee).

---

## Troubleshooting

- **Blank screens / auth errors on first run.** Check `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`. Blank = local stub is fine; a *malformed* URL will
  crash the Supabase client. Leave both empty for demo mode.
- **Payments / order buttons show "not available":** expected. Middleware and
  payments are disabled by default. Follow `BACKEND.md` §3–§5.
- **`lovable-tagger` errors on build.** It only runs in `mode === 'development'`;
  if you see it in a prod build, check `NODE_ENV`.
- **Median build shows a white screen.** Verify the hosted URL loads
  `median.min.js` (CSP `script-src` allows `https:`, so it should) and that the
  service worker in `public/sw.js` isn't caching a broken build.

---

## License

Proprietary. © MoneyAcumen. All rights reserved.
