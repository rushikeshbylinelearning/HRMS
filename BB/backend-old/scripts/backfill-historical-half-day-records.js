// backend/scripts/backfill-historical-half-day-records.js
/**
 * HISTORICAL HALF-DAY BACKFILL SCRIPT
 * 
 * OBJECTIVE: Safely backfill historical attendance records that should be Half Day
 * but were never marked correctly due to previous system limitations.
 * 
 * CRITICAL CONSTRAINTS:
 * ❌ DO NOT break existing payroll
 * ❌ DO NOT delete any attendance logs  
 * ❌ DO NOT override admin-approved overrides
 * ❌ DO NOT change records that already have isHalfDay === true or overriddenByAdmin === true
 * 
 * This is a SAFE, IDEMPOTENT BACKFILL that only updates eligible records.
 */

const mongoose = require('mongoose');
const connectDB = require('../db');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const Setting = require('../models/Setting');
const { recalculateLateStatus } = require('../services/dailyStatusService');
const { resolveAttendanceStatus } = require('../utils/attendanceStatusResolver');
const { getISTDateString, parseISTDate } = require('../utils/istTime');

// Backfill metadata for audit trail
const BACKFILL_METADATA = {
    backfilledBy: 'SYSTEM_BACKFILL_2026',
    backfillVersion: 'v1.0',
    backfillReason: 'Historical half-day records correction'
};

/**
 * Configuration options
 */
const CONFIG = {
    DRY_RUN: true, // Set to false for actual execution
    BATCH_SIZE: 100, // Process records in batches
    MIN_WORKING_HOURS: 8, // Minimum hours to avoid half-day
    VERBOSE_LOGGING: true,
    DATE_RANGE: {
        // Limit backfill to specific date range (optional)
        startDate: null, // '2024-01-01' or null for no limit
        endDate: null    // '2024-12-31' or null for no limit
    }
};

/**
 * Statistics tracking
 */
const stats = {
    totalScanned: 0,
    eligibleRecords: 0,
    alreadyCorrect: 0,
    adminOverridden: 0,
    leaveRecords: 0,
    holidayWeeklyOff: 0,
    noSessions: 0,
    insufficientHours: 0,
    updated: 0,
    errors: 0,
    errorDetails: []
};

/**
 * Get grace period from settings
 */
async function getGracePeriodMinutes() {
    try {
        const graceSetting = await Setting.findOne({ key: 'lateGraceMinutes' });
        if (graceSetting) {
            const graceValue = parseInt(Number(graceSetting.value), 10);
            if (!isNaN(graceValue) && graceValue >= 0) {
                return graceValue;
            }
        }
        return 30; // Default
    } catch (error) {
        console.warn('Failed to fetch grace period setting, using default 30 minutes:', error.message);
        return 30;
    }
}

/**
 * Calculate total worked minutes from sessions
 */
function calculateTotalWorkedMinutes(sessions) {
    if (!sessions || sessions.length === 0) return 0;
    
    let totalMinutes = 0;
    for (const session of sessions) {
        if (session.startTime && session.endTime) {
            const duration = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60);
            totalMinutes += Math.max(0, duration);
        }
    }
    return totalMinutes;
}

/**
 * Check if record is eligible for backfill
 */
