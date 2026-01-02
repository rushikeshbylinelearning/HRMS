// backend/utils/attendanceStatusResolver.js
/**
 * UNIFIED ATTENDANCE STATUS RESOLVER
 * Single source of truth for determining attendance status for any date
 * 
 * Priority Order (STRICT):
 * 1. Holiday
 * 2. Approved Leave (including Compensatory, Swap Leave)
 * 3. Weekend / Week Off (based on Saturday policy)
 * 4. Present (has punch data)
 * 5. Absent (only if none of the above)
 */

const LeaveRequest = require('../models/LeaveRequest');
const Holiday = require('../models/Holiday');
const AntiExploitationLeaveService = require('../services/antiExploitationLeaveService');

/**
 * Normalize date to YYYY-MM-DD string in IST timezone
 * @param {Date|string} date - Date to normalize
 * @returns {string} YYYY-MM-DD format string
 */
const normalizeDateToIST = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    // Use IST timezone for date components
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Check if a date is a working Saturday based on policy
 * @param {Date} date - Date to check
 * @param {string} saturdayPolicy - Saturday policy
 * @returns {boolean} True if it's a working Saturday
 */
const isWorkingSaturday = (date, saturdayPolicy) => {
    if (date.getDay() !== 6) return true; // Not a Saturday, assume working
    
    const weekNum = Math.ceil(date.getDate() / 7);
    
    switch (saturdayPolicy) {
        case 'All Saturdays Off':
            return false;
        case 'Week 1 & 3 Off':
            return !(weekNum === 1 || weekNum === 3);
        case 'Week 2 & 4 Off':
            return !(weekNum === 2 || weekNum === 4);
        case 'All Saturdays Working':
        default:
            return true;
    }
};

/**
 * Resolve attendance status for a specific date
 * @param {Object} params
 * @param {Date|string} params.date - Date to resolve
 * @param {string} params.userId - User ID
 * @param {Object} params.attendanceLog - Attendance log for the date (if exists)
 * @param {string} params.saturdayPolicy - Saturday policy
 * @param {Array} params.holidays - Pre-fetched holidays (optional, will fetch if not provided)
 * @param {Array} params.leaves - Pre-fetched approved leaves (optional, will fetch if not provided)
 * @returns {Promise<Object>} { status, leave, holiday, isOnLeave }
 */
