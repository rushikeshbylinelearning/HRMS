# Leaves Page – Performance & Re-fetch Diagnostic Report

**Scope:** Employee Leaves page (`LeavesPage.jsx`), Admin Leaves page (`AdminLeavesPage.jsx`), frontend data flow, cache usage, re-renders, and backend signals.  
**Task:** Diagnosis only – no fixes implemented.

---

## 1. Executive summary

| Finding | Severity |
|--------|----------|
| **Continuous loading / repeated refetches** | High – driven by **visibility refetch on every tab focus**, **socket `attendance_log_updated`** (very frequent), and **no throttling**. |
| **Caching** | **Effectively bypassed** – Leaves pages do not use `apiCache`; axios injects `_t=Date.now()` on every GET, so browser and any param-based cache are defeated. |
| **Redundant API calls** | Multiple – same data refetched on visibility, socket events, and (Admin) on tab/URL changes without deduplication. |
| **Re-render hotspots** | Moderate – large Admin page with many state updates; child tabs (Leave Count / Intern) have effect chains that can trigger extra fetches when filters change. |

---

## 2. Leaves page data flow

### 2.1 Employee Leaves page (`LeavesPage.jsx`)

**API calls on mount / when dependencies change:**

| Trigger | API | Source |
|--------|-----|--------|
| Mount + `page`/`rowsPerPage` change | `GET /leaves/dashboard?page=…&limit=…` | `useEffect(() => { fetchPageData(); }, [fetchPageData]);` (line 116) |
| Tab becomes visible | Same dashboard | `visibilitychange` → `fetchPageDataRef.current()` (lines 136–145) |
| Socket `leave_request_updated` | Same dashboard | `handleLeaveUpdate` (lines 125–129) |
| Socket `attendance_log_updated` | Same dashboard | Same `handleLeaveUpdate` |
| User submits leave | Same dashboard | `handleRequestSubmitted` → `fetchPageData()` (line 163) |
| Carryforward modal open | `GET /leaves/previous-year-balances` | `handleOpenCarryforwardModal` (line 181) |
| Year-end / carryforward submit | Dashboard | Various handlers call `fetchPageData()` after success |

**Dependency chain:**

- `fetchPageData` is `useCallback(..., [page, rowsPerPage])` (line 100). So it is recreated when `page` or `rowsPerPage` changes.
- The effect `useEffect(() => { fetchPageData(); }, [fetchPageData]);` runs on mount and whenever `fetchPageData` identity changes (i.e. pagination change). That part is correct and not a loop.

### 2.2 Admin Leaves page (`AdminLeavesPage.jsx`)

**Main requests list (Requests tab):**

| Trigger | APIs | Source |
|--------|------|--------|
| Mount + `page`/`rowsPerPage` change | `GET /admin/leaves/all?page=…&limit=…`, `GET /admin/employees?all=true` (parallel) | `useEffect(() => { fetchInitialData(); }, [fetchInitialData]);` (line 2890) |
| Tab becomes visible | Same two calls | `visibilitychange` → `fetchInitialDataRef.current()` (lines 2915–2921) |
| Socket `leave_request_updated` / `attendance_log_updated` | Same two calls | `handleLeaveUpdate` (lines 2913–2918) |
| Save/approve/reject/delete leave or year-end | Same + year-end APIs | Handlers call `fetchInitialData()` and often `fetchYearEndActions()` |

**Year-end tab:**

| Trigger | API | Source |
|--------|-----|--------|
| Mount | `GET /admin/leaves/year-end-requests`, `GET /admin/settings/year-end-feature` | Pre-fetch effect (lines 2824–2827) |
| URL `?tab=year-end` and `yearEndActions.length === 0` | `fetchYearEndActions()` again | URL effect (lines 2829–2892) |

So when opening Admin Leaves with `?tab=year-end`, year-end requests can be fetched **twice** (once in pre-fetch effect, once in URL effect).

**Leave Count / Intern Count tabs (child components):**

- Each tab fetches employees, then `loadLeaveCounts()` (analytics or legacy pagination loop).
- When user changes month/date/leave-type filters, `loadLeaveCounts` is recreated and the effect that depends on it runs again → refetch. This is expected but adds to perceived “always loading” if the user changes filters often.
- When switching to tab index 2 or 3 after a mutation, `leaveCountsDirty` triggers refetch via refs (lines 2894–2905). Correct but adds more network activity.

---

## 3. Root causes of “continuous” loading and repeated refetches

### 3.1 Visibility change → full refetch, no throttle (High)

**File:** `LeavesPage.jsx` (lines 136–145), `AdminLeavesPage.jsx` (lines 2925–2932)

