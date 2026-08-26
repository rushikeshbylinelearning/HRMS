# Requirements Document

## Introduction

The **Pay Run Feature Parity** feature extends the salary-service (Node.js/Express/MongoDB, port 3012)
and its React 18 / MUI 7 / Tailwind 4 frontend to reach full production-grade payroll capability
across ten phases. The existing lifecycle (`draft → finalized → paid`) is preserved and extended
with a parallel approval workflow, per-employee override actions, bulk CSV import/export, payment
recording, comments/notes, new-joinee arrears handling, LOP reversal, and additional pay run types.

All ten phases are delivered as a single coherent spec. Backend model changes underpin every phase;
the frontend target for interactive changes is `PayrollRunDetailPage.jsx`.

---

## Glossary

- **PayrollRun**: A MongoDB document representing one payroll processing cycle for a given month/year. Statuses: `draft`, `finalized`, `paid`.
- **SalarySlip**: A MongoDB document representing one computed salary slip for one employee within a PayrollRun.
- **approvalStatus**: An orthogonal field on PayrollRun (independent of `status`). Values: `none`, `submitted`, `approved`, `rejected`.
- **Admin**: A salary-service user with role `Admin`. Has full mutation access.
- **PayrollOfficer**: A salary-service user with role `PayrollOfficer`. Has read access; may submit for approval.
- **LOP**: Loss of Pay — days deducted from salary due to unpaid absence.
- **lopAdjustment**: An additive log entry on SalarySlip recording a LOP change (reversal or manual addition).
- **oneTimeEntry**: An additive log entry on SalarySlip for a non-recurring earning or deduction.
- **Arrears**: Additional pay owed to a new joiner for the portion of the month before their payroll profile was active.
- **Withhold**: An administrative hold preventing a specific SalarySlip from being included in payment processing.
- **Skip**: Marking a SalarySlip as excluded from a payroll run entirely.
- **payrollCompute.js**: The pure salary computation function in `services/payrollCompute.js` — no DB calls, fully deterministic.
- **AuditLog**: The MongoDB collection recording all security-sensitive and payroll-sensitive operations, currently containing 28 action types.
- **EMAIL_NOTIFICATIONS_ENABLED**: An environment variable flag (default `false`) that gates email dispatch.
- **Off-Cycle Run**: A PayrollRun of type `offCycle` — processes a manually selected subset of employees outside the regular monthly cycle.
- **Resettlement Run**: A PayrollRun of type `resettlement` — processes only terminated or inactive employees with manual earnings/deductions.
- **Regular Run**: A PayrollRun of type `regular` — the standard monthly full-workforce payroll.
- **payRunType**: A new enum field on PayrollRun distinguishing `regular`, `offCycle`, and `resettlement` runs.
- **Employee Summary Tab**: A tabbed panel in PayrollRunDetailPage replacing the current flat slip table, showing per-employee rows with overflow menus.
- **Taxes and Deductions Tab**: A tabbed panel in PayrollRunDetailPage showing aggregate statutory deduction cards and a per-employee breakdown.
- **Comments Panel**: An append-only notes sidebar in PayrollRunDetailPage for run-level commentary.
- **Record Payment**: The action of marking a run or individual slip as paid, capturing payment mode and date.
- **paymentMode**: The channel used to disburse salary: `bankTransfer`, `cheque`, or `cash`.

---

## Requirements

### Requirement 1 — Phase 1: Data Model Extensions

**User Story:** As an Admin, I want the PayrollRun and SalarySlip models to carry all fields
needed for approval workflow, per-employee overrides, payment tracking, and comments,
so that subsequent feature phases have a stable data foundation.

#### Acceptance Criteria

1. THE PayrollRun Model SHALL include a `payRunType` field with enum values `regular`, `offCycle`, and `resettlement`, defaulting to `regular`.

2. THE PayrollRun Model SHALL include an `approvalStatus` field with enum values `none`, `submitted`, `approved`, and `rejected`, defaulting to `none`, stored independently of the existing `status` field.

3. THE PayrollRun Model SHALL include `submittedBy` (ObjectId ref User), `submittedAt` (Date), `approvedBy` (ObjectId ref User), `approvedAt` (Date), `rejectedBy` (ObjectId ref User), `rejectedAt` (Date), and `rejectionReason` (String) fields.

4. THE PayrollRun Model SHALL include a `payDate` (Date) field recording the scheduled or actual payment date.

