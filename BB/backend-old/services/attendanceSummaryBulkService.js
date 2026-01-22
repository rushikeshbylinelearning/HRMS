// backend/services/attendanceSummaryBulkService.js

const { computeAttendanceSummaryBulk } = require('./attendanceSummaryCoreService');

/**
 * Bulk attendance summary for multiple employees.
 * This is a service-layer reuse of the same resolver/date-series approach used by GET /api/attendance/summary.
 *
 * Returns per employee:
 * - fullDayAbsentCount
 * - halfDayAbsentCount
 */
async function getAttendanceSummaryForEmployees({ employeeIds, startDate, endDate, startDateByEmployeeId = null }) {
  const ids = (employeeIds || []).filter(Boolean).map(id => id.toString());
  if (ids.length === 0) return new Map();

  const computed = await computeAttendanceSummaryBulk({
    employeeIds: ids,
    startDate,
    endDate,
    includeHolidays: false,
    startDateByEmployeeId
  });

  const result = new Map();
  ids.forEach(id => {
    const summary = computed.get(id);
    result.set(id, {
      fullDayAbsentCount: summary?.fullDayAbsentCount || 0,
      halfDayAbsentCount: summary?.halfDayAbsentCount || 0
    });
  });

  return result;
}

module.exports = {
  getAttendanceSummaryForEmployees
};