**What happens:**  
On every `document.visibilitychange` where `!document.hidden`, the code calls the current fetch function (dashboard or initial data). There is no debouncing or “last fetch timestamp” check.

**Why it hurts:**  
Each time the user switches back to the tab (from another tab, another window, or mobile app switch), a full refetch runs. If the user toggles tabs often, the page appears to “load continuously.”

**Exact location:**

- **LeavesPage.jsx:** `handleVisibilityChange` → `fetchPageDataRef.current()` (lines 136–145).
- **AdminLeavesPage.jsx:** `handleVisibilityChange` → `fetchInitialDataRef.current()` (lines 2925–2932).

---

### 3.2 Socket `attendance_log_updated` causes global refetch (High)

**File:** `LeavesPage.jsx` (lines 133–134), `AdminLeavesPage.jsx` (lines 2917–2918)

**What happens:**  
Both pages listen to:

- `leave_request_updated` – only on leave create/update/delete (admin routes).
- `attendance_log_updated` – emitted from **many** backend paths: clock-in, clock-out, breaks, analytics, admin overrides, etc. (e.g. `backend/routes/attendance.js`, `breaks.js`, `admin.js`, `analytics.js`, `earlyCheckoutService.js`).

On **any** of these events, the Leaves page runs a full dashboard/initial data refetch.

**Why it hurts:**  
In an active office, clock-ins/outs and breaks happen frequently. Every such event triggers a full refetch for every user with the Leaves (or Admin Leaves) page open, so the page can feel like it is “always loading” or constantly refreshing.

---

### 3.3 Axios: cache-busting on every GET (High – caching bypass)

**File:** `frontend/src/api/axios.js` (lines 101–104)

**Code:**

```javascript
if (config.method?.toUpperCase() === 'GET' && !config.params?._t) {
  config.params = { ...config.params, _t: Date.now() };
}
```

**Effect:**  
Every GET request gets a new `_t` query parameter. So:

- Browser HTTP cache is bypassed (URL is different every time).
- Any cache layer that uses full URL (or params) as key (e.g. `apiCache.js`’s `getCacheKey`) would see a new key every time, so cache is never reused.

**Conclusion:** Even if the Leaves page used a cache, this interceptor would defeat it for all GETs.

---

### 3.4 Frontend cache not used for Leaves (Medium)

**File:** `frontend/src/utils/apiCache.js` (exists and implements `cachedApiCall`, TTL, stale-while-revalidate)

**Observation:**  
No Leaves or Admin Leaves code imports or uses `cachedApiCall`. All leave requests use raw `api.get()` / `api.post()`. So:

- No request deduplication for leaves.
- No short-term in-memory cache or stale-while-revalidate for leaves.

**Relevant files:** `LeavesPage.jsx`, `AdminLeavesPage.jsx` – no reference to `apiCache.js`.

---

### 3.5 Loading state and race conditions

**LeavesPage.jsx:**

- `setLoading(true)` at start of `fetchPageData`, `setLoading(false)` in `finally` (lines 75, 99). Single fetch per run; no obvious missing `setLoading(false)`.
- If multiple triggers fire close together (e.g. visibility + socket), multiple overlapping fetches can run; the last one to finish sets `loading` to false. No cancellation or “ignore if stale” logic.

**AdminLeavesPage.jsx:**

- Same pattern for main list: `setLoading(true)` in `fetchInitialData`, `setLoading(false)` in `finally`. Overlapping visibility + socket refetches can occur.
- Child tabs (Leave Count / Intern) have their own `loading`; when they refetch (e.g. after filter change), they show loading again. No infinite loop observed, but many sequential or overlapping requests can make the UI feel “continuously” busy.

---

## 4. Cache verification summary

| Question | Answer |
|----------|--------|
| Is cached data ever read for Leaves? | **No** – Leaves and Admin Leaves do not use `apiCache` or any other frontend cache for leave APIs. |
| Are cache keys consistent? | N/A for leaves. For `apiCache` in general, keys would not be consistent for GETs because axios adds a new `_t` every time. |
| Is TTL respected? | N/A – no cache used for leaves. |
| Is cache invalidated after fetch? | N/A. |
| Cache-busting params? | **Yes** – every GET gets `_t=Date.now()` in axios interceptor, so caching is intentionally bypassed. |

**Verdict:** Caching is **completely bypassed** for the Leaves flow: no frontend cache is used, and the global GET cache-busting prevents browser and param-based caches from helping.

---

## 5. Axios / fetch layer

