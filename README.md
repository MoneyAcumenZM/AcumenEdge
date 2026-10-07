# AcumenEdge

AcumenEdge is a **phone app** by Money Acumen for trading and investing on the
Lusaka Securities Exchange (LuSE).

This repository is the **frontend only**: the screens and the client code that
talks to the backend services. It is a React web app that is **wrapped into
Android and iOS apps with [Median.co](https://median.co)**. It is not meant to
be released or used as a website.

```
 This repo  ──npm run build──▶  dist/  ──host on HTTPS──▶  https://your-app-host
                                                                  │
                                    Median.co wraps that URL ◀────┘
                                                                  │
                                       Android (.aab)  +  iOS (.ipa)
```

---

## Contents

1. [Run it on your computer](#1-run-it-on-your-computer)
2. [Release it as a phone app with Median](#2-release-it-as-a-phone-app-with-median)
3. [Configuration](#3-configuration)
4. [How the code is organised](#4-how-the-code-is-organised)
5. [What is built in](#5-what-is-built-in)
6. [Before you release](#6-before-you-release)
7. [Quality checks](#7-quality-checks)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Run it on your computer

You need **Node.js 22.12 or newer** and **npm 10 or newer**.

```sh
git clone <YOUR_GIT_URL> acumenedge
cd acumenedge
npm install
npm run dev          # opens on http://localhost:8080
```

That's all you need to look around. With nothing configured, the app runs on
a **local stand-in** instead of a real backend:

- any email and password signs you in;
- there is **no sample data**, so prices, charts and the wallet are empty or
  show "Unavailable";
- nothing is sent anywhere.

Use it to review screens and flows. To see real data, point it at real
services (section 3).

To see it the way a phone does, open your browser's developer tools and
switch to a phone-sized view. The layouts are built for phone screens only.

**Windows users:** if you use WSL, clone into the Linux side (`~/`), not
`/mnt/c/...`. The dev server is many times slower on the Windows drive.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run locally on port 8080 |
| `npm run build` | Check types, then make the production build in `dist/`. This is the build you release. |
| `npm run build:dev` | Development build. It uses the local stand-in and **accepts any login. Never release it.** |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | Lint; any error or warning fails |
| `npm run typecheck` | TypeScript check (strict mode) |
| `npm test` | Unit tests |

---

## 2. Release it as a phone app with Median

The app reaches users **only** through the Median-wrapped Android and iOS
apps. Median loads the hosted production build inside a native app shell.
There are no `android/` or `ios/` folders in this repository, and there should
not be; Median produces the native apps.

### Step 1 — Make the production build

Put the production settings in `.env` (section 3), then:

```sh
npm run build
```

This creates `dist/`. If no backend is configured, the build still completes,
but the app shows **"Service unavailable"** when opened. That is deliberate:
a production build never runs without a real backend.

### Step 2 — Host `dist/` on HTTPS

Upload `dist/` to a static host that supports:

- **HTTPS**;
- the `public/_headers` file, which carries the app's security headers;
- the `public/_redirects` file, which sends every route to `index.html`.

Netlify and Cloudflare Pages read both files as they are. On another host,
set the same headers and the same "all routes go to `index.html`" rule
yourself.

### Step 3 — Set up the app in Median

In the Median dashboard (App Studio):

1. Create the app and set its **website URL** to the HTTPS address from
   step 2.
2. Set the **app name** to AcumenEdge, plus the **Android package name** and
   **iOS bundle ID** you will register with Google and Apple.
3. Add the **icons** and **splash screen**. The theme colour is `#021e05`.
4. Enable Median's **biometrics (Face ID / Touch ID / fingerprint) plugin**,
   and allow your app's domain in its settings. Biometric sign-in in the app
   only works when this is on.
5. Set link handling so that only your app's domain opens inside the app.

The app does **not** load any Median script itself. Median injects its
JavaScript bridge (`window.median`) into the app, and the app uses it for
biometrics.

### Step 4 — Build, sign and publish

From Median, build the **Android `.aab`** and the **iOS app**. Sign and
publish them with the company's own **Google Play** and **Apple Developer**
accounts.

### Updating the app later

Because Median loads the hosted build, most updates are just:

```sh
npm run build    # then upload the new dist/ to the same host
```

Users get the change the next time they open the app; no store release is
needed. Rebuild in Median only when you change something Median controls
(name, icons, plugins, permissions).

---

## 3. Configuration

Settings live in a `.env` file. Copy the template (`cp .env.example .env`)
and uncomment what you need. Settings are **built into** the app when you
run `npm run build`, so rebuild after changing them.

Everything here ends up inside the app, where anyone can read it. **Never put
a secret key in `.env`.**

| Setting | What it is for |
| --- | --- |
| `VITE_BACKEND_PROVIDER` | Which data backend to use: `custom` (your own, through `src/integrations/data/customClient.ts`) or `supabase` (the default) |
| `VITE_SUPABASE_URL` | Only with `supabase`: the project address |
| `VITE_SUPABASE_ANON_KEY` | Only with `supabase`: the public ("anon") key |
| `VITE_API_BASE_URL` | Address of the trading, wallet and audit API |
| `VITE_MIDDLEWARE_WS_URL` | WebSocket address for live order updates (`wss://` only) |

### Where the app connects

| Connection | File | Settings |
| --- | --- | --- |
| Sign-in and data | `src/integrations/data/client.ts` | `VITE_BACKEND_PROVIDER` (+ `VITE_SUPABASE_*` for Supabase) |
| Trading and market data | `src/services/middlewareClient.ts` | `VITE_API_BASE_URL`, `VITE_MIDDLEWARE_WS_URL` |
| Wallet and payments | `src/services/dpoService.ts` | `VITE_API_BASE_URL` |

**The comment at the top of each of these three files is the exact contract**
for that connection: every endpoint, table, realtime feed and storage bucket
the app uses, what it sends, and which response fields it reads. Nothing
else in the app talks to a backend. Until a connection is configured, its
screens still open and show a clear "not available" message instead of
failing.

### Connecting a backend

**The app is not tied to any backend.** The data side can be anything:
your own API, Firebase, .NET, Node, or Supabase. Supabase is simply the
option that needs no extra code.

1. Choose the data backend:
   - **Your own:** set `VITE_BACKEND_PROVIDER=custom` and write the adapter
     in `src/integrations/data/customClient.ts`. It turns the app's data
     calls into requests to your API. Copy `localClient.ts` in the same
     folder as a starting point: it already answers every call the app
     makes, so you only swap where the data comes from.
   - **Supabase:** set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. No
     code needed. In the Supabase dashboard, add
     `<app address>/reset-password` to the allowed redirect URLs.
2. Keep `src/integrations/data/schema.ts` matching the rows your backend
   returns, then run `npm run typecheck`. Every data query in the app is
   checked against that file, so a missing table or column shows up as an
   error before anyone runs the app.
3. Let new users sign in straight after sign-up. Otherwise they can only
   upload their KYC documents after confirming their email.
4. Fill in `.env` and restart `npm run dev`.
5. **Trading and wallet API:** implement the endpoints listed in
   `middlewareClient.ts` and `dpoService.ts`, including the
   `Idempotency-Key` header on orders and withdrawals.
6. Sign in and walk through: market list → stock → place an order → My
   Orders → wallet → withdraw.

---

## 4. How the code is organised

The code is grouped **by feature**. Everything for one area of the app lives
in one folder under `src/features/`. Only code shared by several features
sits at the top level of `src/`.

```
public/                 static files, _headers, _redirects, manifest
src/
  main.tsx              entry point
  app/App.tsx           providers, routes and layout
  features/
    auth/               sign-in/up, password reset, KYC states, PIN, biometrics
    home/               home screen and first-run tutorial
    market/             stocks, stock detail, sectors, bonds, news, securities,
                        announcements, dividends, watchlist
    trading/            trade page, quick order ticket, orders, trade history,
                        shared pre-order checks (lib/orderLimits.ts)
    portfolio/          holdings and performance
    wallet/             deposit and withdraw
    charts/             charts and analysis mode
    profile/            profile and settings
    admin/              broker KYC review
  components/           shared UI (ui/ = shadcn components, layout/ = navigation)
  contexts/             app-wide state: auth, trading-API status, UI
  hooks/                shared hooks (data queries, idempotency keys, ...)
  integrations/data/    data client (db), schema, local stand-in, your-backend adapter
  services/             HTTP clients: trading API, wallet/payments, haptics
  lib/                  shared helpers: config, audit, schemas, security, formatting
  pages/                standalone pages (not found, maintenance)
  styles/               global CSS and theme
```

Inside a feature you'll find `pages/`, `components/`, `hooks/` and, where
needed, `services/` or `lib/`. Tests sit next to the file they test
(`*.test.ts`). Imports use `@/` for `src/`.

---

## 5. What is built in

### Screens

- **Account:** sign-up with KYC documents, sign-in, password reset, "under
  review" and "rejected" screens, PIN lock, biometric sign-in (inside the
  Median app only), and a profile page with sensitive fields masked.
- **PIN:** the user sets one up from Profile when they choose to. The app
  never prompts for it on its own. The only time it is asked for is when the
  user starts a withdrawal without one; withdrawals require a PIN.
- **Market:** stock list, stock detail, sectors, all securities, news,
  announcements, watchlist, charts and an analysis mode with drawing tools
  and indicators.
- **Trading:** a trade page and a quick order ticket (from Market and
  Watchlist), both with a confirmation step, plus open orders, cancelling and
  trade history.
- **Wallet:** balance, withdrawals (PIN required), and deposit screens.
  Deposits are switched off for now.
- **Admin:** KYC approval screen for broker staff.

### Safety checks before an order is sent

Both order screens run the same checks, from one file
(`src/features/trading/lib/orderLimits.ts`), and refuse the order if any fail:

- KYC approved (a missing status counts as not approved);
- CSD account registered;
- account not suspended or restricted;
- market open;
- order value at most K500,000;
- limit price within 20% of the market price;
- enough wallet balance for a buy, including fees (an unknown balance counts
  as not enough);
- enough settled shares for a sell.

These checks protect the user in the app. **The backend must enforce the same
rules**, because anything in a phone app can be bypassed.

### Protection against duplicates

Every order and withdrawal carries an **idempotency key**. The key stays the
same if the user retries after a timeout, so the server can recognise a
repeat and process it only once.

### Security

- A production build will not run without a real backend.
- Scripts load only from the app itself; connections are encrypted only
  (`https` / `wss`); other sites cannot embed the app.
- No national ID, tax ID, bank details, date of birth or next-of-kin data is
  stored on the device. Admin access is checked with the server on every
  session and never stored on the device.
- Sensitive fields are masked; revealing one is recorded as an audit event.
- Audit events are sent to the API (`POST /api/audit/events`) and retried if
  sending fails.
- The app signs out after inactivity, locks behind the user's PIN once they
  have set one, and hides its content when sent to the background.
- A wallet balance that fails to load shows "Unavailable", never K0.00. The
  app never shows made-up prices or sample data.

---

## 6. Before you release

- [ ] A real backend is configured and the production build was made with
      `npm run build` (never `build:dev`).
- [ ] The backend enforces the same order and withdrawal rules as the app,
      honours the `Idempotency-Key` header, and accepts audit events.
- [ ] `dist/` is hosted on HTTPS with `_headers` and `_redirects` applied.
- [ ] Median is set up as in section 2, including the biometrics plugin.
- [ ] Biometric sign-in has been tried on a real Android and a real iPhone.
      Unit tests cover it, but only against a stand-in for Median.
- [ ] Access to the hosted address from an ordinary browser is restricted if
      required. Median loads the app from that address, so it is reachable
      outside the app unless the host blocks it.

### Not finished yet

- **Deposits** are switched off until a payment gateway is connected
  (`DEPOSITS_ENABLED` in `src/features/wallet/components/DepositScreen.tsx`).
- **Bonds** is a "coming soon" page; **Dividends** shows "—" until dividend
  data is connected.
- **Price alerts** are chart markers only; they don't notify anyone.
- **Push notifications** are not included. If wanted later, Median's
  OneSignal integration is the way to add them.
- Settlement dates are **estimates**: weekends are skipped, public holidays
  are not.
- The main JavaScript file is about 560 KB (Vite warns above 500 KB).

---

## 7. Quality checks

All of these pass, and CI (`.github/workflows/ci.yml`) runs them on every push:

```sh
npm run lint        # zero errors and zero warnings
npm run typecheck   # strict TypeScript
npm test            # unit tests
npm run build       # production build
npm audit           # known vulnerabilities in dependencies (currently 0)
```

---

## 8. Troubleshooting

- **The app shows "Service unavailable".** This is a production build without
  a backend configured. Configure the data backend (section 3) and rebuild.
- **Sign-in fails when running locally.** Check the data backend settings
  in `.env`. Leave them unset to use the local stand-in; a wrong address makes
  the app try to reach a server that isn't there.
- **Orders or withdrawals say "not available".** `VITE_API_BASE_URL` is not
  set. Deposits are also switched off in the code.
- **The Median app shows a white screen.** Check the app's console for a
  security-policy (CSP) error. `index.html` and `public/_headers` must allow
  the same things.
- **Biometric sign-in doesn't appear.** It only shows inside the Median app,
  with the biometrics plugin enabled and the user having turned it on in
  Profile.

---

Proprietary. © Money Acumen. All rights reserved.
