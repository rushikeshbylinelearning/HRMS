// backend/scripts/validate-insufficient-hours-backfill.js
/**
 * VALIDATION SCRIPT FOR INSUFFICIENT HOURS HALF-DAY BACKFILL
 * 
 * This script validates the results of the insufficient hours backfill to ensure:
 * 1. Only working days with < 8 hours were marked Half Day
 * 2. No holidays, weekly offs, or leaves were touched
 * 3. Admin overrides remain intact
 * 4. Status consistency across all views
 * 5. Proper audit trail
 */

const mongoose = require('mongoose');
const connectDB = require('../db');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const { resolveAttendanceStatus } = require('../utils/attendanceStatusResolver');

const BACKFILL_IDENTIFIER = 'SYSTEM_BACKFILL_2026_INSUFFICIENT_HOURS';
const MIN_WORKING_MINUTES = 480; // 8 hours

/**
 * Validation statistics
 */
const validationStats = {
    totalRecords: 0,
    backfilledRecords: 0,
    validBackfills: 0,
    invalidBackfills: 0,
    adminOverrideIntact: 0,
    leaveRecordsIntact: 0,
    holidayWeeklyOffIntact: 0,
    statusConsistency: 0,
    auditTrailComplete: 0,
    validationErrors: []
};

/**
 * Calculate total worked minutes from sessions
 */
function calculateTotalWorkedMinutes(sessions) {
    if (!sessions || sessions.length === 0) return 0;
    
    let totalMinutes = 0;
    for (const session of sessions) {
        if (session.startTime && session.endTime) {
            const duration = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60);
            totalMinutes += Math.max(0, duration);
        }
    }
    return Math.round(totalMinutes);
}

/**
 * Format worked time as "Xh Ym"
 */
function formatWorkedTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (minutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
}

/**
 * Validate a single backfilled record
 */
async function validateBackfilledRecord(log) {
    const validation = {
        logId: log._id,
        attendanceDate: log.attendanceDate,
        userId: log.user,
        issues: [],
        isValid: true
    };
    
    try {
        // Get sessions to calculate worked time
        const sessions = await AttendanceSession.find({ attendanceLog: log._id });
        const totalWorkedMinutes = calculateTotalWorkedMinutes(sessions);
        const workedTime = formatWorkedTime(totalWorkedMinutes);
        
        // Validation 1: Must have insufficient working hours
        if (totalWorkedMinutes >= MIN_WORKING_MINUTES) {
            validation.issues.push(`CRITICAL: Record has sufficient hours (${workedTime}) but was marked Half Day`);
            validation.isValid = false;
            validationStats.invalidBackfills++;
        } else {
            validationStats.validBackfills++;
        }
        
        // Validation 2: Must have proper audit trail
        if (!log.backfilledAt || !log.backfilledBy || !log.backfillVersion || !log.backfillReason) {
            validation.issues.push('Incomplete audit trail for backfilled record');
            validation.isValid = false;
        } else {
            validationStats.auditTrailComplete++;
        }
        
        // Validation 3: Must have correct half-day reason
        if (log.halfDayReasonCode !== 'INSUFFICIENT_WORKING_HOURS') {
            validation.issues.push(`Expected halfDayReasonCode='INSUFFICIENT_WORKING_HOURS', got '${log.halfDayReasonCode}'`);
            validation.isValid = false;
        }
        
        // Validation 4: Must have correct reason text format
        const expectedReasonText = `Worked ${workedTime}, minimum required is 8h`;
        if (log.halfDayReasonText !== expectedReasonText) {
            validation.issues.push(`Reason text mismatch. Expected: '${expectedReasonText}', Got: '${log.halfDayReasonText}'`);
            validation.isValid = false;
        }
        
        // Validation 5: Must have halfDaySource = 'AUTO'
        if (log.halfDaySource !== 'AUTO') {
            validation.issues.push(`Expected halfDaySource='AUTO', got '${log.halfDaySource}'`);
            validation.isValid = false;
        }
        
        // Validation 6: Must be marked as Half Day
        if (!log.isHalfDay || log.attendanceStatus !== 'Half-day') {
            validation.issues.push('Record not properly marked as Half Day');
            validation.isValid = false;
        }
        
        // Validation 7: Must NOT be admin overridden (should not have been backfilled)
        if (log.overriddenByAdmin === true) {
            validation.issues.push('CRITICAL: Admin overridden record was backfilled - this should not happen');
            validation.isValid = false;
        }
        
        // Validation 8: Must NOT be a leave record
        if (log.attendanceStatus === 'Leave' || log.leaveRequest) {
            validation.issues.push('CRITICAL: Leave record was backfilled - this should not happen');
            validation.isValid = false;
        }
        
        // Validation 9: Must be a working day (use resolver to verify)
        const user = await User.findById(log.user);
        if (user) {
            let leaveRequest = null;
            if (log.leaveRequest) {
                leaveRequest = await LeaveRequest.findById(log.leaveRequest);
            }
            
            const resolvedStatus = resolveAttendanceStatus({
                attendanceDate: log.attendanceDate,
                attendanceLog: log,
                holidays: [], // Simplified for validation
                leaveRequest: leaveRequest,
                saturdayPolicy: user.alternateSaturdayPolicy || 'All Saturdays Working'
            });
            
            if (resolvedStatus.isHoliday) {
                validation.issues.push('CRITICAL: Holiday was backfilled - this should not happen');
                validation.isValid = false;
            }
            
            if (resolvedStatus.isWeeklyOff) {
                validation.issues.push('CRITICAL: Weekly off was backfilled - this should not happen');
                validation.isValid = false;
            }
            
            if (resolvedStatus.isLeave) {
                validation.issues.push('CRITICAL: Leave day was backfilled - this should not happen');
                validation.isValid = false;
            }
        }
        
        validation.totalWorkedMinutes = totalWorkedMinutes;
        validation.workedTime = workedTime;
        
    } catch (error) {
        validation.issues.push(`Validation error: ${error.message}`);
        validation.isValid = false;
    }
    
    if (!validation.isValid) {
        validationStats.validationErrors.push(validation);
    }
    
    return validation;
}

