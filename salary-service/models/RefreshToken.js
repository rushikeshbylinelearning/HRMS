'use strict';
// models/RefreshToken.js — mirrors AMS pattern exactly
const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    issuedAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 }, // MongoDB TTL — auto-delete expired tokens
    },
    revoked: {
        type: Boolean,
        default: false,
        index: true,
    },
    replacedByTokenHash: {
        type: String,
        default: null,
    },
    userAgent: {
        type: String,
        default: null,
    },
});

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
