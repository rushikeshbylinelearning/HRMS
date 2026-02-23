// Script to fix existing half-day records that were marked due to late arrival
// These should be changed to "Late" status instead of "Half-day"

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function fixLateArrivalHalfDays() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('FIX LATE ARRIVAL HALF-DAY RECORDS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Step 1: Find half-day records marked due to late arrival
        console.log('Step 1: Finding half-day records marked due to late arrival...\n');
        
        const lateArrivalHalfDays = await AttendanceLog.find({
            isHalfDay: true,
            halfDayReasonCode: 'LATE_LOGIN',
            attendanceStatus: 'Half-day'
        }).populate('user', 'fullName employeeCode').lean();
        
        console.log(`Found ${lateArrivalHalfDays.length} records marked as half-day due to late arrival\n`);
        
        if (lateArrivalHalfDays.length === 0) {
            console.log('✅ No records to fix. All half-days are due to insufficient hours.\n');
            return;
        }
        
        // Group by employee
        const byEmployee = {};
        lateArrivalHalfDays.forEach(log => {
            const empCode = log.user?.employeeCode || 'Unknown';
            const empName = log.user?.fullName || 'Unknown';
            const key = `${empName} (${empCode})`;
            
            if (!byEmployee[key]) {
                byEmployee[key] = {
                    employee: log.user,
                    records: []
                };
            }
            
            byEmployee[key].records.push({
                date: log.attendanceDate,
                hours: log.totalWorkingHours,
                lateMinutes: log.lateMinutes,
                logId: log._id
            });
        });
        
        console.log('Affected employees:\n');
        for (const [empKey, data] of Object.entries(byEmployee)) {
            console.log(`📊 ${empKey}`);
            console.log(`   Half-days due to late arrival: ${data.records.length}`);
            console.log(`   Dates: ${data.records.map(r => r.date).join(', ')}\n`);
        }
        
        // Step 2: Preview changes
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Step 2: Preview of changes...\n');
        
        console.log('Changes to be made:');
        console.log('  - isHalfDay: true → false');
        console.log('  - attendanceStatus: "Half-day" → "On-time"');
        console.log('  - halfDayReasonCode: "LATE_LOGIN" → null');
        console.log('  - halfDayReasonText: (cleared)');
        console.log('  - isLate: (kept as true)\n');
        
        console.log('Sample records:\n');
        lateArrivalHalfDays.slice(0, 5).forEach(log => {
            console.log(`  Date: ${log.attendanceDate}`);
            console.log(`  Employee: ${log.user?.fullName} (${log.user?.employeeCode})`);
            console.log(`  Hours: ${log.totalWorkingHours.toFixed(2)}`);
            console.log(`  Late Minutes: ${log.lateMinutes}`);
            console.log(`  Current Status: Half-day (LATE_LOGIN)`);
            console.log(`  New Status: On-time (Late)\n`);
        });
        
        // Step 3: Apply fixes
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Step 3: Applying fixes...\n');
        
        const result = await AttendanceLog.updateMany(
            {
                isHalfDay: true,
                halfDayReasonCode: 'LATE_LOGIN',
                attendanceStatus: 'Half-day'
            },
            {
                $set: {
                    isHalfDay: false,
                    attendanceStatus: 'On-time',
                    halfDayReasonCode: null,
                    halfDayReasonText: '',
                    halfDaySource: null
                }
                // Note: isLate remains true
            }
        );
        
        console.log(`✅ Updated ${result.modifiedCount} records\n`);
        
        // Step 4: Verify changes
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Step 4: Verifying changes...\n');
        
        const remainingLateArrivalHalfDays = await AttendanceLog.countDocuments({
            isHalfDay: true,
            halfDayReasonCode: 'LATE_LOGIN'
        });
        
        if (remainingLateArrivalHalfDays === 0) {
            console.log('✅ SUCCESS: All late arrival half-days have been fixed\n');
        } else {
            console.log(`⚠️  WARNING: ${remainingLateArrivalHalfDays} records still marked as half-day due to late arrival\n`);
        }
        
        // Step 5: Check remaining half-days
        const remainingHalfDays = await AttendanceLog.find({
            isHalfDay: true
        }).select('attendanceDate halfDayReasonCode totalWorkingHours').lean();
        
        console.log(`Remaining half-day records: ${remainingHalfDays.length}`);
        if (remainingHalfDays.length > 0) {
            const byReason = {};
            remainingHalfDays.forEach(log => {
                const reason = log.halfDayReasonCode || 'UNKNOWN';
                byReason[reason] = (byReason[reason] || 0) + 1;
            });
            
            console.log('\nBreakdown by reason:');
            for (const [reason, count] of Object.entries(byReason)) {
                console.log(`  - ${reason}: ${count} records`);
            }
            console.log('\nThese are legitimate half-days (insufficient working hours).\n');
        }
        
        // Step 6: Summary
        console.log('═══════════════════════════════════════════════════════════');
        console.log('SUMMARY');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Fixed Records:');
        console.log(`  Total: ${result.modifiedCount} records`);
        console.log(`  Affected Employees: ${Object.keys(byEmployee).length}\n`);
        
        console.log('Impact on Analytics:');
        console.log('  - These days will now count as "On-time" (with Late flag)');
        console.log('  - Present days count will remain the same');
        console.log('  - Total working hours will remain the same');
        console.log('  - Half-day penalty will no longer apply\n');
        
        console.log('Example: Employee RJ');
        const rjData = byEmployee['RJ (#BYL202505-E71)'];
        if (rjData) {
            console.log(`  Previous: 7 half-days due to late arrival`);
            console.log(`  Now: 7 on-time days (marked as late)`);
            console.log(`  Hours: No change (still ${rjData.records.reduce((sum, r) => sum + r.hours, 0).toFixed(2)} hours)`);
            console.log(`  Analytics: Will now show full hours without half-day penalty\n`);
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('FIX COMPLETE');
        console.log('═══════════════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

fixLateArrivalHalfDays();
