/**
 * WALLET + PAYMENTS CLIENT — every call the app makes for the wallet,
 * deposits and withdrawals.
 *
 *   VITE_API_BASE_URL   e.g. https://api.example.com   (same API as trading)
 *
 * With it unset, deposits and withdrawals end with "Payments are not
 * connected yet" and the balance shows "Unavailable".
 *
 * ── General rules ──────────────────────────────────────────────────────────
 *  - JSON in and out, `Authorization: Bearer <access token>` on every call,
 *    8 s timeout. Errors: non-2xx with `{ "error": "message" }`.
 *  - 401 or 403 means the session has expired: the app sends the user to
 *    sign in again.
 *  - Money is a decimal number in ZMW. Phone numbers are sent in the
 *    12-digit 260 format (e.g. 260971234567).
 *
 * ── Endpoints the app calls ────────────────────────────────────────────────
 *
 *   GET  /api/wallet
 *        → { balance, currency: "ZMW", transactions: [ { id, type, amount,
 *            status, createdAt, description? } ] }
 *          `balance` is the amount available to spend; buys are checked
 *          against it. Polled every 30 s.
 *
 *   POST /api/wallet/withdraw        header: Idempotency-Key: <uuid>
 *        body { amount, method: "mobile_money" | "bank",
 *               mobileNumber?, mobileProvider?: "Airtel" | "MTN" | "Zamtel",
 *               bankName?, bankAccount?, bankBranch? }
 *        → { transactionId, status: "pending", newBalance?, message? }
 *          The same Idempotency-Key must always return the same withdrawal:
 *          the app reuses it when the user retries after a timeout. The PIN
 *          the user enters is checked on the phone only; any server-side
 *          step-up check is the server's to add.
 *
 * Deposits (switched off in the app for now — DEPOSITS_ENABLED in
 * DepositScreen.tsx — but wired to these endpoints):
 *   POST /api/wallet/deposit          body { amount, currency: "ZMW", reference? }
 *        → { payUrl, transactionToken, reference }   card: the app opens payUrl
 *   POST /api/wallet/deposit/mobile   body { amount, mobileNumber, provider }
 *        → { transactionToken, status: "awaiting_approval", message? }
 *   GET  /api/wallet/deposit/:token/verify
 *        → { status: "completed" | "pending" | "failed", newBalance?,
 *            explanation? }   polled every 4 s while the user approves
 *   POST /api/wallet/deposit/:token/cancel
 *        → { success }
 *   The payment gateway's callback to the server is what credits the
 *   wallet; the app's verify polling only updates the screen. After a card
 *   payment the gateway returns the user to /wallet/deposit-complete or
 *   /wallet/deposit-cancelled.
 */


const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';
const TIMEOUT_MS = 8000;

export type PaymentMethod = 'mobile_money' | 'card' | 'bank_transfer';
export type MobileNetwork = 'Airtel' | 'MTN' | 'Zamtel';

export const SESSION_EXPIRED = 'SESSION_EXPIRED';
export const NETWORK_ERROR =
  "Can't reach the server right now. Check your connection and try again.";
export const PAYMENTS_UNCONFIGURED = 'Payments are not connected yet.';

let accessToken: string | null = null;
/** Called by the auth layer so wallet requests are authenticated. */
export function setPaymentsAccessToken(token: string | null) {
  accessToken = token;
}

type Result = { success: boolean; error?: string; sessionExpired?: boolean; networkError?: boolean };

