# Saturday Clubbing Policy Audit Report
**Date:** February 6, 2026  
**System:** Attendance Management System  
**Focus:** Saturday Policy Implementation & Clubbing Logic Verification

---

## Executive Summary

This audit verifies the Saturday Clubbing Policy implementation across backend and frontend. The system correctly handles Saturday classification and includes worked Saturday hours in weekly totals, but there are **critical inconsistencies** in payable hours calculation and expected hours display.

**Overall Status:** ⚠️ **PARTIALLY WORKING** - Core logic is correct, but UI/UX inconsistencies exist.

---

## 1. Backend Logic Verification

### ✅ 1.1 Saturday Classification

**Location:** `backend/utils/attendanceStatusResolver.js:44-81` (isWeeklyOff), `backend/services/LeavePolicyService.js:820-837` (isSaturdayOff)

**Status:** ✅ **WORKING CORRECTLY**

**Implementation:**
- Sunday is always weekly off (`dayOfWeek === 0`)
- Saturday classification uses `LeavePolicyService.isSaturdayOff()` which correctly implements:
  - `'All Saturdays Working'` → Always working
  - `'All Saturdays Off'` → Always off
  - `'Week 1 & 3 Off'` → Off on 1st and 3rd Saturday of month
  - `'Week 2 & 4 Off'` → Off on 2nd and 4th Saturday of month

**Week Number Calculation:**
```javascript
const weekNum = Math.ceil(date.getDate() / 7);
```
- ✅ Correctly identifies 1st, 2nd, 3rd, 4th Saturday of month
- Example: Jan 6 (Sat) → weekNum = 1, Jan 13 (Sat) → weekNum = 2, etc.

**Precedence Order (from `resolveAttendanceStatus`):**
1. Holiday (highest priority)
2. Approved Leave
3. Weekly Off (Saturday/Sunday based on policy)
4. Present (has attendance sessions)
5. Absent

---

### ✅ 1.2 Saturday Worked on Weekly-Off Day

**Location:** `backend/utils/attendanceStatusResolver.js:204-248`

**Status:** ✅ **WORKING CORRECTLY**

**Logic:**
```javascript
const weeklyOffFlag = isWeeklyOff(date, saturdayPolicy);
const hasSessions = attendanceLog && attendanceLog.sessions && 
                   Array.isArray(attendanceLog.sessions) && 
                   attendanceLog.sessions.length > 0;

if (weeklyOffFlag && !hasSessions) {
    // Weekly Off status
} else if (weeklyOffFlag && hasSessions) {
    // Skip weekly off status, continue to check attendance → Present
}
```

**Behavior:**
- ✅ If Saturday is weekly off AND employee worked (has sessions) → Status = "Present" (not "Weekly Off")
- ✅ If Saturday is weekly off AND employee didn't work → Status = "Weekly Off"
- ✅ This correctly implements "clubbing" - worked hours are counted even on weekly off days

---

### ✅ 1.3 Saturday Hours in Weekly Totals

**Location:** `backend/routes/attendance.js:1601` (totalWorkedMinutes calculation)

**Status:** ✅ **WORKING CORRECTLY**

**Implementation:**
```javascript
totalWorkedMinutes: log?.totalWorkingHours ? Math.round(log.totalWorkingHours * 60) : 0
```

**Behavior:**
- ✅ Saturday worked hours (`totalWorkedMinutes`) are included in weekly totals
- ✅ Calculated from `totalWorkingHours` field (net of breaks)
- ✅ No special exclusion logic - Saturday is treated like any other day when worked
- ✅ If Saturday is weekly off and NOT worked → `totalWorkedMinutes = 0` (correct)

**Clubbing Confirmation:**
- ✅ Saturday worked hours **ARE** added to weekly total
- ✅ Saturday worked hours **DO** affect payable hours (if status is Present)
- ✅ Saturday worked hours **DO** affect present day count (if status is Present/On-time/Late/Half-day)

---

### ✅ 1.4 Payable Hours Calculation

**Location:** `backend/routes/attendance.js:1603-1626`

**Status:** ✅ **LOGIC CORRECT**, ⚠️ **CONCEPTUAL MISMATCH WITH FRONTEND**

