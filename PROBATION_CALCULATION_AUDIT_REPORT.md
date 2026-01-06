# Probation Calculation Audit Report
**Date:** Generated on Analysis  
**Scope:** Complete codebase audit of probation calculation logic  
**Type:** Read-only analysis (no code changes)

---

## Executive Summary

This audit identifies **multiple probation calculation systems** operating in parallel with **inconsistent logic**, **timezone handling issues**, and **conflicting rules**. The application has:

1. **Three distinct probation calculation methods:**
   - Legacy working-days-based system (`probationTrackingService.js`)
   - Calendar-days-based system (`cronService.js`)
   - New working-days-based system with extensions (`analytics.js` - Probation Tracker)

2. **Critical timezone inconsistencies:**
   - Mix of UTC, browser timezone, and IST
   - Off-by-one-day risks in multiple locations
   - Inconsistent date parsing methods

3. **Data model conflicts:**
   - `employmentStatus` vs `probationStatus` confusion
   - `probationStartDate` vs `joiningDate` ambiguity
   - `probationDurationMonths` vs hardcoded days

4. **Calculation logic gaps:**
   - Missing weekend/holiday exclusions in some paths
   - Inconsistent leave extension handling
   - Absent day calculation overlaps with leaves

---

## 1. Frontend Components Rendering Probation

### 1.1 Components Identified

| Component | Location | Purpose | Data Source |
|-----------|----------|---------|-------------|
| `ProbationTracker.jsx` | `frontend/src/components/` | Main probation tracking table | `/api/analytics/probation-tracker` |
| `ViewAnalyticsModal.jsx` | `frontend/src/components/` | Employee analytics with probation progress | `/api/analytics/employee/:id` |
| `ProbationSettingsModal.jsx` | `frontend/src/components/` | Admin settings for probation | `/api/admin/employees/:id/probation-status` |
| `ProbationCelebration.jsx` | `frontend/src/components/` | UI celebration (no calculation) | N/A |
| `EmployeeForm.jsx` | `frontend/src/components/` | Employee creation with probation fields | Form input |

### 1.2 Shared Utilities

**No dedicated probation calculation utilities found in frontend.** Each component implements its own date formatting:

- `ProbationTracker.jsx`: Uses `formatDateIST()` with `toLocaleString("en-US", {timeZone: "Asia/Kolkata"})`
- `ViewAnalyticsModal.jsx`: Uses `getISTDate()` helper and `formatDateKey()` for date consistency
- No shared date utility library for probation calculations

**Risk:** Inconsistent date handling across components.

---

## 2. Backend Calculation Audit

### 2.1 Location 1: `probationTrackingService.js` - `calculateProbationProgress()`

**Purpose:** Legacy working-days-based probation completion check

#### Probation Start Date
- **Source Field:** `employee.joiningDate` (Date object from MongoDB)
- **Parsing Method:** Direct Date object usage, no timezone conversion
- **Timezone:** **UTC (MongoDB default)** - **CRITICAL ISSUE**
- **Code:** `startDate` parameter passed directly, used in calculations without IST conversion

#### Probation Duration
- **Hardcoded:** `180` working days (line 66)
- **Unit:** Working days (counted from attendance logs)
- **Not configurable** via settings

#### Day Inclusion Rules
- **Weekdays:** ✅ Counted (via attendance logs with clockInTime/clockOutTime)
- **Saturdays:** ❌ **NOT HANDLED** - No alternate Saturday policy check
- **Sundays:** ❌ Excluded (implicitly, via attendance log filtering)
- **Company Holidays:** ❌ **NOT EXCLUDED** - Major gap

**Critical Gap:** This method counts attendance days, not working days. It doesn't exclude:
- Alternate off-Saturdays
- Company holidays
- Sundays (only excluded if no attendance log exists)

#### Leave Handling
- **Full Day Leave:** ✅ Counted (1.0 day per leave date)
- **Half Day Leave:** ✅ Counted (0.5 day per leave date)
- **Approval Status:** ✅ Only `'Approved'` leaves
- **Date Range Filter:** ✅ Only leaves `>= startDate && <= today`
- **Issue:** Leaves are counted but **NOT used to extend probation period** - only tracked for reporting

