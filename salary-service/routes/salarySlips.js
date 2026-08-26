'use strict';
// routes/salarySlips.js
const express       = require('express');
const router        = express.Router();
const authenticate  = require('../middleware/authenticateToken');
const payrollAccess = require('../middleware/requirePayrollAccess');
const ctrl          = require('../controllers/salarySlipController');

router.use(authenticate, payrollAccess);

router.get('/',           ctrl.listSlips);
router.get('/:id',        ctrl.getSlip);
router.get('/:id/view',   ctrl.viewSlip);
router.get('/:id/download', ctrl.downloadSlip);

module.exports = router;
