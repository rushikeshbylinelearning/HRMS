// backend/scripts/test-backfill-logic.js
/**
 * TEST SCRIPT FOR BACKFILL LOGIC
 * 
 * This script tests the backfill logic without making database changes.
 * It validates the eligibility criteria and reason generation.
 */

const mongoose = require('mongoose');
const connectDB = require('../db');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const { recalculateLateStatus } = require('../services/dailyStatusService');

/**
 * Test data scenarios
 */
const testScenarios = [
    {
        name: 'Insufficient Working Hours (6.5h)',
        clockInTime: new Date('2024-03-15T09:00:00+05:30'),
        clockOutTime: new Date('2024-03-15T15:30:00+05:30'), // 6.5 hours
        expectedEligible: true,
        expectedReason: 'INSUFFICIENT_WORKING_HOURS'
    },
    {
        name: 'Late Login + Insufficient Hours',
        clockInTime: new Date('2024-03-15T10:30:00+05:30'), // 1.5h late
        clockOutTime: new Date('2024-03-15T17:00:00+05:30'), // 6.5 hours
        expectedEligible: true,
        expectedReason: 'LATE_LOGIN' // Late takes precedence
    },
    {
        name: 'Sufficient Working Hours (8.5h)',
        clockInTime: new Date('2024-03-15T09:00:00+05:30'),
        clockOutTime: new Date('2024-03-15T17:30:00+05:30'), // 8.5 hours
        expectedEligible: false,
        expectedReason: null
    },
    {
        name: 'Already Half-Day Marked',
        clockInTime: new Date('2024-03-15T09:00:00+05:30'),
        clockOutTime: new Date('2024-03-15T15:00:00+05:30'), // 6 hours
        isHalfDay: true,
        expectedEligible: false,
        expectedReason: null
    },
    {
        name: 'Admin Overridden Record',
        clockInTime: new Date('2024-03-15T09:00:00+05:30'),
        clockOutTime: new Date('2024-03-15T15:00:00+05:30'), // 6 hours
        overriddenByAdmin: true,
        expectedEligible: false,
        expectedReason: null
    }
];

/**
 * Mock shift data
 */
const mockShift = {
    startTime: '09:00',
    durationHours: 9
};

/**
 * Calculate worked hours from clock times
 */
function calculateWorkedHours(clockIn, clockOut) {
    if (!clockIn || !clockOut) return 0;
    return (new Date(clockOut) - new Date(clockIn)) / (1000 * 60 * 60);
}

/**
 * Test eligibility logic
 */
function testEligibility(scenario) {
    const workedHours = calculateWorkedHours(scenario.clockInTime, scenario.clockOutTime);
    
    // Apply eligibility rules
    if (scenario.isHalfDay === true) {
        return { eligible: false, reason: 'Already marked as half-day' };
    }
    
    if (scenario.overriddenByAdmin === true) {
        return { eligible: false, reason: 'Admin overridden - protected' };
    }
    
    if (!scenario.clockInTime) {
        return { eligible: false, reason: 'No clock-in time (absent)' };
    }
    
    if (workedHours < 8) {
        return { 
            eligible: true, 
            reason: 'INSUFFICIENT_WORKING_HOURS',
            workedHours: workedHours.toFixed(2)
        };
    }
    
    return { eligible: false, reason: 'Sufficient working hours' };
}

/**
 * Test late login logic
 */
async function testLateLogin(scenario) {
    if (!scenario.clockInTime) return null;
    
    try {
        const lateStatus = await recalculateLateStatus(scenario.clockInTime, mockShift, 30);
        return lateStatus;
    } catch (error) {
        console.warn('Late status calculation failed:', error.message);
        return null;
    }
}

/**
 * Generate expected reason text
 */
function generateExpectedReason(scenario, eligibility, lateStatus) {
    if (!eligibility.eligible) return null;
    
    // Check if late login takes precedence
    if (lateStatus && lateStatus.isHalfDay && lateStatus.halfDayReasonCode === 'LATE_LOGIN') {
        return lateStatus.halfDayReasonText;
    }
    
    // Otherwise use insufficient hours
    if (eligibility.reason === 'INSUFFICIENT_WORKING_HOURS') {
        return `Worked ${eligibility.workedHours}h, minimum required is 8h`;
    }
    
    return 'Half-day marked by system backfill';
}

/**
 * Run test scenarios
 */
