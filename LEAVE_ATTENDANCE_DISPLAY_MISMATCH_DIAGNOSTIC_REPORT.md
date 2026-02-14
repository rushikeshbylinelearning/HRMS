# Leave → Attendance Display Mismatch — Diagnostic Report

**Issue:** Backend leave is converted to **Full Day – Loss of Pay** (auto-conversion: no check-in), but the frontend still displays **Half Day Leave** (e.g. "Half Day - First Half" tag and "Half Day" badge on calendar).

**Scope:** Frontend leave rendering pipeline audit (API, state, rendering, cache, real-time, transformation). No code changes — inspection only.

---

## 1. API layer verdict

**Verdict: API is capable of returning correct Full Day LOP.**

- **Summary endpoint:** `GET /api/attendance/summary?startDate=...&endDate=...&includeHolidays=true`
  - **Location:** `backend/routes/attendance.js` (router.get('/summary', ...), ~line 1247).
  - **Behaviour:** Fetches `LeaveRequest` with a **fresh** `LeaveRequest.find({ employee, status: 'Approved', leaveDates: { $elemMatch: ... } }).lean()` — **no response cache** on this route.
  - **leaveInfo construction:** For each date, `resolveAttendanceStatus()` is called with the `leaveRequest` for that date. `leaveInfo` is built in `backend/utils/attendanceStatusResolver.js` (lines 192–198):
    - `leaveInfo.leaveType = leaveRequest.leaveType`
    - `leaveInfo.requestType = leaveRequest.requestType`
    - `leaveInfo.reason = leaveRequest.reason`
  - So after auto-conversion, the same document has `leaveType: 'Full Day'`, `requestType: 'Loss of Pay'`, and reason including `[AUTO-CONVERTED TO FULL DAY LOP: ...]`. The summary response for that date will include `leaveInfo` with those values.

- **Conclusion:** If the DB has been updated by the half-day conversion job, the next summary request **will** return `leaveInfo.leaveType: 'Full Day'` and `leaveInfo.requestType: 'Loss of Pay'`. There is no backend cache for the summary response. If the UI still shows "Half Day", the most likely cause is that the **client is using an older summary response** (see state and real-time sections).

---

## 2. State management verdict

**Verdict: Reactive to refetch; no refetch triggered by auto-conversion → state can remain stale.**

- **Where data is stored:**
  - **AttendanceSummaryPage:** `logs` (useState) holds the array returned by `/attendance/summary` (each item has `leaveInfo`).
  - **EmployeeDashboardPage:** Uses its own flow; calendar on summary page is driven by `AttendanceSummaryPage` state.
- **When it is refreshed:**
  - Initial load: `useEffect` runs `fetchLogsForWeekRef.current(currentDate)` when `currentDate` or `viewMode` changes.
  - Socket: `leave_request_updated` and `attendance_log_updated` trigger a refetch in `AttendanceSummaryPage.jsx` (lines 121–139, 162–167).
- **Auto-conversion and refetch:**
  - The half-day auto-conversion job (`halfDayAutoConversionService.autoConvertHalfDayLeaves`) runs at 12:30 AM IST and **does not emit any socket event** (no `io.emit('leave_request_updated', ...)` in that service).
  - So when a leave is converted in the middle of the night, **no refetch is triggered**. The frontend state stays as it was from the last fetch (e.g. before conversion).
- **Cache / TTL:**
  - Summary is requested with plain `api.get(...)`. Axios adds `_t: Date.now()` for cache-busting (except for `/leaves` and `/admin/leaves`), so no long-lived browser cache for summary.
  - `apiCache.js` (cachedApiCall) is **not** used for the summary request in `AttendanceSummaryPage`; no React Query or SWR for this page.
- **Conclusion:** State is reactive to refetch, but **nothing triggers a refetch after the cron runs**. If the user had the summary/calendar open with February data before the conversion, or never navigates/refreshes after conversion, `logs` (and thus `leaveInfo`) will still contain the pre-conversion `leaveType: 'Half Day - First Half'`.

---

## 3. Rendering logic verdict

**Verdict: Leave-driven; attendance does not override leave type. Conversion flag is not used in UI.**

- **Primary display driver for “Half Day” vs “Full Day”:**  
  **`leave.leaveType`** (and equivalently `day.log?.leaveInfo?.leaveType`), **not** `attendanceStatus`, **not** `isHalfDay`, **not** `autoConvertedToLOP`.

- **Calendar (AttendanceCalendar.jsx):**
  - Line 31:  
    `const isHalfDayLeave = leave?.leaveType && leave.leaveType.startsWith('Half Day');`  
    This alone decides whether the cell shows the “Half Day” badge and “Leave — {leaveTypeText}”.
  - Line 356:  
    `leave: log?.leaveInfo || null`  
    So `leave` is exactly the summary’s `leaveInfo` (which comes from `leaveRequest.leaveType` / `leaveRequest.requestType`).
  - Lines 163–178: If `day.status === 'leave'`, the cell renders:
    - If `isHalfDayLeave`: “Half Day” badge + “Leave — {leaveTypeText}”.
    - Else: “Full Day — Leave” + leaveTypeText.
  - No use of `attendanceStatus`, `log.isHalfDay`, or `autoConvertedToLOP` for this decision.

