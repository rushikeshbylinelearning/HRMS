'use strict';
// controllers/payrollRunController.js
//
// Thin HTTP wrappers around payrollRunService.js.
// All business logic (create draft, generate all slips) lives in the service;
// these handlers only handle request parsing, validation, and response shaping.

const PayrollRun       = require('../models/PayrollRun');
const SalarySlip       = require('../models/SalarySlip');
const { audit }        = require('../services/auditLogger');
const {
    createPayrollRun,
    generatePayrollRun,
    DuplicatePayrollRunError,
} = require('../services/payrollRunService');
const {
    guardDraftSlip,
    applyLopAdjustment,
    applyOneTimeEntry,
} = require('../services/slipAdjustmentService');
const {
    parseLopRows,
    parseOneTimeRows,
    importLop,
    importOneTime,
} = require('../services/csvImportService');
const notificationService = require('../services/notificationService');

// GET /api/payroll-runs
async function listRuns(req, res) {
    try {
        const runs = await PayrollRun.find({}).sort({ year: -1, month: -1 }).limit(24);
        return res.json({ runs });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to list payroll runs' });
    }
}

// GET /api/payroll-runs/:id
async function getRun(req, res) {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        const slips = await SalarySlip.find({ payrollRunId: run._id }).sort({ employeeId: 1 });
        return res.json({ run, slips });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to get payroll run' });
    }
}

// POST /api/payroll-runs — create a draft run
// Request body:
//   - month (required): 1–12
//   - year (required): e.g. 2026
//   - notes (optional): free-text notes
//   - payRunType (optional): 'regular', 'offCycle', or 'resettlement' (defaults to 'regular')
//   - employeeIds (required for offCycle/resettlement): array of employee IDs to include
async function createRun(req, res) {
    const { month, year, notes, payRunType, employeeIds } = req.body;
    if (!month || !year) return res.status(400).json({ error: 'month and year are required' });

    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (m < 1 || m > 12 || y < 2020) {
        return res.status(400).json({ error: 'Invalid month or year' });
    }

    // Validate payRunType if provided
    const validPayRunTypes = ['regular', 'offCycle', 'resettlement'];
    const runType = payRunType || 'regular'; // Default to 'regular' for backward compatibility
    if (!validPayRunTypes.includes(runType)) {
        return res.status(400).json({
            error: `Invalid payRunType. Must be one of: ${validPayRunTypes.join(', ')}`,
        });
    }

    // Validate employeeIds for offCycle and resettlement runs
    if (runType === 'offCycle' || runType === 'resettlement') {
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({
                error: `employeeIds array is required and must not be empty for ${runType} runs`,
            });
        }
    }

    try {
        const run = await createPayrollRun({
            month: m,
            year: y,
            notes,
            payRunType: runType,
            employeeIds: employeeIds || null,
            actorId:    req.user.userId,
            actorEmail: req.user.email,
            source:     'manual',
        });
        return res.status(201).json({ run });
    } catch (err) {
        if (err instanceof DuplicatePayrollRunError) {
            return res.status(409).json({ error: err.message });
        }
        return res.status(500).json({ error: 'Failed to create payroll run' });
    }
}

// POST /api/payroll-runs/:id/generate — compute + upload slips for all active employees
async function generateSlips(req, res) {
    try {
        const result = await generatePayrollRun(req.params.id, {
            actorId:    req.user.userId,
            actorEmail: req.user.email,
            source:     'manual',
        });

        return res.json({
            message: `Generated ${result.success.length} slips. ${result.failed.length} failed.`,
            success: result.success,
            failed:  result.failed,
        });
    } catch (err) {
        if (err.message.includes('not found')) {
            return res.status(404).json({ error: err.message });
        }
        if (err.message.startsWith('Cannot generate')) {
            return res.status(409).json({ error: err.message });
        }
        if (err.message.includes('No active employee')) {
            return res.status(400).json({ error: err.message });
        }
        return res.status(500).json({ error: 'Failed to generate salary slips' });
    }
}

// POST /api/payroll-runs/:id/finalize
async function finalizeRun(req, res) {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        if (run.status !== 'draft') {
            return res.status(409).json({ error: `Run is already ${run.status}` });
        }
        // Approval guard — run must be approved before it can be finalized
        if (run.approvalStatus !== 'approved') {
            return res.status(422).json({
                error: `This run must be approved before it can be finalized. Current approval status: ${run.approvalStatus}`,
            });
        }
        run.status      = 'finalized';
        run.finalizedBy = req.user.userId;
        run.finalizedAt = new Date();
        await run.save();
        await audit({ action: 'PAYROLL_RUN_FINALIZED', req, subject: run._id.toString() });
        return res.json({ run });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to finalize run' });
    }
}

