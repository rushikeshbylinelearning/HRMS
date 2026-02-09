# Technical Analysis Report: Time Tracking Card Flicker on Employee Dashboard

**Date:** 2026-02-05  
**Scope:** Employee Dashboard — Work Duration Timer and Shift Progress Bar in the Time Tracking card  
**Objective:** Document root cause and behavior of the visual flicker on page refresh. No fixes applied.

---

## 1. Component Trace

### 1.1 Location of the Time Tracking Card

- **Page:** `frontend/src/pages/EmployeeDashboardPage.jsx`
- **Card:** The "Time Tracking" card is a `<Paper>` block starting at **line 677** (heading at 681). It is **not** a separate `TimeTrackingCard` component; it is inline JSX within `EmployeeDashboardPage`.
- **Timer component:** `WorkTimeTracker` — `frontend/src/components/WorkTimeTracker.jsx` (used as `MemoizedWorkTimeTracker` at line 714).
- **Progress bar component:** `ShiftProgressBar` — `frontend/src/components/ShiftProgressBar.jsx` (used as `MemoizedShiftProgressBar` at line 695).

### 1.2 Initial State Values Governing Visibility

| State / derived value | Initial value | Where set / derived |
|-----------------------|---------------|----------------------|
| `dailyData` | `null` | `useState(null)` — line 97 |
| `loading` | `true` | `useState(true)` — line 108 |
| `dataReady` | `!!dailyData` → **false** when `dailyData === null` | Line 644, derived |
| `isClockedInSession` | `dailyData?.status === 'Clocked In' \|\| isOnBreakUI` | Line 149, derived |

**Visibility rules:**

- **Timer and progress bar are mounted only when `dataReady` is true.**  
  When `dataReady` is false, the card shows **skeleton UI** (lines 782–789): `<SkeletonBox>` placeholders instead of `ShiftProgressBar` and `WorkTimeTracker`. So the timer and progress bar have **no initial “visible” state** in the sense of being rendered with `visible`/`hidden` — they are **not in the DOM** until the first successful API response sets `dailyData`.
- **Once `dataReady` is true**, visibility of the block that contains the timer and progress bar is controlled by **CSS class** on a wrapper:
  - **Line 692:**  
    `className={\`time-tracking-content ${isClockedInSession ? 'visible' : 'hidden'}\`}`
  - So:
    - **Visible:** when `isClockedInSession === true` (user is "Clocked In" or "On Break").
    - **Hidden:** when `isClockedInSession === false` (e.g. "Not Clocked In" / "Clocked Out").

There is **no separate `useState` for “timer visible” or “progress bar visible”**; visibility is entirely driven by `dataReady` (mount vs skeleton) and `isClockedInSession` (CSS `.visible` vs `.hidden`).

---

## 2. Rendering Logic

### 2.1 Conditional Rendering (EmployeeDashboardPage.jsx)

- **Lines 682–689:** Status text: if `dataReady` → show status from `dailyData`; else → `<Skeleton variant="text" ... />`.
- **Lines 690–789:** Main card content:
  - **If `dataReady`** (lines 690–781):
    - The wrapper `<Box className={\`time-tracking-content ${isClockedInSession ? 'visible' : 'hidden'}\`}>` is rendered (lines 691–735).
    - Inside it: `MemoizedShiftProgressBar` (695–704), then either `MemoizedBreakTimer` or `MemoizedWorkTimeTracker` (706–723), plus the "WORK DURATION" / "BREAK TIME" label (724–733).
    - So **Work Duration Timer and Shift Progress Bar are in the DOM only when `dataReady === true`**. Their visibility is then controlled by the CSS class above.
  - **If not `dataReady`** (lines 781–789):
    - Skeleton layout is shown: two `<SkeletonBox>` blocks. **Timer and progress bar are not mounted.**

So:

- **No loading state** is used in this branch; the card uses **only `dataReady`** (`!!dailyData`) to choose between “real content” and “skeleton”. The global `loading` state (line 108) is set during fetch but **is not read** in the Time Tracking card render.
- **Default when `dailyData` is set:** If the API returns with `status === 'Clocked In'` (or user is on break), `isClockedInSession` is true and the wrapper gets `.visible`, so the timer and progress bar **appear as soon as they mount**.

### 2.2 WorkTimeTracker and ShiftProgressBar Internal State

- **WorkTimeTracker (Work Duration Timer):**
  - **Line 9:** `useState({ hours: 0, minutes: 0, seconds: 0 })` — used only when **no** `unifiedState` prop.
  - On the dashboard, **`unifiedState` is always passed** when clocked in (from `unifiedState` computed in `EmployeeDashboardPage.jsx` around 375–382). When `unifiedStateProp` is truthy, the component renders the branch at **lines 80–95** and **ignores** the local `time` state, so there is **no 0:00:00 flash** from initial state when using the unified path.
