/**
 * When may an idempotency key be released?
 *
 * A key must outlive every attempt whose outcome we cannot know. The server
 * may have committed the order or withdrawal before a 500/502/503 came back
 * (a gateway can fail after the upstream already acted), so a retry with a
 * fresh key could create a second one. Only a response that proves the
 * request was refused, or was completed and answered, lets the key go.
 */

/** 4xx statuses that do NOT prove the request was refused. */
const UNDECIDED_CLIENT_STATUSES = new Set([
  408, // request timeout: the server may have started work
  409, // conflict: usually "same key still in flight"
  425, // too early
  429, // rate limited: not processed, but replaying the same key is the safe retry
]);

/**
 * True when an HTTP status leaves the outcome unknown. A missing status
 * (timeout, dropped connection, unreadable response) is always unknown.
 */
export function isOutcomeUnknown(status: number | undefined | null): boolean {
  if (status == null) return true;
  if (status >= 500) return true;
  return UNDECIDED_CLIENT_STATUSES.has(status);
}

/**
 * Thrown when a 2xx response could not be understood. The server accepted
 * the request, so the order/withdrawal may well exist: the key must stay.
 */
export class ResponseShapeError extends Error {
  readonly outcomeUnknown = true;
  constructor(readonly what: string, readonly issues: string) {
    super(`The server's ${what} response was not in the expected form.`);
    this.name = 'ResponseShapeError';
  }
}

/** True for any thrown value that leaves a request's outcome unknown. */
export function errorLeavesOutcomeUnknown(error: unknown): boolean {
  if (error instanceof ResponseShapeError) return true;
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return isOutcomeUnknown(typeof status === 'number' ? status : undefined);
  }
  // Timeouts, dropped connections and anything else that is not an HTTP answer.
  return true;
}
