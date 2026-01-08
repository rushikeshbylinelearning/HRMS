/**
 * STATUS CACHE SERVICE
 * 
 * Provides cached access to calculated daily status with automatic invalidation.
 * Reduces repeated recalculation of the same user/date combinations.
 * 
 * PERFORMANCE OPTIMIZATION:
 * - In-memory cache with 60-second TTL
 * - Automatic invalidation on attendance changes
 * - Thread-safe with proper cache key management
 * - Never overrides admin decisions
 */

class StatusCache {
    constructor() {
        this.cache = new Map();
        this.TTL_MS = 60 * 1000; // 60 seconds
    }

    /**
     * Generate cache key for user + date combination
     * @param {string} userId - User ID
     * @param {string} attendanceDate - Date in YYYY-MM-DD format
     * @returns {string} Cache key
     */
    _getCacheKey(userId, attendanceDate) {
        return `${userId}:${attendanceDate}`;
    }

    /**
     * Get cached status if available and valid
     * @param {string} userId - User ID
     * @param {string} attendanceDate - Date in YYYY-MM-DD format
     * @returns {Object|null} Cached status object or null if not found/expired
     */
    get(userId, attendanceDate) {
        const key = this._getCacheKey(userId, attendanceDate);
        const cached = this.cache.get(key);
        
        if (!cached) {
            return null;
        }
        
        const now = Date.now();
        if (now - cached.timestamp > this.TTL_MS) {
            // Expired - remove from cache
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    /**
     * Set cached status
     * @param {string} userId - User ID
     * @param {string} attendanceDate - Date in YYYY-MM-DD format
     * @param {Object} statusData - Status data to cache
     */
    set(userId, attendanceDate, statusData) {
        const key = this._getCacheKey(userId, attendanceDate);
        
        // Don't cache if admin override exists - these should always be fresh
        if (statusData && statusData.attendanceLog && statusData.attendanceLog.overriddenByAdmin) {
            return;
        }
        
        this.cache.set(key, {
            data: statusData,
            timestamp: Date.now()
        });
    }

    /**
     * Invalidate cache for specific user and date
     * @param {string} userId - User ID
     * @param {string} attendanceDate - Date in YYYY-MM-DD format
     */
    invalidate(userId, attendanceDate) {
        const key = this._getCacheKey(userId, attendanceDate);
        this.cache.delete(key);
    }

    /**
     * Invalidate all cache entries for a specific user
     * @param {string} userId - User ID
     */
    invalidateUser(userId) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${userId}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
    }

    /**
     * Clear all cached entries
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Clean up expired entries (called periodically)
     */
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.TTL_MS) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.cache.delete(key));
        
        if (keysToDelete.length > 0) {
            console.log(`[StatusCache] Cleaned up ${keysToDelete.length} expired entries`);
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;
        
        for (const value of this.cache.values()) {
            if (now - value.timestamp > this.TTL_MS) {
                expiredEntries++;
            } else {
                validEntries++;
            }
        }
        
        return {
            totalEntries: this.cache.size,
            validEntries,
            expiredEntries,
            ttlMs: this.TTL_MS
        };
    }
}

// Singleton instance
const statusCache = new StatusCache();

// Cleanup expired entries every 5 minutes
setInterval(() => {
    statusCache.cleanup();
}, 5 * 60 * 1000);

module.exports = {
    statusCache,
    
    // Convenience functions
    getStatus: (userId, attendanceDate) => statusCache.get(userId, attendanceDate),
    setStatus: (userId, attendanceDate, statusData) => statusCache.set(userId, attendanceDate, statusData),
    invalidateStatus: (userId, attendanceDate) => statusCache.invalidate(userId, attendanceDate),
    invalidateUserStatus: (userId) => statusCache.invalidateUser(userId),
    clearStatusCache: () => statusCache.clear(),
    getStatusCacheStats: () => statusCache.getStats()
};