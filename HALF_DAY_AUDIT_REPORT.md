# Half-Day Attendance Audit Report

**Generated:** 2024  
**Scope:** Complete traceability of Half-Day detection, calculation, API responses, and UI rendering  
**Status:** Analysis Only - No Fixes Implemented

---

## Executive Summary

This audit traces the complete flow of Half-Day attendance status from backend detection through API responses to frontend rendering. The system has **multiple sources of truth** with logic duplication across backend services, API routes, and frontend components. Key findings:

- **3 distinct Half-Day detection mechanisms** (late-based, hours-based, manual override)
- **Logic duplication** between Employee and Admin APIs
- **Frontend UI overrides** that re-interpret backend status
- **Inconsistent thresholds** (8 hours vs grace period)
- **Priority conflicts** between different status determination paths

---

## 1. Source of Truth Analysis

### Current State: **MIXED** (No Single Source of Truth)

The system uses multiple sources of truth:

1. **Backend Database Fields:**
   - `isHalfDay` (Boolean) - Stored flag
   - `attendanceStatus` (Enum: 'On-time', 'Late', 'Half-day', 'Absent') - Stored status
   - `lateMinutes` (Number) - Calculated at clock-in

2. **Backend Service Layer:**
   - `recalculateLateStatus()` in `dailyStatusService.js` - Recalculates from clockInTime
   - `resolveDayStatus()` in `attendanceStatusResolver.js` - Resolves from stored status

3. **Frontend UI Logic:**
   - Recalculates based on worked hours (< 8 hours)
   - Overrides backend status in some cases

---

## 2. Backend Half-Day Logic

### 2.1 Primary Detection: Late-Based (Clock-In Time)

**File:** `backend/services/dailyStatusService.js`  
**Function:** `recalculateLateStatus()`  
**Lines:** 38-91

**Condition:**
```javascript
if (lateMinutes > GRACE_PERIOD_MINUTES) {
    isHalfDay = true;
    attendanceStatus = 'Half-day';
}
```

**Depends on punches?** Yes - Requires `clockInTime`  
**Threshold used:** `GRACE_PERIOD_MINUTES` (default: 30, configurable via Setting `lateGraceMinutes`)  
**Priority order:** Calculated on-the-fly from clockInTime vs shift startTime

**Notes:**
- This is marked as "SINGLE SOURCE OF TRUTH" in comments (line 31)
- Recalculates every time `getUserDailyStatus()` is called
- Overrides stored database values

---

### 2.2 Clock-In Detection: Attendance Route

**File:** `backend/routes/attendance.js`  
**Function:** POST `/clock-in` handler  
**Lines:** 80-124

**Condition:**
```javascript
if (lateMinutes > GRACE_PERIOD_MINUTES) {
    isHalfDay = true;
    isLate = false;
    attendanceStatus = 'Half-day';
}
```

**Depends on punches?** Yes - Calculated at clock-in time  
**Threshold used:** `GRACE_PERIOD_MINUTES` (default: 30)  
**Priority order:** Sets initial status when employee clocks in

**Notes:**
- Duplicates logic from `recalculateLateStatus()`
- Stores `isHalfDay` and `attendanceStatus` in database
- Used for initial marking at clock-in

---

### 2.3 Analytics Service Detection

**File:** `backend/routes/analytics.js`  
**Function:** `checkAndUpdateLateStatus()`  
**Lines:** 279-325

**Condition:**
```javascript
if (lateMinutes > GRACE_PERIOD_MINUTES) {
    isHalfDay = true;
    isLate = false;
    attendanceStatus = 'Half-day';
}
```

**Depends on punches?** Yes - Requires clockInTime  
**Threshold used:** `GRACE_PERIOD_MINUTES` (default: 30)  
**Priority order:** Updates existing attendance log

**Notes:**
- Third instance of same logic
- Updates attendance log after clock-in
- Used for analytics tracking

---

### 2.4 Admin Manual Override: Toggle Half-Day

**File:** `backend/routes/admin.js`  
**Function:** PUT `/attendance/half-day/:logId`  
**Lines:** 2737-2874

**Condition:**
```javascript
log.isHalfDay = isHalfDay; // Direct boolean assignment
if (isHalfDay && !wasHalfDay) {
    log.attendanceStatus = 'Half-day';
}
```

