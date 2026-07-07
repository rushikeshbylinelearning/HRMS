// Script to clear analytics and dashboard cache after half-day policy fix
// This ensures the Analytics page shows updated data

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function clearAnalyticsCache() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('CLEAR ANALYTICS CACHE');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Import cache service
        const cacheService = require('../services/cacheService');
        
        console.log('Step 1: Clearing dashboard cache...\n');
        
        // Clear all dashboard cache
        cacheService.invalidateDashboard();
        console.log('✅ Dashboard cache cleared\n');
        
        console.log('Step 2: Clearing leave analytics cache...\n');
        
        // Clear leave analytics cache
        cacheService.invalidateLeaveAnalytics();
        console.log('✅ Leave analytics cache cleared\n');
        
        console.log('Step 3: Clearing pending leaves cache...\n');
        
        // Clear pending leaves cache
        cacheService.invalidatePendingLeaves();
        console.log('✅ Pending leaves cache cleared\n');
        
        console.log('Step 4: Clearing reports cache...\n');
        
        // Clear all reports cache
        cacheService.invalidateReports();
        console.log('✅ Reports cache cleared\n');
        
        console.log('Step 5: Clearing attendance cache...\n');
        
        // Clear all attendance cache
        cacheService.invalidateAttendance();
        console.log('✅ Attendance cache cleared\n');
        
        console.log('Step 6: Getting cache statistics...\n');
        
        // Get cache stats
        const stats = cacheService.getStats();
        console.log('Cache Statistics:');
        console.log(`  Total Hits: ${stats.hits}`);
        console.log(`  Total Misses: ${stats.misses}`);
        console.log(`  Total Sets: ${stats.sets}`);
        console.log(`  Total Deletes: ${stats.deletes}`);
        console.log(`  Hit Rate: ${stats.hitRate}\n`);
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('CACHE CLEARED SUCCESSFULLY');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Next Steps:\n');
        console.log('1. Refresh the Analytics page in your browser');
        console.log('2. The page will fetch fresh data from the database');
        console.log('3. Updated attendance records will be reflected');
        console.log('4. Employee RJ should now show ~120 hours instead of 112 hours\n');
        
        console.log('Note: If the frontend has its own cache, you may need to:');
        console.log('  - Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)');
        console.log('  - Clear browser cache');
        console.log('  - Restart the frontend development server\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

clearAnalyticsCache();
