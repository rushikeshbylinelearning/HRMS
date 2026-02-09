# Leave Policy Audit Report — Definitions vs Implementation

**Scope:** Leave policy configuration, eligibility, accrual/consumption, role-based rules (Intern, Probation, Permanent), leave application & approval flow, UI vs backend enforcement.  
**Type:** Read-only analysis. No code was modified.  
**Date:** February 4, 2025.

---

## 1. Executive Summary

Leave policy is **centralized in `LeavePolicyService`** for validation; balance storage lives in **User.leaveBalances / leaveEntitlements** and **LeaveRequest** in MongoDB. A **single policy service** is the intended source of truth; `AntiExploitationLeaveService` is **deprecated** and duplicated there. Frontend and backend **allowed leave types are aligned** (Permanent: Planned, Sick, Casual, LOP, Compensatory, Backdated Leave; Probation/Intern: LOP, Compensatory). Overlap validation, approval-time balance re-check, and atomic balance deduction on approval are **implemented**. Remaining **gaps**: **Backdated Leave** as a stored `requestType` never deducts balance (getBalanceField returns null); **Planned leave** working-days calculation does not exclude holidays (TODO in code); **clockInConflicts** is referenced but never defined in PATCH status handler (runtime risk); **accrual/carry forward** are manual (admin allocation + Year-End only); **LeaveRequest.requestType** enum includes both `Compensatory` and `Comp-Off` (redundant). No automatic accrual by tenure or frequency; no negative balance allowed (Math.max(0, ...) used).

| Area | Status | Notes |
|------|--------|--------|
| Policy source of truth | Centralized | LeavePolicyService; AntiExploitationLeaveService deprecated |
| Employee-type rules | Enforced | Permanent: all types; Probation/Intern: LOP + Compensatory only |
| Overlap validation | Enforced | checkNoOverlappingLeaves in validateRequest |
| Balance at approval | Enforced | validateApproval + atomic $inc with balance >= duration |
| Backdated Leave balance | Gap | requestType 'Backdated Leave' → no balance field → no deduction |
| Accrual / carry forward | Manual only | Admin allocation; Year-End CARRY_FORWARD/ENCASH |
| Frontend vs backend types | Aligned | leaveTypePolicy.js and getAllowedLeaveTypes match |

---

## 2. Policy Coverage Matrix (Policy vs Implementation)

### 2.1 Policy sources and responsibilities

| Source | Responsibility |
|--------|----------------|
| **Database** | `User.leaveBalances` (sick, casual, paid), `User.leaveEntitlements`, `User.employmentStatus`, `User.alternateSaturdayPolicy`; `LeaveRequest` (requestType, leaveDates, status, etc.); `Holiday` for working-day and Comp-Off rules. |
| **LeavePolicyService** | Single source of truth: overlap check, employee-type eligibility, backdated-date rules, type-specific rules (Casual 4-day notice, Planned advance notice, Sick/Comp-Off/LOP), monthly request cap (4), monthly working-days cap (5, Planned exempt), weekday restrictions (Fri/Mon blocked; Tue/Thu &lt;10 days blocked), admin override logging, apply and approval validation, balance checks. |
| **leaveValidationService** | Thin facade: delegates to LeavePolicyService.validateApply; no standalone policy. |
| **antiExploitationLeaveService** | Deprecated; rules consolidated into LeavePolicyService. Kept for backward compatibility; Saturday-off helpers only. |
| **Config / constants** | `backend/config/shiftPolicy.js` — shift/break timing only (no leave-type policy). No dedicated leave policy config file. |
| **Feature flags / env** | `Setting.key === 'yearEndFeature'` for Year-End; dashboard and year-end-request use same key. No env-based leave-type toggles. |

### 2.2 Leave types: definition vs implementation

