// backend/scripts/fix-leave-attendance-sync.js
/**
 * Script to fix attendance records for a specific leave request.
 * Use this when leave dates were updated but attendance wasn't properly synced.
 * 
 * Usage: node scripts/fix-leave-attendance-sync.js <leaveRequestId>
 * Example: node scripts/fix-leave-attendance-sync.js 694a26754750a7aa34e716e0
 */

require('dotenv').config();
const mongoose = require('mongoose');
const LeaveRequest = require('../models/LeaveRequest');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const { syncAttendanceOnLeaveApproval, syncAttendanceOnLeaveRejection } = require('../services/leaveAttendanceSyncService');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-system', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const fixLeaveAttendance = async (leaveRequestId) => {
    try {
        await connectDB();

        // Load all required models
        require('../models/Shift');
        require('../models/User');
        require('../models/AttendanceLog');
        require('../models/LeaveRequest');

        console.log(`Finding leave request ${leaveRequestId}...`);
        const leave = await LeaveRequest.findById(leaveRequestId).populate('employee');
        
        if (!leave) {
            console.error('Leave request not found');
            process.exit(1);
        }

        console.log(`\nLeave Request Details:`);
        console.log(`  Employee: ${leave.employee?.fullName || leave.employee?._id}`);
        console.log(`  Status: ${leave.status}`);
        console.log(`  Type: ${leave.requestType}`);
        console.log(`  Dates: ${leave.leaveDates.map(d => {
            const dateObj = new Date(d);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }).join(', ')}`);

        if (leave.status !== 'Approved') {
            console.log('\n⚠️  Leave is not approved. Only approved leaves affect attendance.');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Check current attendance records for these dates
        console.log('\nChecking current attendance records...');
        for (const leaveDate of leave.leaveDates) {
            const dateObj = new Date(leaveDate);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const log = await AttendanceLog.findOne({
                user: leave.employee._id,
                attendanceDate: dateStr
            });

            if (log) {
                console.log(`  ${dateStr}: Status=${log.attendanceStatus}, LeaveRequest=${log.leaveRequest?.toString() || 'null'}, ClockIn=${log.clockInTime ? 'Yes' : 'No'}`);
            } else {
                console.log(`  ${dateStr}: No attendance log found`);
            }
        }

        // Sync attendance
        console.log('\n🔄 Syncing attendance records...');
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            await syncAttendanceOnLeaveApproval(leave, session);
            await session.commitTransaction();
            console.log('✅ Attendance records synced successfully');
        } catch (error) {
            await session.abortTransaction();
            console.error('❌ Error syncing attendance:', error);
            throw error;
        } finally {
            session.endSession();
        }

        // Verify the sync
        console.log('\nVerifying attendance records after sync...');
        for (const leaveDate of leave.leaveDates) {
            const dateObj = new Date(leaveDate);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const log = await AttendanceLog.findOne({
                user: leave.employee._id,
                attendanceDate: dateStr
            });

            if (log) {
                const status = log.attendanceStatus === 'Leave' ? '✅ Leave' : `⚠️  ${log.attendanceStatus}`;
                const linked = log.leaveRequest?.toString() === leave._id.toString() ? '✅ Linked' : '❌ Not linked';
                console.log(`  ${dateStr}: ${status}, ${linked}`);
            } else {
                console.log(`  ${dateStr}: ❌ No attendance log found (should have been created)`);
            }
        }

        await mongoose.connection.close();
        console.log('\n✅ Fix complete!');
        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
};

// Parse command line arguments
const args = process.argv.slice(2);
const leaveRequestId = args[0];

if (!leaveRequestId) {
    console.error('Usage: node scripts/fix-leave-attendance-sync.js <leaveRequestId>');
    process.exit(1);
}

if (!mongoose.Types.ObjectId.isValid(leaveRequestId)) {
    console.error('Invalid leave request ID format');
    process.exit(1);
}

fixLeaveAttendance(leaveRequestId);












