'use strict';
// models/User.js
//
// salary-service's own user collection for payroll/finance roles.
// This is COMPLETELY SEPARATE from AMS's User collection.
// An AMS Admin gets no access here unless explicitly created.
// No automatic linkage, no federation, no SSO.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['Admin', 'PayrollOfficer'];

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    passwordHash: {
        type: String,
        required: true,
        select: false, // never returned in queries unless explicitly selected
    },
    role: {
        type: String,
        enum: ROLES,
        required: true,
        default: 'PayrollOfficer',
    },
    fullName: {
        type: String,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    lastLoginAt: {
        type: Date,
    },
    // Failed login tracking for account lockout (future hardening)
    failedLoginCount: {
        type: Number,
        default: 0,
    },
    lockedUntil: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

// Index for login lookup
userSchema.index({ email: 1 });
userSchema.index({ isActive: 1 });

/**
 * Hashes and sets the password.
 * Never store the plaintext password — call this method, not direct field assignment.
 */
userSchema.methods.setPassword = async function (plaintext) {
    if (!plaintext || plaintext.length < 8) {
        throw new Error('Password must be at least 8 characters');
    }
    this.passwordHash = await bcrypt.hash(plaintext, 12);
};

/**
 * Compares a plaintext password against the stored hash.
 * @param {string} plaintext
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (plaintext) {
    return bcrypt.compare(plaintext, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
