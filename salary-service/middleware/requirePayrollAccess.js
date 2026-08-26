'use strict';
// middleware/requirePayrollAccess.js
// Allows both Admin and PayrollOfficer roles through.

function requirePayrollAccess(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (!['Admin', 'PayrollOfficer'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Payroll access required' });
    }
    next();
}

module.exports = requirePayrollAccess;
