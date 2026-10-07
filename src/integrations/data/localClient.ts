/**
 * LOCAL STAND-IN DATA CLIENT (development builds only)
 *
 * Implements the small data-client surface the app uses (`.from()`, `.auth`,
 * `.channel()`, `.storage`) entirely in localStorage, with no network
 * requests. client.ts selects it only when no real backend is configured,
 * and never in a production build.
 */

type Row = Record<string, unknown>;
type DB = Record<string, Row[]>;

const DB_KEY = 'circle_local_db';
const SESSION_KEY = 'circle_local_session';

const uuid = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

function readDB(): DB {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || '{}') as DB;
  } catch {
    return {};
  }
}

function writeDB(db: DB) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // Storage full or unavailable — the demo store just doesn't persist.
  }
}

function table(name: string): Row[] {
  const db = readDB();
  return Array.isArray(db[name]) ? db[name] : [];
}

function saveTable(name: string, rows: Row[]) {
  const db = readDB();
  db[name] = rows;
  writeDB(db);
}

type Filter = { col: string; op: string; val: unknown };

// Values are whatever was stored; compare them the way JavaScript's own
// relational operators would (numbers numerically, strings lexically).
const greater = (a: unknown, b: unknown) => (a as number) > (b as number);
const less = (a: unknown, b: unknown) => (a as number) < (b as number);

type QueryError = { message: string; code?: string };
type QueryResult = { data: unknown; error: QueryError | null; count?: number };

const matches = (row: Row, f: Filter): boolean => {
  const v = row[f.col];
  switch (f.op) {
    case 'eq':
      return v === f.val;
    case 'neq':
      return v !== f.val;
    case 'gt':
      return greater(v, f.val);
    case 'gte':
      return !less(v, f.val);
    case 'lt':
      return less(v, f.val);
    case 'lte':
      return !greater(v, f.val);
    case 'in':
      return Array.isArray(f.val) && f.val.includes(v);
    case 'is':
      return f.val === null ? v === null || v === undefined : v === f.val;
    case 'like':
    case 'ilike': {
      const pattern = String(f.val).replace(/%/g, '.*');
      return new RegExp(`^${pattern}$`, 'i').test(String(v ?? ''));
    }
    default:
      return true;
  }
};

class LocalQuery implements PromiseLike<QueryResult> {
  private filters: Filter[] = [];
  private orderBy: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private mode: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: Row[] = [];
  private returnSingle: 'single' | 'maybeSingle' | null = null;

  constructor(private tableName: string) {}

  // Column lists and select options are ignored: whole rows are returned.
  select() {
    return this;
  }
  insert(rows: Row | Row[]) {
    this.mode = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  // Conflict options are ignored: rows are merged by `id`.
  upsert(rows: Row | Row[]) {
    this.mode = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(vals: Row) {
    this.mode = 'update';
    this.payload = [vals];
    return this;
  }
  delete() {
    this.mode = 'delete';
    return this;
  }

  eq(col: string, val: unknown) { this.filters.push({ col, op: 'eq', val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ col, op: 'neq', val }); return this; }
  gt(col: string, val: unknown) { this.filters.push({ col, op: 'gt', val }); return this; }
  gte(col: string, val: unknown) { this.filters.push({ col, op: 'gte', val }); return this; }
  lt(col: string, val: unknown) { this.filters.push({ col, op: 'lt', val }); return this; }
  lte(col: string, val: unknown) { this.filters.push({ col, op: 'lte', val }); return this; }
  in(col: string, val: unknown[]) { this.filters.push({ col, op: 'in', val }); return this; }
  is(col: string, val: unknown) { this.filters.push({ col, op: 'is', val }); return this; }
  like(col: string, val: unknown) { this.filters.push({ col, op: 'like', val }); return this; }
  ilike(col: string, val: unknown) { this.filters.push({ col, op: 'ilike', val }); return this; }
  filter(col: string, op: string, val: unknown) { this.filters.push({ col, op, val }); return this; }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending !== false };
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range(from: number, to: number) { this.limitN = to - from + 1; return this; }

  single() { this.returnSingle = 'single'; return this; }
  maybeSingle() { this.returnSingle = 'maybeSingle'; return this; }

  private run(): QueryResult {
    let rows = table(this.tableName);

    if (this.mode === 'insert' || this.mode === 'upsert') {
      const now = new Date().toISOString();
      const inserted = this.payload.map((r) => ({ id: r.id ?? uuid(), created_at: now, ...r }));
      if (this.mode === 'upsert') {
        const byId = new Map(rows.map((r) => [r.id, r]));
        inserted.forEach((r) => byId.set(r.id, { ...(byId.get(r.id) || {}), ...r }));
        rows = Array.from(byId.values());
      } else {
        rows = [...rows, ...inserted];
      }
      saveTable(this.tableName, rows);
      return this.shape(inserted);
    }

    const selected = rows.filter((r) => this.filters.every((f) => matches(r, f)));

    if (this.mode === 'update') {
      const patch = this.payload[0] || {};
      const ids = new Set(selected.map((r) => r.id));
      const next = rows.map((r) => (ids.has(r.id) ? { ...r, ...patch } : r));
      saveTable(this.tableName, next);
      return this.shape(selected.map((r) => ({ ...r, ...patch })));
    }

    if (this.mode === 'delete') {
      const ids = new Set(selected.map((r) => r.id));
      saveTable(this.tableName, rows.filter((r) => !ids.has(r.id)));
      return this.shape(selected);
    }

    let out = [...selected];
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out.sort((a, b) => (greater(a[col], b[col]) ? 1 : less(a[col], b[col]) ? -1 : 0) * (asc ? 1 : -1));
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return this.shape(out);
  }

  private shape(rows: Row[]): QueryResult {
    if (this.returnSingle) {
      const first = rows[0] ?? null;
      if (!first && this.returnSingle === 'single') {
        return { data: null, error: { message: 'No rows found', code: 'PGRST116' }, count: 0 };
      }
      return { data: first, error: null, count: rows.length };
    }
    return { data: rows, error: null, count: rows.length };
  }

  then<R1 = QueryResult, R2 = never>(
    onfulfilled?: ((value: QueryResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    let result: QueryResult;
    try {
      result = this.run();
    } catch (e) {
      result = { data: null, error: { message: (e instanceof Error && e.message) || 'Local query failed' } };
    }
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

// ---------------------------------------------------------------- local auth
type LocalUser = { id: string; email: string; user_metadata?: Row };

type LocalSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string; user_metadata?: Row };
};

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION' | 'USER_UPDATED';
type AuthListener = (event: AuthEvent, session: LocalSession | null) => void;

const listeners = new Set<AuthListener>();

function getStoredSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LocalSession) : null;
  } catch {
    return null;
  }
}

