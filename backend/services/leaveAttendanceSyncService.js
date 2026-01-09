// backend/services/leaveAttendanceSyncService.js
/**
 * Service to synchronize AttendanceLog records with LeaveRequest status changes.
 * This ensures Attendance is the single source of truth for daily status.
 */

const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const { recalculateLateStatus } = require('./dailyStatusService');

/**
 * Sync attendance records when a leave is approved.
 * Creates or updates AttendanceLog records for each leave date with status "Leave".
 * 
 * @param {Object} leaveRequest - The LeaveRequest document
 * @param {Object} session - MongoDB session for transaction
 * @returns {Promise<Array>} Array of created/updated AttendanceLog IDs
 */
const syncAttendanceOnLeaveApproval = async (leaveRequest, session) => {
    const employeeId = leaveRequest.employee;
    const leaveDates = leaveRequest.leaveDates || [];
    const updatedLogs = [];

    // Get employee - shiftGroup is optional for leave days
    // We don't need shiftGroup for leave days, so we won't populate it to avoid model registration issues
    const employee = await User.findById(employeeId).select('shiftGroup').session(session);
    if (!employee) {
        throw new Error('Employee not found for attendance sync');
    }

    // Get shift duration - use default if shiftGroup not available
    // For leave days, we don't need actual shift info, just a default duration
    let shiftDurationMinutes = 540; // Default 9 hours

    // Try to get shift duration if shiftGroup exists, but don't fail if it doesn't
    if (employee.shiftGroup) {
        try {
            // Only populate if we have a Shift model available
            const Shift = mongoose.model('Shift');
            if (Shift) {
                const shift = await Shift.findById(employee.shiftGroup).session(session);
                if (shift && shift.durationHours) {
                    shiftDurationMinutes = shift.durationHours * 60;
                }
            }
        } catch (err) {
            // Shift model not available or populate failed - use default
            console.warn(`Could not load shift for employee ${employeeId}, using default duration:`, err.message);
        }
    }

    for (const leaveDate of leaveDates) {
        // Normalize date to YYYY-MM-DD format
        // Handle both Date objects and date strings
        let dateObj;
        if (leaveDate instanceof Date) {
            dateObj = leaveDate;
        } else if (typeof leaveDate === 'string') {
            // If it's already in YYYY-MM-DD format, use it directly
            if (/^\d{4}-\d{2}-\d{2}$/.test(leaveDate)) {
                dateObj = new Date(leaveDate + 'T00:00:00');
            } else {
                dateObj = new Date(leaveDate);
            }
        } else {
            dateObj = new Date(leaveDate);
        }

        // Ensure we get the date in YYYY-MM-DD format (local date, not UTC)
        // This prevents timezone issues where Dec 1 might become Nov 30 in UTC
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // Check if attendance log already exists for this date
        const existingLog = await AttendanceLog.findOne({
            user: employeeId,
            attendanceDate: dateStr
        }).session(session);

        if (existingLog) {
            // Log exists - update it to Leave status
            // But preserve clock-in data if it exists (edge case: employee clocked in then leave approved)
            const hasClockIn = existingLog.clockInTime && existingLog.clockInTime instanceof Date;

            if (hasClockIn) {
                // FIXED: Preserve worked hours, don't void attendance
                // Store original attendance data in metadata for payroll
                const workedHours = existingLog.totalWorkingHours || 0;
                const clockInTime = existingLog.clockInTime;
                const clockOutTime = existingLog.clockOutTime;
                
                const auditNote = `[LEAVE-APPROVED-BACKDATED] Attendance preserved for payroll. Worked: ${workedHours}h. Clock-In: ${clockInTime?.toISOString()} - Clock-Out: ${clockOutTime?.toISOString() || 'Active'}. Leave Type: ${leaveRequest.leaveType || 'Full Day'}`;

                existingLog.notes = existingLog.notes ? existingLog.notes + '; ' + auditNote : auditNote;
                
                // If Half-Day leave, preserve attendance as Half-Day Present
                if (leaveRequest.leaveType && leaveRequest.leaveType.startsWith('Half Day')) {
                    existingLog.attendanceStatus = 'Half-Day';
                    existingLog.isHalfDay = true;
                    // Keep clock times - employee worked half day
                } else {
                    // Full-Day leave - mark as Leave but preserve hours in metadata
                    existingLog.attendanceStatus = 'Leave';
                    // Store worked hours in custom field for payroll reference
                    existingLog.preservedWorkingHours = workedHours;
                    existingLog.preservedClockIn = clockInTime;
                    existingLog.preservedClockOut = clockOutTime;
                    // Don't delete clock times - keep for audit trail
                }
                existingLog.leaveRequest = leaveRequest._id;
            } else {
                // No clock-in - safe to mark as Leave
                existingLog.attendanceStatus = 'Leave';
                existingLog.leaveRequest = leaveRequest._id;
                // Clear any derived status fields since this is a leave day
                existingLog.isLate = false;
                existingLog.isHalfDay = false;
                existingLog.lateMinutes = 0;
            }

            await existingLog.save({ session });
            updatedLogs.push(existingLog._id);
        } else {
            // No log exists - create new AttendanceLog for leave day
            // Note: clockInTime is optional in schema for leave days
            const newLogData = {
                user: employeeId,
                attendanceDate: dateStr,
                attendanceStatus: 'Leave',
                leaveRequest: leaveRequest._id,
                shiftDurationMinutes: shiftDurationMinutes,
                penaltyMinutes: 0,
                paidBreakMinutesTaken: 0,
                unpaidBreakMinutesTaken: 0,
                isLate: false,
                isHalfDay: false,
                lateMinutes: 0,
                totalWorkingHours: 0
            };

            // Only set clockInTime/clockOutTime to null explicitly if needed
            // Leave them undefined to avoid validation issues
            const newLog = await AttendanceLog.create([newLogData], { session });

            updatedLogs.push(newLog[0]._id);
        }
    }

    return updatedLogs;
};

