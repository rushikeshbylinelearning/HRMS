// backend/scripts/migrate-cif-attachments-to-gridfs.js
// Migration script: Move CIF attachments from filesystem to GridFS

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const CIFAttachment = require('../modules/cif/cifAttachment.model');

// GridFS bucket
let bucket;

function getBucket() {
    if (!bucket) {
        bucket = new mongoose.mongo.GridFSBucket(
            mongoose.connection.db,
            { bucketName: 'cifAttachments' }
        );
    }
    return bucket;
}

async function migrateCIFAttachments() {
    try {
        console.log('🔄 Starting CIF attachments migration to GridFS...\n');

        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Get all CIF attachments
        const attachments = await CIFAttachment.find({});
        console.log(`📊 Found ${attachments.length} CIF attachments to migrate\n`);

        if (attachments.length === 0) {
            console.log('✅ No attachments to migrate');
            return;
        }

        const uploadDir = path.join(__dirname, '../uploads/cif-attachments');
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const attachment of attachments) {
            try {
                // Skip if already has fileId (already migrated)
                if (attachment.fileId) {
                    console.log(`⏭️  Skipping ${attachment.originalName} - already migrated`);
                    skipCount++;
                    continue;
                }

                // Check if filePath exists (old schema)
                if (!attachment.filePath) {
                    console.log(`⚠️  Skipping ${attachment.originalName} - no filePath`);
                    skipCount++;
                    continue;
                }

                // Build file path
                const filepath = path.join(uploadDir, attachment.fileName);

                // Check if file exists
                if (!fs.existsSync(filepath)) {
                    console.log(`❌ File not found: ${filepath}`);
                    errorCount++;
                    continue;
                }

                // Read file
                const fileBuffer = fs.readFileSync(filepath);
                console.log(`📤 Uploading ${attachment.originalName} (${fileBuffer.length} bytes)...`);

                // Upload to GridFS
                const bucket = getBucket();
                const uploadStream = bucket.openUploadStream(attachment.fileName, {
                    contentType: attachment.fileType,
                    metadata: {
                        originalName: attachment.originalName,
                        uploadedBy: attachment.uploadedBy,
                        uploadedAt: attachment.createdAt,
                        fileSize: fileBuffer.length,
                        migratedFrom: 'filesystem',
                        migratedAt: new Date()
                    }
                });

                await new Promise((resolve, reject) => {
                    uploadStream.on('finish', resolve);
                    uploadStream.on('error', reject);
                    uploadStream.end(fileBuffer);
                });

                // Update attachment record
                attachment.fileId = uploadStream.id;
                // Remove filePath field (will be ignored if not in schema)
                attachment.filePath = undefined;
                await attachment.save();

                console.log(`✅ Migrated ${attachment.originalName} - GridFS ID: ${uploadStream.id}`);
                successCount++;

                // Optional: Delete original file after successful migration
                // Uncomment the following lines if you want to delete filesystem files
                // fs.unlinkSync(filepath);
                // console.log(`🗑️  Deleted original file: ${filepath}`);

            } catch (error) {
                console.error(`❌ Error migrating ${attachment.originalName}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`   ✅ Successfully migrated: ${successCount}`);
        console.log(`   ⏭️  Skipped (already migrated): ${skipCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📊 Total: ${attachments.length}`);

        if (successCount > 0) {
            console.log('\n⚠️  NOTE: Original files are still on the filesystem.');
            console.log('   To delete them, uncomment the deletion code in this script and run again.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run migration
migrateCIFAttachments()
    .then(() => {
        console.log('\n✅ Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    });
