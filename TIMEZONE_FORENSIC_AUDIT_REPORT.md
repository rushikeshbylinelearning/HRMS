====================================================
TIMEZONE FORENSIC AUDIT REPORT
====================================================
Generated: 2026-01-XX
Auditor: Senior Staff Engineer + Timezone & Distributed Systems Auditor
Scope: Full-Stack Line-by-Line Timezone Analysis
Status: READ-ONLY FORENSIC ANALYSIS (NO CODE CHANGES)

====================================================
SECTION 1 — GLOBAL TIMEZONE MAP
====================================================

DETECTED TIMEZONES IN SYSTEM:

1. **Browser Local Time**
   - Source: `new Date()` in frontend React components
   - Usage: EmployeeDashboardPage.jsx, LeavesPage.jsx, AttendanceSummaryPage.jsx
   - Risk: Varies by user's system timezone

2. **Server OS Time**
   - Source: Node.js `new Date()` in backend
   - Usage: All backend routes, services, cron jobs
   - Risk: Depends on server OS timezone configuration (UNKNOWN - not explicitly set)

3. **UTC (MongoDB Default)**
   - Source: MongoDB Date storage
   - Usage: All Date fields in Mongoose models (clockInTime, clockOutTime, joiningDate, etc.)
   - Risk: HIGH - Dates stored as UTC but often parsed/compared without conversion

4. **IST (Asia/Kolkata) - EXPLICIT**
   - Source: Hardcoded `timeZone: 'Asia/Kolkata'` in Intl.DateTimeFormat
   - Usage: 
     - backend/routes/attendance.js:21-32 (getShiftDateTimeIST)
     - backend/routes/analytics.js:276-287 (getShiftDateTimeIST)
     - backend/services/dailyStatusService.js:21-32 (getShiftDateTimeIST)
     - backend/routes/leaves.js:30, 312 (Date.UTC with +05:30 offset)
     - backend/routes/analytics.js:226, 615, 1568, 1601, 1670, 1703 (toLocaleString with IST)
     - backend/services/cronService.js:65, 95 (toLocaleString with IST)
     - frontend/src/components/ProbationTracker.jsx:60, 65 (IST parsing)
     - frontend/src/components/ViewAnalyticsModal.jsx:206, 386, 476 (IST conversion)
   - Risk: MEDIUM - Explicit but inconsistent application

