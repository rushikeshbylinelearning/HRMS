'use strict';
// services/auditLogger.js
//
// Thin wrapper around the AuditLog model for consistent audit event recording.
// Write-and-forget pattern — audit log failures should not crash request handlers.
// Mirrors AMS's approach of writing directly to a dedicated model.

const AuditLog = require('../models/AuditLog');

/**
 * Records an audit event. Swallows errors so a log write failure never
 * propagates to the caller.
 *
 * @param {object} params
 * @param {string} params.action          — from AuditLog.ACTIONS enum
 * @param {object} [params.req]           — Express request (extracts IP, UA, user)
 * @param {string} [params.subject]       — resource identifier (employeeId, token hash prefix, etc.)
 * @param {object} [params.details]       — arbitrary additional data
 * @param {boolean} [params.success]      — default true
 * @param {string} [params.errorMessage]  — set if success is false
 */
async function audit({ action, req = null, subject = null, details = null, success = true, errorMessage = null }) {
    try {
        await AuditLog.create({
            action,
            performedBy:      req?.user?.userId  || null,
            performedByEmail: req?.user?.email   || null,
            subject,
            ipAddress:        req ? (req.ip || req.connection?.remoteAddress || null) : null,
            userAgent:        req ? (req.headers?.['user-agent'] || null) : null,
            details,
            success,
            errorMessage,
            timestamp: new Date(),
        });
    } catch (err) {
        // Never let audit log failures crash the caller
        console.error('[AuditLogger] Failed to write audit event:', err.message, { action, subject });
    }
}

module.exports = { audit };
