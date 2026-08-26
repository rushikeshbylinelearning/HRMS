'use strict';
// models/SalarySlip.js
//
// One computed salary slip per employee per payroll run.

const mongoose = require('mongoose');

const STATUSES = ['generated', 'sent', 'viewed'];

const salarySlipSchema = new mongoose.Schema({
    payrollRunId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollRun',
        required: true,
        index: true,
    },
    // AMS employee identifier (string, matches EmployeeFinancialProfile.employeeId)
    employeeId: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    employeeName: {
        type: String,
        trim: true,
    },
    month: { type: Number, required: true, min: 1, max: 12 },
    year:  { type: Number, required: true },

    // ─── Earnings ──────────────────────────────────────────────────────────
    basicSalary:  { type: Number, default: 0 },
    hra:          { type: Number, default: 0 },
    allowances:   { type: Number, default: 0 },
    overtimePay:  { type: Number, default: 0 },
    bonus:        { type: Number, default: 0 },
    grossPay:     { type: Number, default: 0 },

    // ─── Deductions ────────────────────────────────────────────────────────
    deductions: {
        pf:              { type: Number, default: 0 },
        esi:             { type: Number, default: 0 },
        professionalTax: { type: Number, default: 0 },
        tds:             { type: Number, default: 0 },
        lopDeduction:    { type: Number, default: 0 }, // Loss of Pay
        other:           { type: Number, default: 0 },
    },
    totalDeductions: { type: Number, default: 0 },
    netPay:          { type: Number, default: 0 },

    // ─── Attendance data pulled from AMS ──────────────────────────────────
    attendanceData: {
        presentDays:     { type: Number, default: 0 },
        paidLeaveDays:   { type: Number, default: 0 },
        unpaidLeaveDays: { type: Number, default: 0 },
        halfDays:        { type: Number, default: 0 },
        lopDays:         { type: Number, default: 0 },
        overtimeHours:   { type: Number, default: 0 },
        workingDays:     { type: Number, default: 0 },
    },

    // ─── B2 storage ────────────────────────────────────────────────────────
    storageKey: {
        type: String,
        default: null,
    },

    status: {
        type: String,
        enum: STATUSES,
        default: 'generated',
    },

    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ─── Withhold ─────────────────────────────────────────────────────────
    // Admin hold preventing this slip from being paid
    withheld: {
        isWithheld:      { type: Boolean, default: false },
        reason:          { type: String, trim: true },
        withheldBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        withheldAt:      { type: Date },
        releasedInRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun' },
    },

    // ─── Skip ─────────────────────────────────────────────────────────────
    // Removes employee from this run's totals entirely
    skipped: { type: Boolean, default: false },

    // ─── Arrears ──────────────────────────────────────────────────────────
    // Confirmed new-joinee arrears entries (never auto-applied)
    arrears: [{
        amount:      { type: Number, required: true },
        reason:      { type: String, trim: true },
        sourceRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun' },
        addedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        addedAt:     { type: Date, default: Date.now },
    }],

    // ─── LOP Adjustments ──────────────────────────────────────────────────
    // Additive log; payrollCompute sums these, never overwrites base
    lopAdjustments: [{
        days:        { type: Number, required: true },
        reason:      { type: String, trim: true },
        type:        { type: String, enum: ['reversal', 'manual_addition'], required: true },
        sourceRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun' },
        appliedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        appliedAt:   { type: Date, default: Date.now },
    }],

    // ─── One-time Entries ─────────────────────────────────────────────────
    // Additive log of one-time earnings/deductions
    oneTimeEntries: [{
        label:   { type: String, required: true, trim: true, maxlength: 200 },
        amount:  { type: Number, required: true },
        kind:    { type: String, enum: ['earning', 'deduction'], required: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        addedAt: { type: Date, default: Date.now },
    }],

    // ─── Per-slip payment tracking ────────────────────────────────────────
    // Independent of run-level status
    paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt:        { type: Date },
    paidBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paymentMode:   { type: String, enum: ['bankTransfer', 'cheque', 'cash'] },

    // ─── Pending Arrears Suggestion ───────────────────────────────────────
    // From Phase 8 new-joinee detection.
    // Not confirmed — admin must explicitly approve before it writes to arrears[]
    pendingArrearsSuggestion: {
        amount:     { type: Number },
        reason:     { type: String },
        computedAt: { type: Date },
        dismissed:  { type: Boolean, default: false },
    },
}, { timestamps: true });

salarySlipSchema.index({ payrollRunId: 1, employeeId: 1 }, { unique: true });
salarySlipSchema.index({ employeeId: 1, year: 1, month: 1 });

module.exports = mongoose.model('SalarySlip', salarySlipSchema);
module.exports.STATUSES = STATUSES;
