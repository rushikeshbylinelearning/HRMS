// backend/scripts/fix-policy-gridfs-references.js
// Diagnostic and repair script for Policy documents with missing GridFS files

require('dotenv').config();
const mongoose = require('mongoose');
const Policy = require('../models/Policy');
const connectDB = require('../db');

async function verifyAndRepairPolicies() {
    try {
        console.log('🔍 Policy GridFS Reference Verification & Repair Tool');
        console.log('====================================================\n');

        // Connect to database (this also initializes buckets)
        await connectDB();
        console.log('✅ Connected to MongoDB\n');

        const { getPolicyBucket } = require('../db');
        const policyBucket = getPolicyBucket();
        
        // Get all policies
        const policies = await Policy.find({});
        console.log(`📋 Found ${policies.length} policy documents in database\n`);

        if (policies.length === 0) {
            console.log('No policies found. Exiting.');
            await mongoose.disconnect();
            return;
        }

        const issues = [];
        const valid = [];

        // Check each policy
        for (const policy of policies) {
            console.log(`\nChecking Policy: ${policy.name} (v${policy.version})`);
            console.log(`  Policy ID: ${policy._id}`);
            console.log(`  FileId: ${policy.fileId}`);
            console.log(`  Status: ${policy.status}`);

            try {
                // Try to find the file in GridFS
                const files = await policyBucket.find({ 
                    _id: new mongoose.Types.ObjectId(policy.fileId) 
                }).toArray();

                if (files.length === 0) {
                    console.log(`  ❌ FILE NOT FOUND in GridFS`);
                    issues.push({
                        policy,
                        issue: 'FILE_NOT_FOUND',
                        fileId: policy.fileId.toString()
                    });
                } else {
                    console.log(`  ✅ File exists in GridFS`);
                    console.log(`     Filename: ${files[0].filename}`);
                    console.log(`     Size: ${files[0].length} bytes`);
                    console.log(`     Upload Date: ${files[0].uploadDate}`);
                    valid.push(policy);
                }
            } catch (error) {
                console.log(`  ❌ ERROR checking file: ${error.message}`);
                issues.push({
                    policy,
                    issue: 'CHECK_ERROR',
                    error: error.message
                });
            }
        }

        // Summary
        console.log('\n\n' + '='.repeat(60));
        console.log('VERIFICATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Valid policies: ${valid.length}`);
        console.log(`❌ Policies with issues: ${issues.length}\n`);

        if (issues.length > 0) {
            console.log('POLICIES WITH MISSING FILES:');
            console.log('-'.repeat(60));
            issues.forEach((item, index) => {
                console.log(`\n${index + 1}. ${item.policy.name} (v${item.policy.version})`);
                console.log(`   Policy ID: ${item.policy._id}`);
                console.log(`   Missing FileId: ${item.fileId}`);
                console.log(`   Status: ${item.policy.status}`);
                console.log(`   Created: ${item.policy.createdAt}`);
                console.log(`   Issue: ${item.issue}`);
            });

            console.log('\n\n' + '='.repeat(60));
            console.log('RECOMMENDED ACTIONS:');
            console.log('='.repeat(60));
            console.log('1. For Active policies with missing files:');
            console.log('   - Re-upload the policy file using the admin interface');
            console.log('   - Or mark them as Archived if no longer needed\n');
            console.log('2. For Archived policies with missing files:');
            console.log('   - Delete them if they\'re not needed');
            console.log('   - Or keep them for audit trail (they won\'t be accessible)\n');
            console.log('3. To delete policies with missing files, run:');
            console.log('   node backend/scripts/fix-policy-gridfs-references.js --delete-orphans\n');
        } else {
            console.log('✨ All policies have valid GridFS references!');
        }

        // Auto-repair option
        if (process.argv.includes('--delete-orphans')) {
            console.log('\n\n' + '='.repeat(60));
            console.log('DELETE ORPHANED POLICIES');
            console.log('='.repeat(60));
            
            if (issues.length === 0) {
                console.log('No orphaned policies to delete.');
            } else {
                console.log(`\nDeleting ${issues.length} policies with missing files...\n`);
                
                for (const item of issues) {
                    try {
                        await Policy.findByIdAndDelete(item.policy._id);
                        console.log(`✅ Deleted: ${item.policy.name} (${item.policy._id})`);
                    } catch (error) {
                        console.log(`❌ Failed to delete ${item.policy._id}: ${error.message}`);
                    }
                }
                
                console.log('\n✅ Cleanup complete!');
            }
        }

        // List all files in GridFS bucket
        if (process.argv.includes('--list-gridfs')) {
            console.log('\n\n' + '='.repeat(60));
            console.log('ALL FILES IN GRIDFS BUCKET');
            console.log('='.repeat(60));
            
            const allFiles = await policyBucket.find({}).toArray();
            console.log(`\nTotal files in policyFiles bucket: ${allFiles.length}\n`);
            
            allFiles.forEach((file, index) => {
                console.log(`${index + 1}. ${file.filename}`);
                console.log(`   ID: ${file._id}`);
                console.log(`   Size: ${file.length} bytes`);
                console.log(`   Upload Date: ${file.uploadDate}`);
                console.log('');
            });

            // Find orphaned files (files not referenced by any policy)
            const referencedFileIds = new Set(
                policies.map(p => p.fileId.toString())
            );
            
            const orphanedFiles = allFiles.filter(
                file => !referencedFileIds.has(file._id.toString())
            );

            if (orphanedFiles.length > 0) {
                console.log('\n⚠️  ORPHANED FILES (not referenced by any policy):');
                console.log('-'.repeat(60));
                orphanedFiles.forEach((file, index) => {
                    console.log(`${index + 1}. ${file.filename} (${file._id})`);
                });
                console.log(`\nTotal orphaned files: ${orphanedFiles.length}`);
                console.log('These files can be safely deleted to free up space.');
            }
        }

        await mongoose.disconnect();
        console.log('\n✅ Database connection closed');
        
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the verification
verifyAndRepairPolicies();
