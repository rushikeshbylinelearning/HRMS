const AnnouncementMessage = require('../models/AnnouncementMessage');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const { getISTDateString, getISTNow } = require('../utils/istTime');
const { markTeaBreakEnded } = require('./teaBreakState');
const { stopEnforcement } = require('../jobs/teaBreakEnforcer');

const SAFETY_CUTOFF_MS = 30 * 60 * 1000;

async function getClockedInEmployeeIds() {
  const today = getISTDateString();
  const logs = await AttendanceLog.find({
    attendanceDate: today,
    clockInTime: { $ne: null },
    clockOutTime: null,
  })
    .select('user')
    .lean();

  const ids = [];
  for (const log of logs) {
    const activeSession = await AttendanceSession.findOne({
      attendanceLog: log._id,
      endTime: null,
    }).lean();
    if (activeSession) {
      ids.push(String(log.user));
    }
  }
  return ids;
}

/**
 * Stop a tea break announcement for all employees (Admin/HR).
 * Does not apply further overrun penalties after stop.
 */
async function stopTeaBreakAnnouncement(announcementId) {
  const announcement = await AnnouncementMessage.findById(announcementId);
  if (!announcement?.isTEABreak || !announcement.teaBreakStartedAt) {
    return { success: false, message: 'Tea break announcement not found' };
  }
  if (announcement.teaBreakStoppedAt) {
    return { success: true, alreadyStopped: true, announcementId };
  }

  announcement.teaBreakStoppedAt = getISTNow();
  await announcement.save();

  stopEnforcement(announcementId);

  const employeeIds = await getClockedInEmployeeIds();
  for (const employeeId of employeeIds) {
    markTeaBreakEnded(announcementId, employeeId);
  }

  try {
    const { getIO } = require('../socketManager');
    const io = getIO();
    io.to('announcements').emit('tea_break_stopped', {
      announcementId: String(announcementId),
      stoppedAt: announcement.teaBreakStoppedAt,
    });
  } catch (err) {
    console.error('[TeaBreak] tea_break_stopped emit failed:', err.message);
  }

  return {
    success: true,
    announcementId: String(announcementId),
    employeesNotified: employeeIds.length,
  };
}

/**
 * Stop all active (non-stopped) tea breaks within the safety window.
 */
async function stopAllActiveTeaBreaks() {
  const now = getISTNow();
  const cutoff = new Date(now.getTime() - SAFETY_CUTOFF_MS);

  const activeAnnouncements = await AnnouncementMessage.find({
    isTEABreak: true,
    teaBreakStartedAt: { $gte: cutoff },
    teaBreakStoppedAt: null,
  }).lean();

  const results = [];
  for (const ann of activeAnnouncements) {
    const result = await stopTeaBreakAnnouncement(ann._id);
    results.push(result);
  }

  return {
    success: true,
    stoppedCount: results.filter((r) => r.success).length,
    results,
  };
}

module.exports = {
  stopTeaBreakAnnouncement,
  stopAllActiveTeaBreaks,
};
