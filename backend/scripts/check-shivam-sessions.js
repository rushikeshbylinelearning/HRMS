require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');

async function checkShivamSessions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');

        // Find Shivam
        const shivam = await User.findOne({ 
            fullName: { $regex: /shivam/i } 
        });

        if (!shivam) {
            console.log('Shivam not found');
            return;
        }

        console.log(`Employee: ${shivam.fullName} (${shivam.employeeCode})\n`);

        // Check AttendanceLogs
        const logs = await AttendanceLog.find({ userId: shivam._id });
        console.log(`AttendanceLogs: ${logs.length}`);

        // Check AttendanceSessions directly
        const sessions = await AttendanceSession.find({}).populate('attendanceLog');
        
        const shivamSessions = sessions.filter(session => {
            return session.attendanceLog && 
                   session.attendanceLog.userId && 
                   session.attendanceLog.userId.toString() === shivam._id.toString();
        });

        console.log(`AttendanceSessions for Shivam: ${shivamSessions.length}\n`);

        if (shivamSessions.length > 0) {
            console.log('Sessions found:');
            shivamSessions.forEach((session, index) => {
                console.log(`${index + 1}. Start: ${session.startTime}, End: ${session.endTime || 'Active'}`);
                console.log(`   Log ID: ${session.attendanceLog._id}`);
                console.log(`   Date: ${session.attendanceLog.attendanceDate}`);
            });
        }

        // Also check if there are any logs with user field instead of userId
        const logsWithUser = await AttendanceLog.find({ user: shivam._id });
        console.log(`\nAttendanceLogs with 'user' field: ${logsWithUser.length}`);

        if (logsWithUser.length > 0) {
            console.log('\nLogs found with user field:');
            logsWithUser.forEach((log, index) => {
                console.log(`${index + 1}. Date: ${log.attendanceDate}, Status: ${log.attendanceStatus}`);
            });

            // Check sessions for these logs
            const logIds = logsWithUser.map(log => log._id);
            const sessionsForLogs = await AttendanceSession.find({
                attendanceLog: { $in: logIds }
            });
            console.log(`\nSessions for these logs: ${sessionsForLogs.length}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

checkShivamSessions();
