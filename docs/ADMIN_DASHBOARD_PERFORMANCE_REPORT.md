# Admin Dashboard Performance Investigation & Report

**Date:** January 29, 2025  
**Role:** Senior Full-Stack Performance Engineer  
**Scope:** Frontend-to-backend trace of Admin Dashboard load and update latency

---

## 1. Summary

### Primary reason Admin Dashboard is slow

1. **Broken cache invalidation (critical)**  
   Attendance clock-in/clock-out use `utils/cache.deletePattern('dashboard-summary:*')`, but the dashboard summary is stored in **`cacheService.dashboardCache`** with key `dashboard_${date}` (e.g. `dashboard_2025-01-29`). The pattern is applied to a **different cache instance** (`utils/cache`), so the real dashboard cache is **never invalidated** on clock-in/clock-out. The UI can show stale data for up to 60s (TTL), and when the cache is missed, every request triggers full recomputation.

2. **Heavy cache-miss path on `/admin/dashboard-summary`**  
   On cache miss, the backend runs many parallel DB operations and then calls **`getUserDailyStatus()` for every “who’s in” employee** to compute `calculatedLogoutTime`. Each call does multiple DB reads (User, AttendanceLog, AttendanceSession, BreakLog, etc.). With N people clocked in, this is an **N-fold serializable workload** (even if per-user daily status is cached after first call), so first load or after invalidation is slow.

3. **1.8s throttle on socket-driven refetch**  
   The frontend throttles refetch after `attendance_log_updated` / `leave_*` to 1800ms. That directly adds up to **1.8s perceived delay** before the dashboard reflects changes.

### Secondary contributing factors

- **`isAdminOrHr`** can trigger an extra `User.findById()` when the token lacks `role`.
- **No caching on `/admin/dashboard-employees/:type`** — each modal open (Present / Late / On Leave / Total) hits the DB.
- **Axios adds `_t: Date.now()` to every GET** — prevents HTTP caching; acceptable for correctness but removes browser cache benefits.
- **`/admin/dashboard-pending-leaves`** is uncached and runs on every socket-driven refetch when leaves change.
- **AttendanceSession** has no index on `endTime`, which is used in `$match: { endTime: null }` for “who’s in” and dashboard-employees.
- **Possible duplicate initial load** in React StrictMode despite the `dataFetchedRef` guard (depends on timing).

---

## 2. Frontend Findings

### 2.1 Endpoints called

| When | Endpoint | Purpose |
|------|----------|---------|
| **Initial load** | `GET /admin/dashboard-summary?includePendingLeaves=true` | Summary + pending leaves in one call |
| **Socket: attendance** | `GET /admin/dashboard-summary?includePendingLeaves=false` | Summary only (throttled 1.8s) |
| **Socket: leave** | `GET /admin/dashboard-pending-leaves` | Pending leaves only (throttled 1.8s) |
| **Card click** | `GET /admin/dashboard-employees/:type?page=1&limit=50` | Present / late / on-leave / total list |
| **Actions** | `PATCH /admin/leaves/:id/status`, `PATCH /admin/breaks/extra/:id/status` | Approve/reject; then full refetch |

### 2.2 Call order and timing

- **Initial:** One request to `dashboard-summary?includePendingLeaves=true` after auth is ready. No parallel second call for pending leaves (good).
- **After socket event:** Refetch is **scheduled** with a **1800ms throttle** (`THROTTLE_MS = 1800` in `AdminDashboardPage.jsx`). So the user sees updates only after that delay.
- **Modal:** Each open of Employee List (by card type) triggers a new `dashboard-employees/:type` request; no reuse of summary data.

### 2.3 Frontend-specific causes of slowness

