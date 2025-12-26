// backend/services/dailyStatusService.js
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const ExtraBreakRequest = require('../models/ExtraBreakRequest');
const Setting = require('../models/Setting');

const DEFAULT_OPTIONS = {
    includeSessions: true,
    includeBreaks: true,
    includeRequests: true,
    includeAutoBreak: true,
};

const getShiftDateTimeIST = (onDate, shiftTime) => {
    const [hours, minutes] = shiftTime.split(':').map(Number);
    const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const [{ value: year }, , { value: month }, , { value: day }] = istDateFormatter.formatToParts(onDate);
    const shiftDateTimeISO_IST = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000+05:30`;
    return new Date(shiftDateTimeISO_IST);
};

/**
 * Recalculates late/half-day status based on current clockInTime.
 * This is the SINGLE SOURCE OF TRUTH for derived attendance status.
 * 
 * @param {Date} clockInTime - The actual clock-in time
 * @param {Object} shift - The user's shift object with startTime
 * @param {number} gracePeriodMinutes - Grace period in minutes (default: 30)
 * @returns {Object} { lateMinutes, isLate, isHalfDay, attendanceStatus }
 */
const recalculateLateStatus = async (clockInTime, shift, gracePeriodMinutes = null) => {
    if (!clockInTime || !shift || !shift.startTime) {
        return {
            lateMinutes: 0,
            isLate: false,
            isHalfDay: false,
            attendanceStatus: 'On-time'
        };
    }

    const clockIn = new Date(clockInTime);
    const shiftStartTime = getShiftDateTimeIST(clockIn, shift.startTime);
    const lateMinutes = Math.max(0, Math.floor((clockIn - shiftStartTime) / (1000 * 60)));

    // Get grace period from settings if not provided
    let GRACE_PERIOD_MINUTES = gracePeriodMinutes;
    if (GRACE_PERIOD_MINUTES === null || GRACE_PERIOD_MINUTES === undefined) {
        try {
            const graceSetting = await Setting.findOne({ key: 'lateGraceMinutes' });
            if (graceSetting && !isNaN(Number(graceSetting.value))) {
                GRACE_PERIOD_MINUTES = Number(graceSetting.value);
            } else {
                GRACE_PERIOD_MINUTES = 30; // Default
            }
        } catch (err) {
            console.error('Failed to fetch late grace setting, falling back to 30 minutes', err);
            GRACE_PERIOD_MINUTES = 30;
        }
    }

    // Consistent rules:
    // - If lateMinutes <= GRACE_PERIOD_MINUTES -> On-time (within grace period)
    // - If lateMinutes > GRACE_PERIOD_MINUTES -> Half-day
    let isLate = false;
    let isHalfDay = false;
    let attendanceStatus = 'On-time';

    if (lateMinutes <= GRACE_PERIOD_MINUTES) {
        isLate = false;
        isHalfDay = false;
        attendanceStatus = 'On-time';
    } else if (lateMinutes > GRACE_PERIOD_MINUTES) {
        isHalfDay = true;
        isLate = false;
        attendanceStatus = 'Half-day';
    }

    return {
        lateMinutes,
        isLate,
        isHalfDay,
        attendanceStatus
    };
};

const buildBaseResponse = (options) => ({
    status: 'Not Clocked In',
    hasLog: false, // CRITICAL: Explicitly set to false to prevent stale UI state
    sessions: options.includeSessions ? [] : undefined,
    breaks: options.includeBreaks ? [] : undefined,
    shift: null,
    attendanceLog: null, // CRITICAL: Must be null when no log exists
    calculatedLogoutTime: null,
    pendingExtraBreakRequest: options.includeRequests ? null : undefined,
    approvedExtraBreak: options.includeRequests ? null : undefined,
    autoBreak: options.includeAutoBreak ? null : undefined,
    activeBreak: options.includeBreaks ? null : undefined,
});

/**
 * Maps attendance log data for response.
 * NOTE: isLate, isHalfDay, lateMinutes, and attendanceStatus are NOT included here
 * because they must be recalculated from clockInTime on every request.
 * See getUserDailyStatus for recalculation logic.
 */
const mapAttendanceLog = (attendanceLog) => ({
    penaltyMinutes: attendanceLog?.penaltyMinutes || 0,
    paidBreakMinutesTaken: attendanceLog?.paidBreakMinutesTaken || 0,
    unpaidBreakMinutesTaken: attendanceLog?.unpaidBreakMinutesTaken || 0,
    // CRITICAL: Do NOT include isLate, isHalfDay, lateMinutes, attendanceStatus here
    // These must be recalculated from clockInTime on every request
});

const mapAutoBreak = (autoBreakDoc) => autoBreakDoc ? ({
    id: autoBreakDoc._id,
    startTime: autoBreakDoc.startTime,
    type: autoBreakDoc.type,
    reason: autoBreakDoc.reason,
    duration: Math.floor((Date.now() - new Date(autoBreakDoc.startTime)) / (1000 * 60)),
}) : null;

const mapActiveBreak = (breakDoc) => breakDoc ? ({
    startTime: breakDoc.startTime,
    breakType: breakDoc.breakType,
    durationMinutes: Math.floor((Date.now() - new Date(breakDoc.startTime)) / (1000 * 60)),
}) : null;

const computeCalculatedLogoutTime = (sessions, breaks, attendanceLog, userShift, activeBreak = null) => {
    if (!sessions?.length || !userShift || !attendanceLog) {
        return null;
    }

    const firstClockInSession = sessions[0];
    const clockInTime = new Date(firstClockInSession.startTime);
    
    // Constants for shift calculation
    // Use the shift's paidBreakMinutes if available, otherwise default to 30 minutes
    const EXPECTED_BREAK_MINUTES = userShift.paidBreakMinutes || 30;
    const SHIFT_TOTAL_MINUTES = 9 * 60; // 540 minutes (9 hours total shift duration)
    
    // EARLY CHECK: For 10 AM - 7 PM shift with early login and no breaks, return 7:00 PM immediately
    // This ensures the special case is handled before any other calculations
    const isSpecialShiftEarly = userShift.shiftType === 'Fixed' && 
                                userShift.startTime && 
                                (userShift.startTime === '10:00' || userShift.startTime.startsWith('10:00')) &&
                                userShift.endTime && 
                                (userShift.endTime === '19:00' || userShift.endTime === '7:00 PM' || 
                                 userShift.endTime.startsWith('19:') || userShift.endTime.startsWith('7:'));
    
    if (isSpecialShiftEarly) {
        // Get clock-in hour in IST
        const istFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const clockInParts = istFormatter.formatToParts(clockInTime);
        const clockInHour = parseInt(clockInParts.find(p => p.type === 'hour').value);
        
        // If clock-in is before 10 AM and no breaks, return 7:00 PM directly
        if (clockInHour < 10) {
            const sevenPM = getShiftDateTimeIST(clockInTime, '19:00');
            // Check if there are any breaks
            const hasPaidBreaks = (attendanceLog.paidBreakMinutesTaken || 0) > 0;
            const hasUnpaidBreaks = (attendanceLog.unpaidBreakMinutesTaken || 0) > 0;
            const hasActiveBreak = activeBreak && (activeBreak.breakType === 'Unpaid' || activeBreak.breakType === 'Extra');
            const hasAnyBreaks = hasPaidBreaks || hasUnpaidBreaks || hasActiveBreak || (breaks && breaks.length > 0);
            
            if (!hasAnyBreaks) {
                return sevenPM.toISOString();
            }
        }
    }

    // Helper function to set time on a date (in IST)
    const setTime = (date, timeString) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        return getShiftDateTimeIST(date, timeString);
    };

    // Helper function to add minutes to a date
    const addMinutes = (date, minutes) => {
        const newDate = new Date(date);
        newDate.setMinutes(newDate.getMinutes() + minutes);
        return newDate;
    };

    // Helper function to calculate minutes between two dates
    const minutesBetween = (start, end) => {
        return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    };

    // Get total paid break minutes taken (from stored value, which includes all paid breaks)
    // This is more accurate than calculating from individual break objects because:
    // 1. It accounts for multiple paid breaks correctly
    // 2. It matches what's actually stored in the database
    // 3. It handles the case where break allowance is exceeded correctly
    const totalPaidBreakMinutes = attendanceLog.paidBreakMinutesTaken || 0;
    const hasTakenPaidBreak = totalPaidBreakMinutes > 0;

    // CRITICAL FIX: Calculate actual paid break time taken from break logs
    // This includes extra paid break time beyond the allowance
    // The stored paidBreakMinutesTaken is capped at the allowance, so we need to check actual break durations
    let actualPaidBreakMinutes = 0;
    if (breaks && breaks.length > 0) {
        const paidBreaks = breaks.filter(b => 
            (b.breakType === 'Paid' || b.type === 'Paid') && b.endTime && b.durationMinutes
        );
        actualPaidBreakMinutes = paidBreaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    }
    
    // Also include active paid break if present
    let activePaidBreakMinutes = 0;
    if (activeBreak && (activeBreak.breakType === 'Paid' || activeBreak.type === 'Paid') && activeBreak.startTime) {
        const now = new Date();
        const activeBreakDurationMs = now.getTime() - new Date(activeBreak.startTime).getTime();
        activePaidBreakMinutes = Math.floor(activeBreakDurationMs / (1000 * 60));
    }
    
    const totalActualPaidBreakMinutes = actualPaidBreakMinutes + activePaidBreakMinutes;
    
    // Calculate extra paid break minutes (paid break beyond allowance)
    // These extra minutes should extend the shift, just like unpaid breaks
    const extraPaidBreakMinutes = Math.max(0, totalActualPaidBreakMinutes - EXPECTED_BREAK_MINUTES);

    // Calculate unpaid break minutes (Unpaid and Extra breaks extend the shift)
    // Active unpaid breaks ARE included in backend calculation for correct adjustment
    // Frontend will add incremental time for real-time UI updates
    const unpaidBreakMinutes = attendanceLog.unpaidBreakMinutesTaken || 0;
    let activeUnpaidBreakMinutes = 0;
    if (activeBreak && (activeBreak.breakType === 'Unpaid' || activeBreak.breakType === 'Extra') && activeBreak.startTime) {
        const now = new Date();
        const activeBreakDurationMs = now.getTime() - new Date(activeBreak.startTime).getTime();
        activeUnpaidBreakMinutes = Math.floor(activeBreakDurationMs / (1000 * 60));
    }
    
    // Add extra paid break minutes to unpaid break calculation
    // Extra paid break time (beyond allowance) should extend the shift just like unpaid breaks
    // Note: For special case (10 AM - 7 PM), we calculate this separately to avoid double-counting
    const totalUnpaidBreakMinutes = unpaidBreakMinutes + activeUnpaidBreakMinutes + extraPaidBreakMinutes;

    // SPECIAL CASE: 10 AM - 7 PM shift
    // Check for both '19:00' and '7:00 PM' formats to handle different storage formats
    // Also check for variations like '10:00 AM' or just numeric comparisons
    const startTimeMatch = userShift.startTime === '10:00' || 
                          userShift.startTime === '10:00 AM' ||
                          (typeof userShift.startTime === 'string' && userShift.startTime.startsWith('10:00'));
    const endTimeMatch = userShift.endTime === '19:00' || 
                        userShift.endTime === '7:00 PM' ||
                        userShift.endTime === '19:00:00' ||
                        (typeof userShift.endTime === 'string' && (userShift.endTime.startsWith('19:') || userShift.endTime.startsWith('7:')));
    
    const isSpecialShift = userShift.shiftType === 'Fixed' && startTimeMatch && endTimeMatch;
    
    if (isSpecialShift) {
        const tenAM = setTime(clockInTime, '10:00');
        const sevenPM = setTime(clockInTime, '19:00');
        
        // Get clock-in time in IST for comparison
        // Use the IST formatter to get the actual time in IST timezone
        const istFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const clockInParts = istFormatter.formatToParts(clockInTime);
        const clockInHour = parseInt(clockInParts.find(p => p.type === 'hour').value);
        const clockInMinute = parseInt(clockInParts.find(p => p.type === 'minute').value);
        const isBeforeTenAM = clockInHour < 10 || (clockInHour === 10 && clockInMinute === 0 && clockInTime < tenAM);
        
        // If clock-in is before 10:00 AM, apply special case logic
        // Use both time comparison and hour-based comparison for robustness
        if (clockInTime < tenAM || isBeforeTenAM || clockInHour < 10) {
            // Constants for special case
            const PAID_BREAK_LIMIT = 30; // minutes
            const SHIFT_START = '10:00';
            
            // CRITICAL: If no breaks are taken at all, logout is always 7:00 PM
            // Early login doesn't reduce logout time when there are no breaks
            // Check both stored values and calculated values to be safe
            const hasNoBreaks = (totalActualPaidBreakMinutes === 0 || totalPaidBreakMinutes === 0) && 
                               unpaidBreakMinutes === 0 && 
                               activeUnpaidBreakMinutes === 0 &&
                               (!breaks || breaks.length === 0);
            
            if (hasNoBreaks) {
                return sevenPM.toISOString();
            }
            
            // Calculate early login buffer (minutes before 10 AM)
            const earlyLoginMinutes = Math.max(0, Math.floor((tenAM.getTime() - clockInTime.getTime()) / (1000 * 60)));
            
            // Break classification - use ACTUAL paid break minutes (includes extra beyond allowance)
            // PaidBreakUsed = min(totalActualPaidBreakTaken, 30)
            const paidBreakUsed = Math.min(totalActualPaidBreakMinutes, PAID_BREAK_LIMIT);
            
            // ExtraPaidBreak = max(totalActualPaidBreakTaken - 30, 0)
            const extraPaidBreak = Math.max(totalActualPaidBreakMinutes - PAID_BREAK_LIMIT, 0);
            
            // UnpaidBreak = unpaidBreakTaken (NOT including extraPaidBreakMinutes to avoid double-counting)
            const unpaidBreak = unpaidBreakMinutes + activeUnpaidBreakMinutes;
            
            // TotalExtraBreak = ExtraPaidBreak + UnpaidBreak
            const totalExtraBreak = extraPaidBreak + unpaidBreak;
            
            // Adjustment calculation: net excess break after early login buffer
            // The early login buffer can offset extra breaks, but should never reduce logout below 7 PM
            // AdjustmentMinutes = max(TotalExtraBreak - EarlyLoginMinutes, 0)
            const adjustmentMinutes = Math.max(totalExtraBreak - earlyLoginMinutes, 0);
            
            // CRITICAL: For 10 AM - 7 PM shift with early login, logout should NEVER go below 7 PM
            // The early login buffer only offsets extra breaks, it doesn't reduce the base logout time
            // Final logout time: 7:00 PM + adjustment (never earlier than 7 PM)
            const finalLogout = addMinutes(sevenPM, adjustmentMinutes);
            
            // Double-check: ensure logout is never before 7 PM (safety check)
            if (finalLogout < sevenPM) {
                return sevenPM.toISOString();
            }
            
            return finalLogout.toISOString();
        }
        
        // If clock-in is at or after 10:00 AM, ensure logout never goes below 7 PM
        // Calculate base logout time using normal 9-hour logic
        let baseLogout;
        if (!hasTakenPaidBreak && totalActualPaidBreakMinutes === 0) {
            // No break taken yet → clockIn + 9 hours
            baseLogout = addMinutes(clockInTime, SHIFT_TOTAL_MINUTES);
        } else {
            // Break taken → adjust logout based on actual total paid break minutes taken (up to allowance)
            // Use the minimum of actual paid break and allowance for the base calculation
            const paidBreakUsed = Math.min(totalActualPaidBreakMinutes, EXPECTED_BREAK_MINUTES);
            const savedBreak = EXPECTED_BREAK_MINUTES - paidBreakUsed; // positive = saved, negative = extra
            baseLogout = addMinutes(clockInTime, SHIFT_TOTAL_MINUTES - savedBreak);
        }
        
        // CRITICAL: For 10 AM - 7 PM shift, logout time should NEVER go below 7 PM
        // If calculated logout is before 7 PM, set it to 7 PM
        if (baseLogout < sevenPM) {
            baseLogout = sevenPM;
        }
        
        // Add unpaid break extension (this includes extra paid break minutes beyond allowance)
        // This will extend beyond 7 PM if more break is taken
        if (totalUnpaidBreakMinutes > 0) {
            return addMinutes(baseLogout, totalUnpaidBreakMinutes).toISOString();
        }
        return baseLogout.toISOString();
    }

    // GENERAL RULE for all other shifts
    // For Fixed shifts
    if (userShift.shiftType === 'Fixed' && userShift.startTime && userShift.endTime) {
        const shiftStartTime = getShiftDateTimeIST(clockInTime, userShift.startTime);
        const shiftEndTime = getShiftDateTimeIST(clockInTime, userShift.endTime);
        if (shiftEndTime < shiftStartTime) {
            shiftEndTime.setDate(shiftEndTime.getDate() + 1);
        }
        
        // Before break: requiredLogout = clockIn + 9 hours
        // After break: requiredLogout = clockIn + 9 hours - (expectedBreak - actualBreak)
        // Note: Lateness is already accounted for by calculating from actual clock-in time,
        // so we don't add a lateness penalty. Employee works the standard 9 hours from when they clock in.
        let baseLogoutTime;
        
        if (!hasTakenPaidBreak && totalActualPaidBreakMinutes === 0) {
            // No paid break taken yet
            baseLogoutTime = addMinutes(clockInTime, SHIFT_TOTAL_MINUTES);
        } else {
            // Paid break taken → adjust logout based on actual total paid break minutes taken (up to allowance)
            // Use the minimum of actual paid break and allowance for the base calculation
            const paidBreakUsed = Math.min(totalActualPaidBreakMinutes, EXPECTED_BREAK_MINUTES);
            const savedBreak = EXPECTED_BREAK_MINUTES - paidBreakUsed;
            baseLogoutTime = addMinutes(clockInTime, SHIFT_TOTAL_MINUTES - savedBreak);
        }
        
        // CRITICAL: For 10 AM - 7 PM shift, ensure logout never goes below 7 PM
        // This check applies even if the special case above didn't match (e.g., due to format differences)
        if (userShift.startTime === '10:00' && (userShift.endTime === '19:00' || userShift.endTime === '7:00 PM')) {
            const sevenPM = setTime(clockInTime, '19:00');
            if (baseLogoutTime < sevenPM) {
                baseLogoutTime = sevenPM;
            }
        }
        
        // Add unpaid break extension (includes extra paid break minutes beyond allowance)
        if (totalUnpaidBreakMinutes > 0) {
            baseLogoutTime = addMinutes(baseLogoutTime, totalUnpaidBreakMinutes);
        }
        
        return baseLogoutTime.toISOString();
    } 
    // For Flexible shifts, use 9-hour logic with break adjustment
    else if (userShift.shiftType === 'Flexible' && userShift.durationHours) {
        // If break not taken yet → no break deduction
        if (!hasTakenPaidBreak && totalActualPaidBreakMinutes === 0) {
            const baseLogout = addMinutes(clockInTime, SHIFT_TOTAL_MINUTES);
            // Add unpaid break extension
            if (totalUnpaidBreakMinutes > 0) {
                return addMinutes(baseLogout, totalUnpaidBreakMinutes).toISOString();
            }
            return baseLogout.toISOString();
        }
        
        // Break taken → adjust logout based on actual total paid break minutes taken (up to allowance)
        // Use the minimum of actual paid break and allowance for the base calculation
        const paidBreakUsed = Math.min(totalActualPaidBreakMinutes, EXPECTED_BREAK_MINUTES);
        const savedBreak = EXPECTED_BREAK_MINUTES - paidBreakUsed; // positive = saved, negative = extra
        
        const baseLogout = addMinutes(clockInTime, SHIFT_TOTAL_MINUTES - savedBreak);
        // Add unpaid break extension (includes extra paid break minutes beyond allowance)
        if (totalUnpaidBreakMinutes > 0) {
            return addMinutes(baseLogout, totalUnpaidBreakMinutes).toISOString();
        }
        return baseLogout.toISOString();
    }

    return null;
};

const getUserDailyStatus = async (userId, targetDate, options = {}) => {
    const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
    const response = buildBaseResponse(resolvedOptions);

    const user = await User.findById(userId).populate('shiftGroup').lean();
    if (!user) {
        return response;
    }

    response.shift = user.shiftGroup || null;

    const attendanceLog = await AttendanceLog.findOne({ user: userId, attendanceDate: targetDate }).lean();
    if (!attendanceLog) {
        // HARD RULE: When no attendance log exists, explicitly set all flags to false/null
        // This prevents ANY late/half-day logic from executing without a log
        // CRITICAL: Do NOT compute lateness based on shift start time alone
        response.hasLog = false;
        response.attendanceLog = null; // Must be null, not undefined
        response.sessions = resolvedOptions.includeSessions ? [] : undefined;
        response.breaks = resolvedOptions.includeBreaks ? [] : undefined;
        response.status = 'Not Clocked In';
        response.calculatedLogoutTime = null;
        // Ensure no late/half-day flags leak through
        // (already null from buildBaseResponse, but being explicit)
        return response;
    }

    // ONLY reach here if attendance log exists
    // Log exists - set hasLog to true and map attendance data
    response.hasLog = true;
    response.attendanceLog = mapAttendanceLog(attendanceLog);

    // CRITICAL: Recalculate late/half-day status from CURRENT clockInTime
    // This ensures admin edits to clockInTime immediately affect the response
    if (attendanceLog.clockInTime && response.shift && response.shift.startTime) {
        const recalculatedStatus = await recalculateLateStatus(
            attendanceLog.clockInTime,
            response.shift
        );
        // Override stored values with recalculated values
        response.attendanceLog.isLate = recalculatedStatus.isLate;
        response.attendanceLog.isHalfDay = recalculatedStatus.isHalfDay;
        response.attendanceLog.lateMinutes = recalculatedStatus.lateMinutes;
        response.attendanceLog.attendanceStatus = recalculatedStatus.attendanceStatus;
    } else {
        // Fallback if shift or clockInTime is missing
        response.attendanceLog.isLate = false;
        response.attendanceLog.isHalfDay = false;
        response.attendanceLog.lateMinutes = 0;
        response.attendanceLog.attendanceStatus = 'On-time';
    }

    let sessions = [];
    if (resolvedOptions.includeSessions) {
        sessions = await AttendanceSession.find({ attendanceLog: attendanceLog._id }).sort({ startTime: 1 }).lean();
        response.sessions = sessions;
    }

    let breaks = [];
    if (resolvedOptions.includeBreaks) {
        breaks = await BreakLog.find({ attendanceLog: attendanceLog._id }).sort({ startTime: 1 }).lean();
        response.breaks = breaks;
        const activeBreakDoc = breaks.find(b => !b.endTime);
        response.activeBreak = mapActiveBreak(activeBreakDoc);
    }

    let autoBreakDoc = null;
    if (resolvedOptions.includeAutoBreak) {
        autoBreakDoc = await BreakLog.findOne({
            userId,
            endTime: null,
            isAutoBreak: true,
        }).sort({ startTime: 1 }).lean();
        response.autoBreak = mapAutoBreak(autoBreakDoc);
    }

    if (resolvedOptions.includeRequests) {
        response.pendingExtraBreakRequest = await ExtraBreakRequest.findOne({
            user: userId,
            attendanceDate: targetDate,
            status: 'Pending',
        }).lean();
        response.approvedExtraBreak = await ExtraBreakRequest.findOne({
            user: userId,
            attendanceDate: targetDate,
            status: 'Approved',
            isUsed: false,
        }).lean();
    }

    const hasActiveSession = sessions.some(s => !s.endTime);
    const hasManualSessions = sessions.length > 0;
    const autoBreakActive = !!response.autoBreak;
    const hasAnyActiveBreak = !!response.activeBreak || autoBreakActive;

    if (hasAnyActiveBreak) {
        response.status = autoBreakActive ? 'On Auto-Break' : 'On Break';
    } else if (hasActiveSession) {
        response.status = 'Clocked In';
    } else if (hasManualSessions) {
        response.status = 'Clocked Out';
    } else {
        response.status = 'Not Clocked In';
    }

    // Pass activeBreak to the calculation function
    response.calculatedLogoutTime = computeCalculatedLogoutTime(sessions, breaks, response.attendanceLog, response.shift, response.activeBreak);

    return response;
};

module.exports = {
    getUserDailyStatus,
    computeCalculatedLogoutTime, // Export for testing
    recalculateLateStatus, // Export for use in admin routes
};

