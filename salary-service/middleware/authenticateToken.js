'use strict';
// middleware/authenticateToken.js
//
// HS256-only JWT verification for salary-service sessions.
// Does NOT accept AMS tokens, SSO tokens, or RS256 tokens.
// salary-service is its own auth island.

const jwtUtils = require('../utils/jwtUtils');

async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    }

    try {
        const decoded = jwtUtils.verify(token);
        req.user = {
            userId:   decoded.userId,
            email:    decoded.email,
            role:     decoded.role,
        };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(403).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
    }
}

module.exports = authenticateToken;
