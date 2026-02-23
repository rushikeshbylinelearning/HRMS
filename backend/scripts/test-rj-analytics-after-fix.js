// Test script to verify RJ's analytics after half-day policy fix

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const AnalyticsService = require('../services/AnalyticsService');

async function testRJAnalyticsAfterFix() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('TEST RJ ANALYTICS AFTER HALF-DAY POLICY FIX');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Find RJ
        const rj = await User.findOne({
            $or: [
                { fullName: /RJ/i },
                { employeeCode: 'BYL202505-E71' }
            ]
        }).lean();
        
        if (!rj) {
            console.log('❌ Employee RJ not found\n');
            return;
        }
        
        console.log(`Found: ${rj.fullName} (${rj.employeeCode})\n`);
        
        // Test analytics for February 2026
        const startDate = '2026-02-01';
        const endDate = '2026-02-28';
        
        console.log(`Date Range: ${startDate} to ${endDate}\n`);
        console.log('Calculating analytics...\n');
        
        // Call analytics service
        const result = await AnalyticsService.calculateAttendanceMetrics({
            startDate,
            endDate,
            page: 1,
            limit: 100
        });
        
        // Find RJ in the results
        const rjAnalytics = result.employeeAnalytics.find(
            emp => emp.employeeCode === rj.employeeCode
        );
        
        if (!rjAnalytics) {
            console.log('❌ RJ not found in analytics results\n');
            return;
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('RJ ANALYTICS RESULTS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Employee Information:');
        console.log(`  Name: ${rjAnalytics.employeeName}`);
        console.log(`  Code: ${rjAnalytics.employeeCode}`);
        console.log(`  Department: ${rjAnalytics.department}`);
        console.log(`  Designation: ${rjAnalytics.designation}\n`);
        
        console.log('Attendance Metrics:');
        console.log(`  Present Days: ${rjAnalytics.presentDays}`);
        console.log(`  Leave Days: ${rjAnalytics.leaveDays}`);
        console.log(`  Absent Days: ${rjAnalytics.absentDays}`);
        console.log(`  Non-Working Days: ${rjAnalytics.nonWorkingDays}\n`);
        
        console.log('Working Hours:');
        console.log(`  Total Net Hours: ${rjAnalytics.totalNetHours} hours`);
        console.log(`  Average Working Hours: ${rjAnalytics.avgWorkingHours} hours/day`);
        console.log(`  Overtime Hours: ${rjAnalytics.overtimeHours} hours\n`);
        
        console.log('Performance:');
        console.log(`  Attendance Percentage: ${rjAnalytics.attendancePercentage}%`);
        console.log(`  Rank: ${rjAnalytics.rank || 'N/A'}\n`);
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('COMPARISON WITH EXPECTED VALUES');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const expectedHours = 120.24; // From database
        const expectedPresentDays = 15;
        
        console.log('Expected vs Actual:\n');
        
        console.log(`Present Days:`);
        console.log(`  Expected: ${expectedPresentDays}`);
        console.log(`  Actual: ${rjAnalytics.presentDays}`);
        console.log(`  Match: ${Math.abs(rjAnalytics.presentDays - expectedPresentDays) < 0.1 ? '✅ YES' : '❌ NO'}\n`);
        
        console.log(`Total Net Hours:`);
        console.log(`  Expected: ${expectedHours.toFixed(2)} hours`);
        console.log(`  Actual: ${rjAnalytics.totalNetHours} hours`);
        console.log(`  Difference: ${(rjAnalytics.totalNetHours - expectedHours).toFixed(2)} hours`);
        console.log(`  Match: ${Math.abs(rjAnalytics.totalNetHours - expectedHours) < 1 ? '✅ YES' : '❌ NO'}\n`);
        
        console.log(`Average Hours/Day:`);
        const expectedAvg = expectedHours / expectedPresentDays;
        console.log(`  Expected: ${expectedAvg.toFixed(2)} hours`);
        console.log(`  Actual: ${rjAnalytics.avgWorkingHours} hours`);
        console.log(`  Match: ${Math.abs(rjAnalytics.avgWorkingHours - expectedAvg) < 0.1 ? '✅ YES' : '❌ NO'}\n`);
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('VERIFICATION STATUS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const hoursMatch = Math.abs(rjAnalytics.totalNetHours - expectedHours) < 1;
        const daysMatch = Math.abs(rjAnalytics.presentDays - expectedPresentDays) < 0.1;
        
        if (hoursMatch && daysMatch) {
            console.log('✅ SUCCESS: Analytics showing correct data after fix!\n');
            console.log('Summary:');
            console.log(`  - RJ shows ${rjAnalytics.totalNetHours} hours (expected ~120 hours)`);
            console.log(`  - Present days: ${rjAnalytics.presentDays} (expected 15)`);
            console.log(`  - Half-day policy fix is working correctly\n`);
        } else {
            console.log('⚠️  WARNING: Analytics data may not be fully updated\n');
            console.log('Possible issues:');
            if (!hoursMatch) {
                console.log(`  - Total hours mismatch: ${rjAnalytics.totalNetHours} vs ${expectedHours.toFixed(2)}`);
            }
            if (!daysMatch) {
                console.log(`  - Present days mismatch: ${rjAnalytics.presentDays} vs ${expectedPresentDays}`);
            }
            console.log('\nTry:');
            console.log('  1. Clear cache again: node backend/scripts/clear-analytics-cache.js');
            console.log('  2. Restart backend server');
            console.log('  3. Hard refresh browser (Ctrl+Shift+R)\n');
        }
        
        console.log('═══════════════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

testRJAnalyticsAfterFix();
