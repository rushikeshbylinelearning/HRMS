// frontend/src/utils/leavesCache.js
// Leaves-specific in-memory cache with stable keys and TTL.
// Used by LeavesPage and AdminLeavesPage to avoid continuous refetches and enable instant UI on revisit.

const cache = new Map();

/** TTL in ms: 3 minutes. Data is considered fresh within this window. */
export const LEAVES_CACHE_TTL_MS = 3 * 60 * 1000;

/** Minimum interval between refetches when triggered by visibility (cooldown). */
export const LEAVES_REFETCH_COOLDOWN_MS = 60 * 1000;

/**
 * Build a stable cache key for employee Leaves dashboard.
 * Key format: leaves:{userId}:employee:{year}:{page}:{limit}
 */
export function getEmployeeLeavesCacheKey(userId, page = 1, limit = 10) {
  const year = new Date().getFullYear();
  return `leaves:${userId || 'anon'}:employee:${year}:${page}:${limit}`;
}

/**
 * Build a stable cache key for admin Leaves list (main requests list).
 * Key format: leaves:admin:{year}:{page}:{limit}
 */
export function getAdminLeavesCacheKey(page = 1, limit = 10) {
  const year = new Date().getFullYear();
  return `leaves:admin:${year}:${page}:${limit}`;
}

/**
 * Get cached value if present and not expired.
 * @returns {{ data: any, timestamp: number } | null}
 */
export function getLeavesCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  if (age >= entry.ttlMs) return null;
  return entry;
}

/**
 * Store data in cache. Uses LEAVES_CACHE_TTL_MS by default.
 */
export function setLeavesCache(key, data, ttlMs = LEAVES_CACHE_TTL_MS) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttlMs,
  });
}

/**
 * Check if cache entry exists and is still within TTL (fresh).
 */
export function isLeavesCacheFresh(key) {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < entry.ttlMs;
}

/**
 * Check if cache entry exists but is stale (past TTL, useful for stale-while-revalidate).
 */
export function hasStaleLeavesCache(key) {
  const entry = cache.get(key);
  if (!entry) return false;
  return true; // we have something; caller can check age vs TTL
}

/**
 * Invalidate cache by key or by pattern (e.g. 'leaves:' to clear all leaves caches).
 */
export function invalidateLeavesCache(keyOrPattern) {
  if (!keyOrPattern) {
    cache.clear();
    return;
  }
  if (keyOrPattern.includes('*') || keyOrPattern === 'leaves:') {
    const prefix = keyOrPattern.replace(/\*/g, '');
    for (const k of cache.keys()) {
      if (k.startsWith(prefix)) cache.delete(k);
    }
    return;
  }
  cache.delete(keyOrPattern);
}

/**
 * Get cache age in ms for a key. Returns null if not in cache.
 */
export function getLeavesCacheAge(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  return Date.now() - entry.timestamp;
}
