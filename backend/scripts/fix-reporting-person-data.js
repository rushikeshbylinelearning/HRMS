// backend/scripts/fix-reporting-person-data.js
// Script to fix reportingPerson data in existing User documents
// Run with: node backend/scripts/fix-reporting-person-data.js

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function fixReportingPersonData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-system', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');
        
        // Find all users with reportingPerson as empty string or invalid value
        const users = await User.find({
            $or: [
                { reportingPerson: '' },
                { reportingPerson: { $exists: false } }
            ]
        });
        
        console.log(`Found ${users.length} users with invalid reportingPerson data`);
        
        // Update each user
        let updatedCount = 0;
        for (const user of users) {
            // Set reportingPerson to null for empty strings or undefined
            user.reportingPerson = null;
            await user.save();
            updatedCount++;
            
            if (updatedCount % 10 === 0) {
                console.log(`Updated ${updatedCount} users...`);
            }
        }
        
        console.log(`Successfully updated ${updatedCount} users`);
        
        // Also check for users with reportingPerson that's not a valid ObjectId
        const allUsers = await User.find({});
        let invalidObjectIdCount = 0;
        
        for (const user of allUsers) {
            if (user.reportingPerson && user.reportingPerson.toString() !== '') {
                // Check if it's a valid ObjectId
                if (!mongoose.Types.ObjectId.isValid(user.reportingPerson.toString())) {
                    console.log(`User ${user.employeeCode} (${user.fullName}) has invalid reportingPerson: ${user.reportingPerson}`);
                    user.reportingPerson = null;
                    await user.save();
                    invalidObjectIdCount++;
                }
            }
        }
        
        console.log(`Fixed ${invalidObjectIdCount} users with invalid ObjectId in reportingPerson`);
        
        mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        console.log('Data fix completed successfully!');
        
    } catch (error) {
        console.error('Error fixing reporting person data:', error);
        process.exit(1);
    }
}

// Run the function if this script is executed directly
if (require.main === module) {
    fixReportingPersonData();
}

module.exports = fixReportingPersonData;