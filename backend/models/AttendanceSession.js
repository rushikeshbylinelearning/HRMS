// backend/models/AttendanceSession.js
const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
  attendanceLog: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceLog', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date }, // null if session is still active
  logoutType: { 
    type: String, 
    enum: ['MANUAL', 'AUTO', 'SYSTEM'], 
    default: 'MANUAL' 
  }, // Track if logout was manual, automatic, or system cleanup
  autoLogoutReason: { type: String }, // Reason for auto-logout (e.g., "Exceeded expected logout time + buffer")
  isLegacySession: { type: Boolean, default: false }, // Flag for legacy/orphan sessions
}, { timestamps: true });

// CRITICAL: Unique partial index to prevent duplicate active sessions per AttendanceLog
// This ensures at database level that only ONE session with endTime = null exists per attendanceLog
// This prevents race conditions where multiple clock-in requests create duplicate sessions
attendanceSessionSchema.index(
  { attendanceLog: 1 },
  {
    unique: true,
    partialFilterExpression: { endTime: null },
    name: 'unique_active_session_per_log'
  }
);

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);