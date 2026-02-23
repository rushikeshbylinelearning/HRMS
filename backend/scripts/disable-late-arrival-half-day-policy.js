// Script to disable late arrival half-day policy for all users
// This ensures no employee is marked as half-day based on late arrival

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function disableLateArrivalHalfDayPolicy() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('DISABLE LATE ARRIVAL HALF-DAY POLICY');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Step 1: Check current status
        console.log('Step 1: Checking current policy status...\n');
        
        const usersWithPolicyEnabled = await User.find({
            'featurePermissions.lateArrivalMarksHalfDay': true
        }).select('fullName employeeCode featurePermissions.lateArrivalMarksHalfDay').lean();
        
        console.log(`Users with lateArrivalMarksHalfDay = true: ${usersWithPolicyEnabled.length}\n`);
        
        if (usersWithPolicyEnabled.length > 0) {
            console.log('Affected users:');
            usersWithPolicyEnabled.forEach(user => {
                console.log(`  - ${user.fullName} (${user.employeeCode})`);
            });
            console.log();
        }
        
        // Step 2: Disable policy for all users
        console.log('Step 2: Disabling policy for all users...\n');
        
        const result = await User.updateMany(
            { 'featurePermissions.lateArrivalMarksHalfDay': true },
            { $set: { 'featurePermissions.lateArrivalMarksHalfDay': false } }
        );
        
        console.log(`✅ Updated ${result.modifiedCount} users\n`);
        
        // Step 3: Verify the change
        console.log('Step 3: Verifying changes...\n');
        
        const remainingUsers = await User.countDocuments({
            'featurePermissions.lateArrivalMarksHalfDay': true
        });
        
        if (remainingUsers === 0) {
            console.log('✅ SUCCESS: All users now have lateArrivalMarksHalfDay = false\n');
        } else {
            console.log(`⚠️  WARNING: ${remainingUsers} users still have the policy enabled\n`);
        }
        
        // Step 4: Summary
        console.log('═══════════════════════════════════════════════════════════');
        console.log('SUMMARY');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Policy Change:');
        console.log('  ❌ OLD: Late arrival beyond grace period → Marks as Half-day');
        console.log('  ✅ NEW: Late arrival beyond grace period → Marks as Late only\n');
        
        console.log('Impact:');
        console.log('  - Employees arriving late will be marked as "Late"');
        console.log('  - They will NOT be marked as "Half-day" due to late arrival');
        console.log('  - Half-day status will only apply for insufficient working hours (<9 hrs)\n');
        
        console.log('Note:');
        console.log('  - This change affects future attendance records');
        console.log('  - Existing half-day records remain unchanged');
        console.log('  - To fix existing records, run a separate backfill script\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('POLICY UPDATE COMPLETE');
        console.log('═══════════════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

disableLateArrivalHalfDayPolicy();
