'use strict';
// routes/financialProfiles.js
const express        = require('express');
const router         = express.Router();
const authenticate   = require('../middleware/authenticateToken');
const payrollAccess  = require('../middleware/requirePayrollAccess');
const ctrl           = require('../controllers/financialProfileController');

router.use(authenticate, payrollAccess);

// Must be before /:employeeId to avoid "sync" being treated as an employeeId
router.get('/sync/employees', ctrl.syncEmployees);

router.get('/',                ctrl.listProfiles);
router.get('/:employeeId',     ctrl.getProfile);
router.post('/',               ctrl.createProfile);
router.put('/:employeeId',     ctrl.updateProfile);

module.exports = router;
