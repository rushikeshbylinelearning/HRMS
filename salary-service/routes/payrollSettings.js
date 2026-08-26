'use strict';
// routes/payrollSettings.js
const express       = require('express');
const router        = express.Router();
const authenticate  = require('../middleware/authenticateToken');
const requireAdmin  = require('../middleware/requireAdmin');
const payrollAccess = require('../middleware/requirePayrollAccess');
const ctrl          = require('../controllers/payrollSettingsController');

// GET is available to PayrollOfficer; PUT is Admin-only
router.get('/',  authenticate, payrollAccess, ctrl.getSettings);
router.put('/',  authenticate, requireAdmin,  ctrl.updateSettings);

module.exports = router;
