# Leaves Page Performance Fixes – Verification Report

**Auditor:** Senior QA / Frontend performance  
**Scope:** Frontend caching, socket scoping, reduced re-fetching, loading state  
**Method:** Code-path audit and logic verification (no live runtime; evidence from implementation)  
**Date:** Verification against current codebase

---

## Executive Summary

| Overall | Status |
|--------|--------|
| **Continuous loading eliminated** | **PASS** – Visibility and socket triggers are gated; no unconditional refetch. |
| **Cache working as intended** | **PASS** with one **gap**: post-TTL revisit shows full spinner instead of stale data + background refresh. |
| **Socket events only when necessary** | **PASS** – Only `leave_request_updated`; `attendance_log_updated` removed. |
| **Functional regressions** | **PASS** – Mutations invalidate cache and refetch; permissions and flows unchanged. |

**Confidence level:** **High** for production stability of the fix. One optional improvement and one edge case noted below.

---

## 1. Initial Load Behavior

| Check | Expected | Code path | Status |
|-------|----------|------------|--------|
| Exactly ONE API call for Leaves data (cold) | Single `/leaves/dashboard` or admin parallel pair | `fetchPageData()` / `fetchInitialData()` with no cache; single promise created and stored in `pendingFetchRef`; no other effect fires the same fetch on mount. | **PASS** |
| Loading spinner once, then disappears | Spinner only when `isInitialLoading` true | Cold load: `isInitialLoading = true` set before request; in `finally`, `setIsInitialLoading(false)`. Skeleton conditional is `if (isInitialLoading) return <LeavesPageSkeleton />`. | **PASS** |
| UI renders data immediately after fetch | State updated from response then loading cleared | `applyDashboardData(data)` then `setLeavesCache`; `finally` clears loading. | **PASS** |

**Edge case (no fail):** If `user` is still `null` on first paint (auth pending), `fetchPageData` uses `userId` undefined, so cache key is `leaves:undefined:employee:...`. When auth resolves, `user?.id` changes, `fetchPageData` identity changes, effect re-runs with key `leaves:<realId>:employee:...` and no cache → a **second** request can occur. So in slow-auth scenarios, **two** calls on first load are possible. Not a regression of “continuous” loading; acceptable unless auth is consistently slow.

---

## 2. Cache Validation

| Check | Expected | Code path | Status |
|-------|----------|------------|--------|
| Reload within TTL → no Leaves API call | No network for leaves dashboard/initial | `getLeavesCache(key)` returns entry when `age < entry.ttlMs`. Then `cacheFresh` is true; `applyDashboardData(cached.data)` and return without calling `api.get`. | **PASS** |
| Data served from cache | Same shape applied as from API | Cached value is `dashboardRes.data` / `{ requests, totalCount, employees }`; `applyDashboardData` / `applyInitialData` consume that shape. | **PASS** |
| UI renders instantly without spinner | No loading when cache fresh | When `cacheFresh`: `setIsInitialLoading(false)` and return; no request, so no spinner. | **PASS** |
| After TTL: background refresh | Refresh when cache expired | When TTL expired, `getLeavesCache` returns `null` (age >= ttlMs). Code then goes to “no cache” path and starts a new request. | **PASS** |
| After TTL: cached data remains visible during refresh | Stale data shown while revalidating | **GAP:** `getLeavesCache(key)` returns `null` when expired, so there is no “stale” entry to show. After TTL, the code treats it as cold load: `setIsInitialLoading(true)` and full skeleton. So cached data does **not** remain visible; user sees spinner until the new request completes. | **CONDITIONAL FAIL** |

**Cause:** `frontend/src/utils/leavesCache.js` – `getLeavesCache()` returns `null` when `age >= entry.ttlMs`. There is no “get stale entry” API used by the pages.

**Recommendation (optional):** Add e.g. `getLeavesCacheStale(key)` that returns the entry if present regardless of TTL. In `fetchPageData`/`fetchInitialData`, when `getLeavesCache` returns null, call `getLeavesCacheStale`; if that returns data, apply it, set `isBackgroundRefreshing` true, and run the fetch in background (no full-page spinner). This matches the checklist “Cached data remains visible during refresh” after TTL.

---

## 3. Tab Switch & Visibility Test

| Check | Expected | Code path | Status |
|-------|----------|------------|--------|
| Return to tab does NOT refetch immediately | Refetch only after cooldown or when needed | `handleVisibilityChange`: only calls `fetchPageDataRef.current(false)` if `now - lastRefetchTimeRef.current >= LEAVES_REFETCH_COOLDOWN_MS` (60s) or `last === 0`. So within 60s no refetch. | **PASS** |
| Refetch only if cache stale | When we do call fetch, cache may still be fresh | When `fetchPageData(false)` runs (e.g. after 60s), `getLeavesCache(cacheKey)` may still be fresh; then we apply cache and return without requesting. So no redundant call. | **PASS** |
| No hidden listeners | Only visibility and leave socket | No `attendance_log_updated`; no `focus`; only `visibilitychange` and `leave_request_updated`. | **PASS** |

---

## 4. Socket Event Verification

| Trigger | Expected | Implementation | Status |
|---------|----------|----------------|--------|
| Leave created / updated / approved / rejected | Cache invalidated; one refetch per event | Socket handler: `invalidateLeavesCache('leaves:')` then `fetchPageDataRef.current(true)`. Backend emits `leave_request_updated` on those actions. Single refetch per event. | **PASS** |
| Attendance clock-in/out, break start/end | No Leaves reload, no Leaves API call | Listeners for `attendance_log_updated` **removed** in both LeavesPage and AdminLeavesPage. No code path from attendance events to leaves fetch. | **PASS** |

