const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../models/User');

async function testLogin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database\n');
        
        // Get a sample active user with password
        const user = await User.findOne({ 
            isActive: true,
            role: { $ne: 'Admin' },
            passwordHash: { $exists: true, $ne: null, $ne: '' }
        }).lean();
        
        if (!user) {
            console.log('No active users found');
            process.exit(0);
        }
        
        console.log('=== TEST USER ===');
        console.log('Email:', user.email);
        console.log('Employee Code:', user.employeeCode);
        console.log('Auth Method:', user.authMethod || 'local');
        console.log('Is Active:', user.isActive);
        console.log('Has Password Hash:', !!user.passwordHash);
        console.log('Password Hash Length:', user.passwordHash ? user.passwordHash.length : 0);
        console.log('Password Hash Preview:', user.passwordHash ? user.passwordHash.substring(0, 20) + '...' : 'N/A');
        
        // Try to test a password comparison
        // Note: We can't know the actual password, but we can check if bcrypt.compare works
        const testPassword = 'test123';
        const isMatch = await bcrypt.compare(testPassword, user.passwordHash);
        console.log('\n=== PASSWORD TEST ===');
        console.log('Test Password:', testPassword);
        console.log('Match Result:', isMatch);
        
        // Check if the hash looks valid (bcrypt hashes start with $2b$ or $2a$)
        const hashFormat = user.passwordHash.substring(0, 4);
        console.log('Hash Format:', hashFormat);
        console.log('Is Valid Bcrypt Hash:', hashFormat.startsWith('$2'));
        
        // Additional checks
        console.log('\n=== ADDITIONAL INFO ===');
        console.log('Account Locked:', user.accountLocked || false);
        if (user.accountLocked) {
            console.log('Locked Reason:', user.lockedReason);
            console.log('Locked At:', user.lockedAt);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testLogin();
