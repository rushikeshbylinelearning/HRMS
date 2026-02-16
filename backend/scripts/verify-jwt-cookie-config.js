#!/usr/bin/env node
/**
 * JWT Cookie Configuration Verification Script
 * 
 * This script verifies that JWT cookies are properly configured
 * for cross-subdomain authentication in production.
 * 
 * Run: node backend/scripts/verify-jwt-cookie-config.js
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'https://attendance.legatolxp.online';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@legatolxp.online';
const TEST_PASSWORD = process.env.TEST_PASSWORD;

console.log('🔍 JWT Cookie Configuration Verification');
console.log('=========================================\n');

async function verifyCookieConfig() {
    try {
        // Test 1: Login and capture cookies
        console.log('Test 1: Login and capture cookies');
        console.log('----------------------------------');
        
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        }, {
            withCredentials: true,
            validateStatus: () => true
        });

        if (loginResponse.status !== 200) {
            console.error('❌ Login failed:', loginResponse.status, loginResponse.data);
            return false;
        }

        console.log('✅ Login successful');
        
        // Extract Set-Cookie headers
        const setCookieHeaders = loginResponse.headers['set-cookie'];
        if (!setCookieHeaders || setCookieHeaders.length === 0) {
            console.error('❌ No Set-Cookie headers found in response');
            return false;
        }

        console.log('\n📋 Set-Cookie Headers:');
        setCookieHeaders.forEach(cookie => {
            console.log(`   ${cookie}`);
        });

        // Parse cookie attributes
        const tokenCookie = setCookieHeaders.find(c => c.startsWith('token='));
        const amsTokenCookie = setCookieHeaders.find(c => c.startsWith('ams_token='));

        if (!tokenCookie && !amsTokenCookie) {
            console.error('❌ Neither token nor ams_token cookie found');
            return false;
        }

        console.log('\n✅ Cookies found:', {
            token: !!tokenCookie,
            ams_token: !!amsTokenCookie
        });

        // Verify cookie attributes
        console.log('\n🔐 Cookie Attributes Verification:');
        const cookieToCheck = tokenCookie || amsTokenCookie;
        
        const checks = {
            'HttpOnly': cookieToCheck.includes('HttpOnly'),
            'Secure': cookieToCheck.includes('Secure'),
            'SameSite=None': cookieToCheck.includes('SameSite=None') || cookieToCheck.includes('SameSite=none'),
            'Domain=.legatolxp.online': cookieToCheck.includes('Domain=.legatolxp.online'),
            'Path=/': cookieToCheck.includes('Path=/')
        };

        let allPassed = true;
        for (const [check, passed] of Object.entries(checks)) {
            console.log(`   ${passed ? '✅' : '❌'} ${check}`);
            if (!passed) allPassed = false;
        }

        if (!allPassed) {
            console.error('\n❌ Some cookie attributes are missing or incorrect');
            console.log('\n📝 Expected configuration:');
            console.log('   - HttpOnly: true (prevents XSS)');
            console.log('   - Secure: true (HTTPS only)');
            console.log('   - SameSite: None (cross-origin support)');
            console.log('   - Domain: .legatolxp.online (subdomain sharing)');
            console.log('   - Path: / (all routes)');
            return false;
        }

        console.log('\n✅ All cookie attributes are correct!');

        // Test 2: Verify cookie is sent with subsequent requests
        console.log('\n\nTest 2: Verify cookie is sent with API requests');
        console.log('-----------------------------------------------');

        // Extract token value for Authorization header test
        const tokenMatch = cookieToCheck.match(/^(?:token|ams_token)=([^;]+)/);
        const tokenValue = tokenMatch ? tokenMatch[1] : null;

        if (!tokenValue) {
            console.error('❌ Could not extract token value');
            return false;
        }

        // Test with cookie (simulated - axios doesn't auto-send cookies cross-domain)
        console.log('   Testing with Authorization header (cookie simulation)...');
        const meResponse = await axios.get(`${BASE_URL}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${tokenValue}`
            },
            validateStatus: () => true
        });

        if (meResponse.status === 200) {
            console.log('✅ Authentication successful with token');
            console.log(`   User: ${meResponse.data.email}`);
        } else {
            console.error('❌ Authentication failed:', meResponse.status, meResponse.data);
            return false;
        }

        // Test 3: Check if policies endpoint is accessible
        console.log('\n\nTest 3: Verify PDF route authentication');
        console.log('----------------------------------------');

        const policiesResponse = await axios.get(`${BASE_URL}/api/policies`, {
            headers: {
                'Authorization': `Bearer ${tokenValue}`
            },
            validateStatus: () => true
        });

        if (policiesResponse.status === 200) {
            console.log('✅ Policies endpoint accessible');
            const policies = policiesResponse.data.policies || [];
            console.log(`   Found ${policies.length} policies`);

            if (policies.length > 0) {
                // Test PDF file access
                const firstPolicy = policies[0];
                const filename = firstPolicy.fileUrl.split('/').pop();
                
                console.log(`\n   Testing PDF file access: ${filename}`);
                const pdfResponse = await axios.get(`${BASE_URL}/api/policies/file/${filename}`, {
                    headers: {
                        'Authorization': `Bearer ${tokenValue}`
                    },
                    responseType: 'arraybuffer',
                    validateStatus: () => true
                });

                if (pdfResponse.status === 200) {
                    console.log('   ✅ PDF file accessible with authentication');
                    console.log(`   ✅ Content-Type: ${pdfResponse.headers['content-type']}`);
                    console.log(`   ✅ Content-Length: ${pdfResponse.headers['content-length']} bytes`);
                } else {
                    console.error(`   ❌ PDF access failed: ${pdfResponse.status}`);
                    return false;
                }
            }
        } else {
            console.error('❌ Policies endpoint failed:', policiesResponse.status);
            return false;
        }

        console.log('\n\n🎉 All tests passed!');
        console.log('===================\n');
        console.log('✅ JWT cookies are properly configured');
        console.log('✅ Authentication is working correctly');
        console.log('✅ PDF files are accessible with authentication');
        console.log('\n📝 Next steps:');
        console.log('   1. Test in browser with actual login');
        console.log('   2. Verify cookies in DevTools → Application → Cookies');
        console.log('   3. Test PDF access in browser');
        console.log('   4. Remove debug logging from policies.js after verification');

        return true;

    } catch (error) {
        console.error('\n❌ Verification failed with error:');
        console.error(error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return false;
    }
}

// Run verification
if (!TEST_PASSWORD) {
    console.error('❌ TEST_PASSWORD environment variable is required');
    console.log('\nUsage:');
    console.log('  TEST_PASSWORD=your_password node backend/scripts/verify-jwt-cookie-config.js');
    console.log('\nOr set in .env file:');
    console.log('  TEST_EMAIL=admin@legatolxp.online');
    console.log('  TEST_PASSWORD=your_password');
    process.exit(1);
}

verifyCookieConfig()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
