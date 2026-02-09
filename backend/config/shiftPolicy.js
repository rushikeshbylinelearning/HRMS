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

// Minimum working hours policy (DEPRECATED - kept for backward compatibility)
// NEW MODEL: Use elapsed shift time (clockOutTime - clockInTime) for attendance status
const MINIMUM_WORKING_HOURS = 8.5; // 8 hours 30 minutes (510 minutes) - minimum required for full day
const MINIMUM_WORKING_MINUTES = MINIMUM_WORKING_HOURS * 60; // 510 minutes

// Minimum to count as half-day: 4.5 hours worked + 0.5 hours break allowance = 5 total hours
// Below 5 total hours (worked + break allowance) = Absent; 5 total hours (4.5 worked + 0.5 break) to < 8.5 worked hours = Half-day; >= 8.5 worked hours = Full day
// Note: Break allowance (0.5 hours) is always added regardless of whether employee takes a break
// DEPRECATED: Use MINIMUM_ELAPSED_SHIFT_HOURS_FOR_HALF_DAY instead
const MINIMUM_HOURS_FOR_HALF_DAY = 4.5; // 4.5 hours worked time (270 minutes) - below this = Absent
const MINIMUM_MINUTES_FOR_HALF_DAY = MINIMUM_HOURS_FOR_HALF_DAY * 60; // 270 minutes worked time

// Total time threshold for half-day (worked time + break allowance)
// DEPRECATED: Use MINIMUM_ELAPSED_SHIFT_HOURS_FOR_HALF_DAY instead
const MINIMUM_TOTAL_HOURS_FOR_HALF_DAY = 5; // 5 total hours (4.5 worked + 0.5 break)
const MINIMUM_TOTAL_MINUTES_FOR_HALF_DAY = MINIMUM_TOTAL_HOURS_FOR_HALF_DAY * 60; // 300 minutes total

// NEW SHIFT MODEL: Elapsed shift time thresholds (includes paid breaks)
// Attendance status is based on elapsedShiftTime = clockOutTime - clockInTime
// Break duration does NOT reduce attendance thresholds
const MINIMUM_ELAPSED_SHIFT_HOURS_FOR_FULL_DAY = 9; // 9 hours elapsed shift time = Full Day (Present)
const MINIMUM_ELAPSED_SHIFT_MINUTES_FOR_FULL_DAY = MINIMUM_ELAPSED_SHIFT_HOURS_FOR_FULL_DAY * 60; // 540 minutes

const MINIMUM_ELAPSED_SHIFT_HOURS_FOR_HALF_DAY = 5; // 5 hours elapsed shift time = Half Day
const MINIMUM_ELAPSED_SHIFT_MINUTES_FOR_HALF_DAY = MINIMUM_ELAPSED_SHIFT_HOURS_FOR_HALF_DAY * 60; // 300 minutes

// Below 5 hours elapsed shift time = Absent

// Half-day leave: required work = 4.5 hours (270 minutes) for approved half-day leave
const HALF_DAY_WORKING_MINUTES = 270;

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

    // Calculate excess paid break (beyond allowance) in whole minutes so checkout aligns with frontend
    // Paid breaks up to 30 minutes are included in the shift, excess extends logout
    const excessPaidBreak = Math.max(0, Math.floor(totalPaidBreakMinutes - paidBreakAllowance));

    // Total extension = excess paid break + all unpaid break (whole minutes only)
    const totalExtensionMinutes = excessPaidBreak + Math.floor(totalUnpaidBreakMinutes);

    // Required logout time = clock-in + base shift duration + extensions
    // Base shift duration = 9 hours (8.5 working + 0.5 paid break allowance)
    // Extensions = excess paid break + unpaid break (floored so UI and server match)
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
    MINIMUM_WORKING_HOURS,
    MINIMUM_WORKING_MINUTES,
    MINIMUM_HOURS_FOR_HALF_DAY,
    MINIMUM_MINUTES_FOR_HALF_DAY,
    MINIMUM_TOTAL_HOURS_FOR_HALF_DAY,
    MINIMUM_TOTAL_MINUTES_FOR_HALF_DAY,
    HALF_DAY_WORKING_MINUTES,
    
    // New shift model: Elapsed shift time thresholds
    MINIMUM_ELAPSED_SHIFT_HOURS_FOR_FULL_DAY,
    MINIMUM_ELAPSED_SHIFT_MINUTES_FOR_FULL_DAY,
    MINIMUM_ELAPSED_SHIFT_HOURS_FOR_HALF_DAY,
    MINIMUM_ELAPSED_SHIFT_MINUTES_FOR_HALF_DAY,

    // Calculation function
    calculateRequiredLogoutTime
};

