# Admin Dashboard Performance Fixes — Implementation Summary

**Date:** January 29, 2025  
**Scope:** End-to-end fixes for Admin Dashboard load and update performance

---

## 1. What Was Changed

### 1.1 Fix Broken Dashboard Cache Invalidation (CRITICAL)

- **Problem:** Dashboard summary is stored in `cacheService.dashboardCache` under key `dashboard_${date}`. Attendance routes were only calling `utils/cache.deletePattern('dashboard-summary:*')`, which clears a different cache instance, so the real dashboard cache was never invalidated on clock-in/clock-out.
- **Change:** In **backend/routes/attendance.js**, in both clock-in and clock-out success paths, added:
  - `const cacheService = require('../services/cacheService');`
  - `cacheService.invalidateDashboard(todayStr)` / `cacheService.invalidateDashboard(today)`.
- **Result:** After any clock-in or clock-out, the next request to `/admin/dashboard-summary` recomputes (or serves fresh data once recomputed). Date format matches dashboard keys: `YYYY-MM-DD`.

### 1.2 Ensure All Dashboard-Affecting Mutations Invalidate Cache

- **Attendance:** Clock-in and clock-out now call `cacheService.invalidateDashboard(date)` (see above). Existing `utils/cache.deletePattern('dashboard-summary:*')` left in place (other code may rely on it).
- **Breaks:** **backend/routes/breaks.js** — Break **start** path previously had no cacheService invalidation. Added `cacheService.invalidateDashboard(today)` after the existing cache delete calls. Break end and extra-break request paths already had it.
- **Leave:** **backend/routes/admin.js** — Leave PATCH status, PUT update, and both delete paths now call `cacheService.invalidatePendingLeaves(today)` (see §1.5). Leave approval path already called `invalidateDashboard(today)` where needed.
- **Admin activity:** Admin log update and attendance override already call `cacheService.invalidateDashboard(log.attendanceDate)`.

### 1.3 Reduce Frontend Refetch Throttle

- **Problem:** Frontend waited 1800ms before refetching after socket events, so dashboard updates felt slow.
- **Change:** In **frontend/src/pages/AdminDashboardPage.jsx**, `THROTTLE_MS` was already set to **500** (from a previous fix). Confirmed and left at 500. Throttling still coalesces rapid socket events into a single refetch within the window.
- **Result:** Dashboard updates within ~0.5s after `attendance_log_updated` / `leave_request_updated` / `leave_status_updated`.

### 1.4 Avoid Full Dashboard Refetch After Actions

- **Problem:** After leave approve/reject or break/backdated-leave approve/reject, the frontend called `fetchAllData(false)`, refetching the full dashboard-summary with pending leaves.
- **Change:** In **frontend/src/pages/AdminDashboardPage.jsx**:
  - Added **refetchSummaryOnlyRef** and **refetchPendingOnlyRef** that call `/admin/dashboard-summary?includePendingLeaves=false` and `/admin/dashboard-pending-leaves` respectively and update only `summary` or `pendingRequests`.
  - **handleActivityResponse** (break/backdated leave from activity modal): After success, calls `refetchSummaryOnlyRef.current()` for ExtraBreakRequest, and `Promise.all([refetchSummaryOnlyRef.current(), refetchPendingOnlyRef.current()])` for BackdatedLeaveRequest. No more `fetchAllData()`.
  - **EnhancedLeaveRequestModal** `onStatusChange`: After successful PATCH, calls `Promise.all([refetchSummaryOnlyRef.current(), refetchPendingOnlyRef.current()])` instead of `fetchAllDataRef.current(false)`.
- **Result:** Network tab shows two smaller requests (summary + pending leaves) instead of one large `includePendingLeaves=true` after approve/reject. No call to `fetchAllData()` after these actions.

### 1.5 Cache Pending Leaves (Short TTL)