| Leave type | Eligibility | Accrual / balance | Carry forward | Expiry | Max limits | Negative balance | Paid/Unpaid | Implementation notes |
|------------|-------------|-------------------|--------------|--------|------------|------------------|-------------|------------------------|
| **Casual** | Permanent only; 4 days advance notice | Deducts from leaveBalances.casual | Not auto; Year-End CARRY_FORWARD possible | Not in code | Subject to 4 requests/month, 5 working days/month (Casual counts) | No (Math.max(0, ...)) | Paid | Enforced in LeavePolicyService; balance check at apply and approval. |
| **Planned (Earned)** | Permanent only; 30/60 days advance by working days | Deducts from leaveBalances.paid | Year-End CARRY_FORWARD/ENCASH | Not in code | Exempt from 5 working-days/month cap; still 4 requests/month | No | Paid | countWorkingDaysForPlannedLeave has TODO: holidays not excluded. |
| **Sick** | Permanent only; same-day/backdated allowed | Deducts from leaveBalances.sick | Year-End | Not in code | Monthly caps apply | No | Paid | Medical certificate mandatory at apply (backend + frontend). |
| **LOP (Loss of Pay)** | All (Intern, Probation, Permanent) | No balance | N/A | N/A | Counts toward 4 requests and 5 working days/month | N/A | Unpaid | No balance check; weekday and monthly caps enforced. |
| **Comp-Off (Compensatory)** | All | No balance (earned by working weekend) | N/A | N/A | Max 2 Comp-Off requests per month; submit by Thursday same week; worked date current month, Sat/Sun only | N/A | Paid (time off) | Separate validation in validateCompensatoryLeave; alternateDate required. |
| **Backdated Leave** | Permanent (backend allows); Probation/Intern must use LOP for past dates | **Not implemented:** getBalanceField('Backdated Leave') returns null → no deduction | N/A | N/A | Same monthly caps as other types | N/A | Unclear | handleBackdatedLeave validates *dates* (past → Permanent Casual/Sick ok, or LOP for Probation/Intern). If requestType stored as 'Backdated Leave', no balance is ever deducted — design gap. |
| **YEAR_END** | Permanent only; feature flag | Adjusts balance on approval (CARRY_FORWARD/ENCASH) | CARRY_FORWARD adds to next year | N/A | Per employee/year/leaveType | N/A | N/A | Separate flow; not a daily leave type. |

### 2.3 Accrual and consumption

- **Accrual:** No automatic accrual by tenure or frequency. Balances are set by:
  - Defaults in User schema (sick: 6, casual: 6, paid: 10).
  - Admin: POST `/api/admin/leaves/allocate` (and bulk allocate).
  - Probation conversion: probationTrackingService sets leaveBalances when converting to Permanent.
- **Consumption:** On approval, balance is deducted via LeavePolicyService.getBalanceField(requestType) for Sick, Planned, Casual only. LOP, Compensatory, Backdated Leave, YEAR_END do not map to a balance field. Deduction uses Math.max(0, balance - duration); negative balance is not allowed.
- **Carry forward:** Only via Year-End CARRY_FORWARD (admin approval). No automatic year-end carry; dashboard carryforward status is hardcoded `hasPendingDecision: false` (previous-year-balances / carryforward-decision APIs not implemented).

---

## 3. Employee Type Compliance Table

| Employee type | Allowed leave types (backend & frontend) | When eligibility starts | Policy overrides | UI vs backend |
|---------------|------------------------------------------|--------------------------|------------------|----------------|
| **Permanent** | Planned, Sick, Casual, Loss of Pay, Compensatory, Backdated Leave | Immediate (no tenure check in code) | None | Aligned: leaveTypePolicy.js and GET /api/leaves/allowed-types both return same list. |
| **Probation** | Loss of Pay, Compensatory | Immediate | Casual/Sick/Planned/Backdated blocked with message: "only LOP allowed... available after confirmation." | Aligned. |
| **Intern** | Loss of Pay, Compensatory | Immediate | Same as Probation | Aligned. |
| **Other/unknown** | Loss of Pay only | — | Backend getAllowedLeaveTypes default: `['Loss of Pay']`; frontend fallback: `['Loss of Pay']`. | Aligned. |

- **Backdated dates:** For Probation/Intern, backdated leave must be LOP (handleBackdatedLeave); for Permanent, backdated Casual/Sick allowed.
- **Year-End:** Only Permanent; checked in year-end-request and year-end-feature-status.

---

## 4. Frontend Enforcement Findings

