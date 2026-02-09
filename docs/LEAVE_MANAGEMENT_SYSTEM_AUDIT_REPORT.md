# Leave Management System – End-to-End Audit Report

**Scope:** Frontend, Backend, API, Database, Cache, Auth, Business Rules, Infrastructure, Frontend ↔ Backend  
**Assumption:** System is live in production.

---

## 1. Executive Summary

The Leave Management System implements employee leave apply, admin approve/reject, year-end carry forward/encash, attendance sync, and policy rules (monthly caps, weekday restrictions, balance deduction). The following **high-risk issues** require immediate attention:

| Priority | Issue | Area | Impact |
|----------|--------|------|--------|
| **P0** | Year-End feature flag key mismatch: dashboard uses `yearEndLeaveFeatureEnabled`, backend uses `yearEndFeature` | Backend / Frontend | Year-end option can appear disabled even when admin has enabled it. |
| **P0** | Missing API routes: `/leaves/previous-year-balances` and `/leaves/carryforward-decision` return 404 | Backend | Carryforward/encash UI triggers 404; feature is broken for users. |
| **P0** | No overlapping-leave validation | Backend | Same employee can have two approved leaves for the same date(s); balance and attendance logic assume no overlap. |
| **P1** | Leave balance not re-checked at approval time | Backend | Approving after balance was consumed elsewhere can lead to over-deduction (capped at 0) and policy violation. |
| **P1** | Concurrent approval race: two approvals for same employee can double-deduct balance | Backend | No optimistic lock or balance check in transaction; two PATCH calls can read same balance and both deduct. |
| **P1** | Frontend sends leave dates as UTC ISO; backend parses with `new Date()` for strings with `T` | Frontend/Backend | User in timezone behind IST can pick a date that becomes previous/next day in UTC; wrong date stored. |
| **P1** | Anti-exploitation service never used in employee apply flow | Backend | `AntiExploitationLeaveService.validateAntiExploitation` is not called from `leaves.js` or `leaveValidationService`; only `LeavePolicyService` runs. Policy may be incomplete or duplicated. |

**Positive findings:** Single aggregate dashboard endpoint reduces calls; leave apply uses transactions; attendance sync on approve/reject is implemented; IST utilities exist; cache invalidation on leave mutations is in place; admin override is logged.

---

## 2. Critical Issues (Must Fix Immediately)

### 2.1 Year-End Feature Flag Key Mismatch

- **Affected area:** Backend (leaves dashboard), Settings
- **Impact:** Year-end option can show as disabled on Leaves page even when admin has enabled it.
- **Root cause:**  
  - `POST /api/leaves/year-end-request` and `GET /api/leaves/year-end-feature-status` use `Setting.findOne({ key: 'yearEndFeature' })`.  
  - Dashboard aggregate `GET /api/leaves/dashboard` uses `Setting.findOne({ key: 'yearEndLeaveFeatureEnabled' })` for `yearEndFeatureStatus`.  
  - Settings code uses `YEAR_END_FEATURE_KEY = 'yearEndFeature'`. So UI reads a different key than the one used for submission and feature-status.
- **Recommended fix:** Use a single key everywhere (e.g. `yearEndFeature`). In `routes/leaves.js` dashboard block (~line 672), change to `Setting.findOne({ key: 'yearEndFeature' })` and align response shape with `year-end-feature-status` (e.g. `enabled: featureSetting?.value === true || featureSetting?.value === 'true'`).

### 2.2 Missing Carryforward API Routes (404)

- **Affected area:** Backend routes, Frontend LeavesPage
- **Impact:** Clicking “Choose Option” for carryforward calls `GET /leaves/previous-year-balances`; submitting decision calls `POST /leaves/carryforward-decision`. Both return 404 (confirmed in logs). Carryforward/encash flow is broken.
- **Root cause:** These routes are not implemented. Dashboard returns a hardcoded `carryforwardStatus: { hasPendingDecision: false }` and does not call any real previous-year API.
- **Recommended fix:**  
  - Either implement `GET /api/leaves/previous-year-balances` and `POST /api/leaves/carryforward-decision` (with clear business rules and storage for “previous year balance” and “decision”),  
  - Or remove/hide the carryforward UI and related state until the feature is implemented, and document the gap.

### 2.3 No Overlapping Leave Validation