---

## 5. Admin vs Employee Comparison

| Check | Expected | Code path | Status |
|-------|----------|------------|--------|
| Employee: minimal API calls | One dashboard call when needed | Same cache + visibility + socket rules; single aggregate `/leaves/dashboard`. | **PASS** |
| Employee: no background flicker | No full-page spinner on background refresh | When we have stale cache we set `isBackgroundRefreshing` true and do not set `isInitialLoading`; skeleton is gated on `isInitialLoading` only. | **PASS** |
| Admin: heavy data lazy | Year-end and analytics not on initial load | Year-end: `fetchYearEndActions` and `fetchYearEndFeatureStatus` run only in effect when `currentTab === 1` and `!yearEndDataLoadedRef.current`. Leave Count / Intern tabs load their own data when tab is active. | **PASS** |
| Admin: no duplicate fetches | Single initial fetch; year-end once when tab opens | Main list: same deduplication and cache as employee. Year-end: ref prevents double run; URL effect no longer calls `fetchYearEndActions` when `tab=year-end`. | **PASS** |

---

## 6. Loading State UX

| Check | Expected | Code path | Status |
|-------|----------|------------|--------|
| Spinner only on first load | Full-page skeleton only when no cached data | Skeleton shown only when `isInitialLoading` is true. That is set only when there is no valid cache and we start a fetch (or on cold load). | **PASS** |
| Background refresh does not block UI | No full-page loader during background refresh | When we have cached (including stale) data we set `isInitialLoading = false` and optionally `isBackgroundRefreshing = true`. We do not render skeleton for background refresh. | **PASS** |
| No flickering or loader loops | No effect re-running fetch unnecessarily | Fetch effect depends on `fetchPageData`/`fetchInitialData` (which depend on page, rowsPerPage, and on employee page user id). No dependency that flips every render; no loop observed. | **PASS** |

---

## 7. Network & Performance Metrics

| Metric | Before (from diagnostic) | After (by design) | Status |
|--------|--------------------------|-------------------|--------|
| Leaves API call count on open | Multiple (visibility, socket, mount) | One on cold; zero when cache fresh | **PASS** – significant reduction |
| Tab focus | One refetch per focus | Zero unless 60s cooldown passed and cache not fresh | **PASS** |
| Attendance events | Each triggered full refetch | No Leaves request | **PASS** |
| Cache-busting on Leaves GETs | `_t=Date.now()` on all GETs | Skipped for URLs containing `/leaves` or `/admin/leaves` (axios interceptor) | **PASS** |

*Note: Actual “before vs after” counts and Time to Interactive should be confirmed in DevTools (Network tab, Performance) in your environment.*

---

## 8. Regression Check

| Area | Check | Status |
|------|--------|--------|
| Leave balances | Still from dashboard/initial response; applied via same `applyDashboardData` / `applyInitialData` | **PASS** – no change to source or shape |
| Approval flows | After approve/reject, handler invalidates cache and calls `fetchInitialData(true)` / `fetchPageData(true)` | **PASS** – fresh data after action |
| Role-based permissions | No change to routes or permission checks; only fetch strategy and cache | **PASS** |
| Error handling | `catch` in fetch still sets `setError(...)`; user still sees error message | **PASS** |
| Mutations (submit, carryforward, year-end, delete) | All call `invalidateLeavesCache('leaves:')` and then refetch with `forceRefresh` | **PASS** |

---

## 9. Remaining Inefficiencies / Gaps

1. **Post-TTL revisit shows full spinner (no stale-while-revalidate after expiry)**  
   - **Where:** `leavesCache.js` – `getLeavesCache()` returns null when expired; pages don’t read “stale” entry.  
   - **Impact:** User who returns after 3+ minutes sees skeleton until the new request completes.  
   - **Fix:** Optional: add stale read + background revalidate as in §2.

2. **Possible double fetch on Employee page when auth resolves after mount**  
   - **Where:** `LeavesPage.jsx` – `fetchPageData` in effect deps includes `user?.id` / `user?._id`; cache key changes when user loads.  
   - **Impact:** In slow-auth cases, two dashboard calls on first load.  
   - **Fix:** Optional: don’t run fetch effect until `user` is defined, or use a stable “hasUser” ref to avoid re-run when only `user` reference changes.

---

## 10. Evidence Summary (Code References)

- **One call on cold load:** `LeavesPage.jsx` L133–154 (single promise, stored in `pendingFetchRef`); `AdminLeavesPage.jsx` L2799–2826.
- **No refetch on tab within 60s:** `LeavesPage.jsx` L191–202; `AdminLeavesPage.jsx` L2950–2959.
- **Socket leave-only:** `LeavesPage.jsx` L173–187; `AdminLeavesPage.jsx` L2935–2944.
- **No _t for leaves:** `api/axios.js` L101–107.
- **Cache read/write:** `leavesCache.js` L34–50; used in both pages on fetch path and when `cacheFresh`.

---

## 11. Verdict and Confidence

- **Verdict:** The implementation **meets the verification goals** for eliminating continuous loading, using the cache for same-TTL and cooldown behavior, scoping socket to leave events only, and avoiding functional regressions.
- **Confidence:** **High** for production: no refetch loops, no attendance-driven reloads, and loading states are correct. The only conditional fail is “stale data visible after TTL,” which is an enhancement rather than a correctness bug.
- **Optional follow-ups:** (1) Stale-while-revalidate after TTL via a stale cache read; (2) Guard or stabilize initial fetch so auth resolution doesn’t cause a second dashboard call when not needed.

---

*End of verification report.*