| Aspect | Finding |
|--------|---------|
| **Leave type visibility** | Driven by `getAllowedLeaveTypes(employmentStatus)` from leaveTypePolicy.js; only allowed types shown in dropdown. Matches backend GET /api/leaves/allowed-types. |
| **Disabled vs hidden** | Restricted types are not in the list (effectively hidden). No disabled-but-visible leave types. |
| **Form validation** | Reason required (min 100 chars), start date required, Sick: medical certificate required, Compensatory: alternate date and date-order rules. No client-side Friday/Monday or advance-notice checks — intentionally delegated to backend (leaveRules.js: "FRONTEND MUST NOT ENFORCE LOGIC"). |
| **Error messages** | Errors come from backend (check-eligibility and request); frontend shows API error. Category error: "Selected leave type is not available for your employment status" when selection not in allowed list. |
| **Date picker** | Comp-Off: leave date and worked date with shouldDisableLeaveDateCompOff / shouldDisableWorkedDateCompOff (Sunday, holidays, past disabled for leave date; worked date: weekend only, current month). No IST-specific picker; dates sent as YYYY-MM-DD in payload (toDateKey). |
| **Backdated leave UI** | "Backdated Leave" is a selectable type for Permanent; description says "Applied for past dates." No extra date restriction in UI for backdated; backend enforces past-date rules. |
| **Check before submit** | Optional use of POST /api/leaves/check-eligibility; POST /api/leaves/request runs full LeavePolicyService.validateApply — same validation on submit. |

---

## 5. Backend Enforcement Findings

| Check | When | Where | Notes |
|-------|------|--------|-------|
| Overlap | Apply, admin create/update | LeavePolicyService.checkNoOverlappingLeaves (in validateRequest) | Excludes existing Pending/Approved; excludeRequestId for updates. |
| Employee type | Apply, admin | validateEmployeeType in validateRequest | Blocks Casual/Sick/Planned/Backdated for non-Permanent. |
| Backdated dates | Apply | handleBackdatedLeave | Permanent: backdated Casual/Sick allowed; Probation/Intern: must be LOP. |
| Type-specific | Apply | validateLeaveTypeSpecific | Casual: ≥4 days notice; Planned: 30/60 days by working days; Sick: allowed; Compensatory: validateCompensatoryLeave; LOP: allowed. |
| Monthly request cap | Apply | validateMonthlyCapsIntelligent | 4 requests per month (all types except Comp-Off); Comp-Off: 2/month in validateCompensatoryLeave. |
| Monthly working days | Apply | validateMonthlyCapsIntelligent | 5 working days/month; Planned exempt; LOP and others count. |
| Weekday | Apply | validateWeekdayRestrictionsIntelligent | Fri/Mon always blocked (except admin override); Tue/Thu blocked if &lt;10 days notice; LOP and Comp-Off exempt. |
| Admin override | Apply / admin | validateRequest | Can bypass weekday only; cannot bypass monthly caps; overlap never bypassed. |
| Balance at apply | Apply | LeavePolicyService.checkLeaveBalance in validateApply | For Sick, Planned, Casual; LOP/Compensatory/Backdated Leave skip. |
| Balance at approval | PATCH status | LeavePolicyService.validateApproval + findOneAndUpdate(condition: balance >= duration) | Prevents approval when balance insufficient; atomic $inc avoids double deduction. |
| Sick certificate | Apply | validateApply | Mandatory for requestType === 'Sick'. |
| Comp-Off alternate date | Apply | validateCompensatoryLeave + routes require alternateDate | Required for Compensatory. |
| Re-validation on status change | PATCH status | validateRequest and validateApproval run again on approve | Policy and balance re-checked at approval. |
| Double-submit / race | Approval | Transaction + atomic User.findOneAndUpdate with balance >= duration | Prevents double deduction; idempotent for already-approved. |

**Edge cases:** Zero balance: approval fails (validateApproval / atomic update). Overlap: rejected at apply. Holidays: used in working-days count and Comp-Off; Planned leave working-days count has TODO (holidays not excluded). Weekends: Sunday and non-working Saturdays excluded in countWorkingDays (alternateSaturdayPolicy).

---

## 6. Approval Workflow Findings

| Rule | Implementation |
|------|-----------------|
| **Auto-approval** | None. All requests go to Pending; admin/HR approve or reject. |
| **Manual approval** | PATCH /api/admin/leaves/:id/status with status: Approved | Rejected. |
| **Role-based approver** | Route protected by isAdminOrHr; no separate "approver" role or delegation. |
| **Policy revalidation on approval** | Yes: validateApproval (balance) and validateRequest (full policy) run before approving; admin override can bypass weekday only. |
| **Rejection and rollback** | On reject: no balance change. If status changes from Approved to Rejected: balance restored ($inc positive), syncAttendanceOnLeaveRejection reverts attendance. |
| **Idempotent approve** | If already Approved, PATCH returns success without re-deducting. |
| **YEAR_END** | Blocked from PATCH status; must use Year-End specific endpoint. |

