// Investigation script for Net Working Hours Mismatch
// Objective: Understand why 14 days × 8.5 hours ≠ actual stored hours

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const Shift = require('../models/Shift');

async function investigateNetHoursMismatch() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        // STEP 1: Check Mandatory Daily Hours Configuration
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 1: MANDATORY DAILY HOURS CONFIGURATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const shiftPolicy = require('../config/shiftPolicy');
        console.log('From shiftPolicy.js:');
        console.log(`  SHIFT_WORKING_MINUTES: ${shiftPolicy.SHIFT_WORKING_MINUTES} minutes`);
        console.log(`  MINIMUM_WORKING_HOURS: ${shiftPolicy.MINIMUM_WORKING_HOURS} hours`);
        console.log(`  Decimal equivalent: ${shiftPolicy.SHIFT_WORKING_MINUTES / 60} hours`);
        console.log(`  Expected format: 8 hours 30 minutes = 8.5 hours\n`);
        
        // Check if 8:30 is being misinterpreted as 8.30
        const correctDecimal = 8 + (30/60); // 8.5
        const incorrectDecimal = 8.30; // Wrong interpretation
        console.log('Decimal Conversion Check:');
        console.log(`  ✅ Correct: 8:30 → ${correctDecimal} hours`);
        console.log(`  ❌ Incorrect: 8:30 → ${incorrectDecimal} hours`);
        console.log(`  Difference per day: ${(correctDecimal - incorrectDecimal).toFixed(2)} hours`);
        console.log(`  Difference over 14 days: ${((correctDecimal - incorrectDecimal) * 14).toFixed(2)} hours\n`);
        
        // STEP 2: Find sample employee with 14 present days
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 2: SAMPLE EMPLOYEE DATA (14 PRESENT DAYS)');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Get date range for current month
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        console.log(`Date Range: ${startDateStr} to ${endDateStr}\n`);
        
        // Find employees with attendance logs
        const employeesWithLogs = await AttendanceLog.aggregate([
            {
                $match: {
                    attendanceDate: { $gte: startDateStr, $lte: endDateStr },
                    attendanceStatus: { $in: ['On-time', 'Late', 'Half-day'] }
                }
            },
            {
                $group: {
                    _id: '$user',
                    presentDays: { $sum: 1 },
                    totalHours: { $sum: '$totalWorkingHours' },
                    avgHours: { $avg: '$totalWorkingHours' },
                    logs: { $push: { date: '$attendanceDate', hours: '$totalWorkingHours', status: '$attendanceStatus' } }
                }
            },
            {
                $match: {
                    presentDays: { $gte: 10 } // At least 10 days for analysis
                }
            },
            { $sort: { presentDays: -1 } },
            { $limit: 5 }
        ]);
        
        if (employeesWithLogs.length === 0) {
            console.log('❌ No employees found with sufficient attendance data\n');
            return;
        }
        
        // Analyze each employee
        for (const empData of employeesWithLogs) {
            const user = await User.findById(empData._id).select('fullName employeeCode').lean();
            if (!user) continue;
            
            console.log(`\n📊 Employee: ${user.fullName} (${user.employeeCode})`);
            console.log(`   Present Days: ${empData.presentDays}`);
            console.log(`   Total Hours Stored: ${empData.totalHours.toFixed(2)} hours`);
            console.log(`   Average Hours/Day: ${empData.avgHours.toFixed(2)} hours`);
            console.log(`   Expected (8.5 × ${empData.presentDays}): ${(8.5 * empData.presentDays).toFixed(2)} hours`);
            console.log(`   Difference: ${(empData.totalHours - (8.5 * empData.presentDays)).toFixed(2)} hours`);
            console.log(`   Gap per day: ${((empData.totalHours / empData.presentDays) - 8.5).toFixed(2)} hours\n`);
            
            // Daily breakdown
            console.log('   Daily Breakdown:');
            console.log('   ┌────────────┬───────────┬──────────┬────────────┐');
            console.log('   │    Date    │   Hours   │  Status  │ Expected   │');
            console.log('   ├────────────┼───────────┼──────────┼────────────┤');
            
            empData.logs.sort((a, b) => a.date.localeCompare(b.date));
            empData.logs.forEach(log => {
                const diff = (log.hours - 8.5).toFixed(2);
                const diffStr = diff >= 0 ? `+${diff}` : diff;
                console.log(`   │ ${log.date} │ ${log.hours.toFixed(2).padStart(9)} │ ${log.status.padEnd(8)} │ 8.5 (${diffStr}) │`);
            });
            console.log('   └────────────┴───────────┴──────────┴────────────┘\n');
        }
        
        // STEP 3: Check Calculation Logic
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 3: TOTAL CALCULATION LOGIC ANALYSIS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('System Calculation Method:');
        console.log('  Formula: totalNetHours = SUM(totalWorkingHours from AttendanceLog)');
        console.log('  Source: AnalyticsService.js → calculateEmployeeMetrics()');
        console.log('  Logic: Aggregates ACTUAL worked time (session time - break time)\n');
        
        console.log('totalWorkingHours Calculation (per day):');
        console.log('  Formula: (Total Session Time - Total Break Time) / 60');
        console.log('  Source: attendance.js → clock-out endpoint');
        console.log('  Components:');
        console.log('    - Session Time: Sum of (endTime - startTime) for all sessions');
        console.log('    - Break Time: Sum of (endTime - startTime) for all breaks');
        console.log('    - Net Working Minutes: Max(0, sessionMinutes - breakMinutes)');
        console.log('    - totalWorkingHours: netWorkingMinutes / 60\n');
        
        console.log('Key Finding:');
        console.log('  ✅ System uses ACTUAL WORKED TIME (not mandatory policy time)');
        console.log('  ✅ System does NOT multiply presentDays × 8.5');
        console.log('  ✅ System aggregates actual daily totalWorkingHours values\n');
        
        // STEP 4: Root Cause Analysis
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 4: ROOT CAUSE ANALYSIS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Analyze the first employee in detail
        if (employeesWithLogs.length > 0) {
            const firstEmp = employeesWithLogs[0];
            const user = await User.findById(firstEmp._id).select('fullName employeeCode').lean();
            
            const avgDaily = firstEmp.avgHours;
            const expectedDaily = 8.5;
            const dailyGap = avgDaily - expectedDaily;
            
            console.log(`Sample Analysis: ${user.fullName} (${user.employeeCode})`);
            console.log(`  Present Days: ${firstEmp.presentDays}`);
            console.log(`  Average Daily Hours: ${avgDaily.toFixed(2)} hours`);
            console.log(`  Expected Daily Hours: ${expectedDaily} hours`);
            console.log(`  Daily Gap: ${dailyGap.toFixed(2)} hours\n`);
            
            console.log('Possible Root Causes:\n');
            
            if (Math.abs(dailyGap) < 0.1) {
                console.log('  ✅ CASE 1: Employee worked close to full 8.5 hours daily');
                console.log('     → System is working correctly');
                console.log('     → Minor differences due to rounding or actual work patterns\n');
            } else if (dailyGap < -0.3 && dailyGap > -0.5) {
                console.log('  ⚠️  CASE 2: Break Time Deduction Effect');
                console.log('     → Employees taking longer breaks than expected');
                console.log('     → Average break time: ~' + Math.abs(dailyGap * 60).toFixed(0) + ' minutes per day');
                console.log('     → This reduces net working hours below 8.5\n');
            } else if (dailyGap < -0.5) {
                console.log('  ⚠️  CASE 3: Employees Underworking Daily');
                console.log('     → Employees not completing full 8.5 hours of work');
                console.log('     → Average shortfall: ' + Math.abs(dailyGap).toFixed(2) + ' hours per day');
                console.log('     → Possible reasons: Early logout, long breaks, incomplete shifts\n');
            }
            
            // Check for decimal conversion issue
            if (Math.abs(avgDaily - 8.3) < 0.1) {
                console.log('  🚨 CASE 4: DECIMAL CONVERSION BUG DETECTED!');
                console.log('     → Average hours ≈ 8.3 (not 8.5)');
                console.log('     → Suggests 8:30 is being stored/calculated as 8.30 decimal');
                console.log('     → This is a CRITICAL BUG in time conversion logic\n');
            }
        }
        
        // STEP 5: Numerical Reconciliation
        console.log('═══════════════════════════════════════════════════════════');
        console.log('STEP 5: NUMERICAL RECONCILIATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        if (employeesWithLogs.length > 0) {
            const firstEmp = employeesWithLogs[0];
            const user = await User.findById(firstEmp._id).select('fullName employeeCode').lean();
            
            const presentDays = firstEmp.presentDays;
            const actualTotal = firstEmp.totalHours;
            const expectedTotal = 8.5 * presentDays;
            const difference = actualTotal - expectedTotal;
            const perDayAvg = actualTotal / presentDays;
            
            console.log(`Employee: ${user.fullName} (${user.employeeCode})\n`);
            console.log(`  Expected (8.5 × ${presentDays}):     ${expectedTotal.toFixed(2)} hours`);
            console.log(`  Actual Stored Total:      ${actualTotal.toFixed(2)} hours`);
            console.log(`  Difference:               ${difference.toFixed(2)} hours (${difference >= 0 ? '+' : ''}${((difference / expectedTotal) * 100).toFixed(1)}%)`);
            console.log(`  Per-Day Average:          ${perDayAvg.toFixed(2)} hours`);
            console.log(`  Per-Day Gap:              ${(perDayAvg - 8.5).toFixed(2)} hours\n`);
            
            // Calculate what the issue might be
            if (Math.abs(perDayAvg - 8.0) < 0.1) {
                console.log('  💡 Insight: Employees averaging ~8.0 hours/day');
                console.log('     → Missing ~30 minutes per day (0.5 hours)');
                console.log('     → Likely cause: Break time or early logout\n');
            } else if (Math.abs(perDayAvg - 8.3) < 0.1) {
                console.log('  💡 Insight: Employees averaging ~8.3 hours/day');
                console.log('     → This matches 8:30 misinterpreted as 8.30 decimal!');
                console.log('     → CRITICAL: Time format conversion bug suspected\n');
            }
        }
        
        console.log('═══════════════════════════════════════════════════════════');
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

investigateNetHoursMismatch();
