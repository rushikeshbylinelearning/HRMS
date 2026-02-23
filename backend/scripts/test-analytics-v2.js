/**
 * TEST SCRIPT: Analytics V2 Implementation
 * 
 * Tests the refactored analytics service that uses AttendanceSummaryService
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AnalyticsServiceV2 = require('../services/AnalyticsService.v2');
const AttendanceSummaryService = require('../services/AttendanceSummaryService');
const User = require('../models/User');

async function testAnalyticsV2() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const startDate = '2026-02-01';
        const endDate = '2026-02-28';
        
        console.log('='.repeat(80));
        console.log('TESTING ANALYTICS V2 (Using AttendanceSummaryService)');
        console.log('='.repeat(80));
        console.log(`\nDate Range: ${startDate} to ${endDate}\n`);
        
        // Test with filters
        const filters = {
            startDate,
            endDate,
            page: 1,
            limit: 50
        };
        
        console.log('Running Analytics V2...');
        const result = await AnalyticsServiceV2.calculateAttendanceMetrics(filters);
        
        console.log('\n📊 SUMMARY METRICS:');
        console.log('─'.repeat(80));
        console.log(`Total Employees: ${result.summary.totalEmployees}`);
        console.log(`Present Days: ${result.summary.presentDays}`);
        console.log(`Leave Days: ${result.summary.leaveDays}`);
        console.log(`Absent Days: ${result.summary.absentDays}`);
        console.log(`Non-Working Days: ${result.summary.nonWorkingDays}`);
        console.log(`Attendance %: ${result.summary.attendancePercentage}%`);
        console.log(`Total Net Hours: ${result.summary.totalNetHours}`);
        console.log(`Avg Working Hours: ${result.summary.averageWorkingHours}`);
        console.log(`Overtime Hours: ${result.summary.overtimeHours}`);
        
        console.log('\n👥 EMPLOYEE ANALYTICS (First 10):');
        console.log('─'.repeat(80));
        result.employeeAnalytics.slice(0, 10).forEach(emp => {
            console.log(`${emp.rank}. ${emp.employeeName} (${emp.employeeCode})`);
            console.log(`   Present: ${emp.presentDays}, Leave: ${emp.leaveDays}, Absent: ${emp.absentDays}, NonWorking: ${emp.nonWorkingDays}`);
            console.log(`   Attendance: ${emp.attendancePercentage}%, Avg Hours: ${emp.avgWorkingHours}`);
        });
        
        console.log('\n📋 EMPLOYEES WITH ABSENT DAYS:');
        console.log('─'.repeat(80));
        const withAbsent = result.employeeAnalytics.filter(emp => emp.absentDays > 0);
        console.log(`Found ${withAbsent.length} employees with absent days:\n`);
        withAbsent.forEach(emp => {
            const expected = emp.leaveDays + emp.absentDays;
            const match = Math.abs(expected - emp.nonWorkingDays) < 0.01;
            console.log(`${match ? '✅' : '❌'} ${emp.employeeName}`);
            console.log(`   Present: ${emp.presentDays}, Leave: ${emp.leaveDays}, Absent: ${emp.absentDays}`);
            console.log(`   NonWorking: ${emp.nonWorkingDays} (Expected: ${expected})`);
        });
        
        // Verify against calendar for one employee
        console.log('\n🔍 VERIFICATION: Compare with Attendance Summary Calendar');
        console.log('─'.repeat(80));
        
        const testEmployee = await User.findOne({ isActive: true }).lean();
        if (testEmployee) {
            console.log(`\nTest Employee: ${testEmployee.fullName} (${testEmployee.employeeCode})`);
            
            // Get calendar data
            const summaryData = await AttendanceSummaryService.getEmployeeAttendanceSummary(
                testEmployee._id,
                startDate,
                endDate
            );
            
            // Calculate from calendar
            let calPresent = 0, calLeave = 0, calAbsent = 0, calHours = 0;
            summaryData.forEach(day => {
                const status = day.finalStatus;
                const dayVal = day.isHalfDay ? 0.5 : 1;
                if (status === 'On-time' || status === 'Late') {
                    calPresent += dayVal;
                    calHours += day.totalWorkingHours || 0;
                } else if (status === 'Leave' || status === 'Approved Leave') {
                    calLeave += dayVal;
                } else if (status === 'Absent') {
                    calAbsent += dayVal;
                }
            });
            
            // Get from analytics
            const analyticsEmp = result.employeeAnalytics.find(
                e => e.employeeId.toString() === testEmployee._id.toString()
            );
            
            if (analyticsEmp) {
                console.log('\nCalendar (Source of Truth):');
                console.log(`  Present: ${calPresent.toFixed(2)}`);
                console.log(`  Leave: ${calLeave.toFixed(2)}`);
                console.log(`  Absent: ${calAbsent.toFixed(2)}`);
                console.log(`  NonWorking: ${(calLeave + calAbsent).toFixed(2)}`);
                console.log(`  Total Hours: ${calHours.toFixed(2)}`);
                
                console.log('\nAnalytics V2:');
                console.log(`  Present: ${analyticsEmp.presentDays.toFixed(2)}`);
                console.log(`  Leave: ${analyticsEmp.leaveDays.toFixed(2)}`);
                console.log(`  Absent: ${analyticsEmp.absentDays.toFixed(2)}`);
                console.log(`  NonWorking: ${analyticsEmp.nonWorkingDays.toFixed(2)}`);
                console.log(`  Total Hours: ${analyticsEmp.totalNetHours.toFixed(2)}`);
                
                console.log('\nMatch Status:');
                const presentMatch = Math.abs(calPresent - analyticsEmp.presentDays) < 0.01;
                const leaveMatch = Math.abs(calLeave - analyticsEmp.leaveDays) < 0.01;
                const absentMatch = Math.abs(calAbsent - analyticsEmp.absentDays) < 0.01;
                const hoursMatch = Math.abs(calHours - analyticsEmp.totalNetHours) < 0.01;
                
                console.log(`  Present: ${presentMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
                console.log(`  Leave: ${leaveMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
                console.log(`  Absent: ${absentMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
                console.log(`  Hours: ${hoursMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
                
                if (presentMatch && leaveMatch && absentMatch && hoursMatch) {
                    console.log('\n🎉 SUCCESS! Analytics V2 matches Attendance Summary Calendar!');
                } else {
                    console.log('\n⚠️  WARNING: Some metrics do not match');
                }
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('TEST COMPLETE');
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

testAnalyticsV2();
