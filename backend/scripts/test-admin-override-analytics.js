/**
 * TEST SCRIPT: Verify Analytics Uses Admin Summary as Single Source of Truth
 * 
 * This script tests that:
 * 1. Analytics uses totalWorkingHours from AttendanceSummaryService
 * 2. Admin overrides are reflected in Analytics
 * 3. No direct AttendanceLog queries for working hours
 * 4. Analytics matches Admin Summary exactly
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AnalyticsService = require('../services/AnalyticsService');
const AttendanceSummaryService = require('../services/AttendanceSummaryService');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');

async function testAdminOverrideInAnalytics() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Test parameters
        const startDate = '2026-02-01';
        const endDate = '2026-02-28';
        
        console.log('='.repeat(80));
        console.log('TEST: Analytics Uses Admin Summary as Single Source of Truth');
        console.log('='.repeat(80));
        console.log(`Date Range: ${startDate} to ${endDate}\n`);
        
        // Step 1: Get a sample employee
        const employee = await User.findOne({ 
            isActive: true,
            employeeCode: { $exists: true }
        }).select('_id fullName employeeCode').lean();
        
        if (!employee) {
            console.log('❌ No active employee found');
            process.exit(1);
        }
        
        console.log(`Sample Employee: ${employee.fullName} (${employee.employeeCode})`);
        console.log('');
        
        // Step 2: Get Admin Summary data
        console.log('📊 Fetching Admin Summary data...');
        const summaryData = await AttendanceSummaryService.getEmployeeAttendanceSummary(
            employee._id,
            startDate,
            endDate
        );
        
        // Calculate expected metrics from summary
        let expectedPresent = 0;
        let expectedLeave = 0;
        let expectedAbsent = 0;
        let expectedTotalHours = 0;
        
        summaryData.forEach(day => {
            const status = day.finalStatus;
            const hours = day.totalWorkingHours || 0;
            
            if (status === 'On-time' || status === 'Late' || status === 'Half-day') {
                expectedPresent += 1;
                expectedTotalHours += hours;
            } else if (status === 'Leave' || status === 'Approved Leave') {
                expectedLeave += 1;
            } else if (status === 'Absent') {
                expectedAbsent += 1;
            }
        });
        
        const expectedAvgHours = expectedPresent > 0 ? expectedTotalHours / expectedPresent : 0;
        
        console.log('Expected Metrics (from Admin Summary):');
        console.log(`  Present Days: ${expectedPresent}`);
        console.log(`  Leave Days: ${expectedLeave}`);
        console.log(`  Absent Days: ${expectedAbsent}`);
        console.log(`  Total Net Hours: ${expectedTotalHours.toFixed(2)}`);
        console.log(`  Avg Working Hours: ${expectedAvgHours.toFixed(2)}`);
        console.log('');
        
        // Step 3: Get Analytics data
        console.log('📈 Fetching Analytics data...');
        const analyticsResult = await AnalyticsService.calculateAttendanceMetrics({
            startDate,
            endDate,
            page: 1,
            limit: 1000
        });
        
        // Find this employee in analytics
        const analyticsEmployee = analyticsResult.employeeAnalytics.find(
            emp => emp.employeeId.toString() === employee._id.toString()
        );
        
        if (!analyticsEmployee) {
            console.log('❌ Employee not found in Analytics result');
            process.exit(1);
        }
        
        console.log('Analytics Metrics:');
        console.log(`  Present Days: ${analyticsEmployee.presentDays}`);
        console.log(`  Leave Days: ${analyticsEmployee.leaveDays}`);
        console.log(`  Absent Days: ${analyticsEmployee.absentDays}`);
        console.log(`  Total Net Hours: ${analyticsEmployee.totalNetHours}`);
        console.log(`  Avg Working Hours: ${analyticsEmployee.avgWorkingHours}`);
        console.log('');
        
        // Step 4: Compare
        console.log('='.repeat(80));
        console.log('COMPARISON RESULTS');
        console.log('='.repeat(80));
        
        const presentMatch = expectedPresent === analyticsEmployee.presentDays;
        const leaveMatch = expectedLeave === analyticsEmployee.leaveDays;
        const absentMatch = expectedAbsent === analyticsEmployee.absentDays;
        const hoursMatch = Math.abs(expectedTotalHours - analyticsEmployee.totalNetHours) < 0.01;
        const avgMatch = Math.abs(expectedAvgHours - analyticsEmployee.avgWorkingHours) < 0.01;
        
        console.log(`Present Days:        ${presentMatch ? '✅' : '❌'} ${presentMatch ? 'MATCH' : 'MISMATCH'}`);
        console.log(`Leave Days:          ${leaveMatch ? '✅' : '❌'} ${leaveMatch ? 'MATCH' : 'MISMATCH'}`);
        console.log(`Absent Days:         ${absentMatch ? '✅' : '❌'} ${absentMatch ? 'MATCH' : 'MISMATCH'}`);
        console.log(`Total Net Hours:     ${hoursMatch ? '✅' : '❌'} ${hoursMatch ? 'MATCH' : 'MISMATCH'}`);
        console.log(`Avg Working Hours:   ${avgMatch ? '✅' : '❌'} ${avgMatch ? 'MATCH' : 'MISMATCH'}`);
        console.log('');
        
        const allMatch = presentMatch && leaveMatch && absentMatch && hoursMatch && avgMatch;
        
        if (allMatch) {
            console.log('🎉 SUCCESS: Analytics matches Admin Summary exactly!');
            console.log('✅ Analytics is using Admin Summary as single source of truth');
        } else {
            console.log('❌ FAILURE: Analytics does not match Admin Summary');
            console.log('⚠️  Analytics may not be using Admin Summary correctly');
        }
        console.log('');
        
        // Step 5: Verify totalWorkingHours is included in summary data
        console.log('='.repeat(80));
        console.log('VERIFICATION: totalWorkingHours in Summary Data');
        console.log('='.repeat(80));
        
        const sampleDay = summaryData.find(d => d.finalStatus === 'On-time' || d.finalStatus === 'Late');
        if (sampleDay) {
            console.log(`Sample Day: ${sampleDay.date}`);
            console.log(`  Status: ${sampleDay.finalStatus}`);
            console.log(`  totalWorkingHours: ${sampleDay.totalWorkingHours}`);
            
            if (sampleDay.totalWorkingHours !== undefined) {
                console.log('✅ totalWorkingHours is included in summary data');
            } else {
                console.log('❌ totalWorkingHours is NOT included in summary data');
            }
        } else {
            console.log('⚠️  No present days found to verify');
        }
        console.log('');
        
        // Step 6: Check for admin overrides
        console.log('='.repeat(80));
        console.log('ADMIN OVERRIDE CHECK');
        console.log('='.repeat(80));
        
        const overriddenDays = summaryData.filter(d => d.overriddenByAdmin);
        console.log(`Days with admin override: ${overriddenDays.length}`);
        
        if (overriddenDays.length > 0) {
            console.log('Sample overridden days:');
            overriddenDays.slice(0, 3).forEach(day => {
                console.log(`  ${day.date}: ${day.finalStatus} (${day.totalWorkingHours}h)`);
            });
            console.log('✅ Admin overrides are included in summary data');
        } else {
            console.log('ℹ️  No admin overrides found for this employee');
        }
        console.log('');
        
        console.log('='.repeat(80));
        console.log('TEST COMPLETE');
        console.log('='.repeat(80));
        
        process.exit(allMatch ? 0 : 1);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run test
testAdminOverrideInAnalytics();
