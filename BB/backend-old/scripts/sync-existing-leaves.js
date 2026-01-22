// backend/scripts/sync-existing-leaves.js
/**
 * Script to sync existing approved leaves with attendance records.
 * Run this to fix historical data where leaves were approved before the sync was implemented.
 * 
 * Usage: node scripts/sync-existing-leaves.js [startDate] [endDate] [employeeId]
 * Example: node scripts/sync-existing-leaves.js 2025-12-01 2025-12-31
 */

require('dotenv').config();
const mongoose = require('mongoose');

// CRITICAL: Load all models BEFORE requiring services that use them
// This prevents "Schema hasn't been registered" errors
require('../models/Shift');
require('../models/User');
require('../models/AttendanceLog');
require('../models/LeaveRequest');

// Now require the models and services
const LeaveRequest = require('../models/LeaveRequest');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const { syncAttendanceOnLeaveApproval } = require('../services/leaveAttendanceSyncService');

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

const syncExistingLeaves = async (startDate = null, endDate = null, employeeId = null) => {
    try {
        await connectDB();

        // Build query for approved leaves
        const query = { status: 'Approved' };
        
        if (employeeId) {
            query.employee = employeeId;
        }

        // Filter by date range if provided
        if (startDate || endDate) {
            query.leaveDates = {};
            if (startDate) {
                query.leaveDates.$gte = new Date(startDate);
            }
            if (endDate) {
                query.leaveDates.$lte = new Date(endDate);
            }
        }

        console.log('Finding approved leaves...');
        // Populate employee but don't populate shiftGroup here - we'll load it in the sync service if needed
        const approvedLeaves = await LeaveRequest.find(query)
            .populate('employee', 'fullName employeeCode shiftGroup');

        // Filter by date range if provided
        let filteredLeaves = approvedLeaves;
        if (startDate || endDate) {
            filteredLeaves = approvedLeaves.filter(leave => {
                return leave.leaveDates.some(leaveDate => {
                    const dateStr = new Date(leaveDate).toISOString().slice(0, 10);
                    if (startDate && dateStr < startDate) return false;
                    if (endDate && dateStr > endDate) return false;
                    return true;
                });
            });
        }

        console.log(`Found ${approvedLeaves.length} approved leave requests`);
        if (startDate || endDate) {
            console.log(`Filtered to ${filteredLeaves.length} leaves in date range`);
        }

        let totalSynced = 0;
        let totalErrors = 0;

        for (const leave of filteredLeaves) {
            try {
                // Handle case where employee might be null or not populated
                const employeeInfo = leave.employee?.fullName || leave.employee?._id || 'Unknown';
                console.log(`\nProcessing leave ${leave._id} for employee ${employeeInfo}`);
                console.log(`  Dates: ${leave.leaveDates.map(d => new Date(d).toISOString().slice(0, 10)).join(', ')}`);
                console.log(`  Type: ${leave.requestType}`);
                
                // Skip if employee is null
                if (!leave.employee || !leave.employee._id) {
                    console.log(`  ⚠️  Skipping - employee not found`);
                    continue;
                }

                // Create a session for this leave
                const session = await mongoose.startSession();
                session.startTransaction();

                try {
                    // Sync attendance for this leave
                    const updatedLogs = await syncAttendanceOnLeaveApproval(leave, session);
                    
                    await session.commitTransaction();
                    
                    console.log(`  ✅ Synced ${updatedLogs.length} attendance records`);
                    totalSynced += updatedLogs.length;
                } catch (syncError) {
                    await session.abortTransaction();
                    console.error(`  ❌ Error syncing leave ${leave._id}:`, syncError.message);
                    totalErrors++;
                } finally {
                    session.endSession();
                }
            } catch (error) {
                console.error(`  ❌ Error processing leave ${leave._id}:`, error.message);
                totalErrors++;
            }
        }

        console.log(`\n✅ Sync complete!`);
        console.log(`  Total leaves processed: ${approvedLeaves.length}`);
        console.log(`  Total attendance records synced: ${totalSynced}`);
        console.log(`  Total errors: ${totalErrors}`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
};

// Parse command line arguments
const args = process.argv.slice(2);
const startDate = args[0] || null;
const endDate = args[1] || null;
const employeeId = args[2] || null;

if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    console.error('Invalid start date format. Use YYYY-MM-DD');
    process.exit(1);
}

if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    console.error('Invalid end date format. Use YYYY-MM-DD');
    process.exit(1);
}

console.log('Starting leave sync...');
if (startDate) console.log(`  Start date: ${startDate}`);
if (endDate) console.log(`  End date: ${endDate}`);
if (employeeId) console.log(`  Employee ID: ${employeeId}`);

syncExistingLeaves(startDate, endDate, employeeId);

