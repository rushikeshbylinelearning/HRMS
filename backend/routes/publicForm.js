// backend/routes/publicForm.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const publicFormController = require('../controllers/publicFormController');
const {
  profileSubmissionRules,
  validate,
  sanitizeProfileData,
  rateLimitConfig
} = require('../middleware/publicFormValidation');

// Rate limiter for public endpoints
const publicLimiter = rateLimit(rateLimitConfig);

// ─── PUBLIC ROUTES (NO AUTH REQUIRED) ──────────────────────────────────────

/**
 * Validate token and get employee data
 * GET /api/public/validate?token=xxx
 */
router.get('/validate', publicLimiter, publicFormController.validateToken);

/**
 * Submit profile data
 * POST /api/public/submit
 */
router.post(
  '/submit',
  publicLimiter,
  sanitizeProfileData,
  profileSubmissionRules,
  validate,
  publicFormController.submitProfile
);

module.exports = router;
