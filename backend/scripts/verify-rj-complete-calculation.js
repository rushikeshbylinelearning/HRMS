// Complete verification of RJ's attendance calculation
// Including proper handling of Sundays and alternate Saturdays

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const Holiday = require('../models/Holiday');

function getDayOfWeek(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}

function getWeekOfMonth(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const firstDayOfWeek = firstDay.getDay();
    return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
}

async function verifyRJCompleteCalculation() {
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
        
        console.log(`Found: ${rj.fullName} (${rj.employeeCode})`);
        console.log(`Saturday Policy: ${rj.alternateSaturdayPolicy || 'All Saturdays Working'}\n`);
        
        // Get February attendance
        const febLogs = await AttendanceLog.find({
            user: rj._id,
            attendanceDate: { $gte: '2026-02-01', $lte: '2026-02-28' }
        }).sort({ attendanceDate: 1 }).lean();
        
        // Get holidays in February
        const holidays = await Holiday.find({
            date: {
                $gte: new Date('2026-02-01T00:00:00+05:30'),
                $lte: new Date('2026-02-28T23:59:59+05:30')
            },
            isTentative: { $ne: true }
        }).lean();
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('FEBRUARY 2026 - COMPLETE BREAKDOWN');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('All Days in February:\n');
        console.log('┌────────────┬───────────┬───────────┬──────────┬──────────┬─────────────────┐');
        console.log('│    Date    │    Day    │   Hours   │  Status  │ Half-Day │  Should Count?  │');
        console.log('├────────────┼───────────┼───────────┼──────────┼──────────┼─────────────────┤');
        
        let workingDays = 0;
        let presentDays = 0;
        let totalHours = 0;
        let weeklyOffs = 0;
        let holidayCount = 0;
        
        const holidayDates = new Set(holidays.map(h => {
            const d = new Date(h.date);
            return d.toISOString().split('T')[0];
        }));
        
        // Generate all days in February
        for (let day = 1; day <= 28; day++) {
            const dateStr = `2026-02-${day.toString().padStart(2, '0')}`;
            const dayOfWeek = getDayOfWeek(dateStr);
            const weekOfMonth = getWeekOfMonth(dateStr);
            
            const log = febLogs.find(l => l.attendanceDate === dateStr);
            const hours = log ? log.totalWorkingHours.toFixed(2) : '0.00';
            const status = log ? log.attendanceStatus : 'N/A';
            const isHalfDay = log && log.isHalfDay ? 'Yes' : 'No';
            
            let shouldCount = 'No';
            let reason = '';
            
            // Check if it's a Sunday
            if (dayOfWeek === 'Sunday') {
                shouldCount = 'No';
                reason = '(Sunday - Weekly Off)';
                weeklyOffs++;
            }
            // Check if it's a holiday
            else if (holidayDates.has(dateStr)) {
                shouldCount = 'No';
                reason = '(Holiday)';
                holidayCount++;
            }
            // Check if it's an alternate Saturday off
            else if (dayOfWeek === 'Saturday') {
                const saturdayPolicy = rj.alternateSaturdayPolicy || 'All Saturdays Working';
                
                if (saturdayPolicy === 'All Saturdays Off') {
                    shouldCount = 'No';
                    reason = '(Saturday Off)';
                    weeklyOffs++;
                } else if (saturdayPolicy === 'Week 1 & 3 Off' && (weekOfMonth === 1 || weekOfMonth === 3)) {
                    shouldCount = 'No';
                    reason = `(Week ${weekOfMonth} Sat Off)`;
                    weeklyOffs++;
                } else if (saturdayPolicy === 'Week 2 & 4 Off' && (weekOfMonth === 2 || weekOfMonth === 4)) {
                    shouldCount = 'No';
                    reason = `(Week ${weekOfMonth} Sat Off)`;
                    weeklyOffs++;
                } else {
                    shouldCount = 'Yes';
                    reason = '(Working Saturday)';
                    workingDays++;
                    if (log && ['On-time', 'Late', 'Half-day'].includes(status)) {
                        presentDays++;
                        totalHours += log.totalWorkingHours;
                    }
                }
            }
            // Regular working day
            else {
                shouldCount = 'Yes';
                reason = '(Working Day)';
                workingDays++;
                if (log && ['On-time', 'Late', 'Half-day'].includes(status)) {
                    presentDays++;
                    totalHours += log.totalWorkingHours;
                }
            }
            
            const countStr = shouldCount === 'Yes' ? `✅ Yes ${reason}` : `❌ No ${reason}`;
            console.log(`│ ${dateStr} │ ${dayOfWeek.padEnd(9)} │ ${hours.padStart(9)} │ ${status.padEnd(8)} │ ${isHalfDay.padEnd(8)} │ ${countStr.padEnd(15)} │`);
        }
        
        console.log('└────────────┴───────────┴───────────┴──────────┴──────────┴─────────────────┘\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('SUMMARY');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('Calendar Breakdown:');
        console.log(`  Total Days in February: 28`);
        console.log(`  Sundays (Weekly Offs): ${weeklyOffs}`);
        console.log(`  Holidays: ${holidayCount}`);
        console.log(`  Working Days: ${workingDays}\n`);
        
        console.log('Attendance Summary:');
        console.log(`  Present Days: ${presentDays}`);
        console.log(`  Total Hours: ${totalHours.toFixed(2)}\n`);
        
        console.log('Expected Calculation:');
        console.log(`  Working Days: ${workingDays}`);
        console.log(`  Expected if all present (${workingDays} × 8.5): ${(workingDays * 8.5).toFixed(2)} hours`);
        console.log(`  Actual Present: ${presentDays} days`);
        console.log(`  Actual Hours: ${totalHours.toFixed(2)} hours`);
        console.log(`  Average: ${(totalHours / presentDays).toFixed(2)} hours/day\n`);
        
        console.log('Gap Analysis:');
        const expectedForPresent = presentDays * 8.5;
        const gap = totalHours - expectedForPresent;
        console.log(`  Expected for ${presentDays} present days: ${expectedForPresent.toFixed(2)} hours`);
        console.log(`  Actual: ${totalHours.toFixed(2)} hours`);
        console.log(`  Gap: ${gap.toFixed(2)} hours\n`);
        
        if (Math.abs(gap) < 1) {
            console.log('✅ Hours match expected (within 1 hour tolerance)\n');
        } else {
            console.log('⚠️  Significant gap detected\n');
            console.log('Possible reasons:');
            console.log('  - Days with 0 hours (incomplete clock-out)');
            console.log('  - Days with < 8.5 hours worked');
            console.log('  - Break time reducing net working hours\n');
        }
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('ANALYTICS EXPECTATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log('What Analytics Should Show:');
        console.log(`  Present Days: ${presentDays}`);
        console.log(`  Total Net Hours: ${totalHours.toFixed(2)} hours`);
        console.log(`  Average Hours/Day: ${(totalHours / presentDays).toFixed(2)} hours\n`);
        
        console.log('Note: Analytics should EXCLUDE:');
        console.log('  - Sundays (weekly offs)');
        console.log('  - Alternate Saturdays (based on policy)');
        console.log('  - Holidays');
        console.log('  - These days should not appear in present/absent counts\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

verifyRJCompleteCalculation();
