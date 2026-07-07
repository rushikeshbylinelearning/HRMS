// Check RJ's half-day records to understand why they're marked as half-day

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function checkRJHalfDays() {
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
                { employeeCode: /RJ/i },
                { employeeCode: 'BYL202505-E71' }
            ]
        }).lean();
        
        if (!rj) {
            console.log('❌ Employee RJ not found\n');
            return;
        }
        
        console.log(`Found: ${rj.fullName} (${rj.employeeCode})\n`);
        
        // Get all half-day records for RJ
        const halfDays = await AttendanceLog.find({
            user: rj._id,
            isHalfDay: true
        }).sort({ attendanceDate: 1 }).lean();
        
        console.log(`Total half-day records: ${halfDays.length}\n`);
        
        if (halfDays.length === 0) {
            console.log('✅ No half-day records found for RJ\n');
            return;
        }
        
        console.log('Half-Day Records:\n');
        console.log('┌────────────┬───────────┬──────────────────────────┬─────────────┬──────────┐');
        console.log('│    Date    │   Hours   │    Reason Code           │ Reason Text │ Is Late  │');
        console.log('├────────────┼───────────┼──────────────────────────┼─────────────┼──────────┤');
        
        halfDays.forEach(log => {
            const date = log.attendanceDate;
            const hours = log.totalWorkingHours.toFixed(2).padStart(9);
            const reasonCode = (log.halfDayReasonCode || 'UNKNOWN').padEnd(24);
            const reasonText = (log.halfDayReasonText || 'N/A').substring(0, 30);
            const isLate = log.isLate ? 'Yes' : 'No';
            
            console.log(`│ ${date} │ ${hours} │ ${reasonCode} │ ${reasonText.padEnd(11)} │ ${isLate.padEnd(8)} │`);
        });
        
        console.log('└────────────┴───────────┴──────────────────────────┴─────────────┴──────────┘\n');
        
        // Breakdown by reason
        const byReason = {};
        halfDays.forEach(log => {
            const reason = log.halfDayReasonCode || 'UNKNOWN';
            if (!byReason[reason]) {
                byReason[reason] = [];
            }
            byReason[reason].push({
                date: log.attendanceDate,
                hours: log.totalWorkingHours,
                reasonText: log.halfDayReasonText
            });
        });
        
        console.log('Breakdown by Reason:\n');
        for (const [reason, records] of Object.entries(byReason)) {
            console.log(`${reason}: ${records.length} days`);
            records.forEach(r => {
                console.log(`  - ${r.date}: ${r.hours.toFixed(2)} hours`);
                if (r.reasonText) {
                    console.log(`    Reason: ${r.reasonText}`);
                }
            });
            console.log();
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

checkRJHalfDays();
