const attempts: Record<string, { count: number; firstAttempt: number; lockedUntil?: number }> = {};

export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 10 * 60 * 1000,
  lockoutMs = 15 * 60 * 1000
): { allowed: boolean; remainingMs?: number } {
  const now = Date.now();
  const record = attempts[key] || { count: 0, firstAttempt: now };

  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, remainingMs: record.lockedUntil - now };
  }

  if (now - record.firstAttempt > windowMs) {
    attempts[key] = { count: 1, firstAttempt: now };
    return { allowed: true };
  }

  record.count += 1;
  if (record.count >= maxAttempts) {
    record.lockedUntil = now + lockoutMs;
    attempts[key] = record;
    return { allowed: false, remainingMs: lockoutMs };
  }

  attempts[key] = record;
  return { allowed: true };
}

export function clearRateLimit(key: string) {
  delete attempts[key];
}

export function formatLockoutTime(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  return `${mins} minute${mins !== 1 ? 's' : ''}`;
}
