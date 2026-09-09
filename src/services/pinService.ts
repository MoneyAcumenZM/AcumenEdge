const PIN_KEY = (userId: string) => `maa_pin_${userId}`;
const PIN_ENABLED_KEY = (userId: string) => `maa_pin_enabled_${userId}`;
const PIN_SET_AT_KEY = (userId: string) => `maa_pin_set_at_${userId}`;
const PIN_ATTEMPTS_KEY = (userId: string) => `maa_pin_attempts_${userId}`;
const PIN_LOCKED_UNTIL_KEY = (userId: string) => `maa_pin_locked_until_${userId}`;
const LAST_ACTIVITY_KEY = 'maa_last_activity';

const PIN_SALT_KEY = (userId: string) => `maa_pin_salt_${userId}`;

const PBKDF2_ITERATIONS = 210_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

/** Random per-user salt so identical PINs never share a stored hash. */
function getOrCreateSalt(userId: string): Uint8Array {
  const existing = localStorage.getItem(PIN_SALT_KEY(userId));
  if (existing) return fromHex(existing);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(PIN_SALT_KEY(userId), toHex(salt));
  return salt;
}

/**
 * PBKDF2-SHA256 (210k iterations) with a random per-user salt. A 4-digit PIN has
 * a tiny keyspace, so key stretching is what makes an offline attack on the
 * stored value expensive; the 5-attempt lockout covers the online path.
 */
async function hashPIN(pin: string, userId: string, salt?: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const useSalt = salt ?? getOrCreateSalt(userId);
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin + userId), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: useSalt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(new Uint8Array(bits))}`;
}

/** Legacy single-round hash — only used to verify PINs set before the upgrade. */
async function legacyHashPIN(pin: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + userId + 'MAA_SALT_2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(buf));
}

/** Constant-time string compare to avoid leaking match position via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function setPIN(userId: string, pin: string): Promise<void> {
  localStorage.removeItem(PIN_SALT_KEY(userId));
  const hashed = await hashPIN(pin, userId);
  localStorage.setItem(PIN_KEY(userId), hashed);
  localStorage.setItem(PIN_ENABLED_KEY(userId), 'true');
  localStorage.setItem(PIN_SET_AT_KEY(userId), new Date().toISOString());
  localStorage.setItem(PIN_ATTEMPTS_KEY(userId), '0');
}

export async function verifyPIN(userId: string, pin: string): Promise<boolean> {
  const lockedUntil = localStorage.getItem(PIN_LOCKED_UNTIL_KEY(userId));
  if (lockedUntil && Date.now() < parseInt(lockedUntil)) return false;

  const stored = localStorage.getItem(PIN_KEY(userId));
  if (!stored) return false;

  let correct = false;
  if (stored.startsWith('pbkdf2$')) {
    correct = safeEqual(stored, await hashPIN(pin, userId));
  } else {
    // Legacy hash: verify, then transparently upgrade to PBKDF2.
    correct = safeEqual(stored, await legacyHashPIN(pin, userId));
    if (correct) await setPIN(userId, pin);
  }

  if (correct) {
    localStorage.setItem(PIN_ATTEMPTS_KEY(userId), '0');
    return true;
  }

  const attempts = parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY(userId)) || '0') + 1;
  localStorage.setItem(PIN_ATTEMPTS_KEY(userId), attempts.toString());

  if (attempts >= 5) {
    const lockUntil = Date.now() + 5 * 60 * 1000;
    localStorage.setItem(PIN_LOCKED_UNTIL_KEY(userId), lockUntil.toString());
    localStorage.setItem(PIN_ATTEMPTS_KEY(userId), '0');
  }

  return false;
}

export function isPINEnabled(userId: string): boolean {
  return localStorage.getItem(PIN_ENABLED_KEY(userId)) === 'true';
}

export function isPINLocked(userId: string): { locked: boolean; secondsRemaining: number } {
  const lockedUntil = localStorage.getItem(PIN_LOCKED_UNTIL_KEY(userId));
  if (!lockedUntil) return { locked: false, secondsRemaining: 0 };
  const remaining = parseInt(lockedUntil) - Date.now();
  if (remaining <= 0) return { locked: false, secondsRemaining: 0 };
  return { locked: true, secondsRemaining: Math.ceil(remaining / 1000) };
}

export function getPINFailedAttempts(userId: string): number {
  return parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY(userId)) || '0');
}

export function clearPIN(userId: string): void {
  localStorage.removeItem(PIN_KEY(userId));
  localStorage.removeItem(PIN_ENABLED_KEY(userId));
  localStorage.removeItem(PIN_SET_AT_KEY(userId));
  localStorage.removeItem(PIN_ATTEMPTS_KEY(userId));
  localStorage.removeItem(PIN_LOCKED_UNTIL_KEY(userId));
  localStorage.removeItem(PIN_SALT_KEY(userId));
}

export function getPINSetAt(userId: string): string | null {
  return localStorage.getItem(PIN_SET_AT_KEY(userId));
}

export function recordActivity(): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch {}
}

export function getLastActivity(): number {
  const val = localStorage.getItem(LAST_ACTIVITY_KEY);
  return val ? parseInt(val) : Date.now();
}
