// frontend/src/utils/apiCache.js
// Request deduplication and caching layer for performance optimization

const pendingRequests = new Map();
const responseCache = new Map();
const CACHE_TTL = 5000; // 5 seconds default cache

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
 * Deduplicates and caches API requests
 * @param {Function} apiCall - The actual API call function
 * @param {Object} config - Request config
 * @param {Object} options - { cache: boolean, ttl: number, skipCache: boolean }
 */
export const cachedApiCall = async (apiCall, config, options = {}) => {
  const { cache = true, ttl = CACHE_TTL, skipCache = false } = options;
  const cacheKey = getCacheKey(config);

  // Skip cache for POST/PUT/DELETE/PATCH (mutations)
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase());
  if (isMutation || skipCache) {
    return apiCall();
  }

  // Check cache first
  if (cache) {
    const cached = responseCache.get(cacheKey);
    if (isCacheValid(cached)) {
      return Promise.resolve(cached.response);
    }
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















