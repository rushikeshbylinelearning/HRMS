// backend/scripts/backfill-insufficient-hours-half-day.js
/**
 * INSUFFICIENT WORKING HOURS HALF-DAY BACKFILL SCRIPT
 * 
 * OBJECTIVE: Safely backfill historical attendance records where employees
 * worked < 8 hours (480 minutes) but were not marked as Half Day.
 * 
 * CRITICAL SAFETY RULES:
 * ❌ DO NOT modify holidays, weekly offs, approved leaves
 * ❌ DO NOT modify admin overridden records
 * ❌ DO NOT modify records already marked Half Day
 * ❌ DO NOT delete or recreate logs
 * ❌ DO NOT touch session timestamps
 * 
 * This is a SAFE, IDEMPOTENT BACKFILL that only corrects eligible records.
 */

const mongoose = require('mongoose');
const connectDB = require('../db');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const { resolveAttendanceStatus } = require('../utils/attendanceStatusResolver');
const { getISTDateString, parseISTDate } = require('../utils/istTime');

// Configuration
const CONFIG = {
    DRY_RUN: true, // MANDATORY: Start with dry-run
    BATCH_SIZE: 50, // Smaller batches for safety
    MIN_WORKING_MINUTES: 480, // 8 hours threshold
    VERBOSE_LOGGING: true,
    DATE_RANGE: {
        startDate: null, // '2024-01-01' or null for no limit
        endDate: null    // '2024-12-31' or null for no limit
    }
};

// Backfill metadata
const BACKFILL_METADATA = {
    backfilledBy: 'SYSTEM_BACKFILL_2026_INSUFFICIENT_HOURS',
    backfillVersion: 'v1.0',
    backfillReason: 'Historical insufficient working hours correction'
};

// Statistics tracking
const stats = {
    totalScanned: 0,
    eligibleRecords: 0,
    alreadyHalfDay: 0,
    adminOverridden: 0,
    leaveRecords: 0,
    holidayWeeklyOff: 0,
    sufficientHours: 0,
    noSessions: 0,
    updated: 0,
    errors: 0,
    errorDetails: []
};

/**
 * Calculate total worked minutes from attendance sessions
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
    return Math.round(totalMinutes);
}

/**
 * Format worked time as "Xh Ym"
 */
function formatWorkedTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (minutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
}

/**
 * Check if record is eligible for backfill
 */
async function isEligibleForBackfill(log, sessions) {
    try {
        // Rule 1: Skip if already marked as half-day
        if (log.isHalfDay === true) {
            stats.alreadyHalfDay++;
            return { eligible: false, reason: 'Already marked as half-day' };
        }
        
        // Rule 2: Skip if admin overridden
        if (log.overriddenByAdmin === true) {
            stats.adminOverridden++;
            return { eligible: false, reason: 'Admin overridden - protected' };
        }
        
        // Rule 3: Skip if leave record
        if (log.attendanceStatus === 'Leave' || log.leaveRequest) {
            stats.leaveRecords++;
            return { eligible: false, reason: 'Leave record' };
        }
        
        // Rule 4: Must have clock-in time (working day)
        if (!log.clockInTime) {
            return { eligible: false, reason: 'No clock-in time (absent day)' };
        }
        
        // Rule 5: Must have sessions to calculate worked time
        if (!sessions || sessions.length === 0) {
            stats.noSessions++;
            return { eligible: false, reason: 'No attendance sessions' };
        }
        
        // Rule 6: Calculate total worked minutes
        const totalWorkedMinutes = calculateTotalWorkedMinutes(sessions);
        
        // Rule 7: Must have insufficient working hours
        if (totalWorkedMinutes >= CONFIG.MIN_WORKING_MINUTES) {
            stats.sufficientHours++;
            return { 
                eligible: false, 
                reason: 'Sufficient working hours',
                totalWorkedMinutes
            };
        }
        
        // Rule 8: Use resolver to check if it's a working day
        const user = await User.findById(log.user);
        if (!user) {
            return { eligible: false, reason: 'User not found' };
        }
        
        // Get leave request if referenced
        let leaveRequest = null;
        if (log.leaveRequest) {
            leaveRequest = await LeaveRequest.findById(log.leaveRequest);
        }
        
        // Use resolver to determine if this should be a working day
        const resolvedStatus = resolveAttendanceStatus({
            attendanceDate: log.attendanceDate,
            attendanceLog: log,
            holidays: [], // Simplified for eligibility check
            leaveRequest: leaveRequest,
            saturdayPolicy: user.alternateSaturdayPolicy || 'All Saturdays Working'
        });
        
        // Rule 9: Skip if holiday or weekly off
        if (resolvedStatus.isHoliday || resolvedStatus.isWeeklyOff) {
            stats.holidayWeeklyOff++;
            return { 
                eligible: false, 
                reason: resolvedStatus.isHoliday ? 'Holiday' : 'Weekly off',
                totalWorkedMinutes
            };
        }
        
        // Rule 10: Skip if leave day
        if (resolvedStatus.isLeave) {
            stats.leaveRecords++;
            return { 
                eligible: false, 
                reason: 'Leave day',
                totalWorkedMinutes
            };
        }
        
        // Eligible for backfill
        stats.eligibleRecords++;
        return { 
            eligible: true, 
            reason: 'INSUFFICIENT_WORKING_HOURS',
            totalWorkedMinutes,
            user
        };
        
    } catch (error) {
        console.error(`Error checking eligibility for log ${log._id}:`, error.message);
        return { eligible: false, reason: `Error: ${error.message}` };
    }
}

/**
 * Process a single attendance record
 */
