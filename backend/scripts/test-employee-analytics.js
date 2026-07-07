/**
 * TEST EMPLOYEE ANALYTICS ENDPOINT
 * 
 * Quick test script to verify the employee detailed analytics endpoint works correctly.
 * 
 * Usage:
 *   node backend/scripts/test-employee-analytics.js <employeeId> <month> <year>
 * 
 * Example:
 *   node backend/scripts/test-employee-analytics.js 507f1f77bcf86cd799439011 02 2024
 */

require('dotenv').config();
const mongoose = require('mongoose');
const employeeAnalyticsController = require('../controllers/employeeAnalyticsController');
const User = require('../models/User');

async function testEmployeeAnalytics() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get command line arguments
        const args = process.argv.slice(2);
        let employeeId = args[0];
        let month = args[1] || '02';
        let year = args[2] || '2024';
        
        // If no employee ID provided, find first active employee
        if (!employeeId) {
            const employee = await User.findOne({ isActive: true }).select('_id fullName employeeCode');
            if (!employee) {
                console.error('❌ No active employees found');
                process.exit(1);
            }
            employeeId = employee._id.toString();
            console.log(`📋 Using first active employee: ${employee.fullName} (${employee.employeeCode})`);
        }
        
        console.log(`\n🔍 Testing Employee Analytics Endpoint`);
        console.log(`   Employee ID: ${employeeId}`);
        console.log(`   Month: ${month}`);
        console.log(`   Year: ${year}`);
        console.log('');
        
        // Create mock request and response objects
        const req = {
            params: { employeeId },
            query: { month, year }
        };
        
        let responseData = null;
        let statusCode = 200;
        
        const res = {
            status: (code) => {
                statusCode = code;
                return res;
            },
            json: (data) => {
                responseData = data;
                return res;
            }
        };
        
        // Call the controller
        await employeeAnalyticsController.getEmployeeDetailedAnalytics(req, res);
        
        // Check response
        if (statusCode !== 200) {
            console.error(`❌ Request failed with status ${statusCode}`);
            console.error(JSON.stringify(responseData, null, 2));
            process.exit(1);
        }
        
        if (!responseData.success) {
            console.error('❌ Request returned success: false');
            console.error(JSON.stringify(responseData, null, 2));
            process.exit(1);
        }
        
        // Display results
        const { employeeInfo, summary, dailyLogs, dateRange } = responseData.data;
        
        console.log('✅ Request successful!\n');
        
        console.log('👤 EMPLOYEE INFO:');
        console.log(`   Name: ${employeeInfo.fullName}`);
        console.log(`   Code: ${employeeInfo.employeeCode}`);
        console.log(`   Department: ${employeeInfo.department}`);
        console.log(`   Designation: ${employeeInfo.designation}`);
        console.log(`   Shift: ${employeeInfo.shiftGroup} (${employeeInfo.shiftType})`);
        console.log('');
        
        console.log('📊 KPI SUMMARY:');
        console.log(`   Present Days: ${summary.presentDays}`);
        console.log(`   Leave Days: ${summary.leaveDays}`);
        console.log(`   Absent Days: ${summary.absentDays}`);
        console.log(`   Non-Working Days: ${summary.nonWorkingDays}`);
        console.log(`   Total Net Hours: ${summary.totalNetHours} hrs`);
        console.log(`   Average Working Hours: ${summary.avgWorkingHours} hrs`);
        console.log(`   Overtime Hours: ${summary.overtimeHours} hrs`);
        console.log(`   Half Days: ${summary.halfDays}`);
        console.log(`   Full Days: ${summary.fullDays}`);
        console.log('');
        
        console.log('📅 DATE RANGE:');
        console.log(`   Start: ${dateRange.startDate}`);
        console.log(`   End: ${dateRange.endDate}`);
        console.log(`   Period: ${getMonthName(dateRange.month)} ${dateRange.year}`);
        console.log('');
        
        console.log('📋 DAILY LOGS:');
        console.log(`   Total Records: ${dailyLogs.length}`);
        
        if (dailyLogs.length > 0) {
            console.log('\n   Sample Records (first 5):');
            dailyLogs.slice(0, 5).forEach((log, index) => {
                console.log(`   ${index + 1}. ${log.date} - ${log.status} (${log.dayType})`);
                if (log.workedTime > 0) {
                    console.log(`      Worked: ${log.workedTime.toFixed(2)} hrs, Break: ${log.breakTime.toFixed(2)} hrs`);
                }
                if (log.overriddenByAdmin) {
                    console.log(`      ⚠️  Admin Override`);
                }
            });
        }
        
        console.log('\n✅ All tests passed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || '';
}

// Run the test
testEmployeeAnalytics();