5. THE PayrollRun Model SHALL include a `comments` array where each element contains `authorId` (ObjectId ref User), `authorEmail` (String), `text` (String, required), and `createdAt` (Date, default now).

6. THE SalarySlip Model SHALL include a `withheld` sub-document containing `isWithheld` (Boolean, default false), `reason` (String), `withheldBy` (ObjectId ref User), `withheldAt` (Date), and `releasedInRunId` (ObjectId ref PayrollRun).

7. THE SalarySlip Model SHALL include a `skipped` (Boolean, default false) field.

8. THE SalarySlip Model SHALL include an `arrears` array where each element contains `amount` (Number), `reason` (String), `sourceRunId` (ObjectId ref PayrollRun), `addedBy` (ObjectId ref User), and `addedAt` (Date).

9. THE SalarySlip Model SHALL include a `lopAdjustments` array where each element contains `days` (Number), `reason` (String), `type` (enum: `reversal`, `manual_addition`), `appliedBy` (ObjectId ref User), and `appliedAt` (Date).

10. THE SalarySlip Model SHALL include a `oneTimeEntries` array where each element contains `label` (String), `amount` (Number), `kind` (enum: `earning`, `deduction`), `addedBy` (ObjectId ref User), and `addedAt` (Date).

11. THE SalarySlip Model SHALL include `paymentStatus` (enum: `pending`, `paid`, default `pending`), `paidAt` (Date), `paidBy` (ObjectId ref User), and `paymentMode` (enum: `bankTransfer`, `cheque`, `cash`) fields.

12. THE AuditLog Model SHALL include the following additional action types: `PAYRUN_SUBMITTED_FOR_APPROVAL`, `PAYRUN_APPROVED`, `PAYRUN_REJECTED`, `PAYRUN_COMMENT_ADDED`, `SLIP_WITHHELD`, `SLIP_RELEASED`, `SLIP_SKIPPED`, `SLIP_LOP_ADJUSTED`, `SLIP_ARREARS_ADDED`, and `SLIP_MARKED_PAID_INDIVIDUAL`.

13. WHEN `payrollCompute.js` calculates net pay, THE Computation Engine SHALL sum all entries in `lopAdjustments` and `oneTimeEntries` arrays additively on top of base computed values without overwriting prior array entries.

---

### Requirement 2 — Phase 2: Employee Summary Tab

**User Story:** As a PayrollOfficer or Admin, I want a rich per-employee summary view inside the
payroll run detail page with contextual actions per employee, so that I can manage individual
slip adjustments without leaving the run context.

#### Acceptance Criteria

1. WHEN a user opens a PayrollRun detail page, THE PayrollRunDetailPage SHALL render an Employee Summary tab as the default active tab, replacing the current flat slip table.

2. THE Employee Summary Tab SHALL display one row per SalarySlip in the run, showing at minimum: employee name, employee ID, gross pay, total deductions, net pay, LOP days, and payment status.

3. WHILE a PayrollRun has `status: draft`, THE Employee Summary Tab SHALL render an overflow menu (⋯) on each employee row containing the actions: Add LOP, Add Earnings/Deductions, Withhold Salary, Skip from Payroll, and Reverse LOP.

4. WHILE a PayrollRun has `status: draft` and a slip has `withheld.isWithheld: true`, THE Overflow Menu SHALL display a Release Withheld Salary action instead of the Withhold Salary action.

5. THE Overflow Menu SHALL always include View TDS Sheet as a read-only action regardless of run status.

6. WHEN an Admin selects one or more employee rows and activates the Mark as Paid toolbar action, THE Employee Summary Tab SHALL invoke the individual slip mark-paid endpoint for each selected slip.

7. WHEN a user activates the Add LOP overflow action, THE PayrollRunDetailPage SHALL open a dialog that collects LOP days (Number, required) and reason (String, required), then calls the slip LOP adjustment endpoint.

8. WHEN a user activates the Add Earnings/Deductions overflow action, THE PayrollRunDetailPage SHALL open a dialog that collects label (String, required), amount (Number, required), and kind (`earning` or `deduction`, required), then calls the slip one-time entry endpoint.

9. WHEN a user activates the Withhold Salary overflow action, THE PayrollRunDetailPage SHALL open a dialog that collects a withhold reason (String, required), then calls the slip withhold endpoint.

