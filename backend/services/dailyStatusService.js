// backend/services/dailyStatusService.js
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const ExtraBreakRequest = require('../models/ExtraBreakRequest');
const Setting = require('../models/Setting');
const { getShiftDateTimeIST } = require('../utils/istTime');
const { 
    SHIFT_WORKING_MINUTES, 
    PAID_BREAK_ALLOWANCE_MINUTES,
    calculateRequiredLogoutTime 
} = require('../config/shiftPolicy');
const { getGracePeriod } = require('./gracePeriodCache');
const { getStatus, setStatus } = require('./statusCache');

const DEFAULT_OPTIONS = {
    includeSessions: true,
    includeBreaks: true,
    includeRequests: true,
    includeAutoBreak: true,
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

    // Get grace period from cache if not provided
    let GRACE_PERIOD_MINUTES = gracePeriodMinutes;
    if (GRACE_PERIOD_MINUTES === null || GRACE_PERIOD_MINUTES === undefined) {
        try {
            // Use cached grace period (1-hour TTL, safe fallback)
            GRACE_PERIOD_MINUTES = await getGracePeriod();
        } catch (err) {
            console.error('Failed to fetch grace period from cache, falling back to 30 minutes', err);
            GRACE_PERIOD_MINUTES = 30;
        }
    }

    // Consistent rules:
    // - If lateMinutes <= GRACE_PERIOD_MINUTES -> On-time (within grace period)
    // - If lateMinutes > GRACE_PERIOD_MINUTES -> Half-day AND Late (for tracking/notifications)
    let isLate = false;
    let isHalfDay = false;
    let attendanceStatus = 'On-time';
    let halfDayReasonCode = null;
    let halfDayReasonText = '';

    if (lateMinutes <= GRACE_PERIOD_MINUTES) {
        isLate = false;
        isHalfDay = false;
        attendanceStatus = 'On-time';
    } else if (lateMinutes > GRACE_PERIOD_MINUTES) {
        isHalfDay = true;
        isLate = true; // FIX: Set isLate=true for tracking and notifications
        attendanceStatus = 'Half-day';
        halfDayReasonCode = 'LATE_LOGIN';
        const clockInTimeStr = clockInTime.toLocaleTimeString('en-US', { 
            timeZone: 'Asia/Kolkata',
            hour12: true, 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        halfDayReasonText = `Late login beyond ${GRACE_PERIOD_MINUTES} min grace period (logged at ${clockInTimeStr}, ${lateMinutes} minutes late)`;
    }

    return {
        lateMinutes,
        isLate,
        isHalfDay,
        attendanceStatus,
        halfDayReasonCode,
        halfDayReasonText
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
 * Calculate required logout time based on POLICY RULES (AUTHORITATIVE BACKEND CALCULATION)
 * 
 * POLICY:
 * - Shift working time: 8.5 hours (510 minutes)
 * - Allowed paid break: 30 minutes (included in shift)
 * - Required logout = clockInTime + working time + excess paid break + unpaid break
 * 
 * RULES:
 * 1. Base: clockInTime + 8.5 hours working time
 * 2. Paid break > 30 min → excess extends logout time
 * 3. All unpaid break time extends logout time
 * 
 * Returns both the logout time and breakdown metadata for UI display.
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
    // Calculate total break minutes from breaks array (AUTHORITATIVE SOURCE)
    // CRITICAL: Aggregate from breaks array instead of database field
    // This ensures we get the actual break durations, not capped/stale values
    // ============================================
    let paidBreakMinutesTaken = 0;
    let unpaidBreakMinutesTaken = 0;
    
    // Aggregate break minutes from breaks array (source of truth)
    if (breaks && Array.isArray(breaks)) {
        breaks.forEach(breakItem => {
            // Only count completed breaks (those with endTime)
            if (breakItem.endTime && breakItem.startTime) {
                const breakStart = new Date(breakItem.startTime);
                const breakEnd = new Date(breakItem.endTime);
                const durationMinutes = Math.round((breakEnd - breakStart) / (1000 * 60));
                
                // Handle both breakType and type for backward compatibility
                const breakType = (breakItem.breakType || breakItem.type || 'Unpaid').toString().trim();
                
                // Match breakType exactly (case-sensitive) as stored in database
                if (breakType === 'Paid') {
                    paidBreakMinutesTaken += durationMinutes;
                } else if (breakType === 'Unpaid' || breakType === 'Extra') {
                    unpaidBreakMinutesTaken += durationMinutes;
                }
            }
        });
    }
    
    // Fallback: If no breaks array provided or breaks array is empty, use database field (backward compatibility)
    // This ensures backward compatibility if breaks are not included in the query
    if ((!breaks || !Array.isArray(breaks) || breaks.length === 0) && paidBreakMinutesTaken === 0 && unpaidBreakMinutesTaken === 0) {
        paidBreakMinutesTaken = attendanceLog.paidBreakMinutesTaken || 0;
        unpaidBreakMinutesTaken = attendanceLog.unpaidBreakMinutesTaken || 0;
    }
    
    // Include active break duration if present (for real-time calculation)
    if (activeBreak && activeBreak.startTime) {
        const { getISTNow } = require('../utils/istTime');
        const now = getISTNow();
        const activeBreakStart = new Date(activeBreak.startTime);
        const activeBreakDurationMinutes = Math.floor((now - activeBreakStart) / (1000 * 60));
        const activeBreakType = (activeBreak.breakType || activeBreak.type || '').toString().trim();
        
        if (activeBreakType === 'Paid') {
            paidBreakMinutesTaken += activeBreakDurationMinutes;
        } else if (activeBreakType === 'Unpaid' || activeBreakType === 'Extra') {
            unpaidBreakMinutesTaken += activeBreakDurationMinutes;
        }
    }
    
    // DEBUG: Log calculated values
    console.log('[computeCalculatedLogoutTime] Aggregated break values:', {
        paidBreakMinutesTaken,
        unpaidBreakMinutesTaken,
        breaksCount: breaks?.length || 0,
        clockInTime: clockInTime.toISOString()
    });
    
    // ============================================
    // USE AUTHORITATIVE POLICY CALCULATION
    // ============================================
    const result = calculateRequiredLogoutTime(
        clockInTime,
        paidBreakMinutesTaken,
        unpaidBreakMinutesTaken
    );
    
    if (!result) {
        console.log('[computeCalculatedLogoutTime] calculateRequiredLogoutTime returned null');
        return null;
    }
    
    // DEBUG: Log calculation result
    console.log('[computeCalculatedLogoutTime] Calculation result:', {
        paidBreakMinutesTaken,
        unpaidBreakMinutesTaken,
        excessPaidBreak: result.breakdown.excessPaidBreakMinutes,
        totalExtension: result.breakdown.totalExtensionMinutes,
        requiredLogoutTime: result.requiredLogoutTime.toISOString(),
        requiredLogoutTimeIST: result.requiredLogoutTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
    
    let requiredLogoutTime = result.requiredLogoutTime;
    
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
    
    // Return both the time and breakdown for API responses
    return {
        requiredLogoutTime: requiredLogoutTime.toISOString(),
        breakdown: {
            ...result.breakdown,
            requiredLogoutTime: requiredLogoutTime.toISOString()
        }
    };
};

const getUserDailyStatus = async (userId, targetDate, options = {}) => {
    const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
    
    // PERFORMANCE OPTIMIZATION: Check cache first (60-second TTL)
    const cachedStatus = getStatus(userId, targetDate);
    if (cachedStatus) {
        return cachedStatus;
    }
    
    const response = buildBaseResponse(resolvedOptions);

    // PHASE 2 OPTIMIZATION: Parallelize independent queries
    // Batch 1: User + AttendanceLog (independent, can run in parallel)
    const [user, attendanceLog] = await Promise.all([
        User.findById(userId).populate('shiftGroup').lean(),
        AttendanceLog.findOne({ user: userId, attendanceDate: targetDate }).lean()
    ]);

    if (!user) {
        return response;
    }

    response.shift = user.shiftGroup || null;

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
    // BUT: Use persisted half-day reason if admin override exists
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
        
        // Include half-day reason: Use persisted if admin overridden, otherwise use recalculated
        if (attendanceLog.overriddenByAdmin && attendanceLog.halfDayReasonText) {
            // Admin override takes precedence
            response.attendanceLog.halfDayReasonCode = attendanceLog.halfDayReasonCode;
            response.attendanceLog.halfDayReasonText = attendanceLog.halfDayReasonText;
            response.attendanceLog.halfDaySource = attendanceLog.halfDaySource;
        } else if (recalculatedStatus.isHalfDay) {
            // Use recalculated reason for auto-detected half-day
            response.attendanceLog.halfDayReasonCode = recalculatedStatus.halfDayReasonCode;
            response.attendanceLog.halfDayReasonText = recalculatedStatus.halfDayReasonText;
            response.attendanceLog.halfDaySource = 'AUTO';
        } else if (attendanceLog.halfDayReasonText) {
            // Use persisted reason (may be from previous calculation)
            response.attendanceLog.halfDayReasonCode = attendanceLog.halfDayReasonCode;
            response.attendanceLog.halfDayReasonText = attendanceLog.halfDayReasonText;
            response.attendanceLog.halfDaySource = attendanceLog.halfDaySource;
        }
        
        // Include override fields
        response.attendanceLog.overriddenByAdmin = attendanceLog.overriddenByAdmin || false;
        response.attendanceLog.overriddenAt = attendanceLog.overriddenAt || null;
        response.attendanceLog.overriddenBy = attendanceLog.overriddenBy || null;
    } else {
        // Fallback if shift or clockInTime is missing
        response.attendanceLog.isLate = false;
        response.attendanceLog.isHalfDay = false;
        response.attendanceLog.lateMinutes = 0;
        response.attendanceLog.attendanceStatus = 'On-time';
        // Include persisted reason if exists
        response.attendanceLog.halfDayReasonCode = attendanceLog.halfDayReasonCode || null;
        response.attendanceLog.halfDayReasonText = attendanceLog.halfDayReasonText || '';
        response.attendanceLog.halfDaySource = attendanceLog.halfDaySource || null;
        response.attendanceLog.overriddenByAdmin = attendanceLog.overriddenByAdmin || false;
    }

    // PHASE 2 OPTIMIZATION: Parallelize independent queries
    // Batch 2: Sessions + Breaks + AutoBreak (independent if attendanceLog exists)
    let sessions = [];
    let breaks = [];
    let autoBreakDoc = null;

    if (resolvedOptions.includeSessions || resolvedOptions.includeBreaks || resolvedOptions.includeAutoBreak) {
        const batch2Promises = [];
        
        if (resolvedOptions.includeSessions) {
            batch2Promises.push(
                AttendanceSession.find({ attendanceLog: attendanceLog._id }).sort({ startTime: 1 }).lean()
            );
        } else {
            batch2Promises.push(Promise.resolve([]));
        }

        if (resolvedOptions.includeBreaks) {
            batch2Promises.push(
                BreakLog.find({ attendanceLog: attendanceLog._id }).sort({ startTime: 1 }).lean()
            );
        } else {
            batch2Promises.push(Promise.resolve([]));
        }

        if (resolvedOptions.includeAutoBreak) {
            batch2Promises.push(
                BreakLog.findOne({
                    userId,
                    endTime: null,
                    isAutoBreak: true,
                }).sort({ startTime: 1 }).lean()
            );
        } else {
            batch2Promises.push(Promise.resolve(null));
        }

        const [sessionsResult, breaksResult, autoBreakResult] = await Promise.all(batch2Promises);
        
        sessions = sessionsResult;
        breaks = breaksResult;
        autoBreakDoc = autoBreakResult;

        if (resolvedOptions.includeSessions) {
            response.sessions = sessions;
        }

        if (resolvedOptions.includeBreaks) {
            response.breaks = breaks;
            const activeBreakDoc = breaks.find(b => !b.endTime);
            response.activeBreak = mapActiveBreak(activeBreakDoc);
        }

        if (resolvedOptions.includeAutoBreak) {
            response.autoBreak = mapAutoBreak(autoBreakDoc);
        }
    }

    // PHASE 2 OPTIMIZATION: Parallelize independent queries
    // Batch 3: ExtraBreakRequests (independent, can run in parallel)
    if (resolvedOptions.includeRequests) {
        const [pendingRequest, approvedRequest] = await Promise.all([
            ExtraBreakRequest.findOne({
                user: userId,
                attendanceDate: targetDate,
                status: 'Pending',
            }).lean(),
            ExtraBreakRequest.findOne({
                user: userId,
                attendanceDate: targetDate,
                status: 'Approved',
                isUsed: false,
            }).lean()
        ]);
        response.pendingExtraBreakRequest = pendingRequest;
        response.approvedExtraBreak = approvedRequest;
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
    const logoutCalculation = computeCalculatedLogoutTime(sessions, breaks, response.attendanceLog, response.shift, response.activeBreak);
    
    if (logoutCalculation) {
        response.calculatedLogoutTime = logoutCalculation.requiredLogoutTime;
        response.logoutBreakdown = logoutCalculation.breakdown;
    } else {
        response.calculatedLogoutTime = null;
        response.logoutBreakdown = null;
    }

    // PERFORMANCE OPTIMIZATION: Cache the response (60-second TTL)
    // Don't cache if admin override exists - these should always be fresh
    if (!response.attendanceLog?.overriddenByAdmin) {
        setStatus(userId, targetDate, response);
    }

    return response;
};

/**
 * BATCHED daily status computation for multiple users (Admin Dashboard only).
 *
 * Safety rules:
 * - Does NOT change getUserDailyStatus() behavior
 * - Does NOT perform any per-user DB queries
 * - Returns ONLY the fields needed by Admin Dashboard "Who's In Today" enrichment:
 *   { calculatedLogoutTime, logoutBreakdown, activeBreak }
 *
 * @param {Array<string|ObjectId>} userIds
 * @param {string} targetDate - YYYY-MM-DD (IST business date)
 * @returns {Promise<Map<string, { calculatedLogoutTime: string|null, logoutBreakdown: any|null, activeBreak: any|null }>>}
 */
const getUsersDailyStatusBatch = async (userIds, targetDate) => {
    const result = new Map();
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
    if (ids.length === 0 || !targetDate) return result;

    // Normalize user IDs to strings for stable mapping
    const userIdStrings = ids.map(id => id.toString());

    // Batch 1: Users (shiftGroup) + AttendanceLogs
    const [users, logs] = await Promise.all([
        User.find({ _id: { $in: userIdStrings } })
            .select('_id shiftGroup')
            .populate('shiftGroup')
            .lean(),
        AttendanceLog.find({ user: { $in: userIdStrings }, attendanceDate: targetDate })
            .select('_id user paidBreakMinutesTaken unpaidBreakMinutesTaken logoutType autoLogoutReason')
            .lean()
    ]);

    const userById = new Map(users.map(u => [u._id.toString(), u]));
    const logByUserId = new Map(logs.map(l => [l.user.toString(), l]));
    const logIds = logs.map(l => l._id);

    // If no logs exist, return empty map (dashboard should handle nulls)
    if (logIds.length === 0) {
        userIdStrings.forEach(uid => {
            result.set(uid, { calculatedLogoutTime: null, logoutBreakdown: null, activeBreak: null });
        });
        return result;
    }

    // Batch 2: Sessions + Breaks
    const [sessionsAll, breaksAll] = await Promise.all([
        AttendanceSession.find({ attendanceLog: { $in: logIds } }).sort({ startTime: 1 }).lean(),
        BreakLog.find({ attendanceLog: { $in: logIds } }).sort({ startTime: 1 }).lean()
    ]);

    const sessionsByLogId = new Map();
    for (const s of sessionsAll) {
        const key = s.attendanceLog.toString();
        const arr = sessionsByLogId.get(key) || [];
        arr.push(s);
        sessionsByLogId.set(key, arr);
    }

    const breaksByLogId = new Map();
    for (const b of breaksAll) {
        const key = b.attendanceLog.toString();
        const arr = breaksByLogId.get(key) || [];
        arr.push(b);
        breaksByLogId.set(key, arr);
    }

    const mapActiveBreakLikeGetUserDailyStatus = (breakDoc) => breakDoc ? ({
        startTime: breakDoc.startTime,
        breakType: breakDoc.breakType || breakDoc.type,
        durationMinutes: Math.floor((Date.now() - new Date(breakDoc.startTime)) / (1000 * 60))
    }) : null;

    for (const uid of userIdStrings) {
        const user = userById.get(uid);
        const log = logByUserId.get(uid);

        if (!user || !log) {
            result.set(uid, { calculatedLogoutTime: null, logoutBreakdown: null, activeBreak: null });
            continue;
        }

        const logId = log._id.toString();
        const sessions = sessionsByLogId.get(logId) || [];
        const breaks = breaksByLogId.get(logId) || [];

        const activeBreakDoc = breaks.find(b => !b.endTime);
        const activeBreak = mapActiveBreakLikeGetUserDailyStatus(activeBreakDoc);

        // Provide minimal attendanceLog shape needed by computeCalculatedLogoutTime
        const attendanceLogForCalc = {
            paidBreakMinutesTaken: log.paidBreakMinutesTaken || 0,
            unpaidBreakMinutesTaken: log.unpaidBreakMinutesTaken || 0,
            logoutType: log.logoutType || 'MANUAL',
            autoLogoutReason: log.autoLogoutReason || null
        };

        const shift = user.shiftGroup || null;
        const logoutCalculation = computeCalculatedLogoutTime(
            sessions,
            breaks,
            attendanceLogForCalc,
            shift,
            activeBreak
        );

        if (logoutCalculation) {
            result.set(uid, {
                calculatedLogoutTime: logoutCalculation.requiredLogoutTime,
                logoutBreakdown: logoutCalculation.breakdown,
                activeBreak
            });
        } else {
            result.set(uid, { calculatedLogoutTime: null, logoutBreakdown: null, activeBreak });
        }
    }

    return result;
};

module.exports = {
    getUserDailyStatus,
    computeCalculatedLogoutTime, // Export for testing
    recalculateLateStatus, // Export for use in admin routes
    getUsersDailyStatusBatch,
};

