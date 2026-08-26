# Technical Design — Pay Run Feature Parity

## Overview

This document describes the technical implementation of the ten-phase Pay Run Feature Parity
upgrade across the `salary-service` backend (Node.js/Express/MongoDB, port 3012) and the
`salary-service-frontend` (React 18 / MUI 7 / Tailwind 4 / Vite).

The existing lifecycle `draft → finalized → paid` is preserved and extended with a parallel
`approvalStatus` field. No existing documents are migrated — the orthogonal approach means all
existing `PayrollRun` documents remain valid (their `approvalStatus` defaults to `none`,
`payRunType` defaults to `regular`, and all new SalarySlip sub-documents default to non-withheld,
non-skipped, and payment-pending). Mongoose's `default` values ensure backwards compatibility.

---

## Architecture

```
salary-service-frontend/                  salary-service/
src/pages/
  PayrollRunDetailPage.jsx  ←──REST──►  routes/payrollRuns.js
  PayrollRunsPage.jsx                    routes/salarySlips.js
src/components/ (new)                   controllers/
  EmployeeSummaryTab.jsx                  payrollRunController.js  (extended)
  TaxesDeductionsTab.jsx                  salarySlipController.js  (extended)
  CommentsPanel.jsx                     services/
  ApprovalToolbar.jsx                     payrollRunService.js     (extended)
  SlipActionDialogs.jsx                   payrollCompute.js        (extended)
  ArrearsReviewPanel.jsx                  slipAdjustmentService.js (new)
  CsvImportExport.jsx                     csvImportService.js      (new)
                                          notificationService.js   (new stub)
                                        models/
                                          PayrollRun.js            (extended)
                                          SalarySlip.js            (extended)
                                          AuditLog.js              (extended)
```

---

## Phase 1 — Data Model Extensions

### 1.1 PayrollRun model changes

File: `salary-service/models/PayrollRun.js`

Add to `payrollRunSchema` — all new fields have safe defaults so existing documents remain valid:

```js
// Run type
payRunType: {
  type: String,
  enum: ['regular', 'offCycle', 'resettlement'],
  default: 'regular',
},

// Approval workflow — orthogonal to status field; does not replace it
approvalStatus: {
  type: String,
  enum: ['none', 'submitted', 'approved', 'rejected'],
  default: 'none',
},
submittedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
submittedAt:    { type: Date },
approvedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
approvedAt:     { type: Date },
rejectedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
rejectedAt:     { type: Date },
rejectionReason:{ type: String, trim: true },

// Scheduled payment date (informational, not enforced by the system)
payDate: { type: Date },

// Append-only run-level comments
comments: [{
  authorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorEmail: { type: String, required: true, trim: true },
  text:        { type: String, required: true, trim: true, maxlength: 2000 },
  createdAt:   { type: Date, default: Date.now },
}],
```

**Unique index change**: The existing `{ month: 1, year: 1 }` unique index must be scoped to
`regular` runs only. MongoDB partial indexes achieve this:

```js
// Remove old index:
// payrollRunSchema.index({ month: 1, year: 1 }, { unique: true });

// Add partial unique index — only enforces uniqueness for regular runs
payrollRunSchema.index(
  { month: 1, year: 1 },
  {
    unique: true,
    partialFilterExpression: { payRunType: 'regular' },
    name: 'unique_regular_run_per_month',
  }
);
```

> **Migration note**: existing documents have `payRunType: undefined`. MongoDB partial index with
> `partialFilterExpression: { payRunType: 'regular' }` only applies to documents where
> `payRunType` equals `'regular'`. Documents without the field are not covered by the index and
> cannot conflict. A background migration script (Phase 10) sets `payRunType: 'regular'` on all
> existing documents so they get index coverage going forward.

### 1.2 SalarySlip model changes

File: `salary-service/models/SalarySlip.js`

Add to `salarySlipSchema`:

```js
// Withhold — admin hold preventing this slip from being paid
withheld: {
  isWithheld:      { type: Boolean, default: false },
  reason:          { type: String, trim: true },
  withheldBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  withheldAt:      { type: Date },
  releasedInRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun' },
},

// Skip — removes employee from this run's totals entirely
skipped: { type: Boolean, default: false },

// Arrears — confirmed new-joinee arrears entries (never auto-applied)
arrears: [{
  amount:      { type: Number, required: true },
  reason:      { type: String, trim: true },
  sourceRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun' },
  addedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt:     { type: Date, default: Date.now },
}],

// LOP adjustments — additive log; payrollCompute sums these, never overwrites base
lopAdjustments: [{
  days:      { type: Number, required: true },
  reason:    { type: String, trim: true },
  type:      { type: String, enum: ['reversal', 'manual_addition'], required: true },
  sourceRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun' }, // for reversal traceability
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appliedAt: { type: Date, default: Date.now },
}],

// One-time earnings/deductions — additive log
oneTimeEntries: [{
  label:   { type: String, required: true, trim: true, maxlength: 200 },
  amount:  { type: Number, required: true },
  kind:    { type: String, enum: ['earning', 'deduction'], required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now },
}],

// Per-slip payment tracking (independent of run-level status)
paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
paidAt:        { type: Date },
paidBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
paymentMode:   { type: String, enum: ['bankTransfer', 'cheque', 'cash'] },

// Pending arrears suggestion (from Phase 8 new-joinee detection)
// Not confirmed — admin must explicitly approve before it writes to arrears[]
pendingArrearsSuggestion: {
  amount:     { type: Number },
  reason:     { type: String },
  computedAt: { type: Date },
  dismissed:  { type: Boolean, default: false },
},
```

### 1.3 AuditLog action types

File: `salary-service/models/AuditLog.js`

Append to the `ACTIONS` array:

```js
// Phase 1 — Pay run approval workflow
'PAYRUN_SUBMITTED_FOR_APPROVAL',
'PAYRUN_APPROVED',
'PAYRUN_REJECTED',
'PAYRUN_COMMENT_ADDED',
// Phase 1/2 — Per-slip actions
'SLIP_WITHHELD',
'SLIP_RELEASED',
'SLIP_SKIPPED',
'SLIP_LOP_ADJUSTED',
'SLIP_ARREARS_ADDED',
'SLIP_MARKED_PAID_INDIVIDUAL',
```

### 1.4 payrollCompute.js — additive adjustments

File: `salary-service/services/payrollCompute.js`

The function signature gains two optional array parameters. Both default to `[]` so all existing
call sites continue to work without changes:

```js
function computeSalarySlip({
  financialProfile,
  settings,
  attendanceData,
  bonus = 0,
  lopAdjustments = [],   // NEW — array of { days, type } entries from SalarySlip
  oneTimeEntries = [],   // NEW — array of { amount, kind } entries from SalarySlip
}) {
  // ... existing Steps 1–5 unchanged ...

  // Step 5b — apply lopAdjustments additively
  // reversals: add days back (positive); manual_additions: add more LOP (negative)
  const lopAdjDelta = lopAdjustments.reduce((acc, adj) => {
    return acc + (adj.type === 'reversal' ? -adj.days : adj.days);
  }, 0);
  // Effective LOP days (clamped at 0 — cannot go negative)
  const effectiveLopDays = Math.max(0, lopDays + lopAdjDelta);
  // Recompute lopDeduction with adjusted days
  const lopDeductionAdjusted = round2(effectiveLopDays * lopDailyRate);

  // Step 5c — apply oneTimeEntries additively
  const oneTimeEarnings   = oneTimeEntries
    .filter(e => e.kind === 'earning')
    .reduce((s, e) => s + e.amount, 0);
  const oneTimeDeductions = oneTimeEntries
    .filter(e => e.kind === 'deduction')
    .reduce((s, e) => s + e.amount, 0);

  // Recompute grossPay with adjusted LOP and one-time earnings
  const grossPay = round2(
    grossBeforeLOP
    - lopDeductionAdjusted
    - halfDayDeduction
    + overtimePay
    + (bonus || 0)
    + oneTimeEarnings
  );

  // ... recompute pf, esi, tds on new grossPay ...
  // totalDeductions includes oneTimeDeductions
  const totalDeductions = round2(pf + esi + tds + profTax + lopDeductionAdjusted + halfDayDeduction + oneTimeDeductions);
  const netPay = round2(grossPay - pf - esi - tds - profTax - oneTimeDeductions);

  return {
    // ... existing fields ...
    deductions: {
      pf, esi,
      professionalTax: profTax,
      tds,
      lopDeduction: round2(lopDeductionAdjusted + halfDayDeduction),
      other: round2(oneTimeDeductions),
    },
    totalDeductions,
    netPay,
    // Expose computed adjustment deltas for auditability
    _lopAdjDelta: lopAdjDelta,
    _oneTimeEarnings: round2(oneTimeEarnings),
    _oneTimeDeductions: round2(oneTimeDeductions),
  };
}
```