5. **Hardcoded Offset: +05:30**
   - Source: Manual UTC offset calculation
   - Usage:
     - backend/routes/attendance.js:30 (`+05:30` in ISO string)
     - backend/routes/analytics.js:285 (`+05:30` in ISO string)
     - backend/routes/leaves.js:30, 312 (`Date.UTC(year, month - 1, day, 5, 30, 0)`)
     - backend/routes/analytics.js:1588, 1677 (`T00:00:00+05:30`)
     - frontend/src/components/ProbationTracker.jsx:60 (`T00:00:00+05:30`)
   - Risk: MEDIUM - DST-unsafe (IST doesn't observe DST, but pattern is brittle)

6. **Database Timezone (MongoDB)**
   - Configuration: NOT EXPLICITLY SET
   - Default: UTC (MongoDB stores all Date objects as UTC)
   - Risk: HIGH - No explicit timezone configuration in db.js

7. **Cron Execution Timezone**
   - Source: Node.js process timezone (UNKNOWN)
   - Usage: backend/services/cronService.js (setInterval-based jobs)
   - Risk: HIGH - No explicit timezone set for cron execution

====================================================
SECTION 2 — FRONTEND TIMEZONE USAGE
====================================================

FILE: frontend/src/pages/EmployeeDashboardPage.jsx

Line 72-77: getLocalDateString()
```72:77:frontend/src/pages/EmployeeDashboardPage.jsx
const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
```
- Timezone Assumed: Browser Local Time
- Source: `new Date()` uses browser's system timezone
- Dependency: None (pure frontend calculation)
- Risk Level: MEDIUM - Date string generation depends on user's system timezone

Line 109: getLocalDateString() usage
```109:109:frontend/src/pages/EmployeeDashboardPage.jsx
const localDate = getLocalDateString();
```
- Timezone Assumed: Browser Local Time
- Risk Level: MEDIUM - May generate different date strings for users in different timezones

Line 241-243: Date arithmetic for working hours
```241:243:frontend/src/pages/EmployeeDashboardPage.jsx
const now = new Date();
const grossTimeMs = dailyData.sessions.reduce((total, s) => total + ((s.endTime ? new Date(s.endTime) : now) - new Date(s.startTime)), 0);
const breakTimeMs = (dailyData.breaks || []).reduce((total, b) => total + ((b.endTime ? new Date(b.endTime) : now) - new Date(b.startTime)), 0);
```
- Timezone Assumed: Browser Local Time (for `now`), UTC (for API timestamps)
- Risk Level: LOW - Time differences are timezone-agnostic

Line 309, 379, 408: new Date().toISOString()
```309:309:frontend/src/pages/EmployeeDashboardPage.jsx
setDailyData(prev => ({ ...prev, status: 'Clocked In', sessions: [{ startTime: new Date().toISOString(), endTime: null }] }));
```
- Timezone Assumed: UTC (toISOString() always returns UTC)
- Risk Level: MEDIUM - Converts browser local time to UTC, may cause off-by-one-day issues

---

FILE: frontend/src/pages/LeavesPage.jsx

Line 143, 278: new Date().getFullYear()
```143:143:frontend/src/pages/LeavesPage.jsx
const currentYear = new Date().getFullYear();
```
- Timezone Assumed: Browser Local Time
- Risk Level: LOW - Year extraction is timezone-safe

Line 344: formatDate() with toLocaleDateString
```344:344:frontend/src/pages/LeavesPage.jsx
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';
```
- Timezone Assumed: Browser Local Time (toLocaleDateString uses browser timezone)
- Risk Level: HIGH - Date string parsing may shift dates based on browser timezone

Line 350-354: Date formatting with multiple locales
```350:354:frontend/src/pages/LeavesPage.jsx
const d = new Date(dateString);
return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
```
- Timezone Assumed: Browser Local Time
- Risk Level: MEDIUM - Display formatting depends on browser timezone

Line 397: toISOString().split('T')[0]
```397:397:frontend/src/pages/LeavesPage.jsx
: new Date(req.leaveDates[0]).toISOString().split('T')[0];
```
- Timezone Assumed: UTC
- Risk Level: HIGH - Converts to UTC date string, may cause off-by-one-day when date is in IST

Line 403, 409: new Date() for month navigation
```403:409:frontend/src/pages/LeavesPage.jsx
const today = new Date();
// ... month offset logic ...
const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
```
- Timezone Assumed: Browser Local Time
- Risk Level: MEDIUM - Month calculations depend on browser timezone

---

FILE: frontend/src/pages/AdminAttendanceSummaryPage.jsx

Line 33, 42: new Date() for current date
```33:33:frontend/src/pages/AdminAttendanceSummaryPage.jsx
const [currentDate, setCurrentDate] = useState(new Date());
```
- Timezone Assumed: Browser Local Time
- Risk Level: MEDIUM - Current date depends on browser timezone

Line 115-118: Date range calculation
```115:118:frontend/src/pages/AdminAttendanceSummaryPage.jsx
const firstDay = new Date(year, month, 1);
const lastDay = new Date(year, month + 1, 0);
startDate = firstDay.toLocaleDateString('en-CA');
endDate = lastDay.toLocaleDateString('en-CA');
```
- Timezone Assumed: Browser Local Time
- Risk Level: MEDIUM - Date boundaries depend on browser timezone

Line 153-157: Today's start calculation
```153:157:frontend/src/pages/AdminAttendanceSummaryPage.jsx
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
// ... filter logic ...
const logDate = new Date(log.attendanceDate);
```
- Timezone Assumed: Browser Local Time (todayStart), UTC parsing (log.attendanceDate)
- Risk Level: HIGH - Mismatch between browser local time and UTC-parsed date

---

FILE: frontend/src/pages/AttendanceSummaryPage.jsx

Line 35: new Date() for current date
```35:35:frontend/src/pages/AttendanceSummaryPage.jsx
const [currentDate, setCurrentDate] = useState(new Date());
```
- Timezone Assumed: Browser Local Time
- Risk Level: MEDIUM

Line 58-61: Month range calculation
```58:61:frontend/src/pages/AttendanceSummaryPage.jsx
const firstDay = new Date(year, month, 1);
const lastDay = new Date(year, month + 1, 0);
startDate = firstDay.toLocaleDateString('en-CA');
endDate = lastDay.toLocaleDateString('en-CA');
```
- Timezone Assumed: Browser Local Time
- Risk Level: MEDIUM

---

FILE: frontend/src/components/ProbationTracker.jsx

Line 56-70: formatDateIST()
```56:70:frontend/src/components/ProbationTracker.jsx
const formatDateIST = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      // Parse as IST date
      const date = new Date(dateStr + 'T00:00:00+05:30');
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
    } catch (err) {
      return dateStr;
    }
  };
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Source: Hardcoded +05:30 offset and timeZone option
- Risk Level: LOW - Correctly uses IST

---

FILE: frontend/src/components/ViewAnalyticsModal.jsx

Line 206-212: IST date calculation
```206:212:frontend/src/components/ViewAnalyticsModal.jsx
const todayIST = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
const todayISTDate = new Date(todayIST);
// Format dates properly to avoid timezone issues
const startYear = selectedYear;
const startDate = `${startYear}-01-01`;
const endDate = todayISTDate.toISOString().slice(0, 10);
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: MEDIUM - Converts IST to Date object, then to UTC ISO string (potential conversion issues)

Line 386: IST time formatting
```386:386:frontend/src/components/ViewAnalyticsModal.jsx
const istTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: MEDIUM - Double conversion (Date → String → Date) may introduce errors

Line 476-491: getISTDate() and formatDateKey()
```476:491:frontend/src/components/ViewAnalyticsModal.jsx
const getISTDate = () => {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  };

  // Helper function to format date consistently (avoid timezone issues)
  const formatDateKey = (date) => {
    // If date is already a string in YYYY-MM-DD format, return as is
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // For Date objects, format directly without timezone conversion
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
```
- Timezone Assumed: IST (getISTDate), Browser Local Time (formatDateKey)
- Risk Level: MEDIUM - Inconsistent timezone handling between functions

====================================================
SECTION 3 — BACKEND TIMEZONE USAGE
====================================================

FILE: backend/routes/attendance.js

Line 21-32: getShiftDateTimeIST()
```21:32:backend/routes/attendance.js
const getShiftDateTimeIST = (onDate, shiftTime) => {
    const [hours, minutes] = shiftTime.split(':').map(Number);
    const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const [{ value: year },, { value: month },, { value: day }] = istDateFormatter.formatToParts(onDate);
    const shiftDateTimeISO_IST = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000+05:30`;
    return new Date(shiftDateTimeISO_IST);
};
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Conversion Logic: Converts input date to IST date parts, then creates ISO string with +05:30 offset
- Incoming Timezone Expectation: Any (converts to IST)
- Outgoing Timezone Format: Date object (internal UTC representation)
- Risk Level: LOW - Correctly uses IST

Line 68: todayStr calculation
```68:68:backend/routes/attendance.js
const todayStr = new Date().toISOString().slice(0, 10);
```
- Timezone Assumed: UTC (toISOString() returns UTC)
- Risk Level: HIGH - Uses UTC date string, but should use IST for attendanceDate

Line 100: clockInTime storage
```100:100:backend/routes/attendance.js
clockInTime: new Date(),
```
- Timezone Assumed: Server OS Time (converted to UTC by MongoDB)
- Risk Level: MEDIUM - Depends on server timezone (UNKNOWN)

Line 117: clockInTime for late calculation
```117:117:backend/routes/attendance.js
const clockInTime = new Date();
```
- Timezone Assumed: Server OS Time
- Risk Level: MEDIUM - Compared against IST shift time (getShiftDateTimeIST)

Line 207, 356: Notification time formatting
```207:207:backend/routes/attendance.js
message: `You have successfully clocked in at ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })}.`,
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: LOW - Correctly uses IST

Line 278: today calculation for clock-out
```278:278:backend/routes/attendance.js
const today = new Date().toISOString().slice(0, 10);
```
- Timezone Assumed: UTC
- Risk Level: HIGH - UTC date string may not match IST date

Line 297: clockOutTime storage
```297:297:backend/routes/attendance.js
const clockOutTime = new Date();
```
- Timezone Assumed: Server OS Time
- Risk Level: MEDIUM

Line 416-422: Weekly date range calculation
```416:422:backend/routes/attendance.js
const today = new Date();
const dayOfWeek = today.getDay();
const firstDayOfWeek = new Date(today.setDate(today.getDate() - dayOfWeek));
const lastDayOfWeek = new Date(firstDayOfWeek);
lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
startDate = firstDayOfWeek.toISOString().slice(0, 10);
endDate = lastDayOfWeek.toISOString().slice(0, 10);
```
- Timezone Assumed: Server OS Time (converted to UTC)
- Risk Level: HIGH - Week boundaries calculated in server timezone, then converted to UTC string

Line 471, 583, 624: todayStr for break operations
```471:471:backend/routes/attendance.js
const today = new Date().toISOString().slice(0, 10);
```
- Timezone Assumed: UTC
- Risk Level: HIGH - UTC date string may not match IST date

Line 733-734: Month range calculation
```733:734:backend/routes/attendance.js
const monthStart = new Date(year, month, 1);
const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
```
- Timezone Assumed: Server OS Time
- Risk Level: MEDIUM - Month boundaries depend on server timezone

Line 1121-1128: Dashboard weekly range
```1121:1128:backend/routes/attendance.js
const today = new Date(localDate);
const dayOfWeek = today.getDay();
const firstDayOfWeek = new Date(today);
firstDayOfWeek.setDate(today.getDate() - dayOfWeek);
const lastDayOfWeek = new Date(firstDayOfWeek);
lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
const startDate = firstDayOfWeek.toISOString().slice(0, 10);
const endDate = lastDayOfWeek.toISOString().slice(0, 10);
```
- Timezone Assumed: UTC (from localDate string parsing)
- Risk Level: MEDIUM - Date string parsed as UTC, then manipulated

---

FILE: backend/routes/leaves.js

Line 16-42: formatLeaveDateRangeForEmail()
```16:42:backend/routes/leaves.js
const formatLeaveDateRangeForEmail = (leaveDates) => {
    // CRITICAL FIX: Use IST timezone explicitly to avoid timezone conversion issues
    const formatDate = (dateString) => {
        let d;
        if (dateString instanceof Date) {
            d = dateString;
        } else if (typeof dateString === 'string') {
            // Handle ISO date strings (YYYY-MM-DD) - parse as IST date
            if (dateString.includes('T')) {
                // ISO datetime string - convert to IST
                d = new Date(dateString);
            } else {
                // Date-only string (YYYY-MM-DD) - parse as IST date to avoid timezone shift
                const [year, month, day] = dateString.split('-').map(Number);
                // Create date in IST timezone (UTC+5:30)
                d = new Date(Date.UTC(year, month - 1, day, 5, 30, 0)); // IST offset: UTC+5:30
            }
        } else {
            d = new Date(dateString);
        }
        // Format using IST timezone explicitly
        return d.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric',
            timeZone: 'Asia/Kolkata' // IST timezone
        });
    };
    // ... rest of function
};
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Conversion Logic: Parses YYYY-MM-DD as IST by adding +05:30 offset to UTC
- Risk Level: LOW - Correctly handles IST

Line 172, 223: leaveDatesArray conversion
```172:172:backend/routes/leaves.js
const leaveDatesArray = leaveDates.map(date => new Date(date));
```
- Timezone Assumed: UTC (new Date() parses strings as UTC if no timezone specified)
- Risk Level: HIGH - Date strings parsed as UTC, may shift dates

Line 256-260: Backdated leave check
```256:260:backend/routes/leaves.js
const today = new Date();
today.setHours(0, 0, 0, 0);
const firstLeaveDate = new Date(leaveDatesArray[0]);
firstLeaveDate.setHours(0, 0, 0, 0);
const isBackdated = firstLeaveDate < today;
```
- Timezone Assumed: Server OS Time
- Risk Level: MEDIUM - Comparison depends on server timezone

Line 295-324: formatDateForNotification()
```295:324:backend/routes/leaves.js
const formatDateForNotification = (date) => {
    // CRITICAL FIX: Use IST timezone explicitly to avoid timezone conversion issues
    // When date string is "2024-01-25", new Date() interprets as UTC midnight
    // which then converts to previous day in timezones ahead of UTC (like IST)
    // Solution: Use IST timezone explicitly for all date formatting
    let d;
    if (date instanceof Date) {
        d = date;
    } else if (typeof date === 'string') {
        // Handle ISO date strings (YYYY-MM-DD) - parse as IST date
        if (date.includes('T')) {
            // ISO datetime string - convert to IST
            d = new Date(date);
        } else {
            // Date-only string (YYYY-MM-DD) - parse as IST date to avoid timezone shift
            const [year, month, day] = date.split('-').map(Number);
            // Create date in IST timezone (UTC+5:30)
            d = new Date(Date.UTC(year, month - 1, day, 5, 30, 0)); // IST offset: UTC+5:30
        }
    } else {
        d = new Date(date);
    }
    // Format using IST timezone explicitly
    return d.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        timeZone: 'Asia/Kolkata' // IST timezone
    });
};
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: LOW - Correctly handles IST

Line 436-444: Year-end request year detection
```436:444:backend/routes/leaves.js
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth(); // 0-11 (0 = January, 11 = December)

// Determine the closing year for the year-end request
// If we're in December, use current year (closing year)
// If we're in January, use previous year (still processing last year's year-end)
// Otherwise, use current year (assume we're processing current year's year-end)
const closingYear = (currentMonth === 0) ? (currentYear - 1) : currentYear;
```
- Timezone Assumed: Server OS Time
- Risk Level: MEDIUM - Year/month detection depends on server timezone

---

FILE: backend/routes/analytics.js

Line 226: nowIST calculation
```226:226:backend/routes/analytics.js
const nowIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: MEDIUM - Double conversion (Date → String → Date) may introduce errors

Line 276-287: getShiftDateTimeIST()
```276:287:backend/routes/analytics.js
const getShiftDateTimeIST = (onDate, shiftTime) => {
  const [hours, minutes] = shiftTime.split(':').map(Number);
  const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [{ value: year },, { value: month },, { value: day }] = istDateFormatter.formatToParts(onDate);
  const shiftDateTimeISO_IST = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000+05:30`;
  return new Date(shiftDateTimeISO_IST);
};
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: LOW - Correctly uses IST

Line 375: Email notification time formatting
```375:375:backend/routes/analytics.js
<p style="margin: 0 0 10px 0; font-size: 16px;">You logged in late on <strong>${attendanceLog.attendanceDate}</strong> at <strong>${clockInTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })}</strong>.</p>
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: LOW

