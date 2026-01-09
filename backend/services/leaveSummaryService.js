// backend/services/leaveSummaryService.js

const { computeLeaveSummaryBulk } = require('./leaveSummaryCoreService');

/**
 * Bulk leave summary for multiple employees.
 * Returns Map<employeeId, { fullDayLeaveCount, halfDayLeaveCount }>.
 */
async function getLeaveSummaryForEmployees({ employeeIds, startDate, endDate }) {
  const ids = (employeeIds || []).filter(Boolean).map(id => id.toString());
  if (ids.length === 0) return new Map();

  const computed = await computeLeaveSummaryBulk({ employeeIds: ids, startDate, endDate });
  return computed;
}

module.exports = {
  getLeaveSummaryForEmployees
};