| Check | Result |
|-------|--------|
| Automatic retries | Only on 401 (token refresh), not on other errors. Retry is for the same request once after refresh. No general retry that would duplicate leaves calls. |
| Request duplication | No interceptors duplicate requests. Duplication comes from **multiple triggers** (visibility, socket, user actions). |
| `_t` injection | **Yes** – every GET gets `_t: Date.now()` (axios.js 101–104). |
| Token refresh triggering refetches | 401 triggers refresh; queued requests are retried with new token. That can cause a burst of retries (including leaves) but is not the main cause of “continuous” refetch; the main causes are visibility and socket. |

---

## 6. Re-render analysis

- **LeavesPage:** Depends on `useAuth()` (user). When AuthContext updates `user` (e.g. after `/auth/me` or profile update), LeavesPage re-renders. `fetchPageData` is stable for fixed `[page, rowsPerPage]`, so the data effect does not re-run just because of user object reference change. No obvious re-render loop.
- **AdminLeavesPage:** Large component with many state variables and tabs. Switching tabs, URL params, and filter changes in child tabs cause state updates and re-renders. Child tabs use `useCallback`/`useEffect` with filter state in deps, so filter changes correctly trigger refetches but also more renders and requests.
- **Inline objects/functions:** Some handlers and style objects are passed inline (e.g. to MUI components). That can cause extra child re-renders but is not the primary cause of refetch loops.
- **SaturdaySchedule (LeavesPage):** Receives `requests={myRequests}` and `policy={user?.alternateSaturdayPolicy…}`. When `myRequests` or `user` changes, it re-renders; it uses `useMemo` for schedule derivation, so no unnecessary refetch from this component.

---

## 7. Visibility / focus events

| Mechanism | Location | Throttling / debouncing |
|-----------|----------|--------------------------|
| `document.visibilitychange` | LeavesPage.jsx 136–145, AdminLeavesPage.jsx 2925–2932 | **None** – every focus triggers refetch. |
| `window.focus` | Not used for Leaves. | N/A |
| Polling / interval | Not used (polling removed; comment in both pages). | N/A |

So: **every tab focus triggers a full refetch**, with no throttle or “only if data is stale” check.

---

## 8. Pagination, filters, search

- **LeavesPage:** `page` and `rowsPerPage` are in `fetchPageData` deps; changing them correctly triggers one fetch. Defaults are stable (0, 10). No observed reset on each render.
- **AdminLeavesPage:** Same for main list (`page`, `rowsPerPage` in `fetchInitialData`). Tab and URL state can trigger the URL effect; dependency array includes `yearEndActions.length`, so when year-end data loads the effect runs again (can cause second `fetchYearEndActions()` when `tab=year-end` and initial data was empty).
- **Leave Count / Intern tabs:** Filter state (`selectedMonth`, `dateRange`, `selectedLeaveType`) is in `loadLeaveCounts` deps; changing filters correctly triggers refetch. No unintended reset found.

---

## 9. Backend signals

- **Cache headers / ETag:** No `Cache-Control` or `ETag` set in `backend/routes/leaves.js`. So the backend does not send caching hints for leaves endpoints.
- **Dashboard:** `GET /leaves/dashboard` aggregates requests, balances, holidays, carryforward, year-end feature in one response (single round-trip per fetch). It does not set cache headers.
- **Socket:** Backend emits `leave_request_updated` on leave mutations and `attendance_log_updated` on many attendance/break/analytics actions; frontend treats both as “refetch entire Leaves data,” which is the main driver of repeated refetches when many events fire.

---

## 10. Redundant API calls (summary)

| Call | Trigger(s) | Source |
|------|------------|--------|
| `GET /leaves/dashboard` (employee) | Mount, pagination change, **every tab focus**, **every leave_request_updated**, **every attendance_log_updated**, after submit/carryforward/year-end | LeavesPage.jsx |
| `GET /admin/leaves/all` + `GET /admin/employees?all=true` (admin) | Mount, pagination change, **every tab focus**, **every leave_request_updated**, **every attendance_log_updated**, after save/status/delete/year-end | AdminLeavesPage.jsx |
| `GET /admin/leaves/year-end-requests` | Pre-fetch effect on mount, **again** when URL has `?tab=year-end` and `yearEndActions.length === 0` | AdminLeavesPage.jsx (2824–2827, 2832–2833) |
| Leave Count / Intern tabs | Initial load + every filter change + refetch when switching to tab after mutation | AdminLeavesPage.jsx child tabs |

---

## 11. Re-render hotspots

- **AdminLeavesPage** root: Many state variables; tab switch, URL params, and child tab filter changes cause re-renders. Not a tight loop but heavy.
- **Leave Count / Intern tabs:** `loadLeaveCounts` and `fetchAnalyticsData` in effect deps; filter or employee list changes trigger re-runs and re-renders. Expected but contributes to “busy” feel.
- **LeavesPage:** Fewer state vars; main re-renders from auth `user` and leave state. No hotspot identified beyond normal data flow.

---

