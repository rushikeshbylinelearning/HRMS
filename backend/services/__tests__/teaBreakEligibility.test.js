/**
 * Tea break eligibility: first check-in must be before allowance end (startedAt + 10 min).
 */
const {
  isEmployeeEligibleForTeaBreakByFirstCheckIn,
  getTeaBreakAllowanceEnd,
  TEA_BREAK_DURATION_MS,
} = require('../teaBreakService');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const breakStart = new Date('2026-07-20T10:00:00+05:30');
const allowanceEnd = getTeaBreakAllowanceEnd(breakStart);

assert(
  allowanceEnd.getTime() === breakStart.getTime() + TEA_BREAK_DURATION_MS,
  'allowance end should be 10 minutes after break start'
);

// Checked in before break — eligible
assert(
  isEmployeeEligibleForTeaBreakByFirstCheckIn(
    new Date('2026-07-20T09:50:00+05:30'),
    breakStart
  ),
  'early check-in should be eligible'
);

// Checked in during break window — eligible
assert(
  isEmployeeEligibleForTeaBreakByFirstCheckIn(
    new Date('2026-07-20T10:05:00+05:30'),
    breakStart
  ),
  'check-in during break window should be eligible'
);

// Checked in exactly at allowance end — not eligible
assert(
  !isEmployeeEligibleForTeaBreakByFirstCheckIn(allowanceEnd, breakStart),
  'check-in at allowance end should not be eligible'
);

// Checked in after allowance — not eligible
assert(
  !isEmployeeEligibleForTeaBreakByFirstCheckIn(
    new Date('2026-07-20T10:12:00+05:30'),
    breakStart
  ),
  'late check-in after break should not be eligible'
);

assert(
  !isEmployeeEligibleForTeaBreakByFirstCheckIn(null, breakStart),
  'missing check-in should not be eligible'
);

console.log('teaBreakEligibility.test.js: all assertions passed');