- **Affected area:** Backend (leave apply and admin create/update)
- **Impact:** Same employee can have two approved leave requests covering the same date(s). Attendance sync and balance logic do not account for overlaps; reporting and payroll can be wrong.
- **Root cause:** No check that requested `leaveDates` do not overlap with existing Pending/Approved leaves for the same employee.
- **Recommended fix:** In `leaveValidationService` (or before `LeaveRequest.create` in `routes/leaves.js` and admin POST/PUT), add a step: for each requested date, ensure there is no other leave for that employee with status in `['Pending','Approved']` that includes that date. Reject with a clear error if overlap exists. Consider a compound index `{ employee: 1, status: 1, leaveDates: 1 }` to support this query efficiently.

### 2.4 Leave Balance Not Re-validated at Approval

- **Affected area:** Backend PATCH `/api/admin/leaves/:id/status`
- **Impact:** Leave can be approved even if the employee’s balance has dropped below the required days since apply (e.g. other leaves approved first). Balance is then deducted with `Math.max(0, balance - duration)`, so balance never goes negative but policy (e.g. “only approve if balance ≥ duration”) can be violated.
- **Root cause:** PATCH handler deducts balance without checking `employee.leaveBalances[leaveField] >= leaveDuration` before approving.
- **Recommended fix:** When `newStatus === 'Approved'` and `leaveField` is set, before deducting, check `employee.leaveBalances[leaveField] >= leaveDuration`. If not, abort transaction and return 400 with a message like “Insufficient leave balance at approval time.”

### 2.5 Concurrent Approval Race (Balance Double-Deduction)

- **Affected area:** Backend PATCH `/api/admin/leaves/:id/status`
- **Impact:** Two concurrent approvals for the same employee can both read the same balance, both deduct, and the last write wins; total balance can be one deduction short (or worse if multiple requests).
- **Root cause:** No optimistic locking (e.g. version field on User) and no “balance >= sum of deductions” check inside the transaction.
- **Recommended fix:** Use a transaction and re-read employee (with lock if supported, e.g. `findOneAndUpdate` with balance update in one step) so balance update is atomic. Alternatively add a version field on User and use optimistic locking; on conflict retry or return 409.

---

## 3. Major Issues (Correctness or Performance)

### 3.1 Frontend Leave Dates in UTC vs IST

- **Affected area:** Frontend LeaveRequestForm, Backend parseISTDate
- **Impact:** User in a timezone behind IST (e.g. US) selecting “Feb 4” can produce `startDate` as Feb 3 UTC; `toISOString()` sends Feb 3 UTC midnight; backend for `"YYYY-MM-DD"` parses as IST, but for strings with `T` uses `new Date(dateString)` (UTC). So stored date can be wrong.
- **Root cause:** `LeaveRequestForm.jsx` builds `leaveDates` with `Date.UTC(...)` and `current.toISOString()`, i.e. UTC. Backend `parseISTDate` for strings containing `T` just does `new Date(dateString)` and does not normalize to IST date.
- **Recommended fix:** Either send only date part from frontend (e.g. `YYYY-MM-DD`) for leave calendar dates, or backend for ISO strings: parse to UTC then derive IST date (e.g. using `getISTDateString`) and use that for validation and storage. Prefer normalizing to IST date (YYYY-MM-DD) at API boundary.

### 3.2 Allowed Leave Types: Frontend vs Backend

- **Affected area:** Frontend leaveTypePolicy, Backend getAllowedLeaveTypes (leaves.js)
- **Impact:** Frontend shows “Backdated Leave” for Permanent; backend `GET /api/leaves/allowed-types` returns `['Planned','Sick','Casual','Loss of Pay','Compensatory']` (no Backdated Leave). Inconsistent UX and possible confusions; apply may send Backdated Leave and backend may not list it.
- **Root cause:** Backend `getAllowedLeaveTypes` does not include ‘Backdated Leave’; frontend does. Backend apply flow accepts requestType and normalizes “Backdate” to “Backdated Leave” but allowed-types does not expose it.
- **Recommended fix:** Align allowed types: if backdated leave is supported for Permanent, add it to backend `getAllowedLeaveTypes` and ensure enum in LeaveRequest model and validation accept it everywhere.

### 3.3 Anti-Exploitation Not Used in Apply Flow

