/**
 * ANALYTICS SERVICE V2 - REFACTORED
 * 
 * CRITICAL FIX: Uses AttendanceSummaryService as single source of truth
 * 
 * Previous Issue:
 * - Analytics used raw AttendanceLog.attendanceStatus field
 * - Did not apply status resolution logic (holidays, weekly offs, etc.)
 * - Showed different counts than Attendance Summary Calendar
 * 
 * New Approach:
 * - Uses AttendanceSummaryService.getEmployeeAttendanceSummary()
 * - Calculates metrics from resolved finalStatus
 * - Matches Attendance Summary Calendar exactly
 * - Single source of truth for all attendance data
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Shift = require('../models/Shift');
const AttendanceSummaryService = require('./AttendanceSummaryService');

/**
 * Calculate attendance metrics for filtered employees
 * 
 * @param {Object} filters - Filter criteria
 * @param {string} filters.startDate - Start date (YYYY-MM-DD)
 * @param {string} filters.endDate - End date (YYYY-MM-DD)
 * @param {string} [filters.department] - Department filter
 * @param {string} [filters.location] - Location filter
 * @param {string} [filters.shiftType] - Shift type filter ('Fixed' | 'Flexible')
 * @param {string} [filters.employmentStatus] - Employment status filter ('Active' | 'Inactive')
 * @param {number} [filters.page=1] - Page number for pagination
 * @param {number} [filters.limit=50] - Records per page
 * 
 * @returns {Promise<Object>} Analytics result with summary and employee metrics
 */
async function calculateAttendanceMetrics(filters) {
    try {
        // Validate required parameters
        if (!filters.startDate || !filters.endDate) {
            throw new Error('Start date and end date are required');
        }
        
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(filters.startDate) || !dateRegex.test(filters.endDate)) {
            throw new Error('Invalid date format. Use YYYY-MM-DD');
        }
        
        // Validate date range
        if (filters.startDate > filters.endDate) {
            throw new Error('Start date must be before or equal to end date');
        }
        
        // Set pagination defaults
        const page = Math.max(1, parseInt(filters.page) || 1);
        const limit = Math.min(1000, Math.max(1, parseInt(filters.limit) || 50));
        const skip = (page - 1) * limit;
        
        // Build user filter query
        const userQuery = buildUserFilterQuery(filters);
        
        // CRITICAL: Only include ACTIVE employees
        userQuery.isActive = true;
        
        // Get filtered employee IDs
        let employeeQuery = User.find(userQuery).select('_id fullName employeeCode department designation');
        
        // Apply shift type filter if specified
        if (filters.shiftType) {
            const shifts = await Shift.find({ shiftType: filters.shiftType }).select('_id');
            const shiftIds = shifts.map(s => s._id);
            employeeQuery = employeeQuery.where('shiftGroup').in(shiftIds);
        }
        
        const employees = await employeeQuery.lean();
        
        if (employees.length === 0) {
            return {
                summary: {
                    totalEmployees: 0,
                    presentDays: 0,
                    leaveDays: 0,
                    absentDays: 0,
                    nonWorkingDays: 0,
                    attendancePercentage: 0,
                    totalNetHours: 0,
                    averageWorkingHours: 0,
                    overtimeHours: 0
                },
                employeeAnalytics: [],
                pagination: {
                    currentPage: page,
                    totalPages: 0,
                    totalRecords: 0,
                    limit
                }
            };
        }
        
        console.log(`[AnalyticsService V2] Processing ${employees.length} employees...`);
        
        // Calculate metrics for each employee using AttendanceSummaryService
        const employeeMetrics = [];
        
        for (const employee of employees) {
            try {
                // Get attendance summary data (resolved status)
                const summaryData = await AttendanceSummaryService.getEmployeeAttendanceSummary(
                    employee._id,
                    filters.startDate,
                    filters.endDate
                );
                
                // Calculate metrics from finalStatus
                const metrics = calculateEmployeeMetrics(employee, summaryData);
                employeeMetrics.push(metrics);
                
            } catch (error) {
                console.error(`[AnalyticsService V2] Error processing employee ${employee.employeeCode}:`, error.message);
                // Continue with other employees
            }
        }
        
        // Sort by attendance percentage DESC, then by avg working hours DESC
        employeeMetrics.sort((a, b) => {
            if (b.attendancePercentage !== a.attendancePercentage) {
                return b.attendancePercentage - a.attendancePercentage;
            }
            return b.avgWorkingHours - a.avgWorkingHours;
        });
        
        // Add rank to each employee
        employeeMetrics.forEach((emp, index) => {
            emp.rank = index + 1;
            
            // Validate metrics
            validateMetrics(emp, `${emp.employeeName} (${emp.employeeCode})`);
        });
        
        // Calculate summary metrics
        const summary = calculateSummaryMetrics(employeeMetrics);
        
        // Apply pagination
        const totalRecords = employeeMetrics.length;
        const totalPages = Math.ceil(totalRecords / limit);
        const paginatedEmployees = employeeMetrics.slice(skip, skip + limit);
        
        console.log(`[AnalyticsService V2] Completed. Total employees: ${totalRecords}`);
        
        return {
            summary,
            employeeAnalytics: paginatedEmployees,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords,
                limit
            }
        };
    } catch (error) {
        console.error('[AnalyticsService V2] Error calculating attendance metrics:', error);
        throw error;
    }
}

/**
 * Calculate metrics for a single employee from attendance summary data
 * 
 * @param {Object} employee - Employee object with _id, fullName, employeeCode, department, designation
 * @param {Array} summaryData - Array of attendance summary objects with finalStatus
 * @returns {Object} Employee metrics
 */