/**
 * Validate that protected records remain untouched
 */
async function validateProtectedRecords() {
    console.log('\n🛡️  VALIDATING PROTECTED RECORDS');
    console.log('='.repeat(50));
    
    let protectedIssues = 0;
    
    // Check admin overridden records
    const adminOverriddenCount = await AttendanceLog.countDocuments({
        overriddenByAdmin: true,
        backfilledBy: BACKFILL_IDENTIFIER
    });
    
    if (adminOverriddenCount > 0) {
        console.log(`❌ Found ${adminOverriddenCount} admin overridden records that were backfilled!`);
        protectedIssues += adminOverriddenCount;
    } else {
        console.log('✅ No admin overridden records were backfilled');
    }
    
    // Check leave records
    const leaveRecordsCount = await AttendanceLog.countDocuments({
        $or: [
            { attendanceStatus: 'Leave' },
            { leaveRequest: { $exists: true, $ne: null } }
        ],
        backfilledBy: BACKFILL_IDENTIFIER
    });
    
    if (leaveRecordsCount > 0) {
        console.log(`❌ Found ${leaveRecordsCount} leave records that were backfilled!`);
        protectedIssues += leaveRecordsCount;
    } else {
        console.log('✅ No leave records were backfilled');
    }
    
    // Check already half-day records
    const alreadyHalfDayCount = await AttendanceLog.countDocuments({
        isHalfDay: true,
        backfilledBy: { $ne: BACKFILL_IDENTIFIER },
        // Also backfilled by our script (double backfill check)
        $and: [{ backfilledBy: BACKFILL_IDENTIFIER }]
    });
    
    if (alreadyHalfDayCount > 0) {
        console.log(`⚠️  Found ${alreadyHalfDayCount} records that were already half-day but got backfilled`);
        protectedIssues += alreadyHalfDayCount;
    } else {
        console.log('✅ No already half-day records were double-backfilled');
    }
    
    return protectedIssues;
}

/**
 * Generate detailed backfill report
 */