// POST /api/payroll-runs/:id/mark-paid
async function markPaid(req, res) {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        if (run.status !== 'finalized') {
            return res.status(409).json({ error: 'Run must be finalized before marking as paid' });
        }
        
        // Mark all non-withheld, non-skipped slips as paid
        const { paymentMode, payDate } = req.body;
        if (!paymentMode || !payDate) {
            return res.status(400).json({ error: 'paymentMode and payDate are required' });
        }
        
        const eligibleSlips = await SalarySlip.find({
            payrollRunId: run._id,
            'withheld.isWithheld': { $ne: true },
            skipped: { $ne: true },
        });
        
        // Update all eligible slips
        await SalarySlip.updateMany(
            {
                payrollRunId: run._id,
                'withheld.isWithheld': { $ne: true },
                skipped: { $ne: true },
            },
            {
                $set: {
                    paymentStatus: 'paid',
                    paidAt: new Date(payDate),
                    paidBy: req.user.userId,
                    paymentMode: paymentMode,
                },
            }
        );
        
        // Update run status
        run.status = 'paid';
        run.paidBy = req.user.userId;
        run.paidAt = new Date();
        run.payDate = new Date(payDate);
        await run.save();
        
        await audit({ action: 'PAYROLL_RUN_MARKED_PAID', req, subject: run._id.toString() });
        
        // Send email notifications to all employees with non-skipped slips
        // Fetch fresh slips to pass to notification service
        const slips = await SalarySlip.find({ payrollRunId: run._id });
        await notificationService.sendPayrollFinalisedEmails(run, slips);
        
        return res.json({ run });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to mark run as paid' });
    }
}

// POST /api/payroll-runs/:id/slips/:slipId/mark-paid
// Mark an individual slip as paid (per-slip payment status tracking).
async function markSlipPaid(req, res) {
    try {
        const { id, slipId } = req.params;
        const { paymentMode, paidAt, notifyEmployee } = req.body;
        
        // Validate required fields
        if (!paymentMode || !paidAt) {
            return res.status(400).json({ error: 'paymentMode and paidAt are required' });
        }
        
        // Validate payment mode
        if (!['bankTransfer', 'cheque', 'cash'].includes(paymentMode)) {
            return res.status(400).json({ error: 'paymentMode must be one of: bankTransfer, cheque, cash' });
        }
        
        // Load run and verify it exists
        const run = await PayrollRun.findById(id);
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        
        // Validate run is finalized
        if (run.status !== 'finalized') {
            return res.status(409).json({ error: 'Run must be finalized before marking slips as paid' });
        }
        
        // Load slip and verify it belongs to this run
        const slip = await SalarySlip.findOne({ _id: slipId, payrollRunId: run._id });
        if (!slip) return res.status(404).json({ error: 'Slip not found in this run' });
        
        // Guard: slip must not be withheld or skipped
        if (slip.withheld?.isWithheld) {
            return res.status(422).json({ error: 'Cannot mark a withheld slip as paid. Release the slip first.' });
        }
        if (slip.skipped) {
            return res.status(422).json({ error: 'Cannot mark a skipped slip as paid.' });
        }
        
        // Update slip payment fields
        slip.paymentStatus = 'paid';
        slip.paidAt = new Date(paidAt);
        slip.paidBy = req.user.userId;
        slip.paymentMode = paymentMode;
        await slip.save();
        
        // Create audit log entry
        await audit({
            action: 'SLIP_MARKED_PAID_INDIVIDUAL',
            req,
            subject: slip.employeeId,
            details: { runId: id, slipId, paymentMode, paidAt },
        });
        
        // Send email notification if requested
        if (notifyEmployee === true) {
            await notificationService.sendPayslipNotification({ slip, run, actorId: req.user.userId });
        }
        
        // Check if all eligible slips are now paid → auto-promote run to 'paid'
        const eligibleSlips = await SalarySlip.find({
            payrollRunId: run._id,
            'withheld.isWithheld': { $ne: true },
            skipped: { $ne: true },
        });
        const allPaid = eligibleSlips.every(s => s.paymentStatus === 'paid');
        if (allPaid) {
            run.status = 'paid';
            run.paidBy = req.user.userId;
            run.paidAt = new Date();
            await run.save();
        }
        
        return res.json({ slip });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to mark slip as paid' });
    }
}

