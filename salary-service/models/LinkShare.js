'use strict';
// models/LinkShare.js
//
// Timed external sharing links for salary slips and folders.
// For CAs, auditors, and others who need access without a salary-service account.
//
// Security properties:
//   • token is stored HASHED (SHA-256) — raw token sent to client only at creation
//   • TTL index on expiresAt — MongoDB auto-deletes expired records
//   • revoked flag — admin can kill a link early
//   • maxUses / useCount — supports single-use links (default maxUses: 1)
//   • accessLog — every redemption recorded for audit (IP, UA, timestamp)
//
// Permission: 'view' vs 'download' is a UX nudge + audit trail.
// It cannot be cryptographically enforced at the browser level — document
// this clearly and add watermarking to PDFs (see pdfGenerator.js) as the
// practical deterrent for casual redistribution.

const mongoose = require('mongoose');

const linkShareSchema = new mongoose.Schema({
    // SHA-256 hash of the raw token (raw token returned to client once at creation)
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    resourceType: {
        type: String,
        enum: ['salarySlip', 'folder'],
        required: true,
    },

    // B2 object key (for salarySlip) or prefix (for folder)
    resourceKey: {
        type: String,
        required: true,
    },

    permission: {
        type: String,
        enum: ['view', 'download'],
        default: 'view',
    },

    // Free-text label for display (e.g. "CA - Sharma & Co")
    recipientLabel: {
        type: String,
        trim: true,
        default: '',
    },

    // Optional email for future notification features
    recipientEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
    },

    expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 }, // TTL — auto-delete expired records
    },

    maxUses: {
        type: Number,
        default: 1,
        min: 1,
    },

    useCount: {
        type: Number,
        default: 0,
        min: 0,
    },

    revoked: {
        type: Boolean,
        default: false,
        index: true,
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // Audit log: each access attempt appended here
    accessLog: [{
        accessedAt: { type: Date, default: Date.now },
        ip:         { type: String },
        userAgent:  { type: String },
        _id: false,
    }],

    // Denormalized for display without a second query
    resourceLabel: {
        type: String,
        trim: true,
        default: '',
    },
}, { timestamps: true });

linkShareSchema.index({ resourceKey: 1 });
linkShareSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('LinkShare', linkShareSchema);