**Depends on punches?** No - Manual admin override  
**Threshold used:** N/A - Admin decision  
**Priority order:** Admin override takes precedence

**Notes:**
- Allows admin to manually mark/unmark half-day
- When unmarking, recalculates status using `attendanceRecalculationService`
- Can override automatic late-based detection

---

### 2.5 Admin Override Half-Day Removal

**File:** `backend/routes/admin.js`  
**Function:** POST `/attendance/override-half-day`  
**Lines:** 2557-2734

**Condition:**
```javascript
log.adminOverride = 'Override Half Day';
log.isHalfDay = false;
// Then recalculates status based on lateMinutes
```

**Depends on punches?** Yes - Recalculates from clockInTime after override  
**Threshold used:** `GRACE_PERIOD_MINUTES` (default: 30)  
**Priority order:** Admin override > Late calculation

**Notes:**
- Removes half-day marking
- Sets `adminOverride` flag
- Recalculates to either 'On-time' or 'Late' based on grace period

---

### 2.6 Admin Toggle Status (Legacy)

**File:** `backend/routes/admin.js`  
**Function:** PATCH `/attendance/toggle-status`  
**Lines:** 860-1014

**Condition:**
```javascript
if (statusType === 'halfday') {
    attendanceLog.isHalfDay = newStatus === 'Half-day';
    attendanceLog.lateMinutes = newStatus === 'Half-day' ? Math.max(attendanceLog.lateMinutes || 0, 60) : 0;
}
```

**Depends on punches?** No - Manual admin action  
**Threshold used:** Sets lateMinutes to 60 if marking as half-day  
**Priority order:** Admin manual override

**Notes:**
- Legacy endpoint for toggling status
- Creates attendance log if none exists
- Sets default lateMinutes to 60 when marking half-day

---

### 2.7 Admin Employee Attendance API Calculation

**File:** `backend/routes/admin.js`  
**Function:** GET `/attendance/employee/:employeeId`  
**Lines:** 1018-1128

**Condition:**
```javascript
// Recalculates status for display
if (lateMinutes > GRACE_PERIOD_MINUTES) {
    calculatedStatus = 'Half-day';
    calculatedIsHalfDay = true;
}
// But respects manual overrides
if (hasManualOverride) {
    calculatedStatus = log.attendanceStatus; // Use stored status
}
```

**Depends on punches?** Yes - Uses stored `lateMinutes`  
**Threshold used:** `GRACE_PERIOD_MINUTES` (default: 30)  
**Priority order:** Manual override > Late calculation

**Notes:**
- Recalculates status for admin view
- Detects manual overrides by comparing stored status vs calculated
- Returns both `calculatedStatus` and `calculatedIsHalfDay`

---

### 2.8 Status Resolver (Unified)

**File:** `backend/utils/attendanceStatusResolver.js`  
**Function:** `resolveDayStatus()` and `resolveMultipleDaysStatus()`  
**Lines:** 67-226, 237-422

**Condition:**
```javascript
if (logStatus === 'Half-day') {
    return { status: 'Half Day' };
}
```

**Depends on punches?** Yes - Reads `attendanceLog.attendanceStatus`  
**Threshold used:** N/A - Uses stored status  
**Priority order:** Holiday > Leave > Present (with status) > Absent

**Notes:**
- Does NOT recalculate - uses stored `attendanceStatus`
- Used by both Employee and Admin APIs
- Priority: Holiday > Leave > Present/Half-day/Late > Absent

---

## 3. API Response Trace

### 3.1 Employee Attendance API

**Endpoint:** GET `/api/attendance/my-weekly-log`  
**File:** `backend/routes/attendance.js`  
**Lines:** 298-417

**Status Field:** `attendanceStatus` (from database)  
**Half-Day Source:** 
- Primary: Stored `attendanceStatus` field from database
- Secondary: `isHalfDay` boolean flag
- Resolution: Uses `resolveMultipleDaysStatus()` which reads stored status

**Response Schema:**
```javascript
{
    attendanceStatus: 'Half-day', // or 'Half Day' from resolver
    isHalfDay: true,
    // ... other fields
}
```

**Notes:**
- Does NOT recalculate from clockInTime
- Relies on stored database values
- Resolver converts 'Half-day' → 'Half Day' (capitalization change)