// POST /api/payroll-runs/auto-generate/trigger — manual catch-up for missed cron windows.
// Always targets the previous calendar month. Admin only. No request body required.
async function triggerAutoGenerate(req, res) {
    try {
        // runMonthEndJob is awaited — the HTTP caller receives a response only after
        // the job completes, giving them immediate visibility into the outcome.
        // Per-slip errors are captured in audit logs; this endpoint always returns 200
        // unless the job threw entirely (handled by the catch below).
        const { runMonthEndJob } = require('../services/monthEndScheduler');
        await runMonthEndJob('manual-catchup');
        return res.json({ message: 'Month-end auto-generate completed. Check audit logs for result details.' });
    } catch (err) {
        // runMonthEndJob catches everything internally; this is a belt-and-suspenders guard.
        return res.status(500).json({ error: 'Auto-generate trigger failed unexpectedly' });
    }
}

// ─── Per-slip mutation handlers ───────────────────────────────────────────────

// PATCH /api/payroll-runs/:id/slips/:slipId/lop
// Add a manual LOP adjustment to a slip.
async function patchSlipLop(req, res) {
    try {
        const { id, slipId } = req.params;
        const { days, reason } = req.body;
        if (!days || !reason) return res.status(400).json({ error: 'days and reason required' });
        const { slip } = await guardDraftSlip(id, slipId);
        await applyLopAdjustment(slip, {
            days:    Number(days),
            reason,
            type:    'manual_addition',
            actorId: req.user.userId,
        });
        await audit({
            action:  'SLIP_LOP_ADJUSTED',
            req,
            subject: slip.employeeId,
            details: { runId: id, slipId, days, reason, type: 'manual_addition' },
        });
        return res.json({ success: true });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}

// PATCH /api/payroll-runs/:id/slips/:slipId/one-time
// Add a one-time earning or deduction to a slip.
async function patchSlipOneTime(req, res) {
    try {
        const { id, slipId } = req.params;
        const { label, amount, kind } = req.body;
        if (!label || amount == null || !kind) {
            return res.status(400).json({ error: 'label, amount, and kind are required' });
        }
        if (!['earning', 'deduction'].includes(kind)) {
            return res.status(400).json({ error: 'kind must be "earning" or "deduction"' });
        }
        const { slip } = await guardDraftSlip(id, slipId);
        await applyOneTimeEntry(slip, {
            label,
            amount:  Number(amount),
            kind,
            actorId: req.user.userId,
        });
        await audit({
            action:  'SLIP_ARREARS_ADDED',
            req,
            subject: slip.employeeId,
            details: { runId: id, slipId, label, amount, kind },
        });
        return res.json({ success: true });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}

// PATCH /api/payroll-runs/:id/slips/:slipId/withhold
// Withhold a slip — prevents it from being paid.
async function patchSlipWithhold(req, res) {
    try {
        const { id, slipId } = req.params;
        const { reason } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'reason is required' });
        }
        const { slip } = await guardDraftSlip(id, slipId);
        slip.withheld.isWithheld = true;
        slip.withheld.reason     = reason.trim();
        slip.withheld.withheldBy = req.user.userId;
        slip.withheld.withheldAt = new Date();
        await slip.save();
        await audit({
            action:  'SLIP_WITHHELD',
            req,
            subject: slip.employeeId,
            details: { runId: id, slipId, reason },
        });
        return res.json({ success: true });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}