- **Affected area:** Backend routes/leaves.js, leaveValidationService, antiExploitationLeaveService
- **Impact:** All employee-side validation is done only via `LeavePolicyService` (and legacy checks in leaveValidationService). `AntiExploitationLeaveService.validateAntiExploitation` is never called on apply. If both were intended, some rules may be missing on apply; if anti-exploitation was meant to be the source of truth, it is unused.
- **Root cause:** `leaveValidationService.validateLeaveRequest` only calls `LeavePolicyService.validateRequest` and legacy validations; no call to `AntiExploitationLeaveService.validateAntiExploitation`.
- **Recommended fix:** Decide single source of truth: either (a) migrate all rules into LeavePolicyService and deprecate anti-exploitation for apply, or (b) call `AntiExploitationLeaveService.validateAntiExploitation` from leaveValidationService and ensure no duplicate/conflicting rules. Then remove or consolidate the other.

### 3.4 Redundant employee.save in PATCH Status

- **Affected area:** Backend admin.js PATCH `/leaves/:id/status`
- **Impact:** Minor: extra DB write and slight risk of confusion. Employee is saved after balance update and again after setting request fields (only request is updated in between).
- **Root cause:** Two `await employee.save({ session })` calls (once after balance update, once before attendance sync) with no employee field changes between them.
- **Recommended fix:** Keep a single `employee.save` after balance update; remove the second one before `request.save`.

### 3.5 Admin POST Leave – Wrong Schema Field Name

- **Affected area:** Backend admin.js POST `/leaves`
- **Impact:** If LeaveRequest schema does not have `overrideReason` as a top-level field (schema has `overrideReason` under docs; need to confirm), create could fail or the reason could be dropped.
- **Verification:** LeaveRequest model has `overrideReason`. Admin passes `overrideReason` in `leaveRequestData`. So this is fine; no change needed unless schema is changed.

### 3.6 PUT /leaves/:id – No Policy Re-validation on Status Change

- **Affected area:** Backend admin.js PUT `/leaves/:id`
- **Impact:** If admin changes an existing request’s dates or requestType via PUT and sets status to Approved, policy (e.g. monthly cap, weekday rules) is not re-run; only balance and attendance sync are updated.
- **Root cause:** PUT applies `req.body` to the document and then handles balance and attendance; it does not call LeavePolicyService (or anti-exploitation) for the new payload.
- **Recommended fix:** When PUT results in “willBeApproved” with changed dates/requestType/leaveType, run the same policy validation (and balance check) as for a new approval, and abort with 400 if validation fails (unless explicit admin override is supported and passed).

### 3.7 LeavePolicyService.countWorkingDays – Saturday Policy TODO

- **Affected area:** Backend LeavePolicyService
- **Impact:** `countWorkingDays` does not account for employee Saturday policy (comment says “TODO: Implement Saturday policy logic”). Working-days cap may be over/under counted for alternate-Saturday employees.
- **Recommended fix:** Use the same Saturday logic as elsewhere (e.g. `isSaturdayOff` / alternateSaturdayPolicy) and optionally holidays in `countWorkingDays` for consistency with monthly cap logic.

---

## 4. Minor Issues (UX, Maintainability, Best Practices)

### 4.1 Frontend: Reason Length 100 Characters

- **Affected area:** Frontend LeaveRequestForm
- **Impact:** Hard 100-character minimum may be strict for short reasons; no matching max length enforced on backend.
- **Recommendation:** Consider lowering to a reasonable minimum (e.g. 20) and add a max length (e.g. 500) enforced on both frontend and backend to avoid abuse and align UX with backend.

### 4.2 Draft Auto-Save and Storage Event Listener

- **Affected area:** Frontend LeaveRequestForm
- **Impact:** `storage` listener updates state with `formData` in closure; multiple tabs can overwrite each other’s draft. Listener dependency array includes `formData`, so listener is re-registered often.
- **Recommendation:** Use a ref for latest formData in the listener, or sync only on load; avoid depending on `formData` in the listener deps to reduce re-subscribes.

### 4.3 LeavesPage: Visibility Refetch

- **Affected area:** Frontend LeavesPage
- **Impact:** Every time the tab becomes visible, `fetchPageData` runs. Can cause many requests if user switches tabs often.
- **Recommendation:** Add a short debounce or “last fetched at” throttle (e.g. don’t refetch if last fetch was &lt; 30s ago) to reduce redundant calls.

