/**
 * LEAVE CACHE SERVICE
 * 
 * Provides cached and batched access to leave data for attendance calculations.
 * Reduces repeated leave queries and enables efficient batch processing.
 * 
 * PERFORMANCE OPTIMIZATION:
 * - In-memory cache with 5-minute TTL
 * - Batch fetching for date ranges
 * - Automatic invalidation on leave status changes
 * - Leave data always takes precedence over attendance
 */

const LeaveRequest = require('../models/LeaveRequest');
const { parseISTDate, getISTDateString } = require('../utils/istTime');

class LeaveCache {
    constructor() {
        this.cache = new Map();
        this.TTL_MS = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Generate cache key for leave data
     * @param {string} userId - User ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {string} Cache key
     */
    _getCacheKey(userId, startDate, endDate) {
        return `${userId}:${startDate}:${endDate}`;
    }

    /**
     * Get cached leave data if available and valid
     * @param {string} userId - User ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Map|null} Cached leave map or null if not found/expired
     */
    get(userId, startDate, endDate) {
        const key = this._getCacheKey(userId, startDate, endDate);
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
     * Set cached leave data
     * @param {string} userId - User ID
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @param {Map} leaveMap - Leave map keyed by date
     */
    set(userId, startDate, endDate, leaveMap) {
        const key = this._getCacheKey(userId, startDate, endDate);
        
        this.cache.set(key, {
            data: leaveMap,
            timestamp: Date.now()
        });
    }

    /**
     * Invalidate cache for specific user
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
        
        if (keysToDelete.length > 0) {
            console.log(`[LeaveCache] Invalidated ${keysToDelete.length} entries for user ${userId}`);
        }
    }

    /**
     * Clear all cached entries
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Clean up expired entries
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
            console.log(`[LeaveCache] Cleaned up ${keysToDelete.length} expired entries`);
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
const leaveCache = new LeaveCache();

// Cleanup expired entries every 10 minutes
setInterval(() => {
    leaveCache.cleanup();
}, 10 * 60 * 1000);

/**
 * Batch fetch leave data for a user and date range with caching
 * @param {string} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Map>} Map of date strings to leave request objects
 */
const batchFetchLeaves = async (userId, startDate, endDate) => {
    // Check cache first
    const cached = leaveCache.get(userId, startDate, endDate);
    if (cached) {
        return cached;
    }

    try {
        // Fetch all approved leave requests for the date range
        const leaveRequests = await LeaveRequest.find({
            employee: userId,
            status: 'Approved',
            leaveDates: {
                $elemMatch: {
                    $gte: parseISTDate(startDate),
                    $lte: parseISTDate(endDate + 'T23:59:59+05:30')
                }
            }
        }).sort({ createdAt: 1 }).lean();

        // Create map of date strings to leave requests
        const leaveMap = new Map();
        
        leaveRequests.forEach(leave => {
            if (Array.isArray(leave.leaveDates) && leave.leaveDates.length > 0) {
                leave.leaveDates.forEach(leaveDate => {
                    const leaveDateStr = getISTDateString(leaveDate);
                    if (leaveDateStr >= startDate && leaveDateStr <= endDate) {
                        // If multiple leaves overlap, keep the first one (or most recent)
                        if (!leaveMap.has(leaveDateStr)) {
                            leaveMap.set(leaveDateStr, leave);
                        }
                    }
                });
            }
        });

        // Cache the result
        leaveCache.set(userId, startDate, endDate, leaveMap);
        
        return leaveMap;
        
    } catch (error) {
        console.error('[LeaveCache] Error fetching leave data:', error);
        return new Map(); // Return empty map on error
    }
};

/**
 * Batch fetch leave data for multiple users and date range
 * @param {Array<string>} userIds - Array of user IDs
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Map>} Map of userId to leave map
 */
const batchFetchLeavesMultiUser = async (userIds, startDate, endDate) => {
    const results = new Map();
    
    // Process users in parallel
    const promises = userIds.map(async (userId) => {
        const leaveMap = await batchFetchLeaves(userId, startDate, endDate);
        return { userId, leaveMap };
    });
    
    const userResults = await Promise.all(promises);
    
    userResults.forEach(({ userId, leaveMap }) => {
        results.set(userId, leaveMap);
    });
    
    return results;
};

module.exports = {
    leaveCache,
    batchFetchLeaves,
    batchFetchLeavesMultiUser,
    
    // Cache management functions
    invalidateUserLeaves: (userId) => leaveCache.invalidateUser(userId),
    clearLeaveCache: () => leaveCache.clear(),
    getLeaveCacheStats: () => leaveCache.getStats()
};