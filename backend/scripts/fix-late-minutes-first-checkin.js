/**
 * Backfill tool to fix misclassified late arrivals by anchoring to the earliest session start.
 * 
 * Usage:
 *   node backend/scripts/fix-late-minutes-first-checkin.js            # all logs
 *   node backend/scripts/fix-late-minutes-first-checkin.js --date=2026-01-15
 */
const connectDB = require('../db');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const { recalculateLateStatus } = require('../services/dailyStatusService');
const mongoose = require('mongoose');

const LEGAL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs() {
    const raw = process.argv.slice(2);
    const args = {};
    raw.forEach(arg => {
        if (arg.startsWith('--date=')) {
            args.date = arg.split('=')[1];
        }
    });
    if (args.date && !LEGAL_DATE_REGEX.test(args.date)) {
        throw new Error(`Invalid date format for --date. Use YYYY-MM-DD. Got: ${args.date}`);
    }
    return args;
}

async function processLog(log) {
    try {
        const sessions = await AttendanceSession.find({ attendanceLog: log._id })
            .sort({ startTime: 1 })
            .lean();
        
        if (!sessions || sessions.length === 0) {
            console.log(`[FixLate] No sessions found for log ${log._id}`);
            return null;
        }

        const firstSession = sessions[0];
        if (!firstSession?.startTime) {
            console.log(`[FixLate] No startTime in first session for log ${log._id}`);
            return null;
        }

        const user = await User.findById(log.user).populate('shiftGroup').lean();
        if (!user) {
            console.log(`[FixLate] User not found for log ${log._id}`);
            return null;
        }

        const firstStartTime = firstSession.startTime;
        const updates = {};
        let hasUpdates = false;

        if (!log.clockInTime || new Date(log.clockInTime).getTime() !== new Date(firstStartTime).getTime()) {
            updates.clockInTime = firstStartTime;
            hasUpdates = true;
        }

        if (user.shiftGroup?.startTime && !log.overriddenByAdmin) {
            const recalculated = await recalculateLateStatus(firstStartTime, user.shiftGroup);
            if (recalculated) {
                updates.isLate = recalculated.isLate;
                updates.isHalfDay = recalculated.isHalfDay;
                updates.lateMinutes = recalculated.lateMinutes;
                updates.attendanceStatus = recalculated.attendanceStatus;
                updates.halfDayReasonCode = recalculated.isHalfDay ? recalculated.halfDayReasonCode : null;
                updates.halfDayReasonText = recalculated.isHalfDay ? recalculated.halfDayReasonText : '';
                updates.halfDaySource = recalculated.isHalfDay ? 'AUTO' : null;
                hasUpdates = true;
            }
        }

        return hasUpdates ? updates : null;
    } catch (error) {
        console.error(`[FixLate] Error processing log ${log._id}:`, error.message);
        return null;
    }
}

async function run() {
    const { date } = parseArgs();
    
    console.log('[FixLate] Connecting to database...');
    await connectDB();
    console.log('[FixLate] Connected successfully');

    const query = {};
    if (date) {
        query.attendanceDate = date;
        console.log(`[FixLate] Filtering by date: ${date}`);
    }

    // First, count total documents
    const totalCount = await AttendanceLog.countDocuments(query);
    console.log(`[FixLate] Found ${totalCount} logs to process`);

    if (totalCount === 0) {
        console.log('[FixLate] No logs found matching criteria. Exiting.');
        await mongoose.disconnect();
        return;
    }

    let processed = 0;
    let updatedCount = 0;
    let errorCount = 0;

    try {
        // Use regular find with batching instead of cursor
        const batchSize = 100;
        let skip = 0;

        while (skip < totalCount) {
            const logs = await AttendanceLog.find(query)
                .skip(skip)
                .limit(batchSize)
                .lean();

            console.log(`[FixLate] Processing batch: ${skip + 1} to ${skip + logs.length}`);

            for (const log of logs) {
                try {
                    const updates = await processLog(log);
                    if (updates) {
                        await AttendanceLog.updateOne({ _id: log._id }, { $set: updates });
                        updatedCount++;
                    }
                    processed++;
                } catch (error) {
                    console.error(`[FixLate] Error processing log ${log._id}:`, error.message);
                    errorCount++;
                    processed++;
                }

                if (processed % 100 === 0) {
                    console.log(`[FixLate] Progress: ${processed}/${totalCount} (${updatedCount} updated, ${errorCount} errors)`);
                }
            }

            skip += batchSize;
        }

        console.log(`[FixLate] Completed. Processed ${processed} logs, applied updates to ${updatedCount} logs, ${errorCount} errors.`);
    } catch (error) {
        console.error('[FixLate] Fatal error during processing:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('[FixLate] Disconnected from database');
    }
}

run().catch(err => {
    console.error('[FixLate] Fatal error:', err);
    process.exit(1);
});