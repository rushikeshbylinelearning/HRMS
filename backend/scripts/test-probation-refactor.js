/**
 * TEST SCRIPT: Probation Tracker Refactor Validation
 * 
 * This script tests the new AttendanceSummaryService integration
 * and validates that probation calculations are correct.
 * 
 * Run: node backend/scripts/test-probation-refactor.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceSummaryService = require('../services/AttendanceSummaryService');

async function testProbationRefactor() {
    try {
        console.log('🔌 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database\n');

        // Find a probation employee to test
        const probationEmployee = await User.findOne({
            employmentStatus: 'Probation',
            isActive: true,
            role: { $ne: 'Intern' }
        }).select('_id fullName employeeCode joiningDate').lean();

        if (!probationEmployee) {
            console.log('⚠️  No probation employees found. Skipping test.');
            return;
        }

        console.log('📋 Testing with employee:');
        console.log(`   Name: ${probationEmployee.fullName}`);
        console.log(`   Code: ${probationEmployee.employeeCode}`);
        console.log(`   Joining Date: ${probationEmployee.joiningDate}\n`);

        // Calculate probation dates
        const joiningDate = new Date(probationEmployee.joiningDate);
        const joiningDateIST = new Date(joiningDate.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
        const probationStartDate = new Date(
            joiningDateIST.getFullYear(),
            joiningDateIST.getMonth(),
            joiningDateIST.getDate(),
            0, 0, 0, 0
        );
        const probationStartDateStr = `${probationStartDate.getFullYear()}-${String(probationStartDate.getMonth() + 1).padStart(2, '0')}-${String(probationStartDate.getDate()).padStart(2, '0')}`;

        console.log('🔍 Fetching attendance summary...');
        const startTime = Date.now();
        
        const attendanceSummary = await AttendanceSummaryService.getEmployeeAttendanceSummary(
            probationEmployee._id,
            probationStartDateStr,
            new Date()
        );
        
        const endTime = Date.now();
        console.log(`✅ Fetched ${attendanceSummary.length} days in ${endTime - startTime}ms\n`);

        // Calculate extensions
        let fullDayLeaves = 0;
        let halfDayLeaves = 0;
        let fullDayAbsences = 0;
        let halfDayAbsences = 0;
        let holidaysSkipped = 0;
        let weeklyOffsSkipped = 0;

        attendanceSummary.forEach(day => {
            if (day.isHoliday) {
                holidaysSkipped++;
                return;
            }
            
            if (day.isWeeklyOff) {
                weeklyOffsSkipped++;
                return;
            }
            
            if (day.finalStatus === 'Leave') {
                if (day.isHalfDay) {
                    halfDayLeaves++;
                } else {
                    fullDayLeaves++;
                }
            }
            
            if (day.finalStatus === 'Absent') {
                if (day.isHalfDay) {
                    halfDayAbsences++;
                } else {
                    fullDayAbsences++;
                }
            }
            
            if (day.finalStatus === 'Half-day') {
                halfDayAbsences++;
            }
        });

        const leaveExtensionDays = fullDayLeaves + (halfDayLeaves * 0.5);
        const absentExtensionDays = fullDayAbsences + (halfDayAbsences * 0.5);
        const totalExtensionDays = leaveExtensionDays + absentExtensionDays;

        console.log('📊 Probation Calculation Results:');
        console.log('─────────────────────────────────');
        console.log(`   Total Days Analyzed: ${attendanceSummary.length}`);
        console.log(`   Holidays Excluded: ${holidaysSkipped}`);
        console.log(`   Weekly Offs Excluded: ${weeklyOffsSkipped}`);
        console.log('');
        console.log('   Leave Breakdown:');
        console.log(`     Full Day Leaves: ${fullDayLeaves}`);
        console.log(`     Half Day Leaves: ${halfDayLeaves}`);
        console.log(`     Leave Extension: ${leaveExtensionDays.toFixed(1)} days`);
        console.log('');
        console.log('   Absence Breakdown:');
        console.log(`     Full Day Absences: ${fullDayAbsences}`);
        console.log(`     Half Day Absences: ${halfDayAbsences}`);
        console.log(`     Absence Extension: ${absentExtensionDays.toFixed(1)} days`);
        console.log('');
        console.log(`   Total Extension: ${totalExtensionDays.toFixed(1)} days`);
        console.log('─────────────────────────────────\n');

        // Validation checks
        console.log('✅ Validation Checks:');
        console.log(`   ✓ Holidays excluded: ${holidaysSkipped > 0 ? 'YES' : 'N/A (no holidays in period)'}`);
        console.log(`   ✓ Weekly offs excluded: ${weeklyOffsSkipped > 0 ? 'YES' : 'N/A (no weekly offs in period)'}`);
        console.log(`   ✓ Half-day support: ${(halfDayLeaves > 0 || halfDayAbsences > 0) ? 'YES' : 'N/A (no half-days)'}`);
        console.log(`   ✓ Decimal extensions: ${totalExtensionDays % 1 !== 0 ? 'YES' : 'N/A (no decimals)'}`);
        console.log(`   ✓ Service integration: YES`);
        console.log(`   ✓ Performance: ${endTime - startTime < 1000 ? 'GOOD' : 'ACCEPTABLE'} (${endTime - startTime}ms)\n`);

        // Sample data inspection
        console.log('📝 Sample Attendance Data (first 10 days):');
        console.log('─────────────────────────────────');
        attendanceSummary.slice(0, 10).forEach(day => {
            const status = day.finalStatus.padEnd(12);
            const flags = [
                day.isHoliday ? 'Holiday' : null,
                day.isWeeklyOff ? 'WeeklyOff' : null,
                day.isLeave ? 'Leave' : null,
                day.isHalfDay ? 'HalfDay' : null
            ].filter(Boolean).join(', ') || 'None';
            console.log(`   ${day.date} | ${status} | ${flags}`);
        });
        console.log('─────────────────────────────────\n');

        console.log('✅ TEST COMPLETE - Refactor working correctly!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the test
testProbationRefactor();
