// backend/scripts/migrate-avatars-to-gridfs.js
// OPTIONAL MIGRATION SCRIPT
// Migrates existing filesystem avatars to GridFS
// Run this script ONCE after deploying the new avatar system

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

// Configuration
const AVATARS_DIR = path.join(__dirname, '../uploads/avatars');
const DRY_RUN = process.argv.includes('--dry-run'); // Test mode, no actual changes

/**
 * Process and upload image to GridFS
 */
async function uploadToGridFS(buffer, userId, originalFilename) {
    try {
        // Process image with Sharp (same as middleware)
        const processedBuffer = await sharp(buffer)
            .resize(256, 256, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .withMetadata(false) // Strip EXIF
            .webp({ quality: 80 })
            .toBuffer();

        const db = mongoose.connection.db;
        const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'avatars' });

        // Generate filename
        const filename = `avatar-${userId}-${Date.now()}.webp`;

        // Upload to GridFS
        const uploadStream = bucket.openUploadStream(filename, {
            contentType: 'image/webp',
            metadata: {
                userId: userId,
                uploadedAt: new Date(),
                migratedFrom: originalFilename,
                originalSize: buffer.length,
                processedSize: processedBuffer.length
            }
        });

        return new Promise((resolve, reject) => {
            uploadStream.on('finish', () => {
                resolve({
                    fileId: uploadStream.id,
                    filename: filename,
                    originalSize: buffer.length,
                    processedSize: processedBuffer.length
                });
            });

            uploadStream.on('error', (error) => {
                reject(error);
            });

            uploadStream.end(processedBuffer);
        });

    } catch (error) {
        throw new Error(`Failed to process image: ${error.message}`);
    }
}

/**
 * Extract userId from avatar filename
 * Format: avatar-{userId}-{timestamp}.ext
 */
function extractUserIdFromFilename(filename) {
    const match = filename.match(/^avatar-([a-f0-9]{24})-\d+\./i);
    return match ? match[1] : null;
}

/**
 * Main migration function
 */
async function migrateAvatars() {
    console.log('🚀 Avatar Migration to GridFS');
    console.log('================================\n');

    if (DRY_RUN) {
        console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    try {
        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system');
        console.log('✅ Connected to MongoDB\n');

        // Check if avatars directory exists
        if (!fs.existsSync(AVATARS_DIR)) {
            console.log('❌ Avatars directory not found:', AVATARS_DIR);
            console.log('   No migration needed.');
            process.exit(0);
        }

        // Get all avatar files
        const files = fs.readdirSync(AVATARS_DIR).filter(file => {
            return /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
        });

        console.log(`📁 Found ${files.length} avatar files\n`);

        if (files.length === 0) {
            console.log('   No avatars to migrate.');
            process.exit(0);
        }

        // Statistics
        let migrated = 0;
        let skipped = 0;
        let failed = 0;
        const errors = [];

        // Process each file
        for (const filename of files) {
            const filePath = path.join(AVATARS_DIR, filename);
            const userId = extractUserIdFromFilename(filename);

            console.log(`\n📄 Processing: ${filename}`);

            // Skip if can't extract userId
            if (!userId) {
                console.log('   ⚠️  Skipped: Cannot extract userId from filename');
                skipped++;
                continue;
            }

            try {
                // Find user
                const user = await User.findById(userId);
                if (!user) {
                    console.log(`   ⚠️  Skipped: User not found (${userId})`);
                    skipped++;
                    continue;
                }

                // Check if user already has GridFS avatar
                if (user.profileImageUrl && user.profileImageUrl.includes('/api/users/avatar/')) {
                    console.log('   ⚠️  Skipped: User already has GridFS avatar');
                    skipped++;
                    continue;
                }

                // Read file
                const buffer = fs.readFileSync(filePath);
                console.log(`   📊 Original size: ${(buffer.length / 1024).toFixed(2)} KB`);

                if (DRY_RUN) {
                    console.log('   🔍 DRY RUN: Would migrate this file');
                    migrated++;
                    continue;
                }

                // Upload to GridFS
                const result = await uploadToGridFS(buffer, userId, filename);
                console.log(`   ✅ Uploaded to GridFS: ${result.fileId}`);
                console.log(`   📊 Processed size: ${(result.processedSize / 1024).toFixed(2)} KB`);
                console.log(`   📉 Reduction: ${((1 - result.processedSize / result.originalSize) * 100).toFixed(1)}%`);

                // Update user record
                user.profileImageUrl = `/api/users/avatar/${result.fileId}`;
                await user.save();
                console.log(`   💾 Updated user record: ${user.fullName}`);

                migrated++;

            } catch (error) {
                console.error(`   ❌ Failed: ${error.message}`);
                errors.push({ filename, error: error.message });
                failed++;
            }
        }

        // Summary
        console.log('\n\n================================');
        console.log('📊 Migration Summary');
        console.log('================================');
        console.log(`✅ Migrated: ${migrated}`);
        console.log(`⚠️  Skipped:  ${skipped}`);
        console.log(`❌ Failed:   ${failed}`);
        console.log(`📁 Total:    ${files.length}`);

        if (errors.length > 0) {
            console.log('\n❌ Errors:');
            errors.forEach(({ filename, error }) => {
                console.log(`   - ${filename}: ${error}`);
            });
        }

        if (!DRY_RUN && migrated > 0) {
            console.log('\n💡 Next Steps:');
            console.log('   1. Verify avatars are displaying correctly');
            console.log('   2. Backup the old avatars directory');
            console.log('   3. Remove old avatars: rm -rf backend/uploads/avatars/*');
            console.log('   4. Update .gitignore to exclude uploads/avatars');
        }

        if (DRY_RUN) {
            console.log('\n💡 To perform actual migration, run:');
            console.log('   node backend/scripts/migrate-avatars-to-gridfs.js');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run migration
if (require.main === module) {
    migrateAvatars()
        .then(() => {
            console.log('\n✅ Migration complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration error:', error);
            process.exit(1);
        });
}

module.exports = { migrateAvatars };
