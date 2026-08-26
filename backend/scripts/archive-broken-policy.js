// backend/scripts/archive-broken-policy.js
// Archive policies with missing GridFS files

require('dotenv').config();
const mongoose = require('mongoose');
const Policy = require('../models/Policy');
const connectDB = require('../db');

async function archiveBrokenPolicies() {
    try {
        await connectDB();
        console.log('✅ Connected to MongoDB\n');

        // Archive the specific broken policy
        const policyId = '6a7c772e7001b3d13bf113ba';
        
        const policy = await Policy.findById(policyId);
        if (!policy) {
            console.log('❌ Policy not found');
            process.exit(1);
        }

        policy.status = 'Archived';
        await policy.save();

        console.log(`✅ Archived policy: ${policy.name} (${policyId})`);
        console.log('   Status changed from Active to Archived');
        console.log('   The policy record is preserved but will not be accessible');

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

archiveBrokenPolicies();
