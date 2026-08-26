// Script to list all users in the database
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const User = require('../models/User');

const listAllUsers = async () => {
    try {
        console.log('\n=== USER LIST ===');
        console.log('Connecting to MongoDB...');
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const users = await User.find({})
            .select('email employeeCode fullName role isActive authMethod accountLocked')
            .sort({ role: 1, fullName: 1 });

        console.log(`Found ${users.length} users:\n`);
        
        // Group by role
        const byRole = {
            'Admin': [],
            'HR': [],
            'Employee': [],
            'Intern': []
        };

        users.forEach(user => {
            const role = user.role || 'Employee';
            if (!byRole[role]) byRole[role] = [];
            byRole[role].push(user);
        });

        // Display by role
        Object.keys(byRole).forEach(role => {
            const roleUsers = byRole[role];
            if (roleUsers.length > 0) {
                console.log(`\n=== ${role.toUpperCase()} (${roleUsers.length}) ===`);
                roleUsers.forEach(user => {
                    const status = user.isActive ? '✅' : '❌';
                    const locked = user.accountLocked ? '🔒' : '';
                    const authMethod = user.authMethod === 'SSO' ? '(SSO)' : '';
                    console.log(`${status}${locked} ${user.email.padEnd(35)} | ${user.employeeCode.padEnd(10)} | ${user.fullName} ${authMethod}`);
                });
            }
        });

        console.log('\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
    } finally {
        await mongoose.connection.close();
        console.log('✅ Database connection closed\n');
    }
};

listAllUsers();
