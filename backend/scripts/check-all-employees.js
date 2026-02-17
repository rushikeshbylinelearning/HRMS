// Script to check all active employees vs attendance logs

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');

function getTodayISTKey() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function checkAllEmployees() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const today = getTodayISTKey();
        console.log(`\nChecking for date: ${today}\n`);

        // Get all active employees (excluding Admin)
        const allEmployees = await User.find({
            role: { $ne: 'Admin' },
            isActive: true
        }).select('fullName employeeCode role').lean();

        console.log(`Total Active Employees (excluding Admin): ${allEmployees.length}`);

        // Get all attendance logs for today
        const todayLogs = await AttendanceLog.find({ attendanceDate: today })
            .select('user clockInTime isLate')
            .populate('user', 'fullName employeeCode')
            .lean();

        console.log(`Total Attendance Logs Today: ${todayLogs.length}`);

        // Find employees who clocked in
        const clockedInUserIds = new Set();
        todayLogs.forEach(log => {
            if (log?.clockInTime && log.user) {
                clockedInUserIds.add(log.user._id.toString());
            }
        });

        console.log(`Employees Who Clocked In: ${clockedInUserIds.size}`);

        // Find employees who haven't clocked in
        const notClockedIn = allEmployees.filter(emp => 
            !clockedInUserIds.has(emp._id.toString())
        );

        if (notClockedIn.length > 0) {
            console.log(`\n=== EMPLOYEES NOT CLOCKED IN (${notClockedIn.length}) ===`);
            notClockedIn.forEach(emp => {
                console.log(`  - ${emp.fullName} (${emp.employeeCode}) - Role: ${emp.role}`);
            });
        }

        // Count by status
        let presentCount = 0;
        let lateCount = 0;

        todayLogs.forEach(log => {
            if (log?.clockInTime) {
                presentCount++;
                if (log.isLate) {
                    lateCount++;
                }
            }
        });

        console.log(`\n=== SUMMARY ===`);
        console.log(`Total Active Employees: ${allEmployees.length}`);
        console.log(`Clocked In (Present): ${presentCount}`);
        console.log(`  - On Time: ${presentCount - lateCount}`);
        console.log(`  - Late: ${lateCount}`);
        console.log(`Not Clocked In: ${notClockedIn.length}`);

        await mongoose.disconnect();
        console.log('\n✓ Check complete');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAllEmployees();
