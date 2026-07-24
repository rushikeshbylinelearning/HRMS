// backend/routes/employeeDocuments.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const uploadEmployeeDocumentGridFS = require('../middleware/uploadEmployeeDocumentGridFS');
const ctrl = require('../controllers/employeeDocumentController');

const isAdminOrHr = (req, res, next) => {
    if (!['Admin', 'HR'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access forbidden: Requires Admin or HR role.' });
    }
    next();
};

router.get('/types', authenticateToken, isAdminOrHr, ctrl.getDocumentTypes);
router.put('/types', authenticateToken, isAdminOrHr, ctrl.updateDocumentTypes);
router.get('/auto-rule', authenticateToken, isAdminOrHr, ctrl.getAutoRule);
router.put('/auto-rule', authenticateToken, isAdminOrHr, ctrl.updateAutoRule);

router.get('/mine', authenticateToken, ctrl.getMyDocuments);
router.get('/admin/compliance', authenticateToken, isAdminOrHr, ctrl.getAdminCompliance);

router.post('/assign', authenticateToken, isAdminOrHr, uploadEmployeeDocumentGridFS, ctrl.assignDocuments);
router.post('/admin/change-status/:userId', authenticateToken, isAdminOrHr, ctrl.changeEmploymentStatus);

router.post('/:id/view', authenticateToken, ctrl.recordView);
router.post('/:id/start-reading', authenticateToken, ctrl.startReading);
router.post('/:id/acknowledge', authenticateToken, ctrl.acknowledgeDocument);
router.get('/:id/file', authenticateToken, ctrl.getDocumentFile);

module.exports = router;
