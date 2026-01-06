const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authenticateToken = require('../middleware/authenticateToken');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const LeaveRequest = require('../models/LeaveRequest');
const Holiday = require('../models/Holiday');
const AntiExploitationLeaveService = require('../services/antiExploitationLeaveService');
const { parseISTDate, getTodayIST, formatDateIST, addDaysIST, addMonthsIST, daysDifferenceIST } = require('../utils/dateUtils');

const isAdminOrHr = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required. Please log in again.' });
    }
    if (!['Admin', 'HR'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access forbidden: Requires Admin or HR role.' });
    }
    next();
};

router.get('/', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const getAllEmployees = req.query.all === 'true';
        const fieldsToSelect = '_id fullName employeeCode alternateSaturdayPolicy shiftGroup department email leaveBalances leaveEntitlements isActive role joiningDate profileImageUrl employmentStatus probationEndDate internshipDurationMonths';
        if (getAllEmployees) {
            const employees = await User.find({}).select(fieldsToSelect).populate('shiftGroup', 'shiftName startTime endTime durationHours paidBreakMinutes').sort({ fullName: 1 }).lean();
            return res.json(employees);
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const totalCount = await User.countDocuments({});
        const employees = await User.find({}).select(fieldsToSelect).populate('shiftGroup').sort({ fullName: 1 }).skip(skip).limit(limit).lean();
        res.json({ employees, totalCount, currentPage: page, totalPages: Math.ceil(totalCount / limit) });
    } catch (error) {
        console.error('Failed to fetch employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});

router.post('/', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        res.status(501).json({ error: 'Employee creation not yet implemented' });
    } catch (error) {
        console.error('Failed to create employee:', error);
        res.status(500).json({ error: 'Failed to create employee' });
    }
});

router.put('/:id', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        res.status(501).json({ error: 'Employee update not yet implemented' });
    } catch (error) {
        console.error('Failed to update employee:', error);
        res.status(500).json({ error: 'Failed to update employee' });
    }
});

router.delete('/:id', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        res.status(501).json({ error: 'Employee deletion not yet implemented' });
    } catch (error) {
        console.error('Failed to delete employee:', error);
        res.status(500).json({ error: 'Failed to delete employee' });
    }
});

router.get('/:id/probation-status', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const employee = await User.findById(req.params.id).select('fullName employeeCode employeeType probationStatus probationStartDate probationEndDate probationDurationMonths conversionDate joiningDate');
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });
        let remainingDays = null;
        if (employee.probationEndDate && employee.probationStatus === 'On Probation') {
            const today = getTodayIST();
            const endDate = parseISTDate(employee.probationEndDate);
            if (endDate) {
                remainingDays = daysDifferenceIST(today, endDate);
            }
        }
        res.json({ employee: { id: employee._id, fullName: employee.fullName, employeeCode: employee.employeeCode, employeeType: employee.employeeType, probationStatus: employee.probationStatus, probationStartDate: employee.probationStartDate, probationEndDate: employee.probationEndDate, probationDurationMonths: employee.probationDurationMonths, conversionDate: employee.conversionDate, joiningDate: employee.joiningDate, remainingDays } });
    } catch (error) {
        console.error('Error fetching probation status:', error);
        res.status(500).json({ error: 'Failed to fetch probation status.' });
    }
});

router.post('/:id/probation-settings', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        res.status(501).json({ error: 'Probation settings update not yet implemented' });
    } catch (error) {
        console.error('Failed to update probation settings:', error);
        res.status(500).json({ error: 'Failed to update probation settings' });
    }
});

