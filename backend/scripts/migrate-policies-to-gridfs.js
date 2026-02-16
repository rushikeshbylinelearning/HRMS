// backend/scripts/migrate-policies-to-gridfs.js
// Migration script: Move existing policies from filesystem to GridFS
// This script:
// 1. Reads all policies from database
// 2. Loads PDF files from storage/policies directory
// 3. Uploads them to GridFS
// 4. Updates Policy documents with new fileId
// 5. Optionally deletes old files

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const connectDB = require('../db');
const { getPolicyBucket } = require('../db');
const Policy = require('../models/Policy');

const STORAGE_DIR = path.join(__dirname, '../storage/policies');
const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_OLD_FILES = process.argv.includes('--delete-old');

async function uploadToGridFS(buffer, originalFilename, policyId, uploadedBy) {
    try {
        const policyBucket = getPolicyBucket();
        
        const filename = `policy-${policyId}-migrated.pdf`;
        
        const uploadStream = policyBucket.openUploadStream(filename, {
            contentType: 'application/pdf',
            metadata: {
                originalFilename: originalFilename,
                uploadedBy: uploadedBy,
                migratedAt: new Date(),
                fileSize: buffer.length,
                migratedFrom: 'filesystem'
            }
        });
        
        return new Promise((resolve, reject) => {
            uploadStream.on('finish', () => {
                resolve({
                    fileId: uploadStream.id,
                    filename: filename,
                    size: buffer.length
                });
            });
            
            uploadStream.on('error', reject);
            
            uploadStream.end(buffer);
        });
    } catch (error) {
        throw new Error(`GridFS upload failed: ${error.message}`);
    }
}

async function migratePolicy(policy) {
    try {
        console.log(`\n📄 Processing: ${policy.name} (v${policy.version})`);
        console.log(`   Policy ID: ${policy._id}`);
        console.log(`   Current fileUrl: ${policy.fileUrl}`);
        
        // Check if already migrated
        if (policy.fileId) {
            console.log('   ⏭️  Already migrated (has fileId), skipping');
            return { status: 'skipped', reason: 'already_migrated' };
        }
        
        // Extract filename from fileUrl
        const filename = path.basename(policy.fileUrl);
        const filePath = path.join(STORAGE_DIR, filename);
        
        // Check if file exists
        if (!fsSync.existsSync(filePath)) {
            console.log(`   ⚠️  File not found: ${filePath}`);
            return { status: 'error', reason: 'file_not_found', path: filePath };
        }
        
        // Get file stats
        const stats = fsSync.statSync(filePath);
        console.log(`   File size: ${stats.size} bytes`);
        
        if (DRY_RUN) {
            console.log('   🔍 DRY RUN: Would upload to GridFS');
            return { status: 'dry_run', size: stats.size };
        }
        
        // Read file
        const buffer = await fs.readFile(filePath);
        
        // Verify PDF signature
        const pdfSignature = buffer.slice(0, 4).toString();
        if (pdfSignature !== '%PDF') {
            console.log(`   ⚠️  Invalid PDF signature: ${pdfSignature}`);
            return { status: 'error', reason: 'invalid_pdf' };
        }
        
        // Upload to GridFS
        console.log('   📤 Uploading to GridFS...');
        const gridfsResult = await uploadToGridFS(
            buffer,
            policy.fileName,
            policy._id,
            policy.uploadedBy
        );
        
        console.log(`   ✅ Uploaded to GridFS: ${gridfsResult.fileId}`);
        
        // Update policy document
        policy.fileId = gridfsResult.fileId;
        policy.fileSize = gridfsResult.size;
        await policy.save();
        
        console.log('   ✅ Policy document updated');
        
        // Delete old file if requested
        if (DELETE_OLD_FILES) {
            await fs.unlink(filePath);
            console.log('   🗑️  Old file deleted');
        }
        
        return { 
            status: 'success', 
            fileId: gridfsResult.fileId,
            size: gridfsResult.size,
            deleted: DELETE_OLD_FILES
        };
        
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return { status: 'error', reason: error.message };
    }
}

async function runMigration() {
    console.log('🔄 Policy Migration: Filesystem → GridFS');
    console.log('=========================================');
    console.log('Mode:', DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE');
    console.log('Delete old files:', DELETE_OLD_FILES ? 'YES' : 'NO');
    console.log('Storage directory:', STORAGE_DIR);
    console.log('');
    
    try {
        // Connect to database
        console.log('📡 Connecting to MongoDB...');
        await connectDB();
        console.log('✅ Connected to MongoDB');
        
        // Get all policies
        const policies = await Policy.find().sort({ createdAt: 1 });
        console.log(`\n📋 Found ${policies.length} policies to process`);
        
        if (policies.length === 0) {
            console.log('No policies found. Exiting.');
            process.exit(0);
        }
        
        // Process each policy
        const results = {
            success: 0,
            skipped: 0,
            errors: 0,
            dry_run: 0,
            totalSize: 0
        };
        
        for (const policy of policies) {
            const result = await migratePolicy(policy);
            
            if (result.status === 'success') {
                results.success++;
                results.totalSize += result.size;
            } else if (result.status === 'skipped') {
                results.skipped++;
            } else if (result.status === 'dry_run') {
                results.dry_run++;
                results.totalSize += result.size;
            } else {
                results.errors++;
            }
        }
        
        // Summary
        console.log('\n📊 Migration Summary');
        console.log('===================');
        console.log('Total policies:', policies.length);
        console.log('Successful:', results.success);
        console.log('Skipped:', results.skipped);
        console.log('Errors:', results.errors);
        if (DRY_RUN) {
            console.log('Dry run:', results.dry_run);
        }
        console.log('Total size:', (results.totalSize / 1024 / 1024).toFixed(2), 'MB');
        
        if (DRY_RUN) {
            console.log('\n💡 This was a dry run. Run without --dry-run to perform migration.');
        } else if (results.success > 0) {
            console.log('\n✅ Migration completed successfully!');
            if (!DELETE_OLD_FILES) {
                console.log('💡 Old files are still in storage/policies. Run with --delete-old to remove them.');
            }
        }
        
        if (results.errors > 0) {
            console.log('\n⚠️  Some policies failed to migrate. Check logs above.');
            process.exit(1);
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
runMigration();
