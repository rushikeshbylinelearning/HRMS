const AttendanceLog = require('../models/AttendanceLog');
const BreakLog = require('../models/BreakLog');
const { getISTDateString, getISTNow } = require('../utils/istTime');
const { hasTeaBreakEnded } = require('./teaBreakState');

const TEA_BREAK_REASON_PREFIX = 'tea_break:';

function invalidateEmployeeCaches(employeeId, today) {
  try {
    const cache = require('../utils/cache');
    cache.delete(`employee_dashboard:${employeeId}:${today}`);
    cache.delete(`status:${employeeId}:${today}`);
    const cacheService = require('../services/cacheService');
    cacheService.invalidateDashboard(today);
  } catch (_) {
    /* optional */
  }
}

function teaBreakReason(announcementId) {
  return `${TEA_BREAK_REASON_PREFIX}${announcementId}`;
}

function computeOverrunMinutes(teaBreakStartedAt, now = getISTNow()) {
  const started = new Date(teaBreakStartedAt);
  const allowanceEnd = new Date(started.getTime() + 10 * 60 * 1000);
  if (now <= allowanceEnd) return 0;
  return Math.max(0, Math.floor((now - allowanceEnd) / 60000));
}

/**
 * Apply or extend auto unpaid break for tea break overrun.
 * @returns {{ applied: boolean, overrunMinutes: number, skippedReason?: string }}
 */
async function applyTeaBreakOverrun(employeeId, teaBreakStartedAt, announcementId) {
  const today = getISTDateString();
  const now = getISTNow();

  const AnnouncementMessage = require('../models/AnnouncementMessage');
  const ann = await AnnouncementMessage.findById(announcementId).select('teaBreakStoppedAt').lean();
  if (ann?.teaBreakStoppedAt) {
    return { applied: false, overrunMinutes: 0, skippedReason: 'tea_break_stopped' };
  }

  if (hasTeaBreakEnded(announcementId, employeeId)) {
    return { applied: false, overrunMinutes: 0, skippedReason: 'already_ended' };
  }

  const overrunMinutes = computeOverrunMinutes(teaBreakStartedAt, now);
  if (overrunMinutes <= 0) {
    return { applied: false, overrunMinutes: 0, skippedReason: 'within_allowance' };
  }

  const log = await AttendanceLog.findOne({ user: employeeId, attendanceDate: today });
  if (!log || log.clockOutTime) {
    console.warn(`[TeaBreak] Skip employee ${employeeId}: no active attendance log`);
    return { applied: false, overrunMinutes: 0, skippedReason: 'not_clocked_in' };
  }

  const activeBreak = await BreakLog.findOne({ attendanceLog: log._id, endTime: null });
  if (activeBreak) {
    console.warn(`[TeaBreak] Skip employee ${employeeId}: already on active break`);
    return { applied: false, overrunMinutes: 0, skippedReason: 'active_break' };
  }

  const reason = teaBreakReason(announcementId);
  const allowanceEnd = new Date(new Date(teaBreakStartedAt).getTime() + 10 * 60 * 1000);

  let existing = await BreakLog.findOne({
    attendanceLog: log._id,
    userId: employeeId,
    isAutoCreatedFromTeaBreak: true,
    reason,
  });

  if (!existing) {
    await BreakLog.create({
      attendanceLog: log._id,
      userId: employeeId,
      type: 'Unpaid',
      breakType: 'Unpaid',
      startTime: allowanceEnd,
      endTime: now,
      durationMinutes: overrunMinutes,
      reason,
      isAutoBreak: true,
      isAutoCreatedFromTeaBreak: true,
    });
    await AttendanceLog.findByIdAndUpdate(log._id, {
      $inc: { unpaidBreakMinutesTaken: overrunMinutes },
    });
    invalidateEmployeeCaches(employeeId, today);
    return { applied: true, overrunMinutes };
  }

  const previousDuration = existing.durationMinutes || 0;
  const delta = overrunMinutes - previousDuration;
  if (delta <= 0) {
    return { applied: false, overrunMinutes, skippedReason: 'no_new_overrun' };
  }

  existing.endTime = now;
  existing.durationMinutes = overrunMinutes;
  await existing.save();

  await AttendanceLog.findByIdAndUpdate(log._id, {
    $inc: { unpaidBreakMinutesTaken: delta },
  });

  invalidateEmployeeCaches(employeeId, today);
  return { applied: true, overrunMinutes };
}

/**
 * Finalize auto tea break log when employee ends voluntarily.
 * Only increments unpaid minutes by the delta since the last enforcement tick.
 */
async function finalizeTeaBreakOnEnd(employeeId, announcementId, teaBreakStartedAt) {
  const today = getISTDateString();
  const now = getISTNow();
  const log = await AttendanceLog.findOne({ user: employeeId, attendanceDate: today });
  if (!log) {
    return { overrunMinutes: 0 };
  }

  const reason = teaBreakReason(announcementId);
  const existing = await BreakLog.findOne({
    attendanceLog: log._id,
    userId: employeeId,
    isAutoCreatedFromTeaBreak: true,
    reason,
  });

  const overrunMinutes = computeOverrunMinutes(teaBreakStartedAt, now);
  if (!existing) {
    if (overrunMinutes > 0) {
      const allowanceEnd = new Date(new Date(teaBreakStartedAt).getTime() + 10 * 60 * 1000);
      await BreakLog.create({
        attendanceLog: log._id,
        userId: employeeId,
        type: 'Unpaid',
        breakType: 'Unpaid',
        startTime: allowanceEnd,
        endTime: now,
        durationMinutes: overrunMinutes,
        reason,
        isAutoBreak: true,
        isAutoCreatedFromTeaBreak: true,
      });
      await AttendanceLog.findByIdAndUpdate(log._id, {
        $inc: { unpaidBreakMinutesTaken: overrunMinutes },
      });
    }
    return { overrunMinutes: Math.max(0, overrunMinutes) };
  }

  const previousDuration = existing.durationMinutes || 0;
  const finalDuration = Math.max(
    previousDuration,
    Math.floor((now - new Date(existing.startTime)) / 60000)
  );
  const delta = finalDuration - previousDuration;

  existing.endTime = now;
  existing.durationMinutes = finalDuration;
  await existing.save();

  if (delta > 0) {
    await AttendanceLog.findByIdAndUpdate(log._id, {
      $inc: { unpaidBreakMinutesTaken: delta },
    });
  }

  return { overrunMinutes: finalDuration };
}

module.exports = {
  applyTeaBreakOverrun,
  finalizeTeaBreakOnEnd,
  computeOverrunMinutes,
  teaBreakReason,
};
