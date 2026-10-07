import { useCallback, useRef } from 'react';

/**
 * One idempotency key per order/payment *intent*.
 *
 * `keyFor(signature)` returns the same key for as long as the signature (the
 * parameters that define the intent) is unchanged, so a retry after a
 * timeout or a lost response replays the same request instead of creating a
 * second one. Changing any parameter starts a new intent with a new key.
 *
 * Call `settle()` once the server has given a definitive answer (accepted
 * or rejected); leave the key in place when the outcome is unknown.
 */
export function useIdempotencyKey() {
  const intent = useRef<{ signature: string; key: string } | null>(null);

  const keyFor = useCallback((signature: string) => {
    if (intent.current?.signature !== signature) {
      intent.current = { signature, key: crypto.randomUUID() };
    }
    return intent.current.key;
  }, []);

  const settle = useCallback(() => {
    intent.current = null;
  }, []);

  return { keyFor, settle };
}
