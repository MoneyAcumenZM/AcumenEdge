const CACHE_TTL = 30 * 60 * 1000;

export function getCachedProfile(userId: string) {
  try {
    const cached = localStorage.getItem(`maa_profile_${userId}`);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) return data;
    return null;
  } catch { return null; }
}

export function setCachedProfile(userId: string, data: any) {
  try {
    localStorage.setItem(`maa_profile_${userId}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {}
}

export function clearCachedProfile(userId: string) {
  localStorage.removeItem(`maa_profile_${userId}`);
}

export function getCachedRole(userId: string) {
  try {
    const cached = localStorage.getItem(`maa_role_${userId}`);
    if (!cached) return null;
    const { role, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) return role;
    return null;
  } catch { return null; }
}

export function setCachedRole(userId: string, role: string) {
  try {
    localStorage.setItem(`maa_role_${userId}`, JSON.stringify({
      role,
      timestamp: Date.now()
    }));
  } catch {}
}
