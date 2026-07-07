require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const Shift = require('../models/Shift'); // Import Shift model
const { recalculateLateStatus } = require('../services/dailyStatusService');

async function fixIncorrectAbsentStatus() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        console.log('═══════════════════════════════════════════════════════════');
        console.log('FIXING INCORRECT ABSENT STATUS');
        console.log('═══════════════════════════════════════════════════════════\n');

        // Find all attendance logs marked as Absent but have sessions
        const absentLogs = await AttendanceLog.find({
            attendanceStatus: 'Absent'
        }).populate('user', 'fullName employeeCode shiftGroup').lean();

        console.log(`Found ${absentLogs.length} records marked as Absent\n`);

        let fixedCount = 0;
        const issuesFound = [];

        for (const log of absentLogs) {
            // Check if this log has sessions
            const sessions = await AttendanceSession.find({
                attendanceLog: log._id
            }).lean();

            if (sessions.length > 0) {
                // This is incorrect - has sessions but marked Absent
                const issue = {
                    employee: log.user?.fullName || 'Unknown',
                    employeeCode: log.user?.employeeCode || 'Unknown',
                    date: log.attendanceDate,
                    currentStatus: log.attendanceStatus,
                    clockInTime: log.clockInTime,
                    clockOutTime: log.clockOutTime,
                    totalWorkingHours: log.totalWorkingHours,
                    sessionsCount: sessions.length,
                    firstSession: sessions[0]
                };

                issuesFound.push(issue);

                console.log(`\n📋 Issue Found:`);
                console.log(`   Employee: ${issue.employee} (${issue.employeeCode})`);
                console.log(`   Date: ${issue.date}`);
                console.log(`   Current Status: ${issue.currentStatus}`);
                console.log(`   Clock-in: ${issue.clockInTime || 'MISSING'}`);
                console.log(`   Clock-out: ${issue.clockOutTime || 'None'}`);
                console.log(`   Working Hours: ${issue.totalWorkingHours || 0}`);
                console.log(`   Sessions: ${issue.sessionsCount}`);

                // Fix the record
                try {
                    const logToUpdate = await AttendanceLog.findById(log._id).populate({
                        path: 'user',
                        populate: { path: 'shiftGroup' }
                    });

                    if (!logToUpdate) {
                        console.log(`   ❌ Log not found for update`);
                        continue;
                    }

                    // Update clockInTime if missing but has sessions
                    if (!logToUpdate.clockInTime && sessions.length > 0) {
                        const firstSession = sessions.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];
                        logToUpdate.clockInTime = firstSession.startTime;
                        console.log(`   🔧 Setting clockInTime from first session: ${firstSession.startTime}`);
                    }

                    // Update clockOutTime if missing but has sessions with endTime
                    if (!logToUpdate.clockOutTime && sessions.length > 0) {
                        const lastSession = sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0];
                        if (lastSession.endTime) {
                            logToUpdate.clockOutTime = lastSession.endTime;
                            console.log(`   🔧 Setting clockOutTime from last session: ${lastSession.endTime}`);
                        }
                    }

                    // Recalculate working hours if both times exist
                    if (logToUpdate.clockInTime && logToUpdate.clockOutTime) {
                        const workingMinutes = (new Date(logToUpdate.clockOutTime) - new Date(logToUpdate.clockInTime)) / (1000 * 60);
                        const totalBreakMinutes = (logToUpdate.paidBreakMinutesTaken || 0) + (logToUpdate.unpaidBreakMinutesTaken || 0);
                        const netWorkingMinutes = Math.max(0, workingMinutes - totalBreakMinutes);
                        logToUpdate.totalWorkingHours = netWorkingMinutes / 60;
                        console.log(`   🔧 Recalculated working hours: ${logToUpdate.totalWorkingHours.toFixed(2)}h`);
                    }

                    // Recalculate status
                    if (logToUpdate.clockInTime && logToUpdate.user?.shiftGroup) {
                        const recalculatedStatus = await recalculateLateStatus(
                            new Date(logToUpdate.clockInTime),
                            logToUpdate.user.shiftGroup,
                            null,
                            logToUpdate.totalWorkingHours
                        );

                        logToUpdate.attendanceStatus = recalculatedStatus.attendanceStatus;
                        logToUpdate.isLate = recalculatedStatus.isLate;
                        logToUpdate.lateMinutes = recalculatedStatus.lateMinutes;
                        logToUpdate.isHalfDay = recalculatedStatus.isHalfDay;

                        console.log(`   ✅ New Status: ${recalculatedStatus.attendanceStatus}`);
                        console.log(`   ✅ Is Late: ${recalculatedStatus.isLate}`);
                        console.log(`   ✅ Late Minutes: ${recalculatedStatus.lateMinutes}`);
                        console.log(`   ✅ Is Half-day: ${recalculatedStatus.isHalfDay}`);

                        await logToUpdate.save();
                        fixedCount++;
                        console.log(`   ✅ Record updated successfully`);
                    } else {
                        console.log(`   ⚠️  Cannot recalculate status - missing clockInTime or shiftGroup`);
                    }

                } catch (error) {
                    console.log(`   ❌ Error fixing record: ${error.message}`);
                }
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('FIX SUMMARY');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(`Total Absent Records: ${absentLogs.length}`);
        console.log(`Issues Found: ${issuesFound.length}`);
        console.log(`Records Fixed: ${fixedCount}`);

        if (issuesFound.length > 0) {
            console.log('\n📊 Issues by Employee:');
            const byEmployee = {};
            issuesFound.forEach(issue => {
                const key = `${issue.employee} (${issue.employeeCode})`;
                byEmployee[key] = (byEmployee[key] || 0) + 1;
            });
            Object.entries(byEmployee).forEach(([emp, count]) => {
                console.log(`   ${emp}: ${count} issue(s)`);
            });
        }

        console.log('\n✅ Fix complete!\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB\n');
    }
}

fixIncorrectAbsentStatus();