#### Absent Handling
- **Not explicitly calculated** - only working days completed are counted
- **Attendance Statuses Used:** Implicit (only logs with `clockInTime && clockOutTime` count)
- **Overlap with Leave:** ❌ **NOT CHECKED** - Could double-count if leave and attendance exist

#### Intern vs Employee Logic
- **Shared Logic:** ✅ Same calculation for all `employmentStatus === 'Probation'`
- **Risk:** Interns with `employmentStatus: 'Probation'` would be processed (should be filtered)

---

### 2.2 Location 2: `cronService.js` - `checkProbationAndInternshipEndings()`

**Purpose:** Daily reminder emails for ending probation/internship

#### Probation Start Date
- **Source Field:** `user.joiningDate`
- **Parsing Method:** `new Date(user.joiningDate)` - **UTC parsing**
- **Timezone:** **UTC** - **CRITICAL ISSUE**

#### Probation Duration
- **Config-based:** `PROBATION_PERIOD_DAYS` from `.env` (default: 90 days)
- **Unit:** **Calendar days** (not working days)
- **Code:** `endDate.setDate(joiningDate.getDate() + PROBATION_PERIOD_DAYS)`

**Critical Issue:** Uses calendar days, not working days. No exclusion of:
- Sundays
- Saturdays (alternate or not)
- Holidays

#### Day Inclusion Rules
- **All days counted** - pure calendar day addition
- **No weekend/holiday logic**

#### Leave Handling
- **NOT APPLIED TO PROBATION** - Only applied to Internship extension logic
- **Probation calculation ignores leaves entirely**

#### Absent Handling
- **NOT APPLIED**

#### Intern vs Employee Logic
- **Separate Logic:** ✅ Different calculation for `'Probation'` vs `'Intern'`
- **Probation:** Calendar days only
- **Intern:** Calendar months + leave extensions

**Risk:** Probation reminders will be **incorrect** - showing end dates that don't account for working days or extensions.

---

### 2.3 Location 3: `analytics.js` - `/probation-tracker` Endpoint

**Purpose:** New comprehensive probation tracker (recently implemented)

#### Probation Start Date
- **Source Field:** `employee.joiningDate`
- **Parsing Method:** 
  ```javascript
  const joiningDate = new Date(employee.joiningDate);
  const joiningDateIST = new Date(joiningDate.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  ```
- **Timezone:** ✅ **IST (Asia/Kolkata)** - **CORRECT**

#### Probation Duration
- **Config-based:** `probationDurationDays` from Setting `'probationDurationDays'` (default: 180)
- **Fallback:** Uses `employee.probationDurationMonths * 22` if available
- **Unit:** **Working days** (correctly excludes weekends/holidays)

#### Day Inclusion Rules
- **Weekdays:** ✅ Counted
- **Saturdays:** ✅ Handled via `AntiExploitationLeaveService.isOffSaturday()`
- **Sundays:** ✅ Excluded
- **Company Holidays:** ✅ Excluded (fetched from Holiday model)

**This is the CORRECT implementation.**

#### Leave Handling
- **Full Day Leave:** ✅ +1 day extension
- **Half Day Leave:** ✅ +0.5 day extension
- **Approval Status:** ✅ Only `'Approved'` leaves
- **Date Range Filter:** ✅ Only leaves `>= probationStartDateStr`
- **Extension Applied:** ✅ Extends probation end date correctly

#### Absent Handling
- **Full Day Absent:** ✅ +1 day extension
- **Half Day Absent:** ✅ +0.5 day extension (checks both `status === 'Half-day'` and `log.isHalfDay`)
- **Overlap with Leave:** ✅ **PROPERLY HANDLED** - Skips absences if date is in `leaveDatesSet`

#### Intern vs Employee Logic
- **Explicit Filter:** ✅ `role: { $ne: 'Intern' }` - Interns excluded
- **Separate Logic:** ✅ Only processes `employmentStatus === 'Probation'` employees

---

### 2.4 Location 4: `employees.js` - Probation Settings Endpoint

**Purpose:** Admin updates to probation settings (conversion from Intern to On-Role)

#### Probation Start Date
- **Source Field:** `conversionDate` from request body
- **Parsing Method:** `new Date(conversionDate)` - **UTC parsing**
- **Timezone:** **UTC** - **CRITICAL ISSUE**

