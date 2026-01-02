// backend/utils/redisClient.js
// Redis client with safe fallback if Redis is unavailable

let redisClient = null;
let redisAvailable = false;

// Try to initialize Redis client
try {
    const redis = require('redis');
    
    const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        retryStrategy: (times) => {
            // Exponential backoff, max 3 seconds
            const delay = Math.min(times * 50, 3000);
            return delay;
        },
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false // Don't queue commands if connection is down
    };

    redisClient = redis.createClient(redisConfig);

    redisClient.on('error', (err) => {
        console.warn('[Redis] Connection error:', err.message);
        redisAvailable = false;
    });

    redisClient.on('connect', () => {
        console.log('[Redis] Connected successfully');
        redisAvailable = true;
    });

    redisClient.on('ready', () => {
        console.log('[Redis] Client ready');
        redisAvailable = true;
    });

    redisClient.on('reconnecting', () => {
        console.log('[Redis] Reconnecting...');
        redisAvailable = false;
    });

    // Attempt to connect (non-blocking)
    redisClient.connect().catch((err) => {
        console.warn('[Redis] Failed to connect:', err.message);
        console.warn('[Redis] Continuing without Redis cache - using fallback mode');
        redisAvailable = false;
    });
} catch (error) {
    // Redis package not installed or other initialization error
    console.warn('[Redis] Redis not available:', error.message);
    console.warn('[Redis] Continuing without Redis cache - using fallback mode');
    redisAvailable = false;
}

/**
 * Get cached value from Redis
 * @param {string} key - Cache key
 * @returns {Promise<string|null>} Cached value or null if not found/unavailable
 */
const getCache = async (key) => {
    if (!redisAvailable || !redisClient) {
        return null;
    }

    try {
        const value = await redisClient.get(key);
        return value;
    } catch (error) {
        // Silently fail - fallback to database query
        console.warn(`[Redis] Get cache error for key "${key}":`, error.message);
        return null;
    }
};

/**
 * Set cached value in Redis with TTL
 * @param {string} key - Cache key
 * @param {string} value - Value to cache (must be string)
 * @param {number} ttlSeconds - Time to live in seconds
 * @returns {Promise<boolean>} True if cached successfully, false otherwise
 */
const setCache = async (key, value, ttlSeconds) => {
    if (!redisAvailable || !redisClient) {
        return false;
    }

    try {
        await redisClient.setEx(key, ttlSeconds, value);
        return true;
    } catch (error) {
        // Silently fail - fallback to database query
        console.warn(`[Redis] Set cache error for key "${key}":`, error.message);
        return false;
    }
};

/**
 * Delete cached value from Redis
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} True if deleted successfully, false otherwise
 */
const deleteCache = async (key) => {
    if (!redisAvailable || !redisClient) {
        return false;
    }

    try {
        await redisClient.del(key);
        return true;
    } catch (error) {
        // Silently fail - not critical
        console.warn(`[Redis] Delete cache error for key "${key}":`, error.message);
        return false;
    }
};

/**
 * Delete all cache entries matching a pattern (for invalidation)
 * @param {string} pattern - Redis key pattern (e.g., "status:userId:*")
 * @returns {Promise<number>} Number of keys deleted
 */
const deleteCachePattern = async (pattern) => {
    if (!redisAvailable || !redisClient) {
        return 0;
    }

    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length === 0) {
            return 0;
        }
        await redisClient.del(keys);
        return keys.length;
    } catch (error) {
        // Silently fail - not critical
        console.warn(`[Redis] Delete cache pattern error for "${pattern}":`, error.message);
        return 0;
    }
};

/**
 * Check if Redis is available
 * @returns {boolean} True if Redis is connected and ready
 */
const isAvailable = () => {
    return redisAvailable;
};

// Graceful shutdown
process.on('SIGINT', async () => {
    if (redisClient) {
        try {
            await redisClient.quit();
            console.log('[Redis] Connection closed');
        } catch (error) {
            console.warn('[Redis] Error closing connection:', error.message);
        }
    }
});

process.on('SIGTERM', async () => {
    if (redisClient) {
        try {
            await redisClient.quit();
            console.log('[Redis] Connection closed');
        } catch (error) {
            console.warn('[Redis] Error closing connection:', error.message);
        }
    }
});

module.exports = {
    getCache,
    setCache,
    deleteCache,
    deleteCachePattern,
    isAvailable
};