function isEligibleForBackfill(log, sessions, totalWorkedMinutes) {
    // Skip if already marked as half-day
    if (log.isHalfDay === true) {
        stats.alreadyCorrect++;
        return { eligible: false, reason: 'Already marked as half-day' };
    }
    
    // Skip if admin overridden
    if (log.overriddenByAdmin === true) {
        stats.adminOverridden++;
        return { eligible: false, reason: 'Admin overridden - protected' };
    }
    
    // Skip if leave record
    if (log.attendanceStatus === 'Leave' || log.leaveRequest) {
        stats.leaveRecords++;
        return { eligible: false, reason: 'Leave record' };
    }
    
    // Skip if no clock-in time (absent records)
    if (!log.clockInTime) {
        return { eligible: false, reason: 'No clock-in time (absent)' };
    }
    
    // Skip if no sessions (shouldn't happen with clock-in, but defensive)
    if (!sessions || sessions.length === 0) {
        stats.noSessions++;
        return { eligible: false, reason: 'No attendance sessions' };
    }
    
    // Check if insufficient working hours
    const workedHours = totalWorkedMinutes / 60;
    if (workedHours < CONFIG.MIN_WORKING_HOURS) {
        stats.insufficientHours++;
        return { 
            eligible: true, 
            reason: 'INSUFFICIENT_WORKING_HOURS',
            workedHours: workedHours.toFixed(2)
        };
    }
    
    return { eligible: false, reason: 'Sufficient working hours' };
}

/**
 * Generate half-day reason text
 */
