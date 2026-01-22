/**
 * GRACE PERIOD CACHE SERVICE
 * 
 * Provides cached access to grace period setting with automatic invalidation.
 * Reduces database queries from every calculation to once per hour.
 * 
 * PERFORMANCE OPTIMIZATION:
 * - In-memory cache with 1-hour TTL
 * - Safe fallback to 30 minutes
 * - Auto-invalidation on setting updates
 * - Thread-safe with single DB query per cache miss
 */

const Setting = require('../models/Setting');

class GracePeriodCache {
    constructor() {
        this.cache = null;
        this.cacheTimestamp = null;
        this.TTL_MS = 60 * 60 * 1000; // 1 hour
        this.DEFAULT_GRACE_MINUTES = 30;
        this.SETTING_KEY = 'lateGraceMinutes';
        this.isLoading = false; // Prevent concurrent DB queries
        this.loadingPromise = null;
    }

    /**
     * Get grace period with caching
     * @returns {Promise<number>} Grace period in minutes
     */
    async getGracePeriod() {
        const now = Date.now();
        
        // Check if cache is valid
        if (this.cache !== null && 
            this.cacheTimestamp !== null && 
            (now - this.cacheTimestamp) < this.TTL_MS) {
            return this.cache;
        }

        // Prevent concurrent DB queries
        if (this.isLoading && this.loadingPromise) {
            return await this.loadingPromise;
        }

        // Load from database
        this.isLoading = true;
        this.loadingPromise = this._loadFromDatabase();
        
        try {
            const gracePeriod = await this.loadingPromise;
            return gracePeriod;
        } finally {
            this.isLoading = false;
            this.loadingPromise = null;
        }
    }

    /**
     * Load grace period from database
     * @private
     * @returns {Promise<number>} Grace period in minutes
     */
    async _loadFromDatabase() {
        try {
            const graceSetting = await Setting.findOne({ key: this.SETTING_KEY });
            
            if (graceSetting) {
                // Parse and validate setting value
                const graceValue = parseInt(Number(graceSetting.value), 10);
                
                if (!isNaN(graceValue) && graceValue >= 0) {
                    // Valid setting found - cache it
                    this.cache = graceValue;
                    this.cacheTimestamp = Date.now();
                    
                    console.log(`[GracePeriodCache] Loaded grace period: ${graceValue} minutes`);
                    return graceValue;
                } else {
                    console.warn(`[GracePeriodCache] Invalid grace period value in database: ${graceSetting.value}, using default ${this.DEFAULT_GRACE_MINUTES}`);
                }
            } else {
                console.log(`[GracePeriodCache] No grace period setting found, using default ${this.DEFAULT_GRACE_MINUTES}`);
            }
            
            // Use default and cache it
            this.cache = this.DEFAULT_GRACE_MINUTES;
            this.cacheTimestamp = Date.now();
            return this.DEFAULT_GRACE_MINUTES;
            
        } catch (error) {
            console.error('[GracePeriodCache] Failed to fetch grace period setting:', error);
            
            // Return cached value if available, otherwise default
            if (this.cache !== null) {
                console.log(`[GracePeriodCache] Using cached value due to DB error: ${this.cache} minutes`);
                return this.cache;
            }
            
            console.log(`[GracePeriodCache] Using default due to DB error: ${this.DEFAULT_GRACE_MINUTES} minutes`);
            return this.DEFAULT_GRACE_MINUTES;
        }
    }

    /**
     * Invalidate cache (call when admin updates grace period setting)
     */
    invalidate() {
        this.cache = null;
        this.cacheTimestamp = null;
        console.log('[GracePeriodCache] Cache invalidated');
    }

    /**
     * Get current cache status (for debugging)
     * @returns {Object} Cache status
     */
    getStatus() {
        const now = Date.now();
        const isValid = this.cache !== null && 
                       this.cacheTimestamp !== null && 
                       (now - this.cacheTimestamp) < this.TTL_MS;
        
        return {
            cached: this.cache,
            timestamp: this.cacheTimestamp,
            isValid,
            ttlRemaining: isValid ? this.TTL_MS - (now - this.cacheTimestamp) : 0,
            isLoading: this.isLoading
        };
    }
}

// Singleton instance
const gracePeriodCache = new GracePeriodCache();

module.exports = {
    gracePeriodCache,
    
    // Convenience function for direct usage
    getGracePeriod: () => gracePeriodCache.getGracePeriod(),
    
    // Cache invalidation function
    invalidateGracePeriod: () => gracePeriodCache.invalidate(),
    
    // Status function for debugging
    getGracePeriodCacheStatus: () => gracePeriodCache.getStatus()
};