---

### 3.2 Admin Attendance API (User View)

**Endpoint:** GET `/api/admin/attendance/user/:userId`  
**File:** `backend/routes/admin.js`  
**Lines:** 1515-1631

**Status Field:** `attendanceStatus` (from database)  
**Half-Day Source:**
- Uses same `resolveMultipleDaysStatus()` as Employee API
- Reads stored `attendanceStatus` field
- Returns `isHalfDay` boolean

**Response Schema:**
```javascript
{
    attendanceStatus: 'Half-day',
    isHalfDay: true,
    // ... other fields
}
```

**Differences from Employee:**
- **NONE** - Uses identical resolution logic
- Same resolver function
- Same stored status source

---

### 3.3 Admin Employee Attendance API (Detail View)

**Endpoint:** GET `/api/admin/attendance/employee/:employeeId`  
**File:** `backend/routes/admin.js`  
**Lines:** 1018-1128

**Status Field:** `calculatedStatus` (recalculated)  
**Half-Day Source:**
- Recalculates from `lateMinutes` vs `GRACE_PERIOD_MINUTES`
- Detects manual overrides
- Returns both stored and calculated values

**Response Schema:**
```javascript
{
    attendanceStatus: 'Half-day', // Stored
    isHalfDay: true, // Stored
    calculatedStatus: 'Half-day', // Recalculated
    calculatedIsHalfDay: true, // Recalculated
    hasManualOverride: false, // Detection flag
    gracePeriodMinutes: 30
}
```

**Differences from Employee:**
- **RECALCULATES** status instead of using stored
- Provides override detection
- Returns both stored and calculated for comparison

---

### 3.4 Daily Status API (Real-time)

**Endpoint:** GET `/api/attendance/daily-status` (implied from `getUserDailyStatus`)  
**File:** `backend/services/dailyStatusService.js`  
**Lines:** 269-378

**Status Field:** `attendanceLog.attendanceStatus` (recalculated)  
**Half-Day Source:**
- **RECALCULATES** from `clockInTime` using `recalculateLateStatus()`
- Overrides stored database values
- Used for real-time status display

**Response Schema:**
```javascript
{
    attendanceLog: {
        isHalfDay: true, // Recalculated
        attendanceStatus: 'Half-day', // Recalculated
        lateMinutes: 45, // Recalculated
        // ... other fields
    }
}
```

**Notes:**
- This is the ONLY endpoint that recalculates on every request
- Used for current day status (clock-in/clock-out UI)
- Overrides stored values with live calculation

---

## 4. Frontend Rendering Audit (Employee)

### 4.1 Employee Attendance Summary Page

**Component:** `frontend/src/pages/AttendanceSummaryPage.jsx`  
**Lines:** 395-412

**Status Source:** 
- Primary: `log.attendanceStatus` from API
- Secondary: `log.isHalfDay` boolean
- **UI Override:** Recalculates based on worked hours

**UI Override Present?** **YES**

**Half-Day Card Logic:**
```javascript
// Check if employee has clocked out
const hasClockOut = log.clockOutTime || (log.sessions && log.sessions.every(s => s.endTime));

// Calculate net hours
const netHours = totalWorkTime - totalBreakTime;

// UI-level half-day detection
const MINIMUM_FULL_DAY_HOURS = 8;
const isHalfDayByHours = hasClockOut && netHours > 0 && netHours < MINIMUM_FULL_DAY_HOURS;

// Combine backend status with UI calculation
const isHalfDayMarked = hasClockOut && (
    log.isHalfDay || 
    log.attendanceStatus === 'Half-day' || 
    isHalfDayByHours // UI override
);

// Status determination
if (isHalfDayMarked) {
    status = 'Half Day';
    statusColor = '#ff9800';
}
```

**Issues:**
- **DUPLICATES** backend logic in frontend
- Uses **8 hours threshold** (different from backend grace period)
- Can override backend status if hours < 8
- Only applies if `hasClockOut` is true

---

### 4.2 Employee Attendance Calendar

**Component:** `frontend/src/components/AttendanceCalendar.jsx`  
**Lines:** 114-115

**Status Source:** `resolvedStatus` from API (via `resolveMultipleDaysStatus`)  
**UI Override Present?** **NO**

