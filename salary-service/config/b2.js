'use strict';
// config/b2.js
//
// Backblaze B2 S3-compatible client for the salary-service payroll bucket.
// Pattern mirrors AMS's config/r2.js.
//
// Required env vars (validated at boot by envValidator.js):
//   B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT
// Optional:
//   B2_REGION (default: us-east-005)
//
// IMPORTANT: The B2 application key used here should be scoped ONLY to the
// payroll bucket/prefix in the Backblaze dashboard.  A leaked credential can
// then only access payroll documents, not AMS's KYC/HR documents.

const { S3Client } = require('@aws-sdk/client-s3');

let _client = null;

function getB2Client() {
    if (_client) return _client;

    const keyId    = process.env.B2_KEY_ID;
    const appKey   = process.env.B2_APPLICATION_KEY;
    const endpoint = process.env.B2_ENDPOINT;
    const region   = process.env.B2_REGION || 'us-east-005';

    // These are guaranteed present by envValidator — but throw explicitly
    // rather than silently producing an undefined-credentials client.
    if (!keyId || !appKey) {
        throw new Error('B2_KEY_ID and B2_APPLICATION_KEY must be set');
    }
    if (!endpoint) {
        throw new Error('B2_ENDPOINT is not set (e.g. s3.us-east-005.backblazeb2.com)');
    }

    const endpointUrl = endpoint.startsWith('https://') ? endpoint : `https://${endpoint}`;

    _client = new S3Client({
        region,
        endpoint: endpointUrl,
        credentials: {
            accessKeyId:     keyId,
            secretAccessKey: appKey,
        },
        forcePathStyle: true, // required for B2 S3-compatible API
        // Disable automatic checksum injection — causes SignatureDoesNotMatch on B2 presigned URLs
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
    });

    return _client;
}

function BUCKET_NAME() {
    const name = process.env.B2_BUCKET_NAME;
    if (!name) throw new Error('B2_BUCKET_NAME is not set');
    return name;
}

module.exports = { getB2Client, BUCKET_NAME };
