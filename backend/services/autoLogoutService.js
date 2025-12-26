// backend/services/autoLogoutService.js
/**
 * Intelligent Auto Logout Service
 * 
 * This service enforces automatic logout for employees who forget to log out.
 * It runs as a backend cron job and does NOT depend on frontend being open.
 * 
 * Rules:
 * 1. Expected logout = shiftStart + shiftDuration + unpaidBreak + approvedOvertime (if any)
 * 2. Allow up to 1 hour overtime without auto logout
 * 3. Auto logout triggers after: expected logout + 1 hour (overtime) + 90 minutes (buffer)
 * 4. Auto logout = expected logout + 2.5 hours
 */

const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const User = require('../models/User');
const { getUserDailyStatus } = require('./dailyStatusService');

// Note: We cannot import computeCalculatedLogoutTime directly as it requires sessions/breaks arrays
// Instead, we use getUserDailyStatus which internally computes the logout time correctly

// Constants
const OVERTIME_ALLOWANCE_MINUTES = 60; // 1 hour overtime allowed
const AUTO_LOGOUT_BUFFER_MINUTES = 90; // 90 minutes buffer after expected logout + overtime
const TOTAL_AUTO_LOGOUT_DELAY_MINUTES = OVERTIME_ALLOWANCE_MINUTES + AUTO_LOGOUT_BUFFER_MINUTES; // 2.5 hours total

/**
 * Calculate expected logout time for an employee based on their shift and breaks
 * Uses getUserDailyStatus which contains the authoritative logout calculation logic
 */
const calculateExpectedLogoutTime = async (userId, attendanceDate) => {
    try {
        // Get daily status which includes the calculated logout time
        // This uses the same logic as the frontend and ensures consistency
        const dailyStatus = await getUserDailyStatus(
            userId,
            attendanceDate,
            { includeSessions: true, includeBreaks: true, includeAutoBreak: true }
        );

        if (dailyStatus && dailyStatus.calculatedLogoutTime) {
            return new Date(dailyStatus.calculatedLogoutTime);
        }

        return null;
    } catch (error) {
        console.error('[autoLogoutService] Error calculating expected logout time:', error);
        return null;
    }
};

/**
 * Calculate auto logout threshold time
 * Auto logout time = expected logout + overtime allowance + buffer
 */
const calculateAutoLogoutThreshold = (expectedLogoutTime) => {
    if (!expectedLogoutTime) return null;
    
    const autoLogoutTime = new Date(expectedLogoutTime);
    autoLogoutTime.setMinutes(autoLogoutTime.getMinutes() + TOTAL_AUTO_LOGOUT_DELAY_MINUTES);
    return autoLogoutTime;
};

/**
 * Perform auto logout for a specific attendance session
 */
const performAutoLogout = async (attendanceLog, activeSession, user) => {
    try {
        const now = new Date();
        
        // End the active session
        await AttendanceSession.findByIdAndUpdate(activeSession._id, {
            $set: {
                endTime: now,
                logoutType: 'AUTO',
                autoLogoutReason: `Auto-logged out after exceeding expected logout time + ${TOTAL_AUTO_LOGOUT_DELAY_MINUTES} minutes buffer`
            }
        });

        // Recalculate total working hours
        const allSessions = await AttendanceSession.find({ attendanceLog: attendanceLog._id }).sort({ startTime: 1 });
        const breaks = await BreakLog.find({ attendanceLog: attendanceLog._id });

        let totalWorkingMinutes = 0;
        let totalBreakMinutes = 0;

        // Calculate total session time
        allSessions.forEach(session => {
            if (session.endTime) {
                totalWorkingMinutes += (session.endTime - session.startTime) / (1000 * 60);
            }
        });

        // Calculate total break time
        breaks.forEach(breakLog => {
            if (breakLog.endTime) {
                totalBreakMinutes += (breakLog.endTime - breakLog.startTime) / (1000 * 60);
            }
        });

        // Net working hours (excluding breaks)
        const netWorkingMinutes = Math.max(0, totalWorkingMinutes - totalBreakMinutes);
        const totalWorkingHours = netWorkingMinutes / 60;

        // Update attendance log with clock-out time and auto-logout info
        await AttendanceLog.findByIdAndUpdate(attendanceLog._id, {
            $set: {
                clockOutTime: now,
                totalWorkingHours: totalWorkingHours,
                logoutType: 'AUTO',
                autoLogoutReason: `Auto-logged out after exceeding expected logout time + ${TOTAL_AUTO_LOGOUT_DELAY_MINUTES} minutes buffer`
            }
        });

        console.log(`[autoLogoutService] ✅ Auto-logged out user ${user.fullName} (${user.email}) at ${now.toISOString()}`);
        console.log(`[autoLogoutService] Total working hours: ${totalWorkingHours.toFixed(2)}h`);

        return true;
    } catch (error) {
        console.error(`[autoLogoutService] ❌ Error performing auto-logout for user ${user?.email}:`, error);
        return false;
    }
};