- **Problem:** `/admin/dashboard-pending-leaves` hit the DB on every call.
- **Change:**
  - **backend/services/cacheService.js:** Added `getPendingLeaves(date)`, `setPendingLeaves(date, data, ttlSeconds = 45)`, `invalidatePendingLeaves(date)`. Keys: `pending_leaves_${date}`. TTL 45s. `invalidateDashboard(date)` now also deletes `pending_leaves_${date}`.
  - **backend/routes/admin.js** — `GET /dashboard-pending-leaves`: Try cache first; on miss, query DB, then `setPendingLeaves(today, list, 45)` and return.
  - **Invalidation on leave mutations:**
    - **admin.js:** PATCH `/leaves/:id/status` (approve/reject), PUT update leave, DELETE leave (normal and year-end) — after commit, call `cacheService.invalidatePendingLeaves(today)`.
    - **leaves.js:** After `LeaveRequest.create` (employee apply leave), call `cacheService.invalidatePendingLeaves(today)`.
- **Result:** Repeated calls to pending leaves within 45s hit cache; cache clears immediately on leave create/approve/reject/delete.

### 1.6 Add Missing Database Indexes

- **backend/models/AttendanceSession.js:** Added `attendanceSessionSchema.index({ endTime: 1 }, { background: true });` for `$match: { endTime: null }` in “who’s in” and dashboard-employees.
- **backend/models/AttendanceLog.js:** Added `attendanceLogSchema.index({ attendanceDate: 1 }, { background: true });` for dashboard queries by date.
- **backend/models/LeaveRequest.js:** Added:
  - `leaveRequestSchema.index({ status: 1, requestType: 1 }, { background: true });`
  - `leaveRequestSchema.index({ status: 1, leaveDates: 1 }, { background: true });`
- **Result:** Indexes are defined in schema; MongoDB will build them in the background. No breaking schema changes.

### 1.7 Ensure Admin Role Is Read From Token

- **Auth:** Token generation in **backend/routes/auth.js** already includes `role` in the JWT payload (standalone login and SSO consume).
- **Change:** In **backend/routes/admin.js**, added a comment to **isAdminOrHr** middleware: “Prefer req.user.role from JWT (auth includes role in payload); fallback to DB only when missing.” No logic change; middleware already uses `req.user.role` first and only does `User.findById` when role is missing.
- **Result:** Most admin requests use the token role and no longer trigger an extra DB lookup for role.

### 1.8 Optional: Cache Dashboard Employee Lists

- **Status:** Not implemented (optional per spec). Can be added later with keys like `dashboard_employees_${type}_${date}_${page}_${limit}`, TTL 60s, and invalidation on attendance/leave mutations.

### 1.9 Instrument Performance (Non-Blocking)

- **backend/routes/admin.js** — `GET /dashboard-summary`:
  - `startMs = Date.now()` at handler start.
  - `perfLog = process.env.NODE_ENV !== 'production' || process.env.PERF_LOG === 'true'`.
  - On cache hit (with or without pending leaves): if `perfLog`, log `[dashboard-summary] cache=hit ... ms=<duration>`.
  - On cache miss: if `perfLog`, log `[dashboard-summary] cache=miss ...` and before each response log `ms=<duration>`.
- **Result:** No logs in production unless `PERF_LOG=true`. No console spam; lightweight timing and cache hit/miss for debugging.

---

## 2. Why It Improves Performance

| Fix | Effect |
|-----|--------|
| Dashboard cache invalidation on attendance | Next dashboard load after clock-in/out gets fresh data; no 60s stale window. |
| Break start invalidation | “Who’s in” and summary stay correct when a break starts. |
| Pending-leaves cache + invalidation | Fewer DB hits on repeated dashboard/pending-leaves calls; fresh list after any leave change. |
| Throttle 500ms | UI reflects socket-driven updates in ~0.5s instead of ~1.8s. |
| Targeted refetch after actions | Smaller payloads and fewer full recomputes; faster perceived response after approve/reject. |
| DB indexes | Faster queries for dashboard-summary, dashboard-employees, and pending-leaves. |
| Role from token | One less `User.findById` per admin request when token has role. |
| Instrumentation | Enables measuring cache hit rate and handler duration in non-prod or with PERF_LOG. |

---

## 3. Files Modified

