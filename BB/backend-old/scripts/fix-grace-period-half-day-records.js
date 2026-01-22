// backend/scripts/fix-grace-period-half-day-records.js
// Script to fix existing attendance records that were incorrectly marked as half-day
// when they are actually within the grace period

const mongoose = require('mongoose');
require('dotenv').config();

const AttendanceLog = require('../models/AttendanceLog');
const Setting = require('../models/Setting');
const User = require('../models/User');
const Shift = require('../models/Shift'); // Required for populate to work

/**
 * Get shift start time in IST for a given date and shift time
 */
const getShiftDateTimeIST = (onDate, shiftTime) => {
    const [hours, minutes] = shiftTime.split(':').map(Number);
    const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const [{ value: year }, , { value: month }, , { value: day }] = istDateFormatter.formatToParts(onDate);
    const shiftDateTimeISO_IST = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000+05:30`;
    return new Date(shiftDateTimeISO_IST);
};

async function fixGracePeriodHalfDayRecords() {
    try {
        console.log('🔧 Starting to fix attendance records incorrectly marked as half-day within grace period...');
        
        // Get grace period setting
        let GRACE_PERIOD_MINUTES = 30;
        try {
            const graceSetting = await Setting.findOne({ key: 'lateGraceMinutes' });
            if (graceSetting) {
                const graceValue = parseInt(Number(graceSetting.value), 10);
                if (!isNaN(graceValue) && graceValue >= 0) {
                    GRACE_PERIOD_MINUTES = graceValue;
                } else {
                    console.warn(`[Grace Period] Invalid value in database: ${graceSetting.value}, using default 30 minutes`);
                }
            }
        } catch (err) {
            console.error('Failed to fetch late grace setting, using default 30 minutes', err);
        }
        
        console.log(`📅 Using grace period: ${GRACE_PERIOD_MINUTES} minutes`);
        console.log(`🔍 Looking for records marked as half-day but within grace period (lateMinutes <= ${GRACE_PERIOD_MINUTES})...`);
        
        // Find all attendance records that are marked as half-day
        const halfDayRecords = await AttendanceLog.find({
            $or: [
                { isHalfDay: true },
                { attendanceStatus: 'Half-day' }
            ],
            clockInTime: { $exists: true, $ne: null }
        }).populate('user', 'shiftGroup').lean();
        
        console.log(`📊 Found ${halfDayRecords.length} records marked as half-day`);
        
        let fixedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const fixedRecords = [];
        
        for (const record of halfDayRecords) {
            try {
                // Get the user's shift information
                const user = await User.findById(record.user).populate('shiftGroup').lean();
                if (!user || !user.shiftGroup || !user.shiftGroup.startTime) {
                    console.log(`⚠️  Skipping record ${record._id}: User or shift not found`);
                    skippedCount++;
                    continue;
                }
                
                // Recalculate late minutes based on clock-in time
                const clockInTime = new Date(record.clockInTime);
                const shiftStartTime = getShiftDateTimeIST(clockInTime, user.shiftGroup.startTime);
                const lateMinutes = Math.max(0, Math.floor((clockInTime - shiftStartTime) / (1000 * 60)));
                
                // Check if this record should be fixed (within grace period but marked as half-day)
                const shouldBeOnTime = lateMinutes <= GRACE_PERIOD_MINUTES;
                const isCurrentlyHalfDay = record.isHalfDay || record.attendanceStatus === 'Half-day';
                
                if (shouldBeOnTime && isCurrentlyHalfDay) {
                    // This record needs to be fixed
                    const updateData = {
                        isHalfDay: false,
                        isLate: false,
                        attendanceStatus: 'On-time',
                        lateMinutes: lateMinutes // Update lateMinutes to ensure accuracy
                    };
                    
                    await AttendanceLog.findByIdAndUpdate(record._id, updateData);
                    
                    fixedCount++;
                    fixedRecords.push({
                        recordId: record._id,
                        userId: record.user._id || record.user,
                        userName: user.fullName || 'Unknown',
                        attendanceDate: record.attendanceDate,
                        lateMinutes: lateMinutes,
                        gracePeriod: GRACE_PERIOD_MINUTES,
                        oldStatus: record.attendanceStatus,
                        newStatus: 'On-time'
                    });
                    
                    console.log(`✅ Fixed record for ${user.fullName || 'Unknown'} on ${record.attendanceDate}: ${record.attendanceStatus} → On-time (${lateMinutes} min late, within ${GRACE_PERIOD_MINUTES} min grace period)`);
                } else {
                    // Record is correctly marked (either not half-day, or beyond grace period)
                    skippedCount++;
                }
            } catch (error) {
                console.error(`❌ Error processing record ${record._id}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n🎉 Fix completed!`);
        console.log(`✅ Fixed: ${fixedCount} records`);
        console.log(`⏭️  Skipped: ${skippedCount} records (correctly marked or beyond grace period)`);
        console.log(`❌ Errors: ${errorCount} records`);
        console.log(`📊 Total processed: ${halfDayRecords.length} records`);
        
        // Print summary of fixed records
        if (fixedRecords.length > 0) {
            console.log(`\n📋 Summary of fixed records:`);
            fixedRecords.forEach((rec, index) => {
                console.log(`  ${index + 1}. ${rec.userName} - ${rec.attendanceDate}: ${rec.lateMinutes} min late (grace: ${rec.gracePeriod} min) - ${rec.oldStatus} → ${rec.newStatus}`);
            });
        }
        
        return {
            total: halfDayRecords.length,
            fixed: fixedCount,
            skipped: skippedCount,
            errors: errorCount,
            records: fixedRecords
        };
        
    } catch (error) {
        console.error('❌ Error fixing attendance records:', error);
        throw error;
    }
}

// Run the script if called directly
if (require.main === module) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-system';
    
    mongoose.connect(mongoUri)
        .then(() => {
            console.log('🔗 Connected to MongoDB');
            return fixGracePeriodHalfDayRecords();
        })
        .then((result) => {
            console.log('\n✅ Script completed successfully');
            console.log(`📈 Results: ${result.fixed} fixed, ${result.skipped} skipped, ${result.errors} errors`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = fixGracePeriodHalfDayRecords;

