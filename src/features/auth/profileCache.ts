const CACHE_TTL = 30 * 60 * 1000;

// This cache lives in localStorage — readable by any script on the origin,
// and it survives tab close. It must only ever hold fields needed to paint
// the UI before the network round-trip completes, never KYC/financial PII.
// Everything else (national ID, tax ID, bank details, date of birth,
// next-of-kin, CSD BPID, etc.) must be re-fetched from the server on demand.
const CACHEABLE_FIELDS = [
  'id',
  'full_name',
  'kyc_status',
  'kyc_rejection_reason',
  'account_status',
  'restriction_reason',
  'restriction_until',
  'csd_registered',
  'csd_registration_status',
  'created_at',
  'updated_at',
] as const;

function pickCacheableFields(data: object | null): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return data as null;
  const source = data as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const field of CACHEABLE_FIELDS) {
    if (field in source) safe[field] = source[field];
  }
  return safe;
}

export function getCachedProfile(userId: string) {
  try {
    const cached = localStorage.getItem(`maa_profile_${userId}`);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) return data;
    return null;
  } catch { return null; }
}

export function setCachedProfile(userId: string, data: object | null) {
  try {
    localStorage.setItem(`maa_profile_${userId}`, JSON.stringify({
      data: pickCacheableFields(data),
      timestamp: Date.now()
    }));
  } catch {
    // Storage unavailable — the profile is simply fetched again next time.
  }
}

export function clearCachedProfile(userId: string) {
  localStorage.removeItem(`maa_profile_${userId}`);
  // Roles are never cached; this clears the key older builds wrote.
  localStorage.removeItem(`maa_role_${userId}`);
}
