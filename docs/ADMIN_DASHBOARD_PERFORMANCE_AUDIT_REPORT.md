# Admin Dashboard – Read-Only Performance Audit Report

**Application:** Attendance Management Portal  
**Tech stack:** React 18 + Vite + MUI (frontend); Node.js + Express (backend); MongoDB/Mongoose  
**Page under audit:** Admin Dashboard  
**Hosting:** Production server (slower than local)  
**Audit type:** READ-ONLY – no code changes, optimizations, or fixes.

---

## Executive Summary

The Admin Dashboard can feel slow or laggy for several reasons:

1. **Two sequential API calls on every load** – The page always calls `/admin/dashboard-summary` twice (first without pending leaves, then with). They run one after the other, so total wait is the sum of both response times. On a slow network this doubles the time to a usable UI.

2. **Socket events trigger a full refetch** – Any of three socket events (`attendance_log_updated`, `leave_request_updated`, `leave_status_updated`) schedules a full refetch (the same two sequential calls). Bursts of events (e.g. many check-ins) can cause repeated refetches and a “repeated loading” feel.

3. **Backend does heavy work on cache miss** – When the dashboard summary cache (60s TTL) is cold or expired, the backend runs many DB queries and, for each employee “who’s in,” calls `getUserDailyStatus`. Each of those does multiple DB reads (User, AttendanceLog, AttendanceSession, BreakLog, ExtraBreakRequest, etc.). With many clocked-in users, this becomes a large amount of work per request.

4. **Production vs local** – On production, network RTT and possibly a remote DB add latency to every request. The same number of requests and the same backend work take longer in wall-clock time, so the dashboard feels slower than on localhost.

5. **Employee list modal and “Total” card** – Opening a summary card modal (e.g. “Total Employees”) calls `/admin/dashboard-employees/:type`. The backend does not support pagination; it returns the full list in one response. For “total” this can be a large payload and a single big query, which can feel slow on first open.

6. **No browser caching of API responses** – Every GET request adds `_t: Date.now()` in the axios interceptor, so the browser does not reuse cached responses. Each load and each refetch always hits the network.

Below we break this down by frontend, network/API, backend, hosting, symptom→cause mapping, and risk assessment.

---

## PART 1 – Frontend Performance Audit

### 1.1 API call behavior

| Finding | Detail |
|--------|--------|
| **Total API calls on page load** | **2** (both to `/admin/dashboard-summary`). First: `includePendingLeaves=false`. Second: `includePendingLeaves=true`. |
| **Parallel vs sequential** | **Sequential.** The second request is only sent after the first completes. Total time to “fully loaded” is roughly T1 + T2. |
| **Duplicate/repeated calls** | Possible duplicate initial run if the auth effect re-runs (e.g. `user?.id` / `user?._id` or `authLoading` change again after first run). A ref guard (`dataFetchedRef`) reduces but does not eliminate risk if unmount/remount or dependency changes cause the effect to run again before completion. |
| **Calls triggered by auth** | The main data-loading effect depends on `[user?.id, user?._id, authLoading]`. When auth finishes and `user` is set (or its reference changes), the effect runs and triggers the two dashboard-summary calls. So auth state resolution directly triggers these calls. |
| **Calls retriggered by socket/timers** | Yes. A second `useEffect` (when `authReady` is true) subscribes to: `attendance_log_updated`, `leave_request_updated`, `leave_status_updated`. Each event goes through a 1500 ms throttle then calls `fetchAllDataRef.current(false)`, which runs the **same two sequential** dashboard-summary requests again. So one socket event → 2 API calls; multiple events in a short time can cause multiple refetches (throttled but still full refetches). |

**Additional API (modal):**  
When the user opens the Employee List modal (e.g. “Employees Present”, “Total Employees”), `EmployeeListModal`’s `useEffect` runs and calls `GET /admin/dashboard-employees/:type` with `page=1`, `limit=50`. So each modal open adds at least one more API call.