| Issue | Evidence | Impact |
|-------|----------|--------|
| 1.8s refetch throttle | `AdminDashboardPage.jsx` ~288–335: `THROTTLE_MS = 1800`, `scheduleSummaryRefetch` / `schedulePendingRefetch` | Updates appear up to 1.8s after socket event |
| Full refetch after action | `handleActivityResponse` and leave status handler call `fetchAllDataRef.current(false)` | Extra full dashboard-summary (+ pending leaves) after every approve/reject |
| No partial render | Entire dashboard waits on single `dashboard-summary` response; `showSkeletons = !authReady \|\| loading \|\| !summary` | No progressive display (e.g. cards first, lists later) |
| GET cache-busting | `axios.js` ~101–104: adds `_t: Date.now()` to every GET | No browser cache for API responses |

### 2.4 Recommended frontend fixes

1. **Reduce throttle**  
   - Lower `THROTTLE_MS` from 1800 to 400–600ms for socket-driven refetch so updates feel closer to real-time without excessive requests.
2. **Smarter refetch after actions**  
   - After approve/reject leave: refetch only pending leaves (e.g. call `dashboard-pending-leaves` or a dedicated “refresh pending” helper) instead of full `fetchAllData`.
   - After break/leave activity response: optionally refetch only summary (`includePendingLeaves=false`) and pending leaves in parallel instead of one big `includePendingLeaves=true`.
3. **Progressive loading (medium-term)**  
   - Consider splitting into two requests on initial load: (1) summary without pending leaves, (2) pending leaves in parallel. Render cards as soon as (1) returns; show pending list when (2) returns.
4. **Optional: cache employee list by card type**  
   - In-memory cache (e.g. by `type` + `date` + TTL 60s) for `dashboard-employees/:type` so reopening the same card within a short window doesn’t hit the API again.

---

## 3. Backend Findings

### 3.1 Endpoint → flow (dashboard-related)

| Endpoint | Middleware | Service / logic | DB / cache |
|----------|-------------|------------------|------------|
| `GET /admin/dashboard-summary` | authenticateToken, isAdminOrHr | cacheService.getDashboardSummary(today); on miss: User.countDocuments, AttendanceLog.find, AttendanceSession.aggregate, LeaveRequest (recent notes, pending breaks, backdated leaves), then **per–“who’s in”** getUserDailyStatus → cacheService.get/setDailyStatus | Many queries; N × getUserDailyStatus on cache miss |
| `GET /admin/dashboard-pending-leaves` | authenticateToken, isAdminOrHr | LeaveRequest.find(Pending).populate(employee).sort | No cache |
| `GET /admin/dashboard-employees/:type` | authenticateToken, isAdminOrHr | Branch by type: AttendanceLog.find + populate, or LeaveRequest.find + populate, or User.find + countDocuments | No cache |

### 3.2 Expensive operations per endpoint

**`/admin/dashboard-summary` (cache miss):**

- `User.countDocuments({ role: { $ne: 'Admin' }, isActive: true })`
- `AttendanceLog.find({ attendanceDate: today }).select(...).lean()`
- `AttendanceSession.aggregate([ $match: { endTime: null }, $lookup attendancelogs, $lookup users, … ])`
- `AttendanceLog.find` (notes), `ExtraBreakRequest.find` (pending), `LeaveRequest.find` (backdated pending)
- **For each “who’s in” row:**  
  - cacheService.getDailyStatus(userId, today); on miss → **getUserDailyStatus(userId, today)** which:
    - `User.findById(userId).populate('shiftGroup')`
    - `AttendanceLog.findOne({ user, attendanceDate })`
    - `AttendanceSession.findOne({ attendanceLog })` (first session)
    - Then sessions, breaks, auto-break, etc.
- Extra `AttendanceLog.find` / `countDocuments` when todayLogs is empty
- `LeaveRequest.countDocuments` for on-leave count
- Finally `cacheService.setDashboardSummary(today, summary)`

**`/admin/dashboard-pending-leaves`:**

- Single `LeaveRequest.find({ status: 'Pending', ... }).populate('employee').sort().lean()`