10. WHEN a user activates the Skip from Payroll overflow action, THE PayrollRunDetailPage SHALL prompt for confirmation, then call the slip skip endpoint.

---

### Requirement 3 — Phase 3: Taxes and Deductions Tab

**User Story:** As a PayrollOfficer or Admin, I want a dedicated Taxes and Deductions tab showing
aggregate statutory totals and a per-employee breakdown, so that I can verify compliance figures
before finalizing a run.

#### Acceptance Criteria

1. WHEN a user opens a PayrollRun detail page, THE PayrollRunDetailPage SHALL render a Taxes and Deductions tab alongside the Employee Summary tab.

2. THE Taxes and Deductions Tab SHALL display four aggregate summary cards showing: Total PF (sum of `deductions.pf` across all non-skipped slips), Total ESI (sum of `deductions.esi`), Total PT (sum of `deductions.professionalTax`), and Total TDS (sum of `deductions.tds`).

3. THE Taxes and Deductions Tab SHALL display a per-employee breakdown table with columns for employee name, PF, ESI, PT, TDS, LOP deduction, and net pay, sourced from existing `SalarySlip.deductions` fields.

4. IF a SalarySlip has `skipped: true`, THEN THE Taxes and Deductions Tab SHALL exclude that slip from all aggregate totals and from the per-employee breakdown table.

5. THE Taxes and Deductions Tab SHALL be a read-only presentation layer with no data mutation capabilities.

---

### Requirement 4 — Phase 4: Bulk CSV Import and Export

**User Story:** As an Admin, I want to import LOP details and one-time earnings/deductions from
CSV files, and export the employee summary as CSV, so that I can manage large payroll adjustments
efficiently without row-by-row data entry.

#### Acceptance Criteria

1. WHEN an Admin uploads a LOP import CSV, THE Import Service SHALL accept a file with columns `employeeId`, `lopDays`, and `reason`, apply each row as a `lopAdjustments` entry of type `manual_addition` on the matching SalarySlip, and emit a `SLIP_LOP_ADJUSTED` audit event per affected slip.

2. WHEN an Admin uploads a one-time entries CSV, THE Import Service SHALL accept a file with columns `employeeId`, `kind`, `label`, and `amount`, apply each row as a `oneTimeEntries` entry on the matching SalarySlip, and emit the appropriate audit event per affected slip.

3. IF any `employeeId` in an import CSV does not match an existing SalarySlip in the current run, THEN THE Import Service SHALL reject the entire import and return an error listing all unmatched employee IDs without applying any changes.

4. THE Import Service SHALL share its core application logic with the Phase 2 per-row dialog endpoints, ensuring a single code path for LOP adjustments and one-time entries regardless of entry origin.

5. WHEN an Admin requests an Employee Summary export, THE Export Service SHALL generate a CSV file containing all non-skipped employee rows from the run with columns including employee name, employee ID, gross pay, LOP days, total deductions, net pay, and payment status.

6. WHEN an Admin requests an Employee Summary export, THE Export Service SHALL respond with `Content-Disposition: attachment` and an appropriate filename including the run's month and year.

---

### Requirement 5 — Phase 5: Approval Workflow

**User Story:** As an Admin or PayrollOfficer, I want a formal approval workflow so that payroll
runs are reviewed and signed off before finalization, reducing the risk of unauthorized or erroneous
salary disbursements.

#### Acceptance Criteria

1. WHEN a PayrollRun has `status: draft` and at least one SalarySlip has been generated, THE Approval Workflow SHALL allow an Admin or PayrollOfficer to submit the run for approval by calling a submit endpoint, which sets `approvalStatus` to `submitted`, records `submittedBy` and `submittedAt`, and emits a `PAYRUN_SUBMITTED_FOR_APPROVAL` audit event.

2. WHEN a PayrollRun has `approvalStatus: submitted`, THE Approval Workflow SHALL allow any Admin to approve the run by calling an approve endpoint, which sets `approvalStatus` to `approved`, records `approvedBy` and `approvedAt`, and emits a `PAYRUN_APPROVED` audit event.

3. WHEN a PayrollRun has `approvalStatus: submitted`, THE Approval Workflow SHALL allow any Admin to reject the run by calling a reject endpoint that requires a non-empty `rejectionReason`, which sets `approvalStatus` to `rejected`, records `rejectedBy`, `rejectedAt`, and `rejectionReason`, and emits a `PAYRUN_REJECTED` audit event.

