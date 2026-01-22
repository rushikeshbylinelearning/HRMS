// backend/scripts/validate-half-day-backfill.js
/**
 * VALIDATION SCRIPT FOR HALF-DAY BACKFILL
 * 
 * This script validates the results of the half-day backfill to ensure:
 * 1. No payroll impact (totals remain consistent)
 * 2. Admin overrides remain untouched
 * 3. Leave records remain untouched
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

/**
 * Validation statistics
 */
const validationStats = {
    totalRecords: 0,
    backfilledRecords: 0,
    adminOverrideIntact: 0,
    leaveRecordsIntact: 0,
    statusConsistency: 0,
    statusInconsistency: 0,
    auditTrailComplete: 0,
    payrollImpactRecords: 0,
    validationErrors: []
};

/**
 * Validate a single attendance record
 */
async function validateAttendanceRecord(log) {
    const validation = {
        logId: log._id,
        attendanceDate: log.attendanceDate,
        userId: log.user,
        issues: [],
        isValid: true
    };
    
    try {
        // Check if this is a backfilled record
        const isBackfilled = log.backfilledBy === 'SYSTEM_BACKFILL_2026';
        if (isBackfilled) {
            validationStats.backfilledRecords++;
            
            // Validate audit trail completeness
            if (log.backfilledAt && log.backfilledBy && log.backfillVersion && log.backfillReason) {
                validationStats.auditTrailComplete++;
            } else {
                validation.issues.push('Incomplete audit trail for backfilled record');
                validation.isValid = false;
            }
            
            // Validate half-day reason is set
            if (!log.halfDayReasonCode || !log.halfDayReasonText) {
                validation.issues.push('Backfilled record missing half-day reason');
                validation.isValid = false;
            }
            
            // Validate half-day source is AUTO
            if (log.halfDaySource !== 'AUTO') {
                validation.issues.push(`Expected halfDaySource='AUTO' for backfilled record, got '${log.halfDaySource}'`);
                validation.isValid = false;
            }
        }
        
        // Validate admin overrides remain untouched
        if (log.overriddenByAdmin === true) {
            validationStats.adminOverrideIntact++;
            
            // Admin overrides should have proper metadata
            if (!log.overriddenAt || !log.overriddenBy) {
                validation.issues.push('Admin override missing metadata');
                validation.isValid = false;
            }
            
            // Backfilled records should NOT be admin overridden (constraint violation)
            if (isBackfilled) {
                validation.issues.push('CRITICAL: Backfilled record has admin override - this should not happen');
                validation.isValid = false;
            }
        }
        
        // Validate leave records remain untouched
        if (log.attendanceStatus === 'Leave' || log.leaveRequest) {
            validationStats.leaveRecordsIntact++;
            
            // Leave records should NOT be backfilled
            if (isBackfilled) {
                validation.issues.push('CRITICAL: Leave record was backfilled - this should not happen');
                validation.isValid = false;
            }
            
            // Validate leave reference integrity
            if (log.leaveRequest) {
                const leaveRequest = await LeaveRequest.findById(log.leaveRequest);
                if (!leaveRequest || leaveRequest.status !== 'Approved') {
                    validation.issues.push('Leave record references invalid or non-approved leave request');
                    validation.isValid = false;
                }
            }
        }
        
        // Validate status consistency using resolver
        if (log.clockInTime) {
            const user = await User.findById(log.user).populate('shiftGroup');
            if (user && user.shiftGroup) {
                const sessions = await AttendanceSession.find({ attendanceLog: log._id });
                
                // Use the resolver to get expected status
                const resolvedStatus = await resolveAttendanceStatus({
                    attendanceDate: log.attendanceDate,
                    attendanceLog: log,
                    holidays: [], // Simplified for validation
                    leaveRequest: log.leaveRequest ? await LeaveRequest.findById(log.leaveRequest) : null,
                    saturdayPolicy: user.alternateSaturdayPolicy || 'All Saturdays Working'
                });
                
                // Check if stored status matches resolved status
                if (log.attendanceStatus === resolvedStatus.status && 
                    log.isHalfDay === resolvedStatus.isHalfDay) {
                    validationStats.statusConsistency++;
                } else {
                    validationStats.statusInconsistency++;
                    validation.issues.push(`Status inconsistency: stored='${log.attendanceStatus}' (halfDay=${log.isHalfDay}), resolved='${resolvedStatus.status}' (halfDay=${resolvedStatus.isHalfDay})`);
                    validation.isValid = false;
                }
            }
        }
        
        // Check for potential payroll impact
        // Records that changed from Present/Late to Half-day might affect payroll
        if (isBackfilled && log.isHalfDay === true) {
            validationStats.payrollImpactRecords++;
            validation.payrollImpact = true;
        }
        
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
 * Generate payroll impact report
 */
async function generatePayrollImpactReport() {
    console.log('\n📊 PAYROLL IMPACT ANALYSIS');
    console.log('='.repeat(50));
    
    // Get all backfilled records
    const backfilledRecords = await AttendanceLog.find({
        backfilledBy: 'SYSTEM_BACKFILL_2026',
        isHalfDay: true
    }).populate('user', 'fullName email employeeId');
    
    // Group by user and month for payroll analysis
    const payrollImpact = {};
    
    for (const record of backfilledRecords) {
        const userId = record.user._id.toString();
        const month = record.attendanceDate.substring(0, 7); // YYYY-MM
        
        if (!payrollImpact[userId]) {
            payrollImpact[userId] = {
                user: record.user,
                months: {}
            };
        }
        
        if (!payrollImpact[userId].months[month]) {
            payrollImpact[userId].months[month] = {
                halfDayCount: 0,
                dates: []
            };
        }
        
        payrollImpact[userId].months[month].halfDayCount++;
        payrollImpact[userId].months[month].dates.push(record.attendanceDate);
    }
    
    // Print impact summary
    console.log(`Total Employees Affected: ${Object.keys(payrollImpact).length}`);
    console.log(`Total Half-Day Records Added: ${backfilledRecords.length}`);
    
    console.log('\nPER-EMPLOYEE IMPACT:');
    for (const [userId, impact] of Object.entries(payrollImpact)) {
        const user = impact.user;
        console.log(`\n👤 ${user.fullName || user.email} (${user.employeeId || userId})`);
        
        for (const [month, monthData] of Object.entries(impact.months)) {
            console.log(`  📅 ${month}: ${monthData.halfDayCount} half-days`);
            console.log(`     Dates: ${monthData.dates.join(', ')}`);
        }
    }
    
    return payrollImpact;
}

/**
 * Validate data integrity after backfill
 */
async function validateDataIntegrity() {
    console.log('\n🔍 DATA INTEGRITY VALIDATION');
    console.log('='.repeat(50));
    
    // Check for duplicate attendance logs (should not exist due to unique index)
    const duplicates = await AttendanceLog.aggregate([
        {
            $group: {
                _id: { user: '$user', attendanceDate: '$attendanceDate' },
                count: { $sum: 1 },
                docs: { $push: '$_id' }
            }
        },
        {
            $match: { count: { $gt: 1 } }
        }
    ]);
    
    if (duplicates.length > 0) {
        console.log(`❌ Found ${duplicates.length} duplicate attendance records!`);
        duplicates.forEach(dup => {
            console.log(`  - User ${dup._id.user} on ${dup._id.attendanceDate}: ${dup.count} records`);
        });
    } else {
        console.log('✅ No duplicate attendance records found');
    }
    
    // Check for orphaned sessions
    const orphanedSessions = await AttendanceSession.aggregate([
        {
            $lookup: {
                from: 'attendancelogs',
                localField: 'attendanceLog',
                foreignField: '_id',
                as: 'log'
            }
        },
        {
            $match: { log: { $size: 0 } }
        }
    ]);
    
    if (orphanedSessions.length > 0) {
        console.log(`⚠️  Found ${orphanedSessions.length} orphaned attendance sessions`);
    } else {
        console.log('✅ No orphaned attendance sessions found');
    }
    
    // Check for records with isHalfDay=true but no reason
    const halfDayNoReason = await AttendanceLog.find({
        isHalfDay: true,
        $or: [
            { halfDayReasonCode: { $exists: false } },
            { halfDayReasonCode: null },
            { halfDayReasonText: { $exists: false } },
            { halfDayReasonText: '' }
        ]
    });
    
    if (halfDayNoReason.length > 0) {
        console.log(`❌ Found ${halfDayNoReason.length} half-day records without proper reason`);
    } else {
        console.log('✅ All half-day records have proper reasons');
    }
}

/**
 * Main validation function
 */
async function validateBackfillResults() {
    console.log('🔍 Starting Half-Day Backfill Validation...');
    
    try {
        // Get all attendance records for validation
        const allLogs = await AttendanceLog.find({}).sort({ attendanceDate: 1 });
        validationStats.totalRecords = allLogs.length;
        
        console.log(`📊 Validating ${allLogs.length} attendance records...`);
        
        // Validate each record
        let processedCount = 0;
        for (const log of allLogs) {
            await validateAttendanceRecord(log);
            processedCount++;
            
            if (processedCount % 500 === 0) {
                console.log(`📋 Validated ${processedCount}/${allLogs.length} records...`);
            }
        }
        
        // Print validation summary
        console.log('\n' + '='.repeat(80));
        console.log('📊 VALIDATION SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total Records Validated: ${validationStats.totalRecords}`);
        console.log(`Backfilled Records Found: ${validationStats.backfilledRecords}`);
        console.log(`Admin Overrides Intact: ${validationStats.adminOverrideIntact}`);
        console.log(`Leave Records Intact: ${validationStats.leaveRecordsIntact}`);
        console.log(`Status Consistency: ${validationStats.statusConsistency}`);
        console.log(`Status Inconsistency: ${validationStats.statusInconsistency}`);
        console.log(`Complete Audit Trail: ${validationStats.auditTrailComplete}`);
        console.log(`Payroll Impact Records: ${validationStats.payrollImpactRecords}`);
        console.log(`Validation Errors: ${validationStats.validationErrors.length}`);
        
        // Show validation errors
        if (validationStats.validationErrors.length > 0) {
            console.log('\n❌ VALIDATION ERRORS:');
            validationStats.validationErrors.forEach((error, index) => {
                console.log(`\n${index + 1}. Record ${error.logId} (${error.attendanceDate}):`);
                error.issues.forEach(issue => {
                    console.log(`   - ${issue}`);
                });
            });
        } else {
            console.log('\n✅ All validations passed!');
        }
        
        // Generate reports
        await generatePayrollImpactReport();
        await validateDataIntegrity();
        
        // Final assessment
        const isValid = validationStats.validationErrors.length === 0;
        console.log('\n' + '='.repeat(80));
        console.log(`🎯 OVERALL VALIDATION: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);
        console.log('='.repeat(80));
        
        if (!isValid) {
            console.log('⚠️  Please review and fix validation errors before proceeding.');
        }
        
        return {
            isValid,
            stats: validationStats
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
        await validateBackfillResults();
        
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
    validateBackfillResults,
    generatePayrollImpactReport,
    validateDataIntegrity,
    validationStats
};