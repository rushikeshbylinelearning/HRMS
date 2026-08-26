'use strict';
// services/payrollRunService.js
//
// Reusable business logic for creating and generating payroll runs.
// Extracted from payrollRunController.js so the month-end scheduler can
// invoke the same operations without an HTTP request in flight.
//
// Controller route handlers are thin wrappers that call these functions and
// translate the results / errors into HTTP responses.

const PayrollRun                  = require('../models/PayrollRun');
const SalarySlip                  = require('../models/SalarySlip');
const EmployeeFinancialProfile    = require('../models/EmployeeFinancialProfile');
const PayrollSettings             = require('../models/PayrollSettings');
const { fetchEmployeeAttendance } = require('./amsFeedClient');
const { computeSalarySlip }       = require('./payrollCompute');
const { generateSalarySlipPDF }   = require('./pdfGenerator');
const { uploadObject }            = require('./b2Storage');
const { buildPayslipKey }         = require('../utils/storageKey');
const { decrypt }                 = require('../utils/encryption');
const { audit }                   = require('./auditLogger');
const { logger }                  = require('../utils/logger');

const ENCRYPTED_FIELDS = ['bankAccountNumber', 'ifscCode', 'panNumber', 'uan'];

// ─── Typed error for duplicate run detection ───────────────────────────────────

class DuplicatePayrollRunError extends Error {
    constructor(month, year) {
        super(`A payroll run for ${month}/${year} already exists`);
        this.name = 'DuplicatePayrollRunError';
        this.month = month;
        this.year  = year;
    }
}

// ─── createPayrollRun ──────────────────────────────────────────────────────────

/**
 * Creates a new draft payroll run for the given month/year.
 *
 * @param {object} params
 * @param {number} params.month        — 1–12
 * @param {number} params.year         — e.g. 2026
 * @param {string} [params.notes]      — free-text notes attached to the run
 * @param {string} [params.payRunType] — 'regular', 'offCycle', or 'resettlement' (defaults to 'regular')
 * @param {string|null} params.actorId     — userId of the initiator (null for scheduler)
 * @param {string} params.actorEmail   — email of the initiator ('system@scheduler' for auto)
 * @param {'manual'|'auto'} params.source  — origination context (informational, not stored on model)
 * @returns {Promise<object>} the created PayrollRun document
 * @throws {DuplicatePayrollRunError} if a run for (month, year) already exists
 * @throws {Error} on any other DB error
 */
async function createPayrollRun({ month, year, notes, payRunType = 'regular', actorId, actorEmail, source }) {
    try {
        const run = await PayrollRun.create({
            month,
            year,
            notes,
            payRunType,
            createdBy: actorId || null,
            // Initialize approval workflow fields
            approvalStatus: 'none',
            submittedBy:    null,
            submittedAt:    null,
            approvedBy:     null,
            approvedAt:     null,
        });

        await audit({
            action:           'PAYROLL_RUN_CREATED',
            req:              null,
            subject:          run._id.toString(),
            details:          { month, year, payRunType, source },
            success:          true,
            performedByEmail: actorEmail,
        });

        return run;
    } catch (err) {
        // MongoDB duplicate key — unique index on { month, year }
        if (err.code === 11000) {
            throw new DuplicatePayrollRunError(month, year);
        }
        throw err;
    }
}

// ─── generatePayrollRun ────────────────────────────────────────────────────────

/**
 * Generates salary slips for employees in the given payroll run.
 * Idempotent: re-running overwrites existing slips for the same run.
 *
 * Behavior varies by payRunType:
 * - 'regular': processes all active employees with full attendance data
 * - 'offCycle': processes only employees specified in run.employeeIds (if set)
 * - 'resettlement': skips attendance fetch; relies on manual oneTimeEntries only
 *
 * @param {string|object} payrollRunId  — MongoDB ObjectId (string or object)
 * @param {object} opts
 * @param {string|null} opts.actorId       — userId of the initiator (null for scheduler)
 * @param {string} opts.actorEmail         — email ('system@scheduler' for auto)
 * @param {'manual'|'auto'} opts.source    — origination context
 * @param {string[]} [opts.employeeIds]    — optional employee filter for off-cycle runs
 * @returns {Promise<{
 *   success: string[],
 *   failed: Array<{employeeId: string, error: string}>,
 *   totalGross: number,
 *   totalNet: number,
 *   employeeCount: number
 * }>}
 * @throws {Error} if the run is not found or not in 'draft' status
 */
