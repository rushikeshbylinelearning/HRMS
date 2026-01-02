# Intern Absent Day Calculation Fix

## Issues Fixed

### 1. **Leave Exclusion (CRITICAL)**
**Problem:** Absent days were being counted even when there was an approved leave on that date, causing double counting.

**Fix:** Added check to exclude dates that have approved leaves before counting as absent:
```javascript
// CRITICAL: Skip if there's an approved leave on this date (no double counting)
if (leaveDateSet.has(dateStr)) {
    currentDate.setDate(currentDate.getDate() + 1);
    continue;
}
```

### 2. **Date Range Correction**
**Problem:** Absents were being counted only up to `baseEndDateCalendar` instead of `todayIST`.

**Fix:** Changed the loop to count from joining date to TODAY:
```javascript
// Count absents from joining date to TODAY (not baseEndDateCalendar)
let currentDate = new Date(joiningDateIST);
while (currentDate <= todayIST) {  // Changed from maxDate to todayIST
    // ...
}
```

### 3. **Attendance Status Handling**
**Problem:** Half-day absents weren't being handled correctly, and attendance status checks were incomplete.

**Fix:** Improved logic to properly check attendance status:
```javascript
const attendanceLog = attendanceLogMap.get(dateStr);

if (!attendanceLog) {
    // No attendance record = absent (full day)
    absentFullDays++;
} else {
    const status = attendanceLog.attendanceStatus;
    const hasClockIn = !!attendanceLog.clockInTime;
    const hasClockOut = !!attendanceLog.clockOutTime;
    
    // Count as absent if:
    // 1. Status is explicitly 'Absent'
    // 2. OR no clock-in AND no clock-out (truly absent)
    if (status === 'Absent' || (!hasClockIn && !hasClockOut)) {
        absentFullDays++;
    } 
    // Count as half-day absent if:
    // 3. Status is 'Half-day' OR isHalfDay flag is true
    else if (status === 'Half-day' || attendanceLog.isHalfDay === true) {
        absentHalfDays += 0.5;
    }
    // Otherwise, employee was present (On-time or Late), do not count as absent
}
```

### 4. **Working Days Only**
**Problem:** Logic was already correct for excluding weekends/holidays, but now ensures leaves are also excluded.

**Fix:** The logic already properly excludes:
- Sundays
- Alternate Saturdays (non-working)
- Company holidays
- **NEW:** Approved leaves (prevents double counting)

### 5. **Data Structure Optimization**
**Problem:** Using `attendanceLogs.find()` inside loop was inefficient.

**Fix:** Created a Map for O(1) lookup:
```javascript
// Build map of attendance logs by date for quick lookup
const attendanceLogMap = new Map();
attendanceLogs.forEach(log => {
    if (log.attendanceDate) {
        attendanceLogMap.set(log.attendanceDate, log);
    }
});
```

## Complete Fixed Code Block

Replace the absent day calculation section in `/internship/calculations` route with:

```javascript
const attendanceLogs = await AttendanceLog.find({
    user: employee._id,
    attendanceDate: { $gte: joiningDateStr, $lte: formatDateIST(todayIST) }
}).lean();

// Build set of dates with approved leaves (to exclude from absent count)
const leaveDateSet = new Set(leaveDatesSet);

// Build map of attendance logs by date for quick lookup
const attendanceLogMap = new Map();
attendanceLogs.forEach(log => {
    if (log.attendanceDate) {
        attendanceLogMap.set(log.attendanceDate, log);
    }
});

let absentFullDays = 0;
let absentHalfDays = 0;

// Count absents from joining date to TODAY (not baseEndDateCalendar)
let currentDate = new Date(joiningDateIST);
while (currentDate <= todayIST) {
    const dateStr = formatDateIST(currentDate);
    if (!dateStr) break;
    const dayOfWeek = currentDate.getDay();
    
    // Skip Sundays
    if (dayOfWeek === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
    }
    
    // Skip alternate Saturdays (non-working Saturdays)
    if (dayOfWeek === 6) {
        if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
    }
    
    // Skip holidays
    if (allHolidayDatesSet.has(dateStr)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
    }
    
    // CRITICAL: Skip if there's an approved leave on this date (no double counting)
    if (leaveDateSet.has(dateStr)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
    }
    
    // This is a working day - check if absent
    const attendanceLog = attendanceLogMap.get(dateStr);
    
    if (!attendanceLog) {
        // No attendance record = absent (full day)
        absentFullDays++;
    } else {
        // Check attendance status
        const status = attendanceLog.attendanceStatus;
        const hasClockIn = !!attendanceLog.clockInTime;
        const hasClockOut = !!attendanceLog.clockOutTime;
        
        // Count as absent if:
        // 1. Status is explicitly 'Absent'
        // 2. OR no clock-in AND no clock-out (truly absent)
        if (status === 'Absent' || (!hasClockIn && !hasClockOut)) {
            absentFullDays++;
        } 
        // Count as half-day absent if:
        // 3. Status is 'Half-day' OR isHalfDay flag is true
        else if (status === 'Half-day' || attendanceLog.isHalfDay === true) {
            absentHalfDays += 0.5;
        }
        // Otherwise, employee was present (On-time or Late), do not count as absent
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
}
```

## Key Changes Summary

1. ✅ **Exclude leaves**: Dates with approved leaves are skipped before counting absents
2. ✅ **Date range**: Count from joining date to TODAY (not baseEndDateCalendar)
3. ✅ **Half-day handling**: Properly counts half-day absents as 0.5
4. ✅ **Status checks**: Comprehensive attendance status validation
5. ✅ **Performance**: Uses Map instead of find() for better performance
6. ✅ **Working days only**: Already correctly excludes weekends/holidays, now also excludes leaves

## Validation

After applying the fix, verify:
- ✅ Absent days don't count days with approved leaves
- ✅ Absent days are counted from joining date to today
- ✅ Half-day absents show as 0.5 in the total
- ✅ Absents on weekends/holidays are not counted
- ✅ Internship end date adjusts correctly based on accurate absent count







