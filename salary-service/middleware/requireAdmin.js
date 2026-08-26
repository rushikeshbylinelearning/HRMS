'use strict';
// middleware/requireAdmin.js — restricts a route to Admin role only

function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Admin role required' });
    }
    next();
}

module.exports = requireAdmin;