type Call<T> = { ok: true; data: T } | { ok: false; result: Result };

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Call<T>> {
  if (!BASE) return { ok: false, result: { success: false, error: PAYMENTS_UNCONFIGURED } };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, result: { success: false, error: SESSION_EXPIRED, sessionExpired: true } };
    }

    const text = await res.text();
    let data: { error?: string; message?: string } | null = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        result: {
          success: false,
          error: data?.error || data?.message || `Request failed (${res.status})`,
        },
      };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      result: {
        success: false,
        error: aborted ? NETWORK_ERROR : (err instanceof Error && err.message) || NETWORK_ERROR,
        networkError: true,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface InitiateDepositParams {
  amount: number;
  currency?: string;
  reference?: string;
}

export interface InitiateDepositResult extends Result {
  payUrl?: string;
  transactionToken?: string;
  reference?: string;
  transactionId?: string;
  amount?: number;
}

export interface InitiateMobileDepositResult extends InitiateDepositResult {
  status?: 'awaiting_approval' | string;
  message?: string;
}

export interface VerifyDepositResult extends Result {
  status?: 'completed' | 'pending' | string;
  newBalance?: number;
  amount?: number;
  dpoResult?: string;
  explanation?: string;
}

export interface WalletResponse {
  balance: number;
  currency: string;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
    description?: string;
  }>;
}

export interface WithdrawParams {
  amount: number;
  method: 'mobile_money' | 'bank';
  mobileNumber?: string;
  mobileProvider?: MobileNetwork;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  /** Generated once per withdrawal attempt and reused across retries so a
   * network retry or double-submit can't create two withdrawal requests. */
  idempotencyKey?: string;
}

export interface WithdrawResult extends Result {
  transactionId?: string;
  newBalance?: number;
  status?: 'pending' | string;
  message?: string;
}

/** Zambian numbers are normalised to the 12-digit 260 format before sending. */
export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('260')) return digits;
  if (digits.startsWith('0')) return '260' + digits.slice(1);
  return '260' + digits;
}

export async function getWallet(): Promise<WalletResponse> {
  const r = await call<WalletResponse>('/api/wallet');
  if (r.ok === false) {
    // A failed or unconfigured read is thrown, never turned into a K0.00
    // balance: callers show "Unavailable" and refuse to act on a number
    // nobody actually confirmed.
    throw new Error(r.result.error || NETWORK_ERROR);
  }
  return {
    balance: Number(r.data?.balance ?? 0),
    currency: r.data?.currency || 'ZMW',
    transactions: Array.isArray(r.data?.transactions) ? r.data.transactions : [],
  };
}

export async function initiateDeposit(
  params: InitiateDepositParams,
): Promise<InitiateDepositResult> {
  const r = await call<InitiateDepositResult>('/api/wallet/deposit', {
    method: 'POST',
    body: { currency: 'ZMW', ...params },
  });
  if (r.ok === false) return r.result;
  return { ...r.data, success: r.data?.success ?? true };
}

export async function initiateMobileDeposit(params: {
  amount: number;
  mobileNumber: string;
  provider: MobileNetwork;
}): Promise<InitiateMobileDepositResult> {
  const r = await call<InitiateMobileDepositResult>('/api/wallet/deposit/mobile', {
    method: 'POST',
    body: { ...params, mobileNumber: normalisePhone(params.mobileNumber) },
  });
  if (r.ok === false) return r.result;
  return { status: 'awaiting_approval', ...r.data, success: r.data?.success ?? true };
}

export async function verifyDeposit(transToken: string): Promise<VerifyDepositResult> {
  const r = await call<VerifyDepositResult>(
    `/api/wallet/deposit/${encodeURIComponent(transToken)}/verify`,
  );
  if (r.ok === false) return r.result;
  return { ...r.data, success: r.data?.success ?? true };
}

export async function cancelDeposit(
  transToken: string,
): Promise<{ success: boolean; error?: string }> {
  const r = await call<{ success: boolean }>(
    `/api/wallet/deposit/${encodeURIComponent(transToken)}/cancel`,
    { method: 'POST' },
  );
  if (r.ok === false) return { success: false, error: r.result.error };
  return { success: true };
}

export async function requestWithdrawal(params: WithdrawParams): Promise<WithdrawResult> {
  // The idempotency key travels as a header, not in the body.
  const { idempotencyKey, ...details } = params;
  const body =
    details.method === 'mobile_money' && details.mobileNumber
      ? { ...details, mobileNumber: normalisePhone(details.mobileNumber) }
      : details;
  const r = await call<WithdrawResult>('/api/wallet/withdraw', {
    method: 'POST',
    body,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
  if (r.ok === false) return r.result;
  return { status: 'pending', ...r.data, success: r.data?.success ?? true };
}
