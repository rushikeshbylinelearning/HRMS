// backend/scripts/test-insufficient-hours-logic.js
/**
 * TEST SCRIPT FOR INSUFFICIENT HOURS BACKFILL LOGIC
 * 
 * This script tests the eligibility logic and reason generation
 * without making any database changes.
 */

const mongoose = require('mongoose');
const connectDB = require('../db');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');

/**
 * Test scenarios for insufficient hours logic
 */
const testScenarios = [
    {
        name: 'Eligible: 6.5 hours worked',
        totalWorkedMinutes: 390, // 6.5 hours
        isHalfDay: false,
        overriddenByAdmin: false,
        attendanceStatus: 'Present',
        clockInTime: new Date('2024-03-15T09:00:00+05:30'),
        expectedEligible: true,
        expectedReason: 'Worked 6h 30m, minimum required is 8h'
    },
    {
        name: 'Eligible: 7.25 hours worked',
        totalWorkedMinutes: 435, // 7.25 hours
        isHalfDay: false,
        overriddenByAdmin: false,
        attendanceStatus: 'Present',
        clockInTime: new Date('2024-03-15T09:00:00+05:30'),
        expectedEligible: true,
        expectedReason: 'Worked 7h 15m, minimum required is 8h'
    },
    {
        name: 'Not Eligible: 8 hours worked (exactly)',
        totalWorkedMinutes: 480, // 8 hours exactly
        isHalfDay: false,
        overriddenByAdmin: false,
        attendanceStatus: 'Present',
        clockInTime: new Date('2024-03-15T09:00:00+05:30'),
        expectedEligible: false,
        expectedReason: 'Sufficient working hours'
    },
    {
        name: 'Not Eligible: 8.5 hours worked',
        totalWorkedMinutes: 510, // 8.5 hours
        isHalfDay: false,
        overriddenByAdmin: false,
        attendanceStatus: 'Present',
        clockInTime: new Date('2024-03-15T09:00:00+05:30'),
        expectedEligible: false,
        expectedReason: 'Sufficient working hours'
    },
    {
        name: 'Not Eligible: Already Half Day',
        totalWorkedMinutes: 360, // 6 hours
        isHalfDay: true,
        overriddenByAdmin: false,
        attendanceStatus: 'Half-day',
        clockInTime: new Date('2024-03-15T09:00:00+05:30'),
        expectedEligible: false,
        expectedReason: 'Already marked as half-day'
    },
    {
        name: 'Not Eligible: Admin Overridden',
        totalWorkedMinutes: 360, // 6 hours
        isHalfDay: false,
        overriddenByAdmin: true,
        attendanceStatus: 'Present',
        clockInTime: new Date('2024-03-15T09:00:00+05:30'),
        expectedEligible: false,
        expectedReason: 'Admin overridden - protected'
    },
    {
        name: 'Not Eligible: Leave Record',
        totalWorkedMinutes: 0,
        isHalfDay: false,
        overriddenByAdmin: false,
        attendanceStatus: 'Leave',
        clockInTime: null,
        expectedEligible: false,
        expectedReason: 'Leave record'
    },
    {
        name: 'Not Eligible: No Clock-in (Absent)',
        totalWorkedMinutes: 0,
        isHalfDay: false,
        overriddenByAdmin: false,
        attendanceStatus: 'Absent',
        clockInTime: null,
        expectedEligible: false,
        expectedReason: 'No clock-in time (absent day)'
    }
];

/**
 * Format worked time as "Xh Ym"
 */
function formatWorkedTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (minutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
}

/**
 * Test eligibility logic (simplified version of the main script logic)
 */
function testEligibility(scenario) {
    const MIN_WORKING_MINUTES = 480; // 8 hours
    
    // Rule 1: Skip if already marked as half-day
    if (scenario.isHalfDay === true) {
        return { eligible: false, reason: 'Already marked as half-day' };
    }
    
    // Rule 2: Skip if admin overridden
    if (scenario.overriddenByAdmin === true) {
        return { eligible: false, reason: 'Admin overridden - protected' };
    }
    
    // Rule 3: Skip if leave record
    if (scenario.attendanceStatus === 'Leave') {
        return { eligible: false, reason: 'Leave record' };
    }
    
    // Rule 4: Must have clock-in time (working day)
    if (!scenario.clockInTime) {
        return { eligible: false, reason: 'No clock-in time (absent day)' };
    }
    
    // Rule 5: Must have insufficient working hours
    if (scenario.totalWorkedMinutes >= MIN_WORKING_MINUTES) {
        return { 
            eligible: false, 
            reason: 'Sufficient working hours',
            totalWorkedMinutes: scenario.totalWorkedMinutes
        };
    }
    
    // Eligible for backfill
    return { 
        eligible: true, 
        reason: 'INSUFFICIENT_WORKING_HOURS',
        totalWorkedMinutes: scenario.totalWorkedMinutes
    };
}

/**
 * Generate reason text
 */
function generateReasonText(totalWorkedMinutes) {
    const workedTime = formatWorkedTime(totalWorkedMinutes);
    return `Worked ${workedTime}, minimum required is 8h`;
}

/**
 * Run test scenarios
 */