// PATCH /api/payroll-runs/:id/slips/:slipId/release
// Release a withheld slip.
async function patchSlipRelease(req, res) {
    try {
        const { id, slipId } = req.params;
        const { slip } = await guardDraftSlip(id, slipId);
        slip.withheld.isWithheld = false;
        await slip.save();
        await audit({
            action:  'SLIP_RELEASED',
            req,
            subject: slip.employeeId,
            details: { runId: id, slipId },
        });
        return res.json({ success: true });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}

// PATCH /api/payroll-runs/:id/slips/:slipId/skip
// Mark a slip as skipped — removes employee from run totals.
async function patchSlipSkip(req, res) {
    try {
        const { id, slipId } = req.params;
        const { slip } = await guardDraftSlip(id, slipId);
        slip.skipped = true;
        await slip.save();
        await audit({
            action:  'SLIP_SKIPPED',
            req,
            subject: slip.employeeId,
            details: { runId: id, slipId },
        });
        return res.json({ success: true });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}

// GET /api/payroll-runs/:id/slips/:slipId/tds-sheet
// Returns a read-only TDS breakdown for the slip (works on any run status).
async function getSlipTdsSheet(req, res) {
    try {
        const { id, slipId } = req.params;
        const run = await PayrollRun.findById(id);
        if (!run) return res.status(404).json({ error: 'Run not found' });
        const slip = await SalarySlip.findOne({ _id: slipId, payrollRunId: run._id });
        if (!slip) return res.status(404).json({ error: 'Slip not found in this run' });

        const grossPay  = slip.grossPay || 0;
        const tdsAmount = slip.deductions?.tds || 0;
        const tdsRate   = grossPay > 0
            ? parseFloat((tdsAmount / grossPay * 100).toFixed(2))
            : 0;

        return res.json({
            employeeId:   slip.employeeId,
            employeeName: slip.employeeName,
            grossPay,
            tdsRate,
            tdsAmount,
            deductions: {
                pf:              slip.deductions?.pf              || 0,
                esi:             slip.deductions?.esi             || 0,
                professionalTax: slip.deductions?.professionalTax || 0,
                tds:             tdsAmount,
            },
        });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}

// PATCH /api/payroll-runs/:id/slips/:slipId/reverse-lop
// Reverse a LOP adjustment on a draft run (appends a 'reversal' entry with negative days).
async function patchSlipReverseLop(req, res) {
    try {
        const { id, slipId } = req.params;
        const { days, reason } = req.body;
        if (!days || !reason) return res.status(400).json({ error: 'days and reason required' });
        const { slip } = await guardDraftSlip(id, slipId);
        await applyLopAdjustment(slip, {
            days:    Number(days),
            reason,
            type:    'reversal',
            actorId: req.user.userId,
        });
        await audit({
            action:  'SLIP_LOP_ADJUSTED',
            req,
            subject: slip.employeeId,
            details: { runId: id, slipId, days, reason, type: 'reversal' },
        });
        return res.json({ success: true });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}

// ─── Approval workflow handlers ──────────────────────────────────────────────

// POST /api/payroll-runs/:id/submit
async function submitForApproval(req, res) {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        if (run.status !== 'draft') {
            return res.status(409).json({ error: 'Only draft runs can be submitted for approval' });
        }
        const slipCount = await SalarySlip.countDocuments({ payrollRunId: run._id });
        if (slipCount === 0) {
            return res.status(400).json({ error: 'Generate salary slips before submitting for approval' });
        }
        const isAdmin = req.user.role === 'Admin';
        // Admin: combined submit+approve in one action
        if (isAdmin) {
            run.approvalStatus = 'approved';
            run.submittedBy    = req.user.userId;
            run.submittedAt    = new Date();
            run.approvedBy     = req.user.userId;
            run.approvedAt     = new Date();
            await run.save();
            await audit({ action: 'PAYRUN_APPROVED', req, subject: run._id.toString(), details: { combined: true } });
        } else {
            run.approvalStatus = 'submitted';
            run.submittedBy    = req.user.userId;
            run.submittedAt    = new Date();
            await run.save();
            await audit({ action: 'PAYRUN_SUBMITTED_FOR_APPROVAL', req, subject: run._id.toString() });
        }
        return res.json({ run });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to submit for approval' });
    }
}

// POST /api/payroll-runs/:id/approve
async function approveRun(req, res) {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        if (!['submitted', 'approved'].includes(run.approvalStatus)) {
            return res.status(409).json({ error: `Cannot approve a run with approvalStatus: ${run.approvalStatus}` });
        }
        run.approvalStatus = 'approved';
        run.approvedBy     = req.user.userId;
        run.approvedAt     = new Date();
        await run.save();
        await audit({ action: 'PAYRUN_APPROVED', req, subject: run._id.toString() });
        return res.json({ run });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to approve run' });
    }
}

// POST /api/payroll-runs/:id/reject
async function rejectRun(req, res) {
    try {
        const run = await PayrollRun.findById(req.params.id);
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        const { rejectionReason } = req.body;
        if (!rejectionReason || !rejectionReason.trim()) {
            return res.status(400).json({ error: 'rejectionReason is required' });
        }
        run.approvalStatus  = 'rejected';
        run.rejectedBy      = req.user.userId;
        run.rejectedAt      = new Date();
        run.rejectionReason = rejectionReason.trim();
        await run.save();
        await audit({ action: 'PAYRUN_REJECTED', req, subject: run._id.toString(), details: { rejectionReason } });
        return res.json({ run });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to reject run' });
    }
}

// ─── Phase 7 — Comments / Notes ──────────────────────────────────────────────

// POST /api/payroll-runs/:id/comments
// Add a comment/note to a payroll run (append-only, no edit/delete).
async function addComment(req, res) {
    try {
        const { id } = req.params;
        const { text } = req.body;
        
        // Validate text field
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'text is required' });
        }
        if (text.trim().length > 2000) {
            return res.status(400).json({ error: 'text must not exceed 2000 characters' });
        }
        
        // Load the run
        const run = await PayrollRun.findById(id);
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        
        // Create new comment object
        const newComment = {
            authorId:    req.user.userId,
            authorEmail: req.user.email,
            text:        text.trim(),
            createdAt:   new Date(),
        };
        
        // Append to comments array
        run.comments.push(newComment);
        await run.save();
        
        // Create audit log entry
        await audit({
            action:  'PAYRUN_COMMENT_ADDED',
            req,
            subject: run._id.toString(),
            details: { commentText: text.trim() },
        });
        
        // Return the created comment
        return res.json({ comment: newComment });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to add comment' });
    }
}

