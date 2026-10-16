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
 *  - 401 means the session has expired: the app sends the user to sign in
 *    again. So does a 403 without a step-up `code` (see POST
 *    /api/auth/step-up below).
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
 *   POST /api/auth/step-up
 *        body { purpose: "withdrawal", pin, amount, method, destination }
 *          `destination` is the mobile number (260 format) or the bank
 *          account number the money is going to.
 *        → { token, expiresIn? }   a single-use token, valid for about 2
 *          minutes, bound by the server to this user, this purpose, this
 *          amount and this destination. The server checks the PIN against
 *          its own record and enforces its own attempt limit:
 *          401 { code: "step_up_invalid" } wrong PIN
 *          429 { code: "step_up_locked" }  too many attempts
 *          409 { code: "pin_not_enrolled" } no PIN on the server yet
 *   PUT  /api/auth/pin
 *        body { pin }  → 204. Enrols (or replaces) the server's copy of the
 *          PIN when the user sets one in the app. The server decides what
 *          to require for this (e.g. a recent password sign-in); it must
 *          store only a salted slow hash of the PIN.
 *
 *   POST /api/wallet/withdraw        header: Idempotency-Key: <uuid>
 *                                    header: X-Step-Up-Token: <token>
 *        body { amount, method: "mobile_money" | "bank",
 *               mobileNumber?, mobileProvider?: "Airtel" | "MTN" | "Zamtel",
 *               bankName?, bankAccount?, bankBranch? }
 *        → { transactionId, status: "pending", newBalance?, message? }
 *          The server MUST NOT release money without a valid step-up token
 *          for exactly this amount and destination, and consumes the token.
 *          403 { code: "step_up_required" | "step_up_invalid" |
 *                      "step_up_expired" } sends the user back to enter the
 *          PIN again.
 *          The same Idempotency-Key must always return the same withdrawal
 *          (and must be answered from the stored result before the token is
 *          checked, because the token of the first attempt is already spent):
 *          the app keeps the key and reuses it after a timeout, a dropped
 *          connection or ANY 5xx, since the withdrawal may have been
 *          committed before the error was returned. It only discards the key
 *          after a 2xx or a 4xx other than 408/409/425/429.
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


import {
  parseWalletTransactions,
  depositInitSchema,
  depositVerifySchema,
  parseApi,
  stepUpSchema,
  walletSchema,
  withdrawResultSchema,
} from '@/lib/apiSchemas';
import { isOutcomeUnknown, ResponseShapeError } from '@/lib/idempotency';

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

