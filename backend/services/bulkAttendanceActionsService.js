const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const AnnouncementMessage = require('../models/AnnouncementMessage');
const NewNotificationService = require('./NewNotificationService');
const cacheService = require('./cacheService');
const cache = require('../utils/cache');
const { getISTNow, getISTDateString } = require('../utils/istTime');
const { getLiveAttendanceOverview } = require('./liveAttendanceService');
const { stopAllActiveTeaBreaks } = require('./teaBreakStopService');
const {
    UNPAID_BREAK_ALLOWANCE_MINUTES,
    EXTRA_BREAK_ALLOWANCE_MINUTES,
    PAID_BREAK_ALLOWANCE_MINUTES,
} = require('../config/shiftPolicy');

const VALID_ACTIONS = new Set([
    'refresh_live_attendance',
    'stop_tea_breaks',
    'end_lunch_breaks',
    'end_other_breaks',
]);

const TEA_BREAK_SAFETY_CUTOFF_MS = 30 * 60 * 1000;

async function getTodayClockedInUserIds(today) {
    const logs = await AttendanceLog.find({
        attendanceDate: today,
        clockInTime: { $ne: null },
        clockOutTime: null,
    })
        .select('_id user')
        .lean();

    const userIds = [];
    for (const log of logs) {
        const activeSession = await AttendanceSession.findOne({
            attendanceLog: log._id,
            endTime: null,
        })
            .select('_id')
            .lean();
        if (activeSession) {
            userIds.push(String(log.user));
        }
    }
    return userIds;
}

async function countActiveTeaBreaks() {
    const now = getISTNow();
    const cutoff = new Date(now.getTime() - TEA_BREAK_SAFETY_CUTOFF_MS);
    return AnnouncementMessage.countDocuments({
        isTEABreak: true,
        teaBreakStartedAt: { $gte: cutoff, $lte: now },
        teaBreakStoppedAt: null,
    });
}

async function countActiveBreaksByCategory(breakTypes) {
    const today = getISTDateString();
    const userIds = await getTodayClockedInUserIds(today);
    if (!userIds.length) return 0;

    const logs = await AttendanceLog.find({
        user: { $in: userIds },
        attendanceDate: today,
    })
        .select('_id')
        .lean();

    const logIds = logs.map((log) => log._id);
    if (!logIds.length) return 0;

    return BreakLog.countDocuments({
        attendanceLog: { $in: logIds },
        endTime: null,
        breakType: { $in: breakTypes },
    });
}

async function getBulkActionPreview() {
    const [overview, teaBreakCount, lunchBreakCount, otherBreakCount] = await Promise.all([
        getLiveAttendanceOverview({ leaveRange: 'today' }),
        countActiveTeaBreaks(),
        countActiveBreaksByCategory(['Paid']),
        countActiveBreaksByCategory(['Unpaid', 'Extra']),
    ]);

    return {
        refresh_live_attendance: {
            label: 'Refresh live attendance',
            description: 'Invalidate caches and reload today\'s live attendance snapshot.',
            affectedCount: overview.counts?.present ?? 0,
            meta: overview.counts,
        },
        stop_tea_breaks: {
            label: 'Stop all tea breaks',
            description: 'End company-wide tea break announcements for all clocked-in employees.',
            affectedCount: teaBreakCount,
        },
        end_lunch_breaks: {
            label: 'End all lunch breaks',
            description: 'Force-end active paid (lunch) breaks for employees still on break.',
            affectedCount: lunchBreakCount,
        },
        end_other_breaks: {
            label: 'End all other breaks',
            description: 'Force-end active unpaid and extra breaks.',
            affectedCount: otherBreakCount,
        },
    };
}

async function endSingleActiveBreak(activeBreak, log, initiatedByUserId) {
    const breakEndTime = getISTNow();
    const currentBreakDuration = Math.round(
        (breakEndTime - new Date(activeBreak.startTime)) / (1000 * 60)
    );

    let penalty = 0;
    let paidBreakToAdd = 0;
    let unpaidBreakToAdd = 0;

    if (activeBreak.breakType === 'Paid') {
        const user = await User.findById(log.user).populate('shiftGroup').lean();
        const paidBreakAllowance = user?.shiftGroup?.paidBreakMinutes || PAID_BREAK_ALLOWANCE_MINUTES;
        const remainingPaidAllowance = paidBreakAllowance - (log.paidBreakMinutesTaken || 0);
        paidBreakToAdd = currentBreakDuration;
        if (currentBreakDuration > Math.max(0, remainingPaidAllowance)) {
            penalty = currentBreakDuration - Math.max(0, remainingPaidAllowance);
        }
    } else if (activeBreak.breakType === 'Unpaid' || activeBreak.breakType === 'Extra') {
        const allowance = activeBreak.breakType === 'Unpaid'
            ? UNPAID_BREAK_ALLOWANCE_MINUTES
            : EXTRA_BREAK_ALLOWANCE_MINUTES;
        unpaidBreakToAdd = currentBreakDuration;
        if (currentBreakDuration > allowance) {
            penalty = currentBreakDuration - allowance;
        }
    }

    await BreakLog.findByIdAndUpdate(activeBreak._id, {
        $set: { endTime: breakEndTime, durationMinutes: currentBreakDuration },
    });

    const updatePayload = { $inc: {} };
    if (penalty > 0) updatePayload.$inc.penaltyMinutes = penalty;
    if (paidBreakToAdd > 0) updatePayload.$inc.paidBreakMinutesTaken = paidBreakToAdd;
    if (unpaidBreakToAdd > 0) updatePayload.$inc.unpaidBreakMinutesTaken = unpaidBreakToAdd;
    if (Object.keys(updatePayload.$inc).length > 0) {
        await AttendanceLog.findByIdAndUpdate(log._id, updatePayload);
    }

    const user = await User.findById(log.user).select('fullName role').lean();
    const today = log.attendanceDate;

    if (user && !['Admin', 'HR'].includes(user.role)) {
        NewNotificationService.createAndEmitNotification({
            message: `Your ${activeBreak.breakType} break was ended by an administrator.`,
            type: 'info',
            userId: log.user,
            userName: user.fullName,
            recipientType: 'user',
            category: 'break',
        }).catch(() => {});
    }

    cache.delete(`status:${log.user}:${today}`);
    cache.delete(`employee_dashboard:${log.user}:${today}`);

    return { userId: String(log.user), breakId: String(activeBreak._id), breakType: activeBreak.breakType };
}

