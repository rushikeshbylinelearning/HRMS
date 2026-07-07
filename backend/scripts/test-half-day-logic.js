#!/usr/bin/env node

/**
 * Test script for new half-day logic
 * 
 * NEW POLICY:
 * - Half-day threshold: 4.5 hours worked + 0.5 hours break allowance = 5 hours total
 * - Below 5 hours total = Absent
 * - 4.5 to < 8.5 hours worked = Half-day
 * - >= 8.5 hours worked = Full day
 * - Break time doesn't matter for calculation (always assume 0.5 hour allowance)
 */

const { 
    MINIMUM_WORKING_HOURS,
    MINIMUM_HOURS_FOR_HALF_DAY,
    MINIMUM_TOTAL_HOURS_FOR_HALF_DAY,
    MINIMUM_MINUTES_FOR_HALF_DAY,
    MINIMUM_TOTAL_MINUTES_FOR_HALF_DAY,
    HALF_DAY_WORKING_MINUTES
} = require('../config/shiftPolicy');

console.log('=== HALF-DAY POLICY TEST ===\n');

console.log('Policy Constants:');
console.log(`- MINIMUM_HOURS_FOR_HALF_DAY: ${MINIMUM_HOURS_FOR_HALF_DAY} hours (${MINIMUM_MINUTES_FOR_HALF_DAY} minutes)`);
console.log(`- MINIMUM_TOTAL_HOURS_FOR_HALF_DAY: ${MINIMUM_TOTAL_HOURS_FOR_HALF_DAY} hours (${MINIMUM_TOTAL_MINUTES_FOR_HALF_DAY} minutes)`);
console.log(`- MINIMUM_WORKING_HOURS: ${MINIMUM_WORKING_HOURS} hours`);
console.log(`- HALF_DAY_WORKING_MINUTES: ${HALF_DAY_WORKING_MINUTES} minutes\n`);

// Test cases
const testCases = [
    { workedHours: 3.0, description: '3.0 hours worked' },
    { workedHours: 4.0, description: '4.0 hours worked' },
    { workedHours: 4.4, description: '4.4 hours worked' },
    { workedHours: 4.5, description: '4.5 hours worked (minimum for half-day)' },
    { workedHours: 5.0, description: '5.0 hours worked' },
    { workedHours: 6.0, description: '6.0 hours worked' },
    { workedHours: 8.0, description: '8.0 hours worked' },
    { workedHours: 8.4, description: '8.4 hours worked' },
    { workedHours: 8.5, description: '8.5 hours worked (minimum for full day)' },
    { workedHours: 9.0, description: '9.0 hours worked' }
];

console.log('Test Results:');
console.log('Worked Hours | Total Time* | Status');
console.log('-------------|-------------|--------');

testCases.forEach(testCase => {
    const { workedHours, description } = testCase;
    const totalTimeWithBreakAllowance = workedHours + 0.5; // Always add 0.5 hour break allowance
    
    let status;
    if (totalTimeWithBreakAllowance < MINIMUM_TOTAL_HOURS_FOR_HALF_DAY) {
        status = 'Absent';
    } else if (workedHours >= MINIMUM_HOURS_FOR_HALF_DAY && workedHours < MINIMUM_WORKING_HOURS) {
        status = 'Half-day';
    } else if (workedHours >= MINIMUM_WORKING_HOURS) {
        status = 'Full day';
    } else {
        status = 'Absent'; // Edge case
    }
    
    console.log(`${workedHours.toFixed(1)} hours   | ${totalTimeWithBreakAllowance.toFixed(1)} hours  | ${status}`);
});

console.log('\n* Total Time = Worked Hours + 0.5 hours break allowance');
console.log('\nPolicy Summary:');
console.log('- Below 5.0 hours total → Absent');
console.log('- 4.5 to 8.4 hours worked → Half-day');
console.log('- 8.5+ hours worked → Full day');
console.log('- Break time is irrelevant (always assume 0.5 hour allowance)');

console.log('\n=== TEST COMPLETE ===');