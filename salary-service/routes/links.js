'use strict';
// routes/links.js — authenticated link management
const express       = require('express');
const router        = express.Router();
const authenticate  = require('../middleware/authenticateToken');
const payrollAccess = require('../middleware/requirePayrollAccess');
const ctrl          = require('../controllers/linkShareController');

router.use(authenticate, payrollAccess);

router.get('/',                    ctrl.listLinks);
router.post('/',                   ctrl.createLink);
router.get('/:id/access-log',      ctrl.getLinkAccessLog);
router.post('/:id/revoke',         ctrl.revokeLink);

module.exports = router;
