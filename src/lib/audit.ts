// Client-side audit reporter.
//
// An audit trail the audited user can write to directly isn't an audit
// trail, so this module never touches the database. It reports events to
// the backend (POST /api/audit/events on VITE_API_BASE_URL) using the
// signed-in user's bearer token, and the server is what makes them
// authoritative: it takes the actor from the token (never from this
// payload), stamps its own time and source IP, and stores the row with its
// own credentials. That endpoint can be implemented on any stack.
//
// Events for actions the server performs itself (order placed, withdrawal
// requested, KYC decision) should additionally be written by the server at
// the same transaction boundary as the action; what arrives from here is
// the device's account of what the user did, which is the only source for
// UI-only events such as PII_REVEALED or SESSION_TIMEOUT.
import { IS_PRODUCTION_BUILD } from '@/lib/config';
import { middlewareClient, isTradingApiConfigured, type AuditEvent } from '@/services/middlewareClient';

export type AuditAction =
  | 'SIGN_IN' | 'SIGN_IN_BIOMETRIC' | 'SIGN_IN_MYWEALTH' | 'SIGN_OUT' | 'SIGN_UP' | 'SIGN_IN_FAILED'
  | 'ORDER_PLACED' | 'ORDER_CANCEL_REQUESTED'
  | 'WITHDRAWAL_REQUESTED'
  | 'DOCUMENT_UPLOADED' | 'PROFILE_VIEWED'
  | 'STATEMENT_DOWNLOADED' | 'FRONTEND_ERROR'
  | 'SESSION_TIMEOUT' | 'ACCOUNT_SUSPENDED'
  | 'BPID_REVEALED' | 'PII_REVEALED' | 'PIN_REMOVED';

const FLUSH_INTERVAL_MS = 30_000;
// A backend outage must not grow this without bound; the oldest events are
// the ones given up when it does.
const MAX_BUFFERED_EVENTS = 200;

let buffer: AuditEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let warnedUnconfigured = false;

function scheduleFlush() {
  if (!flushTimer) flushTimer = setTimeout(() => { void flushAuditBuffer(); }, FLUSH_INTERVAL_MS);
}

async function flushAuditBuffer(keepalive = false) {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (buffer.length === 0) return;

  const batch = buffer;
  buffer = [];
  try {
    await middlewareClient.postAuditEvents(batch, keepalive);
  } catch (e) {
    // Put the batch back so the next flush retries it, and log the failure
    // loudly: an audit trail must never fail silently.
    buffer = [...batch, ...buffer].slice(-MAX_BUFFERED_EVENTS);
    console.error('[audit] could not deliver', batch.length, 'event(s); will retry:', e);
    scheduleFlush();
  }
}

// `pagehide` fires reliably on mobile where `beforeunload` doesn't, and a
// keepalive request is allowed to finish after the page is gone.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void flushAuditBuffer(true); });
}

export async function logAudit(
  action: AuditAction,
  entity?: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
) {
  if (!isTradingApiConfigured) {
    // No backend to report to. In a real production build that is a
    // deployment fault worth shouting about once; in local/demo builds it's
    // the normal case.
    if (IS_PRODUCTION_BUILD && !warnedUnconfigured) {
      warnedUnconfigured = true;
      console.error('[audit] VITE_API_BASE_URL is not set — audit events are NOT being recorded.');
    }
    return;
  }

  buffer.push({
    action,
    entity,
    entity_id: entityId ?? undefined,
    metadata,
    client_time: new Date().toISOString(),
  });
  if (buffer.length > MAX_BUFFERED_EVENTS) buffer = buffer.slice(-MAX_BUFFERED_EVENTS);

  // Events that end or precede the end of a session go out immediately,
  // while the token that authenticates them is still valid.
  const immediate: AuditAction[] = ['SIGN_IN', 'SIGN_OUT', 'SESSION_TIMEOUT', 'ACCOUNT_SUSPENDED'];
  if (immediate.includes(action)) {
    await flushAuditBuffer();
    return;
  }
  scheduleFlush();
}