### 4.4 Axios: Debug console.log in Production

- **Affected area:** Frontend api/axios.js
- **Impact:** `console.log` for baseURL and token restoration runs in production; can leak info in console.
- **Recommendation:** Guard with `import.meta.env.DEV` or remove; avoid logging tokens (even preview) in production.

### 4.5 GET Requests Cache-Busting with _t

- **Affected area:** Frontend api/axios.js
- **Impact:** Every GET gets `_t: Date.now()`; prevents caching but can make debugging and server logs noisier.
- **Recommendation:** Keep for critical GETs if needed; consider applying only to specific endpoints or removing for static/slow-changing data.

---

## 5. Performance Bottlenecks

### 5.1 Admin GET /leaves/all – Aggregation Without Index Hint

- **Affected area:** Backend admin.js
- **Impact:** Large collections may cause slow aggregation; `$lookup` on users and `$match` on role/status need proper indexes.
- **Recommendation:** Ensure indexes on LeaveRequest (e.g. status, requestType, createdAt) and User (role, isActive). Use `.hint()` if needed after verifying index usage with explain.

### 5.2 Leave Analytics Counts – Aggregation and Cache TTL

- **Affected area:** Backend admin.js GET `/leaves/analytics/counts`, cacheService
- **Impact:** Aggregation is heavy; cache TTL 10 min is reasonable but key includes month/year/role/leaveType; many combinations can fill cache.
- **Recommendation:** Keep current TTL; ensure invalidation on leave create/update/delete (already done). Add index on LeaveRequest for (status, leaveDates, requestType) if not present.

### 5.3 Dashboard Aggregate – Five Parallel Fetches

- **Affected area:** Backend GET `/leaves/dashboard`
- **Impact:** Five parallel operations (requests, balances, holidays, carryforward status, year-end status) are good; no N+1. Holiday sort is in-memory.
- **Recommendation:** If holidays list grows large, consider pagination or cap; otherwise acceptable.

### 5.4 Frontend: No Lazy Loading for Leave Modals

- **Affected area:** Frontend LeavesPage, AdminLeavesPage
- **Impact:** Leave form and modals are likely in the main bundle; slight increase in initial load.
- **Recommendation:** Lazy-load `LeaveRequestForm`, `AdminLeaveForm`, `EnhancedLeaveRequestModal` with `React.lazy` and `Suspense` to reduce initial bundle size.

---

## 6. Policy & Compliance Gaps

### 6.1 Probation/Intern: Backdated Leave Must Be LOP

- **Status:** Enforced in LeavePolicyService.handleBackdatedLeave (backend). Frontend does not restrict requestType when dates are in the past.
- **Gap:** UX could show “Backdated Leave” or other types for past dates; backend correctly rejects non-LOP. Consider frontend hint or disabling non-LOP when all selected dates are in the past.

### 6.2 Medical Certificate Mandatory for Sick Leave

- **Status:** Enforced in leaveValidationService (legacy) and frontend. Backend rejects if missing.
- **Gap:** None; consistent.

### 6.3 Compensatory: Thursday Deadline, Same Month, Max 2/Month

- **Status:** Enforced in LeavePolicyService.validateCompensatoryLeave. Frontend does not pre-validate alternate date or weekday.
- **Gap:** Minor: user can select invalid alternate date and get error only on submit. Optional: add client-side checks for same month and weekday.

### 6.4 Planned Leave Advance Notice (30/60 Days)

- **Status:** Enforced in LeavePolicyService (working days and advance notice). Frontend does not duplicate.
- **Gap:** None.

### 6.5 Monthly Request Limit (4) and Working Days (5) Cap

- **Status:** Enforced in LeavePolicyService (and partially in AntiExploitationLeaveService, but not called on apply). LOP and Planned exemptions are implemented.
- **Gap:** Ensure single source of truth (see 3.3); no overlap check (see 2.3).

### 6.6 Year-End: Duplicate Request Prevention

- **Status:** Backend checks for existing Pending/Approved YEAR_END for same employee, yearEndLeaveType, yearEndYear; compound unique index exists. Frontend checks before submit.
- **Gap:** None for duplicate prevention.

---

## 7. Security Findings

### 7.1 Authentication and Authorization

