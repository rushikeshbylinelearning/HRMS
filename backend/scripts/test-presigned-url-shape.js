// backend/scripts/test-presigned-url-shape.js
// Quick test to verify presigned URLs have the correct shape after the fix.
// Run: node scripts/test-presigned-url-shape.js

require('dotenv').config(); // Load .env file
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getR2Client, BUCKET_NAME } = require('../config/r2');

async function testPresignedUrlShape() {
    console.log('\n=== Testing Presigned URL Shape ===\n');

    try {
        const client = getR2Client();
        const bucket = BUCKET_NAME();

        // Simulate what kycController.js does now (no ContentType, no ContentLength)
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: 'kyc/test-employee/aadhaar/test-uuid.pdf',
            // ContentType and ContentLength intentionally omitted
        });

        const presignedUrl = await getSignedUrl(client, command, {
            expiresIn: 300, // 5 minutes
        });

        console.log('Generated presigned URL:\n');
        console.log(presignedUrl);
        console.log('\n');

        // Parse the URL to extract X-Amz-SignedHeaders
        const url = new URL(presignedUrl);
        const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders');
        const algorithm = url.searchParams.get('X-Amz-Algorithm');
        const expires = url.searchParams.get('X-Amz-Expires');

        console.log('=== URL Analysis ===\n');
        console.log(`✓ Endpoint:        ${url.origin}`);
        console.log(`✓ Bucket/Key:      ${url.pathname}`);
        console.log(`✓ Algorithm:       ${algorithm}`);
        console.log(`✓ Expires In:      ${expires} seconds`);
        console.log(`✓ Signed Headers:  ${signedHeaders}\n`);

        // Validate
        const checksumParams = [];
        for (const [key, _] of url.searchParams) {
            if (key.startsWith('x-amz-checksum') || key.startsWith('x-amz-sdk-checksum')) {
                checksumParams.push(key);
            }
        }

        let passed = true;

        if (signedHeaders !== 'host') {
            console.log('❌ FAIL: X-Amz-SignedHeaders should be "host" only');
            console.log(`   Got: "${signedHeaders}"`);
            console.log('   This means ContentType or ContentLength is still in PutObjectCommand\n');
            passed = false;
        } else {
            console.log('✅ PASS: X-Amz-SignedHeaders = "host" (minimal, no CORS preflight triggers)\n');
        }

        if (checksumParams.length > 0) {
            console.log('❌ FAIL: Checksum params found in URL:');
            checksumParams.forEach(p => console.log(`   - ${p}`));
            console.log('   This means requestChecksumCalculation config is not working\n');
            passed = false;
        } else {
            console.log('✅ PASS: No checksum params in URL\n');
        }

        if (url.searchParams.has('Content-Type') || url.searchParams.has('content-type')) {
            console.log('❌ FAIL: content-type found in query params');
            console.log('   This means it was hoisted from headers\n');
            passed = false;
        } else {
            console.log('✅ PASS: No content-type in query params (as expected)\n');
        }

        console.log('=== Summary ===\n');
        if (passed) {
            console.log('✅ ALL CHECKS PASSED — presigned URLs are correctly shaped\n');
            console.log('Next step: Test actual upload from the frontend\n');
        } else {
            console.log('❌ SOME CHECKS FAILED — review the PutObjectCommand in kycController.js\n');
        }

        process.exit(passed ? 0 : 1);
    } catch (err) {
        console.error('❌ ERROR:', err.message);
        console.error('\nFull error:', err);
        process.exit(1);
    }
}

testPresignedUrlShape();
