// backend/services/LeavePolicyService.js
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');
const { logAction } = require('./auditLogger');
const { parseISTDate, getISTDateString, getISTNow } = require('../utils/istTime');

/**
 * Central Leave Policy Service
 * This service acts as the single source of truth for all leave policy validations.
 * It consolidates and enforces company-wide leave policies.
 */
class LeavePolicyService {
    /**
     * Validate a leave request against all company policies
     * @param {String|ObjectId} employeeId - Employee ID
     * @param {Array} leaveDates - Array of leave dates
     * @param {String} requestType - Leave request type (Planned, Casual, Sick, etc.)
     * @param {String} leaveType - Leave type (Full Day, Half Day - First Half, etc.)
     * @param {String} adminOverrideReason - Optional override reason for admin approvals
     * @returns {Object} Validation result with allowed flag and reason
     */
    static async validateRequest(employeeId, leaveDates, requestType, leaveType = 'Full Day', adminOverrideReason = null) {
        try {
            // Fetch employee details
            const employee = await User.findById(employeeId);
            if (!employee) {
                return {
                    allowed: false,
                    reason: 'Employee not found',
                    rule: 'EMPLOYEE_NOT_FOUND'
                };
            }

            // If admin override reason is provided, allow the request but log it
            if (adminOverrideReason) {
                await this.logAdminOverride(employee, leaveDates, requestType, leaveType, adminOverrideReason);
                return {
                    allowed: true,
                    reason: 'Admin override applied',
                    rule: 'ADMIN_OVERRIDE'
                };
            }

            // Validate input parameters
            if (!leaveDates || !Array.isArray(leaveDates) || leaveDates.length === 0) {
                return {
                    allowed: false,
                    reason: 'Invalid leave dates provided',
                    rule: 'INVALID_DATES'
                };
            }

            // Employee type validation
            const employeeTypeCheck = this.validateEmployeeType(employee, requestType);
            if (!employeeTypeCheck.allowed) {
                return employeeTypeCheck;
            }

            // Backdated leave handling
            const backdatedCheck = this.handleBackdatedLeave(employee, leaveDates, requestType);
            if (!backdatedCheck.allowed) {
                return backdatedCheck;
            }

            // PRIORITY 1: Leave type specific validation (includes advance notice checks)
            const typeSpecificCheck = await this.validateLeaveTypeSpecific(employee, leaveDates, requestType, leaveType);
            if (!typeSpecificCheck.allowed) {
                return typeSpecificCheck;
            }

            // PRIORITY 2: Context-aware monthly caps validation (Planned Leave exempt from working days cap)
            const monthlyCheck = await this.validateMonthlyCapsIntelligent(employee._id, leaveDates, leaveType, requestType);
            if (!monthlyCheck.allowed) {
                return monthlyCheck;
            }

            // PRIORITY 3: Context-aware weekday validation (skip for valid advance notice)
            const weekdayCheck = await this.validateWeekdayRestrictionsIntelligent(employee, leaveDates, requestType, leaveType);
            if (!weekdayCheck.allowed) {
                return weekdayCheck;
            }

            // If all validations pass
            return {
                allowed: true,
                reason: 'Leave request meets all policy requirements',
                rule: 'APPROVED'
            };

        } catch (error) {
            console.error('Error in LeavePolicyService.validateRequest:', error);
            return {
                allowed: false,
                reason: 'Internal policy validation error',
                rule: 'SYSTEM_ERROR'
            };
        }
    }

    /**
     * Validate employee type eligibility for leave types
     */
    static validateEmployeeType(employee, requestType) {
        const employmentStatus = employee.employmentStatus;
        
        // Permanent employees can use all leave types
        if (employmentStatus === 'Permanent') {
            return { allowed: true };
        }
        
        // Probation and Intern employees - only LOP and Comp-Off allowed
        if (employmentStatus === 'Probation' || employmentStatus === 'Intern') {
            if (requestType === 'Loss of Pay' || requestType === 'Compensatory') {
                return { allowed: true };
            }
            
            const leaveTypeLabel = requestType === 'Casual' ? 'Casual' : 
                                 requestType === 'Sick' ? 'Sick' : 
                                 requestType === 'Planned' ? 'Planned' : requestType;
            
            return {
                allowed: false,
                reason: `During ${employmentStatus.toLowerCase()}, only Loss of Pay (LOP) leave is allowed. ${leaveTypeLabel} leave will be available after confirmation.`,
                rule: 'EMPLOYEE_TYPE_RESTRICTION'
            };
        }
        
        return { allowed: true };
    }