#### Probation Duration
- **Source:** `probationDurationMonths` from request (1-12 months)
- **Calculation:** `endDate.setMonth(endDate.getMonth() + parseInt(probationDurationMonths))`
- **Unit:** **Calendar months** (not working days)

**Critical Issue:** 
- Uses calendar months, not working days
- No account for weekends/holidays
- Stored in DB as `probationEndDate` but calculation is incorrect

#### Day Inclusion Rules
- **All calendar days** - no exclusions

---

### 2.5 Location 5: `probationRoutes.js` - Employee Progress Endpoint

**Purpose:** Get probation progress for individual employee

#### Uses: `ProbationTrackingService.calculateProbationProgress()`
- **Inherits all issues from Location 1**
- No IST timezone handling
- No working days calculation
- No holiday/weekend exclusions

---

## 3. Timezone Handling Audit

### 3.1 Backend Timezone Issues

| Location | Method | Timezone | Risk Level |
|----------|--------|----------|------------|
| `probationTrackingService.js` | `new Date()` from MongoDB | UTC | 🔴 **HIGH** - Off-by-one-day risk |
| `cronService.js` | `new Date(user.joiningDate)` | UTC | 🔴 **HIGH** - Off-by-one-day risk |
| `analytics.js` (probation-tracker) | `toLocaleString("en-US", {timeZone: "Asia/Kolkata"})` | IST | ✅ **CORRECT** |
| `employees.js` (probation-settings) | `new Date(conversionDate)` | UTC | 🔴 **HIGH** - Off-by-one-day risk |
| `analytics.js` (other endpoints) | Mix of UTC and IST | Mixed | 🟡 **MEDIUM** - Inconsistent |

### 3.2 Frontend Timezone Issues

| Component | Method | Timezone | Risk Level |
|-----------|--------|----------|------------|
| `ProbationTracker.jsx` | `toLocaleString("en-US", {timeZone: "Asia/Kolkata"})` | IST | ✅ **CORRECT** |
| `ViewAnalyticsModal.jsx` | `getISTDate()` helper | IST | ✅ **CORRECT** |
| `ProbationSettingsModal.jsx` | `toISOString().slice(0, 10)` | UTC | 🟡 **MEDIUM** - May cause display issues |

### 3.3 Critical Timezone Risks

1. **Off-by-One-Day Risk:**
   - MongoDB stores dates as UTC midnight
   - IST is UTC+5:30
   - A date stored as `2024-01-01T00:00:00Z` (UTC) is `2024-01-01T05:30:00+05:30` (IST)
   - If parsed as UTC in backend but displayed as IST in frontend, dates can shift by ±1 day

2. **Inconsistent Parsing:**
   - Some code uses `toISOString().split('T')[0]` (UTC date string)
   - Some uses `toLocaleString("en-US", {timeZone: "Asia/Kolkata"})` (IST)
   - Mixing these causes incorrect date comparisons

3. **Date String Comparisons:**
   - String comparisons like `leaveDateStr >= probationStartDateStr` work correctly IF both are in same format
   - But if one is UTC and one is IST, comparisons fail

---

## 4. Frontend Rendering Audit

### 4.1 Date Display Methods

**ProbationTracker.jsx:**
```javascript
const formatDateIST = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00+05:30');
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata'
  });
};
```
- ✅ **Correct:** Explicitly sets IST timezone
- ✅ **Safe:** Handles missing dates with try-catch

**ViewAnalyticsModal.jsx:**
```javascript
const getISTDate = () => {
  return new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
};
```
- ✅ **Correct:** Uses IST for date operations

**ProbationSettingsModal.jsx:**
```javascript
conversionDate: data.employee.conversionDate 
  ? new Date(data.employee.conversionDate).toISOString().slice(0, 10) 
  : ''
```
- 🟡 **Risk:** Converts Date to UTC string, may cause display issues

### 4.2 Undefined/Invalid Date Handling

- **ProbationTracker.jsx:** ✅ Returns `'N/A'` for invalid dates
- **ViewAnalyticsModal.jsx:** ✅ Has fallback logic
- **ProbationSettingsModal.jsx:** ⚠️ No explicit validation

### 4.3 Browser Locale Impact

- Most components use explicit locale (`'en-IN'`, `'en-US'`)
- **Low risk** of locale-based date format issues

---

## 5. API Contract Review

### 5.1 `/api/analytics/probation-tracker` (NEW - Correct)