- **ShiftProgressBar:**
  - **Line 18:** `useState(new Date())` for `now`; progress is derived in `useMemo` from `sessions`, `breaks`, and `now`. First paint uses the initial `now`; a `useEffect` (50–58) starts a 1s interval when status is Clocked In / On Break. So first frame shows one value, then it ticks — no explicit “hidden then visible” from these components.

So the flicker is **not** caused by the timer or progress bar toggling their own visibility via internal state; it is caused by **when** they are mounted and **how** their container’s visibility is toggled (see below).

---

## 3. Data Fetching Flow (Clock-In Status)

### 3.1 When and How Dashboard Data Is Fetched

- **Single source of “clock-in” status:** One aggregate endpoint is used:
  - **Line 182:** `api.get(\`/attendance/dashboard/employee?date=${localDate}\`)`
  - Response is destructured at **line 183**; `dailyStatus` (and thus `dailyData` after `setDailyData(dailyStatus)` at 206) contains `status`, `sessions`, `breaks`, etc.
- **When the fetch runs:**
  - **Lines 235–276:** A `useEffect` runs when `contextUser?.id`, `contextUser?._id`, or `authLoading` change. It only runs the fetch when `!authLoading && contextUser` (236–238). So there is a **delay** between:
    1. Initial mount (or auth resolving).
    2. Start of the request.
    3. Response and `setDailyData(dailyStatus)` (and thus `setLoading(false)` for initial load at 213–214).

### 3.2 Delay Between DOM Mount and API Response

- **Before the API returns:** `dailyData` remains `null` → `dataReady === false` → the Time Tracking card renders **skeleton only**; **Work Duration Timer and Shift Progress Bar are not in the DOM**.
- **When the API returns:** In the same tick, `setDailyData(dailyStatus)` (and related setters) run. On the next render, `dataReady` becomes true and the **real** content (including the timer and progress bar) is mounted. So:
  - There is a **clear delay** between “dashboard DOM mounted with auth ready” and “timer/progress bar appear.”
  - The moment they appear is **exactly** when the first successful response sets `dailyData`; there is no intermediate “loading” flag used to hide them after mount.

So the **visibility of the timer and progress bar is 100% tied to `dataReady`**: they are absent (skeleton) until the API responds, then they appear in one step when `dataReady` flips to true.

---

## 4. Effects and Visibility

### 4.1 useEffect in EmployeeDashboardPage

- **Initial fetch (235–276):** Ensures one initial `fetchAllData(true)` after auth is ready. Does not directly control timer/progress bar visibility; it only populates `dailyData`, which drives `dataReady` and `isClockedInSession`.
- **Visibility refetch (260–269):** On `visibilitychange`, if the tab becomes visible and the socket is disconnected, `fetchAllData(false)` runs. That can **replace** `dailyData` with a new payload. If the new payload has `status !== 'Clocked In'` and the user is not on break, `isClockedInSession` becomes false and the same DOM nodes get class `.hidden` — so the timer and progress bar **disappear** (opacity/visibility) without unmounting. That can look like “flicker into view, then disappear” if an earlier response had shown them and a later refetch (e.g. visibility or socket) returns “Clocked Out.”
- No other `useEffect` in this file toggles visibility of the Time Tracking content.

### 4.2 CSS That Drives the “Flicker” Feel

**File:** `frontend/src/styles/EmployeeDashboardPage.css` (lines 165–181)

```css
.time-tracking-content {
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s var(--ease-out-quint), visibility 0.3s var(--ease-out-quint);
    will-change: opacity;
}

.time-tracking-content.visible {
    opacity: 1;
    visibility: visible;
}

.time-tracking-content.hidden {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
}
```

- The **first time** the timer and progress bar are rendered, the parent `<Box>` is created **with** `time-tracking-content` and either `.visible` or `.hidden` in one commit. There is no prior “in-DOM” state for this element, so the browser applies the final opacity/visibility immediately (no transition from a previous opacity). So when `isClockedInSession` is true, the content appears at **opacity 1** right away — i.e. an **abrupt** appearance relative to the skeleton.
- So the “flicker into view” is the **instant switch** from skeleton (no timer/progress bar in DOM) to the full block (timer + progress bar) at full opacity, with no cross-fade or layout reservation.

### 4.3 Summary of What Causes the Glitch

- **Primary:** The **binary swap** from “skeleton” to “real content” when `dataReady` flips from false to true. The timer and progress bar are **not** rendered until then; when they are, they appear in one step (with `.visible` if clocked in), causing a noticeable “flicker into view.”
- **Secondary (possible “then disappear”):** If a **subsequent** refetch (visibility change or socket) returns a payload where the user is no longer “Clocked In” and not on break, `isClockedInSession` becomes false, the same wrapper gets `.hidden`, and the same elements go from visible to hidden — i.e. “flicker into view, then disappear.”
- **Optional value flicker:** If `unifiedState` were ever not passed on first paint (e.g. `dailyData.sessions` empty for one frame), `WorkTimeTracker` would use local state and could show 00:00:00 briefly; in the current flow, `unifiedState` is passed as soon as `dailyData` is set with sessions, so this is a minor/edge-case possibility rather than the main cause.