    /**
     * Handle backdated leave logic
     */
    static handleBackdatedLeave(employee, leaveDates, requestType) {
        const today = parseISTDate(getISTDateString());
        const firstLeaveDate = parseISTDate(leaveDates[0]);
        
        // Check if leave is backdated
        if (firstLeaveDate < today) {
            // Permanent employees can apply backdated Casual/Sick
            if (employee.employmentStatus === 'Permanent') {
                if (requestType === 'Casual' || requestType === 'Sick') {
                    return { allowed: true };
                }
            }
            
            // Probation/Intern - auto-convert to LOP for backdated
            if (employee.employmentStatus === 'Probation' || employee.employmentStatus === 'Intern') {
                if (requestType !== 'Loss of Pay') {
                    const daysPast = Math.floor((today - firstLeaveDate) / (1000 * 60 * 60 * 24));
                    return {
                        allowed: false,
                        reason: `This leave is for ${daysPast} day${daysPast > 1 ? 's' : ''} ago. During ${employee.employmentStatus.toLowerCase()}, backdated leave must be applied as Loss of Pay (LOP).`,
                        rule: 'BACKDATED_LOP_REQUIRED'
                    };
                }
            }
        }
        
        return { allowed: true };
    }

    /**
     * Intelligent monthly caps validation - Planned Leave exempt from working days cap
     */
    static async validateMonthlyCapsIntelligent(employeeId, leaveDates, leaveType, requestType) {
        const firstLeaveDate = parseISTDate(leaveDates[0]);
        const month = firstLeaveDate.getMonth();
        const year = firstLeaveDate.getFullYear();
        
        // Get month name for user-friendly messaging
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[month];
        
        // Month boundaries in IST
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
        
        // Count existing requests this month (PENDING + APPROVED)
        const existingRequests = await LeaveRequest.find({
            employee: employeeId,
            status: { $in: ['Pending', 'Approved'] },
            leaveDates: {
                $elemMatch: {
                    $gte: monthStart,
                    $lte: monthEnd
                }
            }
        });
        
        // Check request count limit (4 per month) - applies to ALL leave types
        if (existingRequests.length >= 4) {
            return {
                allowed: false,
                reason: `You have already submitted ${existingRequests.length} leave requests for ${monthName} ${year}. The maximum allowed is 4 requests per month.`,
                rule: 'MONTHLY_REQUEST_LIMIT'
            };
        }
        
        // INTELLIGENT WORKING DAYS CAP: Planned Leave is EXEMPT
        if (requestType === 'Planned') {
            // Planned leave ignores the 5-day working days cap
            return { allowed: true };
        }
        
        // For other leave types, enforce 5 working days cap
        const holidays = await Holiday.find({
            date: { $gte: monthStart, $lte: monthEnd }
        });
        
        let totalWorkingDays = 0;
        
        // Count existing working days (exclude Planned Leave from count)
        for (const request of existingRequests) {
            if (request.requestType === 'Planned') {
                continue; // Skip planned leave from working days count
            }
            const workingDays = this.countWorkingDays(request.leaveDates, holidays, request.employee);
            const multiplier = request.leaveType === 'Full Day' ? 1 : 0.5;
            totalWorkingDays += workingDays * multiplier;
        }
        
        // Count current request working days
        const currentWorkingDays = this.countWorkingDays(leaveDates, holidays, employeeId);
        const multiplier = leaveType === 'Full Day' ? 1 : 0.5;
        const newWorkingDays = currentWorkingDays * multiplier;
        totalWorkingDays += newWorkingDays;
        
        if (totalWorkingDays > 5) {
            const alreadyUsed = totalWorkingDays - newWorkingDays;
            return {
                allowed: false,
                reason: `You have already used ${alreadyUsed} working day${alreadyUsed !== 1 ? 's' : ''} of leave in ${monthName} ${year}. This request would exceed the monthly limit of 5 working days.`,
                rule: 'MONTHLY_WORKING_DAYS_LIMIT'
            };
        }
        
        return { allowed: true };
    }

