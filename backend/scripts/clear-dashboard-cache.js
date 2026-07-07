// Script to clear dashboard cache after fixing presentCount logic
// This ensures the fix takes effect immediately without waiting for cache expiry

const cacheService = require('../services/cacheService');

function getTodayISTKey() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function clearDashboardCache() {
    try {
        const today = getTodayISTKey();
        console.log(`Clearing dashboard cache for date: ${today}`);
        
        // Invalidate today's dashboard cache
        cacheService.invalidateDashboard(today);
        
        console.log('✓ Dashboard cache cleared successfully');
        console.log('The admin dashboard will now show the correct employee count (including late employees)');
        
        process.exit(0);
    } catch (error) {
        console.error('Error clearing dashboard cache:', error);
        process.exit(1);
    }
}

clearDashboardCache();
