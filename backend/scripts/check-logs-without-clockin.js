// Script to check attendance logs without clockInTime

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

function getTodayISTKey() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function checkLogsWithoutClockIn() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const today = getTodayISTKey();
        console.log(`\nChecking attendance logs for date: ${today}\n`);

        // Get all attendance logs for today
        const allLogs = await AttendanceLog.find({ attendanceDate: today })
            .populate('user', 'fullName employeeCode role isActive')
            .lean();

        console.log(`Total Attendance Logs: ${allLogs.length}`);

        // Separate logs with and without clockInTime
        const withClockIn = allLogs.filter(log => log.clockInTime);
        const withoutClockIn = allLogs.filter(log => !log.clockInTime);

        console.log(`Logs WITH clockInTime: ${withClockIn.length}`);
        console.log(`Logs WITHOUT clockInTime: ${withoutClockIn.length}`);

        if (withoutClockIn.length > 0) {
            console.log(`\n=== LOGS WITHOUT CLOCK-IN TIME ===`);
            withoutClockIn.forEach(log => {
                console.log(`\nEmployee: ${log.user?.fullName || 'Unknown'} (${log.user?.employeeCode || 'N/A'})`);
                console.log(`  Role: ${log.user?.role || 'N/A'}`);
                console.log(`  Active: ${log.user?.isActive}`);
                console.log(`  Log ID: ${log._id}`);
                console.log(`  Clock In Time: ${log.clockInTime || 'NULL'}`);
                console.log(`  Clock Out Time: ${log.clockOutTime || 'NULL'}`);
                console.log(`  Is Late: ${log.isLate}`);
                console.log(`  Is Half Day: ${log.isHalfDay}`);
                console.log(`  Status: ${log.status || 'N/A'}`);
            });
        }

        await mongoose.disconnect();
        console.log('\n✓ Check complete');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkLogsWithoutClockIn();