---

## Phase 2 — Employee Summary Tab

### 2.1 New backend endpoints

All new endpoints go in `salary-service/routes/payrollRuns.js` and their handlers in
`salary-service/controllers/payrollRunController.js`, delegating heavy logic to
`salary-service/services/slipAdjustmentService.js` (new file).

| Method | Path | Middleware | Description |
|--------|------|------------|-------------|
| `PATCH` | `/api/payroll-runs/:id/slips/:slipId/lop` | `authenticate, requireAdmin` | Add LOP adjustment |
| `PATCH` | `/api/payroll-runs/:id/slips/:slipId/one-time` | `authenticate, requireAdmin` | Add one-time entry |
| `PATCH` | `/api/payroll-runs/:id/slips/:slipId/withhold` | `authenticate, requireAdmin` | Withhold slip |
| `PATCH` | `/api/payroll-runs/:id/slips/:slipId/release` | `authenticate, requireAdmin` | Release withheld slip |
| `PATCH` | `/api/payroll-runs/:id/slips/:slipId/skip` | `authenticate, requireAdmin` | Skip slip |
| `GET`   | `/api/payroll-runs/:id/slips/:slipId/tds-sheet` | `authenticate, payrollAccess` | TDS breakdown |
| `PATCH` | `/api/payroll-runs/:id/slips/:slipId/reverse-lop` | `authenticate, requireAdmin` | Reverse LOP |

All mutation endpoints must:
1. Load the run and verify `status === 'draft'` — return 409 if not.
2. Load the slip and verify it belongs to the run — return 404 if not.
3. Apply the change.
4. Re-run `computeSalarySlip` with the updated `lopAdjustments` and `oneTimeEntries` and save
   updated computed fields (`grossPay`, `netPay`, `deductions`, `totalDeductions`) back to the
   slip — this is the "live recompute" requirement.
5. Write the corresponding audit event.
6. Update `PayrollRun.totalNet` and `PayrollRun.totalGross` to reflect the recalculated slip.

**Guard helper** (shared across all mutation handlers):

```js
// services/slipAdjustmentService.js
async function guardDraftSlip(runId, slipId) {
  const run = await PayrollRun.findById(runId);
  if (!run) throw Object.assign(new Error('Run not found'), { status: 404 });
  if (run.status !== 'draft') throw Object.assign(
    new Error(`Cannot modify a ${run.status} run`), { status: 409 }
  );
  const slip = await SalarySlip.findOne({ _id: slipId, payrollRunId: run._id });
  if (!slip) throw Object.assign(new Error('Slip not found in this run'), { status: 404 });
  return { run, slip };
}
```

**recomputeAndSaveSlip** (shared helper — single code path for both per-row dialogs and bulk CSV):

```js
// services/slipAdjustmentService.js
async function recomputeAndSaveSlip(slip, settings, profile) {
  const computed = computeSalarySlip({
    financialProfile: profile,
    settings,
    attendanceData:   slip.attendanceData,
    bonus:            slip.bonus,
    lopAdjustments:   slip.lopAdjustments,
    oneTimeEntries:   slip.oneTimeEntries,
  });
  Object.assign(slip, computed);
  await slip.save();
  return slip;
}
```

### 2.2 TDS sheet endpoint

`GET /api/payroll-runs/:id/slips/:slipId/tds-sheet` returns a read-only breakdown:

```json
{
  "employeeId": "EMP001",
  "employeeName": "Jane Doe",
  "grossPay": 85000,
  "tdsRate": 2.5,
  "tdsAmount": 2125,
  "deductions": { "pf": 1800, "esi": 0, "professionalTax": 200, "tds": 2125 }
}
```

### 2.3 Frontend — EmployeeSummaryTab component

File: `salary-service-frontend/src/components/EmployeeSummaryTab.jsx`

Key design decisions matching the existing codebase:
- Uses MUI `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell` — same as existing slip table.
- `MoreVert` from `@mui/icons-material` (MUI equivalent of lucide `MoreVertical`) for the overflow
  menu, opening a `Menu` component.
