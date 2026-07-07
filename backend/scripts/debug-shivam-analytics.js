require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const Shift = require('../models/Shift');
const AttendanceSummaryService = require('../services/AttendanceSummaryService');

async function debugShivamAnalytics() {
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

        console.log('='.repeat(80));
        console.log('EMPLOYEE INFORMATION');
        console.log('='.repeat(80));
        console.log(`Name: ${shivam.fullName}`);
        console.log(`Employee Code: ${shivam.employeeCode}`);
        console.log(`Email: ${shivam.email}`);
        console.log(`Department: ${shivam.department || 'N/A'}`);
        console.log(`Status: ${shivam.employmentStatus || 'N/A'}`);
        console.log('');

        // Check raw attendance logs
        console.log('='.repeat(80));
        console.log('RAW ATTENDANCE LOGS');
        console.log('='.repeat(80));
        const allLogs = await AttendanceLog.find({
            userId: shivam._id
        }).sort({ date: 1 });

        console.log(`Total Records: ${allLogs.length}`);
        
        if (allLogs.length > 0) {
            allLogs.forEach((log, index) => {
                const date = new Date(log.date);
                const formattedDate = date.toISOString().split('T')[0];
                console.log(`\n${index + 1}. Date: ${formattedDate}`);
                console.log(`   Status: ${log.attendanceStatus}`);
                console.log(`   Clock In: ${log.clockInTime || 'N/A'}`);
                console.log(`   Clock Out: ${log.clockOutTime || 'N/A'}`);
                console.log(`   Net Hours: ${log.netHours || 0}`);
            });
        }
        console.log('\n');

        // Check AttendanceSummary collection
        console.log('='.repeat(80));
        console.log('ATTENDANCE SUMMARY DATA');
        console.log('='.repeat(80));
        
        // Get current month date range
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        console.log(`Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        
        const summaryData = await AttendanceSummaryService.getEmployeeAttendanceSummary(
            shivam._id,
            startDate,
            endDate
        );

        console.log('\nSummary Data:');
        console.log(JSON.stringify(summaryData, null, 2));
        console.log('');

        // Check if there are any date entries in the summary
        if (summaryData && summaryData.dates) {
            console.log('\n='.repeat(80));
            console.log('SUMMARY DATES BREAKDOWN');
            console.log('='.repeat(80));
            
            const dates = Object.keys(summaryData.dates).sort();
            console.log(`Total dates in summary: ${dates.length}\n`);
            
            dates.forEach(dateStr => {
                const dateData = summaryData.dates[dateStr];
                console.log(`Date: ${dateStr}`);
                console.log(`  Status: ${dateData.status}`);
                console.log(`  Net Hours: ${dateData.netHours || 0}`);
                console.log(`  Clock In: ${dateData.clockInTime || 'N/A'}`);
                console.log(`  Clock Out: ${dateData.clockOutTime || 'N/A'}`);
                console.log('');
            });
        }

        // Now check what the analytics service returns
        console.log('='.repeat(80));
        console.log('ANALYTICS SERVICE CALCULATION');
        console.log('='.repeat(80));
        
        const AnalyticsService = require('../services/AnalyticsService');
        
        const filters = {
            startDate: startDate,
            endDate: endDate,
            employeeCode: shivam.employeeCode
        };
        
        const analyticsResult = await AnalyticsService.calculateAttendanceMetrics(filters);
        
        console.log('\nAnalytics Result:');
        if (analyticsResult.employees && analyticsResult.employees.length > 0) {
            const shivamAnalytics = analyticsResult.employees[0];
            console.log(JSON.stringify(shivamAnalytics, null, 2));
        } else {
            console.log('No analytics data found');
        }

    } catch (error) {
        console.error('Error:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
    }
}

debugShivamAnalytics();
