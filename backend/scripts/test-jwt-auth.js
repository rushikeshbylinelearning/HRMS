/**
 * Test Script: JWT-Only Authentication System
 * 
 * This script validates the JWT-only authentication implementation:
 * 1. Login sets secure cookies
 * 2. Authenticated requests work with cookies
 * 3. PDF access requires authentication
 * 4. No redirects (JSON responses only)
 * 
 * Usage: node backend/scripts/test-jwt-auth.js
 */

const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3011';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

// Create axios instance with cookie jar
const cookieJar = new tough.CookieJar();
const client = wrapper(axios.create({
    baseURL: BASE_URL,
    jar: cookieJar,
    withCredentials: true,
    validateStatus: () => true // Don't throw on any status
}));

async function runTests() {
    console.log('🧪 Starting JWT-Only Authentication Tests\n');
    console.log(`Base URL: ${BASE_URL}\n`);

    let passedTests = 0;
    let failedTests = 0;
    let token = null;

    // Test 1: Login should set cookies
    console.log('Test 1: Login should set secure cookies');
    try {
        const response = await client.post('/api/auth/login', {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        if (response.status === 200 && response.data.token) {
            token = response.data.token;
            
            // Check if cookies were set
            const cookies = cookieJar.getCookiesSync(BASE_URL);
            const hasTokenCookie = cookies.some(c => c.key === 'token');
            const hasAmsTokenCookie = cookies.some(c => c.key === 'ams_token');

            if (hasTokenCookie && hasAmsTokenCookie) {
                console.log('✅ PASS: Login successful, cookies set');
                console.log(`   - token cookie: ${hasTokenCookie ? 'Yes' : 'No'}`);
                console.log(`   - ams_token cookie: ${hasAmsTokenCookie ? 'Yes' : 'No'}`);
                passedTests++;
            } else {
                console.log('❌ FAIL: Cookies not set properly');
                console.log(`   - token cookie: ${hasTokenCookie ? 'Yes' : 'No'}`);
                console.log(`   - ams_token cookie: ${hasAmsTokenCookie ? 'Yes' : 'No'}`);
                failedTests++;
            }
        } else {
            console.log(`❌ FAIL: Login failed (${response.status})`);
            console.log(`   Response: ${JSON.stringify(response.data)}`);
            failedTests++;
        }
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failedTests++;
    }
    console.log('');

    // Test 2: Authenticated request with cookies
    console.log('Test 2: Authenticated request should work with cookies');
    try {
        const response = await client.get('/api/policies');

        if (response.status === 200) {
            console.log('✅ PASS: Authenticated request successful');
            console.log(`   - Policies returned: ${response.data.policies?.length || 0}`);
            passedTests++;
        } else {
            console.log(`❌ FAIL: Expected 200, got ${response.status}`);
            console.log(`   Response: ${JSON.stringify(response.data)}`);
            failedTests++;
        }
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failedTests++;
    }
    console.log('');

    // Test 3: Unauthenticated request should return 401 JSON
    console.log('Test 3: Unauthenticated request should return 401 JSON (no redirect)');
    try {
        const unauthClient = axios.create({
            baseURL: BASE_URL,
            validateStatus: () => true
        });

        const response = await unauthClient.get('/api/policies');

        if (response.status === 401 && response.data.success === false) {
            console.log('✅ PASS: Returns 401 JSON (no redirect)');
            console.log(`   - Message: ${response.data.message}`);
            console.log(`   - Code: ${response.data.code}`);
            passedTests++;
        } else if (response.status === 302 || response.status === 301) {
            console.log(`❌ FAIL: Returns redirect (${response.status}) instead of JSON`);
            failedTests++;
        } else {
            console.log(`❌ FAIL: Expected 401 JSON, got ${response.status}`);
            console.log(`   Response: ${JSON.stringify(response.data)}`);
            failedTests++;
        }
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failedTests++;
    }
    console.log('');

    // Test 4: PDF access with cookies
    console.log('Test 4: PDF access should work with cookies');
    try {
        // First get a policy to get filename
        const policiesResponse = await client.get('/api/policies');
        
        if (policiesResponse.data.policies && policiesResponse.data.policies.length > 0) {
            const policy = policiesResponse.data.policies[0];
            const filename = policy.fileUrl.split('/').pop();

            const response = await client.get(`/api/policies/file/${filename}`, {
                responseType: 'arraybuffer'
            });

            if (response.status === 200 && response.headers['content-type'] === 'application/pdf') {
                console.log('✅ PASS: PDF access successful with cookies');
                console.log(`   - Content-Type: ${response.headers['content-type']}`);
                console.log(`   - Content-Length: ${response.headers['content-length']} bytes`);
                passedTests++;
            } else {
                console.log(`❌ FAIL: Expected 200 + PDF, got ${response.status}`);
                failedTests++;
            }
        } else {
            console.log('⏭️  SKIP: No policies found in database');
        }
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failedTests++;
    }
    console.log('');

    // Test 5: PDF access without auth should return 401 JSON
    console.log('Test 5: PDF access without auth should return 401 JSON');
    try {
        const unauthClient = axios.create({
            baseURL: BASE_URL,
            validateStatus: () => true
        });

        const response = await unauthClient.get('/api/policies/file/test.pdf');

        if (response.status === 401 && response.data.success === false) {
            console.log('✅ PASS: Returns 401 JSON (no redirect)');
            console.log(`   - Message: ${response.data.message}`);
            passedTests++;
        } else if (response.status === 302 || response.status === 301) {
            console.log(`❌ FAIL: Returns redirect (${response.status}) instead of JSON`);
            failedTests++;
        } else {
            console.log(`❌ FAIL: Expected 401 JSON, got ${response.status}`);
            failedTests++;
        }
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failedTests++;
    }
    console.log('');

    // Test 6: Cookie security attributes
    console.log('Test 6: Cookies should have proper security attributes');
    try {
        const cookies = cookieJar.getCookiesSync(BASE_URL);
        const tokenCookie = cookies.find(c => c.key === 'token');

        if (tokenCookie) {
            const isHttpOnly = tokenCookie.httpOnly;
            const hasPath = tokenCookie.path === '/';
            const hasMaxAge = tokenCookie.maxAge > 0;

            if (isHttpOnly && hasPath && hasMaxAge) {
                console.log('✅ PASS: Cookie security attributes correct');
                console.log(`   - HttpOnly: ${isHttpOnly}`);
                console.log(`   - Path: ${tokenCookie.path}`);
                console.log(`   - MaxAge: ${tokenCookie.maxAge}s`);
                passedTests++;
            } else {
                console.log('❌ FAIL: Cookie security attributes incorrect');
                console.log(`   - HttpOnly: ${isHttpOnly} (should be true)`);
                console.log(`   - Path: ${tokenCookie.path} (should be /)`);
                console.log(`   - MaxAge: ${tokenCookie.maxAge} (should be > 0)`);
                failedTests++;
            }
        } else {
            console.log('❌ FAIL: Token cookie not found');
            failedTests++;
        }
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failedTests++;
    }
    console.log('');

    // Summary
    console.log('📊 Test Summary:');
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   Total: ${passedTests + failedTests}`);

    if (failedTests === 0) {
        console.log('\n🎉 All tests passed!');
        console.log('\n✅ JWT-only authentication is working correctly:');
        console.log('   - Secure cookies are set on login');
        console.log('   - Authenticated requests work with cookies');
        console.log('   - Unauthenticated requests return 401 JSON (no redirects)');
        console.log('   - PDF access requires authentication');
        console.log('   - Cookie security attributes are correct');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the output above.');
    }
}

// Run tests
runTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
