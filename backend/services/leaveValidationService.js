// backend/services/leaveValidationService.js
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const AntiExploitationLeaveService = require('./antiExploitationLeaveService');
const { parseISTDate, getTodayIST, formatDateIST, getDatePartsIST, daysDifferenceIST } = require('../utils/dateUtils');

/**
 * Leave Validation Service
 * Implements company leave policy rules:
 * - Permanent employees: 22 paid leaves/year (6 sick, 6 casual, 10 planned)
 * - Planned leaves: 2 months prior notice, 5 days per half-year
 * - Casual leaves: 5 days prior notice
 * - Sick leaves: Medical certificate mandatory, applied after return
 */

class LeaveValidationService {
    /**
     * Get half-year period for a date in IST (First Half: Jan-Jun, Second Half: Jul-Dec)
     */
    static getHalfYearPeriod(date) {
        // Get month in IST
        const parts = getDatePartsIST(date);
        if (!parts) return null;
        
        // parts.month is 1-12, so subtract 1 for comparison
        return parts.month <= 6 ? 'First Half' : 'Second Half';
    }

    /**
     * Calculate leave duration in days (considering half days)
     */
    static calculateLeaveDuration(leaveDates, leaveType) {
        return leaveDates.length * (leaveType === 'Full Day' ? 1 : 0.5);
    }

    /**
     * Check if employee is permanent
     */
    static isPermanentEmployee(employee) {
        return employee.employmentStatus === 'Permanent';
    }