- **Leave routes:** Employee endpoints use `authenticateToken`; admin/HR endpoints use `authenticateToken` + `isAdminOrHr`. No role escalation found in leave routes.
- **Recommendation:** Ensure JWT includes role and that `isAdminOrHr` always uses server-side role (DB fallback is present).

### 7.2 Input Validation

- **Employee apply:** requestType, leaveType, leaveDates, reason, optional alternateDate/medicalCertificate validated; dates parsed with parseISTDate. Mongoose schema enums apply.
- **Admin create/update:** Same fields; employee ID validated. No strict schema validation on req.body in PUT (relies on findByIdAndUpdate). Consider validating body against allowed fields to avoid mass assignment.

### 7.3 Sensitive Data Exposure

- **Leave list:** Employee list and leave lists expose employee names, codes, leave details. Appropriate for authenticated admin/HR and own requests.
- **Recommendation:** Ensure error responses do not leak internal IDs or stack traces in production.

### 7.4 Medical Certificate Upload

- **Status:** GridFS with metadata; upload restricted to authenticated user. File type/size validated on frontend; backend uses uploadMedicalCertificate middleware.
- **Recommendation:** Enforce file type and size again in backend middleware; restrict MIME types and max size to prevent abuse.

---

## 8. Architecture Improvement Suggestions

1. **Single policy engine:** Consolidate LeavePolicyService and AntiExploitationLeaveService into one policy layer with clear rule ordering and one place to maintain (apply, admin create, admin approve).
2. **Idempotent approval:** For PATCH status, consider idempotency key (e.g. client sends requestId + status); server returns 200 with same result if already applied to avoid double approval and balance issues.
3. **Leave balance as event stream:** For audit and rollback, consider storing “balance transactions” (apply, approve, reject, year-end) instead of only current balance on User; enables reconciliation and debugging.
4. **API versioning:** Prefix leave routes with `/v1` (or similar) so future changes (e.g. date format, new fields) can be introduced without breaking existing clients.
5. **Carryforward/previous-year model:** If carryforward is required, introduce a clear model (e.g. previous year balance snapshot, decision date, type) and dedicated endpoints instead of hardcoded `hasPendingDecision: false`.

---

## 9. Recommended Refactors (With Reasoning)

1. **Normalize leave date at API boundary:** Accept only `YYYY-MM-DD` for leave calendar dates in request body; backend parse with parseISTDate (YYYY-MM-DD path). Stops timezone/UTC confusion (see 3.1).
2. **Re-validate balance and policy on approval:** In PATCH (and PUT when status becomes Approved), run balance check and, if desired, policy check (with admin override option). Prevents over-approval and aligns with apply-time rules (see 2.4, 3.6).
3. **Atomic balance update on approval:** Use `User.findOneAndUpdate` with `$inc` for balance deduction inside the same transaction as leave status update, or use a version field for optimistic locking (see 2.5).
4. **Unify year-end feature flag:** Single setting key and one place that reads it (dashboard, feature-status, year-end-request); document key in settings module (see 2.1).
5. **Overlapping-leave check as shared helper:** Implement `checkNoOverlappingLeaves(employeeId, leaveDates, excludeRequestId)` and call from employee apply, admin POST, and admin PUT (see 2.3).

---

## 10. Quick Wins (Low Effort, High Impact)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Fix year-end dashboard key: use `yearEndFeature` in dashboard aggregate (leaves.js) | Low | Year-end option shows correctly when enabled. |
| 2 | Add balance check before deduct on approval (PATCH): if `balance < duration` return 400 | Low | Prevents approving when balance is insufficient. |
| 3 | Remove second redundant `employee.save` in PATCH status handler | Low | Cleaner code, one less write. |
| 4 | Send leave dates as `YYYY-MM-DD` from LeaveRequestForm (e.g. format from local date without time) | Low | Avoids timezone/UTC bugs. |
| 5 | Add overlapping-leave check in leaveValidationService and call before create (employee + admin) | Medium | Prevents duplicate/overlapping approved leaves. |
| 6 | Hide or remove carryforward “Choose Option” block until `/previous-year-balances` and `/carryforward-decision` exist | Low | Stops 404 and confusion. |
| 7 | Wrap axios debug logs in `import.meta.env.DEV` and avoid logging token preview in production | Low | Security and cleaner production console. |

---

**End of audit report.**  
Recommend addressing P0/P1 items first, then major and policy/consistency items, then quick wins and minor/performance improvements.
