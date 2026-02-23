// Verification script to confirm half-day policy fix is complete

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function verifyHalfDayPolicyFix() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('HALF-DAY POLICY FIX VERIFICATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        let allChecksPassed = true;
        
        // Check 1: Policy Configuration
        console.log('Check 1: Policy Configuration\n');
        
        const usersWithPolicyEnabled = await User.countDocuments({
            'featurePermissions.lateArrivalMarksHalfDay': true
        });
        
        if (usersWithPolicyEnabled === 0) {
            console.log('✅ PASS: No users have lateArrivalMarksHalfDay enabled');
        } else {
            console.log(`❌ FAIL: ${usersWithPolicyEnabled} users still have policy enabled`);
            allChecksPassed = false;
        }
        console.log();
        
        // Check 2: Late Arrival Half-Days
        console.log('Check 2: Late Arrival Half-Days\n');
        
        const lateArrivalHalfDays = await AttendanceLog.countDocuments({
            isHalfDay: true,
            halfDayReasonCode: 'LATE_LOGIN'
        });
        
        if (lateArrivalHalfDays === 0) {
            console.log('✅ PASS: No half-days with LATE_LOGIN reason code');
        } else {
            console.log(`❌ FAIL: ${lateArrivalHalfDays} half-days still marked as LATE_LOGIN`);
            allChecksPassed = false;
        }
        console.log();
        
        // Check 3: Unknown Half-Days with Full Hours
        console.log('Check 3: Unknown Half-Days with Full Hours (Recent)\n');
        
        const unknownHalfDaysWithFullHours = await AttendanceLog.countDocuments({
            isHalfDay: true,
            $or: [
                { halfDayReasonCode: 'UNKNOWN' },
                { halfDayReasonCode: null }
            ],
            totalWorkingHours: { $gte: 8.5 },
            attendanceDate: { $gte: '2026-01-01' }
        });
        
        if (unknownHalfDaysWithFullHours === 0) {
            console.log('✅ PASS: No recent half-days with UNKNOWN reason and >= 8.5 hours');
        } else {
            console.log(`❌ FAIL: ${unknownHalfDaysWithFullHours} problematic half-days still exist`);
            allChecksPassed = false;
        }
        console.log();
        
        // Check 4: RJ's Half-Days
        console.log('Check 4: Employee RJ Half-Days\n');
        
        const rj = await User.findOne({ employeeCode: 'BYL202505-E71' }).lean();
        if (rj) {
            const rjHalfDays = await AttendanceLog.find({
                user: rj._id,
                isHalfDay: true,
                attendanceDate: { $gte: '2026-02-01', $lte: '2026-02-28' }
            }).select('attendanceDate halfDayReasonCode totalWorkingHours').lean();
            
            console.log(`RJ's half-days in February: ${rjHalfDays.length}`);
            
            if (rjHalfDays.length <= 2) {
                console.log('✅ PASS: RJ has 2 or fewer half-days (expected: 2 legitimate)');
                if (rjHalfDays.length > 0) {
                    console.log('\nRemaining half-days:');
                    rjHalfDays.forEach(log => {
                        console.log(`  - ${log.attendanceDate}: ${log.totalWorkingHours.toFixed(2)} hrs (${log.halfDayReasonCode || 'UNKNOWN'})`);
                    });
                }
            } else {
                console.log(`❌ FAIL: RJ has ${rjHalfDays.length} half-days (expected: 2)`);
                allChecksPassed = false;
            }
        } else {
            console.log('⚠️  WARNING: Employee RJ not found');
        }
        console.log();
        
        // Check 5: Remaining Half-Days Breakdown
        console.log('Check 5: Remaining Half-Days Breakdown\n');
        
        const allHalfDays = await AttendanceLog.find({
            isHalfDay: true,
            attendanceDate: { $gte: '2026-01-01' }
        }).select('halfDayReasonCode totalWorkingHours').lean();
        
        const byReason = {};
        allHalfDays.forEach(log => {
            const reason = log.halfDayReasonCode || 'UNKNOWN';
            if (!byReason[reason]) {
                byReason[reason] = { count: 0, totalHours: 0 };
            }
            byReason[reason].count++;
            byReason[reason].totalHours += log.totalWorkingHours;
        });
        
        console.log('Half-days by reason (2026 onwards):');
        for (const [reason, data] of Object.entries(byReason)) {
            const avgHours = data.totalHours / data.count;
            console.log(`  ${reason}: ${data.count} records (avg ${avgHours.toFixed(2)} hrs)`);
        }
        
        // Validate that no LATE_LOGIN or problematic UNKNOWN exist
        if (!byReason['LATE_LOGIN']) {
            console.log('\n✅ PASS: No LATE_LOGIN half-days found');
        } else {
            console.log(`\n❌ FAIL: ${byReason['LATE_LOGIN'].count} LATE_LOGIN half-days still exist`);
            allChecksPassed = false;
        }
        
        if (byReason['UNKNOWN']) {
            const unknownWithFullHours = allHalfDays.filter(
                log => (!log.halfDayReasonCode || log.halfDayReasonCode === 'UNKNOWN') && log.totalWorkingHours >= 8.5
            ).length;
            
            if (unknownWithFullHours === 0) {
                console.log(`✅ PASS: ${byReason['UNKNOWN'].count} UNKNOWN half-days exist, but all have < 8.5 hours (legitimate)`);
            } else {
                console.log(`❌ FAIL: ${unknownWithFullHours} UNKNOWN half-days with >= 8.5 hours still exist`);
                allChecksPassed = false;
            }
        }
        console.log();
        
        // Final Summary
        console.log('═══════════════════════════════════════════════════════════');
        console.log('VERIFICATION SUMMARY');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        if (allChecksPassed) {
            console.log('✅ ALL CHECKS PASSED');
            console.log('\nHalf-day policy fix is complete and verified.');
            console.log('Employees will no longer be marked as half-day due to late arrival.\n');
        } else {
            console.log('❌ SOME CHECKS FAILED');
            console.log('\nPlease review the failed checks above and run the fix scripts again.\n');
        }
        
        console.log('═══════════════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

verifyHalfDayPolicyFix();