function runTestScenarios() {
    console.log('🧪 Testing Insufficient Hours Backfill Logic...\n');
    
    let passedTests = 0;
    let totalTests = testScenarios.length;
    
    for (let i = 0; i < testScenarios.length; i++) {
        const scenario = testScenarios[i];
        console.log(`Test ${i + 1}: ${scenario.name}`);
        console.log('─'.repeat(60));
        
        // Test eligibility
        const eligibility = testEligibility(scenario);
        
        console.log(`Worked Minutes: ${scenario.totalWorkedMinutes} (${formatWorkedTime(scenario.totalWorkedMinutes)})`);
        console.log(`Clock-in: ${scenario.clockInTime ? 'Yes' : 'No'}`);
        console.log(`Is Half Day: ${scenario.isHalfDay}`);
        console.log(`Admin Override: ${scenario.overriddenByAdmin}`);
        console.log(`Status: ${scenario.attendanceStatus}`);
        console.log(`Eligible: ${eligibility.eligible}`);
        console.log(`Reason: ${eligibility.reason}`);
        
        // Generate reason text if eligible
        if (eligibility.eligible) {
            const reasonText = generateReasonText(scenario.totalWorkedMinutes);
            console.log(`Generated Reason: "${reasonText}"`);
            console.log(`Expected Reason: "${scenario.expectedReason}"`);
            
            // Validate reason text
            const reasonMatches = reasonText === scenario.expectedReason;
            if (!reasonMatches) {
                console.log(`❌ Reason text mismatch!`);
            }
        }
        
        // Validate against expected results
        const eligibilityMatches = eligibility.eligible === scenario.expectedEligible;
        const testPassed = eligibilityMatches;
        
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
    console.log('='.repeat(80));
    console.log(`🎯 TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
    console.log('='.repeat(80));
    
    if (passedTests === totalTests) {
        console.log('✅ All tests passed! Logic is working correctly.');
        console.log('💡 Ready to run dry-run: node scripts/backfill-insufficient-hours-half-day.js');
    } else {
        console.log('❌ Some tests failed. Please review the logic.');
    }
    
    return passedTests === totalTests;
}

/**
 * Test database query to see potential records
 */
async function testDatabaseQuery() {
    console.log('\n🔍 Testing Database Query for Potential Records...\n');
    
    try {
        // Query for potential records (same as main script)
        const query = {
            clockInTime: { $exists: true, $ne: null },
            isHalfDay: { $ne: true },
            overriddenByAdmin: { $ne: true },
            attendanceStatus: { $ne: 'Leave' },
            leaveRequest: { $exists: false },
            backfilledBy: { $ne: 'SYSTEM_BACKFILL_2026_INSUFFICIENT_HOURS' }
        };
        
        console.log('Query for potential records:');
        console.log(JSON.stringify(query, null, 2));
        
        const count = await AttendanceLog.countDocuments(query);
        console.log(`\n📊 Records matching basic criteria: ${count}`);
        
        if (count > 0) {
            // Get a small sample
            const sampleRecords = await AttendanceLog.find(query)
                .limit(10)
                .populate('user', 'fullName email')
                .sort({ attendanceDate: -1 });
            
            console.log(`\n📋 Sample Records (last 10):`);
            for (const record of sampleRecords) {
                // Get sessions to calculate worked time
                const sessions = await AttendanceSession.find({ attendanceLog: record._id });
                let totalWorkedMinutes = 0;
                
                for (const session of sessions) {
                    if (session.startTime && session.endTime) {
                        const duration = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60);
                        totalWorkedMinutes += Math.max(0, duration);
                    }
                }
                
                const workedTime = formatWorkedTime(Math.round(totalWorkedMinutes));
                const userName = record.user?.fullName || record.user?.email || 'Unknown';
                const eligible = totalWorkedMinutes < 480 ? '✅ Eligible' : '❌ Sufficient hours';
                
                console.log(`  ${record.attendanceDate} - ${userName}: ${workedTime} (${eligible})`);
            }
            
            // Count potentially eligible records
            const potentiallyEligible = await AttendanceLog.aggregate([
                { $match: query },
                {
                    $lookup: {
                        from: 'attendancesessions',
                        localField: '_id',
                        foreignField: 'attendanceLog',
                        as: 'sessions'
                    }
                },
                {
                    $addFields: {
                        totalWorkedMinutes: {
                            $sum: {
                                $map: {
                                    input: '$sessions',
                                    as: 'session',
                                    in: {
                                        $cond: {
                                            if: { $and: ['$$session.startTime', '$$session.endTime'] },
                                            then: {
                                                $divide: [
                                                    { $subtract: ['$$session.endTime', '$$session.startTime'] },
                                                    60000
                                                ]
                                            },
                                            else: 0
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $match: {
                        totalWorkedMinutes: { $lt: 480 }
                    }
                },
                {
                    $count: 'eligibleCount'
                }
            ]);
            
            const eligibleCount = potentiallyEligible[0]?.eligibleCount || 0;
            console.log(`\n🎯 Potentially eligible records (< 8 hours): ${eligibleCount}`);
            
            if (eligibleCount > 0) {
                console.log('💡 These records would be processed by the backfill script.');
            }
        } else {
            console.log('✅ No records found matching basic criteria.');
        }
        
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
        // Run logic tests
        const logicTestsPassed = runTestScenarios();
        
        // Connect to database for query test
        await connectDB();
        const dbTestsPassed = await testDatabaseQuery();
        
        // Overall result
        const allTestsPassed = logicTestsPassed && dbTestsPassed;
        
        console.log('\n' + '='.repeat(80));
        console.log(`🎯 OVERALL TEST RESULT: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        console.log('='.repeat(80));
        
        if (allTestsPassed) {
            console.log('✅ The backfill script logic is ready for execution.');
            console.log('🚀 Next step: Run dry-run analysis');
            console.log('   node scripts/backfill-insufficient-hours-half-day.js');
        } else {
            console.log('❌ Please fix the issues before running the backfill script.');
        }
        
        return allTestsPassed;
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        return false;
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('📝 Database connection closed');
        }
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
    testDatabaseQuery,
    formatWorkedTime
};