'use strict';
// scripts/generateSecrets.js
//
// Prints freshly generated secrets for .env.
// Run locally, copy values into your .env, then DISCARD this output.
// NEVER commit the printed values.
//
// Usage: node scripts/generateSecrets.js

const crypto = require('crypto');

console.log('\n# salary-service — generated secrets');
console.log('# Copy each value into your .env file.');
console.log('# Run this script once per environment.\n');

console.log(`JWT_SECRET=${crypto.randomBytes(64).toString('hex')}`);
console.log(`ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}`);
console.log(`SERVICE_TOKEN=${crypto.randomBytes(48).toString('hex')}`);
console.log('\n# Paste SERVICE_TOKEN into AMS .env as SERVICE_TOKEN too.');
console.log('# NEVER commit these values to git.\n');
