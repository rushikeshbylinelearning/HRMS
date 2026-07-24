// backend/routes/onboarding.js
// Mounts onboarding endpoints onto /api/onboarding
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const ctrl = require('../controllers/onboardingController');

// ── Employee endpoints (all require valid JWT) ────────────────────────────────
router.get('/status',                   authenticateToken, ctrl.getOnboardingStatus);
router.post('/first-login',             authenticateToken, ctrl.recordFirstLogin);
router.post('/policy/start-reading',    authenticateToken, ctrl.startReadingPolicy);
router.post('/policy/accept',           authenticateToken, ctrl.acceptPolicy);
router.post('/tour/complete',           authenticateToken, ctrl.completeTour);
router.post('/profile/complete',        authenticateToken, ctrl.completeProfile);

// ── Admin endpoints ───────────────────────────────────────────────────────────
router.get('/admin/compliance',                    authenticateToken, ctrl.getComplianceDashboard);
router.get('/admin/compliance/export',             authenticateToken, ctrl.exportComplianceReport);
router.get('/admin/compliance/:userId/timeline',   authenticateToken, ctrl.getEmployeeTimeline);
router.post('/admin/policy/:policyId/set-mandatory',   authenticateToken, ctrl.setMandatoryPolicy);
router.post('/admin/policy/:policyId/unset-mandatory', authenticateToken, ctrl.unsetMandatoryPolicy);
router.post('/admin/force/:userId',                authenticateToken, ctrl.forceOnboarding);

module.exports = router;
