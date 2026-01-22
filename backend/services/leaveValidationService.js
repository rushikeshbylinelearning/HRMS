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
     * Main validation function - delegates to LeavePolicyService
     */
    static async validateLeaveRequest(employee, requestType, leaveDates, leaveType, medicalCertificate = null, alternateDate = null) {
        // Delegate to central policy service
        const policyCheck = await LeavePolicyService.validateRequest(employee._id, leaveDates, requestType, leaveType, null, alternateDate);
        
        if (!policyCheck.allowed) {
            return { 
                valid: false, 
                errors: [policyCheck.reason], 
                warnings: [] 
            };
        }

        // Additional legacy validations for backward compatibility
        const legacyValidations = await this.performLegacyValidations(employee, requestType, leaveDates, leaveType, medicalCertificate);
        
        return legacyValidations;
    }

    /**
     * Perform legacy validations for backward compatibility
     */
    static async performLegacyValidations(employee, requestType, leaveDates, leaveType, medicalCertificate) {
        const warnings = [];
        
        // Medical certificate check for sick leave
        if (requestType === 'Sick') {
            if (!medicalCertificate || medicalCertificate.trim() === '') {
                return {
                    valid: false,
                    errors: ['Medical certificate is mandatory for sick leave applications.'],
                    warnings: []
                };
            }
            
            const today = parseISTDate(getISTDateString());
            const lastLeaveDate = parseISTDate(leaveDates[leaveDates.length - 1]);
            const daysSinceLeaveEnd = Math.floor((today - lastLeaveDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceLeaveEnd < 0) {
                warnings.push('Sick leave is typically applied after returning to office. Please ensure you have a valid medical certificate.');
            }
            
            const leaveDuration = this.calculateLeaveDuration(leaveDates, leaveType);
            if (leaveDuration >= 6) {
                warnings.push('Using all sick leave days at once. Please ensure this is necessary and you have proper medical documentation.');
            }
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

        return {
            valid: true,
            errors: [],
            warnings: warnings
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

