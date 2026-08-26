'use strict';
// services/slipAdjustmentService.js
//
// Shared helpers used by all slip mutation endpoints (LOP adjustment,
// one-time entries, withhold, skip, etc.).
//
// All mutation endpoints must:
//   1. Call guardDraftSlip to verify the run is draft and the slip belongs to it.
//   2. Apply the change to the in-memory slip document.
//   3. Call recomputeAndSaveSlip (or applyLopAdjustment / applyOneTimeEntry which do it internally).
//   4. Write the audit event in the calling controller.

const PayrollRun  = require('../models/PayrollRun');
const SalarySlip  = require('../models/SalarySlip');
const { computeSalarySlip } = require('./payrollCompute');

// ─── guardDraftSlip ────────────────────────────────────────────────────────────

/**
 * Verifies that:
 *   - the PayrollRun exists
 *   - the run's status is 'draft'
 *   - the SalarySlip exists and belongs to that run
 *
 * Returns { run, slip } on success.
 * Throws a status-tagged Error on any failure.
 *
 * @param {string} runId   — PayrollRun _id
 * @param {string} slipId  — SalarySlip _id
 * @returns {Promise<{ run: object, slip: object }>}
 */
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

// ─── recomputeAndSaveSlip ──────────────────────────────────────────────────────

/**
 * Re-runs computeSalarySlip with the slip's current lopAdjustments and
 * oneTimeEntries, persists the updated computed fields, and recalculates
 * the parent run's totalGross / totalNet.
 *
 * This is the single code path used by both per-row dialog endpoints and
 * the bulk CSV import — no duplicated compute logic.
 *
 * @param {object} slip     — Mongoose SalarySlip document (mutable)
 * @param {object} settings — PayrollSettings document
 * @param {object} profile  — EmployeeFinancialProfile document
 * @returns {Promise<object>} the saved slip document
 */
async function recomputeAndSaveSlip(slip, settings, profile) {
    const computed = computeSalarySlip({
        financialProfile: profile,
        settings,
        attendanceData:  slip.attendanceData,
        bonus:           slip.bonus,
        lopAdjustments:  slip.lopAdjustments,
        oneTimeEntries:  slip.oneTimeEntries,
    });
    Object.assign(slip, computed);
    await slip.save();

    // Update parent run totals to reflect the recalculated slip
    const allSlips = await SalarySlip.find({
        payrollRunId: slip.payrollRunId,
        skipped: { $ne: true },
    });
    const totalGross = allSlips.reduce((s, sl) => s + (sl.grossPay || 0), 0);
    const totalNet   = allSlips.reduce((s, sl) => s + (sl.netPay   || 0), 0);
    await PayrollRun.updateOne(
        { _id: slip.payrollRunId },
        { $set: { totalGross, totalNet } }
    );

    return slip;
}

// ─── applyLopAdjustment ────────────────────────────────────────────────────────

/**
 * Appends a LOP adjustment entry to slip.lopAdjustments and recomputes
 * the slip.
 *
 * @param {object} slip
 * @param {object} params
 * @param {number}  params.days         — number of LOP days to adjust
 * @param {string}  params.reason       — human-readable reason
 * @param {string}  params.type         — 'reversal' | 'manual_addition'
 * @param {string}  [params.sourceRunId] — original run _id (for reversal traceability)
 * @param {string}  params.actorId      — User _id of the actor applying the adjustment
 * @returns {Promise<object>} the updated slip
 */
async function applyLopAdjustment(slip, { days, reason, type, sourceRunId, actorId }) {
    slip.lopAdjustments.push({
        days,
        reason,
        type,         // 'reversal' | 'manual_addition'
        sourceRunId,  // optional — for reversal traceability
        appliedBy: actorId,
        appliedAt: new Date(),
    });

    // Load settings and financial profile for recompute
    const PayrollSettings          = require('../models/PayrollSettings');
    const EmployeeFinancialProfile = require('../models/EmployeeFinancialProfile');
    const settings = await PayrollSettings.findOne();
    const profile  = await EmployeeFinancialProfile.findOne({ employeeId: slip.employeeId });

    return recomputeAndSaveSlip(slip, settings, profile);
}

// ─── applyOneTimeEntry ─────────────────────────────────────────────────────────

/**
 * Appends a one-time earning or deduction entry to slip.oneTimeEntries and
 * recomputes the slip.
 *
 * @param {object} slip
 * @param {object} params
 * @param {string}  params.label   — display label for the entry (e.g. "Q2 Performance Bonus")
 * @param {number}  params.amount  — monetary amount (positive)
 * @param {string}  params.kind    — 'earning' | 'deduction'
 * @param {string}  params.actorId — User _id of the actor adding the entry
 * @returns {Promise<object>} the updated slip
 */
async function applyOneTimeEntry(slip, { label, amount, kind, actorId }) {
    slip.oneTimeEntries.push({
        label,
        amount,
        kind,        // 'earning' | 'deduction'
        addedBy: actorId,
        addedAt: new Date(),
    });

    // Load settings and financial profile for recompute
    const PayrollSettings          = require('../models/PayrollSettings');
    const EmployeeFinancialProfile = require('../models/EmployeeFinancialProfile');
    const settings = await PayrollSettings.findOne();
    const profile  = await EmployeeFinancialProfile.findOne({ employeeId: slip.employeeId });

    return recomputeAndSaveSlip(slip, settings, profile);
}

module.exports = {
    guardDraftSlip,
    recomputeAndSaveSlip,
    applyLopAdjustment,
    applyOneTimeEntry,
};
