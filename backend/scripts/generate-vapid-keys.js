/**
 * Generate VAPID key pair for Web Push.
 * Add the output to backend/.env as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
 */
const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

console.log('Add these to backend/.env:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:your-admin@yourdomain.com');
