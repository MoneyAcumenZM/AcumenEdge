interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil: number;
}

const store: Record<string, RateLimitEntry> = {};

export function checkRateLimit(
  key: string,
  config: { maxAttempts: number; windowMs: number; blockMs: number }
): { allowed: boolean; remainingMs?: number } {
  const now = Date.now();
  const r = store[key];

  if (r?.blockedUntil > now) return { allowed: false, remainingMs: r.blockedUntil - now };

  if (!r || now - r.firstAttempt > config.windowMs) {
    store[key] = { count: 1, firstAttempt: now, blockedUntil: 0 };
    return { allowed: true };
  }

  r.count++;
  if (r.count > config.maxAttempts) {
    r.blockedUntil = now + config.blockMs;
    return { allowed: false, remainingMs: config.blockMs };
  }

  return { allowed: true };
}

export const RateLimits = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockMs: 30 * 60 * 1000 },
  trade: { maxAttempts: 10, windowMs: 60 * 1000, blockMs: 60 * 1000 },
  withdrawal: { maxAttempts: 3, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 },
  search: { maxAttempts: 30, windowMs: 60 * 1000, blockMs: 30 * 1000 },
};