**`/admin/dashboard-employees/:type`:**

- Type-dependent: either AttendanceLog (+ populate) or LeaveRequest (+ populate) or User.countDocuments + User.find with skip/limit.

### 3.3 Code-level causes

- **isAdminOrHr** (`admin.js` ~26–66): If `req.user.role` is missing, it does **User.findById(req.user.userId).select('role').lean()** on every request. That adds one extra DB round-trip when the token doesn’t carry role.
- **dashboard-summary** uses **cacheService** (NodeCache, key `dashboard_${date}`), while **attendance routes** use **utils/cache** (SimpleCache) and call **deletePattern('dashboard-summary:*')**. Keys in cacheService are `dashboard_2025-01-29`, so they never match that pattern in the other cache — **invalidation is wrong cache**.

### 3.4 Refactoring recommendations

1. **Fix dashboard cache invalidation**  
   - In **attendance** clock-in and clock-out handlers, after emitting the socket event, call **cacheService.invalidateDashboard(today)** (with the same date string used for the log).  
   - Remove or keep `cache.deletePattern('dashboard-summary:*')` only if other features rely on it in `utils/cache`; ensure dashboard summary invalidation is done via cacheService.
2. **Ensure all mutation paths invalidate dashboard**  
   - Any route that changes data that the dashboard shows (attendance, breaks, leaves) should call **cacheService.invalidateDashboard(today)** (and optionally invalidate daily-status for affected users if needed).
3. **Optional: cache pending leaves**  
   - Short TTL (e.g. 30–60s) cache for pending leave list, keyed by date or “pending_leaves”, and invalidate on leave status change / new request.
4. **Avoid redundant role fetch**  
   - Ensure JWT or session includes `role` so isAdminOrHr rarely needs to hit the DB.

---

## 4. Database Findings

### 4.1 Queries involved (dashboard)

- **User:** countDocuments(role ≠ Admin, isActive); findById (role in isAdminOrHr); find (dashboard-employees total).
- **AttendanceLog:** find(attendanceDate), find(attendanceDate, notes), find(attendanceDate, clockInTime, isLate…), countDocuments(attendanceDate, clockInTime).
- **AttendanceSession:** aggregate($match endTime: null, $lookup attendancelogs, $lookup users); findOne(attendanceLog, sort startTime); find(attendanceLog).
- **LeaveRequest:** find(status Pending), countDocuments(Approved, leaveDates in day), find(isBackdated, Pending), find(Approved, leaveDates in day) for on-leave list.
- **BreakLog, ExtraBreakRequest:** find for breaks and pending extra breaks.

### 4.2 Root DB bottlenecks

1. **No index on AttendanceSession.endTime**  
   Queries use `{ endTime: null }`. An index such as `(endTime: 1)` or compound `(endTime: 1, startTime: 1)` would speed “who’s in” and dashboard-employees present path.
2. **AttendanceLog by date**  
   Heavy use of `attendanceDate: today`. A dedicated index **{ attendanceDate: 1 }** (or compound with common filters) would help.
3. **LeaveRequest**  
   Queries filter by status, leaveDates ($elemMatch), requestType. Compound indexes e.g. (status, requestType) and (status, leaveDates) would help; verify existing indexes in LeaveRequest model.
4. **getUserDailyStatus**  
   Multiple queries per user (AttendanceLog, AttendanceSession, BreakLog, etc.). Per-user daily-status cache (cacheService.get/setDailyStatus) reduces repeat calls but the first request per user per day is still costly when the dashboard summary is recomputed.

### 4.3 Optimization steps

1. Add **AttendanceSession** index: `{ endTime: 1 }` or `{ endTime: 1, startTime: 1 }`.
2. Add **AttendanceLog** index: `{ attendanceDate: 1 }` (if not already covered by (user, attendanceDate)).
3. Review **LeaveRequest** indexes: ensure (status, requestType) and (status, leaveDates) or similar match dashboard and pending-leaves queries.
4. Optionally add **AttendanceLog** compound `{ attendanceDate: 1, clockInTime: 1 }` (or similar) if used in dashboard-employees.
5. Log slow queries (e.g. >100ms) in development to confirm which ones dominate after the above.