**Implementation:**
```javascript
payableMinutes: (() => {
    const FULL_DAY_MINUTES = SHIFT_WORKING_MINUTES; // 510 minutes (8.5 hrs)
    const HALF_DAY_MINUTES = 255; // 4.25 hrs
    
    if (statusInfo.status === 'Holiday' || statusInfo.status === 'Weekly Off') {
        return 0; // ✅ Saturday weekly off = 0 payable
    }
    if (statusInfo.status === 'Leave') {
        if (statusInfo.isHalfDay) return 270; // Half-day leave
        return 0; // Full day leave
    }
    if (statusInfo.status === 'Half-day' || statusInfo.isHalfDay) {
        return HALF_DAY_MINUTES; // 255 min
    }
    if (statusInfo.status === 'Absent') {
        return 0;
    }
    // Present or other status - full day
    return FULL_DAY_MINUTES; // ✅ Saturday worked = 510 min (8.5 hrs) payable
})()
```

**Behavior:**
- ✅ Saturday worked on weekly-off day → `payableMinutes = 510` (full day)
- ✅ Saturday weekly off (not worked) → `payableMinutes = 0`
- ✅ Saturday half-day → `payableMinutes = 255`
- ✅ Saturday holiday → `payableMinutes = 0` (holiday takes precedence)

**Issue:** Backend uses **8.5 hours per day** (510 min), but frontend expects **9 hours per day** (540 min) for weekly expected hours calculation.

---

### ✅ 1.5 Present Days Count

**Location:** `frontend/src/components/AttendanceTimeline.jsx:80-89`

**Status:** ✅ **WORKING CORRECTLY**

**Implementation:**
```javascript
const summaryStats = useMemo(() => {
    const stats = { present: 0 };
    weekDays.forEach(day => {
        if (day.log && day.log.attendanceStatus && 
            ['On-time', 'Late', 'Half-day'].includes(day.log.attendanceStatus)) {
            stats.present++;
        }
    });
    return stats;
}, [weekDays]);
```

**Behavior:**
- ✅ Saturday worked (status = On-time/Late/Half-day) → Counted as present
- ✅ Saturday weekly off (not worked) → NOT counted (status = "Weekly Off")
- ✅ Saturday holiday → NOT counted (status = "Holiday")
- ✅ This correctly implements clubbing - worked Saturday counts as present day

---

## 2. Weekly Expected Hours Calculation

### ⚠️ 2.1 Frontend Expected Hours

**Location:** `frontend/src/utils/saturdayUtils.js:225-230`

**Status:** ⚠️ **INCORRECT HOURS PER DAY**

**Implementation:**
```javascript
export const getExpectedWeeklyWorkingHours = (saturdayPolicy, weekSaturdayDate) => {
  const workingSaturday = isWorkingSaturday(weekSaturdayDate, saturdayPolicy || 'All Saturdays Working');
  const workingDays = workingSaturday ? 6 : 5;
  const expectedMinutes = workingDays * 9 * 60; // ❌ Uses 9 hrs/day = 540 min/day
  return { workingDays, expectedMinutes };
};
```

**Issues:**
1. ❌ Uses **9 hours per day** (540 minutes) but backend pays **8.5 hours per day** (510 minutes)
2. ❌ Mismatch: Frontend shows 54 hrs (6×9) or 45 hrs (5×9), but backend pays 51 hrs (6×8.5) or 42.5 hrs (5×8.5)

**Correct Calculation Should Be:**
```javascript
const expectedMinutes = workingDays * 8.5 * 60; // 8.5 hrs/day = 510 min/day
// 6 days → 51 hrs (3060 min)
// 5 days → 42.5 hrs (2550 min)
```

---

### ✅ 2.2 Saturday Policy Deduction

**Location:** `frontend/src/utils/saturdayUtils.js:199-216` (isWorkingSaturday)

**Status:** ✅ **WORKING CORRECTLY**

**Implementation:**
- ✅ Correctly identifies working vs non-working Saturdays
- ✅ Correctly reduces expected working days from 6 to 5 when Saturday is off
- ✅ Week number calculation is correct for Saturday determination

---

### ⚠️ 2.3 Holidays + Saturday Off Double-Deduction

**Location:** `backend/utils/attendanceStatusResolver.js:129-154` (Holiday check), `204-246` (Weekly Off check)

**Status:** ✅ **NO DOUBLE-DEDUCTION** - Holidays take precedence

**Behavior:**
- ✅ Holiday check happens FIRST (highest priority)
- ✅ If Saturday is a holiday → Status = "Holiday", `isWeeklyOff = false`
- ✅ Payable minutes = 0 (holiday), not double-counted as weekly off
- ✅ Correct precedence prevents double-deduction

---