4. WHEN an Admin submits and intends to immediately approve a run, THE Approval Workflow SHALL support a combined submit-and-approve action in a single API call, setting `approvalStatus` to `approved` directly and recording both submission and approval fields.

5. WHEN a PayrollRun has `approvalStatus: approved`, THE Approval Workflow SHALL allow an Admin to override (re-approve) the run, preserving the audit trail with updated `approvedBy` and `approvedAt`.

6. WHEN the finalize endpoint is called for a PayrollRun, THE PayrollRun Controller SHALL reject the request with HTTP 422 if `approvalStatus` is not `approved`, returning an error message indicating approval is required before finalization.

7. IF a PayrollRun has `approvalStatus: rejected`, THEN THE Approval Workflow SHALL allow resubmission by calling the submit endpoint again, which resets `approvalStatus` to `submitted` and records new `submittedBy` and `submittedAt` values.

---

### Requirement 6 — Phase 6: Payment Recording

**User Story:** As an Admin, I want to record how and when salaries were paid — either for the
whole run or per employee — so that the system reflects the true disbursement state and supports
per-employee payment tracking.

#### Acceptance Criteria

1. WHEN an Admin calls the whole-run mark-paid endpoint, THE PayrollRun Controller SHALL accept `paymentMode` (enum: `bankTransfer`, `cheque`, `cash`, required) and `payDate` (Date, required), set `PayrollRun.status` to `paid`, record `paidBy` and `paidAt`, and set `paymentStatus: paid` on all SalarySlips that are not withheld (`withheld.isWithheld: false`) and not skipped (`skipped: false`).

2. WHEN an Admin calls the individual slip mark-paid endpoint `POST /api/payroll-runs/:id/slips/:slipId/mark-paid`, THE SalarySlip Controller SHALL accept `paymentMode` (enum: `bankTransfer`, `cheque`, `cash`, required) and `paidAt` (Date, required), set the slip's `paymentStatus` to `paid`, record `paidBy`, and emit a `SLIP_MARKED_PAID_INDIVIDUAL` audit event.

3. WHEN the individual slip mark-paid endpoint is called and all SalarySlips in the parent PayrollRun that are not withheld and not skipped have `paymentStatus: paid`, THE SalarySlip Controller SHALL automatically set the parent `PayrollRun.status` to `paid`.

4. IF `EMAIL_NOTIFICATIONS_ENABLED` environment variable is not set to `true`, THEN THE Payment Recording Service SHALL log an audit note with action detail indicating email notification was skipped due to configuration and SHALL NOT attempt SMTP or API email delivery.

5. WHERE `EMAIL_NOTIFICATIONS_ENABLED` is `true`, THE Payment Recording Service SHALL send a payment notification to the employee's registered email after a slip is marked paid.

---

### Requirement 7 — Phase 7: Comments and Notes

**User Story:** As an Admin or PayrollOfficer, I want to add run-level comments visible to all
payroll users, so that decisions, exceptions, and contextual notes are preserved alongside the
payroll record.

#### Acceptance Criteria

1. WHEN a user opens a PayrollRun detail page, THE PayrollRunDetailPage SHALL render a Comments panel in the top-right region of the page.

2. THE Comments Panel SHALL display all existing comments on the run in ascending chronological order, showing author email, comment text, and formatted timestamp for each entry.

3. WHEN a user submits a new comment, THE Comments Panel SHALL call a comments endpoint that appends a new entry to `PayrollRun.comments` containing `authorId`, `authorEmail`, `text`, and `createdAt`, and emits a `PAYRUN_COMMENT_ADDED` audit event.

4. THE Comments Panel SHALL be an append-only interface with no edit or delete capability for existing comments.

5. THE Comments Panel SHALL be accessible to both Admin and PayrollOfficer roles regardless of the run's `status` or `approvalStatus`.

---

### Requirement 8 — Phase 8: New Joinee Arrears

**User Story:** As an Admin, I want the system to detect mid-month joiners and surface a prorated
arrears suggestion for my review, so that new employees are compensated for the days they worked
before their first full payroll month without requiring manual calculation.

#### Acceptance Criteria

1. WHEN the generate slips endpoint is called and an employee's `joiningDate` (from the AMS employee feed) falls within the current payroll month, THE Payroll Computation Engine SHALL compute a prorated arrears amount based on the ratio of remaining working days in the month from the joining date to the total working days in that month.