// ─── Phase 8 — New Joinee Arrears ────────────────────────────────────────────

// POST /api/payroll-runs/:id/arrears/confirm
// Confirm pending arrears suggestions for one or more slips.
// Accepts an array of arrearIds in the request body.
async function confirmArrears(req, res) {
    try {
        const { id } = req.params;
        const { arrearIds } = req.body;
        
        // Validate arrearIds is provided and is an array
        if (!arrearIds || !Array.isArray(arrearIds) || arrearIds.length === 0) {
            return res.status(400).json({ error: 'arrearIds array is required and must not be empty' });
        }
        
        // Load the run and verify it exists
        const run = await PayrollRun.findById(id);
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        
        // Validate run status - must be draft to allow modifications
        if (run.status !== 'draft') {
            return res.status(409).json({ error: `Cannot confirm arrears on a ${run.status} run. Run must be in draft status.` });
        }
        
        // Track results
        const results = {
            confirmed: [],
            errors: [],
        };
        
        // Process each arrear ID
        for (const slipId of arrearIds) {
            try {
                // Load the slip
                const slip = await SalarySlip.findOne({ _id: slipId, payrollRunId: run._id });
                if (!slip) {
                    results.errors.push({ slipId, error: 'Slip not found in this run' });
                    continue;
                }
                
                // Check if there's a pending arrears suggestion
                if (!slip.pendingArrearsSuggestion || !slip.pendingArrearsSuggestion.amount) {
                    results.errors.push({ slipId, error: 'No pending arrears suggestion found' });
                    continue;
                }
                
                // Check if the suggestion was dismissed
                if (slip.pendingArrearsSuggestion.dismissed === true) {
                    results.errors.push({ slipId, error: 'Arrears suggestion was previously dismissed' });
                    continue;
                }
                
                // Move pendingArrearsSuggestion data into arrears array
                const newArrear = {
                    amount:      slip.pendingArrearsSuggestion.amount,
                    reason:      slip.pendingArrearsSuggestion.reason || 'New joinee prorated arrears',
                    sourceRunId: run._id,
                    addedBy:     req.user.userId,
                    addedAt:     new Date(),
                };
                
                slip.arrears.push(newArrear);
                
                // Clear the pending suggestion
                slip.pendingArrearsSuggestion = {
                    amount: undefined,
                    reason: undefined,
                    computedAt: undefined,
                    dismissed: false,
                };
                
                await slip.save();
                
                // Trigger recompute to include arrears in the slip calculations
                const { recomputeAndSaveSlip } = require('../services/slipAdjustmentService');
                const PayrollSettings = require('../models/PayrollSettings');
                const EmployeeFinancialProfile = require('../models/EmployeeFinancialProfile');
                
                const settings = await PayrollSettings.findOne();
                const profile = await EmployeeFinancialProfile.findOne({ employeeId: slip.employeeId });
                
                if (settings && profile) {
                    await recomputeAndSaveSlip(slip, settings, profile);
                }
                
                // Create audit log entry
                await audit({
                    action:  'SLIP_ARREARS_ADDED',
                    req,
                    subject: slip.employeeId,
                    details: { runId: id, slipId, amount: newArrear.amount, reason: newArrear.reason },
                });
                
                results.confirmed.push(slipId);
            } catch (slipError) {
                results.errors.push({ slipId, error: slipError.message });
            }
        }
        
        return res.json({
            message: `Confirmed ${results.confirmed.length} arrears. ${results.errors.length} failed.`,
            confirmed: results.confirmed,
            errors: results.errors,
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to confirm arrears' });
    }
}

// POST /api/payroll-runs/:id/arrears/dismiss
// Dismiss pending arrears suggestions for one or more slips.
// Accepts an array of arrearIds in the request body.
async function dismissArrears(req, res) {
    try {
        const { id } = req.params;
        const { arrearIds } = req.body;
        
        // Validate arrearIds is provided and is an array
        if (!arrearIds || !Array.isArray(arrearIds) || arrearIds.length === 0) {
            return res.status(400).json({ error: 'arrearIds array is required and must not be empty' });
        }
        
        // Load the run
        const run = await PayrollRun.findById(id);
        if (!run) return res.status(404).json({ error: 'Payroll run not found' });
        
        // Validate run status - must be draft to allow modifications
        if (run.status !== 'draft') {
            return res.status(409).json({ error: `Cannot dismiss arrears on a ${run.status} run. Run must be in draft status.` });
        }
        
        // Track results
        const results = {
            dismissed: [],
            errors: [],
        };
        
        // Process each arrear ID
        for (const slipId of arrearIds) {
            try {
                // Load the slip
                const slip = await SalarySlip.findOne({ _id: slipId, payrollRunId: run._id });
                if (!slip) {
                    results.errors.push({ slipId, error: 'Slip not found in this run' });
                    continue;
                }
                
                // Check if there's a pending arrears suggestion
                if (!slip.pendingArrearsSuggestion || !slip.pendingArrearsSuggestion.amount) {
                    results.errors.push({ slipId, error: 'No pending arrears suggestion found' });
                    continue;
                }
                
                // Mark the suggestion as dismissed
                slip.pendingArrearsSuggestion.dismissed = true;
                await slip.save();
                
                results.dismissed.push(slipId);
            } catch (slipError) {
                results.errors.push({ slipId, error: slipError.message });
            }
        }
        
        return res.json({
            message: `Dismissed ${results.dismissed.length} arrears. ${results.errors.length} failed.`,
            dismissed: results.dismissed,
            errors: results.errors,
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to dismiss arrears' });
    }
}

// ─── Bulk CSV import/export handlers ─────────────────────────────────────────

// POST /api/payroll-runs/:id/import/lop
// Reads uploaded CSV buffer, parses LOP rows, applies adjustments in bulk.
async function importLopCsv(req, res) {
    try {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ error: 'CSV file required' });
        const csvText = req.file.buffer.toString('utf8');
        const rows = parseLopRows(csvText);
        if (rows.length === 0) return res.status(400).json({ error: 'No data rows found in CSV' });
        const result = await importLop(id, rows, req.user.userId);
        return res.json({ applied: result.applied.length, errors: result.errors });
    } catch (err) {
        if (err.validationErrors) {
            return res.status(422).json({ error: 'Validation failed', errors: err.validationErrors });
        }
        return res.status(err.status || 500).json({ error: err.message });
    }
}

// POST /api/payroll-runs/:id/import/one-time
// Reads uploaded CSV buffer, parses one-time entry rows, applies them in bulk.
async function importOneTimeCsv(req, res) {
    try {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ error: 'CSV file required' });
        const csvText = req.file.buffer.toString('utf8');
        const rows = parseOneTimeRows(csvText);
        if (rows.length === 0) return res.status(400).json({ error: 'No valid data rows found in CSV' });
        const result = await importOneTime(id, rows, req.user.userId);
        return res.json({ applied: result.applied.length, errors: result.errors });
    } catch (err) {
        if (err.validationErrors) {
            return res.status(422).json({ error: 'Validation failed', errors: err.validationErrors });
        }
        return res.status(err.status || 500).json({ error: err.message });
    }
}