## 3. Attendance Timeline (UI) Verification

### ✅ 3.1 Saturday Card Rendering

**Location:** `frontend/src/components/DailyTimelineRow.jsx:447-467`

**Status:** ✅ **WORKING CORRECTLY**

**Implementation:**
- ✅ Weekly Off status displays correctly with label "Weekly Off"
- ✅ Status reason shows policy (e.g., "Saturday - Week 1 & 3 Off")
- ✅ Timeline bars are hidden for weekly off (no sessions)
- ✅ Click behavior prevents opening modal for weekly off without data (line 220-222)

**Code:**
```javascript
const isAbsentWeekOffOrWeekend = status === 'Absent' || status === 'Weekly Off' || status === 'Week Off' || status === 'Weekend';
const shouldPreventClick = isAbsentWeekOffOrWeekend && hasNoAttendanceData && !leave && !dayData.holiday;
```

---

### ✅ 3.2 Status Consistency

**Location:** `frontend/src/components/AttendanceTimeline.jsx:49-78`

**Status:** ✅ **CONSISTENT** - Frontend uses backend status

**Behavior:**
- ✅ Frontend uses `log.attendanceStatus` from backend (no recalculation)
- ✅ Frontend uses `log.isWeeklyOff` flag from backend
- ✅ Frontend uses `log.holidayInfo` and `log.leaveInfo` from backend
- ✅ No frontend override of backend decisions

**Defensive Check:**
```javascript
if (process.env.NODE_ENV === 'development' && log) {
    if ((log.isHoliday || log.isWeeklyOff) && log.attendanceStatus === 'Absent') {
        console.warn(`[STATUS MISMATCH] ...`);
    }
}
```

---

## 4. Summary Section Validation

### ⚠️ 4.1 Total Hours Display

**Location:** `frontend/src/components/AttendanceTimeline.jsx:91-105`

**Status:** ✅ **WORKING CORRECTLY**

**Implementation:**
- ✅ Uses backend `summary.totalWorkedMinutes` if available
- ✅ Fallback sums `day.log.totalWorkedMinutes` from all days
- ✅ Saturday worked hours ARE included in total
- ✅ Saturday weekly off (not worked) → 0 minutes (correct)

---

### ❌ 4.2 Payable Hours Display

**Location:** `frontend/src/components/AttendanceTimeline.jsx:107-115`

**Status:** ❌ **SHOWS EXPECTED HOURS, NOT ACTUAL PAYABLE HOURS**

**Implementation:**
```javascript
const payableHours = useMemo(() => {
    const saturdayDate = weekDays.length > 6 ? weekDays[6].date : null;
    if (saturdayDate) {
        const { expectedMinutes } = getExpectedWeeklyWorkingHours(saturdayPolicy, saturdayDate);
        return formatDuration(expectedMinutes); // ❌ Shows expected, not actual payable
    }
    return formatDuration(54 * 60); // default 54 hrs
}, [weekDays, saturdayPolicy]);
```

**Issues:**
1. ❌ Shows **expected** weekly hours (54/45 hrs) instead of **actual payable** hours
2. ❌ Doesn't sum `payableMinutes` from backend logs
3. ❌ Misleading label - says "Payable Hours" but shows expected hours
4. ❌ Uses 9 hrs/day instead of 8.5 hrs/day

**Should Be:**
```javascript
const payableHours = useMemo(() => {
    // Sum actual payable minutes from backend logs
    let totalPayableMinutes = 0;
    weekDays.forEach(day => {
        if (day.log && day.log.payableMinutes !== undefined) {
            totalPayableMinutes += day.log.payableMinutes;
        }
    });
    return formatDuration(totalPayableMinutes);
}, [weekDays]);
```

---

### ✅ 4.3 Present Days Count

**Location:** `frontend/src/components/AttendanceTimeline.jsx:80-89`

**Status:** ✅ **WORKING CORRECTLY**

**Behavior:**
- ✅ Counts days with status ['On-time', 'Late', 'Half-day']
- ✅ Saturday worked → Counted as present
- ✅ Saturday weekly off (not worked) → NOT counted
- ✅ Saturday holiday → NOT counted
- ✅ Correctly implements clubbing logic

---

## 5. Edge Cases Analysis

### ✅ 5.1 Saturday Worked on Weekly-Off Policy

**Status:** ✅ **HANDLED CORRECTLY**