### 1.2 Rendering and re-renders

| Finding | Detail |
|--------|--------|
| **Excessive re-renders** | The page uses `useMemo` for `summaryCardsData` and `filteredRecentActivity`, and `memo()` for `SummaryCard`, `RequestItem`, `WhosInItem`, `ActivityItem`. So list items and derived data are not obviously recreated every render. Parent still re-renders when `summary`, `pendingRequests`, `loading`, `error`, or other state change. |
| **Frequently updated state** | `summary`, `pendingRequests`, `loading`, `error`, `snackbar`, modal open/close and selected-request state. Each socket-triggered refetch updates `summary` and/or `pendingRequests`, causing a full page re-render. |
| **useEffect dependency issues** | Main data effect depends on `[user?.id, user?._id, authLoading]`. Using both `user?.id` and `user?._id` can cause the effect to run when the same logical user is represented with a different property (e.g. one from token, one from `/auth/me`). |
| **Expensive work in render** | `filteredRecentActivity` filters and sorts `summary.recentActivity` in a `useMemo` with `[summary]` – acceptable. No heavy computation observed in render outside memoized values. |
| **Missing memoization** | `handleCardClick` is wrapped in `useCallback` with `[]`. Inline handlers like `onClick={() => handleViewLeaveRequestDetails(req)}` and `onClick={() => handleOpenActivityModal(item)}` create new functions each render; with `memo()` on list items this can reduce effectiveness of memo if those callbacks are passed as props (depending on how props are compared). |

### 1.3 Time-based updates

| Finding | Detail |
|--------|--------|
| **setInterval / setTimeout** | No `setInterval` on the page. The socket effect uses `setTimeout` only for throttling (schedule a refetch after 1500 ms). No live countdown or clock that ticks every second. |
| **Live clocks / counters** | `WhosInItem` has `liveLogoutTime` state and refs (`intervalRef`, `rafRef`) but the effect only sets `liveLogoutTime` once from `employee.calculatedLogoutTime` and clears any existing interval/raf; no interval or animation frame is started. So “Required Log Out” is static per employee, not a live-updating clock. No parent re-renders from time-based updates. |
| **Isolation of time state** | Time-related state is local to `WhosInItem` and is set once when `employee?.calculatedLogoutTime` or `employee?.activeBreak` changes; it is not global. |

### 1.4 Socket and event listeners

| Finding | Detail |
|--------|--------|
| **Number of socket listeners** | **3:** `attendance_log_updated`, `leave_request_updated`, `leave_status_updated`. All use the same handler `handleDashboardRelevantEvent` → `scheduleRefetch` → `fetchAllDataRef.current(false)`. |
| **Duplication on re-render** | Listeners are registered in a `useEffect` with dependency `[authReady]`. Cleanup uses `socket.off(...)` for all three. So when `authReady` changes, the effect re-runs and removes old listeners then adds new ones. No accumulation of duplicate listeners for the same event from this effect. |
| **Socket → full refetch** | Yes. Every handled event leads to a full refetch (both dashboard-summary calls). There is no delta update or “only pending leaves” refetch; the whole dashboard payload is requested again. |
| **Cleanup** | Cleanup is present: `socket.off` for all three events and `clearTimeout(scheduledTimer)`. No missing `off`/`removeListener` for these. |

### 1.5 UI blocking

| Finding | Detail |
|--------|--------|
| **Large tables/charts** | No very large tables on the main dashboard. “Who’s In” and “Pending Leave Requests” are limited lists. “Recent Activity” shows up to 4 items. No virtualization observed on this page. |
| **Chart libraries** | No charts on Admin Dashboard. No heavy chart library in use here. |
| **Heavy MUI / layout** | MUI `Dialog`, `Snackbar`, `Alert`, `Skeleton`, `Avatar`, `Chip`, `Button` are used. `EmployeeListModal` renders a long list of employees (up to 50 per “Load more”) without virtualization; opening “Total Employees” with a large list could cause a big DOM and layout work. |
| **Blocking synchronous JS** | No obvious long, synchronous loops or blocking work on the main thread in the dashboard page itself. Data processing (sorting pending requests, filtering recent activity) is inside `useMemo` or one-off after fetch. |

