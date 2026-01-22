// backend/services/leaveSummaryCoreService.js

const mongoose = require('mongoose');
const LeaveRequest = require('../models/LeaveRequest');
const { parseISTDate, getISTDateString } = require('../utils/istTime');

function normalizeEmployeeId(employeeId) {
  return employeeId ? employeeId.toString() : null;
}

function isHalfDayLeaveType(leaveType) {
  return (
    leaveType === 'Half Day - First Half' ||
    leaveType === 'Half Day - Second Half' ||
    (typeof leaveType === 'string' && (leaveType.includes('Half Day') || leaveType.includes('Half-day')))
  );
}

/**
 * Internal: Fetch approved leaves for employees in range and index by date.
 * Returns Map<employeeId, Map<YYYY-MM-DD, LeaveRequest>>.
 */
async function getApprovedLeaveMapBulk({ employeeIds, startDate, endDate }) {
  const ids = (employeeIds || []).filter(Boolean).map(id => id.toString());
  const results = new Map();
  ids.forEach(id => results.set(id, new Map()));
  if (ids.length === 0) return results;

  const start = parseISTDate(startDate);
  const end = parseISTDate(endDate + 'T23:59:59+05:30');

  const leaveRequests = await LeaveRequest.find({
    employee: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) },
    status: 'Approved',
    leaveDates: {
      $elemMatch: {
        $gte: start,
        $lte: end
      }
    },
    requestType: { $ne: 'YEAR_END' }
  }).sort({ createdAt: 1 }).lean();

  leaveRequests.forEach(lr => {
    const empId = normalizeEmployeeId(lr.employee);
    if (!empId || !results.has(empId)) return;

    if (Array.isArray(lr.leaveDates)) {
      lr.leaveDates.forEach(d => {
        const dateStr = getISTDateString(d);
        if (dateStr >= startDate && dateStr <= endDate) {
          const map = results.get(empId);
          if (!map.has(dateStr)) {
            map.set(dateStr, lr);
          }
        }
      });
    }
  });

  return results;
}

async function computeLeaveSummary({ employeeId, startDate, endDate }) {
  const id = normalizeEmployeeId(employeeId);
  const bulk = await computeLeaveSummaryBulk({ employeeIds: [id], startDate, endDate });
  return bulk.get(id) || { fullDayLeaveCount: 0, halfDayLeaveCount: 0 };
}

async function computeLeaveSummaryBulk({ employeeIds, startDate, endDate }) {
  const ids = (employeeIds || []).filter(Boolean).map(id => id.toString());
  const result = new Map();
  ids.forEach(id => result.set(id, { fullDayLeaveCount: 0, halfDayLeaveCount: 0 }));
  if (ids.length === 0) return result;

  const leaveByUserId = await getApprovedLeaveMapBulk({ employeeIds: ids, startDate, endDate });

  ids.forEach(id => {
    const leaveMap = leaveByUserId.get(id) || new Map();
    const counts = result.get(id);

    for (const [, leaveRequest] of leaveMap.entries()) {
      if (!leaveRequest || leaveRequest.status !== 'Approved') continue;

      if (leaveRequest.leaveType === 'Full Day') {
        counts.fullDayLeaveCount += 1;
      } else if (isHalfDayLeaveType(leaveRequest.leaveType)) {
        counts.halfDayLeaveCount += 1;
      }
    }
  });

  return result;
}

async function countLeaveRequestsInRangeAllStatuses({ employeeId, startDate, endDate }) {
  const id = normalizeEmployeeId(employeeId);
  if (!id) return 0;

  const start = parseISTDate(startDate);
  const end = parseISTDate(endDate + 'T23:59:59+05:30');

  return LeaveRequest.countDocuments({
    employee: new mongoose.Types.ObjectId(id),
    requestType: { $ne: 'YEAR_END' },
    leaveDates: { $elemMatch: { $gte: start, $lte: end } }
  });
}

async function countLeaveRequestsAllTime({ employeeId }) {
  const id = normalizeEmployeeId(employeeId);
  if (!id) return 0;

  return LeaveRequest.countDocuments({
    employee: new mongoose.Types.ObjectId(id),
    requestType: { $ne: 'YEAR_END' }
  });
}

async function getOldestLeaveDateStr({ employeeId }) {
  const id = normalizeEmployeeId(employeeId);
  if (!id) return null;

  // Find the oldest leave date by unwinding leaveDates.
  const rows = await LeaveRequest.aggregate([
    {
      $match: {
        employee: new mongoose.Types.ObjectId(id),
        requestType: { $ne: 'YEAR_END' },
        leaveDates: { $exists: true, $ne: [] }
      }
    },
    { $unwind: '$leaveDates' },
    { $sort: { leaveDates: 1 } },
    { $limit: 1 },
    { $project: { _id: 0, leaveDates: 1 } }
  ]);

  const oldest = rows?.[0]?.leaveDates;
  return oldest ? getISTDateString(oldest) : null;
}

async function countApprovedLeavesOnDate({ date }) {
  const dateStr = typeof date === 'string' ? date : getISTDateString(date);
  if (!dateStr) return 0;

  const start = parseISTDate(dateStr);
  const end = parseISTDate(dateStr);
  end.setDate(end.getDate() + 1);

  return LeaveRequest.countDocuments({
    status: 'Approved',
    requestType: { $ne: 'YEAR_END' },
    leaveDates: {
      $elemMatch: {
        $gte: start,
        $lt: end
      }
    }
  });
}

module.exports = {
  computeLeaveSummary,
  computeLeaveSummaryBulk,
  // Used by attendance summary core for leave precedence with resolver
  getApprovedLeaveMapBulk,
  // Non-summary helpers used by existing endpoints to avoid direct LeaveRequest reads in routes
  countLeaveRequestsInRangeAllStatuses,
  countLeaveRequestsAllTime,
  getOldestLeaveDateStr,
  countApprovedLeavesOnDate
};
