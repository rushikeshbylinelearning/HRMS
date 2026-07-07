require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function checkShivamAbsentDates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');

        // Find all users with Shivam in their name
        const shivamUsers = await User.find({ 
            fullName: { $regex: /shivam/i } 
        });

        if (shivamUsers.length === 0) {
            console.log('No users found with name containing "Shivam"');
            return;
        }

        console.log(`Found ${shivamUsers.length} user(s) with "Shivam" in name:\n`);
        
        for (const user of shivamUsers) {
            console.log('='.repeat(80));
            console.log(`Name: ${user.fullName}`);
            console.log(`Employee Code: ${user.employeeCode}`);
            console.log(`Email: ${user.email}`);
            console.log(`Department: ${user.department || 'N/A'}`);
            console.log(`Status: ${user.employmentStatus || 'N/A'}`);
            console.log('');

            // Get overall attendance summary for this user
            // Get overall attendance summary for this user
            const allLogs = await AttendanceLog.find({
                userId: user._id
            }).sort({ date: 1 });

            console.log(`Total Attendance Records: ${allLogs.length}`);

            if (allLogs.length > 0) {
                // Count by status
                const statusCounts = {};
                allLogs.forEach(log => {
                    const status = log.attendanceStatus || 'Unknown';
                    statusCounts[status] = (statusCounts[status] || 0) + 1;
                });

                console.log('\nAttendance Status Summary:');
                Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
                    console.log(`  ${status}: ${count} days`);
                });

                // Find absent days
                const absentLogs = allLogs.filter(log => log.attendanceStatus === 'Absent');
                
                if (absentLogs.length > 0) {
                    console.log(`\nAbsent Days (${absentLogs.length}):`);
                    absentLogs.forEach((log, index) => {
                        const date = new Date(log.date);
                        const formattedDate = date.toISOString().split('T')[0];
                        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
                        
                        console.log(`  ${index + 1}. ${formattedDate} (${dayOfWeek})`);
                        if (log.adminOverride) {
                            console.log(`     Admin Override: ${log.adminOverrideReason || 'N/A'}`);
                        }
                    });
                }
            }
            console.log('');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

checkShivamAbsentDates();
