'use strict';
// controllers/authController.js
//
// Login, token refresh, and logout for salary-service's own users.
// No AMS tokens accepted. No SSO. HS256 only.
// Rate limiting is applied at the router level (routes/auth.js).

const User = require('../models/User');
const jwtUtils = require('../utils/jwtUtils');
const {
    RefreshTokenReuseError,
    issueRefreshToken,
    rotateRefreshToken,
    revokeRefreshToken,
    hashRefreshToken,
} = require('../utils/refreshTokenUtils');
const { audit } = require('../services/auditLogger');

// ─── Cookie helpers ────────────────────────────────────────────────────────────

function getRefreshCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure:   isProd,
        sameSite: isProd ? 'strict' : 'lax',
        maxAge:   7 * 24 * 60 * 60 * 1000,
        path:     '/api/auth',
        ...(isProd && { domain: '.bylinelms.com' }),
    };
}

function clearRefreshCookie(res) {
    const isProd = process.env.NODE_ENV === 'production';
    const opts = { path: '/api/auth' };
    if (isProd) opts.domain = '.bylinelms.com';
    res.clearCookie('refreshToken', opts);
}

// ─── POST /api/auth/login ──────────────────────────────────────────────────────

async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Select passwordHash explicitly (it has select: false on the schema)
        const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true })
            .select('+passwordHash');

        if (!user) {
            await audit({ action: 'LOGIN_FAILED', req, subject: email, success: false, errorMessage: 'User not found' });
            // Same response for not-found vs wrong password to prevent user enumeration
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Account lockout check
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            await audit({ action: 'LOGIN_FAILED', req, subject: email, success: false, errorMessage: 'Account locked' });
            return res.status(403).json({ error: 'Account temporarily locked. Try again later.' });
        }

        const valid = await user.comparePassword(password);
        if (!valid) {
            // Increment failed attempts (cap at 10, lock after 5 consecutive failures)
            const failCount = (user.failedLoginCount || 0) + 1;
            const update = { failedLoginCount: failCount };
            if (failCount >= 5) {
                update.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-min lock
            }
            await User.updateOne({ _id: user._id }, { $set: update });

            await audit({ action: 'LOGIN_FAILED', req, subject: email, success: false, errorMessage: 'Wrong password' });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Reset failed login counter on success
        await User.updateOne({ _id: user._id }, {
            $set: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        const accessToken = jwtUtils.sign({
            userId: user._id.toString(),
            email:  user.email,
            role:   user.role,
        });

        const rawRefreshToken = await issueRefreshToken(
            user._id,
            req.headers['user-agent'] || null
        );

        res.cookie('refreshToken', rawRefreshToken, getRefreshCookieOptions());

        await audit({ action: 'LOGIN_SUCCESS', req, subject: user._id.toString() });

        return res.json({
            accessToken,
            user: { id: user._id, email: user.email, role: user.role, fullName: user.fullName },
        });

    } catch (err) {
        console.error('[Auth] Login error:', err.message);
        return res.status(500).json({ error: 'Login failed' });
    }
}

// ─── POST /api/auth/refresh ────────────────────────────────────────────────────

async function refreshToken(req, res) {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
        return res.status(401).json({ error: 'No refresh token', code: 'NO_REFRESH_TOKEN' });
    }

    try {
        const { newRawToken, userId } = await rotateRefreshToken(rawToken);

        const user = await User.findById(userId).select('email role fullName isActive');
        if (!user || !user.isActive) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'User not found or inactive', code: 'USER_INACTIVE' });
        }

        const accessToken = jwtUtils.sign({
            userId: user._id.toString(),
            email:  user.email,
            role:   user.role,
        });

        res.cookie('refreshToken', newRawToken, getRefreshCookieOptions());

        await audit({ action: 'REFRESH_TOKEN_ROTATED', req, subject: userId });

        return res.json({
            accessToken,
            user: { id: user._id, email: user.email, role: user.role, fullName: user.fullName },
        });

    } catch (err) {
        if (err instanceof RefreshTokenReuseError) {
            await audit({
                action: 'REFRESH_TOKEN_REUSE_DETECTED', req,
                subject: hashRefreshToken(rawToken).slice(0, 12),
                success: false, errorMessage: err.message,
            });
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'Token reuse detected. Please log in again.', code: 'TOKEN_REUSE' });
        }
        clearRefreshCookie(res);
        return res.status(401).json({ error: 'Session expired. Please log in again.', code: 'REFRESH_FAILED' });
    }
}

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────

async function logout(req, res) {
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) {
        await revokeRefreshToken(rawToken).catch(() => {}); // best-effort
        await audit({ action: 'LOGOUT', req, subject: req.user?.userId });
    }
    clearRefreshCookie(res);
    return res.json({ success: true });
}

// ─── GET /api/auth/me ──────────────────────────────────────────────────────────

async function me(req, res) {
    try {
        const user = await User.findById(req.user.userId).select('email role fullName isActive lastLoginAt');
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.json({ user });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch user' });
    }
}

module.exports = { login, refreshToken, logout, me };