function generateHalfDayReason(reasonCode, workedHours, clockInTime) {
    switch (reasonCode) {
        case 'INSUFFICIENT_WORKING_HOURS':
            return `Worked ${workedHours}h, minimum required is 8h`;
        case 'LATE_LOGIN':
            const clockInTimeStr = clockInTime.toLocaleTimeString('en-US', { 
                timeZone: 'Asia/Kolkata',
                hour12: true, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            return `Late login beyond grace period (logged at ${clockInTimeStr})`;
        default:
            return 'Half-day marked by system backfill';
    }
}

/**
 * Process a single attendance record
 */
async function processAttendanceRecord(log, gracePeriodMinutes, session) {
    try {
        stats.totalScanned++;
        
        if (CONFIG.VERBOSE_LOGGING && stats.totalScanned % 100 === 0) {
            console.log(`📊 Processed ${stats.totalScanned} records...`);
        }
        
        // Get sessions for this log
        const sessions = await AttendanceSession.find({ 
            attendanceLog: log._id 
        }).session(session);
        
        // Calculate total worked minutes
        const totalWorkedMinutes = calculateTotalWorkedMinutes(sessions);
        
        // Check eligibility
        const eligibility = isEligibleForBackfill(log, sessions, totalWorkedMinutes);
        
        if (!eligibility.eligible) {
            if (CONFIG.VERBOSE_LOGGING && ['Already marked as half-day', 'Admin overridden - protected'].includes(eligibility.reason)) {
                console.log(`⏭️  Skipping ${log.user} ${log.attendanceDate}: ${eligibility.reason}`);
            }
            return null;
        }
        
        stats.eligibleRecords++;
        
        // Get user for shift information
        const user = await User.findById(log.user).populate('shiftGroup').session(session);
        if (!user || !user.shiftGroup) {
            console.warn(`⚠️  No shift info for user ${log.user} on ${log.attendanceDate}`);
            return null;
        }
        
        // Determine reason code and text
        let reasonCode = 'INSUFFICIENT_WORKING_HOURS';
        let reasonText = generateHalfDayReason(reasonCode, eligibility.workedHours, log.clockInTime);
        
        // Check if it's also a late login case
        if (log.clockInTime && user.shiftGroup.startTime) {
            const lateStatus = await recalculateLateStatus(log.clockInTime, user.shiftGroup, gracePeriodMinutes);
            if (lateStatus.isHalfDay && lateStatus.halfDayReasonCode === 'LATE_LOGIN') {
                reasonCode = 'LATE_LOGIN';
                reasonText = lateStatus.halfDayReasonText;
            }
        }
        
        const updateData = {
            status: 'Half Day',
            isHalfDay: true,
            attendanceStatus: 'Half-day',
            halfDayReasonCode: reasonCode,
            halfDayReasonText: reasonText,
            halfDaySource: 'AUTO',
            // Backfill metadata
            backfilledAt: new Date(),
            backfilledBy: BACKFILL_METADATA.backfilledBy,
            backfillVersion: BACKFILL_METADATA.backfillVersion,
            backfillReason: BACKFILL_METADATA.backfillReason
        };
        
        console.log(`✅ ${CONFIG.DRY_RUN ? '[DRY-RUN] ' : ''}Updating ${user.fullName || user.email} ${log.attendanceDate}: ${reasonText}`);
        
        if (!CONFIG.DRY_RUN) {
            await AttendanceLog.findByIdAndUpdate(
                log._id,
                updateData,
                { session }
            );
            stats.updated++;
        }
        
        return {
            userId: log.user,
            userName: user.fullName || user.email,
            attendanceDate: log.attendanceDate,
            reasonCode,
            reasonText,
            workedHours: eligibility.workedHours,
            updateData
        };
        
    } catch (error) {
        stats.errors++;
        stats.errorDetails.push({
            logId: log._id,
            attendanceDate: log.attendanceDate,
            error: error.message
        });
        console.error(`❌ Error processing record ${log._id}:`, error.message);
        return null;
    }
}

/**
 * Build query for eligible records
 */
function buildEligibilityQuery() {
    const query = {
        // Must be working days with attendance logs
        clockInTime: { $exists: true, $ne: null },
        
        // Must NOT already be half-day
        isHalfDay: { $ne: true },
        
        // Must NOT be admin overridden
        overriddenByAdmin: { $ne: true },
        
        // Must NOT be leave records
        attendanceStatus: { $ne: 'Leave' },
        leaveRequest: { $exists: false }
    };
    
    // Add date range filter if specified
    if (CONFIG.DATE_RANGE.startDate) {
        query.attendanceDate = { $gte: CONFIG.DATE_RANGE.startDate };
    }
    if (CONFIG.DATE_RANGE.endDate) {
        if (query.attendanceDate) {
            query.attendanceDate.$lte = CONFIG.DATE_RANGE.endDate;
        } else {
            query.attendanceDate = { $lte: CONFIG.DATE_RANGE.endDate };
        }
    }
    
    return query;
}

/**
 * Main backfill function
 */
async function backfillHistoricalHalfDayRecords() {
    console.log('🚀 Starting Historical Half-Day Records Backfill...');
    console.log(`📋 Mode: ${CONFIG.DRY_RUN ? 'DRY-RUN (no changes will be made)' : 'LIVE EXECUTION'}`);
    console.log(`📅 Date Range: ${CONFIG.DATE_RANGE.startDate || 'All'} to ${CONFIG.DATE_RANGE.endDate || 'All'}`);
    console.log(`⚙️  Batch Size: ${CONFIG.BATCH_SIZE}`);
    console.log(`⏰ Min Working Hours: ${CONFIG.MIN_WORKING_HOURS}`);
    
    const session = await mongoose.startSession();
    
    try {
        await session.withTransaction(async () => {
            // Get grace period
            const gracePeriodMinutes = await getGracePeriodMinutes();
            console.log(`🕐 Grace Period: ${gracePeriodMinutes} minutes`);
            
            // Build query for eligible records
            const query = buildEligibilityQuery();
            console.log('🔍 Query:', JSON.stringify(query, null, 2));
            
            // Get total count
            const totalCount = await AttendanceLog.countDocuments(query);
            console.log(`📊 Total records to scan: ${totalCount}`);
            
            if (totalCount === 0) {
                console.log('✅ No records found matching criteria');
                return;
            }
            
            // Process in batches
            let skip = 0;
            const processedRecords = [];
            
            while (skip < totalCount) {
                console.log(`\n📦 Processing batch ${Math.floor(skip / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(totalCount / CONFIG.BATCH_SIZE)} (records ${skip + 1}-${Math.min(skip + CONFIG.BATCH_SIZE, totalCount)})`);
                
                const logs = await AttendanceLog.find(query)
                    .skip(skip)
                    .limit(CONFIG.BATCH_SIZE)
                    .session(session);
                
                for (const log of logs) {
                    const result = await processAttendanceRecord(log, gracePeriodMinutes, session);
                    if (result) {
                        processedRecords.push(result);
                    }
                }
                
                skip += CONFIG.BATCH_SIZE;
            }
            
            // Print summary
            console.log('\n' + '='.repeat(80));
            console.log('📊 BACKFILL SUMMARY');
            console.log('='.repeat(80));
            console.log(`Total Records Scanned: ${stats.totalScanned}`);
            console.log(`Eligible for Backfill: ${stats.eligibleRecords}`);
            console.log(`Already Correct: ${stats.alreadyCorrect}`);
            console.log(`Admin Overridden (Protected): ${stats.adminOverridden}`);
            console.log(`Leave Records (Skipped): ${stats.leaveRecords}`);
            console.log(`No Sessions (Skipped): ${stats.noSessions}`);
            console.log(`Insufficient Hours Found: ${stats.insufficientHours}`);
            console.log(`${CONFIG.DRY_RUN ? 'Would Update' : 'Updated'}: ${CONFIG.DRY_RUN ? stats.eligibleRecords : stats.updated}`);
            console.log(`Errors: ${stats.errors}`);
            
            if (stats.errors > 0) {
                console.log('\n❌ ERROR DETAILS:');
                stats.errorDetails.forEach(error => {
                    console.log(`  - ${error.attendanceDate}: ${error.error}`);
                });
            }
            
            if (processedRecords.length > 0) {
                console.log(`\n📋 ${CONFIG.DRY_RUN ? 'WOULD UPDATE' : 'UPDATED'} RECORDS:`);
                processedRecords.forEach(record => {
                    console.log(`  - ${record.userName} (${record.attendanceDate}): ${record.reasonText}`);
                });
            }
            
            if (CONFIG.DRY_RUN) {
                console.log('\n🔄 This was a DRY-RUN. No changes were made.');
                console.log('💡 Set CONFIG.DRY_RUN = false to execute the backfill.');
            } else {
                console.log('\n✅ Backfill completed successfully!');
            }
        });
        
    } catch (error) {
        console.error('❌ Backfill failed:', error);
        throw error;
    } finally {
        await session.endSession();
    }
}

/**
 * Rollback function to revert backfill changes
 */
async function rollbackBackfill() {
    console.log('🔄 Starting backfill rollback...');
    
    const session = await mongoose.startSession();
    
    try {
        await session.withTransaction(async () => {
            const backfilledRecords = await AttendanceLog.find({
                backfilledBy: BACKFILL_METADATA.backfilledBy,
                backfillVersion: BACKFILL_METADATA.backfillVersion
            }).session(session);
            
            console.log(`📊 Found ${backfilledRecords.length} backfilled records to rollback`);
            
            for (const record of backfilledRecords) {
                // Revert to previous state
                const revertData = {
                    $unset: {
                        backfilledAt: 1,
                        backfilledBy: 1,
                        backfillVersion: 1,
                        backfillReason: 1
                    },
                    isHalfDay: false,
                    attendanceStatus: 'Present', // Default back to Present
                    halfDayReasonCode: null,
                    halfDayReasonText: '',
                    halfDaySource: null
                };
                
                await AttendanceLog.findByIdAndUpdate(record._id, revertData, { session });
                console.log(`✅ Reverted ${record.attendanceDate} for user ${record.user}`);
            }
            
            console.log('✅ Rollback completed successfully!');
        });
        
    } catch (error) {
        console.error('❌ Rollback failed:', error);
        throw error;
    } finally {
        await session.endSession();
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        await connectDB();
        
        const args = process.argv.slice(2);
        
        if (args.includes('--rollback')) {
            await rollbackBackfill();
        } else if (args.includes('--execute')) {
            CONFIG.DRY_RUN = false;
            await backfillHistoricalHalfDayRecords();
        } else {
            // Default: dry-run
            await backfillHistoricalHalfDayRecords();
        }
        
    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('📝 Database connection closed');
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

module.exports = {
    backfillHistoricalHalfDayRecords,
    rollbackBackfill,
    CONFIG,
    stats
};