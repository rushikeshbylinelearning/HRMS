// backend/services/leaveValidationService.js
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const AntiExploitationLeaveService = require('./antiExploitationLeaveService');
const LeavePolicyService = require('./LeavePolicyService');
const dateUtils = require('../utils/dateUtils');

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
     * Get half-year period for a date (First Half: Jan-Jun, Second Half: Jul-Dec)
     */
    static getHalfYearPeriod(date) {
        const month = date.getMonth(); // 0-11
        return month < 6 ? 'First Half' : 'Second Half';
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

        // Check half-year allocation (5 days per half)
        const halfYearPeriod = this.getHalfYearPeriod(firstLeaveDate);

        // Get all approved planned leaves for the same half-year period
        const year = firstLeaveDate.getFullYear();
        const halfYearStart = halfYearPeriod === 'First Half'
            ? new Date(year, 0, 1)  // Jan 1
            : new Date(year, 6, 1);  // Jul 1
        const halfYearEnd = halfYearPeriod === 'First Half'
            ? new Date(year, 5, 30, 23, 59, 59, 999)  // Jun 30 end of day
            : new Date(year, 11, 31, 23, 59, 59, 999); // Dec 31 end of day

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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstLeaveDate = new Date(leaveDates[0]);
        firstLeaveDate.setHours(0, 0, 0, 0);

        // Calculate days difference
        const daysDiff = Math.floor((firstLeaveDate - today) / (1000 * 60 * 60 * 24));

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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastLeaveDate = new Date(leaveDates[leaveDates.length - 1]);
        lastLeaveDate.setHours(0, 0, 0, 0);

        // Check if applied after return (leave end date should be in the past or today)
        const daysSinceLeaveEnd = Math.floor((today - lastLeaveDate) / (1000 * 60 * 60 * 24));

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
        // PRIMARY POLICY CHECK (Hard Limits & Blocks)
        // Admin Override is checked here
        // We pass 'undefined' for overrideReason here if we don't have it in this signature yet?
        // Wait, validateLeaveRequest signature doesn't have overrideReason. 
        // We need to update signature if we support override validation at submission time?
        // Usually submission doesn't have override. Approval does.
        // But the user might be an Admin applying for leave?
        // For now, assume Submission = Strict. Approval = Can Override.
        // The policy service handles 'adminOverrideReason' as optional last arg.

        const policyCheck = await LeavePolicyService.validateRequest(employee._id, leaveDates, requestType, leaveType);
        if (!policyCheck.allowed) {
            return { valid: false, errors: [policyCheck.reason], warnings: [] };
        }

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

        // Apply anti-exploitation validation rules
        // These rules apply to ALL leave types (Planned, Casual, Sick, Loss of Pay, LOP)
        try {
            // Fetch holidays for the month
            const firstLeaveDate = new Date(leaveDates[0]);
            const month = firstLeaveDate.getMonth();
            const year = firstLeaveDate.getFullYear();
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

            const holidays = await Holiday.find({
                date: {
                    $gte: monthStart,
                    $lte: monthEnd
                }
            });

            // DEPRECATED: AntiExploitationLeaveService is replaced by LeavePolicyService
            // Keeping this strictly for logging/audit legacy if needed, but for ENFORCEMENT, LeavePolicyService is King.
            // Actually, we should probably remove this to avoid "Double Error" confusion or "Shadow Rules".
            // The prompt said "No duplicate policy logic".
            // So we REMOVE the call to AntiExploitationLeaveService.validateAntiExploitation

            // (Code removed)

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