    /**
     * Count working days excluding weekends and holidays
     */
    static countWorkingDays(leaveDates, holidays, employeeId) {
        // For now, simplified - exclude Sundays and holidays
        // TODO: Implement Saturday policy logic
        let workingDays = 0;
        
        for (const dateStr of leaveDates) {
            const date = parseISTDate(dateStr);
            const dayOfWeek = date.getDay();
            
            // Skip Sundays
            if (dayOfWeek === 0) continue;
            
            // Skip holidays
            const isHoliday = holidays.some(holiday => {
                const holidayDate = parseISTDate(holiday.date);
                return getISTDateString(holidayDate) === getISTDateString(date);
            });
            if (isHoliday) continue;
            
            workingDays++;
        }
        
        return workingDays;
    }

    /**
     * Validate leave type specific rules with intelligent advance notice handling
     */
    static async validateLeaveTypeSpecific(employee, leaveDates, requestType, leaveType) {
        const today = parseISTDate(getISTDateString());
        const firstLeaveDate = parseISTDate(leaveDates[0]);
        const daysDiff = Math.floor((firstLeaveDate - today) / (1000 * 60 * 60 * 24));
        
        switch (requestType) {
            case 'Casual':
                // Only for Permanent employees
                if (employee.employmentStatus !== 'Permanent') {
                    return {
                        allowed: false,
                        reason: `During ${employee.employmentStatus.toLowerCase()}, only Loss of Pay (LOP) leave is allowed. Casual leave will be available after confirmation.`,
                        rule: 'CASUAL_PERMANENT_ONLY'
                    };
                }
                
                // Base rule: Casual leave requires at least 5 days prior notice
                if (daysDiff < 5) {
                    return {
                        allowed: false,
                        reason: `Casual leave must be applied at least 5 days in advance. You applied this leave only ${daysDiff} day${daysDiff !== 1 ? 's' : ''} before the start date.`,
                        rule: 'CASUAL_ADVANCE_NOTICE'
                    };
                }
                
                // Casual leave is allowed if minimum notice is met
                return { allowed: true };
                
            case 'Planned':
                // Only for Permanent employees
                if (employee.employmentStatus !== 'Permanent') {
                    return {
                        allowed: false,
                        reason: `During ${employee.employmentStatus.toLowerCase()}, only Loss of Pay (LOP) leave is allowed. Planned leave will be available after confirmation.`,
                        rule: 'PLANNED_PERMANENT_ONLY'
                    };
                }
                
                // INTELLIGENT PLANNED LEAVE HANDLING: Calculate working days using IST
                const workingDaysCount = this.countWorkingDaysForPlannedLeave(leaveDates, employee);
                let requiredDays;
                
                // Advance notice based on working days count
                if (workingDaysCount >= 5 && workingDaysCount <= 7) {
                    requiredDays = 30; // ≥30 days advance
                } else if (workingDaysCount > 7) {
                    requiredDays = 60; // ≥2 months advance
                } else {
                    requiredDays = 30; // Default 30 days
                }
                
                if (daysDiff < requiredDays) {
                    const requiredPeriod = requiredDays === 60 ? '2 months' : '1 month';
                    return {
                        allowed: false,
                        reason: `Planned leave of ${workingDaysCount} working day${workingDaysCount !== 1 ? 's' : ''} requires at least ${requiredPeriod} advance notice. Please apply earlier or contact Admin if this is an emergency.`,
                        rule: 'PLANNED_ADVANCE_NOTICE'
                    };
                }
                
                // If advance notice is satisfied, planned leave is allowed regardless of weekdays
                return { allowed: true };
                
            case 'Sick':
                // Only for Permanent employees
                if (employee.employmentStatus !== 'Permanent') {
                    return {
                        allowed: false,
                        reason: `During ${employee.employmentStatus.toLowerCase()}, only Loss of Pay (LOP) leave is allowed. Sick leave will be available after confirmation.`,
                        rule: 'SICK_PERMANENT_ONLY'
                    };
                }
                
                // Allow same-day and backdated
                return { allowed: true };
                
            case 'Compensatory':
                // Validate worked Saturday via attendance
                // TODO: Implement attendance validation
                // Must be submitted by Thursday of same week
                const dayOfWeek = today.getDay();
                
                if (dayOfWeek > 4) { // Friday, Saturday, Sunday
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    return {
                        allowed: false,
                        reason: `Comp-Off requests must be submitted by Thursday of the same week. Today is ${dayNames[dayOfWeek]}, which is past the deadline.`,
                        rule: 'COMPOFF_THURSDAY_DEADLINE'
                    };
                }
                break;
                
            case 'Loss of Pay':
                // LOP is allowed - advance notice affects weekday restrictions later
                return { allowed: true };
        }
        
        return { allowed: true };
    }

