/**
 * Find employee matching the screenshot pattern
 * Present = 11, Absent = 2
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AnalyticsService = require('../services/AnalyticsService');

async function findEmployeeWithPattern() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Try different months
        const months = [
            { start: '2026-02-01', end: '2026-02-28', name: 'Feb 2026' },
            { start: '2026-01-01', end: '2026-01-31', name: 'Jan 2026' },
            { start: '2025-12-01', end: '2025-12-31', name: 'Dec 2025' },
            { start: '2025-11-01', end: '2025-11-30', name: 'Nov 2025' },
        ];
        
        for (const month of months) {
            console.log(`\n=== Checking ${month.name} ===`);
            
            const filters = {
                startDate: month.start,
                endDate: month.end,
                page: 1,
                limit: 1000
            };
            
            const result = await AnalyticsService.calculateAttendanceMetrics(filters);
            
            // Find employees with Present ~= 11 and Absent ~= 2
            const matches = result.employeeAnalytics.filter(emp => {
                const presentMatch = emp.presentDays >= 10 && emp.presentDays <= 12;
                const absentMatch = emp.absentDays >= 1.5 && emp.absentDays <= 2.5;
                return presentMatch && absentMatch;
            });
            
            if (matches.length > 0) {
                console.log(`Found ${matches.length} matching employees:`);
                matches.forEach(emp => {
                    console.log({
                        name: emp.employeeName,
                        code: emp.employeeCode,
                        present: emp.presentDays,
                        leave: emp.leaveDays,
                        absent: emp.absentDays,
                        nonWorking: emp.nonWorkingDays,
                        expected: emp.leaveDays + emp.absentDays
                    });
                });
            } else {
                console.log('No matches found');
            }
        }
        
        console.log('\n✅ Search complete');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

findEmployeeWithPattern();
