// Fix half-day records that have >= 9 hours elapsed shift time
// These should be marked as On-time/Late, not Half-day

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function fixIncorrectHalfDays() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('FIX INCORRECT HALF-DAYS WITH >= 9 HOURS ELAPSED');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Find all half-day records with clock-in and clock-out
        const halfDayLogs = await AttendanceLog.find({
            isHalfDay: true,
            clockInTime: { $exists: true, $ne: null },
            clockOutTime: { $exists: true, $ne: null },
            attendanceDate: { $gte: '2026-01-01' }
        }).populate('user', 'fullName employeeCode').lean();
        
        console.log(`Found ${halfDayLogs.length} half-day records with clock times\n`);
        
        // Check each record for elapsed time
        const incorrectRecords = [];
        
        for (const log of halfDayLogs) {
            const clockIn = new Date(log.clockInTime);
            const clockOut = new Date(log.clockOutTime);
            const elapsedMinutes = (clockOut - clockIn) / (1000 * 60);
            const elapsedHours = elapsedMinutes / 60;
            
            // If elapsed time >= 9 hours, it should NOT be half-day
            if (elapsedHours >= 9) {
                incorrectRecords.push({
                    logId: log._id,
                    user: log.user,
                    date: log.attendanceDate,
                    clockIn: log.clockInTime,
                    clockOut: log.clockOutTime,
                    elapsedHours: elapsedHours,
                    workingHours: log.totalWorkingHours,
                    isLate: log.isLate,
                    reason: log.halfDayReasonCode
                });
            }
        }
        
        console.log(`Found ${incorrectRecords.length} INCORRECT half-day records (elapsed >= 9 hours)\n`);
        
        if (incorrectRecords.length === 0) {
            console.log('✅ No incorrect half-day records found\n');
            return;
        }
        
        // Group by employee
        const byEmployee = {};
        incorrectRecords.forEach(rec => {
            const empCode = rec.user?.employeeCode || 'Unknown';
            const empName = rec.user?.fullName || 'Unknown';
            const key = `${empName} (${empCode})`;
            
            if (!byEmployee[key]) {
                byEmployee[key] = [];
            }
            
            byEmployee[key].push(rec);
        });
        
        console.log('Affected Employees:\n');
        for (const [empKey, records] of Object.entries(byEmployee)) {
            console.log(`📊 ${empKey}: ${records.length} records`);
            records.forEach(rec => {
                console.log(`   ${rec.date}: ${rec.elapsedHours.toFixed(2)} hrs elapsed, ${rec.workingHours.toFixed(2)} hrs worked`);
            });
            console.log();
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('PREVIEW OF CHANGES');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Changes to be made:');
        console.log('  - isHalfDay: true → false');
        console.log('  - attendanceStatus: "Half-day" → "On-time"');
        console.log('  - halfDayReasonCode: (cleared)');
        console.log('  - halfDayReasonText: (cleared)');
        console.log('  - halfDaySource: (cleared)');
        console.log('  - isLate: (kept as is)\n');
        
        console.log('Sample Records:\n');
        incorrectRecords.slice(0, 5).forEach(rec => {
            console.log(`  ${rec.date} - ${rec.user?.fullName} (${rec.user?.employeeCode})`);
            console.log(`    Elapsed: ${rec.elapsedHours.toFixed(2)} hours (>= 9 hours required)`);
            console.log(`    Working: ${rec.workingHours.toFixed(2)} hours`);
            console.log(`    Current: Half-day`);
            console.log(`    New: On-time${rec.isLate ? ' (Late)' : ''}\n`);
        });
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('APPLYING FIXES');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Fix each record
        let fixedCount = 0;
        for (const rec of incorrectRecords) {
            await AttendanceLog.updateOne(
                { _id: rec.logId },
                {
                    $set: {
                        isHalfDay: false,
                        attendanceStatus: 'On-time',
                        halfDayReasonCode: null,
                        halfDayReasonText: '',
                        halfDaySource: null
                    }
                }
            );
            fixedCount++;
        }
        
        console.log(`✅ Fixed ${fixedCount} records\n`);
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('VERIFICATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Verify the fixes
        const remainingIncorrect = await AttendanceLog.countDocuments({
            isHalfDay: true,
            clockInTime: { $exists: true, $ne: null },
            clockOutTime: { $exists: true, $ne: null },
            attendanceDate: { $gte: '2026-01-01' },
            $expr: {
                $gte: [
                    { $divide: [{ $subtract: ['$clockOutTime', '$clockInTime'] }, 1000 * 60 * 60] },
                    9
                ]
            }
        });
        
        if (remainingIncorrect === 0) {
            console.log('✅ SUCCESS: All incorrect half-days have been fixed\n');
        } else {
            console.log(`⚠️  WARNING: ${remainingIncorrect} incorrect records still remain\n`);
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('SUMMARY');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log(`Fixed Records: ${fixedCount}`);
        console.log(`Affected Employees: ${Object.keys(byEmployee).length}\n`);
        
        console.log('Impact:');
        console.log('  - These days now count as "On-time" (not Half-day)');
        console.log('  - Present days count remains the same');
        console.log('  - Total working hours remain the same');
        console.log('  - Analytics will now show correct data\n');
        
        console.log('Example: Employee RJ (if affected)');
        const rjRecords = incorrectRecords.filter(r => r.user?.employeeCode === '#BYL202505-E71');
        if (rjRecords.length > 0) {
            console.log(`  Fixed: ${rjRecords.length} records`);
            console.log(`  Dates: ${rjRecords.map(r => r.date).join(', ')}`);
            console.log(`  These days are now marked as On-time (not Half-day)\n`);
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

fixIncorrectHalfDays();
