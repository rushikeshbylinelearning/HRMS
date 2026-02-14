// backend/models/SystemAuditLog.js
/**
 * Audit log for system-level actions (e.g. auto half-day conversion, revert).
 * Used for compliance and debugging.
 */
const mongoose = require('mongoose');

const systemAuditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: ['AUTO_HALF_DAY_CONVERSION', 'AUTO_HALF_DAY_REVERT'],
    },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeName: { type: String },
    leaveId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest' },
    date: { type: String }, // YYYY-MM-DD for conversion date
    previousLeaveType: { type: String },
    previousRequestType: { type: String },
    newLeaveType: { type: String },
    newRequestType: { type: String },
    reason: { type: String },
    executedAt: { type: Date, default: Date.now },
    success: { type: Boolean, default: true },
    error: { type: String },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For revert: admin who reverted
}, { timestamps: true });

systemAuditLogSchema.index({ action: 1, executedAt: -1 }, { background: true });
systemAuditLogSchema.index({ leaveId: 1 }, { background: true });
systemAuditLogSchema.index({ employeeId: 1, date: 1 }, { background: true });

module.exports = mongoose.model('SystemAuditLog', systemAuditLogSchema);