- **Modal (LogDetailModal.jsx):**
  - Lines 420–422:  
    `effectiveLeave = leave || log?.leaveInfo`  
    `leaveType = effectiveLeave?.leaveType || 'Full Day'`  
    The Chip label is “Full Day Leave” when `leaveType === 'Full Day'`, otherwise the raw `leaveType` (e.g. “Half Day - First Half”).
  - Same source: `leave` / `log.leaveInfo` from the summary. No override from attendance.

- **attendanceRenderUtils.getDisplayStatus:**  
  Uses `leaveInfo?.requestType` / `leaveInfo?.leaveType` only for building display text (e.g. “Leave - …”). It does not override the calendar’s use of `leave.leaveType` for the Half Day vs Full Day visual.

- **Conclusion:** Rendering is **leave-driven**. Attendance does **not** override leave type. The conversion flag `autoConvertedToLOP` is **not** used in the frontend; the UI only looks at `leaveType`. So if the API (and thus state) still has `leaveType: 'Half Day - First Half'`, the UI will show “Half Day” even after the backend has converted the leave to Full Day LOP, until the client refetches and gets updated `leaveInfo`.

---

## 4. Cache / memoization issue

**Verdict: No cache or memoization bug that would “lock” the UI to Half Day once fresh data is in state.**

- **Backend:** The summary handler does not read or write any response cache. Each request runs a new `LeaveRequest.find()` and builds `leaveInfo` from the current document.
- **Frontend:**
  - Summary is not served from `apiCache` or `leavesCache` for this flow. Cache-busting `_t` is applied to the summary URL.
  - **AttendanceCalendar:** `calendarData` is `useMemo(() => { ... }, [logs, currentDate])`. So when `logs` is updated (e.g. after refetch), `calendarData` is recomputed and each `day.leave` is set from `log?.leaveInfo`.
  - **DayCell:** Wrapped in `memo`; props are `day`, `onDayClick`, `holiday`, `leave`. When `leave` (from `day.leave`) changes, the cell re-renders with the new `leaveType`.
- **Conclusion:** No incorrect memoization or cache that would prevent the UI from showing “Full Day” once the summary response (and thus `logs` / `leaveInfo`) contains `leaveType: 'Full Day'`. The issue is that **state is not updated** after the cron (no refetch), not that React or cache is holding onto old data after a refetch.

---

## 5. Real-time update missing

**Verdict: Yes — cron updates do not trigger any UI refresh.**

- **Auto-conversion job:**  
  `backend/services/halfDayAutoConversionService.js` — after converting a leave it invalidates backend caches (e.g. `cacheService.invalidateDashboard`, `cache.delete('status:...')`, `cache.deletePattern('dashboard-summary:*')`) but **does not emit any socket event** (no `io.emit('leave_request_updated', ...)` or similar).
- **Frontend listeners:**
  - `AttendanceSummaryPage.jsx` (and others) listen for `leave_request_updated` and `attendance_log_updated` and refetch on those events.
  - Admin actions (approve/reject/delete leave, attendance overrides, etc.) emit `leave_request_updated` or `attendance_log_updated` from `backend/routes/admin.js` and related routes.
- **Gap:** When the **cron** converts a half-day leave to Full Day LOP, no event is emitted, so the open summary/calendar page **never refetches**. The user must change date, reload, or open the page again to get the updated summary and see “Full Day” and “Loss of pay”.
- **Conclusion:** Real-time sync is missing for auto-conversion: **cron updates do not trigger a UI refresh**.

---

## 6. Root cause classification

**Primary:** **Cron not triggering UI refresh**  
The half-day auto-conversion runs at 12:30 AM and updates the leave in the DB (and optionally invalidates server-side caches) but does not notify the frontend. So the client keeps showing the last-fetched summary, which still has `leaveInfo.leaveType: 'Half Day - First Half'`.

**Contributing:** **Frontend stale state**  
State is only updated when a refetch happens (initial load, change of date/viewMode, or socket event). Because there is no socket event for auto-conversion, state can remain stale until the user triggers a refetch (navigate, change month, hard refresh, etc.).

**Not the cause (for this UI):**
- **Backend sync issue:** Summary reads LeaveRequest directly with no cache; after conversion, the next summary request would return Full Day LOP.
- **Rendering logic override:** The UI does not override leave type from attendance; it uses `leave.leaveType` only.
- **Memoization bug:** Memo and dependencies are correct; once `logs`/`leaveInfo` are updated, the calendar and modal show the new type.

---

## 7. Exact file / function and code references

**Where “Half Day” is chosen for the calendar cell**