// GET /api/payroll-runs/:id/export/employee-summary
// Streams a CSV file with a per-employee payroll summary for the run.
async function exportEmployeeSummary(req, res) {
    try {
        const { id } = req.params;
        const run = await PayrollRun.findById(id);
        if (!run) return res.status(404).json({ error: 'Run not found' });
        const slips = await SalarySlip.find({ payrollRunId: id, skipped: { $ne: true } }).sort({ employeeId: 1 });

        const filename = `payroll-${run.year}-${String(run.month).padStart(2, '0')}-summary.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Header row
        res.write('Employee ID,Employee Name,Gross Pay,LOP Days,Total Deductions,Net Pay,Payment Status\n');
        // Data rows
        slips.forEach(slip => {
            const lopDays = slip.attendanceData?.lopDays ?? 0;
            res.write([
                slip.employeeId,
                `"${(slip.employeeName || '').replace(/"/g, '""')}"`,
                slip.grossPay || 0,
                lopDays,
                slip.totalDeductions || 0,
                slip.netPay || 0,
                slip.paymentStatus || 'pending',
            ].join(',') + '\n');
        });
        res.end();
    } catch (err) {
        return res.status(500).json({ error: 'Failed to export employee summary' });
    }
}

// ─── Phase 9 — LOP Reversal (next-run pattern) ───────────────────────────────

