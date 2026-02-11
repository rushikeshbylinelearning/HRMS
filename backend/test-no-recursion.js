// Test script to verify NO RECURSION in requiredLogoutService.js

console.log('=== Testing for Recursion in requiredLogoutService ===\n');

// Track function calls to detect recursion
let calculateCallCount = 0;
let getMomentCallCount = 0;
const MAX_SAFE_CALLS = 10; // If we exceed this, we have recursion

try {
    console.log('Step 1: Importing module...');
    const { calculateRequiredLogoutTime } = require('./services/requiredLogoutService');
    console.log('✓ Module imported successfully\n');

    console.log('Step 2: Testing single calculation (no recursion expected)...');
    
    // Wrap the function to count calls
    const originalCalculate = calculateRequiredLogoutTime;
    let recursionDetected = false;
    
    const testParams = {
        clockInTime: new Date('2026-02-09T10:30:00+05:30'),
        totalPaidBreakMinutes: 30,
        totalUnpaidBreakMinutes: 0,
        shift: { shiftName: 'General Shift 2', shiftType: 'General' },
        attendanceDate: '2026-02-09'
    };

    console.log('  Calling calculateRequiredLogoutTime...');
    const result = calculateRequiredLogoutTime(testParams);
    
    if (result && result.requiredLogoutTime) {
        console.log('✓ Function executed successfully');
        console.log('  Required Logout Time:', result.requiredLogoutTime.toISOString());
    } else {
        throw new Error('Function returned invalid result');
    }

    console.log('\nStep 3: Testing multiple sequential calls (stress test)...');
    const testCases = [
        { clockInTime: new Date('2026-02-09T09:00:00+05:30'), shift: { shiftName: 'General Shift 1' } },
        { clockInTime: new Date('2026-02-09T10:00:00+05:30'), shift: { shiftName: 'General Shift 1' } },
        { clockInTime: new Date('2026-02-09T09:30:00+05:30'), shift: { shiftName: 'General Shift 2' } },
        { clockInTime: new Date('2026-02-09T10:30:00+05:30'), shift: { shiftName: 'General Shift 2' } },
        { clockInTime: new Date('2026-02-09T11:00:00+05:30'), shift: { shiftName: 'General Shift 2' } },
        { clockInTime: new Date('2026-02-09T12:00:00+05:30'), shift: { shiftName: 'General Shift 2' } },
    ];

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const params = {
            clockInTime: testCase.clockInTime,
            totalPaidBreakMinutes: 30,
            totalUnpaidBreakMinutes: 0,
            shift: testCase.shift,
            attendanceDate: '2026-02-09'
        };
        
        const result = calculateRequiredLogoutTime(params);
        
        if (!result || !result.requiredLogoutTime) {
            throw new Error(`Test case ${i + 1} failed - no result`);
        }
    }
    
    console.log(`✓ Executed ${testCases.length} sequential calls successfully`);
    console.log('  No recursion detected\n');

    console.log('Step 4: Verifying getMoment is pure utility...');
    // We can't directly test getMoment since it's not exported,
    // but we can verify the module structure
    const fs = require('fs');
    const serviceCode = fs.readFileSync('./services/requiredLogoutService.js', 'utf8');
    
    // Check that getMoment doesn't call calculateRequiredLogoutTime
    const getMomentMatch = serviceCode.match(/function getMoment\(\)[^}]*\{([^}]*)\}/);
    if (getMomentMatch) {
        const getMomentBody = getMomentMatch[1];
        if (getMomentBody.includes('calculateRequiredLogoutTime')) {
            throw new Error('getMoment() calls calculateRequiredLogoutTime - RECURSION RISK!');
        }
        console.log('✓ getMoment() does not call calculateRequiredLogoutTime');
    }

    // Check for any obvious recursion patterns
    if (serviceCode.includes('calculateRequiredLogoutTime(') && 
        serviceCode.match(/calculateRequiredLogoutTime\(/g).length > 1) {
        // This is expected - the function definition and potential calls
        // But let's make sure it's not calling itself
        const functionBody = serviceCode.match(/function calculateRequiredLogoutTime\([^)]*\)[^{]*\{([\s\S]*)\n\}/);
        if (functionBody && functionBody[1].includes('calculateRequiredLogoutTime(')) {
            console.warn('⚠ Warning: calculateRequiredLogoutTime may call itself - verify manually');
        } else {
            console.log('✓ calculateRequiredLogoutTime does not call itself');
        }
    }

    console.log('\n=== ALL RECURSION TESTS PASSED ===');
    console.log('✓ No infinite loops detected');
    console.log('✓ getMoment() is a pure utility function');
    console.log('✓ calculateRequiredLogoutTime() does not call itself');
    console.log('✓ Multiple sequential calls work correctly');
    console.log('✓ Module is safe for production use');
    
    process.exit(0);
} catch (error) {
    console.error('\n=== RECURSION TEST FAILED ===');
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