router.get('/probation/calculations', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const PROBATION_PERIOD_DAYS = parseInt(process.env.PROBATION_PERIOD_DAYS, 10) || 180;
        const probationEmployees = await User.find({
            employmentStatus: 'Probation',
            isActive: true
        }).select('_id fullName employeeCode joiningDate alternateSaturdayPolicy').lean();
        
        const calculations = [];
        const todayIST = getTodayIST();
        
        for (const employee of probationEmployees) {
            try {
                if (!employee.joiningDate) {
                    calculations.push({
                        employeeId: employee._id,
                        employeeCode: employee.employeeCode,
                        fullName: employee.fullName,
                        error: 'Joining date not found'
                    });
                    continue;
                }
                
                const joiningDateIST = parseISTDate(employee.joiningDate);
                if (!joiningDateIST) {
                    calculations.push({
                        employeeId: employee._id,
                        employeeCode: employee.employeeCode,
                        fullName: employee.fullName,
                        error: 'Invalid joining date'
                    });
                    continue;
                }
                const joiningDateStr = formatDateIST(joiningDateIST);
                
                const leaveRequests = await LeaveRequest.find({
                    employee: employee._id,
                    status: 'Approved',
                    leaveDates: {
                        $elemMatch: {
                            $gte: joiningDateIST
                        }
                    }
                }).lean();
                
                let fullDayLeaveCount = 0;
                let halfDayLeaveCount = 0;
                const leaveDatesSet = new Set();
                
                leaveRequests.forEach(leave => {
                    leave.leaveDates.forEach(leaveDate => {
                        const leaveDateObj = parseISTDate(leaveDate);
                        if (leaveDateObj && leaveDateObj >= joiningDateIST) {
                            const leaveDateStr = formatDateIST(leaveDateObj);
                            if (leaveDateStr && !leaveDatesSet.has(leaveDateStr)) {
                                leaveDatesSet.add(leaveDateStr);
                                if (leave.leaveType === 'Full Day') {
                                    fullDayLeaveCount++;
                                } else if (leave.leaveType && leave.leaveType.includes('Half Day')) {
                                    halfDayLeaveCount++;
                                }
                            }
                        }
                    });
                });
                
                const leaveExtensionDays = fullDayLeaveCount + (halfDayLeaveCount * 0.5);
                
                const attendanceLogs = await AttendanceLog.find({
                    user: employee._id,
                    attendanceDate: { $gte: joiningDateStr }
                }).lean();
                
                const holidays = await Holiday.find({
                    date: {
                        $gte: joiningDateIST,
                        $lte: todayIST,
                        $ne: null
                    },
                    isTentative: { $ne: true }
                }).lean();
                
                const holidayDatesSet = new Set();
                holidays.forEach(h => {
                    const holidayDate = parseISTDate(h.date);
                    if (holidayDate && holidayDate >= joiningDateIST && holidayDate <= todayIST) {
                        const dateStr = formatDateIST(holidayDate);
                        if (dateStr) holidayDatesSet.add(dateStr);
                    }
                });
                
                const companyHolidaysCount = holidayDatesSet.size;
                const saturdayPolicy = employee.alternateSaturdayPolicy || 'All Saturdays Working';
                let absentFullDays = 0;
                let absentHalfDays = 0;
                const attendanceDatesSet = new Set();
                attendanceLogs.forEach(log => {
                    if (log.attendanceDate) attendanceDatesSet.add(log.attendanceDate);
                });
                
                let currentDate = new Date(joiningDateIST);
                while (currentDate <= todayIST) {
                    const dateStr = formatDateIST(currentDate);
                    if (!dateStr) break;
                    const dayOfWeek = currentDate.getDay();
                    
                    if (dayOfWeek === 0) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }
                    
                    if (dayOfWeek === 6) {
                        if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
                            currentDate.setDate(currentDate.getDate() + 1);
                            continue;
                        }
                    }
                    
                    if (holidayDatesSet.has(dateStr)) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }
                    
                    if (!attendanceDatesSet.has(dateStr)) {
                        absentFullDays++;
                    } else {
                        const log = attendanceLogs.find(l => l.attendanceDate === dateStr);
                        if (log && (log.attendanceStatus === 'Absent' || (!log.clockInTime && !log.clockOutTime))) {
                            absentFullDays++;
                        }
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                
                const baseEndDate = addDaysIST(joiningDateIST, PROBATION_PERIOD_DAYS);
                
                const totalExtensionDays = leaveExtensionDays + absentFullDays + (absentHalfDays * 0.5);
                const tentativeEndDate = addDaysIST(baseEndDate, Math.ceil(totalExtensionDays));
                
                const daysLeft = daysDifferenceIST(todayIST, tentativeEndDate);
                
                calculations.push({
                    employeeId: employee._id,
                    employeeCode: employee.employeeCode || 'N/A',
                    fullName: employee.fullName || 'N/A',
                    joiningDate: formatDateIST(joiningDateIST),
                    fullDayLeave: fullDayLeaveCount,
                    halfDayLeave: halfDayLeaveCount,
                    leaveExtensionDays: parseFloat(leaveExtensionDays.toFixed(1)),
                    companyHolidays: companyHolidaysCount,
                    absentDays: absentFullDays + (absentHalfDays * 0.5),
                    baseEndDate: formatDateIST(baseEndDate),
                    tentativeEndDate: formatDateIST(tentativeEndDate),
                    daysLeft: daysLeft !== null ? daysLeft : null,
                    status: daysLeft === null ? 'Not Assigned' : (daysLeft < 0 ? 'Completed' : (daysLeft <= 7 ? 'Critical' : (daysLeft <= 15 ? 'Warning' : 'On Track')))
                });
                
            } catch (empError) {
                console.error(`Error calculating for employee ${employee._id}:`, empError);
                calculations.push({
                    employeeId: employee._id,
                    employeeCode: employee.employeeCode,
                    fullName: employee.fullName,
                    error: empError.message
                });
            }
        }
        
        res.json({ calculations });
        
    } catch (error) {
        console.error('Error fetching probation calculations:', error);
        res.status(500).json({ error: 'Failed to fetch probation calculations' });
    }
});