const resolveDayStatus = async ({
    date,
    userId,
    attendanceLog = null,
    saturdayPolicy = 'All Saturdays Working',
    holidays = null,
    leaves = null
}) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    const dateStr = normalizeDateToIST(dateObj);
    const dayOfWeek = dateObj.getDay();
    
    // Fetch holidays if not provided
    if (holidays === null) {
        const dateStart = new Date(dateObj);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(dateObj);
        dateEnd.setHours(23, 59, 59, 999);
        
        holidays = await Holiday.find({
            date: { $gte: dateStart, $lte: dateEnd },
            isTentative: { $ne: true }
        }).lean();
    }
    
    // Check for holiday FIRST (highest priority)
    const holiday = holidays.find(h => {
        if (!h.date || h.isTentative) return false;
        const holidayDateStr = normalizeDateToIST(h.date);
        return holidayDateStr === dateStr;
    });
    
    if (holiday) {
        return {
            status: `Holiday - ${holiday.name}`,
            leave: null,
            holiday: holiday,
            isOnLeave: false
        };
    }
    
    // Fetch approved leaves if not provided
    if (leaves === null) {
        const dateStart = new Date(dateStr + 'T00:00:00.000+05:30');
        const dateEnd = new Date(dateStr + 'T23:59:59.999+05:30');
        
        leaves = await LeaveRequest.find({
            employee: userId,
            status: 'Approved',
            leaveDates: {
                $elemMatch: {
                    $gte: dateStart,
                    $lte: dateEnd
                }
            }
        }).lean();
    }
    
    // Check for approved leave SECOND (overrides everything except holiday)
    const leave = leaves.find(l => {
        if (l.status !== 'Approved') return false;
        return l.leaveDates.some(leaveDate => {
            const leaveDateStr = normalizeDateToIST(leaveDate);
            return leaveDateStr === dateStr;
        });
    });
    
    if (leave) {
        let status;
        if (leave.requestType === 'Compensatory') {
            status = 'Comp Off';
        } else if (leave.requestType === 'Swap Leave') {
            status = 'Swap Leave';
        } else {
            const leaveTypeText = leave.leaveType === 'Full Day' ? 'Full Day' : (leave.leaveType || 'Full Day');
            status = `Leave - ${leave.requestType} (${leaveTypeText})`;
        }
        
        return {
            status: status,
            leave: leave,
            holiday: null,
            isOnLeave: true
        };
    }
    
    // Check for weekend / week off THIRD
    if (dayOfWeek === 0) {
        return {
            status: 'Weekend',
            leave: null,
            holiday: null,
            isOnLeave: false
        };
    }
    
    if (dayOfWeek === 6 && !isWorkingSaturday(dateObj, saturdayPolicy)) {
        return {
            status: 'Week Off',
            leave: null,
            holiday: null,
            isOnLeave: false
        };
    }
    
    // Check for present (has punch data) FOURTH
    if (attendanceLog) {
        const hasSessions = attendanceLog.sessions && attendanceLog.sessions.length > 0;
        if (hasSessions || attendanceLog.clockInTime) {
            // Recalculate half-day status based on worked hours (< 8.5 hours) FIRST
            // Only check if employee has clocked out (all sessions have endTime)
            const hasClockOut = attendanceLog.clockOutTime || 
                (hasSessions && attendanceLog.sessions.every(s => s.endTime));
            
            if (hasClockOut && hasSessions) {
                // Calculate worked hours from sessions and breaks
                let totalWorkingMinutes = 0;
                let totalBreakMinutes = 0;
                
                // Calculate total session time
                attendanceLog.sessions.forEach(session => {
                    if (session.startTime && session.endTime) {
                        const sessionMinutes = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60);
                        totalWorkingMinutes += sessionMinutes;
                    }
                });
                
                // Calculate total break time
                if (attendanceLog.breaks && Array.isArray(attendanceLog.breaks)) {
                    attendanceLog.breaks.forEach(breakLog => {
                        if (breakLog.startTime && breakLog.endTime) {
                            const breakMinutes = (new Date(breakLog.endTime) - new Date(breakLog.startTime)) / (1000 * 60);
                            totalBreakMinutes += breakMinutes;
                        }
                    });
                }
                
                // Net working hours (excluding breaks)
                const netWorkingMinutes = Math.max(0, totalWorkingMinutes - totalBreakMinutes);
                const workedHours = netWorkingMinutes / 60;
                
                // Check if worked hours < 8.5 (half-day threshold)
                // This calculation takes priority over stored status for completed days
                const MINIMUM_FULL_DAY_HOURS = 8.5;
                if (workedHours > 0 && workedHours < MINIMUM_FULL_DAY_HOURS) {
                    return {
                        status: 'Half Day',
                        leave: null,
                        holiday: null,
                        isOnLeave: false
                    };
                } else if (workedHours >= MINIMUM_FULL_DAY_HOURS) {
                    // Worked 8.5+ hours = Full Day (Present), regardless of stored status
                    return {
                        status: 'Present',
                        leave: null,
                        holiday: null,
                        isOnLeave: false
                    };
                }
            }
            
            // For active days (not clocked out) or if calculation couldn't be done,
            // use stored status as fallback
            const logStatus = attendanceLog.attendanceStatus;
            if (logStatus === 'Half-day' || attendanceLog.isHalfDay) {
                return {
                    status: 'Half Day',
                    leave: null,
                    holiday: null,
                    isOnLeave: false
                };
            } else if (logStatus === 'Late') {
                return {
                    status: 'Late',
                    leave: null,
                    holiday: null,
                    isOnLeave: false
                };
            }
            
            // Default to Present
            return {
                status: 'Present',
                leave: null,
                holiday: null,
                isOnLeave: false
            };
        }
    }
    
    // Default to Absent (only if none of the above)
    // But only for past working days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(dateObj);
    checkDate.setHours(0, 0, 0, 0);
    
    if (checkDate < today) {
        return {
            status: 'Absent',
            leave: null,
            holiday: null,
            isOnLeave: false
        };
    }
    
    // Future date
    return {
        status: 'N/A',
        leave: null,
        holiday: null,
        isOnLeave: false
    };
};