**Response Fields:**
```json
{
  "employees": [{
    "employee": { "id", "name", "employeeCode", "email", "department", "designation" },
    "probationAnalytics": {
      "probationStartDate": "YYYY-MM-DD",  // IST string
      "tentativeEndDate": "YYYY-MM-DD",    // IST string
      "daysLeft": number,                   // Calculated
      "fullDayLeaves": number,             // Count
      "halfDayLeaves": number,             // Count
      "leaveExtensionDays": number,        // Calculated (decimal)
      "absentDays": number,                // Calculated (decimal)
      "companyHolidays": number,           // Count
      "status": "On Track" | "Delayed"    // Calculated
    }
  }],
  "defaultProbationDuration": number
}
```

**Field Types:**
- ✅ All dates are IST strings (YYYY-MM-DD)
- ✅ Numbers default to 0
- ✅ Status always present
- ✅ No null/undefined in critical fields

### 5.2 `/api/probation/employee/:id/progress` (LEGACY)

**Response Fields:**
```json
{
  "employee": { "id", "name", "employeeCode", "joiningDate", "employmentStatus" },
  "progress": {
    "workingDaysCompleted": number,
    "totalDays": number,              // Calendar days (UTC)
    "leaveDaysTaken": number,
    "probationPeriodDays": 180,       // Hardcoded
    "isCompleted": boolean,
    "remainingDays": number
  }
}
```

**Issues:**
- ⚠️ `joiningDate` is Date object (UTC) - not normalized
- ⚠️ `totalDays` is calendar days, not working days
- ⚠️ No timezone information in response

### 5.3 `/api/probation/employees` (LEGACY)

**Response Fields:**
- Same structure as above
- **Same issues**

### 5.4 `/api/admin/employees/:id/probation-status` (SETTINGS)

**Response Fields:**
```json
{
  "employee": {
    "probationStartDate": Date,      // UTC Date object
    "probationEndDate": Date,        // UTC Date object (incorrectly calculated)
    "probationDurationMonths": number,
    "conversionDate": Date           // UTC Date object
  }
}
```

**Issues:**
- ⚠️ All dates are UTC Date objects
- ⚠️ `probationEndDate` calculated incorrectly (calendar months, not working days)

---

## 6. Risk & Gap Analysis

### 6.1 Logical Gaps

1. **Three Different Calculation Methods:**
   - Legacy: Working days from attendance (no holiday/weekend exclusion)
   - Cron: Calendar days (no exclusions)
   - New: Working days with proper exclusions
   - **Risk:** Different systems show different probation end dates

2. **Probation Duration Inconsistency:**
   - Legacy: Hardcoded 180 days
   - Cron: 90 days from env (calendar days)
   - New: 180 days from settings (working days)
   - Settings: Months-based (calendar months)
   - **Risk:** Same employee gets different durations depending on which system queries them

3. **Start Date Ambiguity:**
   - Some use `joiningDate`
   - Some use `probationStartDate` (for converted interns)
   - Some use `conversionDate`
   - **Risk:** Different start dates for same employee

### 6.2 Duplicate Calculations

- **Probation end date calculated in 3 places:**
  1. `probationTrackingService.js` - Not calculated (only completion check)
  2. `cronService.js` - Calendar days
  3. `analytics.js` - Working days with extensions
  4. `employees.js` - Calendar months

- **Leave extension calculated in 2 places:**
  1. `probationTrackingService.js` - Counted but not used for extension
  2. `analytics.js` - Counted and used for extension

### 6.3 Conflicting Rules

1. **Working Days vs Calendar Days:**
   - Legacy system: Counts attendance days (not true working days)
   - Cron system: Uses calendar days
   - New system: Uses true working days
   - **Conflict:** Same employee, different results

2. **Leave Extension:**
   - Legacy: Leaves counted but don't extend probation
   - New: Leaves extend probation
   - **Conflict:** Different behavior

3. **Absent Handling:**
   - Legacy: Not explicitly handled
   - New: Absents extend probation
   - **Conflict:** Missing in legacy

### 6.4 Missing Half-Day Handling

- **Legacy system:** ✅ Handles half-day leaves (0.5 multiplier)
- **Cron system:** ❌ No half-day logic (only for internships)
- **New system:** ✅ Handles half-day leaves and absents
- **Settings system:** ❌ No half-day logic

