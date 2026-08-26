'use strict';
// routes/auth.js
const express    = require('express');
const rateLimit  = require('express-rate-limit');
const router     = express.Router();
const auth       = require('../controllers/authController');
const authenticate = require('../middleware/authenticateToken');
const { hashRefreshToken } = require('../utils/refreshTokenUtils');

// ─── Rate limiter for login ────────────────────────────────────────────────────
// AMS audit finding: login route had no rate limit (A07-MED).
// Do NOT repeat that here. 5 attempts / 15 min per IP+email combo.
const loginLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             5,
    standardHeaders: true,
    legacyHeaders:   false,
    keyGenerator: (req) => {
        const ip    = req.ip || 'unknown';
        const email = String(req.body?.email || '').toLowerCase().slice(0, 100);
        return `login:${ip}:${email}`;
    },
    handler: (req, res) => {
        return res.status(429).json({
            error: 'Too many login attempts. Please try again in 15 minutes.',
            code:  'RATE_LIMITED',
        });
    },
});

// Rate limiter for refresh (tighter — 20 req / 5 min per IP+cookie-hash)
const refreshLimiter = rateLimit({
    windowMs:        5 * 60 * 1000,
    max:             20,
    standardHeaders: true,
    legacyHeaders:   false,
    keyGenerator: (req) => {
        const raw = req.cookies?.refreshToken;
        const cookieKey = raw ? hashRefreshToken(raw).slice(0, 16) : 'no-cookie';
        return `refresh:${req.ip || 'unknown'}:${cookieKey}`;
    },
    handler: (req, res) => {
        return res.status(429).json({ error: 'Too many refresh attempts.', code: 'RATE_LIMITED' });
    },
});

// POST /api/auth/login
router.post('/login', loginLimiter, auth.login);

// POST /api/auth/refresh
router.post('/refresh', refreshLimiter, auth.refreshToken);

// POST /api/auth/logout  (auth optional — revoke cookie even if token expired)
router.post('/logout', auth.logout);

// GET /api/auth/me  (requires valid access token)
router.get('/me', authenticate, auth.me);

module.exports = router;
