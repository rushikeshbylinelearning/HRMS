// backend/config/shiftPolicy.js
/**
 * SHIFT POLICY CONSTANTS - SINGLE SOURCE OF TRUTH
 * 
 * This file defines the authoritative policy for shift duration and break calculations.
 * All calculations MUST reference these constants to ensure consistency.
 * 
 * POLICY DEFINITION:
 * - Shift working time: 8 hours 30 minutes (510 minutes)
 * - Allowed paid break: 30 minutes
 * - Shift total duration: 9 hours (540 minutes) = working time + paid break allowance
 * 
 * BREAK RULES:
 * 1. Paid breaks up to 30 minutes are included in the 9-hour shift
 * 2. Paid breaks beyond 30 minutes → excess is treated as unpaid and extends logout time
 * 3. All unpaid break time MUST extend required logout time
 * 
 * REQUIRED LOGOUT TIME CALCULATION:
 * requiredLogoutTime = clockInTime 
 *                     + requiredWorkingTime (8.5 hours)
 *                     + excessPaidBreak (paidBreak - 30min if > 30min)
 *                     + totalUnpaidBreak
 */

// Core shift policy constants
const SHIFT_WORKING_MINUTES = 8.5 * 60; // 510 minutes (8 hours 30 minutes)
const SHIFT_PAID_BREAK_ALLOWANCE_MINUTES = 30; // 30 minutes paid break
const SHIFT_TOTAL_MINUTES = 9 * 60; // 540 minutes (9 hours total)

// Break policy constants
const PAID_BREAK_ALLOWANCE_MINUTES = 30; // Maximum paid break allowed
const UNPAID_BREAK_ALLOWANCE_MINUTES = 10; // Allowance for unpaid breaks (for penalty tracking only)
const EXTRA_BREAK_ALLOWANCE_MINUTES = 10; // Allowance for extra breaks (for penalty tracking only)

/**
 * Calculate required logout time based on policy rules
 * 
 * FORMULA:
 * requiredLogoutTime = clockInTime + requiredWorkingTime + excessPaidBreak + unpaidBreak
 * 
 * Where:
 * - requiredWorkingTime = 8.5 hours (510 minutes)
 * - excessPaidBreak = max(0, totalPaidBreak - 30 minutes)
 * - unpaidBreak = all unpaid break minutes
 * 
 * @param {Date} clockInTime - The clock-in time
 * @param {number} totalPaidBreakMinutes - Total paid break minutes taken
 * @param {number} totalUnpaidBreakMinutes - Total unpaid break minutes taken
 * @param {Object} shiftPolicy - Optional shift policy override (defaults to constants above)
 * @returns {Object} {
 *   requiredLogoutTime: Date,
 *   breakdown: {
 *     clockInTime: Date,
 *     requiredWorkingMinutes: number,
 *     paidBreakMinutes: number,
 *     excessPaidBreakMinutes: number,
 *     unpaidBreakMinutes: number,
 *     totalExtensionMinutes: number
 *   }
 * }
 */
const calculateRequiredLogoutTime = (clockInTime, totalPaidBreakMinutes = 0, totalUnpaidBreakMinutes = 0, shiftPolicy = {}) => {
    if (!clockInTime) {
        return null;
    }

    const workingMinutes = shiftPolicy.workingMinutes || SHIFT_WORKING_MINUTES;
    const paidBreakAllowance = shiftPolicy.paidBreakAllowance || PAID_BREAK_ALLOWANCE_MINUTES;

    // Calculate excess paid break (beyond allowance)
    // Paid breaks up to 30 minutes are included in the shift, excess extends logout
    const excessPaidBreak = Math.max(0, totalPaidBreakMinutes - paidBreakAllowance);

    // Total extension = excess paid break + all unpaid break
    const totalExtensionMinutes = excessPaidBreak + totalUnpaidBreakMinutes;

    // Required logout time = clock-in + base shift duration + extensions
    // Base shift duration = 9 hours (8.5 working + 0.5 paid break allowance)
    // Extensions = excess paid break + unpaid break
    const baseShiftMinutes = workingMinutes + paidBreakAllowance;
    const requiredLogoutTime = new Date(clockInTime);
    requiredLogoutTime.setMinutes(requiredLogoutTime.getMinutes() + baseShiftMinutes + totalExtensionMinutes);
    
    // DEBUG: Log policy calculation
    console.log('[calculateRequiredLogoutTime] Policy calculation:', {
        totalPaidBreakMinutes,
        paidBreakAllowance,
        excessPaidBreak,
        totalUnpaidBreakMinutes,
        totalExtensionMinutes,
        baseShiftMinutes,
        clockInTime: clockInTime.toISOString(),
        requiredLogoutTime: requiredLogoutTime.toISOString(),
        requiredLogoutTimeIST: requiredLogoutTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    return {
        requiredLogoutTime,
        breakdown: {
            clockInTime: new Date(clockInTime),
            requiredWorkingMinutes: workingMinutes,
            baseShiftMinutes: baseShiftMinutes,
            paidBreakMinutes: totalPaidBreakMinutes,
            excessPaidBreakMinutes: excessPaidBreak,
            unpaidBreakMinutes: totalUnpaidBreakMinutes,
            totalExtensionMinutes: totalExtensionMinutes
        }
    };
};

module.exports = {
    // Constants
    SHIFT_WORKING_MINUTES,
    SHIFT_PAID_BREAK_ALLOWANCE_MINUTES,
    SHIFT_TOTAL_MINUTES,
    PAID_BREAK_ALLOWANCE_MINUTES,
    UNPAID_BREAK_ALLOWANCE_MINUTES,
    EXTRA_BREAK_ALLOWANCE_MINUTES,
    
    // Calculation function
    calculateRequiredLogoutTime
};

