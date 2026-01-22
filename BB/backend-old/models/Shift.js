// backend/models/Shift.js
const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  shiftName: { type: String, required: true },
  shiftType: { 
    type: String, 
    enum: ['Fixed', 'Flexible'], 
    required: true 
  },
  startTime: { 
    type: String,
    validate: {
      validator: function(v) {
        // Only validate if shiftType is Fixed
        if (this.shiftType === 'Fixed') {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        }
        return true;
      },
      message: props => `${props.value} is not a valid time format (HH:mm)`
    }
  },
  endTime: { 
    type: String,
    validate: {
      validator: function(v) {
        // Only validate if shiftType is Fixed
        if (this.shiftType === 'Fixed') {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        }
        return true;
      },
      message: props => `${props.value} is not a valid time format (HH:mm)`
    }
  },
  durationHours: { 
    type: Number, 
    required: function() { 
      // Only required for fixed shifts
      return this.shiftType === 'Fixed'; 
    },
    default: 0 // Default to 0 for flexible shifts
  },
  paidBreakMinutes: { 
    type: Number, 
    default: 60,
    min: 0
  },
}, { 
  timestamps: true,
  // Add validation for the entire document
  validateBeforeSave: true
});

shiftSchema.pre('save', function(next) {
  // Only process if relevant fields were modified
  if (this.isModified('shiftType') || this.isModified('startTime') || this.isModified('endTime')) {
    if (this.shiftType === 'Fixed') {
      // For fixed shifts, ensure times are provided and calculate duration
      if (this.startTime && this.endTime) {
        try {
          const [startH, startM] = this.startTime.split(':').map(Number);
          const [endH, endM] = this.endTime.split(':').map(Number);

          const startDate = new Date(0, 0, 0, startH, startM, 0);
          const endDate = new Date(0, 0, 0, endH, endM, 0);

          let diffHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
          if (diffHours < 0) {
            diffHours += 24; // Handle overnight shifts
          }
          
          this.durationHours = diffHours;
        } catch (e) {
          console.error("Could not parse time for duration calculation", e);
          // Fallback to 0 if time parsing fails
          this.durationHours = 0;
        }
      }
    } else if (this.shiftType === 'Flexible') {
      // For flexible shifts, clear fixed times and set default duration
      this.startTime = null;
      this.endTime = null;
      this.durationHours = this.durationHours || 0; // Ensure duration is set
    }
  }
  
  // Ensure paidBreakMinutes is a number
  if (typeof this.paidBreakMinutes !== 'number' || isNaN(this.paidBreakMinutes)) {
    this.paidBreakMinutes = 60; // Default to 60 minutes if invalid
  }
  
  next();
});

module.exports = mongoose.model('Shift', shiftSchema);