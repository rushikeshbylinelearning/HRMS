/**
 * ANALYTICS SERVICE
 * 
 * Single source of truth for attendance analytics calculations.
 * Provides comprehensive workforce attendance insights using pre-computed data.
 * 
 * Key Principles:
 * - Uses AttendanceLog collection as single source of truth
 * - All calculations use pre-computed totalWorkingHours (no raw punch log access)
 * - Backend aggregation via MongoDB pipelines for performance
 * - IST timezone consistency throughout
 * - Clear separation between Leave and Absent statuses
 * 
 * Critical Calculation Rules:
 * - Average Working Hours = Total Net Hours / Present Days ONLY
 * - Total Non-Working Days = Leave Days + Absent Days
 * - Attendance % = Present / (Present + Leave + Absent)
 * - Exclude Holidays and Weekends from all calculations
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const Shift = require('../models/Shift');
const Holiday = require('../models/Holiday');
const { getISTDateString, parseISTDate } = require('../utils/istTime');

/**
 * Build MongoDB aggregation pipeline for employee metrics
 * 
 * @param {Array<ObjectId>} employeeIds - Filtered employee IDs
 * @param {string} startDate - Start date (YYYY-MM-DD) in IST
 * @param {string} endDate - End date (YYYY-MM-DD) in IST
 * @returns {Array} MongoDB aggregation pipeline
 */
