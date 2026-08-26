'use strict';
// routes/share.js — PUBLIC unauthenticated redemption endpoint
// This is intentionally unauthenticated — the link token IS the credential.
// Rate-limited to limit brute-force against token space.
const express    = require('express');
const rateLimit  = require('express-rate-limit');
const router     = express.Router();
const ctrl       = require('../controllers/linkShareController');

// 30 requests / 15 min per IP — loose enough for legitimate CA access,
// tight enough to slow brute-force against the 64-char token space
// (2^256 effective space makes brute-force computationally infeasible anyway,
//  but rate limiting adds a belt-and-suspenders layer)
const shareLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             30,
    standardHeaders: true,
    legacyHeaders:   false,
    handler: (req, res) => res.status(429).json({ error: 'Too many requests. Please try again later.' }),
});

// GET /share/:token — unauthenticated, token-gated
router.get('/:token', shareLimiter, ctrl.redeemLink);

module.exports = router;