- ✅ Status = "Present" (not "Weekly Off")
- ✅ `totalWorkedMinutes` includes Saturday hours
- ✅ `payableMinutes = 510` (full day)
- ✅ Present days count includes Saturday
- ✅ Clubbing works as expected

**Test Case:**
- Employee with "Week 1 & 3 Off" policy
- Works on 1st Saturday of month
- Result: Status = "Present", Hours counted, Payable = 510 min

---

### ✅ 5.2 Half-Day on Saturday

**Status:** ✅ **HANDLED CORRECTLY**

- ✅ Status = "Half-day"
- ✅ `totalWorkedMinutes` includes actual worked hours
- ✅ `payableMinutes = 255` (half-day)
- ✅ Present days count includes Saturday

---

### ✅ 5.3 Leave on Saturday

**Status:** ✅ **HANDLED CORRECTLY**

- ✅ Status = "Leave" (takes precedence over weekly off)
- ✅ `totalWorkedMinutes = 0` (no attendance log)
- ✅ `payableMinutes = 0` (full day leave) or `270` (half-day leave)
- ✅ Present days count does NOT include Saturday

---

### ✅ 5.4 Holiday Falling on Saturday

**Status:** ✅ **HANDLED CORRECTLY**

- ✅ Status = "Holiday" (highest precedence)
- ✅ `isWeeklyOff = false` (holiday takes precedence)
- ✅ `totalWorkedMinutes = 0` (if not worked)
- ✅ `payableMinutes = 0`
- ✅ Present days count does NOT include Saturday

**Test Case:**
- Saturday is a holiday
- Employee has "Week 1 & 3 Off" policy
- Result: Status = "Holiday" (not "Weekly Off"), No payable hours

---

### ✅ 5.5 Cross-Day Overnight Shifts (Friday → Saturday)

**Status:** ✅ **HANDLED CORRECTLY**

- ✅ Sessions are tracked per day
- ✅ Friday session ending on Saturday → Counted in Friday's log
- ✅ Saturday session starting on Saturday → Counted in Saturday's log
- ✅ No double-counting or misattribution

---

## 6. Data Flow Consistency

### ✅ 6.1 Backend as Single Source of Truth

**Status:** ✅ **CONSISTENT**

**Backend Computes:**
- ✅ `attendanceStatus` (Present/Weekly Off/Holiday/Leave/Absent)
- ✅ `totalWorkedMinutes` (from `totalWorkingHours`)
- ✅ `payableMinutes` (based on status)
- ✅ `isWeeklyOff` flag
- ✅ `isHoliday` flag
- ✅ `holidayInfo` and `leaveInfo` objects

**Frontend Uses:**
- ✅ All backend-computed fields directly
- ✅ No recalculation of attendance rules
- ✅ Only calculates display formatting (duration strings, etc.)

---

### ⚠️ 6.2 Fallback Logic Risks

**Location:** `frontend/src/components/AttendanceTimeline.jsx:96-104`

**Status:** ⚠️ **RISKY FALLBACK**

**Issue:**
```javascript
// Fallback: Calculate from weekDays (only for backward compatibility)
let totalMinutes = 0;
weekDays.forEach(day => {
    if (day.log && day.log.totalWorkedMinutes) {
        totalMinutes += day.log.totalWorkedMinutes;
    }
});
```

**Risk:**
- ⚠️ If backend `summary.totalWorkedMinutes` is missing, frontend sums individual logs
- ⚠️ This could cause mismatch if backend aggregation logic differs
- ⚠️ Should log warning when fallback is used

**Recommendation:**
- Always require backend summary
- Log warning if fallback is used
- Ensure backend always provides summary

---

## 7. Critical Issues Summary

### ❌ Issue #1: Payable Hours Mismatch (CRITICAL)

**Severity:** 🔴 **HIGH**

**Problem:**
- Frontend "Payable Hours" shows **expected** weekly hours (54/45 hrs)
- Should show **actual payable** hours summed from backend `payableMinutes`
- Uses 9 hrs/day instead of 8.5 hrs/day

**Impact:**
- Misleading UI - employees see expected hours, not what they'll actually be paid
- Inconsistent with backend calculation

**Fix Required:**
```javascript
// frontend/src/components/AttendanceTimeline.jsx:107-115
const payableHours = useMemo(() => {
    // Sum actual payable minutes from backend logs
    let totalPayableMinutes = 0;
    weekDays.forEach(day => {
        if (day.log && day.log.payableMinutes !== undefined) {
            totalPayableMinutes += day.log.payableMinutes;
        }
    });
    return formatDuration(totalPayableMinutes);
}, [weekDays]);
```