    /**
     * Validate Planned Leave Rules:
     * - Must apply at least 2 months prior
     * - Can use 5 days in first half (Jan-Jun) and 5 days in second half (Jul-Dec)
     * - If 10 days requested, need 2 months prior
     * - Cannot apply again in same half if already used 5 days
     */
    static async validatePlannedLeave(employee, leaveDates, leaveType) {
        const errors = [];
        const warnings = [];

        // Check if permanent employee
        if (!this.isPermanentEmployee(employee)) {
            errors.push('Planned leaves are only available for permanent employees.');
            return { valid: false, errors, warnings };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstLeaveDate = new Date(leaveDates[0]);
        firstLeaveDate.setHours(0, 0, 0, 0);

        // Calculate months difference
        const monthsDiff = (firstLeaveDate.getFullYear() - today.getFullYear()) * 12 + 
                          (firstLeaveDate.getMonth() - today.getMonth());
        
        const leaveDuration = this.calculateLeaveDuration(leaveDates, leaveType);
        const requiredMonthsPrior = leaveDuration >= 10 ? 2 : 2; // 2 months for all planned leaves

        // Check 2 months prior rule
        if (monthsDiff < requiredMonthsPrior) {
            errors.push(`Planned leaves must be applied at least ${requiredMonthsPrior} months prior to the leave start date.`);
        }

        // Check half-year allocation (5 days per half) - use IST dates
        const halfYearPeriod = this.getHalfYearPeriod(firstLeaveDate);
        
        // Get all approved planned leaves for the same half-year period
        const year = leaveParts.year;
        const halfYearStart = halfYearPeriod === 'First Half' 
            ? parseISTDate(`${year}-01-01`)  // Jan 1 in IST
            : parseISTDate(`${year}-07-01`);  // Jul 1 in IST
        const halfYearEnd = halfYearPeriod === 'First Half'
            ? parseISTDate(`${year}-06-30`)  // Jun 30 in IST
            : parseISTDate(`${year}-12-31`); // Dec 31 in IST
        
        if (halfYearEnd) {
            halfYearEnd.setHours(23, 59, 59, 999);
        }
        
        if (!halfYearStart || !halfYearEnd) {
            errors.push('Unable to calculate half-year period boundaries.');
            return { valid: false, errors, warnings };
        }

        // Find all approved planned leaves that have at least one date in this half-year
        const existingPlannedLeaves = await LeaveRequest.find({
            employee: employee._id,
            requestType: 'Planned',
            status: 'Approved',
            leaveDates: {
                $elemMatch: {
                    $gte: halfYearStart,
                    $lte: halfYearEnd
                }
            }
        });

        // Calculate already used days in this half-year
        let usedDays = 0;
        existingPlannedLeaves.forEach(leave => {
            usedDays += this.calculateLeaveDuration(leave.leaveDates, leave.leaveType);
        });

        const maxDaysPerHalf = 5;
        const availableDays = maxDaysPerHalf - usedDays;

        if (usedDays >= maxDaysPerHalf) {
            const nextHalfStart = halfYearPeriod === 'First Half' 
                ? new Date(year, 6, 1)  // Jul 1
                : new Date(year + 1, 0, 1); // Jan 1 next year
            errors.push(
                `You have already used all ${maxDaysPerHalf} planned leave days for ${halfYearPeriod} (${year}). ` +
                `You can apply for planned leaves again from ${nextHalfStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`
            );
        } else if (leaveDuration > availableDays) {
            errors.push(
                `You can only use ${availableDays} more day(s) of planned leave in ${halfYearPeriod} (${year}). ` +
                `You have already used ${usedDays} out of ${maxDaysPerHalf} days.`
            );
        }

        // Check balance
        if (employee.leaveBalances.paid < leaveDuration) {
            errors.push(`Insufficient planned leave balance. Available: ${employee.leaveBalances.paid} days, Required: ${leaveDuration} days.`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            halfYearPeriod,
            availableDays,
            usedDays
        };
    }

    /**
     * Validate Casual Leave Rules:
     * - Must apply at least 5 days prior
     */
    static async validateCasualLeave(employee, leaveDates, leaveType) {
        const errors = [];
        const warnings = [];

        // Check if permanent employee
        if (!this.isPermanentEmployee(employee)) {
            errors.push('Casual leaves are only available for permanent employees.');
            return { valid: false, errors, warnings };
        }

        // Use IST for date comparisons
        const today = getTodayIST();
        const firstLeaveDate = parseISTDate(leaveDates[0]);
        if (!firstLeaveDate) {
            errors.push('Invalid leave date provided.');
            return { valid: false, errors, warnings };
        }

        // Calculate days difference using IST dates
        const daysDiff = daysDifferenceIST(today, firstLeaveDate);
        if (daysDiff === null) {
            errors.push('Unable to calculate date difference.');
            return { valid: false, errors, warnings };
        }

        // Check 5 days prior rule
        if (daysDiff < 5) {
            errors.push('Casual leaves must be applied at least 5 days prior to the leave start date.');
        }

        const leaveDuration = this.calculateLeaveDuration(leaveDates, leaveType);

        // Check balance
        if (employee.leaveBalances.casual < leaveDuration) {
            errors.push(`Insufficient casual leave balance. Available: ${employee.leaveBalances.casual} days, Required: ${leaveDuration} days.`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate Sick Leave Rules:
     * - Medical certificate is mandatory
     * - Should be applied after returning to office
     * - Cannot be used all at once (check if reasonable)
     */
    static async validateSickLeave(employee, leaveDates, leaveType, medicalCertificate) {
        const errors = [];
        const warnings = [];

        // Check if permanent employee
        if (!this.isPermanentEmployee(employee)) {
            errors.push('Sick leaves are only available for permanent employees.');
            return { valid: false, errors, warnings };
        }

        // Medical certificate is mandatory
        if (!medicalCertificate || medicalCertificate.trim() === '') {
            errors.push('Medical certificate is mandatory for sick leave applications.');
        }

        // Use IST for date comparisons
        const today = getTodayIST();
        const lastLeaveDate = parseISTDate(leaveDates[leaveDates.length - 1]);
        if (!lastLeaveDate) {
            errors.push('Invalid leave date provided.');
            return { valid: false, errors, warnings };
        }

        // Check if applied after return (leave end date should be in the past or today)
        const daysSinceLeaveEnd = daysDifferenceIST(lastLeaveDate, today);
        if (daysSinceLeaveEnd === null) {
            warnings.push('Unable to verify if leave is applied after return. Please ensure you have a valid medical certificate.');
        }
        
        if (daysSinceLeaveEnd < 0) {
            warnings.push('Sick leave is typically applied after returning to office. Please ensure you have a valid medical certificate.');
        }

        const leaveDuration = this.calculateLeaveDuration(leaveDates, leaveType);

        // Check balance
        if (employee.leaveBalances.sick < leaveDuration) {
            errors.push(`Insufficient sick leave balance. Available: ${employee.leaveBalances.sick} days, Required: ${leaveDuration} days.`);
        }

        // Check if trying to use all sick leaves at once (6 days)
        if (leaveDuration >= 6) {
            warnings.push('Using all sick leave days at once. Please ensure this is necessary and you have proper medical documentation.');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            appliedAfterReturn: daysSinceLeaveEnd >= 0
        };
    }

    /**
     * Main validation function that routes to appropriate validator
     * Also applies anti-exploitation validation rules
     */
    static async validateLeaveRequest(employee, requestType, leaveDates, leaveType, medicalCertificate = null) {
        // First, run type-specific validation
        let validationResult;
        switch (requestType) {
            case 'Planned':
                validationResult = await this.validatePlannedLeave(employee, leaveDates, leaveType);
                break;
            case 'Casual':
                validationResult = await this.validateCasualLeave(employee, leaveDates, leaveType);
                break;
            case 'Sick':
                validationResult = await this.validateSickLeave(employee, leaveDates, leaveType, medicalCertificate);
                break;
            case 'Loss of Pay':
            case 'Compensatory':
            case 'Backdated Leave':
                // These don't have special validation rules
                validationResult = { valid: true, errors: [], warnings: [] };
                break;
            default:
                return { valid: false, errors: ['Invalid leave request type.'], warnings: [] };
        }

        // If type-specific validation failed, return early
        if (!validationResult.valid) {
            return validationResult;
        }

        // Apply anti-exploitation validation rules (IST-ONLY)
        // These rules apply to ALL leave types (Planned, Casual, Sick, Loss of Pay, LOP)
        try {
            // Parse first leave date as IST
            const firstLeaveDate = parseISTDate(leaveDates[0]);
            if (!firstLeaveDate) {
                validationResult.valid = false;
                validationResult.errors = validationResult.errors || [];
                validationResult.errors.push('Invalid leave date provided.');
                return validationResult;
            }
            
            // Get month and year in IST
            const parts = getDatePartsIST(firstLeaveDate);
            if (!parts) {
                validationResult.valid = false;
                validationResult.errors = validationResult.errors || [];
                validationResult.errors.push('Unable to determine month for leave date.');
                return validationResult;
            }
            
            const year = parts.year;
            const month = parts.month; // 1-12
            
            // Calculate month boundaries in IST
            const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
            const monthStart = parseISTDate(monthStartStr);
            const lastDay = new Date(year, month, 0).getDate();
            const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const monthEnd = parseISTDate(monthEndStr);
            if (monthEnd) {
                monthEnd.setHours(23, 59, 59, 999);
            }
            
            // Fetch holidays for the month (IST-aware query)
            const holidays = await Holiday.find({
                date: {
                    $gte: monthStart,
                    $lte: monthEnd
                }
            });

            // Pass leaveType to anti-exploitation service for accurate working days calculation
            const antiExploitationResult = await AntiExploitationLeaveService.validateAntiExploitation(
                employee,
                leaveDates,
                leaveType, // Pass leaveType for accurate day counting
                holidays,
                requestType
            );

            // Merge warnings from anti-exploitation validation
            if (antiExploitationResult.warnings && antiExploitationResult.warnings.length > 0) {
                validationResult.warnings = validationResult.warnings || [];
                validationResult.warnings.push(...antiExploitationResult.warnings);
            }

            // If anti-exploitation rules blocked the leave, add errors
            if (antiExploitationResult.blocked) {
                validationResult.valid = false;
                validationResult.errors = validationResult.errors || [];
                validationResult.errors.push(...antiExploitationResult.errors);
                // Store validation details for audit and admin override
                validationResult.validationBlocked = true;
                validationResult.blockedRules = antiExploitationResult.blockedRules;
                validationResult.validationDetails = antiExploitationResult.validationDetails;
            }
        } catch (error) {
            console.error('Error in anti-exploitation validation:', error);
            // Don't block leave if anti-exploitation validation fails
            // Log error but allow the request to proceed
        }

        return validationResult;
    }

    /**
     * Check leave eligibility before applying (for frontend preview)
     */
    static async checkLeaveEligibility(employeeId, requestType, leaveDates, leaveType, medicalCertificate = null) {
        try {
            const employee = await User.findById(employeeId);
            if (!employee) {
                return { valid: false, errors: ['Employee not found.'], warnings: [] };
            }

            return await this.validateLeaveRequest(employee, requestType, leaveDates, leaveType, medicalCertificate);
        } catch (error) {
            console.error('Error checking leave eligibility:', error);
            return { valid: false, errors: ['Error checking leave eligibility.'], warnings: [] };
        }
    }
}

module.exports = LeaveValidationService;

