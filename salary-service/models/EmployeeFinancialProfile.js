'use strict';
// models/EmployeeFinancialProfile.js
//
// Stores sensitive payroll & banking information for each employee.
// employeeId is the AMS employee identifier (string, no cross-DB FK).
//
// Sensitive fields are encrypted at rest using AES-256-GCM (utils/encryption.js).
// The encryption/decryption happens in the controller — the model stores only
// the encrypted ciphertext strings.
//
// NEVER store plaintext bank account numbers, PAN, or UAN in this collection.

const mongoose = require('mongoose');

const employeeFinancialProfileSchema = new mongoose.Schema({
    // AMS employee identifier — string reference, NOT a MongoDB ObjectId cross-DB FK
    employeeId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
    },

    // Human-readable name — cached from AMS for display; not authoritative
    employeeName: {
        type: String,
        trim: true,
    },

    // ─── Sensitive fields (AES-256-GCM encrypted, stored as "iv:tag:ct") ─────
    bankAccountNumber:  { type: String, default: null }, // encrypted
    ifscCode:           { type: String, default: null }, // encrypted
    panNumber:          { type: String, default: null }, // encrypted
    uan:                { type: String, default: null }, // encrypted (UAN / PF account)

    // ─── Salary structure (plaintext — not PII, but still sensitive) ─────────
    ctc: {
        type: Number,
        default: 0,
        min: 0,
    },
    basicSalary: {
        type: Number,
        default: 0,
        min: 0,
    },
    hra: {
        type: Number,
        default: 0,
        min: 0,
    },
    allowances: {
        type: Number,
        default: 0,
        min: 0,
    },

    // Override flag: if true, these salary fields take precedence over
    // PayrollSettings percentage-based computation
    useFixedSalary: {
        type: Boolean,
        default: false,
    },

    isActive: {
        type: Boolean,
        default: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

employeeFinancialProfileSchema.index({ isActive: 1 });

module.exports = mongoose.model('EmployeeFinancialProfile', employeeFinancialProfileSchema);
