# Insufficient Working Hours Half-Day Backfill

## Overview

This package provides a **SAFE, IDEMPOTENT** solution for backfilling historical attendance records where employees worked less than 8 hours but were not marked as Half Day due to previous system limitations.

## 🎯 Specific Problem Addressed

**Current System Behavior (Correct):**
- Records with `totalWorkedMinutes < 480` (8 hours) are marked as Half Day
- Reason: `INSUFFICIENT_WORKING_HOURS`

**Historical Problem:**
- Old records exist where employees worked < 8 hours
- These records are marked as `Present` or `Absent` instead of `Half Day`
- This creates inconsistency in attendance reporting

## 🚨 CRITICAL SAFETY RULES

**WILL NOT MODIFY:**
❌ Holidays  
❌ Weekly Offs (Sundays / alternate Saturdays)  
❌ Approved Leaves  
❌ Admin overridden records  
❌ Records already marked Half Day  
❌ Session timestamps  
❌ Payroll totals  

**WILL ONLY UPDATE:**
✅ Working days with attendance logs  
✅ Records with `totalWorkedMinutes < 480`  
✅ Records not already marked Half Day  
✅ Records not admin overridden  

## Files Included

1. **`backfill-insufficient-hours-half-day.js`** - Main backfill script
2. **`validate-insufficient-hours-backfill.js`** - Validation script
3. **`test-insufficient-hours-logic.js`** - Logic testing script
4. **`INSUFFICIENT_HOURS_BACKFILL_README.md`** - This documentation

## Eligibility Criteria

Records are eligible for backfill ONLY if ALL conditions are met:

- ✅ Has `clockInTime` (working day with attendance)
- ✅ Has attendance sessions with `totalWorkedMinutes < 480`
- ✅ `isHalfDay !== true` (not already marked)
- ✅ `overriddenByAdmin !== true` (not admin protected)
- ✅ `attendanceStatus !== 'Leave'` (not a leave record)
- ✅ No `leaveRequest` reference
- ✅ Not a holiday or weekly off (verified via resolver)
- ✅ Not already backfilled by this script

## Usage Instructions

### Phase 1: Test Logic (RECOMMENDED)

```bash
# Test the backfill logic without database changes
cd backend
node scripts/test-insufficient-hours-logic.js

# This will:
# - Test eligibility criteria
# - Test reason text generation
# - Show potential records count
# - Validate logic correctness
```

### Phase 2: Dry-Run Analysis (MANDATORY)

```bash
# Run dry-run to see what would be changed (NO ACTUAL CHANGES)
node scripts/backfill-insufficient-hours-half-day.js

# This will show:
# - Total records scanned
# - Eligible records found
# - Breakdown by category (already half-day, admin override, etc.)
# - Exact changes that would be made
# - No actual database modifications
```

### Phase 3: Review Configuration

Edit configuration in `backfill-insufficient-hours-half-day.js`:

```javascript
const CONFIG = {
    DRY_RUN: true,              // Keep true for testing
    BATCH_SIZE: 50,             // Process in small batches
    MIN_WORKING_MINUTES: 480,   // 8 hours threshold
    VERBOSE_LOGGING: true,      // Detailed logging
    DATE_RANGE: {
        startDate: '2024-01-01', // Optional: limit date range
        endDate: '2024-12-31'    // Optional: limit date range
    }
};
```

### Phase 4: Execute Backfill (LIVE CHANGES)

```bash
# Execute the actual backfill (MAKES REAL CHANGES)
node scripts/backfill-insufficient-hours-half-day.js --execute

# This will:
# - Process records in batches
# - Update eligible records only
# - Add complete audit metadata
# - Show progress and detailed summary
```

### Phase 5: Validate Results (MANDATORY)

```bash
# Validate the backfill results
node scripts/validate-insufficient-hours-backfill.js

# This will:
# - Verify only records with < 8 hours were marked
# - Check no protected records were touched
# - Validate audit trail completeness
# - Generate detailed backfill report
# - Identify any issues
```