---

### ⚠️ Issue #2: Expected Hours Calculation (MEDIUM)

**Severity:** 🟡 **MEDIUM**

**Problem:**
- `getExpectedWeeklyWorkingHours` uses 9 hrs/day (540 min)
- Backend pays 8.5 hrs/day (510 min)
- Creates confusion about expected vs actual hours

**Impact:**
- Inconsistent expectations
- Should match backend shift policy

**Fix Required:**
```javascript
// frontend/src/utils/saturdayUtils.js:225-230
export const getExpectedWeeklyWorkingHours = (saturdayPolicy, weekSaturdayDate) => {
  const workingSaturday = isWorkingSaturday(weekSaturdayDate, saturdayPolicy || 'All Saturdays Working');
  const workingDays = workingSaturday ? 6 : 5;
  const expectedMinutes = workingDays * 8.5 * 60; // 8.5 hrs/day = 510 min/day
  return { workingDays, expectedMinutes };
};
```

**Note:** This function may be used elsewhere - verify all usages before changing.

---

### ⚠️ Issue #3: Fallback Logic Risk (LOW)

**Severity:** 🟢 **LOW**

**Problem:**
- Frontend has fallback calculation if backend summary is missing
- Could cause inconsistencies

**Impact:**
- Low risk if backend always provides summary
- Should add logging to detect when fallback is used

---

## 8. What Is Working Correctly

### ✅ Core Saturday Clubbing Logic

1. ✅ Saturday classification based on policy
2. ✅ Saturday worked on weekly-off day → Counted as Present
3. ✅ Saturday hours included in weekly totals
4. ✅ Saturday hours affect payable hours
5. ✅ Saturday worked counts as present day
6. ✅ Backend precedence (Holiday > Leave > Weekly Off > Present > Absent)
7. ✅ Status consistency between backend and frontend
8. ✅ No frontend override of backend decisions

### ✅ Edge Cases

1. ✅ Half-day on Saturday
2. ✅ Leave on Saturday
3. ✅ Holiday on Saturday
4. ✅ Overnight shifts
5. ✅ Saturday worked on weekly-off policy

---

## 9. Recommended Fixes

### 🔴 Priority 1: Fix Payable Hours Display

**File:** `frontend/src/components/AttendanceTimeline.jsx`

**Change:**
```javascript
// Current (WRONG):
const payableHours = useMemo(() => {
    const saturdayDate = weekDays.length > 6 ? weekDays[6].date : null;
    if (saturdayDate) {
        const { expectedMinutes } = getExpectedWeeklyWorkingHours(saturdayPolicy, saturdayDate);
        return formatDuration(expectedMinutes);
    }
    return formatDuration(54 * 60);
}, [weekDays, saturdayPolicy]);

// Fixed (CORRECT):
const payableHours = useMemo(() => {
    // Sum actual payable minutes from backend logs
    let totalPayableMinutes = 0;
    weekDays.forEach(day => {
        if (day.log && day.log.payableMinutes !== undefined) {
            totalPayableMinutes += day.log.payableMinutes;
        }
    });
    return formatDuration(totalPayableMinutes);
}, [weekDays]);
```

**Also Consider:**
- Rename label to "Expected Payable Hours" if showing expected, OR
- Change to show actual payable hours (recommended)

---

### 🟡 Priority 2: Fix Expected Hours Calculation

**File:** `frontend/src/utils/saturdayUtils.js`

**Change:**
```javascript
// Current:
const expectedMinutes = workingDays * 9 * 60; // 9 hrs/day

// Fixed:
const expectedMinutes = workingDays * 8.5 * 60; // 8.5 hrs/day = 510 min/day
```

**Verify:**
- Check all usages of `getExpectedWeeklyWorkingHours`
- Ensure no other code depends on 9 hrs/day assumption

---

### 🟢 Priority 3: Add Fallback Warning

**File:** `frontend/src/components/AttendanceTimeline.jsx`

**Change:**
```javascript
const summaryHours = useMemo(() => {
    if (summary && summary.totalWorkedMinutes !== undefined) {
        return formatDuration(summary.totalWorkedMinutes);
    }
    // Fallback: Calculate from weekDays
    console.warn('[AttendanceTimeline] Using fallback calculation - backend summary missing');
    let totalMinutes = 0;
    weekDays.forEach(day => {
        if (day.log && day.log.totalWorkedMinutes) {
            totalMinutes += day.log.totalWorkedMinutes;
        }
    });
    return formatDuration(totalMinutes);
}, [weekDays, summary]);
```

