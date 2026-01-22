// backend/models/BreakLog.js
const mongoose = require('mongoose');

const breakLogSchema = new mongoose.Schema({
  attendanceLog: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceLog' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['Paid', 'Unpaid', 'Extra', 'Auto-Unpaid-Break'], required: true },
  breakType: { type: String, enum: ['Paid', 'Unpaid', 'Extra'], required: true }, // Keep for backward compatibility
  startTime: { type: Date, required: true },
  endTime: { type: Date }, // null if active
  durationMinutes: { type: Number, default: 0 },
  reason: { type: String },
  isAutoBreak: { type: Boolean, default: false },
}, { timestamps: true });

// Admin Dashboard query alignment: join by attendanceLog and active-break lookup
breakLogSchema.index({ attendanceLog: 1 }, { background: true });
breakLogSchema.index({ endTime: 1 }, { background: true });
// Fast, deterministic lookup for "most recent active break for a user"
breakLogSchema.index({ userId: 1, endTime: 1, startTime: -1 }, { background: true });

module.exports = mongoose.model('BreakLog', breakLogSchema);