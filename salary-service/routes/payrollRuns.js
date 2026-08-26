'use strict';
// routes/payrollRuns.js
const express       = require('express');
const router        = express.Router();
const authenticate  = require('../middleware/authenticateToken');
const requireAdmin  = require('../middleware/requireAdmin');
const payrollAccess = require('../middleware/requirePayrollAccess');
const uploadCsv     = require('../middleware/uploadCsv');
const ctrl          = require('../controllers/payrollRunController');

// List and read: PayrollOfficer+
router.get('/',              authenticate, payrollAccess, ctrl.listRuns);
router.get('/:id',           authenticate, payrollAccess, ctrl.getRun);

// Mutating operations: Admin only
router.post('/',             authenticate, requireAdmin,  ctrl.createRun);
router.post('/:id/generate', authenticate, requireAdmin,  ctrl.generateSlips);
router.post('/:id/finalize', authenticate, requireAdmin,  ctrl.finalizeRun);
router.post('/:id/mark-paid',authenticate, requireAdmin,  ctrl.markPaid);

// Manual catch-up for missed cron windows (e.g. process was down at 03:00 on the 1st).
// Always targets the previous calendar month — same logic as the cron job.
// Admin only. Body: none required.
router.post('/auto-generate/trigger', authenticate, requireAdmin, ctrl.triggerAutoGenerate);

// ─── Phase 2 — Per-slip mutation endpoints ────────────────────────────────────
router.patch('/:id/slips/:slipId/lop',         authenticate, requireAdmin,  ctrl.patchSlipLop);
router.patch('/:id/slips/:slipId/one-time',     authenticate, requireAdmin,  ctrl.patchSlipOneTime);
router.patch('/:id/slips/:slipId/withhold',     authenticate, requireAdmin,  ctrl.patchSlipWithhold);
router.patch('/:id/slips/:slipId/release',      authenticate, requireAdmin,  ctrl.patchSlipRelease);
router.patch('/:id/slips/:slipId/skip',         authenticate, requireAdmin,  ctrl.patchSlipSkip);
router.get(  '/:id/slips/:slipId/tds-sheet',    authenticate, payrollAccess, ctrl.getSlipTdsSheet);
router.patch('/:id/slips/:slipId/reverse-lop',  authenticate, requireAdmin,  ctrl.patchSlipReverseLop);

// ─── Phase 6 — Payment recording (per-slip) ───────────────────────────────────
router.post('/:id/slips/:slipId/mark-paid',    authenticate, requireAdmin,  ctrl.markSlipPaid);

// ─── Phase 4 — CSV import/export endpoints ────────────────────────────────────
router.post('/:id/import/lop',              authenticate, requireAdmin,  uploadCsv, ctrl.importLopCsv);
router.post('/:id/import/one-time',         authenticate, requireAdmin,  uploadCsv, ctrl.importOneTimeCsv);
router.get( '/:id/export/employee-summary', authenticate, payrollAccess, ctrl.exportEmployeeSummary);

// ─── Phase 5 — Approval workflow endpoints ────────────────────────────────────
router.post('/:id/submit',  authenticate, payrollAccess, ctrl.submitForApproval);
router.post('/:id/approve', authenticate, requireAdmin,  ctrl.approveRun);
router.post('/:id/reject',  authenticate, requireAdmin,  ctrl.rejectRun);

// ─── Phase 7 — Comments / Notes endpoints ─────────────────────────────────────
router.post('/:id/comments', authenticate, payrollAccess, ctrl.addComment);

// ─── Phase 8 — New Joinee Arrears endpoints ───────────────────────────────────
router.post('/:id/slips/:slipId/confirm-arrears', authenticate, requireAdmin, ctrl.confirmArrears);
router.post('/:id/slips/:slipId/dismiss-arrears', authenticate, requireAdmin, ctrl.dismissArrears);

// ─── Phase 9 — LOP Reversal (next-run pattern) ────────────────────────────────
router.post('/:id/slips/:slipId/apply-reversal-to-next-run', authenticate, requireAdmin, ctrl.applyReversalToNextRun);

module.exports = router;
