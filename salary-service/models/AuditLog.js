'use strict';
// models/AuditLog.js
//
// Audit trail for security-sensitive operations in salary-service.
// Mirrors the AMS SystemAuditLog pattern, extended for payroll-specific events.

const mongoose = require('mongoose');

const ACTIONS = [
    // Auth
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'REFRESH_TOKEN_ROTATED',
    'REFRESH_TOKEN_REUSE_DETECTED',
    // User management
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DEACTIVATED',
    // Financial profile
    'FINANCIAL_PROFILE_CREATED',
    'FINANCIAL_PROFILE_UPDATED',
    // Payroll run
    'PAYROLL_RUN_CREATED',
    'PAYROLL_RUN_FINALIZED',
    'PAYROLL_RUN_MARKED_PAID',
    // Payroll run — scheduler-generated events
    'PAYROLL_RUN_AUTO_CREATED',
    'PAYROLL_RUN_AUTO_GENERATED',
    'PAYROLL_RUN_AUTO_SKIPPED',
    'PAYROLL_RUN_AUTO_FAILED',
    // Salary slips
    'SALARY_SLIP_GENERATED',
    'SALARY_SLIP_UPLOADED',
    // Link sharing
    'LINK_CREATED',
    'LINK_REDEEMED',
    'LINK_REVOKED',
    'LINK_EXPIRED_ACCESS_ATTEMPT',
    // Storage
    'FOLDER_CREATED',
    'FOLDER_DELETED',
    'FILE_UPLOADED',
    'FILE_DELETED',
    // Phase 1 — Pay run approval workflow
    'PAYRUN_SUBMITTED_FOR_APPROVAL',
    'PAYRUN_APPROVED',
    'PAYRUN_REJECTED',
    'PAYRUN_COMMENT_ADDED',
    // Phase 1/2 — Per-slip actions
    'SLIP_WITHHELD',
    'SLIP_RELEASED',
    'SLIP_SKIPPED',
    'SLIP_LOP_ADJUSTED',
    'SLIP_ARREARS_ADDED',
    'SLIP_MARKED_PAID_INDIVIDUAL',
];

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: ACTIONS,
    },
    // Who performed the action (null for unauthenticated events like link redemption)
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    performedByEmail: {
        type: String,
        default: null,
    },
    // Subject of the action (employee ID, link token hash prefix, etc.)
    subject: {
        type: String,
        default: null,
    },
    ipAddress: {
        type: String,
        default: null,
    },
    userAgent: {
        type: String,
        default: null,
    },
    // Flexible additional detail
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    success: {
        type: Boolean,
        default: true,
    },
    errorMessage: {
        type: String,
        default: null,
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
    },
}, { timestamps: false });

auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });
auditLogSchema.index({ subject: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.ACTIONS = ACTIONS;
