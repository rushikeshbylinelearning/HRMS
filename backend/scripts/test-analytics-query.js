/**
 * TEST SCRIPT: Test actual analytics query
 * 
 * This script tests the exact query that the analytics endpoint uses
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AnalyticsService = require('../services/AnalyticsService');

async function testAnalyticsQuery() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Test with the same date range as the screenshot
        const filters = {
            startDate: '2026-01-01',
            endDate: '2026-01-31',
            page: 1,
            limit: 50
        };
        
        console.log('Testing analytics with filters:', filters);
        console.log('\n');
        
        const result = await AnalyticsService.calculateAttendanceMetrics(filters);
        
        console.log('=== SUMMARY ===');
        console.log(result.summary);
        console.log('\n');
        
        console.log('=== EMPLOYEE ANALYTICS (First 10) ===');
        result.employeeAnalytics.slice(0, 10).forEach(emp => {
            console.log({
                rank: emp.rank,
                name: emp.employeeName,
                code: emp.employeeCode,
                present: emp.presentDays,
                leave: emp.leaveDays,
                absent: emp.absentDays,
                nonWorking: emp.nonWorkingDays,
                totalHours: emp.totalNetHours,
                avgHours: emp.avgWorkingHours,
                attendance: emp.attendancePercentage + '%'
            });
        });
        
        console.log('\n=== EMPLOYEES WITH ABSENT DAYS ===');
        const withAbsent = result.employeeAnalytics.filter(emp => emp.absentDays > 0);
        console.log(`Found ${withAbsent.length} employees with absent days:`);
        withAbsent.forEach(emp => {
            console.log({
                name: emp.employeeName,
                code: emp.employeeCode,
                present: emp.presentDays,
                leave: emp.leaveDays,
                absent: emp.absentDays,
                nonWorking: emp.nonWorkingDays,
                expected: emp.leaveDays + emp.absentDays
            });
        });
        
        console.log('\n✅ Test complete');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

testAnalyticsQuery();