---

## PART 2 – Network and API Analysis

### APIs used by Admin Dashboard

| # | Endpoint | When | Notes |
|---|----------|------|--------|
| 1 | `GET /api/admin/dashboard-summary?includePendingLeaves=false` | On load (first), and on every socket-triggered refetch | Returns full summary (counts, whosInList, recentActivity). Backend may return cached object (60s TTL) or compute. |
| 2 | `GET /api/admin/dashboard-summary?includePendingLeaves=true` | On load (second, after first completes), and on every refetch | With cache hit: returns `{ summary, pendingLeaveRequests }`. Frontend only uses `pendingLeaveRequests`. With cache miss: backend computes summary then fetches pending leaves and returns same shape. |
| 3 | `GET /api/admin/dashboard-employees/:type?page=1&limit=50` | When user opens Employee List modal (e.g. Present / Late / On Leave / Total) | Backend **ignores** `page` and `limit` and returns the full array for that type. For `type=total`, this is all non-Admin, active users. |

**Other APIs used from this page (user actions):**

- `PATCH /api/admin/leaves/:requestId/status` – approve/reject leave (and then refetch dashboard).
- `PATCH /api/admin/breaks/extra/:id/status` or `PATCH /api/admin/leaves/:id/status` – activity modal approve/reject, then refetch.

### Per-API analysis

| Endpoint | Approx response time | Payload size | Over-fetch / overlap | Dependencies |
|----------|----------------------|-------------|----------------------|--------------|
| **dashboard-summary (false)** | Depends on cache: cache hit ~fast (in-memory); cache miss ~hundreds of ms to seconds (DB + N× getUserDailyStatus). | Summary object: counts, whosInList (array of employees with times), recentActivity (array). Can be tens of KB. | None specific. | None. |
| **dashboard-summary (true)** | Same as above for base; plus LeaveRequest find + populate for pending. If base was cached, second call is mainly pending leaves. | When cached: `{ summary, pendingLeaveRequests }`. Frontend only uses `pendingLeaveRequests`; `summary` is redundant on the wire for this call. | Second response re-sends full summary even though frontend already has it from first call. | Sent after first call by design (sequential). |
| **dashboard-employees/:type** | Depends on type and data size. `total` can be slow (full user list query + large JSON). | For `total`: full list of users (fields like fullName, employeeCode, designation, department, etc.). Can be hundreds of KB for large orgs. | Backend returns full list; frontend only shows 50 at a time and “Load more” – but backend does not paginate, so all data is fetched. | Triggered by user opening modal. |

### Request patterns

- **Sequential chain:** The two dashboard-summary calls are intentionally sequential (second waits for first). So total time to “dashboard ready” = first response time + second response time.
- **N+1 (backend):** Not N+1 HTTP requests from frontend. Backend has an N+1-like pattern: for each “who’s in” employee it calls `getUserDailyStatus` (each does several DB queries). See Part 3.
- **Unintended repeated calls:** Possible if the auth effect runs twice (e.g. dependency change) despite `dataFetchedRef`. Socket events can cause many refetches if many events fire (throttled to at most one refetch per 1500 ms, but each refetch = 2 calls).

### Browser caching

- Axios request interceptor adds `_t: Date.now()` to every GET request. So **no browser HTTP cache** reuse for these API responses; every load and refetch is a new request.

---

## PART 3 – Backend Computation Audit

### 3.1 Database queries

**Route: `GET /admin/dashboard-summary`**

