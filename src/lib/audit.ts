type SupabaseClient = any;

export type AuditAction =
  | 'SIGN_IN' | 'SIGN_IN_BIOMETRIC' | 'SIGN_IN_MYWEALTH' | 'SIGN_OUT' | 'SIGN_UP' | 'SIGN_IN_FAILED'
  | 'ORDER_PLACED' | 'ORDER_CANCEL_REQUESTED'
  | 'DOCUMENT_UPLOADED' | 'PROFILE_VIEWED'
  | 'STATEMENT_DOWNLOADED' | 'FRONTEND_ERROR'
  | 'SESSION_TIMEOUT' | 'ACCOUNT_SUSPENDED'
  | 'BPID_REVEALED';

interface AuditEntry {
  user_id: string | undefined;
  action: AuditAction;
  entity?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  user_agent: string;
  created_at: string;
}

// ─── Batched audit log writer ───
// Collects events for 30 seconds and writes them in a single batch insert.
let auditBuffer: AuditEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let supabaseRef: SupabaseClient | null = null;

async function flushAuditBuffer() {
  if (auditBuffer.length === 0) {
    flushTimer = null;
    return;
  }
  const batch = [...auditBuffer];
  auditBuffer = [];
  flushTimer = null;

  if (!supabaseRef) return;
  try {
    await supabaseRef.from('audit_logs').insert(batch as any);
  } catch {
    if (import.meta.env.DEV) {
      console.warn('Audit batch flush failed, dropped', batch.length, 'events');
    }
  }
}

// Flush on page unload so we don't lose events
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (auditBuffer.length > 0 && supabaseRef) {
      // Use sendBeacon-style sync attempt via navigator
      const batch = [...auditBuffer];
      auditBuffer = [];
      try {
        // Best-effort flush — won't always succeed
        supabaseRef.from('audit_logs').insert(batch as any);
      } catch { /* silent */ }
    }
  });
}

export async function logAudit(
  supabase: SupabaseClient,
  userId: string,
  action: AuditAction,
  entity?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  supabaseRef = supabase;
  auditBuffer.push({
    user_id: userId || undefined,
    action,
    entity,
    entity_id: entityId,
    metadata,
    user_agent: navigator.userAgent,
    created_at: new Date().toISOString(),
  });

  // Critical actions flush immediately
  const immediateActions: AuditAction[] = ['SIGN_IN', 'SIGN_OUT', 'SESSION_TIMEOUT', 'ACCOUNT_SUSPENDED'];
  if (immediateActions.includes(action)) {
    if (flushTimer) clearTimeout(flushTimer);
    await flushAuditBuffer();
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(flushAuditBuffer, 30_000);
  }
}