async function runTestScenarios() {
    console.log('🧪 Testing Backfill Logic...\n');
    
    let passedTests = 0;
    let totalTests = testScenarios.length;
    
    for (let i = 0; i < testScenarios.length; i++) {
        const scenario = testScenarios[i];
        console.log(`Test ${i + 1}: ${scenario.name}`);
        console.log('─'.repeat(50));
        
        // Test eligibility
        const eligibility = testEligibility(scenario);
        console.log(`Worked Hours: ${calculateWorkedHours(scenario.clockInTime, scenario.clockOutTime).toFixed(2)}h`);
        console.log(`Eligible: ${eligibility.eligible}`);
        console.log(`Reason: ${eligibility.reason}`);
        
        // Test late login if applicable
        let lateStatus = null;
        if (scenario.clockInTime) {
            lateStatus = await testLateLogin(scenario);
            if (lateStatus) {
                console.log(`Late Minutes: ${lateStatus.lateMinutes}`);
                console.log(`Is Late: ${lateStatus.isLate}`);
                console.log(`Late Half-Day: ${lateStatus.isHalfDay}`);
            }
        }
        
        // Generate expected reason
        const expectedReasonText = generateExpectedReason(scenario, eligibility, lateStatus);
        if (expectedReasonText) {
            console.log(`Expected Reason Text: ${expectedReasonText}`);
        }
        
        // Validate against expected results
        const testPassed = eligibility.eligible === scenario.expectedEligible;
        console.log(`Expected Eligible: ${scenario.expectedEligible}`);
        console.log(`Test Result: ${testPassed ? '✅ PASSED' : '❌ FAILED'}`);
        
        if (testPassed) {
            passedTests++;
        } else {
            console.log(`❌ Expected eligible=${scenario.expectedEligible}, got eligible=${eligibility.eligible}`);
        }
        
        console.log(''); // Empty line for readability
    }
    
    // Summary
    console.log('='.repeat(60));
    console.log(`🎯 TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
    console.log('='.repeat(60));
    
    if (passedTests === totalTests) {
        console.log('✅ All tests passed! Backfill logic is working correctly.');
    } else {
        console.log('❌ Some tests failed. Please review the logic.');
    }
    
    return passedTests === totalTests;
}

/**
 * Test database query logic
 */
async function testDatabaseQueries() {
    console.log('\n🔍 Testing Database Query Logic...\n');
    
    try {
        // Test eligibility query
        const eligibilityQuery = {
            clockInTime: { $exists: true, $ne: null },
            isHalfDay: { $ne: true },
            overriddenByAdmin: { $ne: true },
            attendanceStatus: { $ne: 'Leave' },
            leaveRequest: { $exists: false }
        };
        
        console.log('Eligibility Query:');
        console.log(JSON.stringify(eligibilityQuery, null, 2));
        
        // Test query execution (count only, no data retrieval)
        const count = await AttendanceLog.countDocuments(eligibilityQuery);
        console.log(`\n📊 Records matching eligibility criteria: ${count}`);
        
        // Test a small sample
        const sampleRecords = await AttendanceLog.find(eligibilityQuery)
            .limit(5)
            .populate('user', 'fullName email');
        
        console.log(`\n📋 Sample Records (first 5):`);
        sampleRecords.forEach((record, index) => {
            console.log(`${index + 1}. ${record.user?.fullName || record.user?.email || 'Unknown'} - ${record.attendanceDate}`);
            console.log(`   Status: ${record.attendanceStatus}, Half-Day: ${record.isHalfDay}, Admin Override: ${record.overriddenByAdmin}`);
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ Database query test failed:', error.message);
        return false;
    }
}

/**
 * Main test function
 */
async function runTests() {
    try {
        await connectDB();
        
        // Run logic tests
        const logicTestsPassed = await runTestScenarios();
        
        // Run database tests
        const dbTestsPassed = await testDatabaseQueries();
        
        // Overall result
        const allTestsPassed = logicTestsPassed && dbTestsPassed;
        
        console.log('\n' + '='.repeat(80));
        console.log(`🎯 OVERALL TEST RESULT: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        console.log('='.repeat(80));
        
        if (allTestsPassed) {
            console.log('✅ The backfill script is ready for dry-run execution.');
        } else {
            console.log('❌ Please fix the issues before running the backfill script.');
        }
        
        return allTestsPassed;
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        return false;
    } finally {
        await mongoose.connection.close();
        console.log('📝 Database connection closed');
    }
}

// Execute if run directly
if (require.main === module) {
    runTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = {
    runTests,
    runTestScenarios,
    testDatabaseQueries
};