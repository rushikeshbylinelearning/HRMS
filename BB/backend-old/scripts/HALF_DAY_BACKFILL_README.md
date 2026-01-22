# Historical Half-Day Records Backfill

## Overview

This package provides a **SAFE, IDEMPOTENT** solution for backfilling historical attendance records that should have been marked as Half Day but weren't due to previous system limitations.

## 🚨 CRITICAL CONSTRAINTS

**These scripts are designed with strict safety measures:**

❌ **WILL NOT** break existing payroll  
❌ **WILL NOT** delete any attendance logs  
❌ **WILL NOT** override admin-approved records  
❌ **WILL NOT** change records that already have `isHalfDay === true`  
❌ **WILL NOT** modify leave records  

✅ **WILL ONLY** update eligible records that meet strict criteria  
✅ **WILL PROVIDE** complete audit trail  
✅ **WILL ALLOW** rollback if needed  

## Files Included

1. **`backfill-historical-half-day-records.js`** - Main backfill script
2. **`validate-half-day-backfill.js`** - Validation and integrity checker
3. **`HALF_DAY_BACKFILL_README.md`** - This documentation

## Eligibility Criteria

Records are eligible for backfill ONLY if ALL conditions are met:

- ✅ Has `clockInTime` (working day with attendance)
- ✅ `isHalfDay !== true` (not already marked)
- ✅ `overriddenByAdmin !== true` (not admin protected)
- ✅ `attendanceStatus !== 'Leave'` (not a leave record)
- ✅ No `leaveRequest` reference
- ✅ Has attendance sessions
- ✅ Total worked hours < 8 hours

## Usage Instructions

### Phase 1: Dry-Run Analysis (MANDATORY FIRST STEP)

```bash
# Run dry-run to see what would be changed (NO ACTUAL CHANGES)
cd backend
node scripts/backfill-historical-half-day-records.js

# This will show:
# - Total records scanned
# - Eligible records found
# - What changes would be made
# - No actual database modifications
```

### Phase 2: Review and Configure

Edit the configuration in `backfill-historical-half-day-records.js`:

```javascript
const CONFIG = {
    DRY_RUN: true,              // Keep true for testing
    BATCH_SIZE: 100,            // Adjust batch size
    MIN_WORKING_HOURS: 8,       // Minimum hours threshold
    VERBOSE_LOGGING: true,      // Detailed logging
    DATE_RANGE: {
        startDate: '2024-01-01', // Optional: limit date range
        endDate: '2024-12-31'    // Optional: limit date range
    }
};
```

### Phase 3: Execute Backfill (LIVE CHANGES)

```bash
# Execute the actual backfill (MAKES REAL CHANGES)
node scripts/backfill-historical-half-day-records.js --execute

# This will:
# - Process records in batches
# - Update eligible records
# - Add audit metadata
# - Show progress and summary
```

### Phase 4: Validate Results

```bash
# Validate the backfill results
node scripts/validate-half-day-backfill.js

# This will:
# - Check data integrity
# - Verify admin overrides remain intact
# - Validate status consistency
# - Generate payroll impact report
# - Identify any issues
```

### Phase 5: Rollback (If Needed)

```bash
# Rollback all backfill changes if needed
node scripts/backfill-historical-half-day-records.js --rollback

# This will:
# - Find all backfilled records
# - Revert them to previous state
# - Remove backfill metadata
```

## What Gets Updated

For each eligible record, the script updates:

```javascript
{
    status: 'Half Day',
    isHalfDay: true,
    attendanceStatus: 'Half-day',
    halfDayReasonCode: 'INSUFFICIENT_WORKING_HOURS', // or 'LATE_LOGIN'
    halfDayReasonText: 'Worked 7.5h, minimum required is 8h',
    halfDaySource: 'AUTO',
    
    // Audit metadata
    backfilledAt: new Date(),
    backfilledBy: 'SYSTEM_BACKFILL_2026',
    backfillVersion: 'v1.0',
    backfillReason: 'Historical half-day records correction'
}
```

## Audit Trail

Every backfilled record includes complete audit metadata:

- **`backfilledAt`**: Timestamp of backfill
- **`backfilledBy`**: System identifier
- **`backfillVersion`**: Version for tracking
- **`backfillReason`**: Human-readable reason

This ensures full traceability and enables rollback.

## Safety Features

