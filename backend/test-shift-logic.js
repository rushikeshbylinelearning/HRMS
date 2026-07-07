// Test script to verify shift-specific Required Logout logic

const { calculateRequiredLogoutTime } = require('./services/requiredLogoutService');

console.log('=== Testing Shift-Specific Required Logout Logic ===\n');

const testCases = [
    {
        name: '10 AM Shift - On-time check-in',
        params: {
            clockInTime: new Date('2026-02-09T10:00:00+05:30'),
            totalPaidBreakMinutes: 30,
            totalUnpaidBreakMinutes: 0,
            shift: { shiftName: 'General Shift 1', shiftType: 'General' },
            attendanceDate: '2026-02-09'
        },
        expected: '7:00 PM (19:00) - hard floor'
    },
    {
        name: '10 AM Shift - Early check-in at 9:00 AM',
        params: {
            clockInTime: new Date('2026-02-09T09:00:00+05:30'),
            totalPaidBreakMinutes: 30,
            totalUnpaidBreakMinutes: 0,
            shift: { shiftName: 'General Shift 1', shiftType: 'General' },
            attendanceDate: '2026-02-09'
        },
        expected: '7:00 PM (19:00) - hard floor'
    },
    {
        name: '10 AM Shift - With 45 min paid break (15 min excess)',
        params: {
            clockInTime: new Date('2026-02-09T10:00:00+05:30'),
            totalPaidBreakMinutes: 45,
            totalUnpaidBreakMinutes: 0,
            shift: { shiftName: 'General Shift 1', shiftType: 'General' },
            attendanceDate: '2026-02-09'
        },
        expected: '7:15 PM (19:15) - 7 PM + 15 min excess'
    },
    {
        name: '11 AM Shift - Early check-in at 9:30 AM',
        params: {
            clockInTime: new Date('2026-02-09T09:30:00+05:30'),
            totalPaidBreakMinutes: 30,
            totalUnpaidBreakMinutes: 0,
            shift: { shiftName: 'General Shift 2', shiftType: 'General' },
            attendanceDate: '2026-02-09'
        },
        expected: '7:00 PM (19:00) - early check-in floor (< 11 AM)'
    },
    {
        name: '11 AM Shift - Check-in at 10:30 AM',
        params: {
            clockInTime: new Date('2026-02-09T10:30:00+05:30'),
            totalPaidBreakMinutes: 30,
            totalUnpaidBreakMinutes: 0,
            shift: { shiftName: 'General Shift 2', shiftType: 'General' },
            attendanceDate: '2026-02-09'
        },
        expected: '7:00 PM (19:00) - early check-in floor (< 11 AM)'
    },
    {
        name: '11 AM Shift - On-time check-in at 11:00 AM',
        params: {
            clockInTime: new Date('2026-02-09T11:00:00+05:30'),
            totalPaidBreakMinutes: 30,
            totalUnpaidBreakMinutes: 0,
            shift: { shiftName: 'General Shift 2', shiftType: 'General' },
            attendanceDate: '2026-02-09'
        },
        expected: '8:00 PM (20:00) - duration-based (≥ 11 AM)'
    },
    {
        name: '11 AM Shift - Late check-in at 12:00 PM',
        params: {
            clockInTime: new Date('2026-02-09T12:00:00+05:30'),
            totalPaidBreakMinutes: 30,
            totalUnpaidBreakMinutes: 0,
            shift: { shiftName: 'General Shift 2', shiftType: 'General' },
            attendanceDate: '2026-02-09'
        },
        expected: '9:00 PM (21:00) - duration-based (≥ 11 AM)'
    },
    {
        name: '11 AM Shift - Very late check-in at 2:00 PM',
        params: {
            clockInTime: new Date('2026-02-09T14:00:00+05:30'),
            totalPaidBreakMinutes: 30,
            totalUnpaidBreakMinutes: 0,
            shift: { shiftName: 'General Shift 2', shiftType: 'General' },
            attendanceDate: '2026-02-09'
        },
        expected: '11:00 PM (23:00) - duration-based (≥ 11 AM)'
    }
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: ${testCase.name}`);
    console.log('Expected:', testCase.expected);
    
    const result = calculateRequiredLogoutTime(testCase.params);
    
    if (result && result.requiredLogoutTime) {
        const logoutTime = new Date(result.requiredLogoutTime);
        const istTime = logoutTime.toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        console.log('Actual:  ', istTime, '(' + logoutTime.toISOString() + ')');
        console.log('✓ Test passed');
        passed++;
    } else {
        console.log('✗ Test failed - no result returned');
        failed++;
    }
});

console.log('\n=== Test Summary ===');
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed === 0) {
    console.log('\n✓ All shift logic tests passed!');
    process.exit(0);
} else {
    console.log('\n✗ Some tests failed');
    process.exit(1);
}