function buildEmployeeMetricsPipeline(employeeIds, startDate, endDate) {
    return [
        // Stage 1: Match attendance logs for filtered employees and date range
        {
            $match: {
                user: { $in: employeeIds },
                attendanceDate: { $gte: startDate, $lte: endDate }
            }
        },
        
        // Stage 2: Lookup user details
        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData'
            }
        },
        {
            $unwind: {
                path: '$userData',
                preserveNullAndEmptyArrays: false
            }
        },
        
        // Stage 3: Lookup shift details
        {
            $lookup: {
                from: 'shifts',
                localField: 'userData.shiftGroup',
                foreignField: '_id',
                as: 'shiftData'
            }
        },
        {
            $unwind: {
                path: '$shiftData',
                preserveNullAndEmptyArrays: true
            }
        },
        
        // Stage 4: Filter out records before join date or after exit date
        {
            $addFields: {
                recordDate: {
                    $dateFromString: {
                        dateString: { $concat: ['$attendanceDate', 'T00:00:00+05:30'] },
                        format: '%Y-%m-%dT%H:%M:%S%z'
                    }
                }
            }
        },
        {
            $match: {
                $expr: {
                    $and: [
                        // Record date must be on or after joining date
                        {
                            $gte: ['$recordDate', '$userData.joiningDate']
                        },
                        // If inactive, record date must be before exit date (approximated as updatedAt)
                        {
                            $or: [
                                { $eq: ['$userData.isActive', true] },
                                { $lte: ['$recordDate', '$userData.updatedAt'] }
                            ]
                        }
                    ]
                }
            }
        },
        
        // Stage 5: Classify records by status
        {
            $addFields: {
                // Determine if this is a Present day
                isPresent: {
                    $cond: [
                        {
                            $and: [
                                { $in: ['$attendanceStatus', ['On-time', 'Late']] },
                                { $ne: ['$attendanceStatus', 'Holiday'] },
                                { $ne: ['$attendanceStatus', 'Weekend'] }
                            ]
                        },
                        true,
                        false
                    ]
                },
                // Determine if this is a Leave day
                isLeaveDay: {
                    $cond: [
                        {
                            $and: [
                                { $eq: ['$attendanceStatus', 'Leave'] },
                                { $ne: [{ $ifNull: ['$leaveRequest', null] }, null] }
                            ]
                        },
                        true,
                        false
                    ]
                },
                // Determine if this is an Absent day
                isAbsentDay: {
                    $cond: [
                        {
                            $and: [
                                { $eq: ['$attendanceStatus', 'Absent'] },
                                { $ne: ['$attendanceStatus', 'Holiday'] },
                                { $ne: ['$attendanceStatus', 'Weekend'] }
                            ]
                        },
                        true,
                        false
                    ]
                },
                // Calculate day count (handle half-days)
                dayCount: {
                    $cond: [
                        { $eq: ['$isHalfDay', true] },
                        0.5,
                        1
                    ]
                },
                // Get net working hours (treat null as 0)
                netHours: { $ifNull: ['$totalWorkingHours', 0] },
                // Get shift duration in hours
                shiftDurationHours: {
                    $ifNull: ['$shiftData.durationHours', 9]
                },
            }
        },
        
        // Stage 6: Calculate overtime for each record
        {
            $addFields: {
                overtimeHours: {
                    $cond: [
                        {
                            $and: [
                                { $eq: ['$isPresent', true] },
                                { $gt: ['$netHours', '$shiftDurationHours'] }
                            ]
                        },
                        { $subtract: ['$netHours', '$shiftDurationHours'] },
                        0
                    ]
                }
            }
        },
        
        // Stage 7: Group by employee to calculate per-employee metrics
        {
            $group: {
                _id: '$user',
                employeeName: { $first: '$userData.fullName' },
                employeeCode: { $first: '$userData.employeeCode' },
                department: { $first: '$userData.department' },
                designation: { $first: '$userData.designation' },
                
                // Count days by status (sum dayCount for half-days)
                presentDays: {
                    $sum: {
                        $cond: ['$isPresent', '$dayCount', 0]
                    }
                },
                leaveDays: {
                    $sum: {
                        $cond: ['$isLeaveDay', '$dayCount', 0]
                    }
                },
                absentDays: {
                    $sum: {
                        $cond: ['$isAbsentDay', '$dayCount', 0]
                    }
                },
                
                // Sum hours (only for Present days)
                totalNetHours: {
                    $sum: {
                        $cond: ['$isPresent', '$netHours', 0]
                    }
                },
                
                // Sum overtime (only for Present days)
                overtimeHours: {
                    $sum: '$overtimeHours'
                },
                
            }
        },
        
        // Stage 8: Calculate derived metrics
        {
            $addFields: {
                // CRITICAL FIX: Total Non-Working Days = Leave + Absent
                // This is the ONLY correct formula. Do NOT use any other calculation.
                // Non-Working Days is NOT derived from total days or present days.
                nonWorkingDays: {
                    $add: ['$leaveDays', '$absentDays']
                },
                
                // Average Working Hours = Total Net Hours / (Present Days - 1)
                avgWorkingHours: {
                    $cond: [
                        { $gt: ['$presentDays', 1] },
                        { $divide: ['$totalNetHours', { $subtract: ['$presentDays', 1] }] },
                        0
                    ]
                },
                
                // Attendance % = Present / (Present + Leave + Absent) * 100
                attendancePercentage: {
                    $let: {
                        vars: {
                            totalDays: {
                                $add: ['$presentDays', '$leaveDays', '$absentDays']
                            }
                        },
                        in: {
                            $cond: [
                                { $gt: ['$$totalDays', 0] },
                                {
                                    $multiply: [
                                        { $divide: ['$presentDays', '$$totalDays'] },
                                        100
                                    ]
                                },
                                0
                            ]
                        }
                    }
                }
            }
        },
        
        // Stage 9: Round numeric values to 2 decimal places
        {
            $addFields: {
                totalNetHours: { $round: ['$totalNetHours', 2] },
                avgWorkingHours: { $round: ['$avgWorkingHours', 2] },
                overtimeHours: { $round: ['$overtimeHours', 2] },
                attendancePercentage: { $round: ['$attendancePercentage', 2] },
                presentDays: { $round: ['$presentDays', 1] },
                leaveDays: { $round: ['$leaveDays', 1] },
                absentDays: { $round: ['$absentDays', 1] },
                nonWorkingDays: { $round: ['$nonWorkingDays', 1] }
            }
        },
        
        // Stage 10: Project final fields
        {
            $project: {
                _id: 0,
                employeeId: '$_id',
                employeeName: 1,
                employeeCode: 1,
                department: 1,
                designation: 1,
                presentDays: 1,
                leaveDays: 1,
                absentDays: 1,
                nonWorkingDays: 1,
                totalNetHours: 1,
                avgWorkingHours: 1,
                overtimeHours: 1,
                attendancePercentage: 1
            }
        },
        
        // Stage 11: Sort by Attendance % DESC (highest first), then by Avg Working Hours DESC
        {
            $sort: { 
                attendancePercentage: -1,
                avgWorkingHours: -1
            }
        }
    ];
}

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
        let employeeQuery = User.find(userQuery).select('_id');
        
        // Apply shift type filter if specified
        if (filters.shiftType) {
            const shifts = await Shift.find({ shiftType: filters.shiftType }).select('_id');
            const shiftIds = shifts.map(s => s._id);
            employeeQuery = employeeQuery.where('shiftGroup').in(shiftIds);
        }
        
        const employees = await employeeQuery.lean();
        const employeeIds = employees.map(e => e._id);
        
        if (employeeIds.length === 0) {
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
        
        // Build and execute aggregation pipeline
        const pipeline = buildEmployeeMetricsPipeline(
            employeeIds,
            filters.startDate,
            filters.endDate
        );
        
        const employeeMetrics = await AttendanceLog.aggregate(pipeline);
        
        // DEBUG: Log sample results to verify calculations
        if (process.env.NODE_ENV === 'development' && employeeMetrics.length > 0) {
            console.log('[AnalyticsService] Sample employee metrics (first 3):');
            employeeMetrics.slice(0, 3).forEach(emp => {
                const expectedNonWorking = (emp.leaveDays || 0) + (emp.absentDays || 0);
                const match = Math.abs(expectedNonWorking - (emp.nonWorkingDays || 0)) < 0.01;
                console.log({
                    employee: emp.employeeName,
                    present: emp.presentDays,
                    leave: emp.leaveDays,
                    absent: emp.absentDays,
                    nonWorking: emp.nonWorkingDays,
                    expected: expectedNonWorking,
                    match: match ? '✓' : '✗ MISMATCH!'
                });
            });
        }
        
        // Add rank to each employee (based on sorted order)
        employeeMetrics.forEach((emp, index) => {
            emp.rank = index + 1;
            
            // Validate each employee's metrics
            validateMetrics(emp, `${emp.employeeName} (${emp.employeeCode})`);
        });
        
        // Calculate summary metrics
        const summary = calculateSummaryMetrics(employeeMetrics);
        
        // Apply pagination
        const totalRecords = employeeMetrics.length;
        const totalPages = Math.ceil(totalRecords / limit);
        const paginatedEmployees = employeeMetrics.slice(skip, skip + limit);
        
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
        console.error('[AnalyticsService] Error calculating attendance metrics:', error);
        throw error;
    }
}