- **Cache hit (`includePendingLeaves=false`):** No DB; return cached summary.
- **Cache hit (`includePendingLeaves=true`):** One query: `LeaveRequest.find({ status: 'Pending', requestType: { $ne: 'YEAR_END' } }).populate('employee', ...).sort(...).lean()`.
- **Cache miss (full computation):**
  - **Parallel batch 1:**  
    - `User.countDocuments({ role: { $ne: 'Admin' }, isActive: true })`  
    - `AttendanceLog.find({ attendanceDate: today }).select(...).lean()`  
    - `AttendanceSession.aggregate([...])` (match, lookup attendancelogs, unwind, sort, group, lookup users, project)  
    - `AttendanceLog.find({ attendanceDate: today, notes: { $ne: null, $ne: '' } }).populate('user', ...).limit(5).lean()`  
    - `ExtraBreakRequest.find({ status: 'Pending' }).populate('user', ...).limit(5).lean()`  
    - `LeaveRequest.find({ isBackdated: true, status: 'Pending' }).populate('employee', ...).limit(5).lean()`  
    So **6** parallel queries.
  - **Then:** For each employee in `whosInListRaw`, `getUserDailyStatus(employee._id, today)` is called in `Promise.all`. So **N** concurrent service calls, where N = number of “who’s in” employees.
  - **Inside each `getUserDailyStatus`:**  
    - Batch 1: `User.findById(userId).populate('shiftGroup').lean()`, `AttendanceLog.findOne({ user, attendanceDate }).lean()`.  
    - Then: `AttendanceSession.findOne({ attendanceLog }).sort({ startTime: 1 }).select('startTime').lean()`.  
    - Then (if options include sessions/breaks/autoBreak): `AttendanceSession.find(...)`, `BreakLog.find(...)`, `BreakLog.findOne(...)` (active auto break).  
    - If options include requests: two `ExtraBreakRequest.findOne(...)`.  
    So **about 4–8+ queries per employee** in “who’s in” list.
  - **After whosInList:**  
    - If `todayLogs.length === 0`: `AttendanceLog.find({ attendanceDate: today }).select('_id').lean()` and `AttendanceSession.countDocuments(...)`.  
    - If `presentCount === 0 && lateCount === 0`: `AttendanceLog.countDocuments(...)`.  
    - `LeaveRequest.countDocuments({ status: 'Approved', leaveDates: { $elemMatch: ... } })`.  
  - **If `shouldIncludePendingLeaves`:** Same LeaveRequest find + populate as in cache-hit path.

So **per dashboard-summary on cache miss:** 6 + N×(4–8+) + 0–3 + optional leave query. With many users “who’s in,” N is large and total query count is high.

**Route: `GET /admin/dashboard-employees/:type`**

- **present:** `AttendanceLog.find(...).populate('user', ...).lean()`; if result length 0, `AttendanceSession.aggregate([...])` (lookups + match today).
- **late:** `AttendanceLog.find({ attendanceDate: today, clockInTime exists, isLate: true }).populate('user', ...).lean()`.
- **on-leave:** `LeaveRequest.find({ status: 'Approved', leaveDates $elemMatch today }).populate('employee', ...).lean()`.
- **total:** `User.find({ role: { $ne: 'Admin' }, isActive: true }).select(...).sort({ fullName: 1 }).lean()` – **no skip/limit**; returns full list.

**Index usage (inferred):**  
Queries filter on `attendanceDate`, `user`, `attendanceLog`, `status`, `endTime`, etc. Absence of indexes on these would cause collection scans on large collections. Not verified in this read-only audit.

### 3.2 Data processing

- **Dashboard summary:** After DB, the code builds `whosInList` by mapping over raw list and calling `getUserDailyStatus` (each call does its own logic and DB). Then it loops `todayLogs` to compute present/late counts (in-memory). Recent notes, breaks, and backdated leaves are mapped to `recentActivity` and merged/sorted in memory. No heavy CPU-bound loop, but volume of work scales with “who’s in” count.
- **getUserDailyStatus:** Recalculates late/half-day status, computes logout time from sessions/breaks/shift. All per-request, per-user; repeated for every “who’s in” employee on every cache-miss summary.