async function generatePayrollRun(payrollRunId, { actorId, actorEmail, source, employeeIds = null }) {
    const run = await PayrollRun.findById(payrollRunId);
    if (!run) {
        throw new Error(`Payroll run ${payrollRunId} not found`);
    }
    if (run.status !== 'draft') {
        throw new Error(`Cannot generate slips for a run in status '${run.status}' — must be 'draft'`);
    }

    const settings = await PayrollSettings.findOne({}) || new PayrollSettings({});
    const payRunType = run.payRunType || 'regular'; // backward compatibility
    
    // Determine which employees to process based on run type
    let profiles;
    if (payRunType === 'resettlement') {
        // Resettlement runs: process only inactive/terminated employees
        // Use employeeIds if provided, otherwise find all inactive profiles
        const query = { isActive: false };
        if (employeeIds && employeeIds.length > 0) {
            query.employeeId = { $in: employeeIds };
        }
        profiles = await EmployeeFinancialProfile.find(query);
    } else if (payRunType === 'offCycle' && employeeIds && employeeIds.length > 0) {
        // Off-cycle runs: process only specified employees
        profiles = await EmployeeFinancialProfile.find({
            isActive: true,
            employeeId: { $in: employeeIds },
        });
    } else {
        // Regular runs: process all active employees (default behavior)
        profiles = await EmployeeFinancialProfile.find({ isActive: true });
    }

    if (profiles.length === 0) {
        const errorMsg = payRunType === 'resettlement' 
            ? 'No inactive employee financial profiles found for resettlement run'
            : payRunType === 'offCycle' 
                ? 'No matching active employees found for off-cycle run'
                : 'No active employee financial profiles found';
        throw new Error(errorMsg);
    }

    const companyName = process.env.COMPANY_NAME || 'Company';
    const results = { success: [], failed: [] };

    for (const rawProfile of profiles) {
        const profile = rawProfile.toObject();

        // Decrypt sensitive fields for internal computation — never returned to callers
        for (const field of ENCRYPTED_FIELDS) {
            if (profile[field]) {
                try { profile[field] = decrypt(profile[field]); }
                catch (_) { profile[field] = null; }
            }
        }

        try {
            let attendanceData;
            
            // Resettlement runs: skip attendance fetch, use zero values
            if (payRunType === 'resettlement') {
                attendanceData = {
                    daysPresent:   0,
                    daysAbsent:    0,
                    lopDays:       0,
                    halfDays:      0,
                    overtimeHours: 0,
                    joiningDate:   profile.joiningDate || null,
                };
            } else {
                // Regular and off-cycle runs: fetch attendance from AMS
                attendanceData = await fetchEmployeeAttendance(
                    profile.employeeId, run.month, run.year
                );
            }

            // 2. Compute salary
            const computed = computeSalarySlip({ financialProfile: profile, settings, attendanceData });

            // 3. Upsert slip record (idempotent re-generation)
            const slipData = {
                payrollRunId: run._id,
                employeeId:   profile.employeeId,
                employeeName: profile.employeeName,
                month:        run.month,
                year:         run.year,
                attendanceData,
                ...computed,
                generatedAt:  new Date(),
                generatedBy:  actorId || null,
                status:       'generated',
            };

            const slip = await SalarySlip.findOneAndUpdate(
                { payrollRunId: run._id, employeeId: profile.employeeId },
                { $set: slipData },
                { new: true, upsert: true }
            );

            // 4. Generate PDF
            const pdfBuffer = await generateSalarySlipPDF({
                slip: slip.toObject(),
                profile,
                companyName,
            });

            // 5. Upload to B2
            const storageKey = buildPayslipKey(profile.employeeId, run.year, run.month);
            await uploadObject(storageKey, pdfBuffer, 'application/pdf', {
                employeeId: profile.employeeId,
                month:      String(run.month),
                year:       String(run.year),
            });

            // 6. Store B2 key on slip
            await SalarySlip.updateOne({ _id: slip._id }, { $set: { storageKey } });

            // 7. Audit per-employee slip generation
            await audit({
                action:           'SALARY_SLIP_GENERATED',
                req:              null,
                subject:          profile.employeeId,
                details:          { runId: run._id, source, payRunType },
                success:          true,
                performedByEmail: actorEmail,
            });

            results.success.push(profile.employeeId);

        } catch (slipErr) {
            logger.error(`[payrollRunService] Failed to generate slip for ${profile.employeeId}`, {
                error:        slipErr.message,
                payrollRunId: run._id,
                payRunType,
                source,
            });
            results.failed.push({ employeeId: profile.employeeId, error: slipErr.message });
        }
    }

    // Update run totals from all slips (includes any pre-existing ones if re-generating)
    const allSlips   = await SalarySlip.find({ payrollRunId: run._id });
    const totalGross = allSlips.reduce((s, sl) => s + (sl.grossPay || 0), 0);
    const totalNet   = allSlips.reduce((s, sl) => s + (sl.netPay   || 0), 0);
    await PayrollRun.updateOne({ _id: run._id }, {
        $set: { employeeCount: allSlips.length, totalGross, totalNet },
    });

    return {
        success:       results.success,
        failed:        results.failed,
        totalGross,
        totalNet,
        employeeCount: allSlips.length,
    };
}

module.exports = { createPayrollRun, generatePayrollRun, DuplicatePayrollRunError };