### 1. Idempotent Operation
- Running multiple times won't create duplicates
- Already processed records are skipped
- Safe to re-run after interruption

### 2. Transaction Safety
- Uses MongoDB transactions
- All-or-nothing batch processing
- Automatic rollback on errors

### 3. Constraint Validation
- Respects unique indexes
- Validates data integrity
- Checks business rules

### 4. Admin Override Protection
- Never modifies admin-overridden records
- Preserves manual corrections
- Maintains audit trail

## Expected Output

### Dry-Run Example:
```
🚀 Starting Historical Half-Day Records Backfill...
📋 Mode: DRY-RUN (no changes will be made)
📅 Date Range: All to All
⚙️  Batch Size: 100
⏰ Min Working Hours: 8
🕐 Grace Period: 30 minutes

📊 Total records to scan: 1,250
📦 Processing batch 1/13 (records 1-100)

✅ [DRY-RUN] Updating John Doe (2024-03-15): Worked 7.2h, minimum required is 8h
✅ [DRY-RUN] Updating Jane Smith (2024-03-20): Worked 6.8h, minimum required is 8h

================================================================================
📊 BACKFILL SUMMARY
================================================================================
Total Records Scanned: 1,250
Eligible for Backfill: 45
Already Correct: 890
Admin Overridden (Protected): 12
Leave Records (Skipped): 203
Insufficient Hours Found: 45
Would Update: 45
Errors: 0

🔄 This was a DRY-RUN. No changes were made.
💡 Set CONFIG.DRY_RUN = false to execute the backfill.
```

### Live Execution Example:
```
🚀 Starting Historical Half-Day Records Backfill...
📋 Mode: LIVE EXECUTION
✅ Updating John Doe (2024-03-15): Worked 7.2h, minimum required is 8h
✅ Updating Jane Smith (2024-03-20): Worked 6.8h, minimum required is 8h

================================================================================
📊 BACKFILL SUMMARY
================================================================================
Total Records Scanned: 1,250
Eligible for Backfill: 45
Updated: 45
Errors: 0

✅ Backfill completed successfully!
```

## Validation Report Example:
```
🔍 Starting Half-Day Backfill Validation...
📊 Validating 1,250 attendance records...

================================================================================
📊 VALIDATION SUMMARY
================================================================================
Total Records Validated: 1,250
Backfilled Records Found: 45
Admin Overrides Intact: 12
Leave Records Intact: 203
Status Consistency: 1,250
Status Inconsistency: 0
Complete Audit Trail: 45
Payroll Impact Records: 45
Validation Errors: 0

✅ All validations passed!

📊 PAYROLL IMPACT ANALYSIS
==================================================
Total Employees Affected: 15
Total Half-Day Records Added: 45

👤 John Doe (EMP001)
  📅 2024-03: 3 half-days
     Dates: 2024-03-15, 2024-03-22, 2024-03-28

🎯 OVERALL VALIDATION: ✅ PASSED
```

## Troubleshooting

### Common Issues:

1. **"No records found matching criteria"**
   - All eligible records may already be correctly marked
   - Check date range configuration
   - Verify database connection

2. **"Validation errors found"**
   - Review error details in validation output
   - Check for data inconsistencies
   - May need manual review of specific records

3. **"Transaction timeout"**
   - Reduce BATCH_SIZE in configuration
   - Check database performance
   - Run during low-traffic periods

### Recovery Steps:

1. **If backfill fails mid-process:**
   ```bash
   # Check what was processed
   node scripts/validate-half-day-backfill.js
   
   # Re-run backfill (idempotent)
   node scripts/backfill-historical-half-day-records.js --execute
   ```

2. **If results are incorrect:**
   ```bash
   # Rollback all changes
   node scripts/backfill-historical-half-day-records.js --rollback
   
   # Review configuration and re-run
   ```

## Best Practices

1. **Always run dry-run first**
2. **Review dry-run output carefully**
3. **Test on staging environment**
4. **Run during low-traffic periods**
5. **Validate results immediately after**
6. **Keep backups before execution**
7. **Monitor system performance during execution**

## Support

For issues or questions:
1. Check validation output for specific errors
2. Review audit trail in database
3. Use rollback feature if needed
4. Contact system administrator for complex issues

---

**⚠️ IMPORTANT**: This backfill affects payroll calculations. Ensure proper stakeholder approval before execution.