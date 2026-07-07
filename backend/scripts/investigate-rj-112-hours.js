// Deep Investigation: Employee RJ - 112 Hours Mystery
// Objective: Find exactly where 7 hours disappear (119 expected - 112 actual)

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');

async function investigateRJ() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        // Find RJ employee
        console.log('═══════════════════════════════════════════════════════════');
        console.log('SEARCHING FOR EMPLOYEE "RJ"');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const rjEmployee = await User.findOne({
            $or: [
                { fullName: /RJ/i },
                { employeeCode: /RJ/i },
                { fullName: /Radhika.*Joshi/i }
            ]
        }).lean();
        
        if (!rjEmployee) {
            console.log('❌ Employee "RJ" not found. Searching for similar names...\n');
            const similarEmployees = await User.find({
                fullName: /^R/i
            }).select('fullName employeeCode').limit(10).lean();
            
            console.log('Employees starting with "R":');
            similarEmployees.forEach(emp => {
                console.log(`  - ${emp.fullName} (${emp.employeeCode})`);
            });
            
            console.log('\n⚠️  Please provide exact employee name or code.\n');
            return;
        }
        
        console.log(`✅ Found Employee: ${rjEmployee.fullName} (${rjEmployee.employeeCode})\n`);
        
        // Get current month date range
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        console.log(`Date Range: ${startDateStr} to ${endDateStr}\n`);
        
        // STEP 1: Verify Raw Attendance Records
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 1: RAW ATTENDANCE RECORDS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const attendanceLogs = await AttendanceLog.find({
            user: rjEmployee._id,
            attendanceDate: { $gte: startDateStr, $lte: endDateStr },
            attendanceStatus: { $in: ['On-time', 'Late', 'Half-day'] }
        }).sort({ attendanceDate: 1 }).lean();
        
        console.log(`Total Present Days: ${attendanceLogs.length}\n`);
        
        if (attendanceLogs.length === 0) {
            console.log('❌ No attendance records found for this employee in the date range.\n');
            return;
        }
        
        console.log('Daily Breakdown:');
        console.log('┌────────────┬──────────────────────┬──────────────────────┬───────────┬──────────┬──────────┬──────────┐');
        console.log('│    Date    │     Clock In         │     Clock Out        │   Hours   │  Status  │ Half-Day │  Late    │');
        console.log('├────────────┼──────────────────────┼──────────────────────┼───────────┼──────────┼──────────┼──────────┤');
        
        let totalStoredHours = 0;
        let presentDays = 0;
        let halfDayCount = 0;
        let zeroHourDays = 0;
        
        const dailyDetails = [];
        
        for (const log of attendanceLogs) {
            const clockIn = log.clockInTime ? new Date(log.clockInTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';
            const clockOut = log.clockOutTime ? new Date(log.clockOutTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';
            const hours = log.totalWorkingHours || 0;
            const status = log.attendanceStatus || 'Unknown';
            const isHalfDay = log.isHalfDay ? 'Yes' : 'No';
            const isLate = log.isLate ? 'Yes' : 'No';
            
            totalStoredHours += hours;
            presentDays++;
            
            if (log.isHalfDay) halfDayCount++;
            if (hours === 0) zeroHourDays++;
            
            dailyDetails.push({
                date: log.attendanceDate,
                clockIn: log.clockInTime,
                clockOut: log.clockOutTime,
                hours: hours,
                status: status,
                isHalfDay: log.isHalfDay,
                isLate: log.isLate,
                logId: log._id
            });
            
            const hoursStr = hours.toFixed(2).padStart(9);
            const statusStr = status.padEnd(8);
            const halfDayStr = isHalfDay.padEnd(8);
            const lateStr = isLate.padEnd(8);
            
            console.log(`│ ${log.attendanceDate} │ ${clockIn.padEnd(20)} │ ${clockOut.padEnd(20)} │ ${hoursStr} │ ${statusStr} │ ${halfDayStr} │ ${lateStr} │`);
        }
        
        console.log('└────────────┴──────────────────────┴──────────────────────┴───────────┴──────────┴──────────┴──────────┘\n');
        
        console.log('Summary:');
        console.log(`  Total Present Days: ${presentDays}`);
        console.log(`  Half-Day Count: ${halfDayCount}`);
        console.log(`  Days with 0.00 hours: ${zeroHourDays}`);
        console.log(`  Total Stored Hours (SUM): ${totalStoredHours.toFixed(2)} hours`);
        console.log(`  Average Hours/Day: ${(totalStoredHours / presentDays).toFixed(2)} hours\n`);
        
        // STEP 2: Check Time Calculation Logic (Sample Day)
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 2: TIME CALCULATION LOGIC (SAMPLE DAY)');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Pick a day with non-zero hours
        const sampleLog = dailyDetails.find(d => d.hours > 0);
        
        if (sampleLog) {
            console.log(`Sample Day: ${sampleLog.date}\n`);
            
            // Get sessions and breaks for this day
            const sessions = await AttendanceSession.find({ 
                attendanceLog: sampleLog.logId 
            }).sort({ startTime: 1 }).lean();
            
            const breaks = await BreakLog.find({ 
                attendanceLog: sampleLog.logId 
            }).sort({ startTime: 1 }).lean();
            
            console.log('Sessions:');
            let totalSessionMinutes = 0;
            sessions.forEach((session, idx) => {
                if (session.endTime) {
                    const duration = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60);
                    totalSessionMinutes += duration;
                    console.log(`  Session ${idx + 1}: ${new Date(session.startTime).toLocaleTimeString('en-IN')} - ${new Date(session.endTime).toLocaleTimeString('en-IN')} = ${duration.toFixed(2)} minutes`);
                } else {
                    console.log(`  Session ${idx + 1}: ${new Date(session.startTime).toLocaleTimeString('en-IN')} - (No end time)`);
                }
            });
            console.log(`  Total Session Time: ${totalSessionMinutes.toFixed(2)} minutes (${(totalSessionMinutes / 60).toFixed(2)} hours)\n`);
            
            console.log('Breaks:');
            let totalBreakMinutes = 0;
            breaks.forEach((breakLog, idx) => {
                if (breakLog.endTime) {
                    const duration = (new Date(breakLog.endTime) - new Date(breakLog.startTime)) / (1000 * 60);
                    totalBreakMinutes += duration;
                    console.log(`  Break ${idx + 1}: ${new Date(breakLog.startTime).toLocaleTimeString('en-IN')} - ${new Date(breakLog.endTime).toLocaleTimeString('en-IN')} = ${duration.toFixed(2)} minutes (${breakLog.breakType || 'Unknown'})`);
                } else {
                    console.log(`  Break ${idx + 1}: ${new Date(breakLog.startTime).toLocaleTimeString('en-IN')} - (No end time)`);
                }
            });
            console.log(`  Total Break Time: ${totalBreakMinutes.toFixed(2)} minutes (${(totalBreakMinutes / 60).toFixed(2)} hours)\n`);
            
            const netWorkingMinutes = Math.max(0, totalSessionMinutes - totalBreakMinutes);
            const calculatedHours = netWorkingMinutes / 60;
            
            console.log('Calculation:');
            console.log(`  Formula: (Session Time - Break Time) / 60`);
            console.log(`  Net Working Minutes: ${netWorkingMinutes.toFixed(2)} minutes`);
            console.log(`  Calculated Hours: ${calculatedHours.toFixed(2)} hours`);
            console.log(`  Stored Hours: ${sampleLog.hours.toFixed(2)} hours`);
            console.log(`  Match: ${Math.abs(calculatedHours - sampleLog.hours) < 0.01 ? '✅ YES' : '❌ NO'}\n`);
        }
        
        // STEP 3: Check Decimal Conversion Logic
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 3: DECIMAL CONVERSION LOGIC');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Checking for 8:30 → 8.30 bug:\n');
        
        const hoursAround8_5 = dailyDetails.filter(d => d.hours >= 8.0 && d.hours <= 8.6);
        
        if (hoursAround8_5.length > 0) {
            console.log('Days with hours between 8.0 and 8.6:');
            hoursAround8_5.forEach(d => {
                const diff = (d.hours - 8.5).toFixed(2);
                const diffStr = diff >= 0 ? `+${diff}` : diff;
                console.log(`  ${d.date}: ${d.hours.toFixed(2)} hours (${diffStr} from 8.5)`);
            });
            
            const avgHours = hoursAround8_5.reduce((sum, d) => sum + d.hours, 0) / hoursAround8_5.length;
            console.log(`\n  Average: ${avgHours.toFixed(2)} hours`);
            
            if (Math.abs(avgHours - 8.3) < 0.1) {
                console.log('  🚨 DECIMAL BUG DETECTED: Average ≈ 8.3 (should be 8.5)');
            } else if (Math.abs(avgHours - 8.5) < 0.1) {
                console.log('  ✅ Decimal conversion appears correct (average ≈ 8.5)');
            } else {
                console.log(`  ⚠️  Average is ${avgHours.toFixed(2)}, neither 8.3 nor 8.5`);
            }
        }
        console.log();
        
        // STEP 4: Check Aggregation Logic
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 4: AGGREGATION LOGIC');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Method: SUM(totalWorkingHours) from AttendanceLog\n');
        
        // Manual sum
        const manualSum = dailyDetails.reduce((sum, d) => sum + d.hours, 0);
        console.log(`Manual Sum (JavaScript): ${manualSum.toFixed(2)} hours`);
        
        // Database aggregation
        const dbAggregation = await AttendanceLog.aggregate([
            {
                $match: {
                    user: rjEmployee._id,
                    attendanceDate: { $gte: startDateStr, $lte: endDateStr },
                    attendanceStatus: { $in: ['On-time', 'Late', 'Half-day'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalHours: { $sum: '$totalWorkingHours' },
                    count: { $sum: 1 }
                }
            }
        ]);
        
        const dbSum = dbAggregation.length > 0 ? dbAggregation[0].totalHours : 0;
        console.log(`Database Aggregation: ${dbSum.toFixed(2)} hours`);
        console.log(`Match: ${Math.abs(manualSum - dbSum) < 0.01 ? '✅ YES' : '❌ NO'}\n`);
        
        // STEP 5: Check Rounding Stage
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 5: ROUNDING ANALYSIS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Per-Day Rounding Check:');
        dailyDetails.forEach(d => {
            const rounded = Math.round(d.hours * 100) / 100;
            const floored = Math.floor(d.hours * 100) / 100;
            console.log(`  ${d.date}: Raw=${d.hours.toFixed(4)}, Rounded=${rounded.toFixed(2)}, Floored=${floored.toFixed(2)}`);
        });
        
        const sumOfRounded = dailyDetails.reduce((sum, d) => sum + Math.round(d.hours * 100) / 100, 0);
        const roundedSum = Math.round(manualSum * 100) / 100;
        
        console.log(`\nSum of Rounded Values: ${sumOfRounded.toFixed(2)} hours`);
        console.log(`Rounded Sum: ${roundedSum.toFixed(2)} hours`);
        console.log(`Difference: ${(sumOfRounded - roundedSum).toFixed(4)} hours\n`);
        
        // STEP 6: Check Hidden Deductions
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 6: HIDDEN DEDUCTIONS CHECK');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Checking for deductions in attendance logs:\n');
        
        let totalPenaltyMinutes = 0;
        let totalLateMinutes = 0;
        let adminOverrides = 0;
        
        dailyDetails.forEach(d => {
            const log = attendanceLogs.find(l => l.attendanceDate === d.date);
            if (log) {
                if (log.penaltyMinutes) totalPenaltyMinutes += log.penaltyMinutes;
                if (log.lateMinutes) totalLateMinutes += log.lateMinutes;
                if (log.adminOverride && log.adminOverride !== 'None') adminOverrides++;
            }
        });
        
        console.log(`  Total Penalty Minutes: ${totalPenaltyMinutes} minutes (${(totalPenaltyMinutes / 60).toFixed(2)} hours)`);
        console.log(`  Total Late Minutes: ${totalLateMinutes} minutes (${(totalLateMinutes / 60).toFixed(2)} hours)`);
        console.log(`  Admin Overrides: ${adminOverrides} days`);
        console.log(`  Note: Penalty/Late minutes are tracked but NOT deducted from totalWorkingHours\n`);
        
        // STEP 7: Compare Two Totals
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 7: COMPARE TOTALS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const A = manualSum; // Sum of raw stored totalWorkingHours
        const B = 112; // Value shown in Admin Summary (from user report)
        
        console.log(`A = Sum of raw stored totalWorkingHours: ${A.toFixed(2)} hours`);
        console.log(`B = Value shown in Admin Summary: ${B.toFixed(2)} hours`);
        console.log(`Difference (A - B): ${(A - B).toFixed(2)} hours`);
        
        if (Math.abs(A - B) < 0.01) {
            console.log(`✅ Values match! The 112 hours is correctly calculated from stored data.\n`);
        } else if (Math.abs(A - 112) < 1) {
            console.log(`⚠️  Close match. Difference likely due to rounding in UI.\n`);
        } else {
            console.log(`❌ Significant difference! Admin Summary may be using different calculation.\n`);
        }
        
        // STEP 8: Check Data Type Issues
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 8: DATA TYPE VALIDATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Checking data types:\n');
        
        const sampleLogForType = attendanceLogs[0];
        console.log(`  totalWorkingHours type: ${typeof sampleLogForType.totalWorkingHours}`);
        console.log(`  totalWorkingHours value: ${sampleLogForType.totalWorkingHours}`);
        console.log(`  Is Number: ${typeof sampleLogForType.totalWorkingHours === 'number' ? '✅ YES' : '❌ NO'}\n`);
        
        // STEP 9: Validate Date Range
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 9: DATE RANGE VALIDATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log(`  Start Date: ${startDateStr}`);
        console.log(`  End Date: ${endDateStr}`);
        console.log(`  Records Found: ${attendanceLogs.length}`);
        console.log(`  Expected Working Days: ~14-22 (depending on month)`);
        console.log(`  Status: ${attendanceLogs.length >= 10 ? '✅ Reasonable' : '⚠️  Low count'}\n`);
        
        // STEP 10: Final Debug Output
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 10: FINAL DEBUG OUTPUT');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const expectedHours = presentDays * 8.5;
        const actualHours = manualSum;
        const difference = actualHours - expectedHours;
        const percentDiff = (difference / expectedHours) * 100;
        
        console.log('📊 FINAL SUMMARY:\n');
        console.log(`  Employee: ${rjEmployee.fullName} (${rjEmployee.employeeCode})`);
        console.log(`  Date Range: ${startDateStr} to ${endDateStr}`);
        console.log(`  Total Present Days: ${presentDays}`);
        console.log(`  Half-Day Count: ${halfDayCount}`);
        console.log(`  Days with 0.00 hours: ${zeroHourDays}\n`);
        
        console.log(`  Expected Hours (${presentDays} × 8.5): ${expectedHours.toFixed(2)} hours`);
        console.log(`  Actual Summed Hours: ${actualHours.toFixed(2)} hours`);
        console.log(`  Difference: ${difference.toFixed(2)} hours (${percentDiff.toFixed(1)}%)`);
        console.log(`  Per-Day Average: ${(actualHours / presentDays).toFixed(2)} hours\n`);
        
        console.log('🔍 ROOT CAUSE ANALYSIS:\n');
        
        if (zeroHourDays > 0) {
            console.log(`  ⚠️  ISSUE DETECTED: ${zeroHourDays} days with 0.00 hours`);
            console.log(`     Impact: -${(zeroHourDays * 8.5).toFixed(2)} hours`);
            console.log(`     Likely cause: Incomplete clock-out or data corruption\n`);
        }
        
        if (halfDayCount > 0) {
            const halfDayHours = dailyDetails.filter(d => d.isHalfDay).reduce((sum, d) => sum + d.hours, 0);
            const halfDayExpected = halfDayCount * 8.5;
            const halfDayGap = halfDayHours - halfDayExpected;
            console.log(`  ⚠️  HALF-DAYS DETECTED: ${halfDayCount} days`);
            console.log(`     Total hours on half-days: ${halfDayHours.toFixed(2)} hours`);
            console.log(`     Expected (if full days): ${halfDayExpected.toFixed(2)} hours`);
            console.log(`     Gap: ${halfDayGap.toFixed(2)} hours\n`);
        }
        
        const normalDays = dailyDetails.filter(d => !d.isHalfDay && d.hours > 0);
        if (normalDays.length > 0) {
            const normalDaysAvg = normalDays.reduce((sum, d) => sum + d.hours, 0) / normalDays.length;
            console.log(`  ℹ️  NORMAL DAYS: ${normalDays.length} days`);
            console.log(`     Average hours: ${normalDaysAvg.toFixed(2)} hours`);
            console.log(`     Status: ${Math.abs(normalDaysAvg - 8.5) < 0.1 ? '✅ Close to 8.5' : '⚠️  Below 8.5'}\n`);
        }
        
        console.log('💡 CONCLUSION:\n');
        
        if (Math.abs(actualHours - 112) < 1) {
            console.log('  The 112 hours shown in Admin Summary matches the stored data.');
            console.log('  The gap from expected 119 hours is due to:');
            if (zeroHourDays > 0) console.log(`    - ${zeroHourDays} days with 0.00 hours (data quality issue)`);
            if (halfDayCount > 0) console.log(`    - ${halfDayCount} half-days with reduced hours`);
            if (normalDays.length > 0 && normalDays.reduce((sum, d) => sum + d.hours, 0) / normalDays.length < 8.4) {
                console.log(`    - Normal days averaging below 8.5 hours`);
            }
        } else {
            console.log('  ⚠️  Mismatch detected between stored data and Admin Summary.');
            console.log('  Further investigation needed in Admin Summary calculation logic.');
        }
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('INVESTIGATION COMPLETE');
        console.log('═══════════════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

investigateRJ();
