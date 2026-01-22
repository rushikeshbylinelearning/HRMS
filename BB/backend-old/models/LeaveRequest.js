// backend/models/LeaveRequest.js
const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestType: {
        type: String,
        enum: ['Planned', 'Sick', 'Loss of Pay', 'Compensatory', 'Backdated Leave', 'Casual', 'YEAR_END', 'Comp-Off'],
        required: true,
    },
    leaveType: {
        type: String,
        enum: ['Full Day', 'Half Day - First Half', 'Half Day - Second Half'],
        default: 'Full Day',
    },
    leaveDates: [{ type: Date, required: true }],
    alternateDate: { type: Date }, // Specifically for 'Compensatory' type
    reason: { type: String, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    isBackdated: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionNotes: { type: String }, // Notes provided when rejecting a leave request
    medicalCertificate: { type: String }, // URL/path to medical certificate file (required for Sick leave)
    appliedAfterReturn: { type: Boolean, default: false }, // For sick leave tracking
    halfYearPeriod: { 
        type: String, 
        enum: ['First Half', 'Second Half'], 
        // Tracks which half of the year for Planned leaves (Jan-Jun or Jul-Dec)
    },
    // Year-End specific fields
    yearEndSubType: {
        type: String,
        enum: ['CARRY_FORWARD', 'ENCASH'],
        // Only used when requestType is 'YEAR_END'
    },
    yearEndLeaveType: {
        type: String,
        enum: ['Sick', 'Casual', 'Planned'],
        // The leave type for Year-End action (maps to leaveBalances: sick, casual, paid)
    },
    yearEndDays: {
        type: Number,
        // Number of days for Year-End action
    },
    yearEndYear: {
        type: Number,
        // Year for which the Year-End request is made (e.g., 2025)
    },
    isProcessed: {
        type: Boolean,
        default: false,
        // Prevents double processing of Year-End approvals
    },
    // Anti-exploitation validation fields
    validationBlocked: {
        type: Boolean,
        default: false,
        // Indicates if leave was blocked by anti-exploitation rules
    },
    blockedReason: {
        type: String,
        // Reason why leave was blocked (e.g., "FRIDAY_SATURDAY_CLUBBING", "MONTHLY_FREQUENCY_CAP", "WORKING_DAYS_DILUTION")
    },
    blockedRules: [{
        type: String,
        // Array of rules that blocked the leave
    }],
    // Admin override fields
    adminOverride: {
        type: Boolean,
        default: false,
        // Indicates if admin overrode the validation block
    },
    overrideReason: {
        type: String,
        // Reason provided by admin for overriding the block
    },
    overriddenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // Admin who overrode the validation
    },
    overriddenAt: {
        type: Date,
        // Timestamp when override was applied
    },
}, { timestamps: true });

// Compound unique index to prevent duplicate Year-End requests
// Ensures one request per employee, leaveType, and year for YEAR_END type
// Only applies to Pending and Approved requests (allows Rejected to be resubmitted)
leaveRequestSchema.index(
    { 
        employee: 1, 
        requestType: 1, 
        yearEndLeaveType: 1, 
        yearEndYear: 1 
    },
    { 
        unique: true,
        partialFilterExpression: {
            requestType: 'YEAR_END',
            status: { $in: ['Pending', 'Approved'] }
        },
        name: 'unique_year_end_request',
        background: true
    }
);

// Admin Dashboard query alignment: pending queue ordering
leaveRequestSchema.index({ status: 1, createdAt: -1 }, { background: true });
// Admin Dashboard query alignment: "on leave today" ($elemMatch) and other status/date filters
// Note: leaveDates is an array => this is a multikey index.
leaveRequestSchema.index({ status: 1, leaveDates: 1 }, { background: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);