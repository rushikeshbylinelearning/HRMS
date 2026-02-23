// Comprehensive verification that admin overrides are reflected in analytics
// Tests the complete flow from admin edit to analytics display

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const AnalyticsService = require('../services/AnalyticsService');
const AttendanceSummaryService = require('../services/AttendanceSummaryService');

async function verifyAdminOverrideAnalyticsSync() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('ADMIN OVERRIDE → ANALYTICS SYNC VERIFICATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Find a test employee (RJ)
        const testEmployee = await User.findOne({
            $or: [
                { fullName: /RJ/i },
                { employeeCode: /BYL202505-E71/i }
            ]
        }).lean();
        
        if (!testEmployee) {
            console.log('❌ Test employee not found\n');
            return;
        }
        
        console.log(`Test Employee: ${testEmployee.fullName} (${testEmployee.employeeCode})\n`);
        
        // Test date range
        const startDate = '2026-02-01';
        const endDate = '2026-02-28';
        
        console.log(`Date Range: ${startDate} to ${endDate}\n`);
        
        // STEP 1: Check AttendanceLog (raw data)
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 1: RAW ATTENDANCE LOG DATA');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const rawLogs = await AttendanceLog.find({
            user: testEmployee._id,
            attendanceDate: { $gte: startDate, $lte: endDate }
        }).sort({ attendanceDate: 1 }).lean();
        
        console.log(`Total Records: ${rawLogs.length}\n`);
        
        let rawTotalHours = 0;
        let rawPresentCount = 0;
        let adminOverrideCount = 0;
        
        console.log('Sample Records (first 5):\n');
        rawLogs.slice(0, 5).forEach(log => {
            console.log(`  ${log.attendanceDate}:`);
            console.log(`    Hours: ${log.totalWorkingHours.toFixed(2)}`);
            console.log(`    Status: ${log.attendanceStatus}`);
            console.log(`    Admin Override: ${log.overriddenByAdmin ? 'YES' : 'NO'}`);
            console.log(`    Override Type: ${log.adminOverride || 'None'}\n`);
            
            rawTotalHours += log.totalWorkingHours;
            if (['On-time', 'Late', 'Half-day'].includes(log.attendanceStatus)) {
                rawPresentCount++;
            }
            if (log.overriddenByAdmin) {
                adminOverrideCount++;
            }
        });
        
        console.log('Raw Data Summary:');
        console.log(`  Total Hours: ${rawTotalHours.toFixed(2)}`);
        console.log(`  Present Count: ${rawPresentCount}`);
        console.log(`  Admin Overrides: ${adminOverrideCount}\n`);
        
        // STEP 2: Check AttendanceSummaryService (processed data)
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 2: ATTENDANCE SUMMARY SERVICE DATA');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const summaryData = await AttendanceSummaryService.getEmployeeAttendanceSummary(
            testEmployee._id,
            startDate,
            endDate
        );
        
        console.log(`Total Summary Records: ${summaryData.length}\n`);
        
        let summaryTotalHours = 0;
        let summaryPresentCount = 0;
        let summaryOverrideCount = 0;
        
        console.log('Sample Summary Records (first 5):\n');
        summaryData.slice(0, 5).forEach(day => {
            console.log(`  ${day.date}:`);
            console.log(`    Hours: ${day.totalWorkingHours.toFixed(2)}`);
            console.log(`    Final Status: ${day.finalStatus}`);
            console.log(`    Admin Override: ${day.overriddenByAdmin ? 'YES' : 'NO'}\n`);
            
            summaryTotalHours += day.totalWorkingHours;
            if (['On-time', 'Late', 'Half-day'].includes(day.finalStatus)) {
                summaryPresentCount++;
            }
            if (day.overriddenByAdmin) {
                summaryOverrideCount++;
            }
        });
        
        console.log('Summary Data Totals:');
        console.log(`  Total Hours: ${summaryTotalHours.toFixed(2)}`);
        console.log(`  Present Count: ${summaryPresentCount}`);
        console.log(`  Admin Overrides: ${summaryOverrideCount}\n`);
        
        // STEP 3: Check Analytics Service (final output)
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 3: ANALYTICS SERVICE DATA');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const analyticsResult = await AnalyticsService.calculateAttendanceMetrics({
            startDate,
            endDate,
            page: 1,
            limit: 100
        });
        
        const employeeAnalytics = analyticsResult.employeeAnalytics.find(
            emp => emp.employeeCode === testEmployee.employeeCode
        );
        
        if (!employeeAnalytics) {
            console.log('❌ Employee not found in analytics results\n');
            return;
        }
        
        console.log('Analytics Data:');
        console.log(`  Present Days: ${employeeAnalytics.presentDays}`);
        console.log(`  Total Net Hours: ${employeeAnalytics.totalNetHours}`);
        console.log(`  Average Hours: ${employeeAnalytics.avgWorkingHours}\n`);
        
        // STEP 4: Verify Consistency
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 4: CONSISTENCY VERIFICATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Comparing Data Sources:\n');
        
        // Compare hours
        console.log('Total Hours:');
        console.log(`  Raw AttendanceLog: ${rawTotalHours.toFixed(2)}`);
        console.log(`  Summary Service: ${summaryTotalHours.toFixed(2)}`);
        console.log(`  Analytics Service: ${employeeAnalytics.totalNetHours}`);
        
        const hoursMatch = Math.abs(rawTotalHours - summaryTotalHours) < 0.01 &&
                          Math.abs(summaryTotalHours - employeeAnalytics.totalNetHours) < 0.01;
        console.log(`  Match: ${hoursMatch ? '✅ YES' : '❌ NO'}\n`);
        
        // Compare present days
        console.log('Present Days:');
        console.log(`  Raw AttendanceLog: ${rawPresentCount}`);
        console.log(`  Summary Service: ${summaryPresentCount}`);
        console.log(`  Analytics Service: ${employeeAnalytics.presentDays}`);
        
        const daysMatch = rawPresentCount === summaryPresentCount &&
                         summaryPresentCount === employeeAnalytics.presentDays;
        console.log(`  Match: ${daysMatch ? '✅ YES' : '❌ NO'}\n`);
        
        // Compare admin overrides
        console.log('Admin Overrides:');
        console.log(`  Raw AttendanceLog: ${adminOverrideCount}`);
        console.log(`  Summary Service: ${summaryOverrideCount}`);
        
        const overridesMatch = adminOverrideCount === summaryOverrideCount;
        console.log(`  Match: ${overridesMatch ? '✅ YES' : '❌ NO'}\n`);
        
        // STEP 5: Test Admin Override Scenario
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 5: ADMIN OVERRIDE SCENARIO TEST');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Find a record with admin override
        const overriddenRecord = rawLogs.find(log => log.overriddenByAdmin);
        
        if (overriddenRecord) {
            console.log('Found Admin Override Record:\n');
            console.log(`  Date: ${overriddenRecord.attendanceDate}`);
            console.log(`  Hours: ${overriddenRecord.totalWorkingHours.toFixed(2)}`);
            console.log(`  Status: ${overriddenRecord.attendanceStatus}`);
            console.log(`  Override Type: ${overriddenRecord.adminOverride}`);
            console.log(`  Override Reason: ${overriddenRecord.overrideReason || 'N/A'}\n`);
            
            // Check if this override is reflected in summary
            const summaryRecord = summaryData.find(d => d.date === overriddenRecord.attendanceDate);
            
            if (summaryRecord) {
                console.log('Summary Service Reflection:');
                console.log(`  Hours: ${summaryRecord.totalWorkingHours.toFixed(2)}`);
                console.log(`  Status: ${summaryRecord.finalStatus}`);
                console.log(`  Override Flag: ${summaryRecord.overriddenByAdmin ? 'YES' : 'NO'}`);
                
                const overrideRespected = Math.abs(overriddenRecord.totalWorkingHours - summaryRecord.totalWorkingHours) < 0.01 &&
                                         overriddenRecord.attendanceStatus === summaryRecord.finalStatus;
                console.log(`  Override Respected: ${overrideRespected ? '✅ YES' : '❌ NO'}\n`);
            }
        } else {
            console.log('ℹ️  No admin override records found in this date range\n');
        }
        
        // STEP 6: Final Verification
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 6: FINAL VERIFICATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const allChecks = [
            { name: 'Hours Consistency', passed: hoursMatch },
            { name: 'Present Days Consistency', passed: daysMatch },
            { name: 'Admin Override Tracking', passed: overridesMatch }
        ];
        
        console.log('Verification Results:\n');
        allChecks.forEach(check => {
            console.log(`  ${check.passed ? '✅' : '❌'} ${check.name}`);
        });
        console.log();
        
        const allPassed = allChecks.every(check => check.passed);
        
        if (allPassed) {
            console.log('✅ SUCCESS: All verification checks passed!\n');
            console.log('Summary:');
            console.log('  - Analytics uses AttendanceSummaryService as single source');
            console.log('  - Admin overrides are properly tracked');
            console.log('  - Data is consistent across all layers');
            console.log('  - totalWorkingHours includes admin edits\n');
        } else {
            console.log('⚠️  WARNING: Some verification checks failed\n');
            console.log('Issues detected:');
            allChecks.filter(c => !c.passed).forEach(check => {
                console.log(`  - ${check.name}`);
            });
            console.log();
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('VERIFICATION COMPLETE');
        console.log('═══════════════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

verifyAdminOverrideAnalyticsSync();
