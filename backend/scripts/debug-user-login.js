// Script to debug user login issues
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const User = require('../models/User');

const debugUserLogin = async (email, passwordToTest) => {
    try {
        console.log('\n=== LOGIN DEBUG TOOL ===');
        console.log('Connecting to MongoDB...');
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Search for user with different email variations
        const normalizeEmail = (email) => email?.trim().toLowerCase() || '';
        const normalizedEmail = normalizeEmail(email);
        
        console.log('Searching for user with email:', email);
        console.log('Normalized email:', normalizedEmail);
        
        // Try all variations
        const user = await User.findOne({
            $or: [
                { email: email },
                { email: normalizedEmail },
                { email: email.toLowerCase() },
                { employeeCode: email }
            ]
        });

        if (!user) {
            console.log('❌ User not found with any variation');
            console.log('\nTrying to find users with similar emails:');
            const similarUsers = await User.find({
                email: new RegExp(email.replace('@', '.*@'), 'i')
            }).select('email employeeCode role isActive');
            
            console.log('Similar users found:', similarUsers.length);
            similarUsers.forEach(u => {
                console.log(`  - Email: ${u.email}, Code: ${u.employeeCode}, Role: ${u.role}, Active: ${u.isActive}`);
            });
            return;
        }

        console.log('\n=== USER FOUND ===');
        console.log('Email (stored):', user.email);
        console.log('Employee Code:', user.employeeCode);
        console.log('Full Name:', user.fullName);
        console.log('Role:', user.role);
        console.log('Is Active:', user.isActive);
        console.log('Auth Method:', user.authMethod);
        console.log('Has Password Hash:', !!user.passwordHash);
        
        if (!user.passwordHash) {
            console.log('\n❌ User has no password hash! This user cannot login with password.');
            console.log('   This might be an SSO-only user or password was not set.');
            return;
        }

        if (!user.isActive) {
            console.log('\n❌ User account is INACTIVE!');
            console.log('   Account Locked:', user.accountLocked || false);
            if (user.accountLocked) {
                console.log('   Locked Reason:', user.lockedReason);
                console.log('   Locked At:', user.lockedAt);
            }
            return;
        }

        // Test password if provided
        if (passwordToTest) {
            console.log('\n=== PASSWORD TEST ===');
            console.log('Testing password...');
            
            const isMatch = await bcrypt.compare(passwordToTest, user.passwordHash);
            
            if (isMatch) {
                console.log('✅ Password matches! Login should work.');
            } else {
                console.log('❌ Password does NOT match!');
                console.log('   The password you provided is incorrect.');
            }
        }

        // Check for any blockers
        console.log('\n=== POTENTIAL BLOCKERS ===');
        const blockers = [];
        
        if (!user.isActive) blockers.push('Account is inactive');
        if (user.accountLocked) blockers.push('Account is locked');
        if (!user.passwordHash) blockers.push('No password hash set');
        if (user.authMethod === 'SSO') blockers.push('User is SSO-only (local login may be disabled)');
        
        if (blockers.length === 0) {
            console.log('✅ No blockers found');
        } else {
            blockers.forEach(b => console.log(`  ⚠️ ${b}`));
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
};

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: node debug-user-login.js <email> [password]');
    console.log('Example: node debug-user-login.js user@example.com mypassword123');
    process.exit(1);
}

const email = args[0];
const password = args[1] || null;

debugUserLogin(email, password);
