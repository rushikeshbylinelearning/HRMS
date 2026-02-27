// Script to fix users with empty string reportingPerson values
// This fixes the CastError: Cast to ObjectId failed for value "" error

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function fixEmptyReportingPerson() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find users with empty string reportingPerson
        const usersWithEmptyReporting = await User.find({
            reportingPerson: { $in: ['', null] }
        });

        console.log(`Found ${usersWithEmptyReporting.length} users with empty/null reportingPerson`);

        if (usersWithEmptyReporting.length === 0) {
            console.log('No users to fix');
            process.exit(0);
        }

        // Update all users with empty string to null
        const result = await User.updateMany(
            { reportingPerson: '' },
            { $set: { reportingPerson: null } }
        );

        console.log(`✅ Fixed ${result.modifiedCount} users`);
        console.log('Users affected:');
        usersWithEmptyReporting.forEach(user => {
            console.log(`  - ${user.fullName} (${user.email}) - reportingPerson: "${user.reportingPerson}"`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixEmptyReportingPerson();