- Overflow menu items are conditionally rendered based on slip state and run status.
- `Checkbox` column for row-select; toolbar "Mark as Paid" button appears when `selectedIds.size > 0`.
- All currency cells use `className="currency"` for tabular-nums alignment.
- Status chips reuse the existing `StatusChip` pattern.
- Skipped rows shown in muted grey (`color: 'var(--ink-muted)'`); withheld rows show an amber chip.

**Overflow menu item visibility rules**:

| Action | Condition to show |
|--------|-------------------|
| Add LOP | `run.status === 'draft'` |
| Add Earnings/Deductions | `run.status === 'draft'` |
| Withhold Salary | `run.status === 'draft' && !slip.withheld?.isWithheld` |
| Release Withheld Salary | `run.status === 'draft' && slip.withheld?.isWithheld === true` |
| Skip from Payroll | `run.status === 'draft' && !slip.skipped` |
| View TDS Sheet | always |
| Reverse LOP | `run.status === 'draft' && (slip.attendanceData?.lopDays > 0 || slip.lopAdjustments?.some(a => a.type === 'manual_addition'))` |

**Dialogs** (in `salary-service-frontend/src/components/SlipActionDialogs.jsx`):
- `AddLopDialog` — number input for days + text input for reason.
- `AddOneTimeEntryDialog` — label text, amount number, earning/deduction toggle (MUI `ToggleButtonGroup`).
- `WithholdDialog` — required reason text.
- `ReverseLopDialog` — days number, reason text.
- All dialogs share a common `ActionDialog` wrapper that handles loading/error state.

---

## Phase 3 — Taxes and Deductions Tab

### 3.1 No new backend endpoints needed

Data comes from the existing `GET /api/payroll-runs/:id` response which already returns all slips.
The tab computes its aggregates client-side from `slips` array.

### 3.2 Frontend — TaxesDeductionsTab component

File: `salary-service-frontend/src/components/TaxesDeductionsTab.jsx`

Aggregate cards — four `Box` components matching the existing "Gross Pay" / "Net Pay" banner style:
- Total PF: sum of `slip.deductions.pf` for non-skipped slips
- Total ESI: sum of `slip.deductions.esi`
- Total PT: sum of `slip.deductions.professionalTax`
- Total TDS: sum of `slip.deductions.tds`

Per-employee breakdown table: columns Employee, PF, ESI, PT, TDS, LOP Deduction, Net Pay.
All amounts use `className="currency"`. Skipped slips are excluded (not rendered).

---

## Phase 4 — Bulk CSV Import/Export

### 4.1 Backend — new endpoints

Add to `salary-service/routes/payrollRuns.js`:

| Method | Path | Middleware | Description |
|--------|------|------------|-------------|
| `POST` | `/api/payroll-runs/:id/import/lop` | `authenticate, requireAdmin, uploadPayrollDoc` | Import LOP CSV |
| `POST` | `/api/payroll-runs/:id/import/one-time` | `authenticate, requireAdmin, uploadPayrollDoc` | Import one-time entries CSV |
| `GET`  | `/api/payroll-runs/:id/export/employee-summary` | `authenticate, payrollAccess` | Export CSV |

**csvImportService.js** (new file, `salary-service/services/csvImportService.js`):

```js
// Shared validation: build a Set of employeeIds present in the run
async function validateEmployeeIds(runId, rows) {
  const slips = await SalarySlip.find({ payrollRunId: runId }).select('employeeId');
  const validIds = new Set(slips.map(s => s.employeeId));
  const errors = [];
  rows.forEach((row, i) => {
    if (!validIds.has(row.employeeId)) {
      errors.push({ row: i + 2, employeeId: row.employeeId, error: 'Employee not in this run' });
    }
  });
  return { validIds, errors };
}

// Whole-import-rejection: if errors.length > 0, throw and return error list
// Never partially apply
```

CSV parsing uses the built-in string split on newlines — no new dependency required.
For production robustness the design uses the existing `multer` setup via `uploadPayrollDoc`
middleware to handle the multipart upload.

**Shared logic guarantee**: Both the import service and the per-row dialog endpoints call
`slipAdjustmentService.applyLopAdjustment(slip, { days, reason, type, actorId })` — the same
function. No duplicated LOP logic.

**Export** — streams a CSV response directly without writing to disk:

```js
res.setHeader('Content-Type', 'text/csv');
res.setHeader('Content-Disposition', `attachment; filename="payroll-${run.year}-${run.month}-summary.csv"`);
// Write header row then stream slip rows
```

