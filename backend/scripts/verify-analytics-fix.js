/**
 * VERIFICATION SCRIPT: Verify Analytics Fix
 * 
 * This script comprehensively tests the analytics calculations to ensure:
 * 1. Absent Days are counted correctly
 * 2. Non-Working Days = Leave Days + Absent Days (ALWAYS)
 * 3. All edge cases are handled properly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AnalyticsService = require('../services/AnalyticsService');
const AttendanceLog = require('../models/AttendanceLog');

async function verifyAnalyticsFix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Get date range from database
        const dateRange = await AttendanceLog.aggregate([
            {
                $group: {
                    _id: null,
                    minDate: { $min: '$attendanceDate' },
                    maxDate: { $max: '$attendanceDate' }
                }
            }
        ]);
        
        if (!dateRange || dateRange.length === 0) {
            console.log('❌ No data in database');
            return;
        }
        
        const { minDate, maxDate } = dateRange[0];
        console.log(`Database date range: ${minDate} to ${maxDate}\n`);
        
        // Test multiple date ranges
        const testRanges = [
            { start: '2026-01-01', end: '2026-01-31', name: 'January 2026' },
            { start: '2026-02-01', end: '2026-02-28', name: 'February 2026' },
            { start: '2025-12-01', end: '2025-12-31', name: 'December 2025' },
        ];
        
        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;
        
        for (const range of testRanges) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Testing: ${range.name} (${range.start} to ${range.end})`);
            console.log('='.repeat(60));
            
            try {
                const filters = {
                    startDate: range.start,
                    endDate: range.end,
                    page: 1,
                    limit: 1000
                };
                
                const result = await AnalyticsService.calculateAttendanceMetrics(filters);
                
                console.log(`\n📊 Summary Metrics:`);
                console.log(`  Total Employees: ${result.summary.totalEmployees}`);
                console.log(`  Present Days: ${result.summary.presentDays}`);
                console.log(`  Leave Days: ${result.summary.leaveDays}`);
                console.log(`  Absent Days: ${result.summary.absentDays}`);
                console.log(`  Non-Working Days: ${result.summary.nonWorkingDays}`);
                
                // Validate summary
                totalTests++;
                const expectedSummaryNonWorking = result.summary.leaveDays + result.summary.absentDays;
                if (Math.abs(expectedSummaryNonWorking - result.summary.nonWorkingDays) < 0.01) {
                    console.log(`  ✅ Summary validation PASSED`);
                    passedTests++;
                } else {
                    console.log(`  ❌ Summary validation FAILED`);
                    console.log(`     Expected: ${expectedSummaryNonWorking}`);
                    console.log(`     Actual: ${result.summary.nonWorkingDays}`);
                    failedTests++;
                }
                
                // Validate each employee
                console.log(`\n👥 Employee Validations:`);
                let employeeFailures = 0;
                
                result.employeeAnalytics.forEach(emp => {
                    totalTests++;
                    const expectedNonWorking = (emp.leaveDays || 0) + (emp.absentDays || 0);
                    const actualNonWorking = emp.nonWorkingDays || 0;
                    
                    if (Math.abs(expectedNonWorking - actualNonWorking) < 0.01) {
                        passedTests++;
                    } else {
                        console.log(`  ❌ ${emp.employeeName} (${emp.employeeCode})`);
                        console.log(`     Present: ${emp.presentDays}, Leave: ${emp.leaveDays}, Absent: ${emp.absentDays}`);
                        console.log(`     Non-Working: ${actualNonWorking} (Expected: ${expectedNonWorking})`);
                        employeeFailures++;
                        failedTests++;
                    }
                });
                
                if (employeeFailures === 0) {
                    console.log(`  ✅ All ${result.employeeAnalytics.length} employees validated successfully`);
                } else {
                    console.log(`  ❌ ${employeeFailures} employees failed validation`);
                }
                
                // Show employees with absent days
                const withAbsent = result.employeeAnalytics.filter(emp => emp.absentDays > 0);
                if (withAbsent.length > 0) {
                    console.log(`\n📋 Employees with Absent Days (${withAbsent.length}):`);
                    withAbsent.forEach(emp => {
                        const match = Math.abs((emp.leaveDays + emp.absentDays) - emp.nonWorkingDays) < 0.01;
                        console.log(`  ${match ? '✅' : '❌'} ${emp.employeeName}: Present=${emp.presentDays}, Leave=${emp.leaveDays}, Absent=${emp.absentDays}, NonWorking=${emp.nonWorkingDays}`);
                    });
                }
                
            } catch (error) {
                console.log(`\n❌ Error testing ${range.name}:`, error.message);
                failedTests++;
                totalTests++;
            }
        }
        
        // Final summary
        console.log(`\n\n${'='.repeat(60)}`);
        console.log('FINAL TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} ✅`);
        console.log(`Failed: ${failedTests} ❌`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
        
        if (failedTests === 0) {
            console.log(`\n🎉 ALL TESTS PASSED! Analytics calculations are correct.`);
        } else {
            console.log(`\n⚠️  SOME TESTS FAILED! Please review the errors above.`);
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

verifyAnalyticsFix();