2. WHEN a prorated arrears amount is computed for a mid-month joiner, THE Payroll Computation Engine SHALL surface the suggestion as a pending arrears entry on the slip — it SHALL NOT automatically add the entry to the slip's `arrears` array.

3. WHEN an Admin confirms an arrears suggestion by calling the arrears confirmation endpoint, THE SalarySlip Controller SHALL add a new entry to the slip's `arrears` array containing `amount`, `reason` (auto-populated as "New joinee prorated arrears"), `sourceRunId`, `addedBy`, and `addedAt`, and emit a `SLIP_ARREARS_ADDED` audit event.

4. IF an Admin dismisses an arrears suggestion without confirming it, THEN THE System SHALL record no arrears entry on the slip and the suggestion SHALL not reappear on subsequent regenerations unless the generate endpoint is called again.

5. THE New Joinee Arrears detection SHALL only apply to employees whose `joiningDate` falls strictly within the payroll month being processed, not to employees who joined in prior months.

---

### Requirement 9 — Phase 9: LOP Reversal

**User Story:** As an Admin, I want to reverse an incorrect LOP deduction from a finalized run
by adding a compensating adjustment in the employee's next draft run, so that finalized run data
remains immutable while the correction reaches the employee in the next payroll cycle.

#### Acceptance Criteria

1. WHILE a PayrollRun has `status: finalized` or `status: paid`, THE System SHALL reject any attempt to modify LOP days directly on SalarySlips belonging to that run, returning HTTP 422.

2. WHEN an Admin initiates a LOP reversal for a slip in a finalized run, THE SalarySlip Controller SHALL locate or require the Admin to identify the employee's next available `draft` PayrollRun and add a `lopAdjustments` entry of type `reversal` on the corresponding SalarySlip in that draft run, containing `days` (the reversal amount), `reason`, `appliedBy`, `appliedAt`, and a reference to the original run's ID in the `reason` or a dedicated metadata field.

3. THE LOP Reversal endpoint SHALL emit a `SLIP_LOP_ADJUSTED` audit event with `type: reversal` on the target draft slip.

4. THE PayrollRunDetailPage SHALL display UI copy on the reversal action making explicit that the correction will appear in the employee's next draft run, not in the currently viewed finalized run.

5. WHEN `payrollCompute.js` processes a draft run, THE Computation Engine SHALL include all `lopAdjustments` entries of type `reversal` in the net pay calculation by treating each entry as additional pay days added back to gross.

---

### Requirement 10 — Phase 10: Off-Cycle and Resettlement Pay Run Types

**User Story:** As an Admin, I want to create off-cycle and resettlement payroll runs in addition
to regular monthly runs, so that I can handle mid-cycle payments and final settlements for
departing employees without disrupting the regular payroll cycle.

#### Acceptance Criteria

1. WHEN an Admin opens the New Run creation menu, THE PayrollRunDetailPage (or PayrollRunsPage) SHALL present three options: Regular Payroll, Off-Cycle Payroll, and Resettlement Payroll.

2. WHEN an Admin creates a Regular Payroll run, THE PayrollRun Controller SHALL set `payRunType` to `regular` and enforce the existing unique constraint of one regular run per month/year combination.

3. WHEN an Admin creates an Off-Cycle Payroll run, THE PayrollRun Controller SHALL set `payRunType` to `offCycle`, accept a required `employeeIds` array limiting slip generation to the specified employees, and SHALL NOT require a full attendance data pull for all active profiles.

4. WHEN an Admin creates a Resettlement Payroll run, THE PayrollRun Controller SHALL set `payRunType` to `resettlement`, require that all selected employees have `isActive: false` or `employmentStatus` indicating terminated/inactive in the AMS employee feed, and SHALL NOT pull attendance data from AMS for resettlement slips.

5. WHEN an Admin generates slips for a Resettlement run, THE Payroll Computation Engine SHALL use only manually entered `oneTimeEntries` values (earnings and deductions) from the slip, with all attendance-derived fields defaulting to zero.

6. THE unique compound index on `(month, year)` SHALL apply only to runs with `payRunType: regular`; multiple off-cycle and resettlement runs for the same month/year SHALL be permitted.

7. WHEN a Resettlement run is created, THE PayrollRun Controller SHALL validate that every `employeeId` in the provided list corresponds to an inactive or terminated employee in the AMS employee feed, and SHALL reject the request with HTTP 422 if any active employee ID is included.