---

## 7. Data Consistency & Sync Issues

| Topic | Finding |
|-------|---------|
| **Balance calculation source** | Single source: User.leaveBalances. Deductions on approval (POST admin leave with status Approved, PATCH status to Approved, PUT when changing type/duration of approved leave); restorations on reject/delete of approved leave. |
| **Cached vs live** | Dashboard and pending-leaves caches invalidated on leave create/update/delete and status change (cacheService.invalidatePendingLeaves, invalidateDashboard, invalidateLeaveAnalytics). Balances read from DB on each request (no balance cache in audit). |
| **Leave vs attendance sync** | leaveAttendanceSyncService: syncAttendanceOnLeaveApproval creates/updates AttendanceLog to "Leave" for each leave date; syncAttendanceOnLeaveRejection reverts to Absent or recalculates from clock-in. Sync runs inside same transaction as status update. |
| **Policy drift** | Policy is in code (LeavePolicyService); no versioned policy in DB. Changes require deployment. Entitlements/balances in User can be edited by admin (allocate); no automatic reconciliation with past approvals. |

---

## 8. High-Risk Gaps & Exploitable Loopholes

| Risk | Description | Severity |
|------|-------------|----------|
| **Backdated Leave never deducts balance** | requestType stored as 'Backdated Leave' has getBalanceField null; no deduction on approval. Permanent can select "Backdated Leave" and get approved leave without consuming Casual/Sick. | High |
| **clockInConflicts undefined** | In PATCH /api/admin/leaves/:id/status, response uses clockInConflicts.length but variable is never declared or assigned. Can cause ReferenceError at runtime when building response. | Medium |
| **Planned leave working days without holidays** | countWorkingDaysForPlannedLeave does not exclude holidays (TODO in code). Advance-notice requirement (30/60 days) may be wrong for spans that include holidays. | Medium |
| **Duplicate enum value** | LeaveRequest.requestType enum includes both 'Compensatory' and 'Comp-Off'. All code uses 'Compensatory'; 'Comp-Off' is redundant and could cause confusion or inconsistent storage. | Low |
| **No accrual/carry-forward automation** | Balances and carry forward depend on admin allocation and Year-End flow. No automatic grant by tenure or calendar; previous-year-balances / carryforward-decision APIs absent (dashboard shows hasPendingDecision: false). | Design / product |
| **Reason length** | Frontend enforces min 100 characters; backend does not enforce min/max. Slight UX/consistency gap. | Low |

---

## 9. Recommendations (Design-Level Only)

1. **Backdated Leave and balance:** Define whether "Backdated Leave" is a separate leave type or a flow. If it consumes Casual/Sick, either (a) map Backdated Leave to a balance field and deduct (e.g. by sub-type or first date), or (b) require the user to choose Casual/Sick for backdated dates and avoid storing requestType as 'Backdated Leave'. Align getBalanceField and approval deduction with that decision.
2. **clockInConflicts:** Either remove the warning block from PATCH status or have syncAttendanceOnLeaveApproval return dates where clock-in existed and assign that to clockInConflicts so the response is correct and safe.
3. **Planned leave working days:** Implement holiday exclusion in countWorkingDaysForPlannedLeave (e.g. pass holidays for the date range and skip holiday dates) so advance-notice rules match policy.
4. **LeaveRequest.requestType enum:** Use a single value for compensatory leave (e.g. 'Compensatory') and remove 'Comp-Off' from the enum to avoid dual storage and confusion.
5. **Single policy service:** Keep LeavePolicyService as the only policy source; treat AntiExploitationLeaveService as deprecated and avoid adding new callers; consider removing it once no callers remain.
6. **Accrual and carry forward:** If product requires automatic accrual or self-service carry-forward, define rules (e.g. annual grant date, carry-forward cap, expiry) and add APIs and jobs; otherwise document that allocation and Year-End are the only mechanisms.
7. **Validation parity:** Keep validation server-side only; optionally add backend max length for reason and document it so frontend can align (e.g. 500 chars).
8. **Admin override:** Already cannot bypass overlap or monthly caps; keep that. Ensure all admin paths (POST/PUT leave, PATCH status) use LeavePolicyService and validateApproval where approval or balance change is involved.

---

**End of report.**