/**
 * Revert attendance records when a leave is rejected or cancelled after approval.
 * If no clock-in exists, set status back to "Absent".
 * If clock-in exists, recalculate status based on clock-in time.
 * 
 * @param {Object} leaveRequest - The LeaveRequest document
 * @param {Object} session - MongoDB session for transaction
 * @returns {Promise<Array>} Array of updated AttendanceLog IDs
 */
const syncAttendanceOnLeaveRejection = async (leaveRequest, session) => {
    const employeeId = leaveRequest.employee;
    const leaveDates = leaveRequest.leaveDates || [];
    const updatedLogs = [];

    // Get employee - shiftGroup is optional for recalculation
    const employee = await User.findById(employeeId).select('shiftGroup').session(session);
    if (!employee) {
        throw new Error('Employee not found for attendance sync');
    }

    // Load shiftGroup for recalculation if needed
    let shiftGroup = null;
    if (employee.shiftGroup) {
        try {
            const Shift = mongoose.model('Shift');
            if (Shift) {
                shiftGroup = await Shift.findById(employee.shiftGroup).session(session);
            }
        } catch (err) {
            // Shift model not available - continue without it
        }
    }

    for (const leaveDate of leaveDates) {
        // Normalize date to YYYY-MM-DD format
        // Handle both Date objects and date strings
        let dateObj;
        if (leaveDate instanceof Date) {
            dateObj = leaveDate;
        } else if (typeof leaveDate === 'string') {
            // If it's already in YYYY-MM-DD format, use it directly
            if (/^\d{4}-\d{2}-\d{2}$/.test(leaveDate)) {
                dateObj = new Date(leaveDate + 'T00:00:00');
            } else {
                dateObj = new Date(leaveDate);
            }
        } else {
            dateObj = new Date(leaveDate);
        }

        // Ensure we get the date in YYYY-MM-DD format (local date, not UTC)
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // Find attendance log for this date
        // First try to find log linked to this leave, but if not found, find any log for this date
        // This handles cases where employee worked on a date that was later marked as leave
        let existingLog = await AttendanceLog.findOne({
            user: employeeId,
            attendanceDate: dateStr,
            leaveRequest: leaveRequest._id // First try to find log linked to this leave
        }).session(session);

        // If not found by leaveRequest, find any log for this date (might have clock-in data)
        if (!existingLog) {
            existingLog = await AttendanceLog.findOne({
                user: employeeId,
                attendanceDate: dateStr
            }).session(session);
        }

        if (existingLog) {
            const hasClockIn = existingLog.clockInTime && existingLog.clockInTime instanceof Date;

            if (hasClockIn) {
                // Employee clocked in - recalculate status based on clock-in time
                console.log(`[LEAVE_REVERT] Recalculating attendance for ${dateStr} - employee clocked in at ${existingLog.clockInTime}`);
                if (shiftGroup && shiftGroup.startTime) {
                    const recalculatedStatus = await recalculateLateStatus(
                        existingLog.clockInTime,
                        shiftGroup
                    );
                    existingLog.attendanceStatus = recalculatedStatus.attendanceStatus;
                    existingLog.isLate = recalculatedStatus.isLate;
                    existingLog.isHalfDay = recalculatedStatus.isHalfDay;
                    existingLog.lateMinutes = recalculatedStatus.lateMinutes;
                    console.log(`[LEAVE_REVERT] Recalculated status: ${recalculatedStatus.attendanceStatus}`);
                } else {
                    // No shift info - default to On-time
                    existingLog.attendanceStatus = 'On-time';
                    existingLog.isLate = false;
                    existingLog.isHalfDay = false;
                    existingLog.lateMinutes = 0;
                    console.log(`[LEAVE_REVERT] No shift info - defaulting to On-time`);
                }
            } else {
                // No clock-in - check if log was created only for leave (no other data)
                // If log has no clock-in and was created for leave, we can delete it
                // Otherwise, set to Absent
                if (existingLog.leaveRequest && existingLog.leaveRequest.equals(leaveRequest._id) &&
                    !existingLog.clockInTime && !existingLog.clockOutTime && !existingLog.notes) {
                    // Log was created only for leave - delete it
                    await AttendanceLog.findByIdAndDelete(existingLog._id, { session });
                    console.log(`[LEAVE_REVERT] Deleted attendance log for ${dateStr} (created only for leave)`);
                    updatedLogs.push(existingLog._id);
                    continue;
                } else {
                    // Log has other data or wasn't created for this leave - set to Absent
                    existingLog.attendanceStatus = 'Absent';
                    existingLog.isLate = false;
                    existingLog.isHalfDay = false;
                    existingLog.lateMinutes = 0;
                    console.log(`[LEAVE_REVERT] Set status to Absent for ${dateStr} (no clock-in)`);
                }
            }

            // Remove leave reference
            existingLog.leaveRequest = null;
            await existingLog.save({ session });
            updatedLogs.push(existingLog._id);
        } else {
            console.log(`[LEAVE_REVERT] No attendance log found for ${dateStr} - nothing to revert`);
        }
        // If log doesn't exist or wasn't created for this leave, no action needed
    }

    return updatedLogs;
};

module.exports = {
    syncAttendanceOnLeaveApproval,
    syncAttendanceOnLeaveRejection
};