### 3.3 Response assembly

- Summary merges: totalEmployees, present/late/onLeave counts, whosInList (enriched with calculatedLogoutTime), recentActivity. When `includePendingLeaves=true`, backend sends `{ summary, pendingLeaveRequests }`; frontend only uses `pendingLeaveRequests` from that response, so summary in that response is redundant.
- **dashboard-employees:** Builds one array per type (present/late/on-leave/total) and returns it; no pagination, so “total” can be a very large array.

---

## PART 4 – Hosting and Environment Difference

| Factor | Local | Hosted (production) | Impact |
|--------|--------|----------------------|--------|
| **Network RTT** | Low (localhost or same machine) | Higher (client ↔ server, server ↔ DB if remote) | Every API call pays RTT. Two sequential calls = 2× RTT plus server time. |
| **DB location** | Often local or same region | May be remote (e.g. MongoDB Atlas in another region) | Each DB round-trip adds latency. With many queries per request (e.g. N× getUserDailyStatus), total DB latency dominates. |
| **CPU / resources** | Typically more headroom | Shared or limited CPU | Heavy cache-miss computation (many getUserDailyStatus calls, aggregations) can take longer under load. |
| **Disk I/O** | Fast local disk | Possible slower or shared disk | Logs, file access; less relevant for dashboard-summary which is in-memory cache + DB. |
| **Cold start / restarts** | Less frequent | Possible process restarts, cold starts | After restart, dashboard cache is empty. First few requests get full computation and are slow. |

So “works locally but slow in prod” is explained by: higher RTT, remote or constrained DB, and possibly lower CPU, plus cold cache after deploys/restarts.

---

## PART 5 – Symptom → Cause Mapping

| Observed symptom | Root cause | Location |
|------------------|------------|----------|
| **Slow initial load** | Two sequential API calls; cache miss on backend causes many DB queries and N× getUserDailyStatus; network and DB latency in production. | Frontend (sequential calls), Backend (heavy computation), Network/DB |
| **UI freeze** | Large Employee List modal (e.g. “Total”) rendering many rows without virtualization; possible main-thread work during refetch/state update. | React (large list in modal), Backend (full list in one response) |
| **Repeated loading** | Socket events (attendance_log_updated, leave_request_updated, leave_status_updated) each trigger full refetch (2 API calls); burst of events → multiple refetches (throttled but still full). | Frontend (socket effect), Backend (no delta/lightweight endpoint) |
| **Slow charts** | N/A – no charts on Admin Dashboard. | – |
| **Works locally but slow in prod** | Higher network RTT, remote or constrained DB, lower CPU, cold cache after restart; same logic runs but with more latency and possibly slower DB/CPU. | Hosting, DB location, Backend (query volume) |

---

## PART 6 – Risk Assessment (No Fixes)

### Critical (must fix for perceived performance)

| Issue | Why it matters | Type of fix (conceptual only) |
|-------|----------------|--------------------------------|
| **Two sequential dashboard-summary calls on every load** | Doubles time to first meaningful paint; on slow networks or slow backend, users wait noticeably longer. | Single API that returns base summary + pending leaves in one response, or run both in parallel and merge on the client. |
| **Full refetch on every socket event** | Any attendance/leave update triggers 2 full API calls. High activity → repeated loading and “laggy” feel. | Refetch only what changed (e.g. only pending leaves) or use event payload to update local state instead of full refetch. |
| **N× getUserDailyStatus on cache miss** | With many “who’s in” employees, one dashboard-summary request does dozens of service calls and many DB queries. Cache miss (e.g. after 60s TTL or restart) makes the first load very slow. | Batch or aggregate “who’s in” and required logout in fewer queries; or cache per-user daily status with short TTL; or precompute “who’s in” with logout time in one aggregation. |