    /**
     * Intelligent weekday restrictions - context-aware based on leave type and advance notice
     */
    static async validateWeekdayRestrictionsIntelligent(employee, leaveDates, requestType, leaveType) {
        const today = parseISTDate(getISTDateString());
        const firstLeaveDate = parseISTDate(leaveDates[0]);
        const daysDiff = Math.floor((firstLeaveDate - today) / (1000 * 60 * 60 * 24));
        
        // PRIORITY 1: Planned Leave with valid advance notice - SKIP ALL weekday restrictions
        if (requestType === 'Planned') {
            const workingDaysCount = this.countWorkingDaysForPlannedLeave(leaveDates, employee);
            let requiredDays = workingDaysCount > 7 ? 60 : 30;
            
            if (daysDiff >= requiredDays) {
                // Planned leave with valid notice can include any weekdays
                return { allowed: true };
            }
        }
        
        // PRIORITY 2: Casual Leave >10 days advance - SKIP ALL weekday restrictions
        if (requestType === 'Casual' && daysDiff > 10) {
            return { allowed: true };
        }
        
        // PRIORITY 3: LOP with >10 days advance - SKIP ALL weekday restrictions
        if (requestType === 'Loss of Pay' && daysDiff > 10) {
            return { allowed: true };
        }
        
        // PRIORITY 4: Apply weekday restrictions for short-notice requests
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        for (const dateStr of leaveDates) {
            const date = parseISTDate(dateStr);
            const dayOfWeek = date.getDay();
            const dayName = dayNames[dayOfWeek];
            
            // Block Tuesday and Thursday globally for short-notice requests
            if (dayOfWeek === 2) { // Tuesday
                return {
                    allowed: false,
                    reason: `Leave cannot be applied on ${dayName} when requested within 10 days. For more flexibility, apply leave at least 10 days in advance.`,
                    rule: 'TUESDAY_BLOCKED'
                };
            }
            
            if (dayOfWeek === 4) { // Thursday
                return {
                    allowed: false,
                    reason: `Leave cannot be applied on ${dayName} when requested within 10 days. For more flexibility, apply leave at least 10 days in advance.`,
                    rule: 'THURSDAY_BLOCKED'
                };
            }
            
            // Intelligent Friday logic for short-notice requests
            if (dayOfWeek === 5) { // Friday
                // Check if Saturday is scheduled OFF
                const nextDay = new Date(date);
                nextDay.setDate(nextDay.getDate() + 1);
                
                if (this.isSaturdayOff(nextDay, employee.alternateSaturdayPolicy)) {
                    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    return {
                        allowed: false,
                        reason: `Leave cannot be applied on ${dayName}, ${dateStr} because the following Saturday is scheduled off, creating a long weekend. Apply at least 10 days in advance for more flexibility.`,
                        rule: 'FRIDAY_BEFORE_SATURDAY_OFF'
                    };
                }
            }
            
            // Intelligent Monday logic for short-notice requests
            if (dayOfWeek === 1) { // Monday
                const prevDay = new Date(date);
                prevDay.setDate(prevDay.getDate() - 1);
                
                if (prevDay.getDay() === 0) { // Previous day is Sunday
                    // For short-notice requests, be more restrictive about Monday bridging
                    // TODO: Implement more sophisticated bridging detection
                }
            }
        }
        
        return { allowed: true };
    }

