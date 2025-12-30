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
    logoutType: attendanceLog?.logoutType || 'MANUAL',
    autoLogoutReason: attendanceLog?.autoLogoutReason || null,
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

/**
 * Calculate required logout time based on POLICY RULES:
 * 
 * 1. Base Rule: loginTime + 9 hours (always applies)
 * 2. Paid Break Rule: If paid break > 30 minutes, add excess to logout time
 * 3. Unpaid Break Rule: Add full unpaid break duration to logout time
 * 4. Rare Exception: If no paid break taken AND unpaid break taken, treat unpaid like paid (first 30 min free)
 * 
 * All break calculations must preserve existing early logout restrictions.
 */
const computeCalculatedLogoutTime = (sessions, breaks, attendanceLog, userShift, activeBreak = null) => {
    if (!sessions?.length || !userShift || !attendanceLog) {
        return null;
    }

    const firstClockInSession = sessions[0];
    const clockInTime = new Date(firstClockInSession.startTime);
    
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
    
    // ============================================
    // RULE 1: Base Rule - Always start with loginTime + 9 hours
    // ============================================
    const SHIFT_TOTAL_MINUTES = 9 * 60; // 540 minutes (9 hours)
    let requiredLogoutTime = addMinutes(clockInTime, SHIFT_TOTAL_MINUTES);
    
    // ============================================
    // Calculate total break minutes (including active break if present)
    // ============================================
    let paidBreakMinutesTaken = attendanceLog.paidBreakMinutesTaken || 0;
    let unpaidBreakMinutesTaken = attendanceLog.unpaidBreakMinutesTaken || 0;
    
    // Include active break duration if present
    if (activeBreak && activeBreak.startTime) {
        const now = new Date();
        const activeBreakStart = new Date(activeBreak.startTime);
        const activeBreakDurationMinutes = Math.floor((now - activeBreakStart) / (1000 * 60));
        const activeBreakType = (activeBreak.breakType || activeBreak.type || '').toString().trim();
        
        if (activeBreakType === 'Paid') {
            paidBreakMinutesTaken += activeBreakDurationMinutes;
        } else if (activeBreakType === 'Unpaid' || activeBreakType === 'Extra') {
            unpaidBreakMinutesTaken += activeBreakDurationMinutes;
        }
    }
    
    // ============================================
    // RULE 2: Paid Break Rule
    // If paid break > 30 minutes, add excess to logout time
    // ============================================
    const PAID_BREAK_ALLOWANCE_MINUTES = 30;
    if (paidBreakMinutesTaken > PAID_BREAK_ALLOWANCE_MINUTES) {
        const extraPaidBreak = paidBreakMinutesTaken - PAID_BREAK_ALLOWANCE_MINUTES;
        requiredLogoutTime = addMinutes(requiredLogoutTime, extraPaidBreak);
    }
    
    // ============================================
    // RULE 3 & 4: Unpaid Break Rule OR Rare Exception
    // ============================================
    if (unpaidBreakMinutesTaken > 0) {
        // RULE 4: Rare Exception - Apply ONLY if:
        // - paidBreakMinutesTaken === 0 (no paid break taken)
        // - unpaidBreakMinutesTaken > 0 (unpaid break was taken)
        // In this case, treat unpaid break like paid break (first 30 min free)
        if (paidBreakMinutesTaken === 0) {
            // Rare exception: treat unpaid like paid
            const effectiveUnpaid = Math.max(0, unpaidBreakMinutesTaken - PAID_BREAK_ALLOWANCE_MINUTES);
            if (effectiveUnpaid > 0) {
                requiredLogoutTime = addMinutes(requiredLogoutTime, effectiveUnpaid);
            }
        } else {
            // RULE 3: Normal case - add full unpaid break duration
            requiredLogoutTime = addMinutes(requiredLogoutTime, unpaidBreakMinutesTaken);
        }
    }
    
    // ============================================
    // PRESERVE EXISTING RULE: Early logout restriction
    // For 10 AM - 7 PM shift, ensure logout never goes below 7:00 PM
    // ============================================
    const isSpecialShift = userShift.shiftType === 'Fixed' && 
                          userShift.startTime && 
                          (userShift.startTime === '10:00' || 
                           userShift.startTime === '10:00 AM' ||
                           (typeof userShift.startTime === 'string' && userShift.startTime.startsWith('10:00'))) &&
                          userShift.endTime && 
                          (userShift.endTime === '19:00' || 
                           userShift.endTime === '7:00 PM' ||
                           userShift.endTime === '19:00:00' ||
                           (typeof userShift.endTime === 'string' && (userShift.endTime.startsWith('19:') || userShift.endTime.startsWith('7:'))));
    
    if (isSpecialShift) {
        const sevenPM = setTime(clockInTime, '19:00');
        // Enforce minimum logout time: never before 7:00 PM
        if (requiredLogoutTime < sevenPM) {
            requiredLogoutTime = sevenPM;
        }
    }
    
    return requiredLogoutTime.toISOString();
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

