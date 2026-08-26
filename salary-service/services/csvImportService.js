'use strict';
// services/csvImportService.js
//
// Bulk CSV import helpers for LOP adjustments and one-time entries.
//
// The whole-import-rejection guarantee ensures that if any row fails
// validateEmployeeIds, the entire import is aborted before any changes
// are written to the database.

const SalarySlip = require('../models/SalarySlip');
const { applyLopAdjustment, applyOneTimeEntry } = require('./slipAdjustmentService');

// ─── parseLopRows ──────────────────────────────────────────────────────────────

/**
 * Parses CSV text into row objects for a LOP import.
 *
 * Expected columns (first row is header, skipped automatically):
 *   employeeId, lopDays, reason
 *
 * Whitespace is trimmed from every field.
 *
 * @param {string} csvText — raw CSV string (may include \r\n line endings)
 * @returns {{ employeeId: string, lopDays: number, reason: string }[]}
 */
function parseLopRows(csvText) {
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    const dataLines = lines.slice(1); // skip header row
    return dataLines.map((line) => {
        const parts = line.split(',').map(p => p.trim());
        return {
            employeeId: parts[0] || '',
            lopDays:    parseFloat(parts[1]) || 0,
            reason:     parts[2] || '',
        };
    });
}

// ─── parseOneTimeRows ──────────────────────────────────────────────────────────

/**
 * Parses CSV text into row objects for a one-time entries import.
 *
 * Expected columns (first row is header, skipped automatically):
 *   employeeId, kind, label, amount
 *
 * Rows with an invalid `kind` value (anything other than 'earning' or
 * 'deduction') are silently filtered out.
 *
 * @param {string} csvText — raw CSV string (may include \r\n line endings)
 * @returns {{ employeeId: string, kind: string, label: string, amount: number }[]}
 */
function parseOneTimeRows(csvText) {
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    const dataLines = lines.slice(1); // skip header row
    return dataLines
        .map((line) => {
            const parts = line.split(',').map(p => p.trim());
            const kind = parts[1] || '';
            return {
                employeeId: parts[0] || '',
                kind:       ['earning', 'deduction'].includes(kind) ? kind : null,
                label:      parts[2] || '',
                amount:     parseFloat(parts[3]) || 0,
            };
        })
        .filter(row => row.kind !== null); // discard rows with invalid kind
}

// ─── validateEmployeeIds ───────────────────────────────────────────────────────

/**
 * Validates that every employeeId in `rows` has a SalarySlip in the given run.
 *
 * Builds a Set of valid IDs from the run's slips and a slipMap keyed by
 * employeeId for efficient downstream lookup.
 *
 * @param {string} runId — PayrollRun _id
 * @param {{ employeeId: string }[]} rows — parsed CSV rows
 * @returns {Promise<{
 *   validIds: Set<string>,
 *   slipMap:  Record<string, object>,
 *   errors:   { row: number, employeeId: string, error: string }[]
 * }>}
 */
async function validateEmployeeIds(runId, rows) {
    const slips = await SalarySlip.find({ payrollRunId: runId }).select('employeeId _id');
    const validIds = new Set(slips.map(s => s.employeeId));
    const slipMap = {};
    slips.forEach(s => { slipMap[s.employeeId] = s; });

    const errors = [];
    rows.forEach((row, i) => {
        if (!validIds.has(row.employeeId)) {
            errors.push({
                row:        i + 2, // +2 because row 1 is the header
                employeeId: row.employeeId,
                error:      'Employee not in this run',
            });
        }
    });

    return { validIds, slipMap, errors };
}

// ─── importLop ────────────────────────────────────────────────────────────────

/**
 * Validates all rows then applies a LOP adjustment for each one.
 *
 * Whole-import rejection: if validateEmployeeIds returns any errors, throws
 * immediately without writing anything to the database.
 *
 * @param {string} runId   — PayrollRun _id
 * @param {{ employeeId: string, lopDays: number, reason: string }[]} rows
 * @param {string} actorId — User _id of the actor performing the import
 * @returns {Promise<{ applied: string[], errors: { employeeId: string, error: string }[] }>}
 * @throws {Error & { validationErrors: object[] }} if any employeeId is not in the run
 */
async function importLop(runId, rows, actorId) {
    const { slipMap, errors } = await validateEmployeeIds(runId, rows);
    if (errors.length > 0) {
        const err = new Error('Import validation failed');
        err.validationErrors = errors;
        throw err;
    }

    const applied = [];
    const applyErrors = [];

    for (const row of rows) {
        try {
            const slip = await SalarySlip.findById(slipMap[row.employeeId]._id);
            await applyLopAdjustment(slip, {
                days:    row.lopDays,
                reason:  row.reason,
                type:    'manual_addition',
                actorId,
            });
            applied.push(row.employeeId);
        } catch (e) {
            applyErrors.push({ employeeId: row.employeeId, error: e.message });
        }
    }

    return { applied, errors: applyErrors };
}

// ─── importOneTime ─────────────────────────────────────────────────────────────

/**
 * Validates all rows then applies a one-time entry for each one.
 *
 * Whole-import rejection: if validateEmployeeIds returns any errors, throws
 * immediately without writing anything to the database.
 *
 * @param {string} runId   — PayrollRun _id
 * @param {{ employeeId: string, kind: string, label: string, amount: number }[]} rows
 * @param {string} actorId — User _id of the actor performing the import
 * @returns {Promise<{ applied: string[], errors: { employeeId: string, error: string }[] }>}
 * @throws {Error & { validationErrors: object[] }} if any employeeId is not in the run
 */
async function importOneTime(runId, rows, actorId) {
    const { slipMap, errors } = await validateEmployeeIds(runId, rows);
    if (errors.length > 0) {
        const err = new Error('Import validation failed');
        err.validationErrors = errors;
        throw err;
    }

    const applied = [];
    const applyErrors = [];

    for (const row of rows) {
        try {
            const slip = await SalarySlip.findById(slipMap[row.employeeId]._id);
            await applyOneTimeEntry(slip, {
                label:   row.label,
                amount:  row.amount,
                kind:    row.kind,
                actorId,
            });
            applied.push(row.employeeId);
        } catch (e) {
            applyErrors.push({ employeeId: row.employeeId, error: e.message });
        }
    }

    return { applied, errors: applyErrors };
}

module.exports = {
    parseLopRows,
    parseOneTimeRows,
    validateEmployeeIds,
    importLop,
    importOneTime,
};