## 12. Immediate fixes (minimal changes)

1. **Throttle or gate visibility refetch**
   - **File:** `LeavesPage.jsx`, `AdminLeavesPage.jsx`
   - **Where:** `handleVisibilityChange` (LeavesPage ~136–145, AdminLeavesPage ~2925–2932)
   - **Change:** Only refetch when tab becomes visible if last fetch was more than X seconds ago (e.g. 30–60 s), or debounce (e.g. 2–3 s) so rapid tab switches don’t trigger multiple fetches.

2. **Stop refetching on `attendance_log_updated` (or scope it)**
   - **File:** `LeavesPage.jsx`, `AdminLeavesPage.jsx`
   - **Where:** Socket listener for `attendance_log_updated` (LeavesPage 133–134, AdminLeavesPage 2917–2918)
   - **Change:** Remove `attendance_log_updated` listener from Leaves pages, or only refetch when the event payload indicates a leave-related change (if backend can support that). Leave `leave_request_updated` as-is.

3. **Optional: stop adding `_t` for leaves GETs (if cache is introduced)**
   - **File:** `frontend/src/api/axios.js`
   - **Where:** Request interceptor (lines 101–104)
   - **Change:** Either skip adding `_t` for certain URLs (e.g. `/leaves/`, `/admin/leaves/`) when adding a frontend cache, or introduce a request config flag to skip cache-busting and use it for leaves dashboard/initial data.

4. **Use frontend cache for leaves dashboard / initial data**
   - **File:** `LeavesPage.jsx`, `AdminLeavesPage.jsx`
   - **Where:** Call to `api.get('/leaves/dashboard', ...)` and `Promise.all([api.get('/admin/leaves/all', ...), api.get('/admin/employees?all=true')])`
   - **Change:** Call these through `cachedApiCall` with a short TTL (e.g. 15–30 s) and consistent cache key (no `_t` for these calls, per fix 3). Invalidate or skip cache after mutations (e.g. after submit/approve/reject).

5. **Avoid double year-end fetch on Admin with `?tab=year-end`**
   - **File:** `AdminLeavesPage.jsx`
   - **Where:** URL effect (lines 2829–2892)
   - **Change:** When `tab === 'year-end'` and `yearEndActions.length === 0`, either rely on the pre-fetch effect only (e.g. don’t call `fetchYearEndActions()` again here) or use a ref “year-end already requested” so the URL effect doesn’t trigger a second request.

---

## 13. Optional optimizations

- **Memoization:** Memoize callbacks passed to child components (e.g. `handleViewDetails`, `handlePageChange`) so children don’t re-render unnecessarily when parent re-renders.
- **Throttling:** Throttle socket-driven refetch (e.g. max one refetch per N seconds per event type) so bursts of `leave_request_updated` or `attendance_log_updated` don’t cause many fetches.
- **Lazy loading:** For Admin Leaves, consider loading Leave Count / Intern tab data only when the user switches to that tab (lazy fetch), instead of on mount, to reduce initial load and parallel requests.
- **Stale-while-revalidate:** Use `apiCache`’s stale-while-revalidate for dashboard and admin initial data so the UI shows last data immediately and refreshes in the background instead of showing full loading on every refetch.

---

## 14. File / line reference quick index

| Issue | File | Line(s) / hook |
|-------|------|-----------------|
| Visibility refetch (employee) | `LeavesPage.jsx` | 136–145, `handleVisibilityChange` |
| Visibility refetch (admin) | `AdminLeavesPage.jsx` | 2925–2932, `handleVisibilityChange` |
| Socket refetch (employee) | `LeavesPage.jsx` | 120–154, `useEffect` with `leave_request_updated` / `attendance_log_updated` |
| Socket refetch (admin) | `AdminLeavesPage.jsx` | 2905–2938, same |
| Main data effect (employee) | `LeavesPage.jsx` | 116, `useEffect(() => { fetchPageData(); }, [fetchPageData])` |
| Main data effect (admin) | `AdminLeavesPage.jsx` | 2890, `useEffect(() => { fetchInitialData(); }, [fetchInitialData])` |
| Cache-busting on GET | `api/axios.js` | 101–104, request interceptor |
| No cache usage for leaves | `LeavesPage.jsx`, `AdminLeavesPage.jsx` | All `api.get` calls – no import of `apiCache` |
| Double year-end fetch | `AdminLeavesPage.jsx` | 2824–2827 (pre-fetch), 2830–2832 (URL effect when `yearEndActions.length === 0`) |
| Leave Count refetch on filters | `AdminLeavesPage.jsx` | 259–302 (`loadLeaveCounts`), 395–397 (effect when `employees.length`, `loadLeaveCounts` change) |

---

*End of diagnostic report.*
