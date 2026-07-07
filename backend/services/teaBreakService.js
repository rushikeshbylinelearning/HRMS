const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const { getISTDateString, getISTNow } = require('../utils/istTime');
const { hasTeaBreakEnded } = require('./teaBreakState');

const TEA_BREAK_REASON_PREFIX = 'tea_break:';
const TEA_BREAK_DURATION_MS = 10 * 60 * 1000;
const TEA_BREAK_SAFETY_CUTOFF_MS = 30 * 60 * 1000;

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

/**
 * Employees with an open attendance session today (checked in, not clocked out).
 * Uses exactly 2 queries regardless of employee count (batched, no N+1).
 */
async function getClockedInEmployeeIds() {
  const today = getISTDateString();

  // Query 1: all today's logs that are clocked in but not clocked out
  const logs = await AttendanceLog.find({
    attendanceDate: today,
    clockInTime: { $ne: null },
    clockOutTime: null,
  })
    .select('_id user')
    .lean();

  if (logs.length === 0) return [];

  const logIds = logs.map((l) => l._id);

  // Query 2: find which of those logs have an open session (single batched query)
  const activeSessions = await AttendanceSession.find({
    attendanceLog: { $in: logIds },
    endTime: null,
  })
    .select('attendanceLog')
    .lean();

  const activeLogIdSet = new Set(activeSessions.map((s) => String(s.attendanceLog)));

  return logs
    .filter((l) => activeLogIdSet.has(String(l._id)))
    .map((l) => String(l.user));
}

async function isEmployeeClockedIn(employeeId) {
  const ids = await getClockedInEmployeeIds();
  return ids.includes(String(employeeId));
}

/**
 * Shared attendance snapshot for tea-break classification (load once per batch).
 */
async function buildTeaBreakAttendanceContext(userIds) {
  const today = getISTDateString();

  const logs = await AttendanceLog.find({
    attendanceDate: today,
    user: { $in: userIds },
  })
    .select('user clockInTime clockOutTime')
    .lean();

  const logMap = new Map(logs.map((l) => [String(l.user), l]));
  const clockedInNow = new Set(await getClockedInEmployeeIds());

  return { logMap, clockedInNow };
}

function resolveTeaBreakOpenStatus(userId, logMap, clockedInNow) {
  const id = String(userId);
  const log = logMap.get(id);

  if (clockedInNow.has(id)) {
    return 'on_break';
  }
  if (!log?.clockInTime) {
    return 'not_checked_in';
  }
  if (log.clockOutTime) {
    return 'clocked_out_open';
  }
  return 'not_checked_in';
}

/**
 * Count-only variant for insights summaries (no user list payloads).
 */
function countTeaBreakOpenUsers(eligibleUserIds, returnedIds, attendanceContext) {
  const { logMap, clockedInNow } = attendanceContext;
  let onBreakCount = 0;
  let notApplicableCount = 0;
  let pendingCount = 0;

  for (const userId of eligibleUserIds) {
    const id = String(userId);
    if (returnedIds.has(id)) continue;

    pendingCount += 1;
    const status = resolveTeaBreakOpenStatus(userId, logMap, clockedInNow);

    if (status === 'on_break' || status === 'clocked_out_open') {
      onBreakCount += 1;
    }
    if (status === 'not_checked_in') {
      notApplicableCount += 1;
    }
  }

  return { pendingCount, onBreakCount, notApplicableCount };
}

/**
 * Classify employees who have not formally closed the tea break.
 */
async function classifyTeaBreakOpenUsers(eligibleUsers, returnedIds, attendanceContext = null) {
  const userIds = eligibleUsers.map((u) => u._id);
  const context = attendanceContext || (await buildTeaBreakAttendanceContext(userIds));
  const { logMap, clockedInNow } = context;

  const pending = [];
  const onBreak = [];
  const notApplicable = [];

  for (const u of eligibleUsers) {
    const id = u._id.toString();
    if (returnedIds.has(id)) continue;

    const base = {
      userId: u._id,
      fullName: u.fullName,
      role: u.role,
      profileImageUrl: u.profileImageUrl,
      department: u.department,
    };

    const status = resolveTeaBreakOpenStatus(u._id, logMap, clockedInNow);

    if (status === 'on_break') {
      const entry = {
        ...base,
        teaBreakStatus: 'on_break',
        teaBreakStatusLabel: 'On break — not closed yet',
      };
      onBreak.push(entry);
      pending.push(entry);
    } else if (status === 'not_checked_in') {
      const entry = {
        ...base,
        teaBreakStatus: 'not_checked_in',
        teaBreakStatusLabel: 'Not checked in — break does not apply',
      };
      notApplicable.push(entry);
      pending.push(entry);
    } else if (status === 'clocked_out_open') {
      const entry = {
        ...base,
        teaBreakStatus: 'clocked_out_open',
        teaBreakStatusLabel: 'Clocked out without closing break',
      };
      onBreak.push(entry);
      pending.push(entry);
    }
  }

  return { pending, onBreak, notApplicable };
}

function computeTeaBreakTiming(teaBreakStartedAt, now = getISTNow()) {
  const started = new Date(teaBreakStartedAt);
  const allowanceEndsAt = new Date(started.getTime() + TEA_BREAK_DURATION_MS);
  const safetyEndsAt = new Date(started.getTime() + TEA_BREAK_SAFETY_CUTOFF_MS);
  const remainingSeconds = Math.max(0, Math.floor((allowanceEndsAt - now) / 1000));
  return {
    teaBreakStartedAt: started,
    allowanceEndsAt,
    safetyEndsAt,
    remainingSeconds,
    durationMinutes: 10,
    serverNow: now,
  };
}

function buildTeaBreakActivePayload(announcement, timing, initiatedByUserId = null) {
  return {
    active: true,
    announcementId: announcement._id,
    teaBreakStartedAt: timing.teaBreakStartedAt,
    teaBreakType: announcement.teaBreakType,
    durationMinutes: timing.durationMinutes,
    endsAt: timing.allowanceEndsAt,
    remainingSeconds: timing.remainingSeconds,
    serverNow: timing.serverNow,
    initiatedByUserId: initiatedByUserId ?? announcement.sender?._id ?? announcement.sender ?? null,
  };
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
  getClockedInEmployeeIds,
  isEmployeeClockedIn,
  buildTeaBreakAttendanceContext,
  countTeaBreakOpenUsers,
  classifyTeaBreakOpenUsers,
  computeTeaBreakTiming,
  buildTeaBreakActivePayload,
  TEA_BREAK_DURATION_MS,
  TEA_BREAK_SAFETY_CUTOFF_MS,
};
