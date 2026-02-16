// backend/scripts/test-gridfs-policy-system.js
// Test script for GridFS-based policy system
// Tests: Upload, Retrieve, Stream, Delete

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

// Test configuration
const TEST_CONFIG = {
    adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    testPdfPath: path.join(__dirname, '../public/reports/Attendance Logs - Default All Employees.xlsx') // Will create a test PDF
};

let authToken = null;
let testPolicyId = null;

// Helper: Login and get JWT token
async function login() {
    try {
        console.log('\n🔐 Step 1: Authenticating as admin...');
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: TEST_CONFIG.adminEmail,
            password: TEST_CONFIG.adminPassword
        });
        
        authToken = response.data.token;
        console.log('✅ Authentication successful');
        console.log('Token preview:', authToken.substring(0, 50) + '...');
        return true;
    } catch (error) {
        console.error('❌ Authentication failed:', error.response?.data || error.message);
        return false;
    }
}

// Helper: Create a test PDF file
function createTestPDF() {
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Policy Document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000317 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
410
%%EOF`;
    
    const testPdfPath = path.join(__dirname, 'test-policy.pdf');
    fs.writeFileSync(testPdfPath, pdfContent);
    console.log('✅ Test PDF created:', testPdfPath);
    return testPdfPath;
}

// Test 1: Upload policy using GridFS
async function testUploadPolicy() {
    try {
        console.log('\n📤 Step 2: Uploading policy to GridFS...');
        
        const testPdfPath = createTestPDF();
        const FormData = require('form-data');
        const form = new FormData();
        
        form.append('file', fs.createReadStream(testPdfPath));
        form.append('name', 'Test Policy - GridFS');
        form.append('version', '1.0');
        form.append('effectiveFrom', new Date().toISOString());
        form.append('department', 'IT');
        form.append('status', 'Active');
        
        const response = await axios.post(
            `${API_URL}/policies-gridfs/upload`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );
        
        testPolicyId = response.data.policy._id;
        console.log('✅ Policy uploaded successfully');
        console.log('Policy ID:', testPolicyId);
        console.log('File ID:', response.data.policy.fileId);
        console.log('File Size:', response.data.policy.fileSize, 'bytes');
        
        // Cleanup test PDF
        fs.unlinkSync(testPdfPath);
        
        return true;
    } catch (error) {
        console.error('❌ Upload failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 2: Retrieve policy list
async function testGetPolicies() {
    try {
        console.log('\n📋 Step 3: Retrieving policy list...');
        
        const response = await axios.get(
            `${API_URL}/policies-gridfs`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );
        
        console.log('✅ Retrieved', response.data.policies.length, 'policies');
        const testPolicy = response.data.policies.find(p => p._id === testPolicyId);
        if (testPolicy) {
            console.log('Test policy found:', testPolicy.name);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Retrieval failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 3: Stream policy PDF from GridFS
async function testStreamPolicy() {
    try {
        console.log('\n📥 Step 4: Streaming policy PDF from GridFS...');
        
        const response = await axios.get(
            `${API_URL}/policies-gridfs/${testPolicyId}/file`,
            {
                responseType: 'arraybuffer',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );
        
        console.log('✅ PDF streamed successfully');
        console.log('Content-Type:', response.headers['content-type']);
        console.log('Content-Length:', response.headers['content-length'], 'bytes');
        console.log('Cache-Control:', response.headers['cache-control']);
        
        // Verify PDF signature
        const buffer = Buffer.from(response.data);
        const pdfSignature = buffer.slice(0, 4).toString();
        if (pdfSignature === '%PDF') {
            console.log('✅ Valid PDF signature verified');
        } else {
            console.warn('⚠️ Invalid PDF signature:', pdfSignature);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Streaming failed:', error.response?.data || error.message);
        return false;
    }
}

// Test 4: Test without Authorization header (should fail)
async function testUnauthorizedAccess() {
    try {
        console.log('\n🔒 Step 5: Testing unauthorized access (should fail)...');
        
        await axios.get(`${API_URL}/policies-gridfs/${testPolicyId}/file`);
        
        console.error('❌ Unauthorized access was allowed (security issue!)');
        return false;
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Unauthorized access correctly blocked');
            return true;
        } else {
            console.error('❌ Unexpected error:', error.response?.data || error.message);
            return false;
        }
    }
}

// Test 5: Delete policy
async function testDeletePolicy() {
    try {
        console.log('\n🗑️  Step 6: Deleting test policy...');
        
        const response = await axios.delete(
            `${API_URL}/policies-gridfs/${testPolicyId}`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );
        
        console.log('✅ Policy deleted successfully');
        console.log('Message:', response.data.message);
        
        return true;
    } catch (error) {
        console.error('❌ Deletion failed:', error.response?.data || error.message);
        return false;
    }
}

// Main test runner
async function runTests() {
    console.log('🧪 GridFS Policy System Test Suite');
    console.log('===================================');
    console.log('Base URL:', BASE_URL);
    console.log('Admin Email:', TEST_CONFIG.adminEmail);
    
    const results = {
        login: false,
        upload: false,
        retrieve: false,
        stream: false,
        unauthorized: false,
        delete: false
    };
    
    // Run tests sequentially
    results.login = await login();
    if (!results.login) {
        console.error('\n❌ Test suite aborted: Authentication failed');
        process.exit(1);
    }
    
    results.upload = await testUploadPolicy();
    if (!results.upload) {
        console.error('\n❌ Test suite aborted: Upload failed');
        process.exit(1);
    }
    
    results.retrieve = await testGetPolicies();
    results.stream = await testStreamPolicy();
    results.unauthorized = await testUnauthorizedAccess();
    results.delete = await testDeletePolicy();
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('======================');
    console.log('Login:', results.login ? '✅ PASS' : '❌ FAIL');
    console.log('Upload:', results.upload ? '✅ PASS' : '❌ FAIL');
    console.log('Retrieve:', results.retrieve ? '✅ PASS' : '❌ FAIL');
    console.log('Stream:', results.stream ? '✅ PASS' : '❌ FAIL');
    console.log('Unauthorized:', results.unauthorized ? '✅ PASS' : '❌ FAIL');
    console.log('Delete:', results.delete ? '✅ PASS' : '❌ FAIL');
    
    const allPassed = Object.values(results).every(r => r === true);
    if (allPassed) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('❌ Test suite error:', error);
    process.exit(1);
});