    /**
     * Count working days for Planned Leave (IST-based, excludes weekends and holidays)
     */
    static countWorkingDaysForPlannedLeave(leaveDates, employee) {
        let workingDays = 0;
        
        for (const dateStr of leaveDates) {
            const date = parseISTDate(dateStr);
            const dayOfWeek = date.getDay();
            
            // Skip Sundays
            if (dayOfWeek === 0) continue;
            
            // Handle Saturdays based on employee policy
            if (dayOfWeek === 6) {
                if (this.isSaturdayOff(date, employee.alternateSaturdayPolicy)) {
                    continue; // Skip non-working Saturdays
                }
            }
            
            // TODO: Skip holidays (would need to fetch holidays for the date range)
            // For now, count all non-Sunday days as working days for planned leave calculation
            
            workingDays++;
        }
        
        return workingDays;
    }

    /**
     * Check if Saturday is OFF based on policy
     */
    static isSaturdayOff(date, saturdayPolicy) {
        if (date.getDay() !== 6) return false;
        
        const weekNum = Math.ceil(date.getDate() / 7);
        
        switch (saturdayPolicy) {
            case 'All Saturdays Off':
                return true;
            case 'All Saturdays Working':
                return false;
            case 'Week 1 & 3 Off':
                return (weekNum === 1 || weekNum === 3);
            case 'Week 2 & 4 Off':
                return (weekNum === 2 || weekNum === 4);
            default:
                return false;
        }
    }

    /**
     * Log admin override actions for audit purposes
     * @param {Object} employee - Employee object
     * @param {Array} leaveDates - Array of leave dates
     * @param {String} requestType - Leave request type
     * @param {String} leaveType - Leave type
     * @param {String} overrideReason - Admin override reason
     */
    static async logAdminOverride(employee, leaveDates, requestType, leaveType, overrideReason) {
        try {
            await logAction({
                action: 'LEAVE_POLICY_ADMIN_OVERRIDE',
                userId: employee._id.toString(),
                details: {
                    employeeCode: employee.employeeCode,
                    employeeName: employee.fullName,
                    requestType: requestType,
                    leaveType: leaveType,
                    leaveDates: leaveDates.map(d => getISTDateString(parseISTDate(d))),
                    overrideReason: overrideReason,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error logging admin override:', error);
        }
    }

    /**
     * Check if an employee has sufficient leave balance
     * @param {Object} employee - Employee object
     * @param {String} requestType - Leave request type
     * @param {Number} leaveDuration - Duration of leave in days
     * @returns {Object} Balance check result
     */
    static checkLeaveBalance(employee, requestType, leaveDuration) {
        if (!employee.leaveBalances) {
            return {
                sufficient: false,
                reason: 'Your leave balance information is not available. Please contact HR to resolve this issue.'
            };
        }

        let balanceField;
        let leaveTypeName;
        switch (requestType) {
            case 'Sick':
                balanceField = 'sick';
                leaveTypeName = 'sick';
                break;
            case 'Planned':
                balanceField = 'paid';
                leaveTypeName = 'planned';
                break;
            case 'Casual':
                balanceField = 'casual';
                leaveTypeName = 'casual';
                break;
            case 'Loss of Pay':
            case 'Compensatory':
            case 'Backdated Leave':
                // These don't require balance checks
                return { sufficient: true, reason: 'No balance check required' };
            default:
                return {
                    sufficient: false,
                    reason: `Unable to process this leave type. Please contact HR for assistance.`
                };
        }

        const availableBalance = employee.leaveBalances[balanceField] || 0;
        if (availableBalance < leaveDuration) {
            const dayText = leaveDuration === 1 ? 'day' : 'days';
            const balanceText = availableBalance === 1 ? 'day' : 'days';
            return {
                sufficient: false,
                reason: `You have ${availableBalance} ${balanceText} of ${leaveTypeName} leave remaining, but this request requires ${leaveDuration} ${dayText}. Please reduce the duration or contact HR if you need additional leave.`
            };
        }

        return {
            sufficient: true,
            reason: 'Sufficient balance available'
        };
    }
}

module.exports = LeavePolicyService;