async function endBreaksByCategory(breakTypes) {
    const today = getISTDateString();
    const userIds = await getTodayClockedInUserIds(today);
    if (!userIds.length) {
        return { processedCount: 0, details: [] };
    }

    const logs = await AttendanceLog.find({
        user: { $in: userIds },
        attendanceDate: today,
    }).lean();

    const logIds = logs.map((log) => log._id);
    const activeBreaks = await BreakLog.find({
        attendanceLog: { $in: logIds },
        endTime: null,
        breakType: { $in: breakTypes },
    }).lean();

    const logById = new Map(logs.map((log) => [String(log._id), log]));
    const details = [];

    for (const activeBreak of activeBreaks) {
        const log = logById.get(String(activeBreak.attendanceLog));
        if (!log) continue;
        try {
            const result = await endSingleActiveBreak(activeBreak, log);
            details.push({ ...result, success: true });
        } catch (err) {
            details.push({
                breakId: String(activeBreak._id),
                success: false,
                error: err.message,
            });
        }
    }

    cacheService.invalidateDashboard(today);
    cache.deletePattern('dashboard-summary:*');

    try {
        const { getIO } = require('../socketManager');
        const io = getIO();
        if (io) {
            io.emit('attendance_log_updated', {
                attendanceDate: today,
                timestamp: getISTNow().toISOString(),
                message: 'Bulk break action completed.',
            });
            io.emit('live_attendance_refreshed', { date: today });
        }
    } catch (_) {
        /* optional */
    }

    return {
        processedCount: details.filter((d) => d.success).length,
        failedCount: details.filter((d) => !d.success).length,
        details,
    };
}

async function refreshLiveAttendance() {
    const today = getISTDateString();
    cacheService.invalidateDashboard(today);
    cacheService.invalidateAttendance(null, today);
    cache.deletePattern('dashboard-summary:*');

    const overview = await getLiveAttendanceOverview({ leaveRange: 'today' });

    try {
        const { getIO } = require('../socketManager');
        const io = getIO();
        if (io) {
            io.emit('live_attendance_refreshed', {
                date: today,
                counts: overview.counts,
                lastUpdated: overview.lastUpdated,
            });
        }
    } catch (_) {
        /* optional */
    }

    return {
        processedCount: 1,
        overview: {
            counts: overview.counts,
            lastUpdated: overview.lastUpdated,
        },
    };
}

async function executeBulkAction(action, performedByUserId) {
    if (!VALID_ACTIONS.has(action)) {
        const error = new Error(`Invalid action: ${action}`);
        error.statusCode = 400;
        throw error;
    }

    let result;

    switch (action) {
        case 'refresh_live_attendance':
            result = await refreshLiveAttendance();
            break;
        case 'stop_tea_breaks':
            result = await stopAllActiveTeaBreaks();
            cacheService.invalidateDashboard(getISTDateString());
            result = {
                processedCount: result.stoppedCount ?? 0,
                details: result.results ?? [],
            };
            break;
        case 'end_lunch_breaks':
            result = await endBreaksByCategory(['Paid']);
            break;
        case 'end_other_breaks':
            result = await endBreaksByCategory(['Unpaid', 'Extra']);
            break;
        default:
            result = { processedCount: 0 };
    }

    try {
        const logAction = require('./logAction');
        await logAction(performedByUserId, 'BULK_ATTENDANCE_ACTION', {
            action,
            processedCount: result.processedCount ?? 0,
            details: `Bulk attendance action "${action}" executed.`,
        });
    } catch (_) {
        /* audit optional */
    }

    return {
        success: true,
        action,
        ...result,
    };
}

module.exports = {
    VALID_ACTIONS,
    getBulkActionPreview,
    executeBulkAction,
};