---

## 5. Cache Findings

### 5.1 Which endpoints use cache

- **Dashboard summary:** cacheService.getDashboardSummary(today) / setDashboardSummary(today, summary). Key: `dashboard_${date}`. TTL: 60s (dashboardCache stdTTL).
- **Per-user daily status (who’s in):** cacheService.getDailyStatus(userId, date) / setDailyStatus(userId, date, data). Key: `daily_status_${userId}_${date}`. TTL: 60s.
- **dashboard-pending-leaves:** not cached.
- **dashboard-employees/:type:** not cached.

### 5.2 Cache invalidation bug (critical)

- **cacheService** (services/cacheService.js) stores dashboard under **dashboard_${date}**.
- **attendance.js** (clock-in, clock-out) uses **utils/cache** and calls **cache.deletePattern('dashboard-summary:*')**. That clears keys in **utils/cache** only. No key in cacheService is named with "dashboard-summary", so **cacheService.dashboardCache is never cleared** by attendance.
- **breaks.js** correctly calls **cacheService.invalidateDashboard(today)** in some paths.
- **admin.js** calls cacheService.invalidateDashboard in leave approval and admin log update.

**Result:** After clock-in/clock-out, the dashboard can still serve a 60s-old summary until TTL expiry. When the cache finally expires, the next request does a full (expensive) recompute. So cache “works” in the sense of storing and returning data, but **invalidation is wrong**, so it doesn’t improve perceived freshness and can make “updates” feel slow.

### 5.3 Why cache doesn’t improve perceived speed

1. **Invalidation:** As above; attendance mutations don’t invalidate the dashboard cache.
2. **First load / cold cache:** First request of the day or after restart does full computation + N × getUserDailyStatus.
3. **Throttle:** Even when the backend has fresh data, the frontend waits up to 1.8s before refetching.
4. **Pending leaves:** Always fetched from DB on every request when includePendingLeaves=true or on socket leave events; no cache.

### 5.4 How to fix cache usage

1. **Use cacheService for dashboard invalidation everywhere**  
   In **backend/routes/attendance.js** (clock-in and clock-out), after existing cache logic, add:
   - `const cacheService = require('../services/cacheService');`
   - `cacheService.invalidateDashboard(todayStr);` (clock-in) and `cacheService.invalidateDashboard(today);` (clock-out).
2. **Unify invalidation**  
   Prefer a single place (e.g. cacheService.invalidateDashboard) for all dashboard invalidation; remove or repurpose deletePattern('dashboard-summary:*') in utils/cache if it’s only meant for dashboard.
3. **Optional:** Cache pending leaves with short TTL and invalidate on leave create/update/delete.
4. **Optional:** Add cache for dashboard-employees by (type, date) with short TTL and invalidate when attendance/leaves change.

---

## 6. Dashboard Update Delay — Root Cause

- **Data is updated in DB** on clock-in/clock-out and leave actions.
- **Cache:** Dashboard summary cache (cacheService) is **not** invalidated by attendance routes, so the next dashboard request may still get the old cached summary for up to 60s.
- **Frontend:** Socket events (`attendance_log_updated`, `leave_request_updated`, `leave_status_updated`) trigger a **throttled** refetch (1.8s). So even if the backend were to respond with fresh data immediately, the UI would wait up to 1.8s before asking for it.
- **Conclusion:** The delay is **both** backend (wrong cache, so stale or heavy recompute) and frontend (1.8s throttle). Fix invalidation + reduce throttle for quick wins.

---

## 7. Performance Metrics to Collect

Suggested instrumentation:

