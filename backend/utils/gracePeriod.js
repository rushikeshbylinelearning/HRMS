/**
 * Grace period (lateGraceMinutes) – single source of truth.
 * Value is stored in Setting key 'lateGraceMinutes', configurable by admin in Manage section.
 * Used universally for late vs on-time and half-day reason (Incomplete Hours vs Late Arrival).
 */

const Setting = require('../models/Setting');

/** Fallback only when Setting is missing or invalid. Admin should configure in Manage section. */
const FALLBACK_GRACE_MINUTES = 30;

/**
 * Returns grace period in minutes from Setting (lateGraceMinutes).
 * Use this everywhere grace is needed; do not hardcode.
 * @returns {Promise<number>} Grace period minutes (≥ 0).
 */
async function getGracePeriodMinutes() {
    try {
        const row = await Setting.findOne({ key: 'lateGraceMinutes' }).lean();
        if (!row || row.value == null) {
            return FALLBACK_GRACE_MINUTES;
        }
        const n = parseInt(Number(row.value), 10);
        if (isNaN(n) || n < 0) {
            return FALLBACK_GRACE_MINUTES;
        }
        return n;
    } catch (e) {
        console.error('[gracePeriod] Failed to fetch lateGraceMinutes, using fallback:', e.message);
        return FALLBACK_GRACE_MINUTES;
    }
}

module.exports = { getGracePeriodMinutes, FALLBACK_GRACE_MINUTES };
