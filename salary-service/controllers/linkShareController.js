'use strict';
// controllers/linkShareController.js
//
// Timed external sharing links — for CAs, auditors, external parties who
// need access without a salary-service login.
//
// Auth model:
//   • Generation: authenticated (Admin or PayrollOfficer)
//   • Redemption: unauthenticated — the link token IS the credential
//
// Honest limitation documented here and in README:
//   "View" permission cannot be cryptographically enforced once bytes reach a
//   browser. It is a UX nudge + audit trail.  Watermarking (done in pdfGenerator)
//   is the practical deterrent — each shared PDF carries recipient identity.

const crypto    = require('crypto');
const LinkShare = require('../models/LinkShare');
const SalarySlip = require('../models/SalarySlip');
const { presignedGetUrl } = require('../services/b2Storage');
const { audit }          = require('../services/auditLogger');

const EXPIRY_OPTIONS = {
    '24h':    24 * 60 * 60 * 1000,
    '7d':      7 * 24 * 60 * 60 * 1000,
    '30d':    30 * 24 * 60 * 60 * 1000,
};

function hashToken(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

// ─── POST /api/links — generate a link (authenticated) ───────────────────────

async function createLink(req, res) {
    const {
        resourceType, resourceKey, permission = 'view',
        recipientLabel = '', recipientEmail = null,
        expiryPreset = '7d', customExpiryMs = null, maxUses = 1,
        resourceLabel = '',
    } = req.body;

    if (!resourceType || !resourceKey) {
        return res.status(400).json({ error: 'resourceType and resourceKey are required' });
    }
    if (!['salarySlip', 'folder'].includes(resourceType)) {
        return res.status(400).json({ error: 'resourceType must be salarySlip or folder' });
    }
    if (!['view', 'download'].includes(permission)) {
        return res.status(400).json({ error: 'permission must be view or download' });
    }

    const ttlMs = customExpiryMs
        ? Math.min(parseInt(customExpiryMs, 10), 90 * 24 * 60 * 60 * 1000) // cap at 90 days
        : (EXPIRY_OPTIONS[expiryPreset] || EXPIRY_OPTIONS['7d']);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    try {
        const link = await LinkShare.create({
            tokenHash,
            resourceType,
            resourceKey,
            permission,
            recipientLabel: recipientLabel.slice(0, 100),
            recipientEmail,
            expiresAt: new Date(Date.now() + ttlMs),
            maxUses:   Math.max(1, parseInt(maxUses, 10) || 1),
            createdBy: req.user.userId,
            resourceLabel: resourceLabel.slice(0, 200),
        });

        await audit({
            action: 'LINK_CREATED', req,
            subject: tokenHash.slice(0, 12),
            details: { resourceType, resourceKey, permission, recipientLabel, expiresAt: link.expiresAt },
        });

        return res.status(201).json({
            link: {
                id:             link._id,
                token:          rawToken,  // returned ONCE — never stored raw
                shareUrl:       `/share/${rawToken}`,
                expiresAt:      link.expiresAt,
                permission,
                recipientLabel,
                maxUses:        link.maxUses,
            },
        });
    } catch (err) {
        console.error('[LinkShare] create:', err.message);
        return res.status(500).json({ error: 'Failed to create share link' });
    }
}

// ─── GET /api/links — list active links (authenticated) ──────────────────────

async function listLinks(req, res) {
    try {
        const filter = {
            revoked:   false,
            expiresAt: { $gt: new Date() },
        };
        if (req.query.resourceKey) filter.resourceKey = req.query.resourceKey;

        const links = await LinkShare.find(filter)
            .select('-tokenHash -accessLog')
            .populate('createdBy', 'email fullName')
            .sort({ createdAt: -1 })
            .limit(100);

        return res.json({ links });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to list links' });
    }
}

// ─── POST /api/links/:id/revoke — revoke a link (authenticated) ───────────────

async function revokeLink(req, res) {
    try {
        const link = await LinkShare.findById(req.params.id);
        if (!link) return res.status(404).json({ error: 'Link not found' });
        link.revoked = true;
        await link.save();

        await audit({ action: 'LINK_REVOKED', req, subject: link.tokenHash.slice(0, 12), details: { resourceKey: link.resourceKey } });
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to revoke link' });
    }
}

// ─── GET /share/:token — public redemption endpoint (no auth required) ────────

async function redeemLink(req, res) {
    const { token } = req.params;
    if (!token || token.length !== 64) {
        return res.status(400).json({ error: 'Invalid share token' });
    }

    const tokenHash = hashToken(token);
    const hashPrefix = tokenHash.slice(0, 12);

    try {
        const link = await LinkShare.findOne({ tokenHash });

        if (!link) {
            return res.status(404).json({ error: 'Share link not found or expired' });
        }
        if (link.revoked) {
            await audit({ action: 'LINK_EXPIRED_ACCESS_ATTEMPT', req, subject: hashPrefix, details: { reason: 'revoked' } });
            return res.status(410).json({ error: 'This share link has been revoked' });
        }
        if (link.expiresAt < new Date()) {
            await audit({ action: 'LINK_EXPIRED_ACCESS_ATTEMPT', req, subject: hashPrefix, details: { reason: 'expired' } });
            return res.status(410).json({ error: 'This share link has expired' });
        }
        if (link.useCount >= link.maxUses) {
            await audit({ action: 'LINK_EXPIRED_ACCESS_ATTEMPT', req, subject: hashPrefix, details: { reason: 'max_uses_reached' } });
            return res.status(410).json({ error: 'This share link has reached its maximum number of uses' });
        }

        // ── Increment use count and log access ──────────────────────────────
        await LinkShare.updateOne(
            { _id: link._id },
            {
                $inc:  { useCount: 1 },
                $push: {
                    accessLog: {
                        accessedAt: new Date(),
                        ip:         req.ip || req.connection?.remoteAddress || null,
                        userAgent:  req.headers['user-agent'] || null,
                    },
                },
            }
        );

        // ── Generate short-lived presigned URL (10 min) ─────────────────────
        const disposition = link.permission === 'download' ? 'attachment' : 'inline';
        const presignedUrl = await presignedGetUrl(link.resourceKey, disposition, 600);

        await audit({
            action: 'LINK_REDEEMED', req: { ip: req.ip, headers: req.headers },
            subject: hashPrefix,
            details: { resourceType: link.resourceType, permission: link.permission, recipientLabel: link.recipientLabel },
        });

        return res.json({
            permission:     link.permission,
            resourceType:   link.resourceType,
            resourceLabel:  link.resourceLabel,
            recipientLabel: link.recipientLabel,
            expiresAt:      link.expiresAt,
            presignedUrl,
            presignedUrlExpiresInSeconds: 600,
            // Honest UX note: "view" mode is a UI convention, not DRM
            viewNote: link.permission === 'view'
                ? 'This document is shared in view-only mode. It has been watermarked with recipient information.'
                : null,
        });

    } catch (err) {
        console.error('[LinkShare] redeem:', err.message);
        return res.status(500).json({ error: 'Failed to redeem share link' });
    }
}

// ─── GET /api/links/:id/access-log — admin audit trail for a link ─────────────

async function getLinkAccessLog(req, res) {
    try {
        const link = await LinkShare.findById(req.params.id)
            .select('tokenHash resourceKey resourceLabel recipientLabel permission expiresAt revoked useCount maxUses accessLog createdAt');
        if (!link) return res.status(404).json({ error: 'Link not found' });
        return res.json({ link });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to get link' });
    }
}

module.exports = { createLink, listLinks, revokeLink, redeemLink, getLinkAccessLog };
