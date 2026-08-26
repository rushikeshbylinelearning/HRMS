'use strict';
// models/PayrollSettings.js
//
// Global payroll computation settings.
// Only one active document should exist (enforced by the singleton getter pattern
// in the controller). Uses findOneAndUpdate({ }, ..., { upsert: true }).

const mongoose = require('mongoose');

const payrollSettingsSchema = new mongoose.Schema({
    // Salary component percentages (applied to CTC annually → divide by 12 for monthly)
    basicPercentage:      { type: Number, default: 40,   min: 0, max: 100 },
    hraPercentage:        { type: Number, default: 20,   min: 0, max: 100 },
    allowancesPercentage: { type: Number, default: 15,   min: 0, max: 100 },

    // Statutory deductions
    pfPercentage:         { type: Number, default: 12,   min: 0, max: 100 }, // of basic
    esiPercentage:        { type: Number, default: 0.75, min: 0, max: 100 }, // of gross
    professionalTax:      { type: Number, default: 200,  min: 0 },           // flat per month
    tdsPercentage:        { type: Number, default: 5,    min: 0, max: 100 }, // of gross

    // LOP (Loss of Pay) deduction rate per day
    lopDailyRate: {
        type: Number,
        default: 0,
        min: 0,
        comment: 'If 0, computed as (monthlyGross / workingDaysInMonth)',
    },

    // Overtime rate per hour (in currency)
    overtimeHourlyRate: { type: Number, default: 0, min: 0 },

    // How many working days are in a standard month for LOP calculation
    standardWorkingDays: { type: Number, default: 26, min: 1, max: 31 },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('PayrollSettings', payrollSettingsSchema);