| Layer | Metric | Where |
|-------|--------|--------|
| Frontend | Time from navigation to first painted cards | AdminDashboardPage, or RUM |
| Frontend | Time from socket event to refetch start and to state update | Socket handler + fetch completion |
| Backend | Time in dashboard-summary handler (cache hit vs miss) | Route start/end or middleware |
| Backend | Time in getUserDailyStatus | dailyStatusService |
| Database | Query duration for dashboard queries | Mongoose or DB profiler |
| Cache | getDashboardSummary hit/miss and invalidateDashboard calls | cacheService + logs |

---

## 8. Final Recommendations

### Immediate quick wins

1. **Fix dashboard cache invalidation**  
   In **backend/routes/attendance.js**, in both clock-in and clock-out success paths, require cacheService and call **cacheService.invalidateDashboard(todayStr)** / **cacheService.invalidateDashboard(today)**.  
   **Files:** `backend/routes/attendance.js` (e.g. after the existing cache.deletePattern block, ~306 and ~488).
2. **Reduce refetch throttle**  
   In **frontend/src/pages/AdminDashboardPage.jsx**, change **THROTTLE_MS** from 1800 to **500** (or 400–600).  
   **File:** `frontend/src/pages/AdminDashboardPage.jsx` (~288).
3. **Avoid full refetch after leave/break action**  
   After approve/reject leave or break, call only the endpoint that refreshes the affected list (e.g. dashboard-pending-leaves or a small “refresh summary” request) instead of fetchAllData.  
   **File:** `frontend/src/pages/AdminDashboardPage.jsx` (handleActivityResponse and leave status handler).

### Medium-term fixes

4. **Add cacheService.invalidateDashboard in all attendance mutation paths**  
   Ensure any route that updates attendance or related data (e.g. admin log update, bulk updates) calls cacheService.invalidateDashboard for the affected date(s).
5. **Add DB indexes**  
   AttendanceSession: `endTime`; AttendanceLog: `attendanceDate`; LeaveRequest: status/leaveDates as needed (see §4).
6. **Cache pending leaves**  
   Short-TTL cache for GET dashboard-pending-leaves; invalidate on leave status/creation changes.
7. **Ensure token includes role**  
   So isAdminOrHr doesn’t need to fetch User by id on every request.

### Long-term architectural improvements

8. **Progressive dashboard loading**  
   Load summary first (and optionally who’s in), then pending leaves in parallel; render sections as data arrives.
9. **Stale-while-revalidate**  
   Show cached summary immediately on socket event and refetch in background; swap when response arrives.
10. **Structured performance logging**  
    Add timing and cache hit/miss for dashboard-summary and key queries to track improvements and regressions.

---

## 9. Constraints Respected

- No change removes caching; only fixes invalidation and adds optional caches.
- All recommendations are production-safe (additive or targeted fixes).
- Improvements are measurable (invalidation fix, throttle reduction, indexes, optional timing logs).

---

## 10. File Reference Summary

| Area | File(s) |
|------|--------|
| Dashboard cache (get/set/invalidate) | `backend/services/cacheService.js` |
| Dashboard summary route | `backend/routes/admin.js` (dashboard-summary, dashboard-pending-leaves, dashboard-employees) |
| Wrong invalidation (attendance) | `backend/routes/attendance.js` (clock-in, clock-out) |
| Correct invalidation (breaks) | `backend/routes/breaks.js` |
| isAdminOrHr + role fetch | `backend/routes/admin.js` (top) |
| getUserDailyStatus | `backend/services/dailyStatusService.js` |
| Frontend dashboard + throttle | `frontend/src/pages/AdminDashboardPage.jsx` |
| Axios GET cache-busting | `frontend/src/api/axios.js` |
| Employee list modal API | `frontend/src/components/EmployeeListModal.jsx` |
| Utils cache (wrong cache for dashboard) | `backend/utils/cache.js` |

---

*End of report.*
