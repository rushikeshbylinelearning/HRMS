// backend/tests/specialShiftLogoutCalculation.test.js
const { computeCalculatedLogoutTime } = require('../services/dailyStatusService');

/**
 * Helper to create a date in IST timezone
 */
function createISTDate(year, month, day, hours, minutes) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000+05:30`;
    return new Date(dateStr);
}

/**
 * Helper to extract time from ISO string (for comparison)
 */
function extractTime(isoString) {
    if (!isoString) return null;
    const date = new Date(isoString);
    // Convert to IST for comparison
    const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

describe('Special 10 AM - 7 PM Shift: Early Clock-In Logout Calculation', () => {
    
    const specialShift = {
        shiftType: 'Fixed',
        startTime: '10:00',
        endTime: '19:00',
        paidBreakMinutes: 30,
        durationHours: 9
    };
    
    const baseDate = '2024-01-15';
    
    describe('Test Case 1: Login 09:50, PaidBreak 30, UnpaidBreak 0', () => {
        it('should return logout time of 7:00 PM', () => {
            const clockInTime = createISTDate(2024, 1, 15, 9, 50);
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 30,
                unpaidBreakMinutesTaken: 0,
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
            const logoutTime = extractTime(result);
            
            expect(logoutTime).toBe('19:00'); // 7:00 PM
        });
    });
    
    describe('Test Case 2: Login 09:50, PaidBreak 30, UnpaidBreak 10', () => {
        it('should return logout time of 7:00 PM', () => {
            const clockInTime = createISTDate(2024, 1, 15, 9, 50);
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 30,
                unpaidBreakMinutesTaken: 10,
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
            const logoutTime = extractTime(result);
            
            expect(logoutTime).toBe('19:00'); // 7:00 PM
        });
    });
    
    describe('Test Case 3: Login 09:50, PaidBreak 40, UnpaidBreak 10', () => {
        it('should return logout time of 7:10 PM', () => {
            const clockInTime = createISTDate(2024, 1, 15, 9, 50);
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 40,
                unpaidBreakMinutesTaken: 10,
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
            const logoutTime = extractTime(result);
            
            expect(logoutTime).toBe('19:10'); // 7:10 PM
        });
    });
    
    describe('Test Case 4: Login 09:40, PaidBreak 45, UnpaidBreak 0', () => {
        it('should return logout time of 7:00 PM', () => {
            const clockInTime = createISTDate(2024, 1, 15, 9, 40);
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 45,
                unpaidBreakMinutesTaken: 0,
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
            const logoutTime = extractTime(result);
            
            expect(logoutTime).toBe('19:00'); // 7:00 PM
        });
    });
    
    describe('Test Case 5: Login 09:40, PaidBreak 45, UnpaidBreak 20', () => {
        it('should return logout time of 7:15 PM', () => {
            const clockInTime = createISTDate(2024, 1, 15, 9, 40);
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 45,
                unpaidBreakMinutesTaken: 20,
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
            const logoutTime = extractTime(result);
            
            expect(logoutTime).toBe('19:15'); // 7:15 PM
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle clock-in exactly at 10:00 AM (uses standard calculation)', () => {
            const clockInTime = createISTDate(2024, 1, 15, 10, 0);
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 30,
                unpaidBreakMinutesTaken: 0,
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
            const logoutTime = extractTime(result);
            
            // Should use standard 9-hour calculation: 10:00 AM + 9 hours = 7:00 PM
            expect(logoutTime).toBe('19:00');
        });
        
        it('should handle very early clock-in (8:00 AM) with no breaks', () => {
            const clockInTime = createISTDate(2024, 1, 15, 8, 0);
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 0,
                unpaidBreakMinutesTaken: 0,
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
            const logoutTime = extractTime(result);
            
            // EarlyLoginMinutes = 120, TotalExtraBreak = 0, Adjustment = 0
            expect(logoutTime).toBe('19:00');
        });
        
        it('should handle early clock-in with excess breaks exceeding buffer', () => {
            const clockInTime = createISTDate(2024, 1, 15, 9, 50); // 10 min early
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 50, // 20 min excess
                unpaidBreakMinutesTaken: 20, // 20 min unpaid
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
            const logoutTime = extractTime(result);
            
            // EarlyLoginMinutes = 10
            // ExtraPaidBreak = 20, UnpaidBreak = 20, TotalExtraBreak = 40
            // Adjustment = max(40 - 10, 0) = 30
            // Logout = 7:00 PM + 30 = 7:30 PM
            expect(logoutTime).toBe('19:30');
        });
        
        it('should handle active unpaid break', () => {
            const clockInTime = createISTDate(2024, 1, 15, 9, 50);
            const activeBreakStart = createISTDate(2024, 1, 15, 14, 0);
            const now = createISTDate(2024, 1, 15, 14, 15); // 15 minutes into break
            
            // Mock current time
            const originalNow = Date.now;
            Date.now = jest.fn(() => now.getTime());
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 30,
                unpaidBreakMinutesTaken: 0,
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const activeBreak = {
                breakType: 'Unpaid',
                startTime: activeBreakStart.toISOString()
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, activeBreak);
            const logoutTime = extractTime(result);
            
            // EarlyLoginMinutes = 10
            // ActiveUnpaidBreak = 15 minutes
            // TotalExtraBreak = 0 + 15 = 15
            // Adjustment = max(15 - 10, 0) = 5
            // Logout = 7:00 PM + 5 = 7:05 PM
            
            expect(logoutTime).toBe('19:05');
            
            // Restore Date.now
            Date.now = originalNow;
        });
    });
    
    describe('Non-Special Shift Regression Tests', () => {
        it('should not affect other fixed shifts', () => {
            const otherShift = {
                shiftType: 'Fixed',
                startTime: '09:00',
                endTime: '18:00',
                paidBreakMinutes: 30,
                durationHours: 9
            };
            
            const clockInTime = createISTDate(2024, 1, 15, 8, 50);
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 30,
                unpaidBreakMinutesTaken: 0,
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, otherShift, null);
            const logoutTime = extractTime(result);
            
            // Should use standard calculation: 8:50 AM + 9 hours = 5:50 PM
            expect(logoutTime).toBe('17:50');
        });
        
        it('should not affect flexible shifts', () => {
            const flexibleShift = {
                shiftType: 'Flexible',
                durationHours: 9,
                paidBreakMinutes: 30
            };
            
            const clockInTime = createISTDate(2024, 1, 15, 9, 50);
            
            const sessions = [{ startTime: clockInTime.toISOString() }];
            const attendanceLog = {
                paidBreakMinutesTaken: 30,
                unpaidBreakMinutesTaken: 0,
                penaltyMinutes: 0,
                isLate: false,
                lateMinutes: 0,
                attendanceStatus: 'On-time',
                isHalfDay: false
            };
            
            const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, flexibleShift, null);
            const logoutTime = extractTime(result);
            
            // Should use standard calculation: 9:50 AM + 9 hours = 6:50 PM
            expect(logoutTime).toBe('18:50');
        });
    });
});




