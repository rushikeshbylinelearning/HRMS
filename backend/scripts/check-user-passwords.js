const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../models/User');

async function checkUserPasswords() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');
        
        // Check all non-admin users
        const users = await User.find({ role: { $ne: 'Admin' } })
            .select('email employeeCode isActive passwordHash authMethod')
            .limit(10)
            .lean();
        
        console.log('\n=== USER PASSWORD STATUS ===\n');
        users.forEach(user => {
            console.log({
                email: user.email,
                employeeCode: user.employeeCode,
                isActive: user.isActive,
                hasPassword: !!user.passwordHash,
                passwordHashLength: user.passwordHash ? user.passwordHash.length : 0,
                authMethod: user.authMethod || 'local'
            });
        });
        
        // Count users with and without passwords
        const totalUsers = await User.countDocuments({ role: { $ne: 'Admin' } });
        const usersWithPasswords = await User.countDocuments({ 
            role: { $ne: 'Admin' },
            passwordHash: { $exists: true, $ne: null, $ne: '' }
        });
        const activeUsers = await User.countDocuments({ 
            role: { $ne: 'Admin' },
            isActive: true
        });
        
        console.log('\n=== SUMMARY ===');
        console.log('Total users:', totalUsers);
        console.log('Active users:', activeUsers);
        console.log('Users with passwords:', usersWithPasswords);
        console.log('Users without passwords:', totalUsers - usersWithPasswords);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkUserPasswords();