/**
 * Helper function to calculate working days between two dates
 * Excludes: Sundays, alternate Saturdays (based on policy), Holidays
 */
async function calculateWorkingDaysBetween(startDate, endDate, saturdayPolicy, holidays) {
    const holidayDatesSet = new Set();
    holidays.forEach(h => {
        const holidayDate = parseISTDate(h.date);
        if (holidayDate) {
            const dateStr = formatDateIST(holidayDate);
            if (dateStr) holidayDatesSet.add(dateStr);
        }
    });
    
    let workingDaysCount = 0;
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    while (currentDate <= endDateObj) {
        const dateStr = formatDateIST(currentDate);
        if (!dateStr) break;
        const dayOfWeek = currentDate.getDay();
        
        if (dayOfWeek === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        if (dayOfWeek === 6) {
            if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
        }
        
        if (holidayDatesSet.has(dateStr)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        workingDaysCount++;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDaysCount;
}

/**
 * Helper function to add working days to a start date
 */
async function addWorkingDays(startDate, workingDaysToAdd, saturdayPolicy, holidays) {
    const holidayDatesSet = new Set();
    holidays.forEach(h => {
        const holidayDate = parseISTDate(h.date);
        if (holidayDate) {
            const dateStr = formatDateIST(holidayDate);
            if (dateStr) holidayDatesSet.add(dateStr);
        }
    });
    
    let currentDate = new Date(startDate);
    let workingDaysCounted = 0;
    const maxIterations = 365 * 5;
    let iterations = 0;
    
    while (workingDaysCounted < workingDaysToAdd && iterations < maxIterations) {
        iterations++;
        const dateStr = formatDateIST(currentDate);
        if (!dateStr) break;
        const dayOfWeek = currentDate.getDay();
        
        if (dayOfWeek === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        if (dayOfWeek === 6) {
            if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
        }
        
        if (holidayDatesSet.has(dateStr)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        workingDaysCounted++;
        if (workingDaysCounted < workingDaysToAdd) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
    
    return currentDate;
}

router.get('/internship/calculations', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const internEmployees = await User.find({
            employmentStatus: 'Intern',
            isActive: true
        }).select('_id fullName employeeCode joiningDate internshipDurationMonths alternateSaturdayPolicy').lean();
        
        const calculations = [];
        const todayIST = getTodayIST();
        
        for (const employee of internEmployees) {
            try {
                if (!employee.joiningDate) {
                    calculations.push({
                        employeeId: employee._id,
                        employeeCode: employee.employeeCode,
                        fullName: employee.fullName,
                        error: 'Joining date not found'
                    });
                    continue;
                }
                
                const joiningDateIST = parseISTDate(employee.joiningDate);
                if (!joiningDateIST) {
                    calculations.push({
                        employeeId: employee._id,
                        employeeCode: employee.employeeCode,
                        fullName: employee.fullName,
                        error: 'Invalid joining date'
                    });
                    continue;
                }
                const joiningDateStr = formatDateIST(joiningDateIST);
                
                if (!employee.internshipDurationMonths || employee.internshipDurationMonths <= 0) {
                    calculations.push({
                        employeeId: employee._id,
                        employeeCode: employee.employeeCode || 'N/A',
                        fullName: employee.fullName || 'N/A',
                        joiningDate: formatDateIST(joiningDateIST),
                        internshipDurationMonths: null,
                        fullDayLeave: 0,
                        halfDayLeave: 0,
                        leaveExtensionDays: 0,
                        absentDays: 0,
                        companyHolidays: 0,
                        internshipEndDate: null,
                        daysLeft: null,
                        status: 'Not Assigned'
                    });
                    continue;
                }
                
                const saturdayPolicy = employee.alternateSaturdayPolicy || 'All Saturdays Working';
                
                const baseEndDateCalendar = addMonthsIST(joiningDateIST, employee.internshipDurationMonths);
                if (!baseEndDateCalendar) {
                    calculations.push({
                        employeeId: employee._id,
                        employeeCode: employee.employeeCode,
                        fullName: employee.fullName,
                        error: 'Invalid base end date calculation'
                    });
                    continue;
                }
                
                const futureDate = addDaysIST(baseEndDateCalendar, 60);
                const allHolidays = await Holiday.find({
                    date: {
                        $gte: joiningDateIST,
                        $lte: futureDate,
                        $ne: null
                    },
                    isTentative: { $ne: true }
                }).lean();
                
                const internshipWorkingDays = await calculateWorkingDaysBetween(joiningDateIST, baseEndDateCalendar, saturdayPolicy, allHolidays);
                
                const holidayDatesSet = new Set();
                allHolidays.forEach(h => {
                    const holidayDate = parseISTDate(h.date);
                    if (holidayDate && holidayDate >= joiningDateIST && holidayDate <= baseEndDateCalendar) {
                        const dateStr = formatDateIST(holidayDate);
                        if (dateStr) holidayDatesSet.add(dateStr);
                    }
                });
                const companyHolidaysCount = holidayDatesSet.size;
                
                const allHolidayDatesSet = new Set();
                allHolidays.forEach(h => {
                    const holidayDate = parseISTDate(h.date);
                    if (holidayDate) {
                        const dateStr = formatDateIST(holidayDate);
                        if (dateStr) allHolidayDatesSet.add(dateStr);
                    }
                });
                
                const leaveRequests = await LeaveRequest.find({
                    employee: employee._id,
                    status: 'Approved',
                    leaveDates: {
                        $elemMatch: {
                            $gte: joiningDateIST
                        }
                    }
                }).lean();
                
                let fullDayLeaveCount = 0;
                let halfDayLeaveCount = 0;
                const leaveDatesSet = new Set();
                
                leaveRequests.forEach(leave => {
                    leave.leaveDates.forEach(leaveDate => {
                        const leaveDateObj = parseISTDate(leaveDate);
                        if (leaveDateObj && leaveDateObj >= joiningDateIST) {
                            const leaveDateStr = formatDateIST(leaveDateObj);
                            if (leaveDateStr && !leaveDatesSet.has(leaveDateStr)) {
                                leaveDatesSet.add(leaveDateStr);
                                if (leave.leaveType === 'Full Day') {
                                    fullDayLeaveCount++;
                                } else if (leave.leaveType && leave.leaveType.includes('Half Day')) {
                                    halfDayLeaveCount++;
                                }
                            }
                        }
                    });
                });
                
                const leaveExtensionDays = fullDayLeaveCount + (halfDayLeaveCount * 0.5);
                
                const attendanceLogs = await AttendanceLog.find({
                    user: employee._id,
                    attendanceDate: { $gte: joiningDateStr, $lte: formatDateIST(todayIST) }
                }).lean();
                
                // Build set of dates with approved leaves (to exclude from absent count)
                const leaveDateSet = new Set(leaveDatesSet);
                
                // Build map of attendance logs by date for quick lookup
                const attendanceLogMap = new Map();
                attendanceLogs.forEach(log => {
                    if (log.attendanceDate) {
                        attendanceLogMap.set(log.attendanceDate, log);
                    }
                });
                
                let absentFullDays = 0;
                let absentHalfDays = 0;
                
                // Count absents from joining date to TODAY (not baseEndDateCalendar)
                let currentDate = new Date(joiningDateIST);
                while (currentDate <= todayIST) {
                    const dateStr = formatDateIST(currentDate);
                    if (!dateStr) break;
                    const dayOfWeek = currentDate.getDay();
                    
                    // Skip Sundays
                    if (dayOfWeek === 0) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }
                    
                    // Skip alternate Saturdays (non-working Saturdays)
                    if (dayOfWeek === 6) {
                        if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
                            currentDate.setDate(currentDate.getDate() + 1);
                            continue;
                        }
                    }
                    
                    // Skip holidays
                    if (allHolidayDatesSet.has(dateStr)) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }
                    
                    // CRITICAL: Skip if there's an approved leave on this date (no double counting)
                    if (leaveDateSet.has(dateStr)) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }
                    
                    // This is a working day - check if absent
                    const attendanceLog = attendanceLogMap.get(dateStr);
                    
                    if (!attendanceLog) {
                        // No attendance record = absent (full day)
                        absentFullDays++;
                    } else {
                        // Check attendance status
                        const status = attendanceLog.attendanceStatus;
                        const hasClockIn = !!attendanceLog.clockInTime;
                        const hasClockOut = !!attendanceLog.clockOutTime;
                        
                        // Count as absent if:
                        // 1. Status is explicitly 'Absent'
                        // 2. OR no clock-in AND no clock-out (truly absent)
                        if (status === 'Absent' || (!hasClockIn && !hasClockOut)) {
                            absentFullDays++;
                        } 
                        // Count as half-day absent if:
                        // 3. Status is 'Half-day' OR isHalfDay flag is true
                        else if (status === 'Half-day' || attendanceLog.isHalfDay === true) {
                            absentHalfDays += 0.5;
                        }
                        // Otherwise, employee was present (On-time or Late), do not count as absent
                    }
                    
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                
                const totalExtensionDays = leaveExtensionDays + absentFullDays + absentHalfDays;
                const totalWorkingDaysNeeded = internshipWorkingDays + Math.ceil(totalExtensionDays);
                
                const internshipEndDate = await addWorkingDays(joiningDateIST, totalWorkingDaysNeeded, saturdayPolicy, allHolidays);
                
                const daysLeft = await calculateWorkingDaysBetween(todayIST, internshipEndDate, saturdayPolicy, allHolidays);
                
                calculations.push({
                    employeeId: employee._id,
                    employeeCode: employee.employeeCode || 'N/A',
                    fullName: employee.fullName || 'N/A',
                    joiningDate: formatDateIST(joiningDateIST),
                    internshipDurationMonths: employee.internshipDurationMonths || null,
                    fullDayLeave: fullDayLeaveCount,
                    halfDayLeave: halfDayLeaveCount,
                    leaveExtensionDays: parseFloat(leaveExtensionDays.toFixed(1)),
                    absentDays: absentFullDays + absentHalfDays,
                    companyHolidays: companyHolidaysCount,
                    internshipEndDate: formatDateIST(internshipEndDate),
                    daysLeft: daysLeft !== null ? daysLeft : null,
                    status: daysLeft === null ? 'Not Assigned' : (daysLeft < 0 ? 'Completed' : (daysLeft <= 7 ? 'Critical' : (daysLeft <= 15 ? 'Warning' : 'On Track')))
                });
                
            } catch (empError) {
                console.error(`Error calculating for intern ${employee._id}:`, empError);
                calculations.push({
                    employeeId: employee._id,
                    employeeCode: employee.employeeCode,
                    fullName: employee.fullName,
                    error: empError.message
                });
            }
        }
        
        res.json({ calculations });
        
    } catch (error) {
        console.error('Error fetching internship calculations:', error);
        res.status(500).json({ error: 'Failed to fetch internship calculations' });
    }
});

module.exports = router;