/**
 * Check and auto-logout employees who have exceeded their logout threshold
 * This is the main function called by the cron job
 */
const checkAndAutoLogout = async () => {
    console.log(`[autoLogoutService] 🔍 Running auto-logout check at ${new Date().toISOString()}`);

    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
        console.log('[autoLogoutService] Database not connected, skipping auto-logout check');
        return;
    }

    try {
        const now = new Date();

        // Find all attendance logs with active sessions (no clockOutTime and active session)
        const activeAttendanceLogs = await AttendanceLog.find({
            clockOutTime: null // Not yet logged out
        }).populate('user').lean();

        if (!activeAttendanceLogs || activeAttendanceLogs.length === 0) {
            console.log('[autoLogoutService] No active attendance sessions found');
            return;
        }

        console.log(`[autoLogoutService] Found ${activeAttendanceLogs.length} active attendance log(s) to check`);

        let autoLogoutCount = 0;
        let skippedCount = 0;

        for (const attendanceLog of activeAttendanceLogs) {
            try {
                // Skip if user is not found or inactive
                if (!attendanceLog.user || !attendanceLog.user.isActive) {
                    skippedCount++;
                    continue;
                }

                // Get active session for this attendance log
                const activeSession = await AttendanceSession.findOne({
                    attendanceLog: attendanceLog._id,
                    endTime: null // Still active
                }).lean();

                if (!activeSession) {
                    // No active session, but clockOutTime is null - might be data inconsistency
                    // Skip this for now
                    skippedCount++;
                    continue;
                }

                // Populate user with shift group
                const user = await User.findById(attendanceLog.user._id || attendanceLog.user).populate('shiftGroup');
                if (!user || !user.shiftGroup) {
                    console.log(`[autoLogoutService] ⚠️ User ${attendanceLog.user?.email || 'unknown'} has no shift assigned, skipping`);
                    skippedCount++;
                    continue;
                }

                // Calculate expected logout time using the daily status service
                // This ensures we use the same calculation logic as everywhere else
                const expectedLogoutTime = await calculateExpectedLogoutTime(
                    user._id,
                    attendanceLog.attendanceDate
                );

                if (!expectedLogoutTime) {
                    console.log(`[autoLogoutService] ⚠️ Could not calculate expected logout time for user ${user.email}, skipping`);
                    skippedCount++;
                    continue;
                }

                // Calculate auto logout threshold
                const autoLogoutThreshold = calculateAutoLogoutThreshold(expectedLogoutTime);

                if (!autoLogoutThreshold) {
                    skippedCount++;
                    continue;
                }

                // Check if current time has exceeded the auto-logout threshold
                if (now >= autoLogoutThreshold) {
                    console.log(`[autoLogoutService] ⏰ User ${user.email} exceeded auto-logout threshold`);
                    console.log(`[autoLogoutService] Expected logout: ${expectedLogoutTime.toISOString()}`);
                    console.log(`[autoLogoutService] Auto-logout threshold: ${autoLogoutThreshold.toISOString()}`);
                    console.log(`[autoLogoutService] Current time: ${now.toISOString()}`);
                    
                    // Perform auto logout
                    const success = await performAutoLogout(attendanceLog, activeSession, user);
                    if (success) {
                        autoLogoutCount++;
                    }
                } else {
                    // Not yet time for auto-logout
                    const minutesUntilAutoLogout = Math.round((autoLogoutThreshold - now) / (1000 * 60));
                    if (minutesUntilAutoLogout <= 30) {
                        // Log warning if within 30 minutes of auto-logout
                        console.log(`[autoLogoutService] ⚠️ User ${user.email} will be auto-logged out in ~${minutesUntilAutoLogout} minutes`);
                    }
                }
            } catch (error) {
                console.error(`[autoLogoutService] ❌ Error processing attendance log ${attendanceLog._id}:`, error);
                skippedCount++;
            }
        }

        console.log(`[autoLogoutService] ✅ Auto-logout check completed. Auto-logged out: ${autoLogoutCount}, Skipped: ${skippedCount}`);
    } catch (error) {
        console.error('[autoLogoutService] ❌ Error in auto-logout check:', error);
    }
};

module.exports = {
    checkAndAutoLogout,
    calculateExpectedLogoutTime,
    calculateAutoLogoutThreshold,
    performAutoLogout,
    OVERTIME_ALLOWANCE_MINUTES,
    AUTO_LOGOUT_BUFFER_MINUTES,
    TOTAL_AUTO_LOGOUT_DELAY_MINUTES
};

