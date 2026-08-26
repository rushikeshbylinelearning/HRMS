'use strict';
// routes/folders.js — B2 folder management panel
const express            = require('express');
const router             = express.Router();
const authenticate       = require('../middleware/authenticateToken');
const payrollAccess      = require('../middleware/requirePayrollAccess');
const requireAdmin       = require('../middleware/requireAdmin');
const uploadPayrollDoc   = require('../middleware/uploadPayrollDoc');
const ctrl               = require('../controllers/folderController');

// Read-only operations: PayrollOfficer+
router.get('/',       authenticate, payrollAccess, ctrl.listFolder);
router.get('/view',   authenticate, payrollAccess, ctrl.viewFile);

// Mutations: Admin only
router.post('/',         authenticate, requireAdmin, ctrl.createFolder);
router.delete('/',       authenticate, requireAdmin, ctrl.deleteFolder);
router.post('/rename',   authenticate, requireAdmin, ctrl.renameFile);
router.delete('/file',   authenticate, requireAdmin, ctrl.deleteFile);

// Upload into a folder: PayrollOfficer+ (upload middleware validates the PDF)
router.post('/upload',   authenticate, payrollAccess, uploadPayrollDoc, ctrl.uploadToFolder);

module.exports = router;
