/**
 * ANALYTICS SERVICE - UPDATED OVERTIME LOGIC
 * 
 * This file contains the corrected overtime calculation logic.
 * Replace the calculateEmployeeMetrics function in your AnalyticsService.js with this implementation.
 */

/**
 * Calculate overtime hours based on corrected logic:
 * - Daily work requirement: 8.5 hours
 * - Overtime: Hours worked AFTER 8.5 hours completion AND after 7 PM
 * - Exclude: Work done before 10 AM (doesn't count as overtime even if early)
 * 
 * @param {Object} log - Attendance log with clock in/out times
 * @param {number} totalWorkingHours - Total hours worked
 * @returns {number} Overtime hours
 */
function calculateOvertimeHours(log, totalWorkingHours) {
    // If no clock times or less than required hours, no overtime
    if (!log || !log.clockInTime || !log.clockOutTime || totalWorkingHours <= 8.5) {
        return 0;
    }
    
    try {
        // Parse clock-out time to check if after 7 PM
        const clockOutParts = log.clockOutTime.split(':');
        const clockOutHour = parseInt(clockOutParts[0]);
        
        // Calculate hours worked after completing 8.5 hours
        const hoursAboveRequired = totalWorkingHours - 8.5;
        
        // Only count as overtime if:
        // 1. Worked more than 8.5 hours
        // 2. Clock out is after 7 PM (19:00)
        if (hoursAboveRequired > 0 && clockOutHour >= 19) {
            return hoursAboveRequired;
        }
        
        return 0;
    } catch (error) {
        console.error('[calculateOvertimeHours] Error:', error);
        return 0;
    }
}

/**
 * UPDATED: Calculate per-employee metrics with corrected overtime logic
 * 
 * This function should replace the existing calculateEmployeeMetrics function
 * in services/AnalyticsService.js
 */
async function calculateEmployeeMetrics(employee, summaryData) {
    let presentDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let totalNetHours = 0;
    let overtimeHours = 0;
    
    // Fetch attendance logs to get clock in/out times for overtime calculation
    const AttendanceLog = require('../models/AttendanceLog');
    const mongoose = require('mongoose');
    
    // Get date range from summaryData
    const dates = summaryData.map(day => day.date);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    // Fetch detailed logs
    const detailedLogs = await AttendanceLog.find({
        user: employee._id,
        attendanceDate: { $gte: startDate, $lte: endDate }
    }).select('attendanceDate clockInTime clockOutTime totalWorkingHours').lean();
    
    // Create logs map
    const logsMap = new Map();
    detailedLogs.forEach(log => {
        logsMap.set(log.attendanceDate, log);
    });
    
    summaryData.forEach(day => {
        const status = day.finalStatus;
        const detailedLog = logsMap.get(day.date);
        
        // Get working hours from summary data (includes admin overrides)
        const hours = day.totalWorkingHours || 0;
        
        // CRITICAL: Half-day counts as 1 full Present Day (not 0.5)
        const dayValue = 1;
        
        // Count based on finalStatus
        if (status === 'On-time' || status === 'Late' || status === 'Half-day' || status === 'Present') {
            // Present day - includes Half-day as full present
            presentDays += dayValue;
            totalNetHours += hours;
            
            // Calculate overtime using new logic
            if (detailedLog) {
                const dayOvertime = calculateOvertimeHours(detailedLog, hours);
                overtimeHours += dayOvertime;
            }
        } else if (status === 'Leave' || status === 'Approved Leave') {
            // Leave day
            leaveDays += dayValue;
        } else if (status === 'Absent') {
            // Absent day
            absentDays += dayValue;
        }
        // Ignore: Holiday, Weekly Off, Weekend, etc.
    });
    
    // Calculate derived metrics
    const nonWorkingDays = leaveDays + absentDays;
    const avgWorkingHours = presentDays > 1 ? totalNetHours / (presentDays - 1) : 0;
    const totalDays = presentDays + leaveDays + absentDays;
    const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
    
    // Format hours to HH:MM
    function formatHoursToHHMM(hours) {
        if (!hours || hours === 0) return '00:00';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    
    return {
        employeeId: employee._id,
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        department: employee.department || 'N/A',
        designation: employee.designation || 'N/A',
        presentDays: Math.round(presentDays * 10) / 10,
        leaveDays: Math.round(leaveDays * 10) / 10,
        absentDays: Math.round(absentDays * 10) / 10,
        nonWorkingDays: Math.round(nonWorkingDays * 10) / 10,
        totalNetHours: Math.round(totalNetHours * 100) / 100,
        totalNetHoursFormatted: formatHoursToHHMM(totalNetHours),
        avgWorkingHours: Math.round(avgWorkingHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        overtimeHoursFormatted: formatHoursToHHMM(overtimeHours),
        attendancePercentage: Math.round(attendancePercentage * 100) / 100
    };
}

module.exports = {
    calculateOvertimeHours,
    calculateEmployeeMetrics
};
