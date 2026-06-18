const { isHalfDayLeaveType, HALF_DAY_LEAVE_TYPES } = require('../halfDayLeave');

describe('halfDayLeave utils', () => {
    test('recognizes half-day leave types', () => {
        expect(isHalfDayLeaveType('Half Day - First Half')).toBe(true);
        expect(isHalfDayLeaveType('Half Day - Second Half')).toBe(true);
    });

    test('rejects full-day and unknown types', () => {
        expect(isHalfDayLeaveType('Full Day')).toBe(false);
        expect(isHalfDayLeaveType('')).toBe(false);
        expect(isHalfDayLeaveType(null)).toBe(false);
        expect(isHalfDayLeaveType(undefined)).toBe(false);
    });

    test('exports constant list', () => {
        expect(HALF_DAY_LEAVE_TYPES).toEqual([
            'Half Day - First Half',
            'Half Day - Second Half',
        ]);
    });
});
