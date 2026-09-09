type CacheKey = 'securities' | 'portfolio' | 'orders' | 'session';

const cache = new Map<CacheKey, unknown>();

export function setCache(key: CacheKey, data: unknown): void {
  cache.set(key, data);
}

export function getCache<T>(key: CacheKey): T | null {
  return (cache.get(key) as T) ?? null;
}
