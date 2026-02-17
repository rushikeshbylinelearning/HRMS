// Script to verify the present employee count fix
// This will show the actual counts from the database

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User'); // Load User model for populate

function getTodayISTKey() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function verifyPresentCount() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const today = getTodayISTKey();
        console.log(`\nChecking attendance for date: ${today}\n`);

        // Get all attendance logs for today
        const todayLogs = await AttendanceLog.find({ attendanceDate: today })
            .select('user isLate clockInTime')
            .populate('user', 'fullName employeeCode role isActive')
            .lean();

        console.log(`Total attendance logs found: ${todayLogs.length}`);

        // Count present and late employees
        let presentCount = 0;
        let lateCount = 0;
        let onTimeCount = 0;

        const presentEmployees = [];
        const lateEmployees = [];

        todayLogs.forEach(log => {
            if (log?.clockInTime && log.user) {
                presentCount++;
                presentEmployees.push({
                    name: log.user.fullName,
                    code: log.user.employeeCode,
                    isLate: log.isLate || false,
                    role: log.user.role,
                    isActive: log.user.isActive
                });

                if (log.isLate) {
                    lateCount++;
                    lateEmployees.push({
                        name: log.user.fullName,
                        code: log.user.employeeCode
                    });
                } else {
                    onTimeCount++;
                }
            }
        });

        console.log('\n=== SUMMARY ===');
        console.log(`Total Present (All clocked in): ${presentCount}`);
        console.log(`On Time: ${onTimeCount}`);
        console.log(`Late: ${lateCount}`);
        console.log(`\nExpected KPI Card Values:`);
        console.log(`  - Employees Present: ${presentCount}`);
        console.log(`  - Late Comers: ${lateCount}`);

        if (lateCount > 0) {
            console.log('\n=== LATE EMPLOYEES ===');
            lateEmployees.forEach(emp => {
                console.log(`  - ${emp.name} (${emp.code})`);
            });
        }

        console.log('\n=== ALL PRESENT EMPLOYEES ===');
        presentEmployees.forEach(emp => {
            const status = emp.isLate ? '[LATE]' : '[ON TIME]';
            console.log(`  ${status} ${emp.name} (${emp.code})`);
        });

        await mongoose.disconnect();
        console.log('\n✓ Verification complete');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

verifyPresentCount();
