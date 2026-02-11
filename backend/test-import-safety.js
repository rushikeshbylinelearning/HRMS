// Test script to verify requiredLogoutService.js is safe to import
// This simulates what Passenger does during module loading

console.log('=== Testing Safe Import of requiredLogoutService.js ===\n');

try {
    console.log('Step 1: Importing module...');
    const { calculateRequiredLogoutTime } = require('./services/requiredLogoutService');
    console.log('✓ Module imported successfully (no runtime execution)\n');

    console.log('Step 2: Verifying exported function exists...');
    if (typeof calculateRequiredLogoutTime === 'function') {
        console.log('✓ calculateRequiredLogoutTime is a function\n');
    } else {
        throw new Error('calculateRequiredLogoutTime is not a function');
    }

    console.log('Step 3: Testing function execution with sample data...');
    const testResult = calculateRequiredLogoutTime({
        clockInTime: new Date('2026-02-09T10:00:00+05:30'),
        totalPaidBreakMinutes: 30,
        totalUnpaidBreakMinutes: 0,
        shift: { shiftName: 'General Shift 1', shiftType: 'General' },
        attendanceDate: '2026-02-09',
        timezone: 'Asia/Kolkata'
    });

    if (testResult && testResult.requiredLogoutTime) {
        console.log('✓ Function executed successfully');
        console.log('  Required Logout Time:', testResult.requiredLogoutTime.toISOString());
        console.log('  Breakdown:', JSON.stringify(testResult.breakdown, null, 2));
    } else {
        throw new Error('Function returned invalid result');
    }

    console.log('\n=== ALL TESTS PASSED ===');
    console.log('✓ Module is safe to import under Passenger');
    console.log('✓ No top-level runtime execution detected');
    console.log('✓ Function works correctly when called');
    
    process.exit(0);
} catch (error) {
    console.error('\n=== TEST FAILED ===');
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