**Half-Day Card Logic:**
```javascript
if (resolvedStatus === 'Half Day' || resolvedStatus === 'Half-day') {
    status = 'half-day';
}
// Then renders with CSS class 'half-day'
```

**Notes:**
- Uses API status directly
- No UI-level recalculation
- Simple mapping: 'Half Day' or 'Half-day' → 'half-day' CSS class

---

### 4.3 Employee Daily Timeline Row

**Component:** `frontend/src/components/DailyTimelineRow.jsx`  
**Lines:** 250-262

**Status Source:**
- Primary: `log.isHalfDay` and `log.attendanceStatus`
- **UI Override:** Recalculates based on worked hours

**UI Override Present?** **YES**

**Half-Day Card Logic:**
```javascript
const workingHours = durationInfo.totalMinutes / 60;
const MINIMUM_FULL_DAY_HOURS = 8;
const isHalfDayByHours = hasClockOut && workingHours > 0 && workingHours < MINIMUM_FULL_DAY_HOURS;

const isHalfDayMarked = hasClockOut && (
    log?.isHalfDay || 
    log?.attendanceStatus === 'Half-day' || 
    isHalfDayByHours // UI override
);
```

**Issues:**
- **DUPLICATES** logic from `AttendanceSummaryPage.jsx`
- Uses same 8-hour threshold
- Shows badge: "Half Day (Less than 8 hours)" or "Half Day (Late beyond grace period)"
- Can conflict with backend status

---

## 5. Frontend Rendering Audit (Admin)

### 5.1 Admin Attendance Summary Page

**Component:** `frontend/src/pages/AdminAttendanceSummaryPage.jsx`  
**Lines:** 399-402

**Status Source:** `resolvedStatus` from API  
**Shared with Employee?** **NO** - Separate component

**Half-Day Logic Duplication:** **NO** - Uses API status directly

**Half-Day Card Logic:**
```javascript
if (resolvedStatus === 'Half Day' || resolvedStatus === 'Half-day') {
    status = 'Half Day';
    statusColor = '#ff9800';
    payableHours = '04:30';
}
```