/**
 * Batch resolve status for multiple dates (optimized)
 * @param {Object} params
 * @param {Array<Date|string>} params.dates - Array of dates to resolve
 * @param {string} params.userId - User ID
 * @param {Map} params.attendanceLogMap - Map of dateStr -> attendanceLog
 * @param {string} params.saturdayPolicy - Saturday policy
 * @returns {Promise<Map>} Map of dateStr -> { status, leave, holiday, isOnLeave }
 */
const resolveMultipleDaysStatus = async ({
    dates,
    userId,
    attendanceLogMap = new Map(),
    saturdayPolicy = 'All Saturdays Working'
}) => {
    if (!dates || dates.length === 0) return new Map();
    
    // Normalize all dates
    const dateStrs = dates.map(d => normalizeDateToIST(d));
    const minDate = new Date(Math.min(...dates.map(d => {
        const dateObj = d instanceof Date ? d : new Date(d);
        return dateObj.getTime();
    })));
    const maxDate = new Date(Math.max(...dates.map(d => {
        const dateObj = d instanceof Date ? d : new Date(d);
        return dateObj.getTime();
    })));
    
    // Fetch holidays for the date range
    const holidays = await Holiday.find({
        date: { $gte: minDate, $lte: maxDate },
        isTentative: { $ne: true }
    }).lean();
    
    // Fetch approved leaves for the date range
    const leaves = await LeaveRequest.find({
        employee: userId,
        status: 'Approved',
        leaveDates: {
            $elemMatch: {
                $gte: minDate,
                $lte: maxDate
            }
        }
    }).lean();
    
    // Build holiday map
    const holidayMap = new Map();
    holidays.forEach(h => {
        if (h.date && !h.isTentative) {
            const holidayDateStr = normalizeDateToIST(h.date);
            if (dateStrs.includes(holidayDateStr)) {
                holidayMap.set(holidayDateStr, h);
            }
        }
    });
    
    // Build leave map
    const leaveMap = new Map();
    leaves.forEach(l => {
        if (l.status === 'Approved') {
            l.leaveDates.forEach(leaveDate => {
                const leaveDateStr = normalizeDateToIST(leaveDate);
                if (dateStrs.includes(leaveDateStr)) {
                    if (!leaveMap.has(leaveDateStr)) {
                        leaveMap.set(leaveDateStr, []);
                    }
                    leaveMap.get(leaveDateStr).push(l);
                }
            });
        }
    });
    
    // Resolve status for each date
    const resultMap = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    dates.forEach(date => {
        const dateObj = date instanceof Date ? date : new Date(date);
        const dateStr = normalizeDateToIST(dateObj);
        const dayOfWeek = dateObj.getDay();
        const checkDate = new Date(dateObj);
        checkDate.setHours(0, 0, 0, 0);
        
        // Priority 1: Holiday
        const holiday = holidayMap.get(dateStr);
        if (holiday) {
            resultMap.set(dateStr, {
                status: `Holiday - ${holiday.name}`,
                leave: null,
                holiday: holiday,
                isOnLeave: false
            });
            return;
        }
        
        // Priority 2: Approved Leave
        const leavesForDate = leaveMap.get(dateStr);
        if (leavesForDate && leavesForDate.length > 0) {
            const leave = leavesForDate[0]; // Use first leave if multiple
            let status;
            if (leave.requestType === 'Compensatory') {
                status = 'Comp Off';
            } else if (leave.requestType === 'Swap Leave') {
                status = 'Swap Leave';
            } else {
                const leaveTypeText = leave.leaveType === 'Full Day' ? 'Full Day' : (leave.leaveType || 'Full Day');
                status = `Leave - ${leave.requestType} (${leaveTypeText})`;
            }
            
            resultMap.set(dateStr, {
                status: status,
                leave: leave,
                holiday: null,
                isOnLeave: true
            });
            return;
        }
        
        // Priority 3: Weekend / Week Off
        if (dayOfWeek === 0) {
            resultMap.set(dateStr, {
                status: 'Weekend',
                leave: null,
                holiday: null,
                isOnLeave: false
            });
            return;
        }
        
        if (dayOfWeek === 6 && !isWorkingSaturday(dateObj, saturdayPolicy)) {
            resultMap.set(dateStr, {
                status: 'Week Off',
                leave: null,
                holiday: null,
                isOnLeave: false
            });
            return;
        }
        
        // Priority 4: Present (has punch data)
        const attendanceLog = attendanceLogMap.get(dateStr);
        if (attendanceLog) {
            const hasSessions = attendanceLog.sessions && attendanceLog.sessions.length > 0;
            if (hasSessions || attendanceLog.clockInTime) {
                // Recalculate half-day status based on worked hours (< 8.5 hours) FIRST
                // Only check if employee has clocked out (all sessions have endTime)
                const hasClockOut = attendanceLog.clockOutTime || 
                    (hasSessions && attendanceLog.sessions.every(s => s.endTime));
                
                if (hasClockOut && hasSessions) {
                    // Calculate worked hours from sessions and breaks
                    let totalWorkingMinutes = 0;
                    let totalBreakMinutes = 0;
                    
                    // Calculate total session time
                    attendanceLog.sessions.forEach(session => {
                        if (session.startTime && session.endTime) {
                            const sessionMinutes = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60);
                            totalWorkingMinutes += sessionMinutes;
                        }
                    });
                    
                    // Calculate total break time
                    if (attendanceLog.breaks && Array.isArray(attendanceLog.breaks)) {
                        attendanceLog.breaks.forEach(breakLog => {
                            if (breakLog.startTime && breakLog.endTime) {
                                const breakMinutes = (new Date(breakLog.endTime) - new Date(breakLog.startTime)) / (1000 * 60);
                                totalBreakMinutes += breakMinutes;
                            }
                        });
                    }
                    
                    // Net working hours (excluding breaks)
                    const netWorkingMinutes = Math.max(0, totalWorkingMinutes - totalBreakMinutes);
                    const workedHours = netWorkingMinutes / 60;
                    
                    // Check if worked hours < 8.5 (half-day threshold)
                    // This calculation takes priority over stored status for completed days
                    const MINIMUM_FULL_DAY_HOURS = 8.5;
                    if (workedHours > 0 && workedHours < MINIMUM_FULL_DAY_HOURS) {
                        resultMap.set(dateStr, {
                            status: 'Half Day',
                            leave: null,
                            holiday: null,
                            isOnLeave: false
                        });
                        return;
                    } else if (workedHours >= MINIMUM_FULL_DAY_HOURS) {
                        // Worked 8.5+ hours = Full Day (Present), regardless of stored status
                        resultMap.set(dateStr, {
                            status: 'Present',
                            leave: null,
                            holiday: null,
                            isOnLeave: false
                        });
                        return;
                    }
                }
                
                // For active days (not clocked out) or if calculation couldn't be done,
                // use stored status as fallback
                const logStatus = attendanceLog.attendanceStatus;
                if (logStatus === 'Half-day' || attendanceLog.isHalfDay) {
                    resultMap.set(dateStr, {
                        status: 'Half Day',
                        leave: null,
                        holiday: null,
                        isOnLeave: false
                    });
                    return;
                } else if (logStatus === 'Late') {
                    resultMap.set(dateStr, {
                        status: 'Late',
                        leave: null,
                        holiday: null,
                        isOnLeave: false
                    });
                    return;
                }
                
                // Default to Present
                resultMap.set(dateStr, {
                    status: 'Present',
                    leave: null,
                    holiday: null,
                    isOnLeave: false
                });
                return;
            }
        }
        
        // Priority 5: Absent (only for past working days)
        if (checkDate < today) {
            resultMap.set(dateStr, {
                status: 'Absent',
                leave: null,
                holiday: null,
                isOnLeave: false
            });
        } else {
            resultMap.set(dateStr, {
                status: 'N/A',
                leave: null,
                holiday: null,
                isOnLeave: false
            });
        }
    });
    
    return resultMap;
};

module.exports = {
    resolveDayStatus,
    resolveMultipleDaysStatus,
    normalizeDateToIST,
    isWorkingSaturday
};