### 6.5 Incorrect Weekend/Holiday Handling

| System | Weekends | Holidays | Alternate Saturdays |
|--------|----------|----------|---------------------|
| Legacy | ❌ Implicit only | ❌ Not excluded | ❌ Not handled |
| Cron | ❌ Not excluded | ❌ Not excluded | ❌ Not handled |
| New | ✅ Excluded | ✅ Excluded | ✅ Handled |
| Settings | ❌ Not excluded | ❌ Not excluded | ❌ Not handled |

### 6.6 Timezone Risks

**High Risk Locations:**
1. `probationTrackingService.js` - UTC dates, no conversion
2. `cronService.js` - UTC dates, no conversion
3. `employees.js` - UTC dates, no conversion

**Impact:**
- Dates stored as UTC midnight may display as previous/next day in IST
- Date comparisons may fail
- Probation end dates may be off by 1 day

### 6.7 Employee vs Intern Leakage

**Risk Areas:**
1. **Legacy system:** Processes all `employmentStatus === 'Probation'` - could include interns
2. **Cron system:** Separates Probation and Intern, but uses same date calculation method
3. **New system:** ✅ Explicitly excludes interns with `role: { $ne: 'Intern' }`

**Risk:** Interns with incorrect `employmentStatus` could be processed as probation employees.

---

## 7. Production Risk Assessment

### 7.1 Critical Risks (P0)

1. **Incorrect Probation End Dates:**
   - **Impact:** Employees may be marked permanent too early/late
   - **Affected Systems:** Legacy and Cron systems
   - **Likelihood:** High (affects all employees using legacy paths)

2. **Timezone Off-by-One-Day Errors:**
   - **Impact:** Probation start/end dates shift by ±1 day
   - **Affected Systems:** Legacy, Cron, Settings
   - **Likelihood:** High (depends on time of day calculations run)

3. **Missing Holiday/Weekend Exclusions:**
   - **Impact:** Probation periods shorter than intended
   - **Affected Systems:** Legacy, Cron, Settings
   - **Likelihood:** High (affects all calculations)

### 7.2 High Risks (P1)

1. **Inconsistent Calculation Methods:**
   - **Impact:** Different UI views show different probation status
   - **Affected Systems:** All
   - **Likelihood:** High (multiple systems in use)

2. **Leave Extension Not Applied:**
   - **Impact:** Probation ends early for employees with leaves
   - **Affected Systems:** Legacy, Cron
   - **Likelihood:** Medium (only affects employees with leaves)

3. **Absent Days Not Extending Probation:**
   - **Impact:** Probation ends early for employees with absences
   - **Affected Systems:** Legacy, Cron
   - **Likelihood:** Medium (only affects employees with absences)

### 7.3 Medium Risks (P2)

1. **Half-Day Logic Missing:**
   - **Impact:** Incorrect extension calculations
   - **Affected Systems:** Cron, Settings
   - **Likelihood:** Low (only affects half-day cases)

2. **Intern/Employee Confusion:**
   - **Impact:** Interns processed as probation employees
   - **Affected Systems:** Legacy
   - **Likelihood:** Low (requires data inconsistency)

---

## 8. Fix Recommendations (No Code)

### 8.1 Immediate Actions (Critical)

1. **Standardize on Single Calculation Method:**
   - Use the new `analytics.js` probation-tracker logic as the **single source of truth**
   - Deprecate legacy `probationTrackingService.calculateProbationProgress()`
   - Update cron service to use working-days calculation

2. **Fix Timezone Handling:**
   - Convert all date operations to IST explicitly
   - Use consistent date parsing: `new Date(date.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}))`
   - Store dates in DB as UTC but always convert to IST for calculations

3. **Fix Probation Settings Endpoint:**
   - Calculate `probationEndDate` using working days, not calendar months
   - Apply IST timezone conversion
   - Account for weekends and holidays

### 8.2 Short-Term Actions (High Priority)

1. **Unify Probation Duration:**
   - Use single source: Setting `'probationDurationDays'` (working days)
   - Remove hardcoded values
   - Remove month-based calculations

2. **Fix Cron Service:**
   - Replace calendar-day calculation with working-days calculation
   - Use same logic as `analytics.js` probation-tracker
   - Apply leave and absent extensions

