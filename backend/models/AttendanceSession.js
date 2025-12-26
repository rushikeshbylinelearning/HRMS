// backend/models/AttendanceSession.js
const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
  attendanceLog: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceLog', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date }, // null if session is still active
  logoutType: { 
    type: String, 
    enum: ['MANUAL', 'AUTO'], 
    default: 'MANUAL' 
  }, // Track if logout was manual or automatic
  autoLogoutReason: { type: String }, // Reason for auto-logout (e.g., "Exceeded expected logout time + buffer")
}, { timestamps: true });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);