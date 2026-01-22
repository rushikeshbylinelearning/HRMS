// backend/models/AttendanceLog.js
const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendanceDate: { type: String, required: true }, // YYYY-MM-DD
  clockInTime: { type: Date }, // Made optional for leave days
  clockOutTime: { type: Date },
  shiftDurationMinutes: { type: Number, required: true },
  penaltyMinutes: { type: Number, default: 0 },
  paidBreakMinutesTaken: { type: Number, default: 0 },
  // --- ADDED THIS FIELD to track unpaid breaks ---
  unpaidBreakMinutesTaken: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  // --- ANALYTICS FIELDS ---
  isLate: { type: Boolean, default: false },
  isHalfDay: { type: Boolean, default: false },
  lateMinutes: { type: Number, default: 0 },
  lateCount: { type: Number, default: 0 }, // Weekly late count
  attendanceStatus: { 
    type: String, 
    enum: ['On-time', 'Late', 'Half-day', 'Absent', 'Leave'], 
    default: 'On-time' 
  },
  // Reference to LeaveRequest if this attendance record is for a leave day
  leaveRequest: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'LeaveRequest',
    default: null 
  },
  totalWorkingHours: { type: Number, default: 0 }, // in hours
  adminOverride: { 
    type: String, 
    enum: ['None', 'Override Half Day', 'Override Late'], 
    default: 'None' 
  },
  overrideReason: { type: String, default: '' },
  // Half-day reason tracking (structured)
  halfDayReasonCode: {
    type: String,
    enum: ['LATE_LOGIN', 'EARLY_LOGOUT', 'INSUFFICIENT_WORKING_HOURS', 'MANUAL_ADMIN', 'POLICY_VIOLATION', null],
    default: null
  },
  halfDayReasonText: { type: String, default: '' }, // Human-readable reason
  halfDaySource: {
    type: String,
    enum: ['AUTO', 'MANUAL', null],
    default: null
  },
  overriddenByAdmin: { type: Boolean, default: false },
  overriddenAt: { type: Date },
  overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Track if late notification email has been sent
  lateNotificationSent: { type: Boolean, default: false },
  // Auto-logout tracking fields
  logoutType: { 
    type: String, 
    enum: ['MANUAL', 'AUTO', 'SYSTEM'], 
    default: 'MANUAL' 
  }, // Track if clock-out was manual, automatic, or system cleanup
  autoLogoutReason: { type: String }, // Reason for auto-logout
  isLegacySession: { type: Boolean, default: false }, // Flag for legacy/orphan sessions
  // FIXED: Preserve worked hours when backdated leave approved
  preservedWorkingHours: { type: Number }, // Original working hours before leave approval
  preservedClockIn: { type: Date }, // Original clock-in before leave approval
  preservedClockOut: { type: Date }, // Original clock-out before leave approval
}, { timestamps: true });

// Ensure a user can only have one log per day
attendanceLogSchema.index({ user: 1, attendanceDate: 1 }, { unique: true });
// Admin Dashboard query alignment: fast lookup by business date
attendanceLogSchema.index({ attendanceDate: 1 }, { background: true });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);