---

## 5. Root Cause (Exact Code / Logic)

1. **Line 644 (`EmployeeDashboardPage.jsx`):**  
   `const dataReady = !!dailyData;`  
   This is the single gate for mounting the real Time Tracking content (timer + progress bar) vs skeleton.

2. **Lines 690–692:**  
   `{dataReady ? (` …  
   `<Box className={\`time-tracking-content ${isClockedInSession ? 'visible' : 'hidden'}\`}>`  
   So when `dataReady` becomes true, the box (with timer and progress bar) is mounted and immediately gets either `.visible` or `.hidden`. There is no “loading” or “pending” state that keeps this block hidden after mount.

3. **Lines 166–175 (`EmployeeDashboardPage.css`):**  
   `.time-tracking-content` defaults to `opacity: 0; visibility: hidden;`, and `.time-tracking-content.visible` sets `opacity: 1; visibility: visible;`. Because the element is created with the final class in one commit, the transition does not run “from 0 to 1” on first paint; the visible state is applied immediately when `isClockedInSession` is true.

4. **Lines 206, 213–214:**  
   `setDailyData(dailyStatus)` and (for initial load) `setLoading(false)` run in the same response handler. The **next** React render after this is when `dataReady` flips and the timer/progress bar are first mounted and shown.

**Exact root cause in one sentence:** The Work Duration Timer and Shift Progress Bar are not in the DOM until the first dashboard API response sets `dailyData`; as soon as it does, they mount with `.visible` (when clocked in) and appear at full opacity in one step, producing a visible “flicker into view” relative to the skeleton, with a possible “then disappear” if a later refetch sets status to not clocked-in.

---

## 6. Visual Lifecycle (t = 0 to Stable)

| Phase | Time | DOM / state | What the user sees |
|-------|------|-------------|--------------------|
| t = 0 | Page refresh | Component mounts. `dailyData = null`, `dataReady = false`. Auth may be resolving. | If auth not ready: full-page `<EmployeeDashboardSkeleton />`. If auth ready: main dashboard with Time Tracking **skeleton** (SkeletonBox); **no** timer or progress bar in DOM. |
| t = 0+ | After auth | `contextUser` set, `authLoading` false. Effect runs, `fetchAllData(true)` called, `setLoading(true)`. | Same as above: Time Tracking card shows skeleton only. |
| t = API | API response | `setDailyData(dailyStatus)`, `setLoading(false)`, etc. Next render: `dataReady = true`. | **Abrupt switch:** Skeleton is replaced by real content. If `isClockedInSession` true: Box has `.visible` → Work Duration Timer and Shift Progress Bar **appear at full opacity** in one frame (“flicker into view”). If not clocked in: Box has `.hidden` → same nodes in DOM but not visible. |
| t = final | Stable | No further change to `dailyData` or refetch. | If clocked in: Timer updates every second (unified state / interval); progress bar updates; no further visibility change. If a refetch later returns “Clocked Out”: same nodes get `.hidden` → “disappear” (or “update” if user meant the numbers updating). |

So the **critical transition** is at **t = API**: one render with skeleton, next render with real content and (when clocked in) `.visible`, with no smooth transition between the two.

---

## 7. Side Effects (UX / Performance)

- **Layout shift (CLS):** Replacing the skeleton with the real card content (different height and structure) can cause a layout shift when `dataReady` flips. The skeleton (two SkeletonBoxes, ~120px + 48px + spacing) may not match the actual timer + progress bar height exactly, so **Cumulative Layout Shift** can occur at the moment the timer and progress bar appear.
- **Perceived “flicker”:** The instant appearance (no fade from skeleton to content) makes the change feel abrupt and can be described as a “flicker” or “flash.”
- **“Disappear or update”:** If the user is clocked in and a later refetch (visibility or socket) returns a non–clocked-in status, the same elements get `.hidden`, so they disappear without unmounting — reinforcing the “flicker then disappear” description. The “update” part is the normal per-second timer/progress update.

---

## 8. Findings Summary

- **Why the glitch occurs:**
  1. The Work Duration Timer and Shift Progress Bar are **not rendered at all** until the first dashboard API response sets `dailyData` (`dataReady` becomes true). Until then, only skeleton UI is shown.
  2. When the API returns, the next render mounts the timer and progress bar and, when the user is clocked in, applies the `.visible` class immediately, so they appear at full opacity in **one step** with no transition from the skeleton.
  3. There is **no** loading or “pending” state used in the Time Tracking card to smooth this transition; the card relies only on `dataReady` and the CSS class `.visible`/`.hidden`.
  4. Optionally, a **later** refetch (e.g. on visibility or socket) that returns “Clocked Out” (or similar) can set `isClockedInSession` to false, so the same elements switch to `.hidden` and disappear, matching “flicker into view before potentially disappearing or updating.”

**No code changes were made; this report is for investigation and documentation only.**
