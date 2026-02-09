/**
 * Script to fix incorrect half-day reasons in past attendance records
 * 
 * Issue: Records marked as "Late Arrival" when they should be "Incomplete Hours"
 * - Employee was within grace period (<=30 min late)
 * - Employee worked insufficient hours (<8 hours)
 * - Record shows "Late Arrival" instead of "Incomplete Hours"
 * 
 * This script will:
 * 1. Find all half-day records with LATE_LOGIN reason
 * 2. Check if they were actually within grace period
 * 3. Check if they had insufficient working hours
 * 4. Update the reason to INSUFFICIENT_WORKING_HOURS if applicable
 */

const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const Setting = require('../models/Setting');
const User = require('../models/User');

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-system');
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function fixHalfDayReasons() {
    console.log('🔍 Starting Half-Day Reason Fix...\n');
    
    // Get grace period from settings
    let GRACE_PERIOD_MINUTES = 30;
    try {
        const graceSetting = await Setting.findOne({ key: 'lateGraceMinutes' });
        if (graceSetting) {
            const graceValue = parseInt(Number(graceSetting.value), 10);
            if (!isNaN(graceValue) && graceValue >= 0) {
                GRACE_PERIOD_MINUTES = graceValue;
            }
        }
    } catch (err) {
        console.warn('⚠️ Failed to fetch grace period, using default 30 minutes');
    }
    
    console.log(`📋 Using grace period: ${GRACE_PERIOD_MINUTES} minutes`);
    
    // Find all half-day records with LATE_LOGIN reason that might need fixing
    // Include records where lateMinutes might be within grace period
    const potentialIncorrectRecords = await AttendanceLog.find({
        isHalfDay: true,
        halfDayReasonCode: 'LATE_LOGIN',
        overriddenByAdmin: { $ne: true }, // Don't touch admin overrides
        totalWorkingHours: { $exists: true, $lt: 8 }, // Has working hours and < 8
        lateMinutes: { $exists: true } // Has late minutes data
    }).populate('user', 'fullName email');
    
    console.log(`📊 Found ${potentialIncorrectRecords.length} records with LATE_LOGIN reason and insufficient hours\n`);
    
    if (potentialIncorrectRecords.length === 0) {
        console.log('✅ No records found with LATE_LOGIN reason and insufficient hours!');
        return;
    }
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const record of potentialIncorrectRecords) {
        try {
            const withinGracePeriod = record.lateMinutes <= GRACE_PERIOD_MINUTES;
            const insufficientHours = record.totalWorkingHours < 8;
            
            console.log(`👤 ${record.user.fullName} (${record.attendanceDate})`);
            console.log(`   Late: ${record.lateMinutes} min (grace: ${GRACE_PERIOD_MINUTES} min, within: ${withinGracePeriod})`);
            console.log(`   Hours: ${record.totalWorkingHours.toFixed(1)} hours (insufficient: ${insufficientHours})`);
            console.log(`   Current reason: ${record.halfDayReasonText}`);
            
            if (withinGracePeriod && insufficientHours) {
                // This record needs fixing - within grace period but marked as late arrival
                const newReasonText = `Insufficient working hours (${record.totalWorkingHours.toFixed(1)} hours worked, minimum required: 8 hours)`;
                
                await AttendanceLog.findByIdAndUpdate(record._id, {
                    $set: {
                        halfDayReasonCode: 'INSUFFICIENT_WORKING_HOURS',
                        halfDayReasonText: newReasonText,
                        halfDaySource: 'AUTO'
                    }
                });
                
                console.log(`   ✅ FIXED: Changed to "Insufficient Hours"`);
                fixedCount++;
            } else if (!withinGracePeriod && insufficientHours) {
                // Beyond grace period AND insufficient hours - late arrival takes precedence
                console.log(`   ✅ CORRECT: Late arrival beyond grace period (no change needed)`);
                skippedCount++;
            } else {
                console.log(`   ⏭️ SKIPPED: Doesn't meet criteria for fixing`);
                skippedCount++;
            }
            
            console.log('');
        } catch (error) {
            console.error(`❌ Error fixing record ${record._id}:`, error.message);
            skippedCount++;
        }
    }
    
    console.log('\n📈 Summary:');
    console.log(`✅ Fixed: ${fixedCount} records (changed from "Late Arrival" to "Insufficient Hours")`);
    console.log(`✅ Correct: ${skippedCount - (potentialIncorrectRecords.length - fixedCount)} records (already correct)`);
    console.log(`⏭️ Skipped: ${potentialIncorrectRecords.length - fixedCount} records (other reasons)`);
    console.log(`📊 Total processed: ${potentialIncorrectRecords.length} records`);
}

async function main() {
    try {
        await connectDB();
        await fixHalfDayReasons();
        console.log('\n🎉 Half-Day Reason Fix completed successfully!');
    } catch (error) {
        console.error('❌ Script failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { fixHalfDayReasons };