**Visual Differences:**
- Shows payable hours as '04:30' for half-day
- Uses same color (#ff9800) as Employee
- No UI-level recalculation

**Notes:**
- **NO UI OVERRIDES** - Relies entirely on backend status
- Different from Employee page (which has overrides)
- Consistent with API response

---

### 5.2 Admin Attendance Calendar

**Component:** `frontend/src/components/AttendanceCalendar.jsx`  
**Shared with Employee?** **YES** - Same component

**Half-Day Logic Duplication:** **NO** - Uses shared component

**Notes:**
- Admin and Employee use the same calendar component
- Same rendering logic applies to both
- No admin-specific half-day logic

---

## 6. Issues & Risks

### 6.1 Logic Duplication

**Issue:** Half-Day detection logic exists in **7+ locations**

**Locations:**
1. `dailyStatusService.js::recalculateLateStatus()` - Primary service
2. `routes/attendance.js::clock-in` - Clock-in handler
3. `routes/analytics.js::checkAndUpdateLateStatus()` - Analytics
4. `routes/admin.js::/attendance/employee/:employeeId` - Admin API recalculation
5. `frontend/pages/AttendanceSummaryPage.jsx` - Employee UI (hours-based)
6. `frontend/components/DailyTimelineRow.jsx` - Employee UI (hours-based)
7. `routes/admin.js::/attendance/toggle-status` - Admin manual override

**Risk:** Changes to logic must be applied in multiple places, increasing regression risk.

---

### 6.2 UI vs Backend Conflicts

**Issue:** Frontend Employee UI recalculates half-day using **8-hour threshold**, while backend uses **grace period threshold** (30 minutes).

**Conflict Scenario:**
1. Employee clocks in 35 minutes late → Backend marks as Half-day (late > 30 min)
2. Employee works 8.5 hours and clocks out
3. Frontend calculates: 8.5 hours > 8 hours → Should NOT be half-day
4. **Result:** Backend says Half-day, Frontend may show Present (if hours override wins)

**Risk:** Inconsistent display between what backend stores and what frontend shows.

---

### 6.3 Order-of-Execution Problems

**Issue:** Multiple status determination paths with unclear priority.

**Priority Conflicts:**
1. **Late-based detection** (grace period) - Sets Half-day at clock-in
2. **Hours-based detection** (8 hours) - Frontend override after clock-out
3. **Manual admin override** - Can override both
4. **Status resolver** - Uses stored status, doesn't recalculate

**Risk:** Status can change between clock-in and clock-out, or between API calls.

---

### 6.4 Admin vs Employee Divergence

**Issue:** Admin and Employee UIs use different logic sources.

**Employee:**
- Uses API status + UI recalculation (hours-based)
- Can override backend status
- Shows "Half Day" based on hours OR late status

**Admin:**
- Uses API status directly (no UI recalculation)
- Relies entirely on backend
- Shows "Half Day" only if backend says so

**Risk:** Admin and Employee may see different statuses for the same day.

---

### 6.5 Cases Where Half-Day Can Override Present Incorrectly

**Scenario 1: Late Clock-In, Full Day Work**
- Employee clocks in 35 min late → Backend marks Half-day
- Employee works 9 hours → Frontend may show Present (hours > 8)
- **Result:** Backend = Half-day, Frontend = Present (inconsistent)

**Scenario 2: On-Time Clock-In, Early Clock-Out**
- Employee clocks in on-time → Backend marks On-time
- Employee works 7 hours → Frontend marks Half-day (hours < 8)
- **Result:** Backend = On-time, Frontend = Half-day (inconsistent)

**Scenario 3: Admin Override**
- Backend marks Half-day (late > grace period)
- Admin overrides → Sets Half-day = false, recalculates to Late
- Frontend may still show Half-day if hours < 8
- **Result:** Backend = Late, Frontend = Half-day (inconsistent)

---

### 6.6 Regression Risk Areas

**High Risk:**
1. **Changing grace period** - Must update 7+ locations
2. **Changing 8-hour threshold** - Must update 2 frontend components
3. **Modifying status resolver** - Affects both Employee and Admin APIs
4. **Adding new half-day conditions** - Must propagate to all locations

**Medium Risk:**
1. **Clock-in logic changes** - May affect initial status setting
2. **Clock-out logic changes** - May affect hours-based detection
3. **Admin override changes** - May conflict with automatic detection

---

## 7. Recommendations (No Code Yet)

### 7.1 Consolidate Backend Logic

**Recommendation:** Create a single `determineHalfDayStatus()` function that:
- Takes clockInTime, workedHours, lateMinutes, and adminOverride as inputs
- Returns unified half-day status
- Used by all backend services and routes

**Benefits:**
- Single source of truth
- Easier to maintain
- Consistent behavior

---

### 7.2 Unify Detection Criteria

**Recommendation:** Decide on ONE primary criterion:
- **Option A:** Late-based only (grace period) - Current backend default
- **Option B:** Hours-based only (8 hours) - Current frontend default
- **Option C:** Both (late OR hours) - Requires clear priority rules

**Benefits:**
- Eliminates conflicts
- Clear business rules
- Predictable behavior

---

### 7.3 Remove Frontend UI Overrides

**Recommendation:** Remove hours-based recalculation from frontend components.

**Changes:**
- `AttendanceSummaryPage.jsx` - Remove `isHalfDayByHours` logic
- `DailyTimelineRow.jsx` - Remove `isHalfDayByHours` logic
- Trust backend status entirely

**Benefits:**
- Single source of truth (backend)
- Consistent Admin and Employee views
- No UI/backend conflicts

---

### 7.4 Standardize API Responses

**Recommendation:** Ensure all APIs return consistent half-day status.

**Standardization:**
- All APIs should return `isHalfDay` boolean
- All APIs should return `attendanceStatus` with 'Half-day' value
- Remove `calculatedStatus` vs `attendanceStatus` confusion

**Benefits:**
- Predictable API contracts
- Easier frontend integration
- Clear data model

---

### 7.5 Add Status Priority Documentation

**Recommendation:** Document clear priority order:

1. **Admin Override** (highest)
2. **Late-based detection** (grace period)
3. **Hours-based detection** (8 hours) - If implemented
4. **Stored status** (fallback)

**Benefits:**
- Clear business rules
- Easier debugging
- Predictable behavior

---

### 7.6 Add Audit Trail

**Recommendation:** Log all half-day status changes with:
- Source (automatic vs manual)
- Previous status
- New status
- Reason (late, hours, override)

**Benefits:**
- Debugging capability
- Compliance tracking
- Change history

---

## 8. Summary Tables

### Backend Half-Day Detection Locations

| File | Function | Condition | Depends on Punches? | Threshold | Priority |
|------|----------|-----------|-------------------|-----------|----------|
| `dailyStatusService.js` | `recalculateLateStatus()` | `lateMinutes > GRACE_PERIOD` | Yes | 30 min (configurable) | High (recalculates) |
| `routes/attendance.js` | POST `/clock-in` | `lateMinutes > GRACE_PERIOD` | Yes | 30 min (configurable) | Medium (initial) |
| `routes/analytics.js` | `checkAndUpdateLateStatus()` | `lateMinutes > GRACE_PERIOD` | Yes | 30 min (configurable) | Medium (update) |
| `routes/admin.js` | PUT `/half-day/:logId` | Manual boolean | No | N/A | Highest (override) |
| `routes/admin.js` | POST `/override-half-day` | Manual override | Yes (recalc after) | 30 min (configurable) | Highest (override) |
| `routes/admin.js` | PATCH `/toggle-status` | Manual status | No | Sets 60 min | Highest (override) |
| `routes/admin.js` | GET `/employee/:employeeId` | Recalculates | Yes | 30 min (configurable) | Medium (display) |
| `utils/attendanceStatusResolver.js` | `resolveDayStatus()` | Reads stored status | Yes (reads DB) | N/A | Low (uses stored) |

### API Response Comparison

| Endpoint | Status Field | Half-Day Source | Recalculates? | Override Detection? |
|----------|-------------|----------------|--------------|-------------------|
| GET `/attendance/my-weekly-log` | `attendanceStatus` | Stored DB value | No | No |
| GET `/admin/attendance/user/:userId` | `attendanceStatus` | Stored DB value | No | No |
| GET `/admin/attendance/employee/:employeeId` | `calculatedStatus` | Recalculated | Yes | Yes |
| GET `/attendance/daily-status` | `attendanceLog.attendanceStatus` | Recalculated | Yes | No |

### Frontend Rendering Comparison

| Component | Status Source | UI Override? | Hours Threshold | Shared with Admin? |
|-----------|--------------|-------------|----------------|-------------------|
| `AttendanceSummaryPage.jsx` | API + UI calc | Yes | 8 hours | No |
| `AdminAttendanceSummaryPage.jsx` | API only | No | N/A | No |
| `AttendanceCalendar.jsx` | API only | No | N/A | Yes |
| `DailyTimelineRow.jsx` | API + UI calc | Yes | 8 hours | Yes |

---

## 9. Code References

### Backend Files
- `backend/services/dailyStatusService.js` - Lines 38-91, 269-378
- `backend/routes/attendance.js` - Lines 80-124, 298-417
- `backend/routes/admin.js` - Lines 860-1014, 1018-1128, 2557-2734, 2737-2874
- `backend/routes/analytics.js` - Lines 279-325
- `backend/utils/attendanceStatusResolver.js` - Lines 67-226, 237-422
- `backend/models/AttendanceLog.js` - Lines 16-24

### Frontend Files
- `frontend/src/pages/AttendanceSummaryPage.jsx` - Lines 395-412
- `frontend/src/pages/AdminAttendanceSummaryPage.jsx` - Lines 399-402
- `frontend/src/components/AttendanceCalendar.jsx` - Lines 114-115
- `frontend/src/components/DailyTimelineRow.jsx` - Lines 250-262

---

## 10. Conclusion

The Half-Day attendance system has **multiple sources of truth** with logic duplication across backend services, API routes, and frontend components. The primary issues are:

1. **Backend:** 7+ locations with duplicate late-based detection logic
2. **Frontend:** 2 components with hours-based detection that can override backend
3. **API:** Inconsistent recalculation vs stored status usage
4. **Admin vs Employee:** Different logic sources causing potential divergence

**Critical Path Forward:**
1. Consolidate backend logic into single service function
2. Remove frontend UI overrides
3. Standardize API responses
4. Document clear priority rules

This audit provides the foundation for implementing a unified Half-Day detection system.

---

**End of Report**





