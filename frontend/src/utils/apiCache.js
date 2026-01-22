// frontend/src/utils/apiCache.js
// Request deduplication and caching layer for performance optimization

const pendingRequests = new Map();
const responseCache = new Map();
const CACHE_TTL = 15000; // 15 seconds default cache (increased for performance)
const STALE_WHILE_REVALIDATE_TTL = 30000; // 30 seconds for stale-while-revalidate

/**
 * Creates a cache key from request config
 */
const getCacheKey = (config) => {
  const { method, url, params, data } = config;
  const paramsStr = params ? JSON.stringify(params) : '';
  const dataStr = data ? JSON.stringify(data) : '';
  return `${method}:${url}:${paramsStr}:${dataStr}`;
};

/**
 * Checks if cached response is still valid
 */
const isCacheValid = (cached) => {
  if (!cached) return false;
  const age = Date.now() - cached.timestamp;
  return age < cached.ttl;
};

/**
 * Checks if cached response can be served stale while revalidating
 */
const canServeStale = (cached) => {
  if (!cached) return false;
  const age = Date.now() - cached.timestamp;
  return age < cached.staleTtl;
};

/**
 * Deduplicates and caches API requests with stale-while-revalidate
 * @param {Function} apiCall - The actual API call function
 * @param {Object} config - Request config
 * @param {Object} options - { cache: boolean, ttl: number, skipCache: boolean, staleWhileRevalidate: boolean }
 */
export const cachedApiCall = async (apiCall, config, options = {}) => {
  const {
    cache = true,
    ttl = CACHE_TTL,
    skipCache = false,
    staleWhileRevalidate = true
  } = options;
  const cacheKey = getCacheKey(config);

  // Skip cache for POST/PUT/DELETE/PATCH (mutations)
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase());
  if (isMutation || skipCache) {
    return apiCall();
  }

  const cached = cache ? responseCache.get(cacheKey) : null;

  // Check for fresh cache first
  if (cached && isCacheValid(cached)) {
    return Promise.resolve(cached.response);
  }

  // Stale-while-revalidate: serve stale data immediately and refresh in background
  if (staleWhileRevalidate && cached && canServeStale(cached)) {
    // Serve stale data immediately
    const staleResponse = Promise.resolve(cached.response);

    // Revalidate in background (don't await)
    apiCall()
      .then((freshResponse) => {
        // Update cache with fresh data
        if (cache && config.method?.toUpperCase() === 'GET') {
          responseCache.set(cacheKey, {
            response: freshResponse,
            timestamp: Date.now(),
            ttl,
            staleTtl: STALE_WHILE_REVALIDATE_TTL,
          });
        }
      })
      .catch((error) => {
        console.warn('[Cache] Background revalidation failed:', error);
      });

    return staleResponse;
  }

  // Check if request is already in flight (deduplication)
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // Make the request
  const requestPromise = apiCall()
    .then((response) => {
      // Cache successful GET requests
      if (cache && config.method?.toUpperCase() === 'GET') {
        responseCache.set(cacheKey, {
          response,
          timestamp: Date.now(),
          ttl,
          staleTtl: STALE_WHILE_REVALIDATE_TTL,
        });
      }
      return response;
    })
    .finally(() => {
      // Remove from pending requests
      pendingRequests.delete(cacheKey);
    });

  // Store pending request for deduplication
  pendingRequests.set(cacheKey, requestPromise);

  return requestPromise;
};

/**
 * Clears cache for a specific URL pattern or all cache
 */
export const clearCache = (urlPattern = null) => {
  if (!urlPattern) {
    responseCache.clear();
    return;
  }

  // Clear cache entries matching the pattern
  for (const [key] of responseCache) {
    if (key.includes(urlPattern)) {
      responseCache.delete(key);
    }
  }
};

/**
 * Clears all pending requests (useful for cleanup)
 */
export const clearPendingRequests = () => {
  pendingRequests.clear();
};







