// Check if RJ's Jan 31 record exists and is being counted

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function checkRJJan31() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        // Find RJ
        const rj = await User.findOne({
            $or: [
                { fullName: /RJ/i },
                { employeeCode: /BYL202505-E71/i }
            ]
        }).lean();
        
        if (!rj) {
            console.log('❌ Employee RJ not found\n');
            return;
        }
        
        console.log(`Found: ${rj.fullName} (${rj.employeeCode})\n`);
        
        // Check Jan 31
        const jan31 = await AttendanceLog.findOne({
            user: rj._id,
            attendanceDate: '2026-01-31'
        }).lean();
        
        if (jan31) {
            console.log('Jan 31 Record Found:\n');
            console.log(`  Date: ${jan31.attendanceDate}`);
            console.log(`  Hours: ${jan31.totalWorkingHours.toFixed(2)}`);
            console.log(`  Status: ${jan31.attendanceStatus}`);
            console.log(`  Is Half-Day: ${jan31.isHalfDay}`);
            console.log(`  Reason: ${jan31.halfDayReasonCode || 'N/A'}\n`);
        } else {
            console.log('❌ No record found for Jan 31\n');
        }
        
        // Get all records from Jan 31 to Feb 28
        const allLogs = await AttendanceLog.find({
            user: rj._id,
            attendanceDate: { $gte: '2026-01-31', $lte: '2026-02-28' }
        }).sort({ attendanceDate: 1 }).lean();
        
        console.log(`Total records from Jan 31 to Feb 28: ${allLogs.length}\n`);
        
        console.log('All Records:\n');
        console.log('┌────────────┬───────────┬──────────┬──────────┐');
        console.log('│    Date    │   Hours   │  Status  │ Half-Day │');
        console.log('├────────────┼───────────┼──────────┼──────────┤');
        
        let totalHours = 0;
        let presentCount = 0;
        
        allLogs.forEach(log => {
            const date = log.attendanceDate;
            const hours = log.totalWorkingHours.toFixed(2).padStart(9);
            const status = (log.attendanceStatus || 'N/A').padEnd(8);
            const isHalfDay = log.isHalfDay ? 'Yes' : 'No';
            
            console.log(`│ ${date} │ ${hours} │ ${status} │ ${isHalfDay.padEnd(8)} │`);
            
            totalHours += log.totalWorkingHours;
            if (['On-time', 'Late', 'Half-day'].includes(log.attendanceStatus)) {
                presentCount++;
            }
        });
        
        console.log('└────────────┴───────────┴──────────┴──────────┘\n');
        
        console.log('Summary:');
        console.log(`  Total Records: ${allLogs.length}`);
        console.log(`  Present Days: ${presentCount}`);
        console.log(`  Total Hours: ${totalHours.toFixed(2)}\n`);
        
        console.log('Expected:');
        console.log(`  Total Records: 16 (Jan 31 + 15 Feb days)`);
        console.log(`  Present Days: 15`);
        console.log(`  Total Hours: 120.24\n`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

checkRJJan31();