- **File:** `frontend/src/components/AttendanceCalendar.jsx`
- **Function:** `DayCell` (memoized component)
- **Snippet (lines 29–31):**
```javascript
// Determine if this is a half-day leave for UI rendering (UI-only; backend remains source of truth)
const isHalfDayLeave = leave?.leaveType && leave.leaveType.startsWith('Half Day');
```
- **Effect:** If `leave.leaveType` is `"Half Day - First Half"` or `"Half Day - Second Half"`, the cell shows the “Half Day” badge and “Leave — {leaveTypeText}`. The `leave` prop is `day.leave` = `log?.leaveInfo`, i.e. the summary API’s `leaveInfo` for that date.

**Where calendar gets `leave`**

- **File:** `frontend/src/components/AttendanceCalendar.jsx`
- **Function:** `AttendanceCalendar` (parent), inside `useMemo` that builds `calendarData`
- **Snippet (lines 354–356):**
```javascript
leave: log?.leaveInfo || null,
```
- So the **only** source for leave type in the calendar is the summary response’s `leaveInfo`, which is built from `leaveRequest.leaveType` in `attendanceStatusResolver.js`.

**Where modal gets leave type**

- **File:** `frontend/src/components/LogDetailModal.jsx`
- **Function:** `ReadOnlyView` (inside modal)
- **Snippet (lines 419–432):**
```javascript
const effectiveLeave = leave || log?.leaveInfo || null;
const requestType = effectiveLeave?.requestType || effectiveLeave?.leaveType || 'Leave';
const leaveType = effectiveLeave?.leaveType || 'Full Day';
// ...
<Chip label={leaveType === 'Full Day' ? 'Full Day Leave' : (leaveType || requestType || 'Leave')} ... />
```
- Same source: `leave` / `log.leaveInfo` from the summary. No use of `autoConvertedToLOP`.

**Where backend builds leaveInfo**

- **File:** `backend/utils/attendanceStatusResolver.js`
- **Function:** `resolveAttendanceStatus`
- **Snippet (lines 192–198):**
```javascript
leaveInfo: {
    _id: leaveRequest._id,
    requestType: leaveRequest.requestType,
    leaveType: leaveRequest.leaveType,
    status: leaveRequest.status,
    reason: leaveRequest.reason || 'No reason provided',
    leaveDates: leaveRequest.leaveDates
}
```
- So `leaveInfo.leaveType` is exactly the current `leaveRequest.leaveType` from the DB at summary request time.

**Why frontend doesn’t refresh after conversion**

- **File:** `backend/services/halfDayAutoConversionService.js`
- **Behaviour:** After updating the leave and invalidating caches, the service does **not** call `io.emit('leave_request_updated', { employeeId: ... })` (or any equivalent). So the frontend never receives an event and never refetches the summary.

---

## 8. Summary table

| # | Verdict |
|---|--------|
| 1. API layer | **Correct** — Summary uses fresh LeaveRequest; no cache. Returns Full Day LOP after conversion. |
| 2. State management | **Stale** until refetch — No refetch triggered by cron; state can hold pre-conversion data. |
| 3. Rendering logic | **Leave-driven** — `leave.leaveType` only; attendance does not override; `autoConvertedToLOP` not used. |
| 4. Cache / memoization | **No** — No cache or memo bug preventing update once new data is in state. |
| 5. Real-time update missing | **Yes** — Cron does not emit any event; frontend never auto-refreshes after conversion. |
| 6. Root cause | **Cron not triggering UI refresh** (+ stale state until user refetches). |
| 7. Exact location | **AttendanceCalendar.jsx** line 31 (`isHalfDayLeave = leave?.leaveType && leave.leaveType.startsWith('Half Day')`); data source: summary `leaveInfo`; no refresh after conversion because **halfDayAutoConversionService** does not emit `leave_request_updated`. |

---

## 9. Why the frontend still shows “Half Day” after backend conversion

- The backend **does** update the leave to Full Day LOP and updates `reason` (so the modal can show “[AUTO-CONVERTED TO FULL DAY LOP: No check-in detected]” if that text was already in the last-fetched reason).
- The **calendar and modal** both derive the **label** (“Half Day” vs “Full Day”) from **`leave.leaveType`**, which comes from the **summary response** (`log.leaveInfo`).
- The summary is **not refetched** when the cron runs, because the auto-conversion service **does not emit** `leave_request_updated` (or any socket event).
- So the client keeps showing the **previous** summary data, where `leaveInfo.leaveType` was still `"Half Day - First Half"`. Hence the “Half Day” badge and “Half Day - First Half” Chip even though the backend (and a fresh API call) would return Full Day LOP.

**In one sentence:** The frontend still shows Half Day because it is still using the last-fetched summary (stale state), and the cron does not trigger a refetch, so the UI never receives updated `leaveInfo.leaveType: 'Full Day'` until the user causes a new summary request (e.g. refresh or change date).
