/**
 * Test Script: Working Saturday Logic for Casual Leave & LOP
 * 
 * This script validates the new working Saturday logic:
 * 1. Casual/LOP can be applied on working Saturdays
 * 2. Casual/LOP blocked on non-working Saturdays
 * 3. Friday-Saturday-Monday allowed only when Saturday is working
 * 4. Other leave types remain unchanged
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const LeavePolicyService = require('../services/LeavePolicyService');

// Test date helpers
const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getNextDayOfWeek = (dayOfWeek, weeksAhead = 0) => {
    const today = new Date();
    const daysUntil = (dayOfWeek - today.getDay() + 7) % 7 || 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntil + (weeksAhead * 7));
    return targetDate;
};

// Test scenarios
const testScenarios = [
    {
        name: 'Case 1: Casual leave on Working Saturday (All Saturdays Working)',
        requestType: 'Casual',
        saturdayPolicy: 'All Saturdays Working',
        getDates: () => {
            const saturday = getNextDayOfWeek(6, 1); // Next Saturday
            return [formatDate(saturday)];
        },
        expectedResult: true,
        description: 'Should be allowed - Saturday is a working day'
    },
    {
        name: 'Case 2: Casual leave on Non-working Saturday (Week 1 & 3 Off)',
        requestType: 'Casual',
        saturdayPolicy: 'Week 1 & 3 Off',
        getDates: () => {
            // Find a Saturday in week 1 or 3
            let saturday = getNextDayOfWeek(6, 1);
            const weekNum = Math.ceil(saturday.getDate() / 7);
            if (weekNum !== 1 && weekNum !== 3) {
                saturday = getNextDayOfWeek(6, 2); // Try next week
            }
            return [formatDate(saturday)];
        },
        expectedResult: false,
        description: 'Should be blocked - Saturday is a week off'
    },
    {
        name: 'Case 3: LOP on Working Saturday (Week 2 & 4 Off)',
        requestType: 'Loss of Pay',
        saturdayPolicy: 'Week 2 & 4 Off',
        getDates: () => {
            // Find a Saturday in week 1, 3, or 5 (working)
            let saturday = getNextDayOfWeek(6, 1);
            const weekNum = Math.ceil(saturday.getDate() / 7);
            if (weekNum === 2 || weekNum === 4) {
                saturday = getNextDayOfWeek(6, 2); // Try next week
            }
            return [formatDate(saturday)];
        },
        expectedResult: true,
        description: 'Should be allowed - Saturday is a working day'
    },
    {
        name: 'Case 4: Casual Friday only (Saturday OFF)',
        requestType: 'Casual',
        saturdayPolicy: 'All Saturdays Off',
        getDates: () => {
            const friday = getNextDayOfWeek(5, 1);
            return [formatDate(friday)];
        },
        expectedResult: false,
        description: 'Should be blocked - Friday without working Saturday'
    },
    {
        name: 'Case 5: Casual Friday + Working Saturday + Monday',
        requestType: 'Casual',
        saturdayPolicy: 'All Saturdays Working',
        getDates: () => {
            const friday = getNextDayOfWeek(5, 1);
            const saturday = new Date(friday);
            saturday.setDate(friday.getDate() + 1);
            const monday = new Date(friday);
            monday.setDate(friday.getDate() + 3);
            return [formatDate(friday), formatDate(saturday), formatDate(monday)];
        },
        expectedResult: true,
        description: 'Should be allowed - Friday-Saturday-Monday with working Saturday'
    },
    {
        name: 'Case 6: LOP Monday only (Saturday OFF)',
        requestType: 'Loss of Pay',
        saturdayPolicy: 'All Saturdays Off',
        getDates: () => {
            const monday = getNextDayOfWeek(1, 1);
            return [formatDate(monday)];
        },
        expectedResult: false,
        description: 'Should be blocked - Monday without working Saturday'
    },
    {
        name: 'Case 6b: Casual Monday after non-working Saturday (Weekend Clubbing Prevention)',
        requestType: 'Casual',
        saturdayPolicy: 'Week 1 & 3 Off',
        getDates: () => {
            // Find a Monday after a non-working Saturday (week 1 or 3)
            let monday = getNextDayOfWeek(1, 1);
            const saturdayBefore = new Date(monday);
            saturdayBefore.setDate(monday.getDate() - 2);
            const weekNum = Math.ceil(saturdayBefore.getDate() / 7);
            
            // Ensure Saturday before is in week 1 or 3 (non-working)
            if (weekNum !== 1 && weekNum !== 3) {
                monday = getNextDayOfWeek(1, 2); // Try next week
            }
            return [formatDate(monday)];
        },
        expectedResult: false,
        description: 'Should be blocked - Monday after non-working Saturday (prevents weekend clubbing)'
    },
    {
        name: 'Case 7: Planned Leave on Saturday (should remain blocked)',
        requestType: 'Planned',
        saturdayPolicy: 'All Saturdays Working',
        getDates: () => {
            const saturday = getNextDayOfWeek(6, 1);
            return [formatDate(saturday)];
        },
        expectedResult: false,
        description: 'Should be blocked - Planned Leave not allowed on Saturday'
    },
    {
        name: 'Case 8: Sick Leave on Saturday (should be allowed - exempt)',
        requestType: 'Sick',
        saturdayPolicy: 'All Saturdays Working',
        getDates: () => {
            const saturday = getNextDayOfWeek(6, 1);
            return [formatDate(saturday)];
        },
        expectedResult: true,
        description: 'Should be allowed - Sick Leave exempt from weekday restrictions'
    }
];

async function runTests() {
    try {
        console.log('🧪 Starting Working Saturday Logic Tests\n');
        console.log('=' .repeat(80));

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Create test employee for each scenario
        let passedTests = 0;
        let failedTests = 0;

        for (const scenario of testScenarios) {
            console.log(`\n📋 ${scenario.name}`);
            console.log(`   Description: ${scenario.description}`);
            console.log(`   Policy: ${scenario.saturdayPolicy}`);

            try {
                // Create mock employee
                const mockEmployee = {
                    alternateSaturdayPolicy: scenario.saturdayPolicy,
                    employmentStatus: 'Full-Time',
                    casualLeaveBalance: 10,
                    plannedLeaveBalance: 10,
                    sickLeaveBalance: 10
                };

                const leaveDates = scenario.getDates();
                console.log(`   Dates: ${leaveDates.join(', ')}`);

                // Test validation
                const result = await LeavePolicyService.validateWeekdayRestrictionsIntelligent(
                    mockEmployee,
                    leaveDates,
                    scenario.requestType,
                    'Full Day'
                );

                const passed = result.allowed === scenario.expectedResult;
                
                if (passed) {
                    console.log(`   ✅ PASSED - Result: ${result.allowed ? 'Allowed' : 'Blocked'}`);
                    passedTests++;
                } else {
                    console.log(`   ❌ FAILED - Expected: ${scenario.expectedResult}, Got: ${result.allowed}`);
                    if (result.reason) {
                        console.log(`   Reason: ${result.reason}`);
                    }
                    failedTests++;
                }
            } catch (error) {
                console.log(`   ❌ ERROR: ${error.message}`);
                failedTests++;
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log(`\n📊 Test Results:`);
        console.log(`   ✅ Passed: ${passedTests}/${testScenarios.length}`);
        console.log(`   ❌ Failed: ${failedTests}/${testScenarios.length}`);
        console.log(`   Success Rate: ${((passedTests / testScenarios.length) * 100).toFixed(1)}%`);

        if (failedTests === 0) {
            console.log('\n🎉 All tests passed! Working Saturday logic is functioning correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Please review the implementation.');
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run tests
runTests().catch(console.error);