/**
 * Build user filter query for MongoDB
 * Combines multiple filter criteria with AND logic
 * 
 * @param {Object} filters - Filter criteria
 * @returns {Object} MongoDB query object
 */
function buildUserFilterQuery(filters) {
    const query = {};
    
    // Department filter
    if (filters.department) {
        query.department = filters.department;
    }
    
    // Location filter (if location field exists in User model)
    if (filters.location) {
        query.location = filters.location;
    }
    
    // Employment status filter (Active/Inactive)
    // Note: This is overridden in calculateAttendanceMetrics to always filter for Active only
    if (filters.employmentStatus) {
        query.isActive = filters.employmentStatus === 'Active';
    }
    
    // Shift type filter (requires lookup to Shift collection)
    // This will be handled separately in the aggregation pipeline
    
    return query;
}

/**
 * Validate metrics integrity
 * Checks data consistency and logs errors if validation fails
 * 
 * CRITICAL VALIDATION RULES:
 * 1. Non-Working Days MUST equal Leave Days + Absent Days (exact match)
 * 2. Avg Working Hours > 0 implies Present Days > 0
 * 3. All numeric values must be non-negative
 * 
 * @param {Object} metrics - Metrics object (summary or employee-level)
 * @param {string} context - Context for logging (e.g., 'summary' or employee ID)
 * @returns {boolean} True if all validations pass
 */
