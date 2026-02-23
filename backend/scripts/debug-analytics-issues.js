/**
 * DEBUG SCRIPT: Analytics Specific Issues
 * 
 * Investigates:
 * 1. Half-day counting (should count as 1 Present, not 0.5)
 * 2. Manish incorrectly marked absent
 * 3. Net Working Hours not displayed
 * 4. Average Working Hours not displayed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AttendanceSummaryService = require('../services/AttendanceSummaryService');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const Shift = require('../models/Shift');
const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');

async function debugAnalyticsIssues() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const startDate = '2026-02-01';
        const endDate = '2026-02-28';
        
        console.log('='.repeat(80));
        console.log('DEBUG: Analytics Specific Issues');
        console.log('='.repeat(80));
        console.log(`\nPeriod: ${startDate} to ${endDate}\n`);
        
        // ============================================================
        // ISSUE 1: Find Manish
        // ============================================================
        console.log('1️⃣  CHECKING MANISH DATA');
        console.log('─'.repeat(80));
        
        const manish = await User.findOne({ fullName: /Manish/i }).lean();
        if (manish) {
            console.log(`Found: ${manish.fullName} (${manish.employeeCode})\n`);
            
            // Get calendar data
            const summaryData = await AttendanceSummaryService.getEmployeeAttendanceSummary(
                manish._id,
                startDate,
                endDate
            );
            
            console.log('Calendar Data Analysis:');
            const statusCount = {};
            let presentCount = 0;
            let absentCount = 0;
            let leaveCount = 0;
            let totalHours = 0;
            
            summaryData.forEach(day => {
                const status = day.finalStatus;
                statusCount[status] = (statusCount[status] || 0) + 1;
                
                if (status === 'On-time' || status === 'Late' || status === 'Half-day') {
                    presentCount++;
                    totalHours += day.totalWorkingHours || 0;
                } else if (status === 'Absent') {
                    absentCount++;
                } else if (status === 'Leave' || status === 'Approved Leave') {
                    leaveCount++;
                }
            });
            
            console.log('\nStatus Breakdown:');
            Object.keys(statusCount).sort().forEach(status => {
                console.log(`  ${status.padEnd(20)}: ${statusCount[status]}`);
            });
            
            console.log('\nCalculated Metrics:');
            console.log(`  Present Days: ${presentCount}`);
            console.log(`  Absent Days: ${absentCount}`);
            console.log(`  Leave Days: ${leaveCount}`);
            console.log(`  Total Hours: ${totalHours.toFixed(2)}`);
            console.log(`  Avg Hours: ${presentCount > 0 ? (totalHours / presentCount).toFixed(2) : 0}`);
            
            if (absentCount > 0) {
                console.log('\n⚠️  WARNING: Manish has absent days!');
                console.log('Absent dates:');
                summaryData.filter(d => d.finalStatus === 'Absent').forEach(d => {
                    console.log(`  - ${d.attendanceDate}: ${d.finalStatus}`);
                });
            } else {
                console.log('\n✅ Manish has NO absent days (correct)');
            }
        } else {
            console.log('❌ Manish not found');
        }
        
        console.log('\n');
        
        // ============================================================
        // ISSUE 2: Half-day counting
        // ============================================================
        console.log('2️⃣  CHECKING HALF-DAY COUNTING');
        console.log('─'.repeat(80));
        
        // Find employees with half-days
        const halfDayLogs = await AttendanceLog.find({
            attendanceDate: { $gte: startDate, $lte: endDate },
            $or: [
                { isHalfDay: true },
                { attendanceStatus: 'Half-day' }
            ]
        }).populate('user', 'fullName employeeCode').lean();
        
        console.log(`Found ${halfDayLogs.length} half-day records\n`);
        
        if (halfDayLogs.length > 0) {
            console.log('Sample half-day records:');
            halfDayLogs.slice(0, 5).forEach(log => {
                console.log(`  ${log.user?.fullName} - ${log.attendanceDate}`);
                console.log(`    Status: ${log.attendanceStatus}, isHalfDay: ${log.isHalfDay}`);
                console.log(`    Hours: ${log.totalWorkingHours || 0}`);
            });
            
            // Test one employee with half-day
            const testEmployee = halfDayLogs[0].user;
            console.log(`\nTesting: ${testEmployee.fullName}`);
            
            const summaryData = await AttendanceSummaryService.getEmployeeAttendanceSummary(
                testEmployee._id,
                startDate,
                endDate
            );
            
            let presentCount = 0;
            let halfDayCount = 0;
            
            summaryData.forEach(day => {
                const status = day.finalStatus;
                if (status === 'On-time' || status === 'Late' || status === 'Half-day') {
                    presentCount++;
                }
                if (status === 'Half-day') {
                    halfDayCount++;
                }
            });
            
            console.log(`  Total Present Days: ${presentCount}`);
            console.log(`  Half-day count: ${halfDayCount}`);
            console.log(`  ✅ Half-days counted as 1 Present Day each: ${halfDayCount > 0 ? 'YES' : 'N/A'}`);
        }
        
        console.log('\n');
        
        // ============================================================
        // ISSUE 3: Working Hours Display
        // ============================================================
        console.log('3️⃣  CHECKING WORKING HOURS DATA');
        console.log('─'.repeat(80));
        
        // Check if totalWorkingHours field has data
        const logsWithHours = await AttendanceLog.countDocuments({
            attendanceDate: { $gte: startDate, $lte: endDate },
            totalWorkingHours: { $gt: 0 }
        });
        
        const totalLogs = await AttendanceLog.countDocuments({
            attendanceDate: { $gte: startDate, $lte: endDate }
        });
        
        console.log(`Total logs in period: ${totalLogs}`);
        console.log(`Logs with hours > 0: ${logsWithHours}`);
        console.log(`Logs with hours = 0: ${totalLogs - logsWithHours}`);
        
        if (logsWithHours === 0) {
            console.log('\n⚠️  WARNING: NO working hours data found!');
            console.log('This explains why Net Hours and Avg Hours show 0');
        } else {
            console.log(`\n✅ ${((logsWithHours / totalLogs) * 100).toFixed(1)}% of logs have working hours`);
        }
        
        // Sample logs with hours
        const sampleLogs = await AttendanceLog.find({
            attendanceDate: { $gte: startDate, $lte: endDate },
            totalWorkingHours: { $gt: 0 }
        }).populate('user', 'fullName').limit(5).lean();
        
        if (sampleLogs.length > 0) {
            console.log('\nSample logs with working hours:');
            sampleLogs.forEach(log => {
                console.log(`  ${log.user?.fullName} - ${log.attendanceDate}`);
                console.log(`    Status: ${log.attendanceStatus}, Hours: ${log.totalWorkingHours}`);
            });
        }
        
        console.log('\n');
        
        // ============================================================
        // ISSUE 4: Enum Values Check
        // ============================================================
        console.log('4️⃣  ENUM VALUES VERIFICATION');
        console.log('─'.repeat(80));
        
        const distinctStatuses = await AttendanceLog.distinct('attendanceStatus', {
            attendanceDate: { $gte: startDate, $lte: endDate }
        });
        
        console.log('Actual enum values in database:');
        distinctStatuses.forEach(status => {
            console.log(`  - "${status}"`);
        });
        
        console.log('\nExpected enum values (from model):');
        console.log('  - "On-time"');
        console.log('  - "Late"');
        console.log('  - "Half-day"');
        console.log('  - "Absent"');
        console.log('  - "Leave"');
        
        console.log('\n✅ Present should include: On-time, Late, Half-day');
        console.log('✅ Absent should ONLY be: Absent');
        console.log('✅ Leave should ONLY be: Leave');
        
        console.log('\n');
        
        // ============================================================
        // ISSUE 5: Present Count Verification
        // ============================================================
        console.log('5️⃣  PRESENT COUNT VERIFICATION');
        console.log('─'.repeat(80));
        
        // Find employees showing 13 instead of 14
        const employees = await User.find({ isActive: true }).limit(5).lean();
        
        console.log('Checking present counts for sample employees:\n');
        
        for (const emp of employees) {
            const summaryData = await AttendanceSummaryService.getEmployeeAttendanceSummary(
                emp._id,
                startDate,
                endDate
            );
            
            let presentCount = 0;
            let workingDays = 0;
            
            summaryData.forEach(day => {
                const status = day.finalStatus;
                if (status === 'On-time' || status === 'Late' || status === 'Half-day') {
                    presentCount++;
                }
                if (status !== 'Holiday' && status !== 'Weekly Off' && status !== 'Weekend') {
                    workingDays++;
                }
            });
            
            console.log(`${emp.fullName} (${emp.employeeCode})`);
            console.log(`  Present: ${presentCount}, Working Days: ${workingDays}`);
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('DEBUG COMPLETE');
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

debugAnalyticsIssues();