function setStoredSession(session: LocalSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable — the demo session lasts for this page only.
  }
}

function emit(event: AuthEvent, session: LocalSession | null) {
  listeners.forEach((l) => {
    try {
      l(event, session);
    } catch {
      // One listener failing must not stop the others being told.
    }
  });
}

function makeSession(email: string, metadata: Row = {}): LocalSession {
  const users = table('local_users') as LocalUser[];
  let user = users.find((u) => String(u.email).toLowerCase() === email.toLowerCase());
  if (!user) {
    user = { id: uuid(), email, user_metadata: metadata };
    saveTable('local_users', [...users, user]);
  }
  return {
    access_token: `local-${user.id}`,
    refresh_token: `local-refresh-${user.id}`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    user: { id: user.id, email: user.email, user_metadata: user.user_metadata || metadata },
  };
}

function ensureProfile(session: LocalSession) {
  const rows = table('profiles');
  if (rows.some((r) => r.id === session.user.id)) return;
  saveTable('profiles', [
    ...rows,
    {
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || '',
      phone: session.user.user_metadata?.phone || '',
      broker_id: 'MAAL',
      dealer_id: 'MAA',
      kyc_status: 'approved',
      csd_registration_status: 'approved',
      csd_registered: true,
      account_status: 'active',
      wallet_balance: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
}

const auth = {
  async getSession() {
    return { data: { session: getStoredSession() }, error: null };
  },
  async getUser() {
    const s = getStoredSession();
    return { data: { user: s?.user ?? null }, error: null };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    if (!email || !password) {
      return { data: { session: null, user: null }, error: { message: 'Email and password are required' } };
    }
    const session = makeSession(email);
    setStoredSession(session);
    ensureProfile(session);
    emit('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Row } }) {
    if (!email || !password) {
      return { data: { session: null, user: null }, error: { message: 'Email and password are required' } };
    }
    const session = makeSession(email, options?.data || {});
    setStoredSession(session);
    ensureProfile(session);
    emit('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  },
  async signOut() {
    setStoredSession(null);
    emit('SIGNED_OUT', null);
    return { error: null };
  },
  async refreshSession() {
    const session = getStoredSession();
    if (session) {
      session.expires_at = Math.floor(Date.now() / 1000) + 60 * 60 * 12;
      setStoredSession(session);
      emit('TOKEN_REFRESHED', session);
    }
    return { data: { session }, error: null };
  },
  async updateUser(attrs: { data?: Row; email?: string }) {
    const session = getStoredSession();
    if (!session) return { data: { user: null }, error: { message: 'Not signed in' } };
    session.user.user_metadata = { ...(session.user.user_metadata || {}), ...(attrs.data || {}) };
    if (attrs.email) session.user.email = attrs.email;
    setStoredSession(session);
    emit('USER_UPDATED', session);
    return { data: { user: session.user }, error: null };
  },
  // No mail is sent in the local build; the call just reports success.
  async resetPasswordForEmail() {
    return { data: {}, error: null };
  },
  onAuthStateChange(cb: AuthListener) {
    listeners.add(cb);
    setTimeout(() => cb('INITIAL_SESSION', getStoredSession()), 0);
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(cb),
        },
      },
    };
  },
};

// ------------------------------------------------------- realtime / no-ops
interface ChannelStub {
  on: () => ChannelStub;
  subscribe: (cb?: (status: string) => void) => ChannelStub;
  unsubscribe: () => Promise<string>;
  send: () => Promise<string>;
  topic: string;
}

const channelStub = () => {
  const ch: ChannelStub = {
    on: () => ch,
    subscribe: (cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED');
      return ch;
    },
    unsubscribe: async () => 'ok',
    send: async () => 'ok',
    topic: 'local',
  };
  return ch;
};

export const localClient = {
  from: (name: string) => new LocalQuery(name),
  rpc: async () => ({ data: null, error: null }),
  auth,
  channel: () => channelStub(),
  removeChannel: () => {},
  removeAllChannels: () => {},
  functions: {
    invoke: async () => ({ data: null, error: { message: 'Backend functions are not available in the frontend-only build' } }),
  },
  storage: {
    from: () => ({
      // Accepts the upload without storing anything, so sign-up can be walked
      // through locally.
      upload: async (path: string) => ({ data: { path }, error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
      remove: async () => ({ data: null, error: null }),
      createSignedUrl: async () => ({ data: null, error: { message: 'Not available' } }),
    }),
  },
};

export default localClient;