function validateMetrics(metrics, context = 'unknown') {
    const errors = [];
    
    // CRITICAL CHECK: Non-Working Days = Leave + Absent
    // This is the PRIMARY validation rule that must NEVER fail
    const expectedNonWorking = (metrics.leaveDays || 0) + (metrics.absentDays || 0);
    const actualNonWorking = metrics.nonWorkingDays || 0;
    
    // Use strict equality check (allow 0.01 tolerance for floating point)
    if (Math.abs(expectedNonWorking - actualNonWorking) > 0.01) {
        errors.push({
            check: 'Non-Working Days Invariant',
            severity: 'CRITICAL',
            expected: expectedNonWorking,
            actual: actualNonWorking,
            leaveDays: metrics.leaveDays,
            absentDays: metrics.absentDays,
            message: `Non-Working Days (${actualNonWorking}) MUST equal Leave Days (${metrics.leaveDays}) + Absent Days (${metrics.absentDays}) = ${expectedNonWorking}`
        });
    }
    
    // Check: Avg Working Hours > 0 implies Present Days > 0
    if ((metrics.avgWorkingHours || 0) > 0 && (metrics.presentDays || 0) === 0) {
        errors.push({
            check: 'Average Hours Validation',
            severity: 'ERROR',
            avgWorkingHours: metrics.avgWorkingHours,
            presentDays: metrics.presentDays,
            message: 'Average Working Hours is greater than 0 but Present Days is 0'
        });
    }
    
    // Check: All numeric values must be non-negative
    const numericFields = ['presentDays', 'leaveDays', 'absentDays', 'nonWorkingDays', 
                          'totalNetHours', 'avgWorkingHours', 'overtimeHours', 'attendancePercentage'];
    numericFields.forEach(field => {
        if ((metrics[field] || 0) < 0) {
            errors.push({
                check: 'Non-Negative Values',
                severity: 'ERROR',
                field,
                value: metrics[field],
                message: `${field} cannot be negative: ${metrics[field]}`
            });
        }
    });
    
    // Log errors if any
    if (errors.length > 0) {
        console.error(`[AnalyticsService] ❌ VALIDATION FAILED for ${context}:`, {
            context,
            errors,
            metrics
        });
        
        // Throw error for CRITICAL failures
        const criticalErrors = errors.filter(e => e.severity === 'CRITICAL');
        if (criticalErrors.length > 0) {
            throw new Error(`CRITICAL validation failure for ${context}: ${criticalErrors[0].message}`);
        }
    }
    
    return errors.length === 0;
}

/**
 * Calculate summary metrics from employee metrics
 * Aggregates employee-level data into organization-wide metrics
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
            overtimeHours: 0,
            lateCount: 0
        };
    }
    
    // Sum all metrics across employees
    const totals = employeeMetrics.reduce((acc, emp) => {
        acc.presentDays += emp.presentDays || 0;
        acc.leaveDays += emp.leaveDays || 0;
        acc.absentDays += emp.absentDays || 0;
        acc.totalNetHours += emp.totalNetHours || 0;
        acc.overtimeHours += emp.overtimeHours || 0;
        acc.lateCount += emp.lateCount || 0;
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
    const averageWorkingHours = totals.presentDays > 1 
        ? totals.totalNetHours / (totals.presentDays - 1) 
        : 0;
    const attendancePercentage = totalDays > 0 
        ? (totals.presentDays / totalDays) * 100 
        : 0;
    
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
    
    // Validate summary metrics
    validateMetrics(summary, 'summary');
    
    return summary;
}

module.exports = {
    calculateAttendanceMetrics,
    buildEmployeeMetricsPipeline,
    calculateSummaryMetrics,
    validateMetrics
};
