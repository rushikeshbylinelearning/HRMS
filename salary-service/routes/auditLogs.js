'use strict';
// routes/auditLogs.js — Admin-only audit log viewer
const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticateToken');
const requireAdmin = require('../middleware/requireAdmin');
const AuditLog     = require('../models/AuditLog');

router.use(authenticate, requireAdmin);

// GET /api/audit-logs?action=&subject=&from=&to=&page=&limit=
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.action)  filter.action  = req.query.action;
        if (req.query.subject) filter.subject  = req.query.subject;
        if (req.query.from || req.query.to) {
            filter.timestamp = {};
            if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
            if (req.query.to)   filter.timestamp.$lte = new Date(req.query.to);
        }

        const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
        const limit = Math.min(100, parseInt(req.query.limit || '50', 10));

        const [logs, total] = await Promise.all([
            AuditLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit),
            AuditLog.countDocuments(filter),
        ]);

        return res.json({ logs, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

module.exports = router;
