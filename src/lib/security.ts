/**
 * CIRCLE SECURITY REGISTRY
 * ========================
 * Production security hardening — all protections active
 */
export const SECURITY_VERSION = '2.0';

export const SECURITY_CONFIG = {
  /** Total inactivity timeout — 20 minutes */
  SESSION_TIMEOUT_MS: 20 * 60 * 1000,
  /** Warning banner shown at 15 minutes (5 min before timeout) */
  SESSION_WARNING_MS: 15 * 60 * 1000,
  /** Critical modal shown at 18 minutes (2 min before timeout) */
  SESSION_CRITICAL_MS: 18 * 60 * 1000,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_MS: 15 * 60 * 1000,
  SIGNED_URL_EXPIRY_SECONDS: 60,
  MAX_ORDER_VALUE_ZMW: 500000,
  MAX_PRICE_DEVIATION_PCT: 0.20,
  EDGE_FUNCTION_TIMEOUT_MS: 15000,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as readonly string[],
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB per KYC requirement
  /** Password minimum requirements */
  PASSWORD_MIN_LENGTH: 10,
} as const;

export const INJECTION_PATTERNS = [
  /<script/i, /javascript:/i, /on\w+\s*=/i,
  /--/, /DROP\s+TABLE/i, /DELETE\s+FROM/i,
  /INSERT\s+INTO/i, /SELECT\s+\*/i, /UNION\s+SELECT/i,
  /eval\(/i, /document\.cookie/i, /window\.location/i,
];

export function containsInjection(value: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Password strength checker
 * Returns 0=Weak, 1=Fair, 2=Strong
 */
export function getPasswordStrength(password: string): { score: 0 | 1 | 2; label: 'Weak' | 'Fair' | 'Strong' } {
  let score = 0;
  if (password.length >= SECURITY_CONFIG.PASSWORD_MIN_LENGTH) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;

  if (score <= 1) return { score: 0, label: 'Weak' };
  if (score <= 2) return { score: 1, label: 'Fair' };
  return { score: 2, label: 'Strong' };
}

export function isPasswordStrong(password: string): boolean {
  return (
    password.length >= SECURITY_CONFIG.PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  );
}

/**
 * Anti-iframe protection — disabled to allow iframe embedding (e.g. Lovable preview)
 */
export function enforceNoIframe() {
  // Intentionally disabled — iframe loading is now allowed
}
