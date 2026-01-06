// backend/scripts/remove-avatar-url.js
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function removeAvatarUrl() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-system';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // The avatar filename to search for
        const avatarFilename = 'avatar-687e227897b3fb2f8e690e99-1766579012692.jpg';
        
        // Find all users with this avatar URL (could be full URL or just the filename)
        const usersWithAvatar = await User.find({
            profileImageUrl: { $regex: avatarFilename, $options: 'i' }
        });

        console.log(`\n📊 Found ${usersWithAvatar.length} user(s) with this avatar URL:\n`);

        if (usersWithAvatar.length === 0) {
            console.log('✅ No users found with this avatar URL. Database is clean.');
        } else {
            // Display affected users
            usersWithAvatar.forEach((user, index) => {
                console.log(`${index + 1}. ${user.fullName} (${user.employeeCode})`);
                console.log(`   Email: ${user.email}`);
                console.log(`   Current Avatar URL: ${user.profileImageUrl || '(empty)'}`);
            });

            // Update all users to clear the profileImageUrl
            const result = await User.updateMany(
                { profileImageUrl: { $regex: avatarFilename, $options: 'i' } },
                { $set: { profileImageUrl: '' } }
            );

            console.log(`\n✅ Successfully cleared avatar URL for ${result.modifiedCount} user(s).`);

            // Verify the update
            const remainingUsers = await User.countDocuments({
                profileImageUrl: { $regex: avatarFilename, $options: 'i' }
            });
            
            if (remainingUsers === 0) {
                console.log('✅ Verification: All avatar URLs have been removed from the database.');
            } else {
                console.log(`⚠️  Warning: ${remainingUsers} user(s) still have this avatar URL.`);
            }
        }

    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run script if called directly
if (require.main === module) {
    removeAvatarUrl();
}

module.exports = removeAvatarUrl;









