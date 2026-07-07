/**
 * Migration Script: Update Policy URLs to Authenticated Route Format
 * 
 * This script updates existing policy fileUrl from:
 *   /policies/policy-xxx.pdf
 * To:
 *   /api/policies/file/policy-xxx.pdf
 * 
 * Run this ONCE after deploying the secure PDF delivery changes.
 * 
 * Usage: node backend/scripts/migrate-policy-urls.js
 */

const mongoose = require('mongoose');
const Policy = require('../models/Policy');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function migratePolicyUrls() {
    try {
        console.log('🔄 Starting policy URL migration...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance');
        console.log('✅ Connected to MongoDB');

        // Find all policies with old URL format
        const policies = await Policy.find({
            fileUrl: { $regex: '^/policies/' }
        });

        console.log(`📋 Found ${policies.length} policies to migrate`);

        if (policies.length === 0) {
            console.log('✅ No policies need migration');
            await mongoose.connection.close();
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const policy of policies) {
            try {
                const oldUrl = policy.fileUrl;
                // Extract filename from old URL: /policies/policy-xxx.pdf -> policy-xxx.pdf
                const filename = oldUrl.replace('/policies/', '');
                // Create new URL: /api/policies/file/policy-xxx.pdf
                const newUrl = `/api/policies/file/${filename}`;

                policy.fileUrl = newUrl;
                await policy.save();

                console.log(`✅ Migrated: ${policy.name} (v${policy.version})`);
                console.log(`   Old: ${oldUrl}`);
                console.log(`   New: ${newUrl}`);
                successCount++;
            } catch (error) {
                console.error(`❌ Error migrating policy ${policy._id}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`   ✅ Success: ${successCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📋 Total: ${policies.length}`);

        await mongoose.connection.close();
        console.log('\n✅ Migration complete. Database connection closed.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migratePolicyUrls();