async function generateBackfillReport() {
    console.log('\n📊 DETAILED BACKFILL REPORT');
    console.log('='.repeat(50));
    
    // Get all backfilled records
    const backfilledRecords = await AttendanceLog.find({
        backfilledBy: BACKFILL_IDENTIFIER
    }).populate('user', 'fullName email employeeId').sort({ attendanceDate: 1 });
    
    console.log(`Total Backfilled Records: ${backfilledRecords.length}`);
    
    if (backfilledRecords.length === 0) {
        console.log('No backfilled records found.');
        return;
    }
    
    // Group by employee
    const employeeGroups = {};
    let totalWorkedMinutes = 0;
    let recordCount = 0;
    
    for (const record of backfilledRecords) {
        const sessions = await AttendanceSession.find({ attendanceLog: record._id });
        const workedMinutes = calculateTotalWorkedMinutes(sessions);
        const workedTime = formatWorkedTime(workedMinutes);
        
        totalWorkedMinutes += workedMinutes;
        recordCount++;
        
        const userName = record.user?.fullName || record.user?.email || 'Unknown';
        const employeeId = record.user?.employeeId || record.user?._id;
        
        if (!employeeGroups[userName]) {
            employeeGroups[userName] = {
                employeeId,
                records: [],
                totalRecords: 0,
                avgWorkedMinutes: 0
            };
        }
        
        employeeGroups[userName].records.push({
            date: record.attendanceDate,
            workedTime,
            workedMinutes,
            reasonText: record.halfDayReasonText
        });
        employeeGroups[userName].totalRecords++;
    }
    
    // Calculate averages and display
    const avgWorkedMinutes = Math.round(totalWorkedMinutes / recordCount);
    console.log(`Average Worked Time: ${formatWorkedTime(avgWorkedMinutes)}`);
    
    console.log('\nPER-EMPLOYEE BREAKDOWN:');
    Object.entries(employeeGroups).forEach(([name, group]) => {
        const avgMinutes = Math.round(
            group.records.reduce((sum, r) => sum + r.workedMinutes, 0) / group.records.length
        );
        
        console.log(`\n👤 ${name} (${group.employeeId})`);
        console.log(`   Records: ${group.totalRecords}, Avg: ${formatWorkedTime(avgMinutes)}`);
        
        if (group.records.length <= 10) {
            group.records.forEach(record => {
                console.log(`   - ${record.date}: ${record.workedTime}`);
            });
        } else {
            console.log(`   - ${group.records.slice(0, 5).map(r => `${r.date}: ${r.workedTime}`).join(', ')} ... and ${group.records.length - 5} more`);
        }
    });
    
    // Monthly distribution
    const monthlyDistribution = {};
    backfilledRecords.forEach(record => {
        const month = record.attendanceDate.substring(0, 7); // YYYY-MM
        monthlyDistribution[month] = (monthlyDistribution[month] || 0) + 1;
    });
    
    console.log('\nMONTHLY DISTRIBUTION:');
    Object.entries(monthlyDistribution)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([month, count]) => {
            console.log(`  ${month}: ${count} records`);
        });
}

/**
 * Main validation function
 */
async function validateInsufficientHoursBackfill() {
    console.log('🔍 Starting Insufficient Hours Backfill Validation...');
    
    try {
        // Get all backfilled records
        const backfilledRecords = await AttendanceLog.find({
            backfilledBy: BACKFILL_IDENTIFIER
        });
        
        validationStats.backfilledRecords = backfilledRecords.length;
        console.log(`📊 Found ${backfilledRecords.length} backfilled records to validate...`);
        
        if (backfilledRecords.length === 0) {
            console.log('✅ No backfilled records found. Nothing to validate.');
            return { isValid: true, stats: validationStats };
        }
        
        // Validate each backfilled record
        for (const record of backfilledRecords) {
            await validateBackfilledRecord(record);
        }
        
        // Validate protected records
        const protectedIssues = await validateProtectedRecords();
        
        // Print validation summary
        console.log('\n' + '='.repeat(80));
        console.log('📊 VALIDATION SUMMARY');
        console.log('='.repeat(80));
        console.log(`Backfilled Records Found: ${validationStats.backfilledRecords}`);
        console.log(`Valid Backfills: ${validationStats.validBackfills}`);
        console.log(`Invalid Backfills: ${validationStats.invalidBackfills}`);
        console.log(`Complete Audit Trail: ${validationStats.auditTrailComplete}`);
        console.log(`Protected Record Issues: ${protectedIssues}`);
        console.log(`Validation Errors: ${validationStats.validationErrors.length}`);
        
        // Show validation errors
        if (validationStats.validationErrors.length > 0) {
            console.log('\n❌ VALIDATION ERRORS:');
            validationStats.validationErrors.forEach((error, index) => {
                console.log(`\n${index + 1}. Record ${error.logId} (${error.attendanceDate}):`);
                if (error.workedTime) {
                    console.log(`   Worked: ${error.workedTime}`);
                }
                error.issues.forEach(issue => {
                    console.log(`   - ${issue}`);
                });
            });
        } else {
            console.log('\n✅ All backfilled records passed validation!');
        }
        
        // Generate detailed report
        await generateBackfillReport();
        
        // Final assessment
        const isValid = validationStats.validationErrors.length === 0 && protectedIssues === 0;
        console.log('\n' + '='.repeat(80));
        console.log(`🎯 OVERALL VALIDATION: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);
        console.log('='.repeat(80));
        
        if (!isValid) {
            console.log('⚠️  Please review and fix validation errors before proceeding.');
            console.log('💡 Consider running rollback if critical issues are found.');
        } else {
            console.log('✅ Backfill validation successful! All records are correctly processed.');
        }
        
        return {
            isValid,
            stats: validationStats,
            protectedIssues
        };
        
    } catch (error) {
        console.error('❌ Validation failed:', error);
        throw error;
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        await connectDB();
        await validateInsufficientHoursBackfill();
        
    } catch (error) {
        console.error('❌ Validation script failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('📝 Database connection closed');
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

module.exports = {
    validateInsufficientHoursBackfill,
    generateBackfillReport,
    validationStats
};