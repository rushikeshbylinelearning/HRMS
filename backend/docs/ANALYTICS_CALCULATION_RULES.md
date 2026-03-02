# Analytics Calculation Rules

## Overview
This document defines the MANDATORY calculation rules for attendance analytics. These rules are enforced by validation logic and must NEVER be violated.

## Critical Business Logic

### 1. Absent Days Calculation
```
Absent Days = COUNT(attendanceStatus == "Absent")
```

**Rules:**
- Status must be exactly "Absent" (case-sensitive)
- Exclude records with status "Holiday" or "Weekend"
- Handle half-days: count as 0.5 if `isHalfDay == true`
- Only count records within the date range
- Only count records after employee join date and before exit date (if inactive)

**Implementation:**
```javascript
isAbsentDay: {
    $cond: [
        {
            $and: [
                { $eq: ['$attendanceStatus', 'Absent'] },
                { $ne: ['$attendanceStatus', 'Holiday'] },
                { $ne: ['$attendanceStatus', 'Weekend'] }
            ]
        },
        true,
        false
    ]
}
```

### 2. Leave Days Calculation
```
Leave Days = COUNT(attendanceStatus == "Leave" AND leaveRequest != null)
```

**Rules:**
- Status must be exactly "Leave"
- Must have a valid `leaveRequest` reference
- Handle half-days: count as 0.5 if `isHalfDay == true`
- Only count approved leaves

**Implementation:**
```javascript
isLeaveDay: {
    $cond: [
        {
            $and: [
                { $eq: ['$attendanceStatus', 'Leave'] },
                { $ne: [{ $ifNull: ['$leaveRequest', null] }, null] }
            ]
        },
        true,
        false
    ]
}
```

### 3. Non-Working Days Calculation (CRITICAL)
```
Non-Working Days = Leave Days + Absent Days
```

**Definition:** Non-Working Days represents days when the employee was expected to work but did not (either on leave or absent). It does NOT include weekends or holidays.

**THIS IS THE ONLY CORRECT FORMULA. DO NOT USE ANY OTHER CALCULATION.**

**WRONG Formulas (DO NOT USE):**
- ❌ `Non-Working Days = Total Days - Present Days`
- ❌ `Non-Working Days += Non-Working Days` (self-add bug)
- ❌ `Non-Working Days = Leave Days + Absent Days + Holidays`
- ❌ `Non-Working Days = Leave Days + Absent Days + Weekends`
- ❌ `Non-Working Days = Weekends + Holidays` (counting non-working calendar days)
- ❌ Any formula involving total days or calendar days
- ❌ Any formula that includes weekends or holidays

**Correct Implementation:**
```javascript
// Calculate after counting leave and absent days
const nonWorkingDays = leaveDays + absentDays;
```

**What IS included:**
- Leave Days (approved leaves)
- Absent Days (unauthorized absences)

**What is NOT included:**
- Weekends (Saturday/Sunday or configured weekly offs)
- Public Holidays
- Any day marked as "Holiday", "Weekly Off", or "Weekend" status

**Validation:**
```javascript
if (nonWorkingDays !== leaveDays + absentDays) {
    throw new Error("Non-Working Days calculation error");
}
```

### 4. Present Days Calculation
```
Present Days = COUNT(attendanceStatus IN ["On-time", "Late"])
```

**Rules:**
- Status must be "On-time" or "Late"
- Exclude "Holiday" and "Weekend"
- Handle half-days: count as 0.5 if `isHalfDay == true`

### 5. Total Considered Days
```
Total Considered Days = Present Days + Leave Days + Absent Days
```

**Rules:**
- This represents the total working days in the period
- Does NOT include Holidays or Weekends
- Does NOT include future dates
- Does NOT include dates before join date or after exit date

### 6. Attendance Percentage
```
Attendance % = (Present Days / Total Considered Days) × 100
```

**Rules:**
- Only considers working days (excludes holidays/weekends)
- If Total Considered Days = 0, return 0%
- Round to 2 decimal places

### 7. Average Working Hours
```
Average Working Hours = Total Net Hours / Present Days
```

**Rules:**
- Only divide by Present Days (NOT total days)
- If Present Days = 0, return 0
- Use pre-computed `totalWorkingHours` from AttendanceLog
- Round to 2 decimal places

## Data Source

**Single Source of Truth:** `AttendanceLog` collection

**DO NOT use:**
- Raw punch logs
- Shift records
- Payroll tables
- Calculated values from other sources

## Edge Cases

### Mid-Month Joiners
- Start counting from `joiningDate`
- Exclude all dates before joining

### Mid-Month Exits
- Stop counting at exit date
- Use `updatedAt` as approximation for exit date if `isActive == false`

### Half-Day Records
- Count as 0.5 days
- Apply to Present, Leave, or Absent as appropriate
- Maintain the formula: `Non-Working = Leave + Absent` (both as 0.5 if half-day)

### Null Status Values
- Ignore records with `null` or `undefined` status
- Log warning for data quality issues

## Validation Rules

### Mandatory Validations (Enforced)

1. **Non-Working Days Invariant (CRITICAL)**
   ```
   nonWorkingDays === leaveDays + absentDays (within 0.01 tolerance)
   ```
   - Severity: CRITICAL
   - Action: Throw error if violated

2. **Non-Negative Values**
   ```
   All numeric metrics >= 0
   ```
   - Severity: ERROR
   - Action: Log error

3. **Average Hours Consistency**
   ```
   avgWorkingHours > 0 implies presentDays > 0
   ```
   - Severity: ERROR
   - Action: Log error

### Debug Logging

In development mode, log sample calculations:
```javascript
console.log({
    employee,
    present,
    leave,
    absent,
    nonWorking,
    expected: leave + absent,
    match: nonWorking === (leave + absent) ? '✓' : '✗'
});
```

## Testing

### Unit Tests
- Test each calculation formula independently
- Test edge cases (half-days, nulls, etc.)
- Test validation logic

### Integration Tests
- Test full aggregation pipeline
- Verify all employees pass validation
- Test with real data samples

### Verification Script
Run `backend/scripts/verify-analytics-fix.js` to validate:
- All calculations are correct
- No validation errors
- 100% test pass rate

## Troubleshooting

### Issue: Absent Days showing 0
**Check:**
1. Status value is exactly "Absent" (case-sensitive)
2. Records exist in date range
3. Employee is active
4. Records are after join date

### Issue: Non-Working Days incorrect
**Check:**
1. Formula is `$add: ['$leaveDays', '$absentDays']`
2. No self-add bug: `nonWorkingDays += nonWorkingDays`
3. Not using total days formula
4. Validation is enabled

### Issue: Validation errors
**Action:**
1. Check console logs for specific error
2. Verify data integrity in AttendanceLog
3. Run verification script
4. Check for null/undefined values

## Maintenance

### When Modifying Analytics Logic
1. Update this document
2. Update validation rules
3. Run verification script
4. Test with production data sample
5. Review validation logs

### Code Review Checklist
- [ ] Non-Working Days formula is correct
- [ ] Validation logic is present
- [ ] Edge cases are handled
- [ ] Tests are updated
- [ ] Documentation is updated

## References

- Implementation: `backend/services/AnalyticsService.js`
- Validation: `validateMetrics()` function
- Tests: `backend/scripts/verify-analytics-fix.js`
- Model: `backend/models/AttendanceLog.js`
