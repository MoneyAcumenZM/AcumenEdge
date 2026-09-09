/**
 * WALLET + PAYMENTS SERVICE
 *
 * Backend-agnostic HTTP client for the wallet (balance, transactions),
 * deposits (mobile money + card) and withdrawals. Wire it to any gateway by
 * implementing the endpoints below and setting:
 *
 *   VITE_API_BASE_URL   e.g. https://api.example.com
 *
 * When the base URL is blank, every call resolves with
 * `{ success: false, error: PAYMENTS_UNCONFIGURED }` (and getWallet returns an
 * empty wallet) so screens render and stay clickable without any network calls.
 *
 * Endpoint map (relative to VITE_API_BASE_URL):
 *   GET  /api/wallet                       -> WalletResponse
 *   POST /api/wallet/deposit               { amount, currency, reference }        -> { payUrl, transactionToken, reference }
 *   POST /api/wallet/deposit/mobile        { amount, mobileNumber, provider }     -> { transactionToken, status: 'awaiting_approval' }
 *   GET  /api/wallet/deposit/:token/verify -> { status: 'completed'|'pending'|'failed', newBalance, amount }
 *   POST /api/wallet/deposit/:token/cancel -> { success }
 *   POST /api/wallet/withdraw              WithdrawParams                          -> { transactionId, status: 'pending', newBalance }
 *
 * Rules the backend must own (do not move these into the client):
 *  - The gateway callback is the ONLY authoritative credit of a deposit; the
 *    frontend verify poll is UX feedback only.
 *  - Mobile money deposits start as `awaiting_approval` until the customer
 *    approves the push prompt; card deposits return a hosted `payUrl`.
 *  - Withdrawals must be validated against the available (not total) balance
 *    and require a freshly entered PIN; max 2 saved bank accounts per user.
 *  - Store money as integer ngwee server-side; this client exchanges decimals.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';
const TIMEOUT_MS = 8000;

export const isPaymentsConfigured = Boolean(BASE);

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
  init: { method?: string; body?: unknown } = {},
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
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, result: { success: false, error: SESSION_EXPIRED, sessionExpired: true } };
    }

    const text = await res.text();
    let data: any = null;
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
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      result: {
        success: false,
        error: aborted ? NETWORK_ERROR : err?.message || NETWORK_ERROR,
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
  if (!r.ok) return { balance: 0, currency: 'ZMW', transactions: [] };
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
  return { success: true, ...r.data };
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
  return { success: true, status: 'awaiting_approval', ...r.data };
}

export async function verifyDeposit(transToken: string): Promise<VerifyDepositResult> {
  const r = await call<VerifyDepositResult>(
    `/api/wallet/deposit/${encodeURIComponent(transToken)}/verify`,
  );
  if (r.ok === false) return r.result;
  return { success: true, ...r.data };
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
  const body =
    params.method === 'mobile_money' && params.mobileNumber
      ? { ...params, mobileNumber: normalisePhone(params.mobileNumber) }
      : params;
  const r = await call<WithdrawResult>('/api/wallet/withdraw', { method: 'POST', body });
  if (r.ok === false) return r.result;
  return { success: true, status: 'pending', ...r.data };
}

export function formatWalletAmount(amount: number, currency = 'ZMW'): string {
  const fixed = amount.toLocaleString('en-ZM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'ZMW' ? `K${fixed}` : `${currency} ${fixed}`;
}