### 4.2 Frontend — CsvImportExport component

File: `salary-service-frontend/src/components/CsvImportExport.jsx`

A `Button` with `startIcon={<UploadFile />}` opens a `Menu` with three items:
- "Import LOP Details" — opens file picker (`<input type="file" accept=".csv">`)
- "Import Earnings/Deductions" — same
- "Export Employee Summary" — triggers GET download

Import menu items are disabled when `run.status !== 'draft'`.
On import error from the API, the component shows a dialog listing per-row errors.

---

## Phase 5 — Approval Workflow

### 5.1 Backend — new endpoints

Add to `salary-service/routes/payrollRuns.js`:

| Method | Path | Middleware | Description |
|--------|------|------------|-------------|
| `POST` | `/api/payroll-runs/:id/submit` | `authenticate, payrollAccess` | Submit for approval |
| `POST` | `/api/payroll-runs/:id/approve` | `authenticate, requireAdmin` | Approve run |
| `POST` | `/api/payroll-runs/:id/reject` | `authenticate, requireAdmin` | Reject run |

**submit** handler:
- Requires `run.status === 'draft'` and at least one SalarySlip for the run.
- If `req.user.role === 'Admin'`, sets `approvalStatus: 'approved'` directly (combined action).
- Otherwise sets `approvalStatus: 'submitted'`.
- Fires `PAYRUN_SUBMITTED_FOR_APPROVAL` audit event (or `PAYRUN_APPROVED` for the combined path).

**approve** handler:
- Requires `run.approvalStatus === 'submitted'` OR `run.approvalStatus === 'approved'` (Final
  Approve override).
- Sets `approvalStatus: 'approved'`, `approvedBy`, `approvedAt`.
- Fires `PAYRUN_APPROVED`.

**reject** handler:
- Requires non-empty `rejectionReason` in request body.
- Sets `approvalStatus: 'rejected'`, `rejectedBy`, `rejectedAt`, `rejectionReason`.
- Fires `PAYRUN_REJECTED`.

**finalize handler update** (existing):
```js
// Add this guard before existing status check:
if (run.approvalStatus !== 'approved') {
  return res.status(422).json({
    error: 'This run must be approved before it can be finalized. Current approval status: ' + run.approvalStatus,
  });
}
```

### 5.2 Frontend — ApprovalToolbar component

File: `salary-service-frontend/src/components/ApprovalToolbar.jsx`

Renders in the header area of `PayrollRunDetailPage`, below the existing action buttons.

Conditional rendering:

| Run state | User role | Shows |
|-----------|-----------|-------|
| draft, slips generated | Admin | "Submit & Approve" (single button, combined action) |
| draft, slips generated | PayrollOfficer | "Submit for Approval" button |
| submitted | Admin | "Approve" + "Reject" buttons |
| approved | Admin | "Final Approve" button (override) |
| rejected | any | Amber rejection banner with reason + "Resubmit" button |

The "Finalize" button is updated to be visually disabled (not just conditionally hidden) when
`approvalStatus !== 'approved'`, with a tooltip: "Approval required before finalizing".

---

## Phase 6 — Payment Recording

### 6.1 Backend — extended mark-paid (whole run)

`POST /api/payroll-runs/:id/mark-paid` — extended to accept:

```json
{ "paymentMode": "bankTransfer", "payDate": "2026-08-05", "notifyEmployee": false }
```

Now sets `paymentStatus: 'paid'`, `paidAt`, `paidBy`, `paymentMode` on all slips where
`withheld.isWithheld !== true` and `skipped !== true`.

### 6.2 Backend — new per-slip mark-paid

`POST /api/payroll-runs/:id/slips/:slipId/mark-paid` — new endpoint:

```json
{ "paymentMode": "bankTransfer", "paidAt": "2026-08-05", "notifyEmployee": false }
```

After saving the slip, computes whether all eligible slips (non-withheld, non-skipped) in the run
are now paid:

```js
const eligibleSlips = await SalarySlip.find({
  payrollRunId: runId,
  'withheld.isWithheld': { $ne: true },
  skipped: { $ne: true },
});
const allPaid = eligibleSlips.every(s => s.paymentStatus === 'paid');
if (allPaid) {
  await PayrollRun.updateOne({ _id: runId }, { $set: { status: 'paid', paidBy: actorId, paidAt: new Date() } });
}
```

