const AnnouncementMessage = require('../models/AnnouncementMessage');
const { getISTNow } = require('../utils/istTime');
const {
  applyTeaBreakOverrun,
  getClockedInEmployeeIds,
  TEA_BREAK_DURATION_MS,
  TEA_BREAK_SAFETY_CUTOFF_MS,
} = require('../services/teaBreakService');
const { hasTeaBreakEnded, clearTeaBreakState } = require('../services/teaBreakState');

const RECURRING_INTERVAL_MS = 60 * 1000;

const activeJobs = new Map();

async function runEnforcementPass(announcementId, teaBreakStartedAt) {
  const employeeIds = await getClockedInEmployeeIds();
  let pendingCount = 0;

  for (const employeeId of employeeIds) {
    if (hasTeaBreakEnded(announcementId, employeeId)) continue;
    pendingCount += 1;
    try {
      await applyTeaBreakOverrun(employeeId, teaBreakStartedAt, announcementId);
    } catch (err) {
      console.error(`[TeaBreak] Enforcement error for ${employeeId}:`, err.message);
    }
  }

  return { pendingCount, totalClockedIn: employeeIds.length };
}

function stopEnforcement(announcementId) {
  const key = String(announcementId);
  const job = activeJobs.get(key);
  if (!job) return;
  if (job.timeoutId) clearTimeout(job.timeoutId);
  if (job.intervalId) clearInterval(job.intervalId);
  activeJobs.delete(key);
  clearTeaBreakState(announcementId);
  console.log(`[TeaBreak] Stopped enforcement for announcement ${announcementId}`);
}

/**
 * Schedule tea break overrun enforcement for a given announcement.
 */
function scheduleTeaBreakEnforcement(announcementId, teaBreakStartedAt) {
  const key = String(announcementId);
  if (activeJobs.has(key)) {
    stopEnforcement(announcementId);
  }

  const started = new Date(teaBreakStartedAt);
  const firstRunAt = new Date(started.getTime() + TEA_BREAK_DURATION_MS + 1000);
  const cutoffAt = new Date(started.getTime() + TEA_BREAK_SAFETY_CUTOFF_MS);
  const now = getISTNow();

  const runPass = async () => {
    if (getISTNow() >= cutoffAt) {
      stopEnforcement(announcementId);
      return;
    }
    const { pendingCount } = await runEnforcementPass(announcementId, teaBreakStartedAt);
    if (pendingCount === 0) {
      stopEnforcement(announcementId);
    }
  };

  const delay = Math.max(0, firstRunAt - now);
  const timeoutId = setTimeout(() => {
    runPass().catch((err) => console.error('[TeaBreak] First enforcement pass failed:', err));
    const intervalId = setInterval(() => {
      if (getISTNow() >= cutoffAt) {
        stopEnforcement(announcementId);
        return;
      }
      runPass().catch((err) => console.error('[TeaBreak] Recurring enforcement failed:', err));
    }, RECURRING_INTERVAL_MS);
    activeJobs.set(key, { timeoutId: null, intervalId, teaBreakStartedAt });
  }, delay);

  activeJobs.set(key, { timeoutId, intervalId: null, teaBreakStartedAt });
  console.log(`[TeaBreak] Scheduled enforcement for ${announcementId} in ${Math.round(delay / 1000)}s`);
}

/**
 * Re-schedule enforcement after server restart if an active tea break exists.
 */
async function restoreActiveTeaBreakJobs() {
  try {
    const cutoff = new Date(getISTNow().getTime() - TEA_BREAK_SAFETY_CUTOFF_MS);
    const active = await AnnouncementMessage.find({
      isTEABreak: true,
      teaBreakStartedAt: { $gte: cutoff },
      teaBreakStoppedAt: null,
    })
      .sort({ teaBreakStartedAt: -1 })
      .limit(5)
      .lean();

    for (const ann of active) {
      if (!ann.teaBreakStartedAt) continue;
      const endsAt = new Date(new Date(ann.teaBreakStartedAt).getTime() + TEA_BREAK_SAFETY_CUTOFF_MS);
      if (getISTNow() < endsAt) {
        scheduleTeaBreakEnforcement(ann._id, ann.teaBreakStartedAt);
      }
    }
  } catch (err) {
    console.error('[TeaBreak] Failed to restore jobs:', err.message);
  }
}

module.exports = {
  scheduleTeaBreakEnforcement,
  stopEnforcement,
  restoreActiveTeaBreakJobs,
};