Line 613-617: Default date range calculation
```613:617:backend/routes/analytics.js
// Use IST timezone for consistent date calculations
const now = new Date();
const nowIST = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
const defaultStartDate = new Date(nowIST.getFullYear(), nowIST.getMonth() - 3, 1).toISOString().slice(0, 10);
const defaultEndDate = new Date(nowIST.getFullYear(), nowIST.getMonth() + 1, 0).toISOString().slice(0, 10);
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: MEDIUM - Converts IST to Date, then uses getFullYear/getMonth (which use local timezone), then converts to UTC ISO string

Line 841-844: Weekly data generation
```841:844:backend/routes/analytics.js
const weekStart = new Date();
weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + (i * 7)));
const weekEnd = new Date(weekStart);
weekEnd.setDate(weekEnd.getDate() + 6);
```
- Timezone Assumed: Server OS Time
- Risk Level: MEDIUM - Week boundaries calculated in server timezone

Line 869-874: Monthly data generation
```869:874:backend/routes/analytics.js
const monthStart = new Date();
monthStart.setMonth(monthStart.getMonth() - i);
monthStart.setDate(1);
const monthEnd = new Date(monthStart);
monthEnd.setMonth(monthEnd.getMonth() + 1);
monthEnd.setDate(0);
```
- Timezone Assumed: Server OS Time
- Risk Level: MEDIUM

Line 941-942: Default date range (alternative)
```941:942:backend/routes/analytics.js
const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
```
- Timezone Assumed: Server OS Time (now variable)
- Risk Level: MEDIUM

Line 1401, 1418: Login time formatting for export
```1401:1401:backend/routes/analytics.js
const loginTime = log.clockInTime ? new Date(log.clockInTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' }) : '';
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: LOW

Line 1568-1580: Probation tracker IST conversion
```1568:1580:backend/routes/analytics.js
const joiningDateIST = new Date(joiningDate.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
const probationStartDate = new Date(
  joiningDateIST.getFullYear(),
  joiningDateIST.getMonth(),
  joiningDateIST.getDate(),
  0, 0, 0, 0
);
const probationStartDateStr = `${probationStartDate.getFullYear()}-${String(probationStartDate.getMonth() + 1).padStart(2, '0')}-${String(probationStartDate.getDate()).padStart(2, '0')}`;
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: MEDIUM - Double conversion may introduce errors

Line 1588: Probation date query with IST offset
```1588:1588:backend/routes/analytics.js
$gte: new Date(probationStartDateStr + 'T00:00:00+05:30') // IST midnight
```
- Timezone Assumed: IST (+05:30) - EXPLICIT
- Risk Level: LOW - Correctly uses IST offset

Line 1601: Leave date IST conversion
```1601:1601:backend/routes/analytics.js
const leaveDateIST = new Date(leaveDateObj.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: MEDIUM - Double conversion

Line 1670-1677: Today IST calculation for days left
```1670:1677:backend/routes/analytics.js
const todayIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
const today = new Date(
  todayIST.getFullYear(),
  todayIST.getMonth(),
  todayIST.getDate(),
  0, 0, 0, 0
);
const endDate = new Date(finalProbationEndDateStr + 'T00:00:00+05:30');
const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: MEDIUM - Complex conversion chain

---

FILE: backend/services/cronService.js

Line 49-50: today calculation
```49:50:backend/services/cronService.js
const today = new Date();
today.setHours(0, 0, 0, 0);
```
- Timezone Assumed: Server OS Time
- Risk Level: HIGH - Cron execution timezone is UNKNOWN

Line 65: joiningDateIST conversion
```65:65:backend/services/cronService.js
const joiningDateIST = new Date(joiningDate.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: MEDIUM - Double conversion

Line 95: leaveDateIST conversion
```95:95:backend/services/cronService.js
const leaveDateIST = new Date(leaveDateObj.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: MEDIUM - Double conversion

Line 180: daysUntilEnd calculation
```180:180:backend/services/cronService.js
const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
```
- Timezone Assumed: Server OS Time (today), IST-derived (endDate)
- Risk Level: HIGH - Mismatch between server timezone and IST-derived date

---

FILE: backend/services/dailyStatusService.js

Line 21-32: getShiftDateTimeIST()
```21:32:backend/services/dailyStatusService.js
const getShiftDateTimeIST = (onDate, shiftTime) => {
    const [hours, minutes] = shiftTime.split(':').map(Number);
    const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const [{ value: year }, , { value: month }, , { value: day }] = istDateFormatter.formatToParts(onDate);
    const shiftDateTimeISO_IST = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000+05:30`;
    return new Date(shiftDateTimeISO_IST);
};
```
- Timezone Assumed: IST (Asia/Kolkata) - EXPLICIT
- Risk Level: LOW - Correctly uses IST

====================================================
SECTION 4 — DATABASE & ORM TIMEZONE BEHAVIOR
====================================================

DATABASE CONFIGURATION:

File: backend/db.js
- MongoDB Connection: No explicit timezone configuration
- Default Behavior: MongoDB stores all Date objects as UTC
- Timestamp Columns: All Date fields stored as UTC

TIMESTAMP COLUMN TYPES:

1. **AttendanceLog Model**
   - `clockInTime`: Date (UTC)
   - `clockOutTime`: Date (UTC)
   - `attendanceDate`: String (YYYY-MM-DD) - NOT a Date field
   - `createdAt`: Date (UTC, from timestamps: true)
   - `updatedAt`: Date (UTC, from timestamps: true)

2. **User Model**
   - `joiningDate`: Date (UTC)
   - `probationStartDate`: Date (UTC)
   - `probationEndDate`: Date (UTC)
   - `conversionDate`: Date (UTC)
   - `createdAt`: Date (UTC)
   - `updatedAt`: Date (UTC)

3. **LeaveRequest Model**
   - `leaveDates`: Array of Date (UTC)
   - `alternateDate`: Date (UTC)
   - `createdAt`: Date (UTC)
   - `updatedAt`: Date (UTC)

4. **Holiday Model**
   - `date`: Date (UTC)

READ/WRITE TIMEZONE BEHAVIOR:

- **Write Behavior**: All Date objects are converted to UTC by MongoDB before storage
- **Read Behavior**: Date objects are returned as UTC Date objects
- **String Fields**: `attendanceDate` stored as YYYY-MM-DD string (no timezone info)

ORM DEFAULTS & OVERRIDES:

- **Mongoose**: No timezone configuration
- **Default**: All Date fields stored/retrieved as UTC
- **No Overrides**: No timezone-aware getters/setters

SILENT CONVERSIONS:

1. **Date String Parsing**: `new Date("2024-01-25")` is parsed as UTC midnight
   - Location: Multiple files
   - Impact: Date strings without timezone are interpreted as UTC, causing off-by-one-day in IST

2. **toISOString() Conversion**: Converts Date to UTC string
   - Location: Multiple files (attendance.js:68, 278, 471, etc.)
   - Impact: Local dates converted to UTC may shift to previous/next day

3. **MongoDB Date Storage**: All Date objects automatically converted to UTC
   - Impact: Server local time stored as UTC, may not match intended IST time

====================================================
SECTION 5 — AGGREGATION & REPORTING ENDPOINTS
====================================================

ENDPOINT: GET /api/attendance/summary

File: backend/routes/attendance.js:954-1103

Time Grouping Logic:
- Groups by `attendanceDate` (YYYY-MM-DD string)
- Date range filtering: `{ $gte: startDate, $lte: endDate }` (string comparison)

Day Boundary Definition:
- Uses `attendanceDate` string field (YYYY-MM-DD)
- No explicit timezone for day boundaries
- Risk: If `attendanceDate` was set using UTC date, day boundaries may be incorrect

Timezone Used for Grouping:
- String comparison (no timezone conversion)
- Risk: MEDIUM - Depends on how `attendanceDate` was originally set

Mismatch Risks with UI:
- HIGH - Frontend may calculate date ranges in browser timezone, backend uses UTC-derived strings

---

ENDPOINT: GET /api/analytics/employee/:id

File: backend/routes/analytics.js:590-927

Time Grouping Logic:
- Groups by `attendanceDate` (YYYY-MM-DD string)
- Date range: `{ $gte: start, $lte: end }` (string comparison)

Day Boundary Definition:
- Uses `attendanceDate` string field
- Default range calculation uses IST (line 613-617)

Timezone Used for Grouping:
- String comparison
- Default dates calculated from IST (line 616-617)

Mismatch Risks with UI:
- MEDIUM - Default dates use IST, but string comparison is timezone-agnostic

---

ENDPOINT: GET /api/analytics/probation-tracker

File: backend/routes/analytics.js:1541-1748

Time Grouping Logic:
- Groups by date strings (YYYY-MM-DD)
- Uses IST for all date calculations (explicit)

Day Boundary Definition:
- IST midnight (`T00:00:00+05:30`)
- Line 1588, 1677: Explicit IST offset

Timezone Used for Grouping:
- IST (Asia/Kolkata) - EXPLICIT

Mismatch Risks with UI:
- LOW - Consistently uses IST

---

ENDPOINT: GET /api/attendance/actual-work-days

File: backend/routes/attendance.js:804-940

Time Grouping Logic:
- Groups by `attendanceDate` (YYYY-MM-DD string)
- Filters by working dates set (excludes Sundays, holidays, alternate Saturdays)

Day Boundary Definition:
- Uses `attendanceDate` string field
- Working dates calculated using Date objects (line 760-778)

Timezone Used for Grouping:
- Server OS Time (for working date calculation)
- String comparison (for attendance log filtering)

Mismatch Risks with UI:
- MEDIUM - Working date calculation depends on server timezone

====================================================
SECTION 6 — CRON / SCHEDULERS / BACKGROUND JOBS
====================================================

JOB: Daily Probation/Internship Ending Check

File: backend/services/cronService.js:20-208

Execution Timezone:
- UNKNOWN - Uses `setInterval` with 24-hour interval
- No explicit timezone configuration
- Depends on server OS timezone

Trigger vs Data Timezone Mismatch:
- HIGH - `today` calculated in server timezone (line 49-50)
- Probation dates calculated in IST (line 65, 95)
- Comparison may be incorrect if server timezone ≠ IST

Impact:
- Probation reminder emails may be sent on wrong day
- Days-until-end calculation may be incorrect

---

JOB: Weekly Late Warnings

File: backend/services/cronService.js:213-226

Execution Timezone:
- UNKNOWN - Uses `setInterval` with 7-day interval
- No explicit timezone configuration

Trigger vs Data Timezone Mismatch:
- MEDIUM - Depends on server timezone for week boundaries

Impact:
- Weekly late tracking may use incorrect week boundaries

---

JOB: Auto-Logout Check

File: backend/services/autoLogoutService.js (referenced in cronService.js:244-265)

Execution Timezone:
- UNKNOWN - Runs every 5 minutes
- No explicit timezone configuration

Trigger vs Data Timezone Mismatch:
- MEDIUM - Clock-out time calculations depend on server timezone

Impact:
- Auto-logout may occur at wrong time if server timezone ≠ IST

---

JOB: Excel Sync Service

File: backend/excel-sync-service.js

Execution Timezone:
- UNKNOWN - Uses `node-cron` with schedule `*/1 * * * *` (every minute)
- No explicit timezone configuration

Trigger vs Data Timezone Mismatch:
- MEDIUM - Date calculations depend on server timezone

Impact:
- Excel sync may use incorrect date boundaries

====================================================
SECTION 7 — CROSS-MODULE TIMEZONE DEPENDENCIES
====================================================

FRONTEND ↔ BACKEND:

1. **Date String Transmission**
   - Frontend sends: `YYYY-MM-DD` strings (from browser local time)
   - Backend receives: Parses as UTC if using `new Date(dateString)`
   - Risk: HIGH - Off-by-one-day errors

2. **Timestamp Transmission**
   - Frontend sends: `new Date().toISOString()` (UTC)
   - Backend receives: UTC Date objects
   - Risk: MEDIUM - May not match IST day boundaries

3. **Date Range Queries**
   - Frontend calculates: Browser local time ranges
   - Backend queries: UTC-derived date strings
   - Risk: HIGH - Mismatched day boundaries

BACKEND ↔ DATABASE:

1. **Date Storage**
   - Backend writes: Date objects (server timezone → UTC)
   - Database stores: UTC Date objects
   - Risk: MEDIUM - Server timezone conversion may be incorrect

2. **Date Retrieval**
   - Database returns: UTC Date objects
   - Backend reads: UTC Date objects
   - Risk: MEDIUM - Backend must convert to IST for calculations

3. **String Date Fields**
   - `attendanceDate`: Stored as YYYY-MM-DD string
   - Risk: HIGH - No timezone info, may be set using UTC or IST inconsistently

BACKEND ↔ CRON:

1. **Cron Execution**
   - Cron runs: Server OS timezone (UNKNOWN)
   - Data calculations: Mix of server timezone and IST
   - Risk: HIGH - Mismatch causes incorrect day boundaries

2. **Date Comparisons**
   - Cron uses: Server timezone dates
   - Data uses: IST dates (in some places)
   - Risk: HIGH - Comparisons may be incorrect

HOSTED ↔ LOCAL ENVIRONMENT DIFFERENCES:

1. **Server Timezone**
   - Local: May be IST or developer's local timezone
   - Hosted: UNKNOWN (not configured)
   - Risk: HIGH - Different behavior in different environments

2. **Date Calculations**
   - Local: May work correctly if server timezone = IST
   - Hosted: May fail if server timezone ≠ IST
   - Risk: HIGH - Environment-specific bugs

3. **Browser Timezone**
   - Local: Developer's timezone
   - Hosted: User's timezone (varies)
   - Risk: MEDIUM - Different users see different dates

====================================================
SECTION 8 — DETECTED TIMEZONE ERRORS & SYMPTOMS
====================================================

ISSUE #1: UTC Date String Generation for attendanceDate

Description:
- `attendanceDate` is set using `new Date().toISOString().slice(0, 10)` in multiple places
- This generates UTC date string, not IST date string

Exact Code Locations:
- backend/routes/attendance.js:68, 278, 471, 583, 624
- backend/routes/breaks.js:23, 106, 210
- Multiple other locations

Why It Happens:
- `toISOString()` always returns UTC date string
- Server may be in different timezone than IST

Visible Symptom:
- Employee clocks in at 11:00 PM IST (Jan 1)
- `attendanceDate` set to "2025-01-01" (UTC, which is Jan 2 in IST)
- Attendance record appears on wrong day
- Off-by-one-day errors in attendance logs

Severity: CRITICAL

---

ISSUE #2: Date String Parsing as UTC

Description:
- Date strings like "2024-01-25" are parsed using `new Date(dateString)`
- JavaScript interprets this as UTC midnight, not IST midnight

Exact Code Locations:
- backend/routes/leaves.js:172, 223
- frontend/src/pages/LeavesPage.jsx:344, 350
- Multiple other locations

Why It Happens:
- `new Date("YYYY-MM-DD")` is parsed as UTC per ECMAScript spec
- No timezone information in date string

Visible Symptom:
- Leave request for "2024-01-25" stored as UTC midnight
- In IST (UTC+5:30), this is "2024-01-25 05:30:00 IST"
- When displayed, may show as previous day in some contexts
- Off-by-one-day errors in leave calculations

Severity: HIGH

---

ISSUE #3: Cron Job Timezone Mismatch

Description:
- Cron jobs use `new Date()` which uses server OS timezone
- Probation calculations use IST
- Comparison between server timezone and IST dates

Exact Code Locations:
- backend/services/cronService.js:49-50, 180

Why It Happens:
- No explicit timezone configuration for cron execution
- Server timezone is UNKNOWN

Visible Symptom:
- Probation reminder emails sent on wrong day
- Days-until-end calculation incorrect
- Reminders may be sent too early or too late

Severity: HIGH

---

ISSUE #4: Week Boundary Calculation in Server Timezone

Description:
- Weekly date ranges calculated using `new Date()` and `getDay()`
- Uses server OS timezone, not IST

Exact Code Locations:
- backend/routes/attendance.js:416-422
- backend/routes/analytics.js:841-844

Why It Happens:
- `getDay()` uses local timezone
- No conversion to IST

Visible Symptom:
- Weekly reports show wrong week boundaries
- Sunday/Monday boundary may be incorrect
- Data appears in wrong week

Severity: MEDIUM

---

ISSUE #5: Month Boundary Calculation in Server Timezone

Description:
- Month ranges calculated using `new Date(year, month, 1)`
- Uses server OS timezone

Exact Code Locations:
- backend/routes/attendance.js:733-734
- backend/routes/analytics.js:869-874, 941-942

Why It Happens:
- Date constructor uses local timezone
- No conversion to IST

Visible Symptom:
- Monthly reports may start/end on wrong day
- Data appears in wrong month

Severity: MEDIUM

---

ISSUE #6: Double Date Conversion Errors

Description:
- Multiple conversions: Date → String → Date
- Each conversion may introduce errors

Exact Code Locations:
- backend/routes/analytics.js:226, 615, 1568, 1601, 1670
- backend/services/cronService.js:65, 95
- frontend/src/components/ViewAnalyticsModal.jsx:206, 386

Why It Happens:
- Pattern: `new Date(date.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}))`
- Converts Date to string, then back to Date
- String parsing may lose precision or introduce errors

Visible Symptom:
- Dates may shift by hours or minutes
- Off-by-one-day errors in edge cases
- Inconsistent date calculations

Severity: MEDIUM

---

ISSUE #7: Frontend Date Range Calculation in Browser Timezone

Description:
- Frontend calculates date ranges using browser local time
- Sends to backend which may interpret differently

Exact Code Locations:
- frontend/src/pages/AdminAttendanceSummaryPage.jsx:115-118
- frontend/src/pages/AttendanceSummaryPage.jsx:58-61

Why It Happens:
- `new Date(year, month, 1)` uses browser timezone
- No conversion to IST

Visible Symptom:
- User in different timezone sees different date ranges
- Reports show incorrect data
- Inconsistent behavior across users

Severity: MEDIUM

---

ISSUE #8: MongoDB Date Storage Without Timezone Context

Description:
- All Date fields stored as UTC in MongoDB
- No timezone information stored
- Backend must remember which timezone was intended

Exact Code Locations:
- All Mongoose models with Date fields

Why It Happens:
- MongoDB default behavior
- No timezone-aware date type

Visible Symptom:
- Dates stored without timezone context
- Ambiguity in date interpretation
- Requires careful conversion on read

Severity: MEDIUM

====================================================
SECTION 9 — SINGLE SOURCE OF TRUTH ANALYSIS
====================================================

IS THERE A SINGLE CANONICAL TIMEZONE? NO

CONFLICTING AUTHORITIES:

1. **MongoDB Storage**: UTC (implicit, default)
2. **Server OS**: UNKNOWN (not configured)
3. **Explicit IST Usage**: Asia/Kolkata (in some functions)
4. **Browser**: User's local timezone (varies)
5. **Hardcoded Offset**: +05:30 (in some places)

NO SINGLE SOURCE OF TRUTH:
- Different parts of the system use different timezones
- No central timezone configuration
- No consistent conversion strategy
- Mix of UTC, IST, server timezone, and browser timezone

CONSEQUENCES:
- Inconsistent date calculations
- Off-by-one-day errors
- Environment-specific bugs
- User experience varies by timezone

====================================================
SECTION 10 — EXECUTIVE SUMMARY
====================================================

TOTAL TIMEZONE TOUCHPOINTS FOUND: 200+

Breakdown:
- Frontend: ~80 touchpoints
- Backend Routes: ~60 touchpoints
- Backend Services: ~30 touchpoints
- Database Models: ~10 touchpoints
- Cron Jobs: ~10 touchpoints
- Utilities/Helpers: ~10 touchpoints

TOTAL HIGH-RISK ISSUES: 8

Critical Issues:
1. UTC date string generation for attendanceDate (CRITICAL)
2. Date string parsing as UTC (HIGH)
3. Cron job timezone mismatch (HIGH)

High Issues:
4. Week boundary calculation (MEDIUM)
5. Month boundary calculation (MEDIUM)
6. Double date conversion errors (MEDIUM)
7. Frontend date range calculation (MEDIUM)
8. MongoDB date storage without context (MEDIUM)

ROOT SYSTEMIC CAUSES:

1. **No Central Timezone Configuration**
   - No `process.env.TZ` setting
   - No timezone configuration in server.js
   - No timezone configuration in db.js
   - No timezone configuration for cron jobs

2. **Inconsistent Timezone Strategy**
   - Mix of UTC, IST, server timezone, browser timezone
   - Some functions use IST explicitly, others don't
   - No clear pattern for when to use which timezone

3. **Date String Ambiguity**
   - YYYY-MM-DD strings have no timezone info
   - Parsed as UTC by default (JavaScript spec)
   - Should be parsed as IST for this application

4. **MongoDB UTC Storage**
   - All Date objects stored as UTC
   - No timezone metadata
   - Requires careful conversion on read/write

5. **Browser Timezone Dependency**
   - Frontend uses browser local time
   - Different users see different dates
   - No consistent timezone for UI

WHY THESE BUGS REAPPEAR IN HOSTED VS LOCAL:

1. **Server Timezone Difference**
   - Local: May be IST or developer's timezone
   - Hosted: Likely UTC or different timezone
   - Same code behaves differently

2. **Environment-Specific Behavior**
   - `new Date()` uses server OS timezone
   - Different servers = different behavior
   - No explicit timezone = unpredictable

3. **Browser Timezone Variation**
   - Local: Developer's timezone (consistent)
   - Hosted: User's timezone (varies)
   - Different users see different dates

4. **Date String Parsing**
   - `new Date("YYYY-MM-DD")` always UTC
   - Works "correctly" in local if server timezone = IST
   - Fails in hosted if server timezone ≠ IST

5. **Cron Execution Timezone**
   - Local: Server timezone (may be IST)
   - Hosted: Server timezone (likely UTC)
   - Cron jobs run at different times relative to IST

RECOMMENDATIONS (FOR FUTURE FIXES - NOT IMPLEMENTED):

1. **Set Central Timezone Configuration**
   - Set `process.env.TZ = 'Asia/Kolkata'` in server.js
   - Configure MongoDB timezone if possible
   - Set cron job timezone explicitly

2. **Standardize on IST**
   - All date calculations should use IST
   - Convert all dates to IST before storage
   - Convert all dates from IST after retrieval

3. **Fix Date String Parsing**
   - Create helper: `parseISTDate(dateString)`
   - Always parse YYYY-MM-DD as IST
   - Use consistently throughout codebase

4. **Fix attendanceDate Generation**
   - Use IST date string, not UTC
   - Create helper: `getISTDateString()`
   - Use consistently for attendanceDate

5. **Fix Cron Jobs**
   - Set timezone explicitly for cron execution
   - Use IST for all date calculations in cron
   - Test in different server timezones

====================================================
END OF REPORT
====================================================



