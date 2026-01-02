// backend/services/attendanceRecalculationService.js
/**
 * Attendance Recalculation Service
 * 
 * This service ensures attendance status is always correctly resolved
 * by checking for approved leaves, holidays, and weekends.
 * 
 * CRITICAL: Attendance status should NEVER be stored as ABSENT when
 * an approved leave exists. This service enforces that rule.
 */

const AttendanceLog = require('../models/AttendanceLog');
const LeaveRequest = require('../models/LeaveRequest');
const Holiday = require('../models/Holiday');
const User = require('../models/User');

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
 * Recalculate attendance status for a specific date
 * This is the SINGLE SOURCE OF TRUTH for attendance status
 * 
 * Priority: Holiday > Approved Leave > Weekend/Week Off > Present > Absent
 * 
 * @param {string} userId - User ID
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {Object} attendanceLog - Existing attendance log (if any)
 * @returns {Promise<Object>} { status, shouldUpdate, leave, holiday }
 */
const recalculateAttendanceStatus = async (userId, dateStr, attendanceLog = null) => {
    const dateObj = new Date(dateStr + 'T00:00:00.000+05:30'); // IST
    
    // Fetch user for Saturday policy
    const user = await User.findById(userId).lean();
    if (!user) {
        return { status: null, shouldUpdate: false, leave: null, holiday: null };
    }
    
    const saturdayPolicy = user.alternateSaturdayPolicy || 'All Saturdays Working';
    
    // 1. Check for holiday (highest priority)
    const holiday = await Holiday.findOne({
        date: {
            $gte: new Date(dateStr + 'T00:00:00.000+05:30'),
            $lte: new Date(dateStr + 'T23:59:59.999+05:30')
        },
        isTentative: { $ne: true }
    }).lean();
    
    if (holiday) {
        // Holiday - attendance status should not be Absent
        if (attendanceLog && attendanceLog.attendanceStatus === 'Absent') {
            return {
                status: 'On-time', // Holiday is not absent
                shouldUpdate: true,
                leave: null,
                holiday: holiday
            };
        }
        return {
            status: attendanceLog?.attendanceStatus || 'On-time',
            shouldUpdate: false,
            leave: null,
            holiday: holiday
        };
    }
    
    // 2. Check for approved leave (second priority)
    const approvedLeave = await LeaveRequest.findOne({
        employee: userId,
        status: 'Approved',
        leaveDates: {
            $elemMatch: {
                $gte: new Date(dateStr + 'T00:00:00.000+05:30'),
                $lte: new Date(dateStr + 'T23:59:59.999+05:30')
            }
        }
    }).lean();
    
    if (approvedLeave) {
        // Verify date is actually in leaveDates (handle timezone edge cases)
        const leaveDateStrs = approvedLeave.leaveDates.map(ld => normalizeDateToIST(ld));
        if (leaveDateStrs.includes(dateStr)) {
            // Approved leave exists - status should NEVER be Absent
            if (attendanceLog && attendanceLog.attendanceStatus === 'Absent') {
                return {
                    status: 'On-time', // Override Absent with On-time (leave takes precedence)
                    shouldUpdate: true,
                    leave: approvedLeave,
                    holiday: null
                };
            }
            return {
                status: attendanceLog?.attendanceStatus || 'On-time',
                shouldUpdate: false,
                leave: approvedLeave,
                holiday: null
            };
        }
    }
    
    // 3. Check for weekend/week off
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0) {
        // Sunday - weekend
        if (attendanceLog && attendanceLog.attendanceStatus === 'Absent') {
            return {
                status: 'On-time', // Weekend is not absent
                shouldUpdate: true,
                leave: null,
                holiday: null
            };
        }
        return {
            status: attendanceLog?.attendanceStatus || 'On-time',
            shouldUpdate: false,
            leave: null,
            holiday: null
        };
    }
    
    if (dayOfWeek === 6) {
        // Saturday - check policy
        const weekNum = Math.ceil(dateObj.getDate() / 7);
        let isWorkingSaturday = true;
        
        if (saturdayPolicy === 'All Saturdays Off') {
            isWorkingSaturday = false;
        } else if (saturdayPolicy === 'Week 1 & 3 Off' && (weekNum === 1 || weekNum === 3)) {
            isWorkingSaturday = false;
        } else if (saturdayPolicy === 'Week 2 & 4 Off' && (weekNum === 2 || weekNum === 4)) {
            isWorkingSaturday = false;
        }
        
        if (!isWorkingSaturday) {
            // Week off - not absent
            if (attendanceLog && attendanceLog.attendanceStatus === 'Absent') {
                return {
                    status: 'On-time', // Week off is not absent
                    shouldUpdate: true,
                    leave: null,
                    holiday: null
                };
            }
            return {
                status: attendanceLog?.attendanceStatus || 'On-time',
                shouldUpdate: false,
                leave: null,
                holiday: null
            };
        }
    }
    
    // 4. If attendance log exists with punch data, keep existing status
    // But still check if status is Absent when it shouldn't be
    if (attendanceLog && (attendanceLog.clockInTime || (attendanceLog.sessions && attendanceLog.sessions.length > 0))) {
        // Has punch data - status should be On-time, Late, or Half-day (never Absent)
        if (attendanceLog.attendanceStatus === 'Absent') {
            // This is invalid - has punch but marked Absent
            return {
                status: 'On-time', // Default to On-time if has punch
                shouldUpdate: true,
                leave: null,
                holiday: null
            };
        }
        // Status is already correct (On-time, Late, Half-day)
        return {
            status: attendanceLog.attendanceStatus,
            shouldUpdate: false,
            leave: null,
            holiday: null
        };
    }
    
    // 5. No punch data and no leave/holiday/weekend - can be Absent
    // But only if it's a past working day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(dateStr + 'T00:00:00.000+05:30');
    checkDate.setHours(0, 0, 0, 0);
    
    if (checkDate < today) {
        // Past working day with no punch - Absent is valid
        return {
            status: 'Absent',
            shouldUpdate: attendanceLog ? (attendanceLog.attendanceStatus !== 'Absent') : false,
            leave: null,
            holiday: null
        };
    }
    
    // Future date - no status yet
    return {
        status: attendanceLog?.attendanceStatus || 'On-time',
        shouldUpdate: false,
        leave: null,
        holiday: null
    };
};

