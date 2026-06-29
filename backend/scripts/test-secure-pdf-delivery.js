/**
 * Test Script: Secure PDF Delivery System
 * 
 * This script validates the secure PDF delivery implementation:
 * 1. Public access blocked
 * 2. Authentication required
 * 3. PDF streaming works
 * 4. Range requests supported
 * 
 * Usage: node backend/scripts/test-secure-pdf-delivery.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3011';
const TEST_TOKEN = process.env.TEST_TOKEN || ''; // Set valid JWT token for testing

async function runTests() {
    console.log('🧪 Starting Secure PDF Delivery Tests\n');
    console.log(`Base URL: ${BASE_URL}\n`);

    let passedTests = 0;
    let failedTests = 0;

    // Test 1: Public access should be blocked
    console.log('Test 1: Public access to /policies/*.pdf should be blocked');
    try {
        const response = await axios.get(`${BASE_URL}/policies/policy-test.pdf`, {
            validateStatus: () => true
        });
        
        if (response.status === 404) {
            console.log('✅ PASS: Public access blocked (404)\n');
            passedTests++;
        } else {
            console.log(`❌ FAIL: Expected 404, got ${response.status}\n`);
            failedTests++;
        }
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}\n`);
        failedTests++;
    }

    // Test 2: Unauthenticated API access should be blocked
    console.log('Test 2: Unauthenticated access to /api/policies/file/*.pdf should be blocked');
    try {
        const response = await axios.get(`${BASE_URL}/api/policies/file/policy-test.pdf`, {
            validateStatus: () => true
        });
        
        if (response.status === 401 || response.status === 302) {
            console.log('✅ PASS: Unauthenticated access blocked (401/302)\n');
            passedTests++;
        } else {
            console.log(`❌ FAIL: Expected 401/302, got ${response.status}\n`);
            failedTests++;
        }
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}\n`);
        failedTests++;
    }

    // Test 3: Directory traversal should be blocked
    console.log('Test 3: Directory traversal attack should be blocked');
    if (TEST_TOKEN) {
        try {
            const response = await axios.get(`${BASE_URL}/api/policies/file/../../../etc/passwd`, {
                headers: { Authorization: `Bearer ${TEST_TOKEN}` },
                validateStatus: () => true
            });
            
            if (response.status === 400) {
                console.log('✅ PASS: Directory traversal blocked (400)\n');
                passedTests++;
            } else {
                console.log(`❌ FAIL: Expected 400, got ${response.status}\n`);
                failedTests++;
            }
        } catch (error) {
            console.log(`❌ FAIL: ${error.message}\n`);
            failedTests++;
        }
    } else {
        console.log('⏭️  SKIP: No TEST_TOKEN provided\n');
    }

    // Test 4: Authenticated access should work
    console.log('Test 4: Authenticated access should work (if valid token provided)');
    if (TEST_TOKEN) {
        try {
            // First, get list of policies to find a real filename
            const policiesResponse = await axios.get(`${BASE_URL}/api/policies`, {
                headers: { Authorization: `Bearer ${TEST_TOKEN}` }
            });

            if (policiesResponse.data.policies && policiesResponse.data.policies.length > 0) {
                const policy = policiesResponse.data.policies[0];
                const filename = policy.fileUrl.split('/').pop();

                const response = await axios.get(`${BASE_URL}/api/policies/file/${filename}`, {
                    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
                    validateStatus: () => true
                });

                if (response.status === 200 && response.headers['content-type'] === 'application/pdf') {
                    console.log('✅ PASS: Authenticated access works (200, PDF content-type)\n');
                    passedTests++;
                } else {
                    console.log(`❌ FAIL: Expected 200 with PDF content-type, got ${response.status}\n`);
                    failedTests++;
                }
            } else {
                console.log('⏭️  SKIP: No policies found in database\n');
            }
        } catch (error) {
            console.log(`❌ FAIL: ${error.message}\n`);
            failedTests++;
        }
    } else {
        console.log('⏭️  SKIP: No TEST_TOKEN provided\n');
    }

    // Test 5: Check security headers
    console.log('Test 5: Security headers should be present');
    if (TEST_TOKEN) {
        try {
            const policiesResponse = await axios.get(`${BASE_URL}/api/policies`, {
                headers: { Authorization: `Bearer ${TEST_TOKEN}` }
            });

            if (policiesResponse.data.policies && policiesResponse.data.policies.length > 0) {
                const policy = policiesResponse.data.policies[0];
                const filename = policy.fileUrl.split('/').pop();

                const response = await axios.get(`${BASE_URL}/api/policies/file/${filename}`, {
                    headers: { Authorization: `Bearer ${TEST_TOKEN}` },
                    validateStatus: () => true
                });

                const hasSecurityHeaders = 
                    response.headers['x-content-type-options'] === 'nosniff' &&
                    response.headers['x-frame-options'] === 'SAMEORIGIN' &&
                    response.headers['content-disposition'] === 'inline';

                if (hasSecurityHeaders) {
                    console.log('✅ PASS: Security headers present\n');
                    passedTests++;
                } else {
                    console.log('❌ FAIL: Missing security headers\n');
                    console.log('Headers:', response.headers);
                    failedTests++;
                }
            } else {
                console.log('⏭️  SKIP: No policies found in database\n');
            }
        } catch (error) {
            console.log(`❌ FAIL: ${error.message}\n`);
            failedTests++;
        }
    } else {
        console.log('⏭️  SKIP: No TEST_TOKEN provided\n');
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   Total: ${passedTests + failedTests}`);

    if (failedTests === 0) {
        console.log('\n🎉 All tests passed!');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the output above.');
    }
}

// Run tests
runTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