### Phase 6: Rollback (If Needed)

```bash
# Rollback all backfill changes if needed
node scripts/backfill-insufficient-hours-half-day.js --rollback

# This will:
# - Find all records backfilled by this script
# - Revert them to previous state
# - Remove backfill metadata
```

## What Gets Updated

For each eligible record, the script updates ONLY these fields:

```javascript
{
    status: 'Half Day',
    isHalfDay: true,
    attendanceStatus: 'Half-day',
    halfDayReasonCode: 'INSUFFICIENT_WORKING_HOURS',
    halfDayReasonText: 'Worked 6h 30m, minimum required is 8h',
    halfDaySource: 'AUTO',
    
    // Audit metadata
    backfilledAt: new Date(),
    backfilledBy: 'SYSTEM_BACKFILL_2026_INSUFFICIENT_HOURS',
    backfillVersion: 'v1.0',
    backfillReason: 'Historical insufficient working hours correction'
}
```

**NEVER MODIFIED:**
- `clockInTime` / `clockOutTime`
- `sessions` array
- `leaveRequest` references
- `overriddenByAdmin` flags
- Any payroll-related fields

## Expected Output Examples

### Test Logic Output:
```
🧪 Testing Insufficient Hours Backfill Logic...

Test 1: Eligible: 6.5 hours worked
────────────────────────────────────────────────────────────
Worked Minutes: 390 (6h 30m)
Clock-in: Yes
Is Half Day: false
Admin Override: false
Status: Present
Eligible: true
Reason: INSUFFICIENT_WORKING_HOURS
Generated Reason: "Worked 6h 30m, minimum required is 8h"
Expected Reason: "Worked 6h 30m, minimum required is 8h"
Expected Eligible: true
Test Result: ✅ PASSED

🎯 TEST SUMMARY: 8/8 tests passed
✅ All tests passed! Logic is working correctly.
```

### Dry-Run Output:
```
🚀 Starting Insufficient Working Hours Half-Day Backfill...
📋 Mode: DRY-RUN (no changes will be made)
📅 Date Range: All to All
⚙️  Batch Size: 50
⏰ Min Working Minutes: 480 (8h)

📊 Total records to scan: 2,450

📦 Processing batch 1/49 (records 1-50)
✅ [DRY-RUN] John Doe (2024-03-15): Worked 6h 30m, minimum required is 8h
✅ [DRY-RUN] Jane Smith (2024-03-20): Worked 7h 15m, minimum required is 8h

================================================================================
📊 BACKFILL SUMMARY
================================================================================
Total Records Scanned: 2,450
Eligible for Backfill: 127
Already Half-Day: 1,890
Admin Overridden (Protected): 45
Leave Records (Skipped): 298
Holiday/Weekly Off (Skipped): 67
Sufficient Hours (Skipped): 23
Would Update: 127
Errors: 0

👥 EMPLOYEE SUMMARY:
  - John Doe: 8 records
    Dates: 2024-03-15, 2024-03-22, 2024-03-28, 2024-04-05, 2024-04-12
  - Jane Smith: 5 records
    Dates: 2024-03-20, 2024-04-02, 2024-04-18, 2024-05-03, 2024-05-17

🔄 This was a DRY-RUN. No changes were made.
💡 Set CONFIG.DRY_RUN = false to execute the backfill.
```

### Live Execution Output:
```
🚀 Starting Insufficient Working Hours Half-Day Backfill...
📋 Mode: LIVE EXECUTION

✅ John Doe (2024-03-15): Worked 6h 30m, minimum required is 8h
✅ Jane Smith (2024-03-20): Worked 7h 15m, minimum required is 8h

================================================================================
📊 BACKFILL SUMMARY
================================================================================
Total Records Scanned: 2,450
Eligible for Backfill: 127
Updated: 127
Errors: 0

✅ Backfill completed successfully!
🔍 Run validation script to verify results.
```