---

## 10. Test Cases to Validate Saturday Clubbing

### Test Case 1: Saturday Worked on Weekly-Off Day
**Setup:**
- Employee: "Week 1 & 3 Off" policy
- Date: 1st Saturday of month
- Action: Employee clocks in/out (works full day)

**Expected:**
- ✅ Status = "Present" (not "Weekly Off")
- ✅ `totalWorkedMinutes` = actual worked minutes (e.g., 510 min)
- ✅ `payableMinutes` = 510 (full day)
- ✅ Present days count includes Saturday
- ✅ Total hours includes Saturday hours

---

### Test Case 2: Saturday Weekly Off (Not Worked)
**Setup:**
- Employee: "Week 1 & 3 Off" policy
- Date: 1st Saturday of month
- Action: Employee does NOT clock in

**Expected:**
- ✅ Status = "Weekly Off"
- ✅ `totalWorkedMinutes` = 0
- ✅ `payableMinutes` = 0
- ✅ Present days count does NOT include Saturday
- ✅ Total hours does NOT include Saturday

---

### Test Case 3: Saturday Holiday
**Setup:**
- Employee: "Week 1 & 3 Off" policy
- Date: 1st Saturday of month (also a holiday)
- Action: Employee does NOT clock in

**Expected:**
- ✅ Status = "Holiday" (not "Weekly Off")
- ✅ `isWeeklyOff` = false (holiday takes precedence)
- ✅ `totalWorkedMinutes` = 0
- ✅ `payableMinutes` = 0
- ✅ Present days count does NOT include Saturday

---

### Test Case 4: Half-Day on Saturday
**Setup:**
- Employee: "All Saturdays Working" policy
- Date: Any Saturday
- Action: Employee works 4.5 hours (half-day)

**Expected:**
- ✅ Status = "Half-day"
- ✅ `totalWorkedMinutes` = actual worked minutes (e.g., 270 min)
- ✅ `payableMinutes` = 255 (half-day payable)
- ✅ Present days count includes Saturday

---

### Test Case 5: Weekly Expected Hours
**Setup:**
- Employee: "Week 1 & 3 Off" policy
- Week: Contains 1st Saturday (off) and 2nd Saturday (working)

**Expected:**
- ✅ Week 1: Expected = 42.5 hrs (5 days × 8.5 hrs) - 1st Saturday off
- ✅ Week 2: Expected = 51 hrs (6 days × 8.5 hrs) - 2nd Saturday working
- ✅ Payable hours = sum of actual `payableMinutes` from logs

---

### Test Case 6: Leave on Saturday
**Setup:**
- Employee: "All Saturdays Working" policy
- Date: Any Saturday
- Action: Employee has approved leave

**Expected:**
- ✅ Status = "Leave"
- ✅ `totalWorkedMinutes` = 0 (no attendance log)
- ✅ `payableMinutes` = 0 (full day leave) or 270 (half-day leave)
- ✅ Present days count does NOT include Saturday

---

## 11. Conclusion

### Summary

**✅ Core Functionality:** Saturday clubbing policy is **working correctly** at the backend level. Saturday worked hours are properly included in weekly totals, payable hours, and present day counts.

**❌ UI Issues:** Frontend has **critical inconsistencies**:
1. "Payable Hours" shows expected hours instead of actual payable hours
2. Expected hours calculation uses 9 hrs/day instead of 8.5 hrs/day

**⚠️ Recommendations:**
1. **Immediate:** Fix payable hours display to show actual payable hours from backend
2. **Short-term:** Fix expected hours calculation to match backend (8.5 hrs/day)
3. **Long-term:** Add comprehensive test coverage for Saturday clubbing scenarios

### Risk Assessment

- **Data Integrity:** ✅ **LOW RISK** - Backend calculations are correct
- **User Experience:** ❌ **HIGH RISK** - Misleading UI shows wrong payable hours
- **Business Logic:** ✅ **LOW RISK** - Core clubbing logic is sound

### Final Verdict

**Saturday Clubbing Policy:** ✅ **FUNCTIONAL** (backend)  
**UI Display:** ❌ **NEEDS FIX** (frontend payable hours)

---

**Report Generated:** February 6, 2026  
**Auditor:** Senior Full-Stack Engineer  
**Next Review:** After Priority 1 & 2 fixes are implemented