**EMAIL_NOTIFICATIONS_ENABLED** flag:

```js
// services/notificationService.js
const EMAIL_ENABLED = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';

async function sendPayslipNotification({ slip, run }) {
  if (!EMAIL_ENABLED) {
    // Write an explicit audit note — do not silently skip
    await audit({
      action: 'SLIP_MARKED_PAID_INDIVIDUAL',
      subject: slip.employeeId,
      details: {
        runId: run._id,
        paymentMode: slip.paymentMode,
        notificationRequested: true,
        notificationSent: false,
        notificationSkipReason: 'EMAIL_NOTIFICATIONS_ENABLED is not set to true',
      },
    });
    return;
  }
  // TODO: implement SMTP send when EMAIL_NOTIFICATIONS_ENABLED=true
}
```

---

## Phase 7 — Comments / Notes

### 7.1 Backend — new endpoint

`POST /api/payroll-runs/:id/comments` — authenticated, `payrollAccess`:

```json
{ "text": "Confirmed with Finance — run approved for disbursement." }
```

Appends to `PayrollRun.comments` array, fires `PAYRUN_COMMENT_ADDED` audit event.

### 7.2 Frontend — CommentsPanel component

File: `salary-service-frontend/src/components/CommentsPanel.jsx`

A slide-in `Drawer` (MUI, anchor="right", width 360px) toggled by a "Comments" `Button` in the
top-right of `PayrollRunDetailPage` header (matching Zoho's placement functionally, using
Byline's design language — `var(--brand-red)` outline button with `ChatBubbleOutline` icon from
`@mui/icons-material`).

Contents:
- Scrollable list of comments, chronological, each showing `authorEmail`, `text`, formatted
  `createdAt` (using `toLocaleDateString('en-IN')` consistent with existing dates).
- Text area (`TextField multiline`) + "Add Note" button at the bottom.
- No edit/delete controls — append-only. Empty state: "No notes yet."

The `PayrollRunDetailPage` loads comments as part of the existing `GET /api/payroll-runs/:id`
response (since `comments` is now on the PayrollRun document). No separate fetch needed.

---

## Phase 8 — New Joinee Arrears

### 8.1 Backend — detection during generate

`generatePayrollRun` in `payrollRunService.js` gains a post-generation step:

```js
// After slip is saved, check for new-joinee arrears suggestion
if (attendanceData.joiningDate) {
  const joining = new Date(attendanceData.joiningDate);
  const periodStart = new Date(run.year, run.month - 1, 1);
  const periodEnd   = new Date(run.year, run.month, 0); // last day of month
  if (joining > periodStart && joining <= periodEnd) {
    const totalDays   = periodEnd.getDate();
    const daysWorked  = totalDays - joining.getDate() + 1;
    const monthlyGross = profile.useFixedSalary
      ? (profile.basicSalary + profile.hra + profile.allowances)
      : (profile.ctc / 12);
    const arrearAmount = round2((daysWorked / totalDays) * monthlyGross);
    
    await SalarySlip.updateOne({ _id: slip._id }, {
      $set: {
        pendingArrearsSuggestion: {
          amount:     arrearAmount,
          reason:     `New joinee prorated arrears (${daysWorked} of ${totalDays} days)`,
          computedAt: new Date(),
          dismissed:  false,
        },
      },
    });
  }
}
```

### 8.2 Backend — new endpoints

| Method | Path | Middleware | Description |
|--------|------|------------|-------------|
| `POST` | `/api/payroll-runs/:id/slips/:slipId/confirm-arrears` | `authenticate, requireAdmin` | Confirm arrears suggestion |
| `POST` | `/api/payroll-runs/:id/slips/:slipId/dismiss-arrears` | `authenticate, requireAdmin` | Dismiss suggestion |

**confirm-arrears** handler moves `pendingArrearsSuggestion` into `arrears[]` and clears the
suggestion field. Fires `SLIP_ARREARS_ADDED`.

### 8.3 Frontend — ArrearsReviewPanel

The `EmployeeSummaryTab` highlights rows with `pendingArrearsSuggestion.dismissed === false` with
an amber `Chip` label "Arrears pending". Clicking reveals a small inline panel showing the
suggested amount, reason, and "Add to Slip" / "Dismiss" buttons.

---

## Phase 9 — LOP Reversal