/**
 * Recalculate and update attendance status for a specific date
 * @param {string} userId - User ID
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Update result
 */
const recalculateAndUpdateAttendanceStatus = async (userId, dateStr) => {
    try {
        const attendanceLog = await AttendanceLog.findOne({
            user: userId,
            attendanceDate: dateStr
        }).lean();
        
        const result = await recalculateAttendanceStatus(userId, dateStr, attendanceLog);
        
        if (result.shouldUpdate && attendanceLog) {
            await AttendanceLog.findByIdAndUpdate(attendanceLog._id, {
                attendanceStatus: result.status
            });
            
            return {
                updated: true,
                oldStatus: attendanceLog.attendanceStatus,
                newStatus: result.status,
                date: dateStr,
                userId: userId
            };
        }
        
        return {
            updated: false,
            status: result.status,
            date: dateStr,
            userId: userId
        };
    } catch (error) {
        console.error(`Error recalculating attendance for ${userId} on ${dateStr}:`, error);
        throw error;
    }
};

/**
 * Recalculate attendance for all dates in a leave request
 * Called when leave is approved/rejected to update affected attendance records
 * @param {Object} leaveRequest - Leave request object
 * @returns {Promise<Array>} Array of update results
 */
const recalculateAttendanceForLeave = async (leaveRequest) => {
    if (!leaveRequest || !leaveRequest.employee || !leaveRequest.leaveDates) {
        return [];
    }
    
    const results = [];
    const employeeId = leaveRequest.employee.toString ? leaveRequest.employee.toString() : leaveRequest.employee;
    
    for (const leaveDate of leaveRequest.leaveDates) {
        const dateStr = normalizeDateToIST(leaveDate);
        try {
            const result = await recalculateAndUpdateAttendanceStatus(employeeId, dateStr);
            results.push(result);
        } catch (error) {
            console.error(`Error recalculating attendance for leave date ${dateStr}:`, error);
            results.push({
                updated: false,
                error: error.message,
                date: dateStr
            });
        }
    }
    
    return results;
};

/**
 * Backfill: Fix all attendance records where approved leave exists but status is Absent
 * @param {Object} options - Options for backfill
 * @param {string} options.userId - Optional: specific user ID, or null for all users
 * @param {string} options.startDate - Optional: start date for backfill range
 * @param {string} options.endDate - Optional: end date for backfill range
 * @returns {Promise<Object>} Backfill results
 */
const backfillAttendanceForLeaves = async (options = {}) => {
    const { userId = null, startDate = null, endDate = null } = options;
    
    try {
        // Find all approved leaves
        const leaveQuery = {
            status: 'Approved'
        };
        
        if (userId) {
            leaveQuery.employee = userId;
        }
        
        if (startDate || endDate) {
            leaveQuery.leaveDates = {
                $elemMatch: {}
            };
            if (startDate) {
                leaveQuery.leaveDates.$elemMatch.$gte = new Date(startDate + 'T00:00:00.000+05:30');
            }
            if (endDate) {
                leaveQuery.leaveDates.$elemMatch.$lte = new Date(endDate + 'T23:59:59.999+05:30');
            }
        }
        
        const approvedLeaves = await LeaveRequest.find(leaveQuery).lean();
        
        const processedDates = new Set();
        const results = {
            totalLeaves: approvedLeaves.length,
            totalDates: 0,
            updated: 0,
            errors: 0,
            details: []
        };
        
        for (const leave of approvedLeaves) {
            const employeeId = leave.employee.toString ? leave.employee.toString() : leave.employee;
            
            for (const leaveDate of leave.leaveDates) {
                const dateStr = normalizeDateToIST(leaveDate);
                const key = `${employeeId}-${dateStr}`;
                
                // Skip if already processed
                if (processedDates.has(key)) {
                    continue;
                }
                processedDates.add(key);
                results.totalDates++;
                
                try {
                    const result = await recalculateAndUpdateAttendanceStatus(employeeId, dateStr);
                    if (result.updated) {
                        results.updated++;
                        results.details.push({
                            userId: employeeId,
                            date: dateStr,
                            oldStatus: result.oldStatus,
                            newStatus: result.newStatus,
                            leaveType: leave.requestType
                        });
                    }
                } catch (error) {
                    results.errors++;
                    console.error(`Error backfilling ${key}:`, error);
                }
            }
        }
        
        return results;
    } catch (error) {
        console.error('Error in backfillAttendanceForLeaves:', error);
        throw error;
    }
};

module.exports = {
    recalculateAttendanceStatus,
    recalculateAndUpdateAttendanceStatus,
    recalculateAttendanceForLeave,
    backfillAttendanceForLeaves
};

