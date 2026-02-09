# Leaves Page Performance Fixes – Summary

This document summarizes the changes made to fix continuous loading and unnecessary refetches on the Leaves (employee) and Admin Leaves pages.

---

## 1. What Was Implemented

### Layer 1: Frontend cache with TTL

- **New module:** `frontend/src/utils/leavesCache.js`
  - In-memory cache with stable keys:
    - Employee: `leaves:{userId}:employee:{year}:{page}:{limit}`
    - Admin: `leaves:admin:{year}:{page}:{limit}`
  - TTL: **3 minutes** (`LEAVES_CACHE_TTL_MS`).
  - Helpers: `getLeavesCache`, `setLeavesCache`, `invalidateLeavesCache`, `getEmployeeLeavesCacheKey`, `getAdminLeavesCacheKey`.
- **Behavior:**
  - On load, if cache is **fresh** → use cached data only (no request).
  - If cache is **stale** but present → show cached data and refresh in background (no full-page spinner).
  - After mutations or leave socket events → invalidate cache and refetch once.

### Layer 2: Smart socket event filtering

- **Removed:** Listening to `attendance_log_updated` on both Leaves and Admin Leaves pages.
- **Kept:** Only `leave_request_updated` (emitted when a leave is created/updated/rejected/deleted).
- **Effect:** Attendance activity (clock-in/out, breaks, overrides) no longer triggers Leaves refetch. Only leave-related changes do.

### Layer 3: Fetch deduplication and throttling

- **Axios** (`frontend/src/api/axios.js`):
  - GET requests to URLs containing `/leaves` or `/admin/leaves` **no longer** get `_t=Date.now()` added, so cache keys stay stable and browser/cache can be used.
- **In-page deduplication:**
  - Each page keeps a ref of the in-flight request (by cache key). If the same fetch is requested again before it finishes, the same promise is returned (no duplicate network call).

### Visibility and focus

- **Before:** Every tab focus triggered a full refetch.
- **After:** Refetch on visibility only if:
  - The **last refetch** was more than **60 seconds** ago (`LEAVES_REFETCH_COOLDOWN_MS`), or
  - Cache is expired (handled inside `fetchPageData`/`fetchInitialData` when called with `false`).
- So switching tabs no longer causes a refetch unless data is stale or 60s have passed.

### Loading state

- **Split states:**
  - `isInitialLoading`: true only when there is **no** cached data and we are fetching. Drives the **full-page skeleton**.
  - `isBackgroundRefreshing`: true when we are refreshing **with** cached data on screen. **No** full-page spinner; UI stays usable.
- Cached data is applied immediately when available, so revisits feel instant.

### Admin page optimizations

- **Year-end data (and feature flag):** Not fetched on initial page load. Fetched **only when the user opens the “Year-End Requests” tab** (lazy load). Deep link `?tab=year-end` still works: switching to that tab triggers the same lazy load.
- **Leave Count / Intern Count tabs:** Unchanged; they already load their own data when their tab content is active. No prefetch on mount.

---

## 2. Files Touched

| File | Changes |
|------|--------|
| `frontend/src/utils/leavesCache.js` | **New.** Cache API and constants. |
| `frontend/src/api/axios.js` | Skip `_t` for GETs to `/leaves` and `/admin/leaves`. |
| `frontend/src/pages/LeavesPage.jsx` | Cache, split loading, visibility cooldown, socket scoping, invalidation on mutations. |
| `frontend/src/pages/AdminLeavesPage.jsx` | Same cache/loading/visibility/socket; lazy year-end load; invalidation on all leave mutations. |

---

## 3. Validation (expected behavior)

- Opening the Leaves page triggers **at most one** API call (or zero if cache is fresh).
- Switching browser tabs **does not** refetch unless cache is expired or 60s cooldown has passed.
- **Attendance** activity (clock-in/out, breaks) **does not** cause Leaves to reload.
- **Leave** actions (create/update/approve/reject/delete) still update the UI (cache invalidated, one refetch).
- Revisiting the Leaves page within the TTL (3 min) shows data **immediately** from cache; no spinner.
- Admin Leaves: year-end and feature-flag requests are **not** sent until the user opens the Year-End tab.

---

## 4. Preserved behavior

- All leave business rules and permissions unchanged.
- No backend API changes; only frontend fetch strategy and cache/socket/visibility logic.
- Deep links (`?tab=year-end`, `?tab=requests`, `actionId`, `leaveId`) still work; year-end data loads when the user lands on the Year-End tab.