### 9.1 Immutability enforcement

Existing `finalizeRun` sets `status: 'finalized'`. All mutation endpoints in Phase 2 already
include the `guardDraftSlip` check which rejects non-draft runs with HTTP 409. No additional
enforcement code required — the guard covers it.

### 9.2 Reversal flow

The `Reverse LOP` action in the overflow menu (Phase 2, draft runs only) calls:

`PATCH /api/payroll-runs/:id/slips/:slipId/reverse-lop`

Body: `{ "days": 2, "reason": "Incorrect AMS attendance entry for 3rd Aug" }`

For a draft run, this appends `{ type: 'reversal', days: -days, reason, appliedBy, appliedAt }`
to `slip.lopAdjustments` and triggers recompute.

For applying a reversal to the **next run** after a finalized run, the UI provides an
"Apply to Next Run" button in the finalized run's view. This calls a dedicated endpoint:

`POST /api/payroll-runs/:id/slips/:slipId/apply-reversal-to-next-run`

Body: `{ "days": 2, "reason": "Correction for Aug run (ref: [originalRunId])", "nextRunId": "..." }`

This endpoint:
1. Verifies the source run is finalized.
2. Verifies `nextRunId` is a draft run.
3. Appends a `lopAdjustments` entry of `type: 'manual_addition'` (positive earnings adjustment)
   on the matching slip in the next run, with `sourceRunId` set to the original run's `_id`.
4. Fires `SLIP_LOP_ADJUSTED` audit event on the next run's slip.

UI copy on the action: _"Corrections to finalized runs are applied to the employee's next pay run.
This will not change the paid slip or its PDF."_

---

## Phase 10 — Off-cycle and Resettlement Run Types

### 10.1 Backend — createPayrollRun extension

`payrollRunService.createPayrollRun` gains optional parameters:

```js
async function createPayrollRun({
  month, year, notes,
  payRunType = 'regular',  // NEW
  employeeIds = null,       // NEW — for offCycle runs
  actorId, actorEmail, source,
})
```

For `regular` runs: existing logic unchanged (unique index enforces one per month/year).

