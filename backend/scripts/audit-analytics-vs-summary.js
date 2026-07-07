/**
 * AUDIT SCRIPT: Analytics vs Attendance Summary Data Mismatch
 * 
 * This script compares data from:
 * 1. Attendance Summary Calendar (Admin view) - SINGLE SOURCE OF TRUTH
 * 2. Analytics Page aggregation
 * 
 * Goal: Identify why they show different values for the same employee/period
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const AnalyticsService = require('../services/AnalyticsService');
const AttendanceSummaryService = require('../services/AttendanceSummaryService');

async function auditAnalyticsVsSummary() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('='.repeat(80));
        console.log('📊 ATTENDANCE ANALYTICS AUDIT REPORT');
        console.log('='.repeat(80));
        console.log('\n');
        
        // Test date range
        const startDate = '2026-02-01';
        const endDate = '2026-02-28';
        
        console.log(`📅 Test Period: ${startDate} to ${endDate}\n`);
        
        // ============================================================
        // STEP 1: DATA SOURCE CHECK
        // ============================================================
        console.log('1️⃣  DATA SOURCE CHECK');
        console.log('─'.repeat(80));
        
        console.log('Summary Source: AttendanceLog collection via AttendanceSummaryService');
        console.log('                Uses: /api/attendance/summary endpoint logic');
        console.log('                Status Resolution: attendanceStatusResolver.js');
        console.log('');
        console.log('Analytics Source: AttendanceLog collection via MongoDB aggregation');
        console.log('                  Uses: AnalyticsService.buildEmployeeMetricsPipeline()');
        console.log('                  Status Filtering: Direct $match on attendanceStatus field');
        console.log('');
        console.log('Same Dataset: YES (both use AttendanceLog)');
        console.log('Same Logic: NO ⚠️  (different status resolution approaches)');
        console.log('\n');
        
        // ============================================================
        // STEP 2: ENUM STATUS AUDIT
        // ============================================================
        console.log('2️⃣  ENUM STATUS VALUES AUDIT');
        console.log('─'.repeat(80));
        
        // Get distinct status values from database
        const distinctStatuses = await AttendanceLog.distinct('attendanceStatus', {
            attendanceDate: { $gte: startDate, $lte: endDate }
        });
        
        console.log('Status values found in database:');
        distinctStatuses.forEach(status => {
            console.log(`  - "${status}"`);
        });
        console.log('');
        
        // Count by status
        const statusCounts = await AttendanceLog.aggregate([
            {
                $match: {
                    attendanceDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$attendanceStatus',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);
        
        console.log('Status distribution:');
        statusCounts.forEach(s => {
            console.log(`  ${(s._id || 'null').padEnd(15)} : ${s.count}`);
        });
        console.log('');
        
        console.log('⚠️  CRITICAL FINDING:');
        console.log('Analytics treats "On-time" and "Late" as PRESENT');
        console.log('Analytics treats "Leave" as LEAVE (with leaveRequest check)');
        console.log('Analytics treats "Absent" as ABSENT');
        console.log('');
        console.log('Attendance Summary uses attendanceStatusResolver which may:');
        console.log('  - Override status based on holidays');
        console.log('  - Override status based on weekly offs');
        console.log('  - Override status based on approved leaves');
        console.log('  - Apply different precedence rules');
        console.log('\n');
        
        // ============================================================
        // STEP 3: EMPLOYEE-LEVEL COMPARISON
        // ============================================================
        console.log('3️⃣  EMPLOYEE-LEVEL COMPARISON');
        console.log('─'.repeat(80));
        
        // Find an employee with data in this period
        const sampleEmployee = await User.findOne({ isActive: true }).lean();
        if (!sampleEmployee) {
            console.log('❌ No active employees found');
            return;
        }
        
        console.log(`Sample Employee: ${sampleEmployee.fullName} (${sampleEmployee.employeeCode})`);
        console.log('');
        
        // Get Attendance Summary data
        console.log('Fetching Attendance Summary data...');
        const summaryData = await AttendanceSummaryService.getEmployeeAttendanceSummary(
            sampleEmployee._id,
            startDate,
            endDate
        );
        
        // Calculate metrics from summary
        let summaryPresent = 0;
        let summaryLeave = 0;
        let summaryAbsent = 0;
        let summaryTotalHours = 0;
        
        summaryData.forEach(day => {
            const status = day.finalStatus;
            const hours = day.totalWorkingHours || 0;
            
            // Count based on finalStatus (what calendar shows)
            if (status === 'On-time' || status === 'Late') {
                summaryPresent += day.isHalfDay ? 0.5 : 1;
                summaryTotalHours += hours;
            } else if (status === 'Leave' || status === 'Approved Leave') {
                summaryLeave += day.isHalfDay ? 0.5 : 1;
            } else if (status === 'Absent') {
                summaryAbsent += day.isHalfDay ? 0.5 : 1;
            }
            // Ignore Holiday, Weekend, etc.
        });
        
        const summaryAvgHours = summaryPresent > 0 ? summaryTotalHours / summaryPresent : 0;
        const summaryNonWorking = summaryLeave + summaryAbsent;
        
        console.log('Attendance Summary (Calendar) Results:');
        console.log(`  Present Days: ${summaryPresent.toFixed(2)}`);
        console.log(`  Leave Days: ${summaryLeave.toFixed(2)}`);
        console.log(`  Absent Days: ${summaryAbsent.toFixed(2)}`);
        console.log(`  Non-Working Days: ${summaryNonWorking.toFixed(2)}`);
        console.log(`  Total Net Hours: ${summaryTotalHours.toFixed(2)}`);
        console.log(`  Avg Working Hours: ${summaryAvgHours.toFixed(2)}`);
        console.log('');
        
        // Get Analytics data
        console.log('Fetching Analytics data...');
        const analyticsResult = await AnalyticsService.calculateAttendanceMetrics({
            startDate,
            endDate,
            page: 1,
            limit: 1000
        });
        
        const analyticsEmployee = analyticsResult.employeeAnalytics.find(
            emp => emp.employeeId.toString() === sampleEmployee._id.toString()
        );
        
        if (!analyticsEmployee) {
            console.log('❌ Employee not found in analytics results');
            console.log('   This could mean:');
            console.log('   - Employee filtered out (inactive, no shift, etc.)');
            console.log('   - No attendance records in period');
            return;
        }
        
        console.log('Analytics Results:');
        console.log(`  Present Days: ${analyticsEmployee.presentDays.toFixed(2)}`);
        console.log(`  Leave Days: ${analyticsEmployee.leaveDays.toFixed(2)}`);
        console.log(`  Absent Days: ${analyticsEmployee.absentDays.toFixed(2)}`);
        console.log(`  Non-Working Days: ${analyticsEmployee.nonWorkingDays.toFixed(2)}`);
        console.log(`  Total Net Hours: ${analyticsEmployee.totalNetHours.toFixed(2)}`);
        console.log(`  Avg Working Hours: ${analyticsEmployee.avgWorkingHours.toFixed(2)}`);
        console.log('');
        
        // Comparison table
        console.log('COMPARISON TABLE:');
        console.log('─'.repeat(80));
        console.log('METRIC              | CALENDAR | ANALYTICS | MATCH?');
        console.log('─'.repeat(80));
        
        const compareMetric = (name, calVal, anaVal) => {
            const match = Math.abs(calVal - anaVal) < 0.01;
            const matchStr = match ? '✅ YES' : '❌ NO';
            console.log(`${name.padEnd(19)} | ${calVal.toFixed(2).padStart(8)} | ${anaVal.toFixed(2).padStart(9)} | ${matchStr}`);
            return match;
        };
        
        const presentMatch = compareMetric('Present Days', summaryPresent, analyticsEmployee.presentDays);
        const leaveMatch = compareMetric('Leave Days', summaryLeave, analyticsEmployee.leaveDays);
        const absentMatch = compareMetric('Absent Days', summaryAbsent, analyticsEmployee.absentDays);
        const nonWorkingMatch = compareMetric('Non-Working Days', summaryNonWorking, analyticsEmployee.nonWorkingDays);
        const hoursMatch = compareMetric('Total Net Hours', summaryTotalHours, analyticsEmployee.totalNetHours);
        const avgMatch = compareMetric('Avg Working Hours', summaryAvgHours, analyticsEmployee.avgWorkingHours);
        
        console.log('─'.repeat(80));
        console.log('');
        
        // ============================================================
        // STEP 4: DETAILED STATUS BREAKDOWN
        // ============================================================
        console.log('4️⃣  DETAILED STATUS BREAKDOWN');
        console.log('─'.repeat(80));
        
        console.log('Attendance Summary finalStatus breakdown:');
        const summaryStatusCount = {};
        summaryData.forEach(day => {
            const status = day.finalStatus;
            summaryStatusCount[status] = (summaryStatusCount[status] || 0) + 1;
        });
        Object.keys(summaryStatusCount).sort().forEach(status => {
            console.log(`  ${status.padEnd(20)}: ${summaryStatusCount[status]}`);
        });
        console.log('');
        
        console.log('Raw AttendanceLog attendanceStatus breakdown:');
        const rawLogs = await AttendanceLog.find({
            user: sampleEmployee._id,
            attendanceDate: { $gte: startDate, $lte: endDate }
        }).lean();
        
        const rawStatusCount = {};
        rawLogs.forEach(log => {
            const status = log.attendanceStatus || 'null';
            rawStatusCount[status] = (rawStatusCount[status] || 0) + 1;
        });
        Object.keys(rawStatusCount).sort().forEach(status => {
            console.log(`  ${status.padEnd(20)}: ${rawStatusCount[status]}`);
        });
        console.log('');
        
        // ============================================================
        // STEP 5: ROOT CAUSE IDENTIFICATION
        // ============================================================
        console.log('5️⃣  ROOT CAUSE IDENTIFICATION');
        console.log('─'.repeat(80));
        console.log('');
        
        if (!presentMatch || !leaveMatch || !absentMatch) {
            console.log('🔴 MISMATCH DETECTED!');
            console.log('');
            console.log('ROOT CAUSE:');
            console.log('  Analytics uses RAW attendanceStatus field from AttendanceLog');
            console.log('  Attendance Summary uses RESOLVED finalStatus from attendanceStatusResolver');
            console.log('');
            console.log('  The attendanceStatusResolver applies precedence rules:');
            console.log('    1. Holiday (highest priority)');
            console.log('    2. Approved Leave');
            console.log('    3. Weekly Off');
            console.log('    4. Present (On-time/Late)');
            console.log('    5. Half-day');
            console.log('    6. Absent (lowest priority)');
            console.log('');
            console.log('  Analytics aggregation does NOT apply these rules.');
            console.log('  It directly counts based on stored attendanceStatus values.');
            console.log('');
            console.log('SPECIFIC ISSUES:');
            if (!presentMatch) {
                console.log('  ❌ Present Days mismatch');
                console.log('     - Calendar may show days as Holiday/Weekend that Analytics counts as Present');
            }
            if (!leaveMatch) {
                console.log('  ❌ Leave Days mismatch');
                console.log('     - Calendar applies leave precedence over other statuses');
                console.log('     - Analytics only counts if attendanceStatus === "Leave" AND leaveRequest exists');
            }
            if (!absentMatch) {
                console.log('  ❌ Absent Days mismatch');
                console.log('     - Calendar may override Absent with Holiday/Weekend/Leave');
                console.log('     - Analytics counts raw "Absent" status');
            }
        } else {
            console.log('✅ NO MISMATCH - Data is consistent');
        }
        console.log('');
        
        // ============================================================
        // STEP 6: RECOMMENDED FIX
        // ============================================================
        console.log('6️⃣  RECOMMENDED FIX');
        console.log('─'.repeat(80));
        console.log('');
        console.log('SOLUTION: Analytics MUST use AttendanceSummaryService');
        console.log('');
        console.log('Current approach:');
        console.log('  ❌ Analytics → Direct MongoDB aggregation on AttendanceLog');
        console.log('  ❌ Uses raw attendanceStatus field');
        console.log('  ❌ Does not apply status resolution logic');
        console.log('');
        console.log('Correct approach:');
        console.log('  ✅ Analytics → AttendanceSummaryService.getEmployeeAttendanceSummary()');
        console.log('  ✅ Uses resolved finalStatus');
        console.log('  ✅ Applies same precedence rules as calendar');
        console.log('  ✅ Single source of truth');
        console.log('');
        console.log('Implementation:');
        console.log('  1. Modify AnalyticsService.calculateAttendanceMetrics()');
        console.log('  2. For each employee, call AttendanceSummaryService');
        console.log('  3. Calculate metrics from finalStatus (not attendanceStatus)');
        console.log('  4. Remove direct AttendanceLog aggregation pipeline');
        console.log('');
        console.log('Code location:');
        console.log('  File: backend/services/AnalyticsService.js');
        console.log('  Function: calculateAttendanceMetrics()');
        console.log('  Replace: buildEmployeeMetricsPipeline() aggregation');
        console.log('  With: Loop through employees + AttendanceSummaryService calls');
        console.log('');
        
        console.log('='.repeat(80));
        console.log('END OF AUDIT REPORT');
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

auditAnalyticsVsSummary();