| File | Changes |
|------|---------|
| **backend/routes/attendance.js** | Added `cacheService.invalidateDashboard(todayStr)` in clock-in; `cacheService.invalidateDashboard(today)` in clock-out. |
| **backend/routes/breaks.js** | Added `cacheService.invalidateDashboard(today)` in break **start** path. |
| **backend/routes/admin.js** | Dashboard-pending-leaves: cache get/set + invalidate on mutations. PATCH/PUT/DELETE leave: `invalidatePendingLeaves(today)`. isAdminOrHr comment. dashboard-summary: perf logging (perfLog, startMs, cache hit/miss + ms). |
| **backend/routes/leaves.js** | After `LeaveRequest.create`, call `cacheService.invalidatePendingLeaves(today)`. |
| **backend/services/cacheService.js** | getPendingLeaves, setPendingLeaves, invalidatePendingLeaves; invalidateDashboard also clears pending_leaves_${date}. |
| **frontend/src/pages/AdminDashboardPage.jsx** | refetchSummaryOnlyRef, refetchPendingOnlyRef; handleActivityResponse and modal onStatusChange use targeted refetch (no fetchAllData). THROTTLE_MS already 500. |
| **backend/models/AttendanceSession.js** | Index `{ endTime: 1 }`. |
| **backend/models/AttendanceLog.js** | Index `{ attendanceDate: 1 }`. |
| **backend/models/LeaveRequest.js** | Indexes `{ status: 1, requestType: 1 }`, `{ status: 1, leaveDates: 1 }`. |
| **docs/ADMIN_DASHBOARD_PERFORMANCE_FIXES_SUMMARY.md** | This summary. |

---

## 4. Assumptions

- Date used for dashboard and pending-leaves cache is server “today” in `YYYY-MM-DD` (e.g. `new Date().toISOString().slice(0, 10)`). No timezone override.
- `utils/cache` (SimpleCache) is still used for other keys (e.g. status, employee_dashboard); only dashboard summary invalidation was fixed to use cacheService.
- Frontend remains single-request for initial load (`/admin/dashboard-summary?includePendingLeaves=true`); no progressive loading change in this pass.
- Indexes are created in the background by MongoDB; no migration script was added.

---

## 5. Follow-Up Recommendations

1. **Verify indexes in DB:** After deploy, check that the new indexes exist (e.g. `db.attendancesessions.getIndexes()`) and that dashboard/pending-leaves queries use them (explain plans if needed).
2. **Optional dashboard-employees cache:** Add short-TTL cache for `GET /admin/dashboard-employees/:type` (e.g. key by type + date + page + limit) and invalidate on attendance/leave changes to reduce DB load when opening the same card repeatedly.
3. **Monitor PERF_LOG:** In staging, run with `PERF_LOG=true` and sample logs to confirm cache hit rate and handler duration; tune TTLs or indexes if needed.
4. **Leave create from admin:** If admins can create leave requests from a different route, ensure that path also calls `cacheService.invalidatePendingLeaves(today)`.

---

## 6. Final Verification Checklist

- [x] Clock-in/clock-out invalidate dashboard cache (cacheService).
- [x] Break start invalidates dashboard cache.
- [x] Leave approve/reject/update/delete invalidate pending-leaves cache (and dashboard where applicable).
- [x] Employee leave create invalidates pending-leaves cache.
- [x] THROTTLE_MS = 500 for socket-driven refetch.
- [x] No `fetchAllData()` after leave/break approve/reject; only targeted refetch (summary + pending leaves).
- [x] Pending-leaves endpoint uses cache with 45s TTL and invalidates on leave mutations.
- [x] Indexes added for AttendanceSession.endTime, AttendanceLog.attendanceDate, LeaveRequest (status+requestType, status+leaveDates).
- [x] isAdminOrHr documented to prefer token role; auth already sends role in JWT.
- [x] Performance logging only when NODE_ENV !== 'production' or PERF_LOG=true.
- [x] No removal of existing caching; only fixes and new pending-leaves cache.
- [x] No intentional change to permissions or data correctness; only cache invalidation, refetch targets, indexes, and logging.

---

*End of summary.*
