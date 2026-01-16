// backend/services/leaveValidationService.js
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const LeavePolicyService = require('./LeavePolicyService');
const { parseISTDate, getISTDateString } = require('../utils/istTime');

/**
 * Leave Validation Service
 * Delegates to LeavePolicyService for policy enforcement
 * Maintains backward compatibility for existing API calls
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
     * UPDATED: Streamlined validation with new Sick Leave certificate rules
     * This service now acts as a thin compatibility wrapper
     */
    static async validateLeaveRequest(employee, requestType, leaveDates, leaveType, medicalCertificate = null) {
        // NEW: Enhanced medical certificate validation for sick leave
        if (requestType === 'Sick') {
            const certificateCheck = this.validateSickLeaveCertificate(leaveDates, medicalCertificate);
            if (!certificateCheck.valid) {
                return {
                    valid: false,
                    errors: [certificateCheck.reason],
                    warnings: [],
                    certificateRequired: certificateCheck.certificateRequired
                };
            }
        }

        // Delegate to central policy service for all business rules
        const policyCheck = await LeavePolicyService.validateRequest(employee._id, leaveDates, requestType, leaveType);
        
        if (!policyCheck.allowed) {
            return { 
                valid: false, 
                errors: [policyCheck.reason], 
                warnings: [] 
            };
        }

        // Balance check
        const leaveDuration = this.calculateLeaveDuration(leaveDates, leaveType);
        const balanceCheck = LeavePolicyService.checkLeaveBalance(employee, requestType, leaveDuration);
        
        if (!balanceCheck.sufficient) {
            return {
                valid: false,
                errors: [balanceCheck.reason],
                warnings: []
            };
        }

        // Generate warnings for sick leave
        const warnings = [];
        if (requestType === 'Sick') {
            const today = parseISTDate(getISTDateString());
            const lastLeaveDate = parseISTDate(leaveDates[leaveDates.length - 1]);
            const daysSinceLeaveEnd = Math.floor((today - lastLeaveDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceLeaveEnd < 0) {
                warnings.push('Sick leave is typically applied after returning to office. Please ensure you have a valid medical certificate.');
            }
            
            if (leaveDuration >= 6) {
                warnings.push('Using all sick leave days at once. Please ensure this is necessary and you have proper medical documentation.');
            }
        }

        return {
            valid: true,
            errors: [],
            warnings: warnings
        };
    }

    /**
     * NEW: Validate Sick Leave medical certificate requirement based on date logic
     * @param {Array} leaveDates - Array of leave dates
     * @param {String} medicalCertificate - Medical certificate URL/path (can be null/undefined)
     * @returns {Object} Validation result with certificate requirement
     */
    static validateSickLeaveCertificate(leaveDates, medicalCertificate) {
        const today = parseISTDate(getISTDateString());
        const firstLeaveDate = parseISTDate(leaveDates[0]);
        
        // Normalize dates to compare only the date part (ignore time)
        const todayDateStr = getISTDateString(today);
        const leaveDateStr = getISTDateString(firstLeaveDate);
        
        // Debug logging
        console.log(`[Sick Leave Certificate Check] Today: ${todayDateStr}, Leave Date: ${leaveDateStr}, Certificate: ${medicalCertificate ? 'PROVIDED' : 'NOT PROVIDED'}`);
        
        // Rule 1: If leaveDate == today (IST) → Medical certificate is NOT required
        if (leaveDateStr === todayDateStr) {
            console.log('[Sick Leave Certificate Check] Same-day application - certificate NOT required');
            return {
                valid: true,
                certificateRequired: false,
                reason: 'Medical certificate not required for same-day sick leave'
            };
        }
        
        // Rule 2: If leaveDate < today (backdated sick leave) → Medical certificate is MANDATORY
        if (firstLeaveDate < today) {
            console.log('[Sick Leave Certificate Check] Backdated application - certificate MANDATORY');
            if (!medicalCertificate || medicalCertificate.trim() === '') {
                return {
                    valid: false,
                    certificateRequired: true,
                    reason: 'Medical certificate is mandatory for backdated sick leave applications.'
                };
            }
            return {
                valid: true,
                certificateRequired: true,
                reason: 'Medical certificate provided for backdated sick leave'
            };
        }
        
        // Rule 3: If leaveDate > today → Medical certificate is OPTIONAL (do not enforce)
        console.log('[Sick Leave Certificate Check] Future application - certificate OPTIONAL');
        return {
            valid: true,
            certificateRequired: false,
            reason: 'Medical certificate is optional for future sick leave'
        };
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

