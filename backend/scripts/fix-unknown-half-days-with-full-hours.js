// Fix half-day records marked as UNKNOWN that have full working hours (>= 8.5)
// These should be marked as On-time, not Half-day

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function fixUnknownHalfDaysWithFullHours() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('FIX UNKNOWN HALF-DAYS WITH FULL WORKING HOURS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Step 1: Find half-day records with UNKNOWN reason and >= 8.5 hours
        console.log('Step 1: Finding problematic half-day records...\n');
        
        const problematicHalfDays = await AttendanceLog.find({
            isHalfDay: true,
            $or: [
                { halfDayReasonCode: 'UNKNOWN' },
                { halfDayReasonCode: null },
                { halfDayReasonCode: { $exists: false } }
            ],
            totalWorkingHours: { $gte: 8.5 },
            attendanceDate: { $gte: '2026-01-01' } // Only fix recent records
        }).populate('user', 'fullName employeeCode').lean();
        
        console.log(`Found ${problematicHalfDays.length} records with UNKNOWN reason and >= 8.5 hours\n`);
        
        if (problematicHalfDays.length === 0) {
            console.log('✅ No problematic records found.\n');
            return;
        }
        
        // Group by employee
        const byEmployee = {};
        problematicHalfDays.forEach(log => {
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
                isLate: log.isLate,
                lateMinutes: log.lateMinutes,
                logId: log._id
            });
        });
        
        console.log('Affected employees:\n');
        for (const [empKey, data] of Object.entries(byEmployee)) {
            console.log(`📊 ${empKey}`);
            console.log(`   Problematic half-days: ${data.records.length}`);
            console.log(`   Dates: ${data.records.map(r => r.date).join(', ')}`);
            console.log(`   Average hours: ${(data.records.reduce((sum, r) => sum + r.hours, 0) / data.records.length).toFixed(2)}\n`);
        }
        
        // Step 2: Preview changes
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Step 2: Preview of changes...\n');
        
        console.log('Changes to be made:');
        console.log('  - isHalfDay: true → false');
        console.log('  - attendanceStatus: "Half-day" → "On-time"');
        console.log('  - halfDayReasonCode: UNKNOWN → null');
        console.log('  - halfDayReasonText: (cleared)');
        console.log('  - halfDaySource: (cleared)');
        console.log('  - isLate: (kept as is)\n');
        
        console.log('Sample records:\n');
        problematicHalfDays.slice(0, 10).forEach(log => {
            console.log(`  Date: ${log.attendanceDate}`);
            console.log(`  Employee: ${log.user?.fullName} (${log.user?.employeeCode})`);
            console.log(`  Hours: ${log.totalWorkingHours.toFixed(2)}`);
            console.log(`  Late: ${log.isLate ? 'Yes' : 'No'} (${log.lateMinutes || 0} minutes)`);
            console.log(`  Current Status: Half-day (UNKNOWN)`);
            console.log(`  New Status: On-time${log.isLate ? ' (Late)' : ''}\n`);
        });
        
        // Step 3: Apply fixes
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Step 3: Applying fixes...\n');
        
        const result = await AttendanceLog.updateMany(
            {
                isHalfDay: true,
                $or: [
                    { halfDayReasonCode: 'UNKNOWN' },
                    { halfDayReasonCode: null },
                    { halfDayReasonCode: { $exists: false } }
                ],
                totalWorkingHours: { $gte: 8.5 },
                attendanceDate: { $gte: '2026-01-01' }
            },
            {
                $set: {
                    isHalfDay: false,
                    attendanceStatus: 'On-time',
                    halfDayReasonCode: null,
                    halfDayReasonText: '',
                    halfDaySource: null
                }
                // Note: isLate remains as is
            }
        );
        
        console.log(`✅ Updated ${result.modifiedCount} records\n`);
        
        // Step 4: Verify changes
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Step 4: Verifying changes...\n');
        
        const remainingProblematic = await AttendanceLog.countDocuments({
            isHalfDay: true,
            $or: [
                { halfDayReasonCode: 'UNKNOWN' },
                { halfDayReasonCode: null }
            ],
            totalWorkingHours: { $gte: 8.5 },
            attendanceDate: { $gte: '2026-01-01' }
        });
        
        if (remainingProblematic === 0) {
            console.log('✅ SUCCESS: All problematic half-days have been fixed\n');
        } else {
            console.log(`⚠️  WARNING: ${remainingProblematic} problematic records still remain\n`);
        }
        
        // Step 5: Check specific employee (RJ)
        const rj = await User.findOne({ employeeCode: 'BYL202505-E71' }).lean();
        if (rj) {
            const rjHalfDays = await AttendanceLog.find({
                user: rj._id,
                isHalfDay: true,
                attendanceDate: { $gte: '2026-02-01', $lte: '2026-02-28' }
            }).lean();
            
            console.log(`RJ's remaining half-days in February: ${rjHalfDays.length}`);
            if (rjHalfDays.length > 0) {
                console.log('Dates:', rjHalfDays.map(l => l.attendanceDate).join(', '));
            }
            console.log();
        }
        
        // Step 6: Summary
        console.log('═══════════════════════════════════════════════════════════');
        console.log('SUMMARY');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Fixed Records:');
        console.log(`  Total: ${result.modifiedCount} records`);
        console.log(`  Affected Employees: ${Object.keys(byEmployee).length}\n`);
        
        console.log('Impact:');
        console.log('  - These days now count as "On-time" (not Half-day)');
        console.log('  - Present days count remains the same');
        console.log('  - Total working hours remain the same');
        console.log('  - No half-day penalty will apply in analytics\n');
        
        console.log('Example: Employee RJ');
        const rjData = byEmployee['RJ (#BYL202505-E71)'];
        if (rjData) {
            console.log(`  Fixed: ${rjData.records.length} half-days`);
            console.log(`  Dates: ${rjData.records.map(r => r.date).join(', ')}`);
            console.log(`  Total hours: ${rjData.records.reduce((sum, r) => sum + r.hours, 0).toFixed(2)} hours`);
            console.log(`  Status: Now marked as On-time (not Half-day)\n`);
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

fixUnknownHalfDaysWithFullHours();