3. **Update Legacy Endpoints:**
   - Mark `/api/probation/employee/:id/progress` as deprecated
   - Redirect to new analytics endpoint
   - Or update to use new calculation logic

### 8.3 Long-Term Actions (Medium Priority)

1. **Data Model Cleanup:**
   - Clarify `employmentStatus` vs `probationStatus` usage
   - Standardize on `probationStartDate` (not `joiningDate`) for converted interns
   - Add migration to set `probationStartDate` for existing employees

2. **API Consolidation:**
   - Single probation calculation service
   - All endpoints use same calculation logic
   - Consistent response format (IST date strings)

3. **Frontend Utilities:**
   - Create shared date utility for IST operations
   - Consistent date formatting across components
   - Type-safe date handling

### 8.4 Testing Recommendations

1. **Unit Tests:**
   - Test working days calculation (weekends, holidays, alternate Saturdays)
   - Test leave extension logic (full day, half day)
   - Test absent extension logic
   - Test timezone conversions (UTC to IST)

2. **Integration Tests:**
   - Test probation end date calculation end-to-end
   - Test with various leave/absent scenarios
   - Test with different Saturday policies
   - Test with multiple holidays

3. **Edge Case Tests:**
   - Employee joining on Sunday
   - Employee joining on holiday
   - Employee with leaves on weekends/holidays
   - Employee with overlapping leaves and absences
   - Intern converted to probation mid-period

---

## 9. Probation Calculation Flow (Current State)

### 9.1 Legacy Flow (probationTrackingService.js)

```
Employee.joiningDate (UTC)
  ↓
Calculate totalDays = (today - joiningDate) in calendar days
  ↓
Count attendance logs with clockInTime && clockOutTime
  ↓
Count approved leaves (full = 1.0, half = 0.5)
  ↓
Check if workingDaysCompleted >= 180
  ↓
Return: { isCompleted, remainingDays }
```

**Issues:**
- No working days calculation
- No holiday/weekend exclusion
- Leaves counted but don't extend probation

### 9.2 Cron Flow (cronService.js)

```
Employee.joiningDate (UTC)
  ↓
endDate = joiningDate + PROBATION_PERIOD_DAYS (calendar days)
  ↓
Calculate daysUntilEnd = (endDate - today) in calendar days
  ↓
If daysUntilEnd <= 7, send reminder email
```

**Issues:**
- Calendar days only
- No working days
- No leave/absent extensions
- No holiday/weekend exclusion

### 9.3 New Flow (analytics.js - probation-tracker)

```
Employee.joiningDate (UTC)
  ↓
Convert to IST: joiningDateIST
  ↓
probationStartDate = IST date string (YYYY-MM-DD)
  ↓
Get probationDurationDays (from settings or employee.probationDurationMonths * 22)
  ↓
Count working days from startDate, excluding:
  - Sundays
  - Alternate off-Saturdays
  - Holidays
  ↓
Add leave extension days (full = 1.0, half = 0.5)
  ↓
Add absent extension days (full = 1.0, half = 0.5)
  ↓
Calculate tentativeEndDate = startDate + duration + extensions (in working days)
  ↓
Count working days from today to tentativeEndDate = daysLeft
  ↓
Return: { probationAnalytics }
```

**This is the CORRECT flow.**

---

## 10. Conclusion

The application has **three different probation calculation systems** with **significant inconsistencies**:

1. **Legacy system** (`probationTrackingService.js`): Working days from attendance, no holiday/weekend exclusion, no extensions
2. **Cron system** (`cronService.js`): Calendar days, no exclusions, no extensions
3. **New system** (`analytics.js`): Working days with proper exclusions and extensions ✅

**Critical Issues:**
- Timezone handling inconsistent (UTC vs IST)
- Working days vs calendar days confusion
- Leave/absent extensions not applied in legacy systems
- Holiday/weekend exclusions missing in legacy systems

**Recommendation:**
- **Standardize on the new `analytics.js` probation-tracker logic** as the single source of truth
- Update all other systems to use the same calculation method
- Fix timezone handling across all systems
- Consolidate APIs to use consistent response format

**Production Impact:**
- Employees may see incorrect probation end dates in legacy views
- Reminder emails may be sent with incorrect dates
- Probation completion checks may trigger at wrong times
- Settings updates may store incorrect end dates

---

**Report End**



