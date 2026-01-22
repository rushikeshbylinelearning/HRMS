// backend/scripts/fix-sukhada-leave.js
/**
 * Script to automatically find and fix attendance records for Sukhada Joshi's leave on Dec 26, 2025
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

const normalizeDate = (date) => {
    let dateObj;
    if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            dateObj = new Date(date + 'T00:00:00');
        } else {
            dateObj = new Date(date);
        }
    } else {
        dateObj = new Date(date);
    }
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const fixSukhadaLeave = async () => {
    try {
        await connectDB();

        // Load all required models
        require('../models/Shift');
        require('../models/User');
        require('../models/AttendanceLog');
        require('../models/LeaveRequest');

        console.log('🔍 Finding Sukhada Joshi...');
        const employee = await User.findOne({ 
            fullName: { $regex: /Sukhada/i },
            employeeCode: { $regex: /E87/i }
        });

        if (!employee) {
            console.error('❌ Employee not found');
            process.exit(1);
        }

        console.log(`✅ Found employee: ${employee.fullName} (${employee.employeeCode})`);
        console.log(`   ID: ${employee._id}`);

        // Find approved leave requests for Dec 26, 2025
        console.log('\n🔍 Finding leave requests for Dec 26, 2025...');
        const targetDate = '2025-12-26';
        
        const leaves = await LeaveRequest.find({
            employee: employee._id,
            status: 'Approved'
        }).populate('employee');

        console.log(`Found ${leaves.length} approved leave(s) for this employee`);

        // Find leaves that include Dec 26
        const relevantLeaves = leaves.filter(leave => {
            const leaveDates = (leave.leaveDates || []).map(normalizeDate);
            return leaveDates.includes(targetDate);
        });

        if (relevantLeaves.length === 0) {
            console.log('\n⚠️  No approved leave found for Dec 26, 2025');
            console.log('Checking all leaves for this employee...');
            
            for (const leave of leaves) {
                const leaveDates = (leave.leaveDates || []).map(normalizeDate);
                console.log(`  Leave ${leave._id}: ${leaveDates.join(', ')} (Status: ${leave.status})`);
            }
            
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log(`\n✅ Found ${relevantLeaves.length} leave(s) for Dec 26, 2025:`);
        
        for (const leave of relevantLeaves) {
            const leaveDates = (leave.leaveDates || []).map(normalizeDate);
            console.log(`\n  Leave ID: ${leave._id}`);
            console.log(`  Type: ${leave.requestType}`);
            console.log(`  Dates: ${leaveDates.join(', ')}`);
            console.log(`  Status: ${leave.status}`);

            // Check current attendance records
            console.log('\n  📊 Current attendance records:');
            for (const leaveDate of leave.leaveDates) {
                const dateStr = normalizeDate(leaveDate);
                const log = await AttendanceLog.findOne({
                    user: employee._id,
                    attendanceDate: dateStr
                });

                if (log) {
                    const status = log.attendanceStatus === 'Leave' ? '✅ Leave' : `⚠️  ${log.attendanceStatus}`;
                    const linked = log.leaveRequest?.toString() === leave._id.toString() ? '✅ Linked' : '❌ Not linked';
                    const clockIn = log.clockInTime ? ` (Clock-in: ${log.clockInTime})` : '';
                    console.log(`    ${dateStr}: ${status}, ${linked}${clockIn}`);
                } else {
                    console.log(`    ${dateStr}: ❌ No attendance log found`);
                }
            }

            // Fix attendance records
            console.log('\n  🔄 Fixing attendance records...');
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                // First, revert all dates for this leave (clean slate)
                console.log('    Reverting existing attendance records...');
                await syncAttendanceOnLeaveRejection(leave, session);
                
                // Then, sync the correct dates
                console.log('    Syncing correct attendance records...');
                await syncAttendanceOnLeaveApproval(leave, session);
                
                await session.commitTransaction();
                console.log('    ✅ Attendance records fixed successfully');
            } catch (error) {
                await session.abortTransaction();
                console.error('    ❌ Error fixing attendance:', error.message);
                throw error;
            } finally {
                session.endSession();
            }

            // Verify the fix
            console.log('\n  ✅ Verification after fix:');
            for (const leaveDate of leave.leaveDates) {
                const dateStr = normalizeDate(leaveDate);
                const log = await AttendanceLog.findOne({
                    user: employee._id,
                    attendanceDate: dateStr
                });

                if (log) {
                    const status = log.attendanceStatus === 'Leave' ? '✅ Leave' : `⚠️  ${log.attendanceStatus}`;
                    const linked = log.leaveRequest?.toString() === leave._id.toString() ? '✅ Linked' : '❌ Not linked';
                    console.log(`    ${dateStr}: ${status}, ${linked}`);
                } else {
                    console.log(`    ${dateStr}: ❌ No attendance log found (should have been created)`);
                }
            }

            // Check Dec 27 (should NOT be leave if employee worked)
            const dec27 = '2025-12-27';
            const log27 = await AttendanceLog.findOne({
                user: employee._id,
                attendanceDate: dec27
            });

            if (log27) {
                if (log27.attendanceStatus === 'Leave' && log27.leaveRequest?.toString() === leave._id.toString()) {
                    console.log(`\n  ⚠️  Dec 27 still shows Leave - reverting...`);
                    const session2 = await mongoose.startSession();
                    session2.startTransaction();
                    try {
                        // Create a temp leave with only Dec 27 to revert it
                        const tempLeave = {
                            ...leave.toObject(),
                            leaveDates: [new Date('2025-12-27T00:00:00')]
                        };
                        await syncAttendanceOnLeaveRejection(tempLeave, session2);
                        await session2.commitTransaction();
                        console.log('  ✅ Dec 27 reverted successfully');
                    } catch (err) {
                        await session2.abortTransaction();
                        console.error('  ❌ Error reverting Dec 27:', err.message);
                    } finally {
                        session2.endSession();
                    }
                } else {
                    console.log(`\n  ✅ Dec 27: ${log27.attendanceStatus} (correct)`);
                }
            } else {
                console.log(`\n  ℹ️  Dec 27: No attendance log (employee may not have worked)`);
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

fixSukhadaLeave();