function calculateEmployeeMetrics(employee, summaryData) {
    let presentDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let totalNetHours = 0;
    let overtimeHours = 0;
    
    // Get shift duration for overtime calculation (default 9 hours)
    const shiftDurationHours = 9;
    
    summaryData.forEach(day => {
        const status = day.finalStatus;
        const hours = day.totalWorkingHours || 0;
        const dayValue = day.isHalfDay ? 0.5 : 1;
        
        // Count based on finalStatus (resolved status from AttendanceSummaryService)
        if (status === 'On-time' || status === 'Late') {
            // Present day
            presentDays += dayValue;
            totalNetHours += hours;
            
            // Calculate overtime (hours beyond shift duration)
            if (hours > shiftDurationHours) {
                overtimeHours += (hours - shiftDurationHours);
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
        avgWorkingHours: Math.round(avgWorkingHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        attendancePercentage: Math.round(attendancePercentage * 100) / 100
    };
}

/**
 * Build user filter query for MongoDB
 * 
 * @param {Object} filters - Filter criteria
 * @returns {Object} MongoDB query object
 */
function buildUserFilterQuery(filters) {
    const query = {};
    
    if (filters.department) {
        query.department = filters.department;
    }
    
    if (filters.location) {
        query.location = filters.location;
    }
    
    if (filters.employmentStatus) {
        query.isActive = filters.employmentStatus === 'Active';
    }
    
    return query;
}

/**
 * Validate metrics integrity
 * 
 * @param {Object} metrics - Metrics object
 * @param {string} context - Context for logging
 * @returns {boolean} True if valid
 */
function validateMetrics(metrics, context = 'unknown') {
    const errors = [];
    
    // CRITICAL CHECK: Non-Working Days = Leave + Absent
    const expectedNonWorking = (metrics.leaveDays || 0) + (metrics.absentDays || 0);
    const actualNonWorking = metrics.nonWorkingDays || 0;
    
    if (Math.abs(expectedNonWorking - actualNonWorking) > 0.01) {
        errors.push({
            check: 'Non-Working Days Invariant',
            severity: 'CRITICAL',
            expected: expectedNonWorking,
            actual: actualNonWorking,
            message: `Non-Working Days (${actualNonWorking}) MUST equal Leave Days (${metrics.leaveDays}) + Absent Days (${metrics.absentDays})`
        });
    }
    
    // Check: Avg Working Hours > 0 implies Present Days > 0
    if ((metrics.avgWorkingHours || 0) > 0 && (metrics.presentDays || 0) === 0) {
        errors.push({
            check: 'Average Hours Validation',
            severity: 'ERROR',
            message: 'Average Working Hours > 0 but Present Days = 0'
        });
    }
    
    if (errors.length > 0) {
        console.error(`[AnalyticsService V2] ❌ Validation failed for ${context}:`, errors);
        
        const criticalErrors = errors.filter(e => e.severity === 'CRITICAL');
        if (criticalErrors.length > 0) {
            throw new Error(`CRITICAL validation failure for ${context}: ${criticalErrors[0].message}`);
        }
    }
    
    return errors.length === 0;
}

/**
 * Calculate summary metrics from employee metrics
 * 
 * @param {Array} employeeMetrics - Array of employee metrics
 * @returns {Object} Summary metrics
 */
function calculateSummaryMetrics(employeeMetrics) {
    if (!employeeMetrics || employeeMetrics.length === 0) {
        return {
            totalEmployees: 0,
            presentDays: 0,
            leaveDays: 0,
            absentDays: 0,
            nonWorkingDays: 0,
            attendancePercentage: 0,
            totalNetHours: 0,
            averageWorkingHours: 0,
            overtimeHours: 0
        };
    }
    
    // Sum all metrics
    const totals = employeeMetrics.reduce((acc, emp) => {
        acc.presentDays += emp.presentDays || 0;
        acc.leaveDays += emp.leaveDays || 0;
        acc.absentDays += emp.absentDays || 0;
        acc.totalNetHours += emp.totalNetHours || 0;
        acc.overtimeHours += emp.overtimeHours || 0;
        return acc;
    }, {
        presentDays: 0,
        leaveDays: 0,
        absentDays: 0,
        totalNetHours: 0,
        overtimeHours: 0
    });
    
    // Calculate derived metrics
    const nonWorkingDays = totals.leaveDays + totals.absentDays;
    const totalDays = totals.presentDays + totals.leaveDays + totals.absentDays;
    const averageWorkingHours = totals.presentDays > 1 ? totals.totalNetHours / (totals.presentDays - 1) : 0;
    const attendancePercentage = totalDays > 0 ? (totals.presentDays / totalDays) * 100 : 0;
    
    const summary = {
        totalEmployees: employeeMetrics.length,
        presentDays: Math.round(totals.presentDays * 10) / 10,
        leaveDays: Math.round(totals.leaveDays * 10) / 10,
        absentDays: Math.round(totals.absentDays * 10) / 10,
        nonWorkingDays: Math.round(nonWorkingDays * 10) / 10,
        attendancePercentage: Math.round(attendancePercentage * 100) / 100,
        totalNetHours: Math.round(totals.totalNetHours * 100) / 100,
        averageWorkingHours: Math.round(averageWorkingHours * 100) / 100,
        overtimeHours: Math.round(totals.overtimeHours * 100) / 100
    };
    
    // Validate summary
    validateMetrics(summary, 'summary');
    
    return summary;
}

module.exports = {
    calculateAttendanceMetrics,
    calculateEmployeeMetrics,
    calculateSummaryMetrics,
    validateMetrics
};
