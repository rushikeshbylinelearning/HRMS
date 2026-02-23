/**
 * ANALYTICS CONTROLLER - OPTIMIZED VERSION
 * 
 * Handles HTTP requests for attendance analytics with:
 * - Caching support (Redis + in-memory)
 * - ETag support for 304 responses
 * - Performance logging
 * - Optimized aggregation pipeline
 */

const AnalyticsService = require('../services/AnalyticsService.optimized');
const AnalyticsCacheService = require('../services/analyticsCacheService');
const crypto = require('crypto');

/**
 * GET /api/analytics/attendance
 * 
 * Get attendance analytics with optional filters
 * 
 * Query Parameters:
 * - startDate: string (YYYY-MM-DD, required)
 * - endDate: string (YYYY-MM-DD, required)
 * - department: string (optional)
 * - location: string (optional)
 * - shiftType: string (optional, 'Fixed' | 'Flexible')
 * - employmentStatus: string (optional, 'Active' | 'Inactive')
 * - page: number (optional, default: 1)
 * - limit: number (optional, default: 50, max: 1000)
 * - noCache: boolean (optional, bypass cache if true)
 * 
 * Response:
 * {
 *   summary: SummaryMetrics,
 *   employeeAnalytics: EmployeeMetrics[],
 *   pagination: PaginationInfo
 * }
 */
async function getAttendanceAnalytics(req, res) {
    const requestStartTime = Date.now();
    
    try {
        // Extract query parameters
        const {
            startDate,
            endDate,
            department,
            location,
            shiftType,
            employmentStatus,
            page,
            limit,
            noCache
        } = req.query;
        
        // Validate required parameters
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }
        
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid start date format. Use YYYY-MM-DD'
            });
        }
        if (!dateRegex.test(endDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid end date format. Use YYYY-MM-DD'
            });
        }
        
        // Validate date range
        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date must be before or equal to end date'
            });
        }
        
        // Validate shift type if provided
        if (shiftType && !['Fixed', 'Flexible'].includes(shiftType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid shift type. Must be "Fixed" or "Flexible"'
            });
        }
        
        // Validate employment status if provided
        if (employmentStatus && !['Active', 'Inactive'].includes(employmentStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employment status. Must be "Active" or "Inactive"'
            });
        }
        
        // Validate pagination parameters
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        
        if (pageNum < 1) {
            return res.status(400).json({
                success: false,
                message: 'Page number must be greater than 0'
            });
        }
        
        if (limitNum < 1 || limitNum > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Limit must be between 1 and 1000'
            });
        }
        
        // Build filters object
        const filters = {
            startDate,
            endDate,
            page: pageNum,
            limit: limitNum
        };
        
        if (department) filters.department = department;
        if (location) filters.location = location;
        if (shiftType) filters.shiftType = shiftType;
        if (employmentStatus) filters.employmentStatus = employmentStatus;
        
        // Check cache first (unless noCache is specified)
        let result;
        let cacheHit = false;
        
        if (!noCache || noCache !== 'true') {
            result = await AnalyticsCacheService.getCachedAnalytics(filters);
            if (result) {
                cacheHit = true;
                console.log(`[analyticsController] ✅ Cache HIT - Response time: ${Date.now() - requestStartTime}ms`);
            }
        }
        
        // If not in cache, calculate from database
        if (!result) {
            const dbStartTime = Date.now();
            result = await AnalyticsService.calculateAttendanceMetrics(filters);
            const dbTime = Date.now() - dbStartTime;
            
            console.log(`[analyticsController] 🔍 Cache MISS - DB query time: ${dbTime}ms`);
            
            // Store in cache for future requests
            await AnalyticsCacheService.setCachedAnalytics(filters, result, 300); // 5 minutes TTL
        }
        
        // Generate ETag for response
        const etag = generateETag(result);
        
        // Check if client has cached version
        const clientETag = req.headers['if-none-match'];
        if (clientETag === etag) {
            console.log(`[analyticsController] 📦 ETag match - Sending 304 Not Modified`);
            return res.status(304).end();
        }
        
        // Set cache headers
        res.set({
            'ETag': etag,
            'Cache-Control': 'private, max-age=300', // 5 minutes
            'X-Cache-Hit': cacheHit ? 'true' : 'false',
            'X-Response-Time': `${Date.now() - requestStartTime}ms`
        });
        
        // Return success response
        return res.status(200).json({
            success: true,
            data: result
        });
        
    } catch (error) {
        const responseTime = Date.now() - requestStartTime;
        console.error(`[analyticsController.getAttendanceAnalytics] Error after ${responseTime}ms:`, error);
        
        // Handle specific error types
        if (error.message.includes('date')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        
        // Handle database errors
        if (error.name === 'MongoError' || error.name === 'MongooseError') {
            return res.status(500).json({
                success: false,
                message: 'Internal server error while calculating metrics'
            });
        }
        
        // Handle timeout errors
        if (error.name === 'MongoTimeoutError') {
            return res.status(504).json({
                success: false,
                message: 'Request timeout. Try reducing date range or applying more filters'
            });
        }
        
        // Generic error response
        return res.status(500).json({
            success: false,
            message: 'An error occurred while calculating attendance analytics'
        });
    }
}

/**
 * POST /api/analytics/cache/clear
 * 
 * Clear analytics cache
 * 
 * Access: Admin only
 */
async function clearAnalyticsCache(req, res) {
    try {
        await AnalyticsCacheService.clearAnalyticsCache();
        
        return res.status(200).json({
            success: true,
            message: 'Analytics cache cleared successfully'
        });
    } catch (error) {
        console.error('[analyticsController.clearAnalyticsCache] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to clear analytics cache'
        });
    }
}

/**
 * GET /api/analytics/cache/stats
 * 
 * Get cache statistics
 * 
 * Access: Admin only
 */
async function getCacheStats(req, res) {
    try {
        const stats = await AnalyticsCacheService.getCacheStats();
        
        return res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[analyticsController.getCacheStats] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get cache statistics'
        });
    }
}

/**
 * Generate ETag from response data
 * 
 * @param {Object} data - Response data
 * @returns {string} ETag value
 */
function generateETag(data) {
    const hash = crypto
        .createHash('md5')
        .update(JSON.stringify(data))
        .digest('hex');
    
    return `W/"${hash}"`;
}

module.exports = {
    getAttendanceAnalytics,
    clearAnalyticsCache,
    getCacheStats
};
