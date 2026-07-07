// backend/scripts/fix-avatar-urls.js
// FIX AVATAR URLs: Convert filesystem URLs to GridFS format
// This script updates user profileImageUrl from old filesystem format to GridFS format
// Run after deploying the GridFS router fix

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Check if a GridFS file exists by searching for user's avatar
 */
async function findUserAvatarInGridFS(userId) {
    try {
        const db = mongoose.connection.db;
        const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'avatars' });
        
        // Search for files with this userId in metadata
        const files = await bucket.find({ 
            'metadata.userId': userId 
        }).sort({ uploadDate: -1 }).limit(1).toArray();
        
        if (files.length > 0) {
            return files[0]._id;
        }
        
        return null;
    } catch (error) {
        console.error(`Error searching GridFS for user ${userId}:`, error.message);
        return null;
    }
}

/**
 * Main fix function
 */
async function fixAvatarUrls() {
    console.log('🔧 Avatar URL Fix Script');
    console.log('================================\n');
    
    if (DRY_RUN) {
        console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }
    
    try {
        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Find all users with filesystem URLs
        const filesystemPatterns = [
            /^https?:\/\/.*\/avatars\//,  // http://domain/avatars/...
            /^\/avatars\//,                // /avatars/...
        ];
        
        const users = await User.find({
            profileImageUrl: { $exists: true, $ne: '' }
        }).select('_id fullName email profileImageUrl');
        
        console.log(`📊 Found ${users.length} users with profileImageUrl set\n`);
        
        // Filter users with filesystem URLs
        const usersWithFilesystemUrls = users.filter(user => {
            return filesystemPatterns.some(pattern => pattern.test(user.profileImageUrl));
        });
        
        const usersWithGridFSUrls = users.filter(user => {
            return user.profileImageUrl.includes('/api/users/avatar/');
        });
        
        console.log(`✅ Users with GridFS URLs: ${usersWithGridFSUrls.length}`);
        console.log(`⚠️  Users with Filesystem URLs: ${usersWithFilesystemUrls.length}\n`);
        
        if (usersWithFilesystemUrls.length === 0) {
            console.log('✅ All users already have GridFS URLs or no avatar!');
            console.log('   No migration needed.');
            return;
        }
        
        // Statistics
        let fixed = 0;
        let notFound = 0;
        let cleared = 0;
        const errors = [];
        
        // Process each user
        for (const user of usersWithFilesystemUrls) {
            console.log(`\n👤 ${user.fullName} (${user.email})`);
            console.log(`   Current URL: ${user.profileImageUrl}`);
            
            try {
                // Try to find avatar in GridFS
                const gridfsId = await findUserAvatarInGridFS(user._id.toString());
                
                if (gridfsId) {
                    const newUrl = `/api/users/avatar/${gridfsId}`;
                    console.log(`   ✅ Found in GridFS: ${gridfsId}`);
                    console.log(`   📝 New URL: ${newUrl}`);
                    
                    if (!DRY_RUN) {
                        user.profileImageUrl = newUrl;
                        await user.save();
                        console.log(`   💾 Updated!`);
                    } else {
                        console.log(`   🔍 DRY RUN: Would update to ${newUrl}`);
                    }
                    
                    fixed++;
                } else {
                    console.log(`   ⚠️  Not found in GridFS`);
                    console.log(`   💡 Options:`);
                    console.log(`      1. User can re-upload avatar`);
                    console.log(`      2. Clear URL to show initials`);
                    console.log(`      3. Run migrate-avatars-to-gridfs.js if files exist`);
                    
                    // Option: Clear the URL so user sees initials instead of broken image
                    if (!DRY_RUN) {
                        user.profileImageUrl = '';
                        await user.save();
                        console.log(`   🧹 Cleared URL (will show initials)`);
                        cleared++;
                    } else {
                        console.log(`   🔍 DRY RUN: Would clear URL`);
                        cleared++;
                    }
                    
                    notFound++;
                }
                
            } catch (error) {
                console.error(`   ❌ Error: ${error.message}`);
                errors.push({ 
                    user: user.fullName, 
                    email: user.email,
                    error: error.message 
                });
            }
        }
        
        // Summary
        console.log('\n\n================================');
        console.log('📊 Fix Summary');
        console.log('================================');
        console.log(`✅ Fixed (found in GridFS): ${fixed}`);
        console.log(`🧹 Cleared (not found):     ${cleared}`);
        console.log(`⚠️  Not found in GridFS:    ${notFound}`);
        console.log(`❌ Errors:                  ${errors.length}`);
        console.log(`📁 Total processed:         ${usersWithFilesystemUrls.length}`);
        
        if (errors.length > 0) {
            console.log('\n❌ Errors:');
            errors.forEach(({ user, email, error }) => {
                console.log(`   - ${user} (${email}): ${error}`);
            });
        }
        
        if (!DRY_RUN && (fixed > 0 || cleared > 0)) {
            console.log('\n💡 Next Steps:');
            console.log('   1. Verify avatars are displaying correctly');
            console.log('   2. Users with cleared URLs can re-upload avatars');
            console.log('   3. Test upload flow with new GridFS system');
        }
        
        if (DRY_RUN) {
            console.log('\n💡 To perform actual fix, run:');
            console.log('   node backend/scripts/fix-avatar-urls.js');
        }
        
        console.log('\n✅ Current Status:');
        console.log(`   - GridFS URLs: ${usersWithGridFSUrls.length + fixed}`);
        console.log(`   - Filesystem URLs: ${usersWithFilesystemUrls.length - fixed - cleared}`);
        console.log(`   - No avatar: ${cleared}`);
        
    } catch (error) {
        console.error('\n❌ Fix failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run fix
if (require.main === module) {
    fixAvatarUrls()
        .then(() => {
            console.log('\n✅ Fix complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Fix error:', error);
            process.exit(1);
        });
}

module.exports = { fixAvatarUrls };
