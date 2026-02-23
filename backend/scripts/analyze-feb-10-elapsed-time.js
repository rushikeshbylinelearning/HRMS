// Analyze Feb 10 to understand why it's marked as half-day despite 8.52 hours worked

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const User = require('../models/User');

async function analyzeFeb10() {
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
        
        // Get Feb 10 record
        const feb10Log = await AttendanceLog.findOne({
            user: rj._id,
            attendanceDate: '2026-02-10'
        }).lean();
        
        if (!feb10Log) {
            console.log('❌ No record found for Feb 10\n');
            return;
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('FEB 10 ATTENDANCE RECORD ANALYSIS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Basic Information:');
        console.log(`  Date: ${feb10Log.attendanceDate}`);
        console.log(`  Clock In: ${feb10Log.clockInTime ? new Date(feb10Log.clockInTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`);
        console.log(`  Clock Out: ${feb10Log.clockOutTime ? new Date(feb10Log.clockOutTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`);
        console.log(`  Status: ${feb10Log.attendanceStatus}`);
        console.log(`  Is Half-Day: ${feb10Log.isHalfDay}`);
        console.log(`  Half-Day Reason: ${feb10Log.halfDayReasonCode || 'N/A'}`);
        console.log(`  Half-Day Text: ${feb10Log.halfDayReasonText || 'N/A'}\n`);
        
        // Get sessions
        const sessions = await AttendanceSession.find({
            attendanceLog: feb10Log._id
        }).sort({ startTime: 1 }).lean();
        
        console.log('Sessions:');
        let totalSessionMinutes = 0;
        sessions.forEach((session, idx) => {
            if (session.endTime) {
                const duration = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60);
                totalSessionMinutes += duration;
                console.log(`  Session ${idx + 1}:`);
                console.log(`    Start: ${new Date(session.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                console.log(`    End: ${new Date(session.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                console.log(`    Duration: ${duration.toFixed(2)} minutes (${(duration / 60).toFixed(2)} hours)`);
            }
        });
        console.log(`  Total Session Time: ${totalSessionMinutes.toFixed(2)} minutes (${(totalSessionMinutes / 60).toFixed(2)} hours)\n`);
        
        // Get breaks
        const breaks = await BreakLog.find({
            attendanceLog: feb10Log._id
        }).sort({ startTime: 1 }).lean();
        
        console.log('Breaks:');
        let totalBreakMinutes = 0;
        breaks.forEach((breakLog, idx) => {
            if (breakLog.endTime) {
                const duration = (new Date(breakLog.endTime) - new Date(breakLog.startTime)) / (1000 * 60);
                totalBreakMinutes += duration;
                console.log(`  Break ${idx + 1} (${breakLog.breakType || 'Unknown'}):`);
                console.log(`    Start: ${new Date(breakLog.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                console.log(`    End: ${new Date(breakLog.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                console.log(`    Duration: ${duration.toFixed(2)} minutes (${(duration / 60).toFixed(2)} hours)`);
            }
        });
        console.log(`  Total Break Time: ${totalBreakMinutes.toFixed(2)} minutes (${(totalBreakMinutes / 60).toFixed(2)} hours)\n`);
        
        // Calculate metrics
        const netWorkingMinutes = totalSessionMinutes - totalBreakMinutes;
        const netWorkingHours = netWorkingMinutes / 60;
        
        // Calculate elapsed shift time (clock-out - clock-in)
        let elapsedShiftMinutes = 0;
        let elapsedShiftHours = 0;
        if (feb10Log.clockInTime && feb10Log.clockOutTime) {
            elapsedShiftMinutes = (new Date(feb10Log.clockOutTime) - new Date(feb10Log.clockInTime)) / (1000 * 60);
            elapsedShiftHours = elapsedShiftMinutes / 60;
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('CALCULATION BREAKDOWN');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Net Working Time (Session - Break):');
        console.log(`  Total Session Time: ${totalSessionMinutes.toFixed(2)} minutes`);
        console.log(`  Total Break Time: ${totalBreakMinutes.toFixed(2)} minutes`);
        console.log(`  Net Working Time: ${netWorkingMinutes.toFixed(2)} minutes`);
        console.log(`  Net Working Hours: ${netWorkingHours.toFixed(2)} hours`);
        console.log(`  Stored in DB: ${feb10Log.totalWorkingHours.toFixed(2)} hours`);
        console.log(`  Match: ${Math.abs(netWorkingHours - feb10Log.totalWorkingHours) < 0.01 ? '✅ YES' : '❌ NO'}\n`);
        
        console.log('Elapsed Shift Time (Clock-Out - Clock-In):');
        console.log(`  Clock In: ${feb10Log.clockInTime ? new Date(feb10Log.clockInTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`);
        console.log(`  Clock Out: ${feb10Log.clockOutTime ? new Date(feb10Log.clockOutTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`);
        console.log(`  Elapsed Time: ${elapsedShiftMinutes.toFixed(2)} minutes`);
        console.log(`  Elapsed Hours: ${elapsedShiftHours.toFixed(2)} hours\n`);
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('POLICY EVALUATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Attendance Policy Rules:');
        console.log('  1. Elapsed Shift Time < 5 hours → Absent');
        console.log('  2. Elapsed Shift Time >= 5 hours AND < 9 hours → Half-day');
        console.log('  3. Elapsed Shift Time >= 9 hours → Full day (On-time/Late)\n');
        
        console.log('Feb 10 Evaluation:');
        console.log(`  Net Working Hours: ${netWorkingHours.toFixed(2)} hours (8.52 hours)`);
        console.log(`  Elapsed Shift Hours: ${elapsedShiftHours.toFixed(2)} hours\n`);
        
        if (elapsedShiftHours < 5) {
            console.log(`  ❌ Result: ABSENT (elapsed < 5 hours)`);
        } else if (elapsedShiftHours >= 5 && elapsedShiftHours < 9) {
            console.log(`  ⚠️  Result: HALF-DAY (elapsed >= 5 AND < 9 hours)`);
            console.log(`  Reason: Elapsed shift time is ${elapsedShiftHours.toFixed(2)} hours`);
            console.log(`  Required: 9 hours elapsed for full day`);
            console.log(`  Shortfall: ${(9 - elapsedShiftHours).toFixed(2)} hours\n`);
            
            console.log('  Why is this half-day?');
            console.log(`    - Employee worked ${netWorkingHours.toFixed(2)} hours (net time)`);
            console.log(`    - But total time at office was only ${elapsedShiftHours.toFixed(2)} hours`);
            console.log(`    - Policy requires 9 hours elapsed (including breaks)`);
            console.log(`    - Therefore: Marked as Half-day ✅ CORRECT\n`);
        } else {
            console.log(`  ✅ Result: FULL DAY (elapsed >= 9 hours)`);
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('CONCLUSION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        if (elapsedShiftHours >= 5 && elapsedShiftHours < 9) {
            console.log('✅ Feb 10 is CORRECTLY marked as Half-day\n');
            console.log('Explanation:');
            console.log('  - The policy uses ELAPSED SHIFT TIME, not just working hours');
            console.log('  - Elapsed time = Clock-out time - Clock-in time (includes breaks)');
            console.log(`  - Feb 10 elapsed time: ${elapsedShiftHours.toFixed(2)} hours < 9 hours required`);
            console.log('  - Even though net working time is 8.52 hours, elapsed time is less than 9 hours');
            console.log('  - This is a legitimate half-day due to insufficient total shift duration\n');
            
            console.log('To avoid half-day marking:');
            console.log('  - Employee must stay at office for at least 9 hours total');
            console.log('  - This includes work time + break time');
            console.log('  - Example: 10:00 AM - 7:00 PM = 9 hours elapsed\n');
        } else {
            console.log('⚠️  Feb 10 should NOT be marked as Half-day\n');
            console.log('Recommendation: Review and fix this record\n');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

analyzeFeb10();
