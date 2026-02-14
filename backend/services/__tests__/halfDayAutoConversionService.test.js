/**
 * Unit tests for Half-Day Leave → Full-Day LOP auto-conversion.
 *
 * Scenarios (per spec):
 * 1. Half-day leave + no check-in → Converts (eligible)
 * 2. Half-day leave + 5 min check-in → Does NOT convert
 * 3. Holiday + half-day → Does NOT convert
 * 4. Admin manually changed attendance → Does NOT convert
 * 5. Already LOP → Does NOT convert
 * 6. Cron runs twice → No duplicate conversion (idempotency)
 */

const mongoose = require('mongoose');

// Mock SystemAuditLog so we don't touch DB in unit tests
jest.mock('../../models/SystemAuditLog', () => ({
    create: jest.fn().mockResolvedValue({}),
}));

// Mock Holiday for isHoliday() - service calls findOne(...).lean(), so chain must return a thenable
jest.mock('../../models/Holiday', () => ({
    findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
    }),
}));

const Holiday = require('../../models/Holiday');
const {
    validateConversionEligibility,
    isWeekend,
} = require('../halfDayAutoConversionService');

describe('halfDayAutoConversionService', () => {
    const baseLeave = {
        status: 'Approved',
        leaveType: 'Half Day - First Half',
        requestType: 'Planned',
        autoConvertedToLOP: false,
    };
    const baseAttendance = {
        clockInTime: null,
        overriddenByAdmin: false,
    };
    const baseEmployee = { weeklyOff: [] }; // weekday worker

    beforeEach(() => {
        jest.clearAllMocks();
        Holiday.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
        });
    });

    describe('validateConversionEligibility', () => {
        test('Scenario 1: Half-day leave + no check-in → Eligible for conversion', async () => {
            const result = await validateConversionEligibility(
                baseLeave,
                baseAttendance,
                baseEmployee,
                '2026-02-10'
            );
            expect(result.valid).toBe(true);
            expect(result.reason).toBe('Eligible for conversion');
        });

        test('Scenario 2: Half-day leave + clock-in present → Does NOT convert', async () => {
            const attendanceWithCheckIn = {
                ...baseAttendance,
                clockInTime: new Date('2026-02-10T09:05:00.000Z'),
            };
            const result = await validateConversionEligibility(
                baseLeave,
                attendanceWithCheckIn,
                baseEmployee,
                '2026-02-10'
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Employee has clock-in record');
        });

        test('Scenario 3: Holiday + half-day → Does NOT convert', async () => {
            Holiday.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({ name: 'Test Holiday' }),
            });
            const result = await validateConversionEligibility(
                baseLeave,
                baseAttendance,
                baseEmployee,
                '2026-02-10'
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Date is a holiday');
        });

        test('Scenario 4: Admin override on attendance → Does NOT convert', async () => {
            const overriddenAttendance = {
                ...baseAttendance,
                overriddenByAdmin: true,
            };
            const result = await validateConversionEligibility(
                baseLeave,
                overriddenAttendance,
                baseEmployee,
                '2026-02-10'
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Admin override exists');
        });

        test('Scenario 5: Already LOP → Does NOT convert', async () => {
            const lopLeave = { ...baseLeave, requestType: 'Loss of Pay' };
            const result = await validateConversionEligibility(
                lopLeave,
                baseAttendance,
                baseEmployee,
                '2026-02-10'
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Already marked as LOP');
        });

        test('Scenario 6: Already auto-converted (idempotency) → Does NOT convert', async () => {
            const alreadyConverted = { ...baseLeave, autoConvertedToLOP: true };
            const result = await validateConversionEligibility(
                alreadyConverted,
                baseAttendance,
                baseEmployee,
                '2026-02-10'
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Already auto-converted');
        });

        test('Rejected leave → Does NOT convert', async () => {
            const result = await validateConversionEligibility(
                { ...baseLeave, status: 'Rejected' },
                baseAttendance,
                baseEmployee,
                '2026-02-10'
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Leave not approved');
        });

        test('Full-day leave → Does NOT convert', async () => {
            const result = await validateConversionEligibility(
                { ...baseLeave, leaveType: 'Full Day' },
                baseAttendance,
                baseEmployee,
                '2026-02-10'
            );
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Not a half-day leave');
        });

        test('No attendance record → Treated as no check-in, eligible for conversion', async () => {
            // When no log exists (e.g. legacy leave or log never created), we allow conversion;
            // syncAttendanceOnLeaveApproval will create the log when we update the leave.
            const result = await validateConversionEligibility(
                baseLeave,
                null,
                baseEmployee,
                '2026-02-10'
            );
            expect(result.valid).toBe(true);
            expect(result.reason).toBe('Eligible for conversion');
        });
    });

    describe('isWeekend', () => {
        test('Saturday is weekend when weeklyOff not set', () => {
            // 2026-02-14 is Saturday
            expect(isWeekend('2026-02-14', {})).toBe(true);
        });
        test('Sunday is weekend when weeklyOff not set', () => {
            expect(isWeekend('2026-02-15', {})).toBe(true);
        });
        test('Monday is not weekend when weeklyOff not set', () => {
            expect(isWeekend('2026-02-16', {})).toBe(false);
        });
        test('Respects employee weeklyOff (e.g. Friday)', () => {
            const employee = { weeklyOff: ['Friday'] };
            // 2026-02-13 is Friday
            expect(isWeekend('2026-02-13', employee)).toBe(true);
        });
    });
});