type Result = {
  success: boolean;
  error?: string;
  sessionExpired?: boolean;
  networkError?: boolean;
  /** HTTP status of a non-2xx answer. */
  httpStatus?: number;
  /** The server's machine-readable reason, when it gave one. */
  code?: string;
  /**
   * True when nobody can tell whether the server acted (timeout, dropped
   * connection, 5xx, an unreadable 2xx). The idempotency key must be kept.
   */
  outcomeUnknown?: boolean;
};

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

    const text = await res.text().catch(() => '');
    let data: { error?: string; message?: string; code?: string } | null = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    const code = typeof data?.code === 'string' ? data.code : undefined;
    const isStepUp = code !== undefined && code.startsWith('step_up_');
    // A wrong step-up PIN is a 401 and a missing token a 403, but both carry
    // a step_up_* code and are not a lapsed session.
    if ((res.status === 401 || res.status === 403) && !isStepUp) {
      return { ok: false, result: { success: false, error: SESSION_EXPIRED, sessionExpired: true, httpStatus: res.status } };
    }

    if (!res.ok) {
      return {
        ok: false,
        result: {
          success: false,
          error: data?.error || data?.message || `Request failed (${res.status})`,
          httpStatus: res.status,
          code,
          outcomeUnknown: isOutcomeUnknown(res.status),
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
        outcomeUnknown: true,
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
  /** Single-use token from requestStepUp(), bound to this withdrawal. Required: no token, no request. */
  stepUpToken: string;
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
  // A response without a usable balance is an error, not a K0.00 wallet.
  const wallet = parseApi(walletSchema, r.data, 'wallet');
  const { transactions, rejected } = parseWalletTransactions(wallet.transactions);
  if (rejected > 0) console.warn(`[wallet] ${rejected} transaction row(s) were malformed and left out.`);
  return { balance: wallet.balance, currency: wallet.currency, transactions };
}

export async function initiateDeposit(
  params: InitiateDepositParams,
): Promise<InitiateDepositResult> {
  const r = await call<unknown>('/api/wallet/deposit', {
    method: 'POST',
    body: { currency: 'ZMW', ...params },
  });
  if (r.ok === false) return r.result;
  try {
    const parsed = parseApi(depositInitSchema, r.data, 'deposit');
    return { ...parsed, success: parsed.success ?? true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Could not start the deposit.' };
  }
}

export async function initiateMobileDeposit(params: {
  amount: number;
  mobileNumber: string;
  provider: MobileNetwork;
}): Promise<InitiateMobileDepositResult> {
  const r = await call<unknown>('/api/wallet/deposit/mobile', {
    method: 'POST',
    body: { ...params, mobileNumber: normalisePhone(params.mobileNumber) },
  });
  if (r.ok === false) return r.result;
  try {
    const parsed = parseApi(depositInitSchema, r.data, 'deposit');
    return { status: 'awaiting_approval', ...parsed, success: parsed.success ?? true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Could not start the deposit.' };
  }
}

export async function verifyDeposit(transToken: string): Promise<VerifyDepositResult> {
  const r = await call<VerifyDepositResult>(
    `/api/wallet/deposit/${encodeURIComponent(transToken)}/verify`,
  );
  if (r.ok === false) return r.result;
  try {
    const parsed = parseApi(depositVerifySchema, r.data, 'deposit');
    return { ...parsed, success: parsed.success ?? true };
  } catch (e) {
    // Never report a deposit as complete on an answer that can't be read.
    return { success: false, error: e instanceof Error ? e.message : 'Could not verify the deposit.' };
  }
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

export interface StepUpParams {
  pin: string;
  amount: number;
  method: 'mobile_money' | 'bank';
  /** Normalised mobile number, or the bank account number. */
  destination: string;
}

export interface StepUpResult extends Result {
  token?: string;
}

/**
 * Asks the server to check the user's PIN and issue a single-use token for
 * one specific withdrawal. The PIN is only ever sent over this request.
 */
export async function requestStepUp(params: StepUpParams): Promise<StepUpResult> {
  const r = await call<unknown>('/api/auth/step-up', {
    method: 'POST',
    body: { purpose: 'withdrawal', ...params },
  });
  if (r.ok === false) return r.result;
  try {
    const { token } = parseApi(stepUpSchema, r.data, 'step-up');
    return { success: true, token };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Step-up failed.' };
  }
}

/** Gives the server its own copy of the PIN so it can verify step-up itself. */
export async function enrolServerPin(pin: string): Promise<Result> {
  const r = await call<unknown>('/api/auth/pin', { method: 'PUT', body: { pin } });
  if (r.ok === false) return r.result;
  return { success: true };
}

export async function requestWithdrawal(params: WithdrawParams): Promise<WithdrawResult> {
  // The idempotency key and step-up token travel as headers, not in the body.
  const { idempotencyKey, stepUpToken, ...details } = params;
  const body =
    details.method === 'mobile_money' && details.mobileNumber
      ? { ...details, mobileNumber: normalisePhone(details.mobileNumber) }
      : details;
  const r = await call<WithdrawResult>('/api/wallet/withdraw', {
    method: 'POST',
    body,
    headers: {
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      'X-Step-Up-Token': stepUpToken,
    },
  });
  if (r.ok === false) return r.result;
  try {
    const parsed = parseApi(withdrawResultSchema, r.data, 'withdrawal');
    return { ...parsed, status: parsed.status ?? 'pending', success: parsed.success ?? true };
  } catch (e) {
    // The server accepted the request but the answer is unreadable: the
    // withdrawal may exist, so this must not look like a clean failure.
    if (e instanceof ResponseShapeError) {
      return {
        success: false,
        outcomeUnknown: true,
        error: 'We could not confirm your withdrawal. Check your transactions before trying again.',
      };
    }
    throw e;
  }
}
