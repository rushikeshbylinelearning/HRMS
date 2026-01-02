// backend/services/halfDayService.js
const Setting = require('../models/Setting');
const LeaveRequest = require('../models/LeaveRequest');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const { logAction } = require('./logAction');
const NewNotificationService = require('./NewNotificationService');
const User = require('../models/User');

/**
 * Get grace period from settings (default: 30 minutes)
 * @returns {Promise<number>} Grace period in minutes
 */
const getGracePeriodMinutes = async () => {
    try {
        const graceSetting = await Setting.findOne({ key: 'lateGraceMinutes' });
        if (graceSetting && !isNaN(Number(graceSetting.value))) {
            return Number(graceSetting.value);
        }
    } catch (err) {
        console.error('Failed to fetch late grace setting, falling back to 30 minutes', err);
    }
    return 30; // Default grace period
};

/**
 * Check if employee has applied half-day leave for the given date
 * @param {string} userId - User ID
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Promise<boolean>} True if half-day leave is applied
 */
const hasAppliedHalfDayLeave = async (userId, dateStr) => {
    try {
        const dateObj = new Date(dateStr + 'T00:00:00.000+05:30'); // IST
        const dateStart = new Date(dateObj);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(dateObj);
        dateEnd.setHours(23, 59, 59, 999);

        const approvedLeave = await LeaveRequest.findOne({
            employee: userId,
            status: 'Approved',
            leaveDates: {
                $elemMatch: {
                    $gte: dateStart,
                    $lte: dateEnd
                }
            },
            leaveType: { $regex: /^Half Day/i }
        }).lean();

        return !!approvedLeave;
    } catch (err) {
        console.error('Error checking for half-day leave:', err);
        return false;
    }
};

/**
 * Calculate total worked hours from attendance sessions and breaks
 * @param {string} attendanceLogId - Attendance log ID
 * @returns {Promise<number>} Total worked hours (net of breaks)
 */
const calculateWorkedHours = async (attendanceLogId) => {
    try {
        const sessions = await AttendanceSession.find({ attendanceLog: attendanceLogId })
            .sort({ startTime: 1 })
            .lean();
        
        const breaks = await BreakLog.find({ attendanceLog: attendanceLogId }).lean();

        let totalWorkingMinutes = 0;
        let totalBreakMinutes = 0;

        // Calculate total session time
        sessions.forEach(session => {
            if (session.startTime) {
                const endTime = session.endTime || new Date(); // Use current time if session is active
                const sessionMinutes = (new Date(endTime) - new Date(session.startTime)) / (1000 * 60);
                totalWorkingMinutes += sessionMinutes;
            }
        });

        // Calculate total break time
        breaks.forEach(breakLog => {
            if (breakLog.startTime) {
                const endTime = breakLog.endTime || new Date(); // Use current time if break is active
                const breakMinutes = (new Date(endTime) - new Date(breakLog.startTime)) / (1000 * 60);
                totalBreakMinutes += breakMinutes;
            }
        });

        // Net working hours (excluding breaks)
        const netWorkingMinutes = Math.max(0, totalWorkingMinutes - totalBreakMinutes);
        return netWorkingMinutes / 60; // Convert to hours
    } catch (err) {
        console.error('Error calculating worked hours:', err);
        return 0;
    }
};

/**
 * Calculate late minutes from clock-in time and shift start time
 * @param {Date} clockInTime - Actual clock-in time
 * @param {Object} shift - Shift object with startTime
 * @returns {number} Late minutes (0 if on-time or early)
 */
const calculateLateMinutes = (clockInTime, shift) => {
    if (!clockInTime || !shift || !shift.startTime) {
        return 0;
    }

    // Use the same timezone-aware function as dailyStatusService
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

    const clockIn = new Date(clockInTime);
    const shiftStartTime = getShiftDateTimeIST(clockIn, shift.startTime);
    return Math.max(0, Math.floor((clockIn - shiftStartTime) / (1000 * 60)));
};