### Validation Output:
```
🔍 Starting Insufficient Hours Backfill Validation...
📊 Found 127 backfilled records to validate...

🛡️  VALIDATING PROTECTED RECORDS
==================================================
✅ No admin overridden records were backfilled
✅ No leave records were backfilled
✅ No already half-day records were double-backfilled

================================================================================
📊 VALIDATION SUMMARY
================================================================================
Backfilled Records Found: 127
Valid Backfills: 127
Invalid Backfills: 0
Complete Audit Trail: 127
Protected Record Issues: 0
Validation Errors: 0

✅ All backfilled records passed validation!

📊 DETAILED BACKFILL REPORT
==================================================
Total Backfilled Records: 127
Average Worked Time: 6h 45m

PER-EMPLOYEE BREAKDOWN:
👤 John Doe (EMP001)
   Records: 8, Avg: 6h 30m
   - 2024-03-15: 6h 30m
   - 2024-03-22: 6h 45m
   - 2024-03-28: 6h 15m

MONTHLY DISTRIBUTION:
  2024-03: 45 records
  2024-04: 52 records
  2024-05: 30 records

🎯 OVERALL VALIDATION: ✅ PASSED
✅ Backfill validation successful! All records are correctly processed.
```

## Safety Features

### 1. Idempotent Operation
- Safe to run multiple times
- Skips already processed records
- Uses unique backfill identifier

### 2. Comprehensive Validation
- Verifies working hours calculation
- Checks protected records remain untouched
- Validates audit trail completeness

### 3. Complete Audit Trail
- Every change is tracked with metadata
- Enables full rollback capability
- Compliance-ready documentation

### 4. Batch Processing
- Processes records in small batches
- Prevents memory issues
- Allows progress monitoring

## Troubleshooting

### Common Issues:

1. **"No records found matching criteria"**
   - All eligible records may already be correctly marked
   - Check date range configuration
   - Verify database connection

2. **"Validation errors found"**
   - Review specific error details
   - Check for data inconsistencies
   - May indicate logic issues

3. **"Protected records were modified"**
   - CRITICAL: Stop and investigate
   - Run rollback immediately
   - Review eligibility logic

### Recovery Steps:

1. **If backfill fails:**
   ```bash
   # Check what was processed
   node scripts/validate-insufficient-hours-backfill.js
   
   # Re-run backfill (idempotent)
   node scripts/backfill-insufficient-hours-half-day.js --execute
   ```

2. **If results are incorrect:**
   ```bash
   # Rollback all changes
   node scripts/backfill-insufficient-hours-half-day.js --rollback
   
   # Review and fix issues
   # Re-run dry-run
   ```

## Best Practices

1. **Always test logic first**: `node scripts/test-insufficient-hours-logic.js`
2. **Always run dry-run first**: Review output carefully
3. **Test on staging**: Validate on non-production data
4. **Run during low-traffic**: Minimize system impact
5. **Validate immediately**: Run validation script after execution
6. **Monitor system**: Watch for performance impact
7. **Keep backups**: Ensure database backups before execution

## Technical Details

### Working Hours Calculation
- Uses `AttendanceSession` records to calculate total worked time
- Formula: `sum(endTime - startTime)` for all sessions
- Rounds to nearest minute for consistency

### Reason Text Format
- Pattern: `"Worked {hours}h {minutes}m, minimum required is 8h"`
- Examples: `"Worked 6h 30m, minimum required is 8h"`
- Omits minutes if zero: `"Worked 7h, minimum required is 8h"`

### Database Safety
- Uses MongoDB transactions for atomicity
- Batch processing prevents memory issues
- Unique constraints prevent duplicates

---

**⚠️ IMPORTANT**: This backfill affects payroll calculations. Ensure proper stakeholder approval and testing before production execution.