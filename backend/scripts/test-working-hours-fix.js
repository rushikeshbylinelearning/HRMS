/**
 * TEST: Working Hours Fix
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const AttendanceSummaryService = require('../services/AttendanceSummaryService');

async function testWorkingHoursFix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const startDate = '2026-02-01';
        const endDate = '2026-02-28';
        
        // Get one employee
        const employee = await User.findOne({ fullName: /Harish/i }).lean();
        console.log(`Testing: ${employee.fullName} (${employee.employeeCode})\n`);
        
        // Get attendance logs
        const logs = await AttendanceLog.find({
            user: employee._id,
            attendanceDate: { $gte: startDate, $lte: endDate }
        }).select('attendanceDate totalWorkingHours attendanceStatus').lean();
        
        console.log(`Found ${logs.length} attendance logs\n`);
        
        // Create map
        const logsMap = new Map();
        logs.forEach(log => {
            logsMap.set(log.attendanceDate, log);
            console.log(`Map entry: ${log.attendanceDate} -> ${log.totalWorkingHours} hours (${log.attendanceStatus})`);
        });
        
        console.log(`\nMap size: ${logsMap.size}\n`);
        
        // Get summary data
        const summaryData = await AttendanceSummaryService.getEmployeeAttendanceSummary(
            employee._id,
            startDate,
            endDate
        );
        
        console.log(`Summary data: ${summaryData.length} days\n`);
        
        // Test lookup
        console.log('Testing lookups:');
        summaryData.slice(0, 5).forEach(day => {
            const log = logsMap.get(day.date);
            console.log(`  ${day.date} (${day.finalStatus}): ${log ? log.totalWorkingHours + ' hours' : 'NO LOG'}`);
        });
        
        // Calculate total
        let totalHours = 0;
        let presentCount = 0;
        summaryData.forEach(day => {
            if (day.finalStatus === 'On-time' || day.finalStatus === 'Late' || day.finalStatus === 'Half-day') {
                presentCount++;
                const log = logsMap.get(day.date);
                if (log) {
                    totalHours += log.totalWorkingHours || 0;
                }
            }
        });
        
        console.log(`\nResults:`);
        console.log(`  Present Days: ${presentCount}`);
        console.log(`  Total Hours: ${totalHours.toFixed(2)}`);
        console.log(`  Avg Hours: ${presentCount > 0 ? (totalHours / presentCount).toFixed(2) : 0}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

testWorkingHoursFix();