/**
 * Determine Half-Day status based on unified business rules
 * 
 * Business Rules:
 * 1. Employee applied Half-Day via leave request → Half-Day
 * 2. Worked hours < 8.5 hours (after clock-out) → Half-Day
 * 3. Late beyond grace period → Half-Day
 * 
 * Priority: Admin Override > Applied Leave > Late > Hours
 * 
 * @param {Object} attendanceLog - Attendance log document (Mongoose document or plain object)
 * @param {Object} options - Additional options
 * @param {Object} options.user - User document (optional, will fetch if not provided)
 * @param {Object} options.shift - Shift document (optional, will fetch from user if not provided)
 * @param {boolean} options.skipNotifications - Skip sending notifications (default: false)
 * @param {string} options.source - Source of the call ('clock-in', 'clock-out', 'admin', 'recalculation', etc.)
 * @returns {Promise<Object>} { isHalfDay, attendanceStatus, source, previousStatus, changed }
 */
const determineHalfDayStatus = async (attendanceLog, options = {}) => {
    const {
        user = null,
        shift = null,
        skipNotifications = false,
        source = 'recalculation'
    } = options;

    // Store previous status for comparison
    const previousIsHalfDay = attendanceLog.isHalfDay || false;
    const previousStatus = attendanceLog.attendanceStatus || 'On-time';

    // If admin override is set to remove half-day, respect it
    if (attendanceLog.adminOverride === 'Override Half Day' && previousIsHalfDay) {
        // Admin has explicitly overridden - don't mark as half-day
        return {
            isHalfDay: false,
            attendanceStatus: attendanceLog.attendanceStatus || 'On-time',
            source: 'admin_override',
            previousStatus,
            changed: previousIsHalfDay !== false
        };
    }

    // Fetch user and shift if not provided
    let userDoc = user;
    let shiftDoc = shift;
    
    if (!userDoc && attendanceLog.user) {
        const User = require('../models/User');
        userDoc = await User.findById(attendanceLog.user).populate('shiftGroup').lean();
    }
    
    if (!shiftDoc && userDoc && userDoc.shiftGroup) {
        shiftDoc = userDoc.shiftGroup;
    }

    // Get grace period
    const gracePeriodMinutes = await getGracePeriodMinutes();

    // Check condition 1: Applied Half-Day Leave
    const appliedHalfDay = await hasAppliedHalfDayLeave(
        attendanceLog.user?.toString() || attendanceLog.user,
        attendanceLog.attendanceDate
    );

    if (appliedHalfDay) {
        const result = {
            isHalfDay: true,
            attendanceStatus: 'Half-day',
            source: 'applied_leave',
            previousStatus,
            changed: previousIsHalfDay !== true || previousStatus !== 'Half-day'
        };

        // Update attendance log if changed
        if (result.changed && attendanceLog.save) {
            attendanceLog.isHalfDay = true;
            attendanceLog.attendanceStatus = 'Half-day';
            await attendanceLog.save();
        }

        return result;
    }

    // Check condition 2: Late beyond grace period (requires clock-in time and shift)
    let lateMinutes = attendanceLog.lateMinutes || 0;
    if (attendanceLog.clockInTime && shiftDoc) {
        lateMinutes = calculateLateMinutes(attendanceLog.clockInTime, shiftDoc);
    }

    const isLateBeyondGrace = lateMinutes > gracePeriodMinutes;

    // Check condition 3: Worked hours < 8.5 (only if clocked out)
    const hasClockOut = attendanceLog.clockOutTime || 
        (attendanceLog.sessions && attendanceLog.sessions.length > 0 && 
         attendanceLog.sessions.every(s => s.endTime));

    let workedHours = attendanceLog.totalWorkingHours || 0;
    if (hasClockOut && attendanceLog._id) {
        // Recalculate worked hours if clocked out
        workedHours = await calculateWorkedHours(attendanceLog._id);
    }

    const MINIMUM_FULL_DAY_HOURS = 8.5;
    const isHoursBasedHalfDay = hasClockOut && workedHours > 0 && workedHours < MINIMUM_FULL_DAY_HOURS;

    // Determine final status
    let isHalfDay = false;
    let statusSource = 'none';

    if (isLateBeyondGrace) {
        isHalfDay = true;
        statusSource = 'late';
    } else if (isHoursBasedHalfDay) {
        isHalfDay = true;
        statusSource = 'hours';
    }

    const changed = previousIsHalfDay !== isHalfDay || 
                   (isHalfDay && previousStatus !== 'Half-day') ||
                   (!isHalfDay && previousStatus === 'Half-day');

    // Update attendance log
    if (attendanceLog.save) {
        attendanceLog.isHalfDay = isHalfDay;
        attendanceLog.lateMinutes = lateMinutes;
        
        if (isHalfDay) {
            attendanceLog.attendanceStatus = 'Half-day';
        } else if (attendanceLog.attendanceStatus === 'Half-day') {
            // If no longer half-day, recalculate status
            if (attendanceLog.isLate) {
                attendanceLog.attendanceStatus = 'Late';
            } else {
                attendanceLog.attendanceStatus = 'On-time';
            }
        }
        
        await attendanceLog.save();
    }

    // Send notifications if status changed to half-day due to late arrival
    if (changed && isHalfDay && statusSource === 'late' && !skipNotifications && userDoc) {
        try {
            // Notify employee
            await NewNotificationService.createAndEmitNotification({
                message: `You have been marked as Half-Day due to late arrival (${lateMinutes} minutes late).`,
                userId: userDoc._id || attendanceLog.user,
                userName: userDoc.fullName || 'Employee',
                type: 'half_day_marked',
                recipientType: 'user',
                category: 'attendance',
                priority: 'high',
                navigationData: { page: 'attendance' },
                metadata: {
                    source: 'late_arrival',
                    lateMinutes,
                    attendanceDate: attendanceLog.attendanceDate
                }
            });

            // Notify admins
            await NewNotificationService.broadcastToAdmins({
                message: `${userDoc.fullName || 'Employee'} has been marked as Half-Day for late arrival (${lateMinutes} minutes late) on ${attendanceLog.attendanceDate}.`,
                type: 'half_day_marked',
                category: 'attendance',
                priority: 'high',
                navigationData: { 
                    page: 'admin/attendance',
                    params: { userId: userDoc._id || attendanceLog.user }
                },
                metadata: {
                    source: 'late_arrival',
                    lateMinutes,
                    employeeId: userDoc._id || attendanceLog.user,
                    employeeName: userDoc.fullName,
                    attendanceDate: attendanceLog.attendanceDate
                }
            });
        } catch (notifError) {
            console.error('Error sending half-day notifications:', notifError);
            // Don't fail the main operation if notifications fail
        }
    }

    // Log the change for audit trail
    if (changed && attendanceLog.user) {
        try {
            await logAction(
                attendanceLog.user,
                isHalfDay ? 'MARK_HALF_DAY' : 'UNMARK_HALF_DAY',
                {
                    attendanceLogId: attendanceLog._id,
                    attendanceDate: attendanceLog.attendanceDate,
                    previousStatus,
                    newStatus: isHalfDay ? 'Half-day' : (attendanceLog.attendanceStatus || 'On-time'),
                    previousIsHalfDay,
                    newIsHalfDay: isHalfDay,
                    source: statusSource,
                    lateMinutes,
                    workedHours: workedHours.toFixed(2),
                    appliedHalfDay,
                    details: `Half-day status ${isHalfDay ? 'marked' : 'unmarked'}. Source: ${statusSource}. Previous: ${previousStatus}, New: ${isHalfDay ? 'Half-day' : (attendanceLog.attendanceStatus || 'On-time')}`
                }
            );
        } catch (logError) {
            console.error('Error logging half-day status change:', logError);
            // Don't fail the main operation if logging fails
        }
    }

    return {
        isHalfDay,
        attendanceStatus: isHalfDay ? 'Half-day' : (attendanceLog.attendanceStatus || 'On-time'),
        source: statusSource,
        previousStatus,
        changed,
        lateMinutes,
        workedHours: workedHours.toFixed(2),
        appliedHalfDay
    };
};

module.exports = {
    determineHalfDayStatus,
    getGracePeriodMinutes,
    hasAppliedHalfDayLeave,
    calculateWorkedHours,
    calculateLateMinutes
};