For `offCycle` runs:
- `employeeIds` is required and must not be empty.
- Skips the duplicate-run check (partial index doesn't cover these).
- `generatePayrollRun` only processes profiles whose `employeeId` is in `employeeIds`.

For `resettlement` runs:
- `employeeIds` is required.
- Before creation, fetch each employee from AMS `/internal/employees` and validate their
  `employmentStatus` is not `'active'`. Return 422 with a list of invalid IDs if any are active.
- `generatePayrollRun` uses `oneTimeEntries` only — skips the AMS attendance fetch entirely.
  Slips are created with all attendance fields set to 0 and `attendanceData` zeroed.

### 10.2 Backend — create endpoint changes

`POST /api/payroll-runs` now accepts:

```json
{
  "month": 8,
  "year": 2026,
  "payRunType": "offCycle",
  "employeeIds": ["EMP001", "EMP005"],
  "notes": "Q2 performance bonus"
}
```

### 10.3 Frontend — PayrollRunsPage "New Run" menu

The "New Run" button becomes a `Button` that opens a `Menu` with three items:
- Regular Payroll
- Off-Cycle Payroll
- Resettlement Payroll

Each opens a variant of the create dialog:
- **Regular**: existing month/year/notes form.
- **Off-Cycle**: adds a multi-select employee picker (fetches from
  `GET /api/financial-profiles?isActive=true`) and a free-text notes field.
- **Resettlement**: adds a multi-select employee picker (fetches from AMS feed, filtered to
  inactive/terminated employees exposed via `/api/financial-profiles?isActive=false`).

---

## Frontend Component Map

All new components live in `salary-service-frontend/src/components/`:

| File | Phase | Purpose |
|------|-------|---------|
| `EmployeeSummaryTab.jsx` | 2 | Per-employee table with overflow menu |
| `SlipActionDialogs.jsx` | 2 | Add LOP / Add OTE / Withhold / Reverse LOP dialogs |
| `TaxesDeductionsTab.jsx` | 3 | Statutory aggregate cards + breakdown table |
| `CsvImportExport.jsx` | 4 | Import LOP/OTE, export summary |
| `ApprovalToolbar.jsx` | 5 | Submit / Approve / Reject toolbar |
| `CommentsPanel.jsx` | 7 | Slide-in comments drawer |
| `ArrearsReviewPanel.jsx` | 8 | New joinee arrears confirm/dismiss inline panel |

`PayrollRunDetailPage.jsx` is refactored to:
1. Replace the flat slip table with `<Tabs>` (MUI) containing `EmployeeSummaryTab` and
   `TaxesDeductionsTab`.
2. Add `ApprovalToolbar` below the existing action buttons.
3. Add the `CommentsPanel` drawer toggled by a button in the top-right header area.
4. Import `CsvImportExport` into the header area.

---

## API Summary — New Endpoints

All endpoints are prefixed `/api/payroll-runs/:id` unless noted.

| Method | Path suffix | Auth | Phase |
|--------|-------------|------|-------|
| PATCH | `/slips/:slipId/lop` | Admin | 2 |
| PATCH | `/slips/:slipId/one-time` | Admin | 2 |
| PATCH | `/slips/:slipId/withhold` | Admin | 2 |
| PATCH | `/slips/:slipId/release` | Admin | 2 |
| PATCH | `/slips/:slipId/skip` | Admin | 2 |
| GET | `/slips/:slipId/tds-sheet` | PayrollAccess | 2 |
| PATCH | `/slips/:slipId/reverse-lop` | Admin | 2, 9 |
| POST | `/slips/:slipId/mark-paid` | Admin | 6 |
| POST | `/slips/:slipId/confirm-arrears` | Admin | 8 |
| POST | `/slips/:slipId/dismiss-arrears` | Admin | 8 |
| POST | `/slips/:slipId/apply-reversal-to-next-run` | Admin | 9 |
| POST | `/import/lop` | Admin | 4 |
| POST | `/import/one-time` | Admin | 4 |
| GET | `/export/employee-summary` | PayrollAccess | 4 |
| POST | `/submit` | PayrollAccess | 5 |
| POST | `/approve` | Admin | 5 |
| POST | `/reject` | Admin | 5 |
| POST | `/comments` | PayrollAccess | 7 |

---

## Design Token Conventions

All new UI components follow these rules, consistent with the existing codebase:

- Currency: `className="currency"` — tabular-nums, `fontWeight: 600` or `700`.
- Status chips: reuse `StatusChip` pattern with `var(--radius-pill)`, `0.6875rem`, `fontWeight: 700`.
- New status chips for `approvalStatus`: `none` → grey, `submitted` → blue (`#1e40af`),
  `approved` → green (`var(--status-paid)`), `rejected` → red (`var(--brand-red)`).
- Card backgrounds: `var(--paper)`, border `1px solid var(--border)`, `var(--radius-card)`.
- Table heads: `backgroundColor: '#192a56'` (sidebar navy, per `theme.js`).
- Buttons: `var(--brand-red)` for primary, `#15803d` for pay/confirm, `var(--ink-secondary)` for cancel.
- Sidebar/topbar unchanged — no new nav items.
- `MoreVert` icon for overflow menu (MUI equivalent of lucide MoreVertical).

---

## Dependency Review

No new npm dependencies are required:
- CSV parsing: manual split on `\n` / `,` (sufficient for well-formed CSV; documents the
  assumption in code comments).
- File upload: existing `uploadPayrollDoc` multer middleware extended with `memStorage` option
  (stores in memory, not disk) for CSV imports — no new files to clean up.
- Email: `notificationService.js` is a stub; no nodemailer installed in this spec.

---

## Backwards Compatibility

| Concern | Mitigation |
|---------|------------|
| Existing PayrollRun documents | All new fields have `default` values; no migration needed for functionality. Phase 10 adds a background migration to set `payRunType: 'regular'` on existing documents for index coverage. |
| Existing SalarySlip documents | All new sub-documents (`withheld`, `lopAdjustments`, etc.) default to falsy/empty. `payrollCompute.js` defaults `lopAdjustments: []` and `oneTimeEntries: []`, so no change to existing computed slip values. |
| finalize endpoint | Now returns HTTP 422 (not 403) if `approvalStatus !== 'approved'`. Any existing automated calls that expected HTTP 409 for "wrong status" will see 422 for the approval gate. Document this change in the API changelog. |
| Existing unique index on (month, year) | Must be dropped and replaced with the partial unique index before deploying Phase 10. The index change requires a MongoDB index drop + re-create; this is safe as the operation is online in MongoDB 4.4+. |