async function processAttendanceRecord(log, session) {
    try {
        stats.totalScanned++;
        
        if (CONFIG.VERBOSE_LOGGING && stats.totalScanned % 100 === 0) {
            console.log(`📊 Processed ${stats.totalScanned} records...`);
        }
        
        // Get sessions for this log
        const sessions = await AttendanceSession.find({ 
            attendanceLog: log._id 
        }).session(session);
        
        // Check eligibility
        const eligibility = await isEligibleForBackfill(log, sessions);
        
        if (!eligibility.eligible) {
            if (CONFIG.VERBOSE_LOGGING && eligibility.totalWorkedMinutes !== undefined) {
                const workedTime = formatWorkedTime(eligibility.totalWorkedMinutes);
                console.log(`⏭️  Skipping ${log.attendanceDate}: ${eligibility.reason} (worked: ${workedTime})`);
            }
            return null;
        }
        
        // Generate reason text
        const workedTime = formatWorkedTime(eligibility.totalWorkedMinutes);
        const reasonText = `Worked ${workedTime}, minimum required is 8h`;
        
        const updateData = {
            status: 'Half Day',
            isHalfDay: true,
            attendanceStatus: 'Half-day',
            halfDayReasonCode: 'INSUFFICIENT_WORKING_HOURS',
            halfDayReasonText: reasonText,
            halfDaySource: 'AUTO',
            // Backfill metadata
            backfilledAt: new Date(),
            backfilledBy: BACKFILL_METADATA.backfilledBy,
            backfillVersion: BACKFILL_METADATA.backfillVersion,
            backfillReason: BACKFILL_METADATA.backfillReason
        };
        
        const userName = eligibility.user.fullName || eligibility.user.email || 'Unknown';
        console.log(`✅ ${CONFIG.DRY_RUN ? '[DRY-RUN] ' : ''}${userName} (${log.attendanceDate}): ${reasonText}`);
        
        if (!CONFIG.DRY_RUN) {
            await AttendanceLog.findByIdAndUpdate(
                log._id,
                updateData,
                { session }
            );
            stats.updated++;
        }
        
        return {
            logId: log._id,
            userId: log.user,
            userName: userName,
            attendanceDate: log.attendanceDate,
            totalWorkedMinutes: eligibility.totalWorkedMinutes,
            workedTime: workedTime,
            reasonText: reasonText,
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
        // Must have clock-in time (working day)
        clockInTime: { $exists: true, $ne: null },
        
        // Must NOT already be half-day
        isHalfDay: { $ne: true },
        
        // Must NOT be admin overridden
        overriddenByAdmin: { $ne: true },
        
        // Must NOT be leave records
        attendanceStatus: { $ne: 'Leave' },
        leaveRequest: { $exists: false },
        
        // Must NOT be already backfilled
        backfilledBy: { $ne: BACKFILL_METADATA.backfilledBy }
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
async function backfillInsufficientHoursRecords() {
    console.log('🚀 Starting Insufficient Working Hours Half-Day Backfill...');
    console.log(`📋 Mode: ${CONFIG.DRY_RUN ? 'DRY-RUN (no changes will be made)' : 'LIVE EXECUTION'}`);
    console.log(`📅 Date Range: ${CONFIG.DATE_RANGE.startDate || 'All'} to ${CONFIG.DATE_RANGE.endDate || 'All'}`);
    console.log(`⚙️  Batch Size: ${CONFIG.BATCH_SIZE}`);
    console.log(`⏰ Min Working Minutes: ${CONFIG.MIN_WORKING_MINUTES} (${CONFIG.MIN_WORKING_MINUTES / 60}h)`);
    
    const session = await mongoose.startSession();
    
    try {
        await session.withTransaction(async () => {
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
                    const result = await processAttendanceRecord(log, session);
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
            console.log(`Already Half-Day: ${stats.alreadyHalfDay}`);
            console.log(`Admin Overridden (Protected): ${stats.adminOverridden}`);
            console.log(`Leave Records (Skipped): ${stats.leaveRecords}`);
            console.log(`Holiday/Weekly Off (Skipped): ${stats.holidayWeeklyOff}`);
            console.log(`Sufficient Hours (Skipped): ${stats.sufficientHours}`);
            console.log(`No Sessions (Skipped): ${stats.noSessions}`);
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
                    console.log(`  - ${record.userName} (${record.attendanceDate}): ${record.workedTime} → Half Day`);
                });
                
                // Group by employee for summary
                const employeeSummary = {};
                processedRecords.forEach(record => {
                    if (!employeeSummary[record.userName]) {
                        employeeSummary[record.userName] = {
                            count: 0,
                            dates: []
                        };
                    }
                    employeeSummary[record.userName].count++;
                    employeeSummary[record.userName].dates.push(record.attendanceDate);
                });
                
                console.log(`\n👥 EMPLOYEE SUMMARY:`);
                Object.entries(employeeSummary).forEach(([name, summary]) => {
                    console.log(`  - ${name}: ${summary.count} records`);
                    if (summary.count <= 5) {
                        console.log(`    Dates: ${summary.dates.join(', ')}`);
                    } else {
                        console.log(`    Dates: ${summary.dates.slice(0, 3).join(', ')} ... and ${summary.count - 3} more`);
                    }
                });
            }
            
            if (CONFIG.DRY_RUN) {
                console.log('\n🔄 This was a DRY-RUN. No changes were made.');
                console.log('💡 Set CONFIG.DRY_RUN = false to execute the backfill.');
            } else {
                console.log('\n✅ Backfill completed successfully!');
                console.log('🔍 Run validation script to verify results.');
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
            await backfillInsufficientHoursRecords();
        } else {
            // Default: dry-run
            await backfillInsufficientHoursRecords();
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
    backfillInsufficientHoursRecords,
    rollbackBackfill,
    CONFIG,
    stats
};