# Probation Tracker Update - Policy Transition & Data Source Change

## Overview
Updated the probation tracker to use accurate attendance data from Admin Summary and implement date-based policy transition for working hours calculation.

## Changes Made

### 1. Data Source Change
**Before:** Used `resolveAttendanceStatus()` utility directly
**After:** Uses `AttendanceSummaryService.getEmployeeAttendanceSummary()`

**Reason:** The Admin Summary service provides the same accurate attendance data that admins see in the dashboard, ensuring consistency across the system.

### 2. Policy Transition Date
**Transition Date:** January 30, 2025

**Before Jan 30, 2025 (Old Policy - Time-based Attendance):**
- Full day = 8.0 worked hours or more
- Half-day absence = Less than 8.0 worked hours (extends probation by 0.5 days)
- Absent = No check-in (extends probation by 1 day)

**From Jan 30, 2025 onwards (New Policy - Elapsed Shift Time):**
- Full day = 9.0 elapsed shift hours or more
- Half-day = 5.0 to 8.9 elapsed shift hours (extends probation by 0.5 days)
- Absent = Less than 5.0 elapsed shift hours (extends probation by 1 day)

### 3. Calculation Logic

```javascript
// Date-based policy application
if (attendanceDate < '2025-01-30') {
  // OLD POLICY: Before Jan 30, 2025 (time-based attendance)
  // PROBATION RULE: Worked time >= 8 hours = full day present
  // Worked time < 8 hours = half-day absence (extends probation)
  if (totalWorkingHours > 0 && totalWorkingHours < 8.0) {
    halfDayAbsences++;
  }
} else {
  // NEW POLICY: From Jan 30, 2025 onwards (elapsed shift time)
  // Elapsed shift time >= 9 hours = full day present
  // Elapsed shift time 5-9 hours = half-day absence
  // Elapsed shift time < 5 hours = full-day absence
  if (totalWorkingHours >= 5.0 && totalWorkingHours < 9.0) {
    halfDayAbsences++;
  } else if (totalWorkingHours < 5.0 && totalWorkingHours > 0) {
    halfDayAbsences++;
  }
}
```

### 4. Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  PROBATION TRACKER DATA FLOW                 │
└─────────────────────────────────────────────────────────────┘

1. Fetch probation employees from User collection
   ├─ employmentStatus: 'Probation'
   ├─ isActive: true
   └─ role: { $ne: 'Intern' }

2. Fetch shared data (holidays, grace period, leaves)
   ├─ Holidays: All holidays in date range
   ├─ Grace Period: From settings
   └─ Leaves: All approved leaves for all employees

3. For each employee:
   ├─ Call AttendanceSummaryService.getEmployeeAttendanceSummary()
   │  └─ Returns: Array of daily attendance with resolved status
   │
   ├─ Process each day:
   │  ├─ Skip: Holidays and Weekly Offs
   │  ├─ Count: Full-day and half-day leaves
   │  └─ Count: Full-day and half-day absences
   │     └─ Apply date-based policy for working hours
   │
   └─ Calculate:
      ├─ Leave Extension = (Full-day × 1.0) + (Half-day × 0.5)
      ├─ Absence Extension = (Full-day × 1.0) + (Half-day × 0.5)
      ├─ Total Extension = Leave + Absence
      └─ Final End Date = Base End Date + Total Extension
```

### 5. Benefits

✅ **Consistency:** Uses same data source as Admin Dashboard
✅ **Accuracy:** AttendanceSummaryService is the single source of truth
✅ **Policy Compliance:** Correctly applies old vs new policy based on date
✅ **Transparency:** Clear transition date for policy change
✅ **Maintainability:** Centralized attendance logic

### 6. Testing Recommendations

1. **Test Old Policy (Before Jan 30, 2025):**
   - Employee with 8.0 hours → Should count as full day (no extension)
   - Employee with 8.5 hours → Should count as full day (no extension)
   - Employee with 7.5 hours → Should count as half-day absence (0.5 extension)
   - Employee with 6.0 hours → Should count as half-day absence (0.5 extension)
   - **Important**: Employee marked as "half-day" by system (late arrival) but has 8+ hours → Should count as full day (no extension)

2. **Test New Policy (After Jan 30, 2025):**
   - Employee with 9.0 hours → Should count as full day (no extension)
   - Employee with 7.0 hours → Should count as half-day absence (0.5 extension)
   - Employee with 4.5 hours → Should count as half-day absence (0.5 extension)
   - Employee with 3.0 hours → Should count as absent (1.0 extension)

3. **Test Transition:**
   - Employee joining before Jan 30 with attendance spanning the transition
   - Verify correct policy applied to each date

### 7. Configuration

**Policy Constants (in backend/routes/probation.js):**
```javascript
const POLICY_TRANSITION_DATE = '2025-01-30';
const OLD_POLICY_FULL_DAY_HOURS = 8.0; // Before Jan 30: >= 8 hours = full day
const NEW_POLICY_FULL_DAY_HOURS = 9.0; // After Jan 30: >= 9 hours = full day
const NEW_POLICY_HALF_DAY_HOURS = 5.0; // After Jan 30: < 5 hours = absent
```

To change the transition date or thresholds, update these constants.

### 8. Performance

- Uses batch queries (3 queries for all employees)
- Processes employees in parallel using Promise.all()
- 10-minute cache with manual refresh option
- No N+1 query issues

### 9. API Response Format

```json
{
  "employees": [
    {
      "employeeId": "507f1f77bcf86cd799439011",
      "employeeName": "John Doe",
      "employeeCode": "EMP001",
      "joiningDate": "2024-01-15",
      "baseProbationEndDate": "2024-07-15",
      "finalProbationEndDate": "2024-07-19",
      "fullDayLeaves": 2,
      "halfDayLeaves": 1,
      "leaveExtensionDays": 2.5,
      "fullDayAbsents": 1,
      "halfDayAbsents": 2,
      "absentExtensionDays": 2.0,
      "totalExtensionDays": 4.5,
      "holidaysExcluded": 2,
      "daysLeft": 145
    }
  ],
  "totalCount": 1
}
```

## Migration Notes

- No database migration required
- Existing probation data will be recalculated on next API call
- Cache will be invalidated automatically after 10 minutes
- Admins can manually refresh to see updated calculations

## Related Files

- `backend/routes/probation.js` - Main probation tracker endpoint
- `backend/services/AttendanceSummaryService.js` - Attendance data source
- `backend/routes/probationRoutes.js` - Supporting probation routes
- `frontend/src/components/ProbationTracker.jsx` - Frontend UI component
