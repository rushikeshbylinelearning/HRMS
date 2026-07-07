require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const LeaveRequest = require('../models/LeaveRequest');
const Holiday = require('../models/Holiday');
const { getISTDateString, parseISTDate } = require('../utils/istTime');

async function checkShivamManishAbsent() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find Shivam and Manish
        const employees = await User.find({
            $or: [
                { fullName: /Shivam/i },
                { fullName: /Manish/i }
            ],
            isActive: true
        }).select('_id fullName employeeCode alternateSaturdayPolicy').lean();

        if (employees.length === 0) {
            console.log('❌ No employees found with names Shivam or Manish');
            process.exit(0);
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('EMPLOYEES FOUND');
        console.log('═══════════════════════════════════════════════════════════\n');

        employees.forEach(emp => {
            console.log(`Name: ${emp.fullName}`);
            console.log(`Code: ${emp.employeeCode}`);
            console.log(`ID: ${emp._id}`);
            console.log(`Saturday Policy: ${emp.alternateSaturdayPolicy || 'All Saturdays Working'}`);
            console.log('');
        });

        // Check recent attendance (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const startDateStr = getISTDateString(thirtyDaysAgo);
        const endDateStr = getISTDateString(today);

        console.log('═══════════════════════════════════════════════════════════');
        console.log(`ATTENDANCE RECORDS (${startDateStr} to ${endDateStr})`);
        console.log('═══════════════════════════════════════════════════════════\n');

        for (const employee of employees) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`EMPLOYEE: ${employee.fullName} (${employee.employeeCode})`);
            console.log('='.repeat(60));

            // Get attendance logs
            const logs = await AttendanceLog.find({
                user: employee._id,
                attendanceDate: { $gte: startDateStr, $lte: endDateStr }
            }).sort({ attendanceDate: -1 }).lean();

            console.log(`\nTotal Records: ${logs.length}\n`);

            // Count by status
            const statusCounts = {};
            const absentDates = [];
            const presentDates = [];

            for (const log of logs) {
                const status = log.attendanceStatus || 'Unknown';
                statusCounts[status] = (statusCounts[status] || 0) + 1;

                if (status === 'Absent') {
                    absentDates.push(log.attendanceDate);
                } else if (status === 'On-time' || status === 'Late' || status === 'Present') {
                    presentDates.push(log.attendanceDate);
                }
            }

            console.log('Status Summary:');
            Object.entries(statusCounts).forEach(([status, count]) => {
                console.log(`  ${status}: ${count}`);
            });

            // Check for absent records
            if (absentDates.length > 0) {
                console.log(`\n⚠️  ABSENT DATES (${absentDates.length}):`);
                
                for (const date of absentDates.slice(0, 10)) { // Show first 10
                    const log = logs.find(l => l.attendanceDate === date);
                    
                    // Check if there are sessions
                    const sessions = await AttendanceSession.find({
                        attendanceLog: log._id
                    }).lean();

                    // Check if there's an approved leave
                    const leave = await LeaveRequest.findOne({
                        employee: employee._id,
                        status: 'Approved',
                        leaveDates: {
                            $elemMatch: {
                                $gte: parseISTDate(date),
                                $lte: parseISTDate(date + 'T23:59:59+05:30')
                            }
                        }
                    }).lean();

                    // Check if it's a holiday
                    const holiday = await Holiday.findOne({
                        date: {
                            $gte: parseISTDate(date),
                            $lte: parseISTDate(date + 'T23:59:59+05:30')
                        },
                        isTentative: { $ne: true }
                    }).lean();

                    // Check day of week
                    const dateObj = parseISTDate(date);
                    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
                    const isSunday = dayOfWeek === 'Sunday';
                    
                    // Check if it's an off Saturday
                    let isOffSaturday = false;
                    if (dayOfWeek === 'Saturday') {
                        const saturdayPolicy = employee.alternateSaturdayPolicy || 'All Saturdays Working';
                        const weekOfMonth = Math.ceil(dateObj.getDate() / 7);
                        
                        if (saturdayPolicy === 'Week 1 & 3 Off' && (weekOfMonth === 1 || weekOfMonth === 3)) {
                            isOffSaturday = true;
                        } else if (saturdayPolicy === 'Week 2 & 4 Off' && (weekOfMonth === 2 || weekOfMonth === 4)) {
                            isOffSaturday = true;
                        } else if (saturdayPolicy === 'All Saturdays Off') {
                            isOffSaturday = true;
                        }
                    }

                    console.log(`\n  📅 ${date} (${dayOfWeek}):`);
                    console.log(`     Status: ${log.attendanceStatus}`);
                    console.log(`     Clock-in: ${log.clockInTime || 'None'}`);
                    console.log(`     Clock-out: ${log.clockOutTime || 'None'}`);
                    console.log(`     Working Hours: ${log.totalWorkingHours || 0}`);
                    console.log(`     Sessions: ${sessions.length}`);
                    console.log(`     Has Leave: ${leave ? 'Yes (' + leave.requestType + ')' : 'No'}`);
                    console.log(`     Is Holiday: ${holiday ? 'Yes (' + holiday.name + ')' : 'No'}`);
                    console.log(`     Is Sunday: ${isSunday ? 'Yes' : 'No'}`);
                    console.log(`     Is Off Saturday: ${isOffSaturday ? 'Yes' : 'No'}`);
                    console.log(`     Leave Request ID: ${log.leaveRequest || 'None'}`);
                    console.log(`     Notes: ${log.notes || 'None'}`);

                    // Diagnosis
                    if (sessions.length > 0) {
                        console.log(`     ⚠️  ISSUE: Has ${sessions.length} session(s) but marked Absent!`);
                    } else if (leave) {
                        console.log(`     ℹ️  Should be marked as Leave, not Absent`);
                    } else if (holiday) {
                        console.log(`     ℹ️  Should be marked as Holiday, not Absent`);
                    } else if (isSunday) {
                        console.log(`     ℹ️  Should be marked as Weekly Off (Sunday), not Absent`);
                    } else if (isOffSaturday) {
                        console.log(`     ℹ️  Should be marked as Weekly Off (Saturday), not Absent`);
                    } else if (!log.clockInTime && !log.clockOutTime) {
                        console.log(`     ✓ Correctly marked Absent (no attendance)`);
                    }
                }

                if (absentDates.length > 10) {
                    console.log(`\n  ... and ${absentDates.length - 10} more absent dates`);
                }
            } else {
                console.log('\n✅ No absent records found');
            }

            // Show recent present dates
            if (presentDates.length > 0) {
                console.log(`\n✅ RECENT PRESENT DATES (showing first 5):`);
                for (const date of presentDates.slice(0, 5)) {
                    const log = logs.find(l => l.attendanceDate === date);
                    console.log(`  ${date}: ${log.attendanceStatus} - ${log.totalWorkingHours || 0}h`);
                }
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('INVESTIGATION COMPLETE');
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB\n');
    }
}

checkShivamManishAbsent();
