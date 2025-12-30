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
            
            // Base: 09:50 + 9 hours = 18:50
            // Paid break: 30 min (≤30, no excess) = 0 min
            // Active unpaid break: 15 min (normal case, paidBreakTaken > 0) = 15 min
            // Result: 18:50 + 15 = 19:05
            // Special shift minimum: max(19:05, 19:00) = 19:05
            
            expect(logoutTime).toBe('19:05');
            
            // Restore Date.now
            Date.now = originalNow;
        });
        
        // New policy validation tests
        describe('New Policy Validation Tests', () => {
            it('Scenario: Paid break 20 min (within allowance)', () => {
                const clockInTime = createISTDate(2024, 1, 15, 9, 0);
                const sessions = [{ startTime: clockInTime.toISOString() }];
                const attendanceLog = {
                    paidBreakMinutesTaken: 20,
                    unpaidBreakMinutesTaken: 0,
                    penaltyMinutes: 0
                };
                
                const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
                const logoutTime = extractTime(result);
                
                // Base: 09:00 + 9 hours = 18:00
                // Paid break: 20 min (≤30, no excess) = 0 min
                // Special shift minimum: max(18:00, 19:00) = 19:00
                expect(logoutTime).toBe('19:00');
            });
            
            it('Scenario: Paid break 45 min (excess extends logout)', () => {
                const clockInTime = createISTDate(2024, 1, 15, 9, 0);
                const sessions = [{ startTime: clockInTime.toISOString() }];
                const attendanceLog = {
                    paidBreakMinutesTaken: 45,
                    unpaidBreakMinutesTaken: 0,
                    penaltyMinutes: 0
                };
                
                const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
                const logoutTime = extractTime(result);
                
                // Base: 09:00 + 9 hours = 18:00
                // Paid break: 45 min (>30, excess = 15 min) = 15 min
                // Result: 18:00 + 15 = 18:15
                // Special shift minimum: max(18:15, 19:00) = 19:00
                expect(logoutTime).toBe('19:00');
            });
            
            it('Scenario: Unpaid break 20 min (normal case - extends logout)', () => {
                const clockInTime = createISTDate(2024, 1, 15, 9, 0);
                const sessions = [{ startTime: clockInTime.toISOString() }];
                const attendanceLog = {
                    paidBreakMinutesTaken: 30,
                    unpaidBreakMinutesTaken: 20,
                    penaltyMinutes: 0
                };
                
                const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
                const logoutTime = extractTime(result);
                
                // Base: 09:00 + 9 hours = 18:00
                // Paid break: 30 min (≤30, no excess) = 0 min
                // Unpaid break: 20 min (normal case) = 20 min
                // Result: 18:00 + 20 = 18:20
                // Special shift minimum: max(18:20, 19:00) = 19:00
                expect(logoutTime).toBe('19:00');
            });
            
            it('Scenario: No paid break, unpaid 25 min (rare exception - first 30 min free)', () => {
                const clockInTime = createISTDate(2024, 1, 15, 9, 0);
                const sessions = [{ startTime: clockInTime.toISOString() }];
                const attendanceLog = {
                    paidBreakMinutesTaken: 0,
                    unpaidBreakMinutesTaken: 25,
                    penaltyMinutes: 0
                };
                
                const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
                const logoutTime = extractTime(result);
                
                // Base: 09:00 + 9 hours = 18:00
                // Paid break: 0 min = 0 min
                // Unpaid break: 25 min (rare exception: paidBreakTaken === 0)
                //   Effective unpaid = max(0, 25 - 30) = 0 min
                // Result: 18:00 + 0 = 18:00
                // Special shift minimum: max(18:00, 19:00) = 19:00
                expect(logoutTime).toBe('19:00');
            });
            
            it('Scenario: No paid break, unpaid 50 min (rare exception - excess extends logout)', () => {
                const clockInTime = createISTDate(2024, 1, 15, 9, 0);
                const sessions = [{ startTime: clockInTime.toISOString() }];
                const attendanceLog = {
                    paidBreakMinutesTaken: 0,
                    unpaidBreakMinutesTaken: 50,
                    penaltyMinutes: 0
                };
                
                const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
                const logoutTime = extractTime(result);
                
                // Base: 09:00 + 9 hours = 18:00
                // Paid break: 0 min = 0 min
                // Unpaid break: 50 min (rare exception: paidBreakTaken === 0)
                //   Effective unpaid = max(0, 50 - 30) = 20 min
                // Result: 18:00 + 20 = 18:20
                // Special shift minimum: max(18:20, 19:00) = 19:00
                expect(logoutTime).toBe('19:00');
            });
            
            it('Scenario: Paid 30 + unpaid 15 (normal unpaid rule applies)', () => {
                const clockInTime = createISTDate(2024, 1, 15, 9, 0);
                const sessions = [{ startTime: clockInTime.toISOString() }];
                const attendanceLog = {
                    paidBreakMinutesTaken: 30,
                    unpaidBreakMinutesTaken: 15,
                    penaltyMinutes: 0
                };
                
                const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
                const logoutTime = extractTime(result);
                
                // Base: 09:00 + 9 hours = 18:00
                // Paid break: 30 min (≤30, no excess) = 0 min
                // Unpaid break: 15 min (normal case, paidBreakTaken > 0) = 15 min
                // Result: 18:00 + 15 = 18:15
                // Special shift minimum: max(18:15, 19:00) = 19:00
                expect(logoutTime).toBe('19:00');
            });
            
            it('Scenario: Paid 45 + unpaid 20 (both extend logout)', () => {
                const clockInTime = createISTDate(2024, 1, 15, 10, 0);
                const sessions = [{ startTime: clockInTime.toISOString() }];
                const attendanceLog = {
                    paidBreakMinutesTaken: 45,
                    unpaidBreakMinutesTaken: 20,
                    penaltyMinutes: 0
                };
                
                const result = computeCalculatedLogoutTime(sessions, [], attendanceLog, specialShift, null);
                const logoutTime = extractTime(result);
                
                // Base: 10:00 + 9 hours = 19:00
                // Paid break: 45 min (>30, excess = 15 min) = 15 min
                // Unpaid break: 20 min (normal case) = 20 min
                // Result: 19:00 + 15 + 20 = 19:35
                expect(logoutTime).toBe('19:35');
            });
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




