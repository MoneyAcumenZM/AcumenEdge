// ══════════════════════════════════════════════════════════════════════════════
// AcumenEdge Global Configuration
// Change these settings in ONE place to control platform behavior.
// ══════════════════════════════════════════════════════════════════════════════

// Market hours enforced via live FIX session data — not forced open.
export const MARKET_ALWAYS_OPEN = false;

// Live trading mode — orders are sent to the exchange via middleware.
export const PAPER_TRADING_MODE = false;

// Vite ties import.meta.env.PROD/DEV to the COMMAND (`vite build` vs
// `vite dev`), not to the --mode flag — so `vite build --mode development`
// (this project's "build:dev" script, used for local/demo/native-app-preview
// builds with no real backend configured) still has PROD === true and
// DEV === false. Several places in this codebase need to distinguish "a
// real production build" from "a build meant for local/demo use even though
// it went through `vite build`" — for that distinction, check MODE (which
// DOES respect --mode) instead of PROD/DEV directly.
export const IS_PRODUCTION_BUILD = import.meta.env.MODE === 'production';

/** localStorage flag set once the first-run tutorial has been completed. */
export const TUTORIAL_KEY = 'circle_tutorial_done';