### High

| Issue | Why it matters | Type of fix (conceptual only) |
|-------|----------------|--------------------------------|
| **dashboard-employees returns full list; no pagination** | “Total Employees” can return hundreds/thousands of users in one response. Slow transfer, parsing, and rendering when modal opens. | Backend pagination (skip/limit); frontend already sends page/limit but backend ignores them. |
| **Browser cache disabled for API** | Every GET uses `_t=Date.now()`, so no reuse of cached responses. Refetches and reloads always hit network. | Allow caching for stable GETs (e.g. dashboard-summary with known params) or use conditional requests (ETag/If-None-Match) where appropriate. |
| **Second dashboard-summary response re-sends full summary** | When includePendingLeaves=true, backend sends `{ summary, pendingLeaveRequests }`; frontend only needs pendingLeaveRequests. Wastes bandwidth and parse time. | Return only pendingLeaveRequests when client already has summary (e.g. separate endpoint or query hint). |

### Medium

| Issue | Why it matters | Type of fix (conceptual only) |
|-------|----------------|--------------------------------|
| **Auth effect dependency list** | `[user?.id, user?._id, authLoading]` can cause effect to run more than once as user object stabilizes, risking duplicate initial fetches. | Depend on a single stable user identifier and avoid redundant deps. |
| **Employee list modal: no virtualization** | Rendering 50+ heavy list items (avatars, chips, nested layout) can cause jank when opening “Total” or large lists. | Virtualize the list (e.g. windowing) so only visible rows are in the DOM. |
| **Dashboard summary cache TTL 60s** | Short TTL means cache often expires; production traffic and multiple tabs can see frequent cache misses and heavy recomputation. | Consider slightly longer TTL or cache warming; must balance freshness. |
| **isAdminOrHr may do extra User.findById** | When role is missing from token, middleware does one User lookup per request. Adds one DB round-trip per admin API call. | Ensure token includes role or cache role by userId to avoid repeated lookups. |

### Low

| Issue | Why it matters | Type of fix (conceptual only) |
|-------|----------------|--------------------------------|
| **Inline handlers in list items** | New function references every render; with memo() children this can reduce memo benefit. | Pass stable callbacks or use a single handler that receives item id/index. |
| **Redundant summary in second API response** | Minor bandwidth and parse cost. | As in “High”: return only what client needs for that call. |

---

## Final Deliverable Summary

1. **Executive summary** – See top of document: sequential double call, socket-driven full refetch, heavy backend on cache miss, production latency, large employee list, no browser cache.
2. **Frontend bottlenecks** – Sequential dashboard-summary calls; full refetch on three socket events; auth effect dependencies; large non-virtualized list in Employee List modal; no live clocks but socket/refetch pattern drives “repeated loading.”
3. **Backend bottlenecks** – Cache miss: 6+ parallel queries plus N× getUserDailyStatus (each with 4–8+ queries); no pagination for dashboard-employees; second response includes redundant summary.
4. **Database inefficiencies** – Many small queries per “who’s in” user (getUserDailyStatus); full User find for “total” employees; indexes not audited but compound indexes on attendanceDate, user, attendanceLog, status would help.
5. **Hosting-related issues** – Network RTT, remote DB, possible CPU limits, cold cache after restarts; all make the same work feel slower in production.
6. **Ranked risks** – Critical: sequential double call, full refetch on socket, N× getUserDailyStatus. High: no pagination for employee list, no API caching, redundant payload. Medium: effect deps, no list virtualization, cache TTL, role lookup. Low: inline handlers, redundant summary in response.
7. **Why the dashboard feels laggy** – Users wait for two requests in a row on load; any real-time event triggers two more; when the backend cache is cold, one request does a lot of DB and service work; in production, network and DB latency amplify this. The combination of these factors explains the slow and sometimes “repeated loading” experience.

---

*End of read-only performance audit. No code was modified.*
