// backend/scripts/backfill-attendance-for-leaves.js
/**
 * Backfill Script: Fix Attendance Records for Approved Leaves
 * 
 * This script fixes all attendance records where:
 * - Approved leave exists for a date
 * - But attendance status is stored as 'Absent'
 * 
 * Usage:
 *   node scripts/backfill-attendance-for-leaves.js
 *   node scripts/backfill-attendance-for-leaves.js --userId=USER_ID
 *   node scripts/backfill-attendance-for-leaves.js --startDate=2025-01-01 --endDate=2025-12-31
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { backfillAttendanceForLeaves } = require('../services/attendanceRecalculationService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-system';

async function main() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Parse command line arguments
        const args = process.argv.slice(2);
        const options = {};
        
        args.forEach(arg => {
            if (arg.startsWith('--userId=')) {
                options.userId = arg.split('=')[1];
            } else if (arg.startsWith('--startDate=')) {
                options.startDate = arg.split('=')[1];
            } else if (arg.startsWith('--endDate=')) {
                options.endDate = arg.split('=')[1];
            }
        });

        console.log('\n📊 Starting attendance backfill for approved leaves...');
        console.log('Options:', options);
        console.log('');

        const results = await backfillAttendanceForLeaves(options);

        console.log('\n✅ Backfill completed!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total Leaves Processed: ${results.totalLeaves}`);
        console.log(`Total Dates Processed: ${results.totalDates}`);
        console.log(`Records Updated: ${results.updated}`);
        console.log(`Errors: ${results.errors}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (results.details.length > 0) {
            console.log('\n📋 Updated Records:');
            results.details.forEach((detail, index) => {
                console.log(`${index + 1}. User: ${detail.userId}, Date: ${detail.date}`);
                console.log(`   ${detail.oldStatus} → ${detail.newStatus} (Leave: ${detail.leaveType})`);
            });
        }

        if (results.errors > 0) {
            console.log('\n⚠️  Some errors occurred during backfill. Check logs above.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error during backfill:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

main();





