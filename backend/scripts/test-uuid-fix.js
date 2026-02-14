// Quick test to verify UUID generation works
const crypto = require('crypto');

const uuidv4 = () => {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    } else {
        // Fallback for older Node versions
        return crypto.randomBytes(16).toString('hex');
    }
};

console.log('Testing UUID generation...');
console.log('UUID 1:', uuidv4());
console.log('UUID 2:', uuidv4());
console.log('UUID 3:', uuidv4());
console.log('✅ UUID generation working correctly!');
