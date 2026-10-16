import { useCallback, useRef } from 'react';
import { sha256Hex } from '@/lib/sha256';

const STORAGE_PREFIX = 'idem:';
// Long enough to cover a user backing out and coming back to retry; short
// enough that an old key never shadows a deliberate new order.
const KEY_TTL_MS = 30 * 60 * 1000;

interface Intent {
  /**
   * SHA-256 of the intent's parameters, never the parameters: they include
   * phone and bank account numbers, which are not kept on the device.
   */
  fingerprint: string;
  key: string;
  at: number;
}

function load(scope: string): Intent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + scope);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed && typeof parsed === 'object' &&
      typeof (parsed as Intent).fingerprint === 'string' &&
      typeof (parsed as Intent).key === 'string' &&
      typeof (parsed as Intent).at === 'number' &&
      Date.now() - (parsed as Intent).at < KEY_TTL_MS
    ) {
      return parsed as Intent;
    }
    sessionStorage.removeItem(STORAGE_PREFIX + scope);
  } catch {
    /* storage unavailable: fall back to the in-memory copy */
  }
  return null;
}

function save(scope: string, intent: Intent | null) {
  try {
    if (intent) sessionStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(intent));
    else sessionStorage.removeItem(STORAGE_PREFIX + scope);
  } catch {
    /* storage unavailable: the key still lives in memory */
  }
}

/**
 * One idempotency key per order/payment *intent*.
 *
 * `keyFor(signature)` returns the same key for as long as the signature (the
 * parameters that define the intent) is unchanged, so a retry after a
 * timeout, a 5xx or a lost response replays the same request instead of
 * creating a second one. Changing any parameter starts a new intent with a
 * new key.
 *
 * Call `settle()` only when the server has given a definitive answer
 * (accepted, or refused: see `errorLeavesOutcomeUnknown`); leave the key in
 * place whenever the outcome is unknown.
 *
 * With a `scope`, the pending intent is also kept in sessionStorage, so
 * closing the screen or reloading the app between a failed attempt and the
 * retry does not lose the key. Without one it lives in memory only.
 */
export function useIdempotencyKey(scope?: string) {
  const intent = useRef<Intent | null>(null);

  const keyFor = useCallback((signature: string) => {
    const fingerprint = sha256Hex(signature);
    const current = intent.current ?? (scope ? load(scope) : null);
    if (current && current.fingerprint === fingerprint) {
      intent.current = current;
      return current.key;
    }
    const fresh: Intent = { fingerprint, key: crypto.randomUUID(), at: Date.now() };
    intent.current = fresh;
    if (scope) save(scope, fresh);
    return fresh.key;
  }, [scope]);

  const settle = useCallback(() => {
    intent.current = null;
    if (scope) save(scope, null);
  }, [scope]);

  return { keyFor, settle };
}
