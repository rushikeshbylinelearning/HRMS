'use strict';
// scripts/createAdminUser.js
//
// One-shot script to create the first Admin user in salary-service.
// Run ONCE on first deploy, then delete or disable the invocation.
//
// Usage:
//   node scripts/createAdminUser.js --email admin@example.com --password "S3cur3P@ss!"
//
// Requires .env to be present (MONGODB_URI, JWT_SECRET, ENCRYPTION_KEY, etc.)

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { validateAndExit } = require('../utils/envValidator');
validateAndExit();

const mongoose = require('mongoose');
const User     = require('../models/User');

async function main() {
    const args = process.argv.slice(2);
    const get  = (flag) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : null;
    };

    const email    = get('--email');
    const password = get('--password');

    if (!email || !password) {
        console.error('Usage: node scripts/createAdminUser.js --email <email> --password <password>');
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('Password must be at least 8 characters');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 15_000,
    });
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
        console.error(`❌ User ${email} already exists (role: ${existing.role})`);
        await mongoose.disconnect();
        process.exit(1);
    }

    const user = new User({
        email:    email.toLowerCase().trim(),
        role:     'Admin',
        fullName: 'System Admin',
        isActive: true,
    });
    await user.setPassword(password);
    await user.save();

    console.log(`✅ Admin user created: ${user.email} (id: ${user._id})`);
    console.log('   Delete or disable this script after first use.');
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
