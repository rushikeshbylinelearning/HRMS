'use strict';
// models/PayrollRun.js
//
// Represents one payroll processing cycle for a given month/year.
// Workflow: draft → finalized → paid

const mongoose = require('mongoose');

const STATUSES = ['draft', 'finalized', 'paid'];

const payrollRunSchema = new mongoose.Schema({
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
    },
    year: {
        type: Number,
        required: true,
        min: 2020,
    },
    status: {
        type: String,
        enum: STATUSES,
        default: 'draft',
    },
    // Number of employees included in this run
    employeeCount: {
        type: Number,
        default: 0,
    },
    totalGross: {
        type: Number,
        default: 0,
    },
    totalNet: {
        type: Number,
        default: 0,
    },
    notes: {
        type: String,
        trim: true,
    },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    finalizedAt: { type: Date },
    paidBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt:      { type: Date },

    // Run type — distinguishes regular monthly runs from off-cycle and resettlement runs
    payRunType: {
        type: String,
        enum: ['regular', 'offCycle', 'resettlement'],
        default: 'regular',
    },

    // Approval workflow — orthogonal to status field; does not replace it
    approvalStatus: {
        type: String,
        enum: ['none', 'submitted', 'approved', 'rejected'],
        default: 'none',
    },
    submittedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt:     { type: Date },
    approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt:      { type: Date },
    rejectedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt:      { type: Date },
    rejectionReason: { type: String, trim: true },

    // Scheduled payment date (informational, not enforced by the system)
    payDate: { type: Date },

    // Append-only run-level comments
    comments: [{
        authorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorEmail: { type: String, required: true, trim: true },
        text:        { type: String, required: true, trim: true, maxlength: 2000 },
        createdAt:   { type: Date, default: Date.now },
    }],
}, { timestamps: true });

// Partial unique index — only enforces uniqueness for regular runs (month/year combo)
// Off-cycle and resettlement runs for the same month/year are permitted
payrollRunSchema.index(
    { month: 1, year: 1 },
    {
        unique: true,
        partialFilterExpression: { payRunType: 'regular' },
        name: 'unique_regular_run_per_month',
    }
);
payrollRunSchema.index({ status: 1 });

module.exports = mongoose.model('PayrollRun', payrollRunSchema);
module.exports.STATUSES = STATUSES;