// POST /api/payroll-runs/:id/slips/:slipId/apply-reversal-to-next-run
// Applies a LOP correction to the employee's corresponding slip in a next draft run.
// Source run must be finalized or paid; nextRunId must be a draft run.
async function applyReversalToNextRun(req, res) {
    try {
        const { id, slipId } = req.params;
        const { days, reason, nextRunId } = req.body;

        if (!days || !reason || !nextRunId) {
            return res.status(400).json({ error: 'days, reason, and nextRunId are required' });
        }

        // Verify source run is finalized or paid
        const sourceRun = await PayrollRun.findById(id);
        if (!sourceRun) return res.status(404).json({ error: 'Source run not found' });
        if (!['finalized', 'paid'].includes(sourceRun.status)) {
            return res.status(409).json({
                error: `Source run must be finalized or paid. Current status: ${sourceRun.status}`,
            });
        }

        // Verify source slip belongs to source run
        const sourceSlip = await SalarySlip.findOne({ _id: slipId, payrollRunId: sourceRun._id });
        if (!sourceSlip) return res.status(404).json({ error: 'Slip not found in source run' });

        // Verify next run is a draft
        const nextRun = await PayrollRun.findById(nextRunId);
        if (!nextRun) return res.status(404).json({ error: 'Next run not found' });
        if (nextRun.status !== 'draft') {
            return res.status(409).json({
                error: `Next run must be in draft status. Current status: ${nextRun.status}`,
            });
        }

        // Find the employee's slip in the next run
        const nextSlip = await SalarySlip.findOne({
            payrollRunId: nextRun._id,
            employeeId:   sourceSlip.employeeId,
        });
        if (!nextSlip) {
            return res.status(404).json({
                error: 'Employee not found in the next run. Generate slips for the next run first.',
            });
        }

        // Apply the reversal as a manual_addition (positive earnings adjustment)
        const { applyLopAdjustment } = require('../services/slipAdjustmentService');
        await applyLopAdjustment(nextSlip, {
            days:        Number(days),
            reason,
            type:        'manual_addition',
            sourceRunId: sourceRun._id,
            actorId:     req.user.userId,
        });

        await audit({
            action:  'SLIP_LOP_ADJUSTED',
            req,
            subject: nextSlip.employeeId,
            details: {
                nextRunId,
                nextSlipId:   nextSlip._id.toString(),
                sourceRunId:  id,
                sourceSlipId: slipId,
                days,
                reason,
                type:         'manual_addition',
                crossRunReversal: true,
            },
        });

        return res.json({ success: true });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}

module.exports = {
    listRuns,
    getRun,
    createRun,
    generateSlips,
    finalizeRun,
    markPaid,
    markSlipPaid,
    triggerAutoGenerate,    patchSlipLop,
    patchSlipOneTime,
    patchSlipWithhold,
    patchSlipRelease,
    patchSlipSkip,
    getSlipTdsSheet,
    patchSlipReverseLop,
    importLopCsv,
    importOneTimeCsv,
    exportEmployeeSummary,
    submitForApproval,
    approveRun,
    rejectRun,
    addComment,
    confirmArrears,
    dismissArrears,
    applyReversalToNextRun,
};
