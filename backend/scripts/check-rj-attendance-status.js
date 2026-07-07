// Check RJ's attendance status field in February

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function checkRJAttendanceStatus() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        // Find RJ
        const rj = await User.findOne({
            $or: [
                { fullName: /RJ/i },
                { employeeCode: /BYL202505-E71/i },
                { employeeCode: '#BYL202505-E71' }
            ]
        }).lean();
        
        if (!rj) {
            console.log('❌ Employee RJ not found\n');
            return;
        }
        
        console.log(`Found: ${rj.fullName} (${rj.employeeCode})\n`);
        
        // Get February attendance
        const febLogs = await AttendanceLog.find({
            user: rj._id,
            attendanceDate: { $gte: '2026-02-01', $lte: '2026-02-28' }
        }).sort({ attendanceDate: 1 }).lean();
        
        console.log(`Total records in February: ${febLogs.length}\n`);
        
        console.log('Attendance Records:\n');
        console.log('┌────────────┬───────────┬──────────┬──────────┬──────────┬──────────┐');
        console.log('│    Date    │   Hours   │  Status  │ Half-Day │  Is Late │ Reason   │');
        console.log('├────────────┼───────────┼──────────┼──────────┼──────────┼──────────┤');
        
        let totalHours = 0;
        let presentCount = 0;
        let halfDayCount = 0;
        
        febLogs.forEach(log => {
            const date = log.attendanceDate;
            const hours = log.totalWorkingHours.toFixed(2).padStart(9);
            const status = (log.attendanceStatus || 'N/A').padEnd(8);
            const isHalfDay = log.isHalfDay ? 'Yes' : 'No';
            const isLate = log.isLate ? 'Yes' : 'No';
            const reason = (log.halfDayReasonCode || '').substring(0, 8);
            
            console.log(`│ ${date} │ ${hours} │ ${status} │ ${isHalfDay.padEnd(8)} │ ${isLate.padEnd(8)} │ ${reason.padEnd(8)} │`);
            
            totalHours += log.totalWorkingHours;
            if (['On-time', 'Late', 'Half-day'].includes(log.attendanceStatus)) {
                presentCount++;
            }
            if (log.isHalfDay) {
                halfDayCount++;
            }
        });
        
        console.log('└────────────┴───────────┴──────────┴──────────┴──────────┴──────────┘\n');
        
        console.log('Summary:');
        console.log(`  Total Records: ${febLogs.length}`);
        console.log(`  Present Days (by status): ${presentCount}`);
        console.log(`  Half-Day Flag Count: ${halfDayCount}`);
        console.log(`  Total Hours: ${totalHours.toFixed(2)}\n`);
        
        // Check for status mismatches
        console.log('Status Mismatches:\n');
        
        const mismatches = febLogs.filter(log => {
            // If isHalfDay is false but status is "Half-day"
            return (!log.isHalfDay && log.attendanceStatus === 'Half-day') ||
                   (log.isHalfDay && log.attendanceStatus !== 'Half-day');
        });
        
        if (mismatches.length > 0) {
            console.log(`Found ${mismatches.length} mismatches:\n`);
            mismatches.forEach(log => {
                console.log(`  ${log.attendanceDate}:`);
                console.log(`    isHalfDay: ${log.isHalfDay}`);
                console.log(`    attendanceStatus: ${log.attendanceStatus}`);
                console.log(`    hours: ${log.totalWorkingHours.toFixed(2)}\n`);
            });
        } else {
            console.log('✅ No mismatches found between isHalfDay flag and attendanceStatus\n');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

checkRJAttendanceStatus();
