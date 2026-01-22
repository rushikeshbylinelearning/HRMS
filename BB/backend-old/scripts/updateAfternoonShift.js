const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('../db');

// Import the Shift model
const Shift = require('../models/Shift');

async function updateAfternoonShift() {
  try {
    // Connect to the database
    await connectDB();
    
    // Get the Shift model
    const ShiftModel = mongoose.model('Shift');
    
    // Find the Afternoon Shift
    const afternoonShift = await ShiftModel.findOne({ shiftName: 'Afternoon Shift' });
    
    if (!afternoonShift) {
      console.error('Error: Afternoon Shift not found in the database');
      process.exit(1);
    }
    
    console.log('Current Afternoon Shift configuration:');
    console.log({
      shiftName: afternoonShift.shiftName,
      shiftType: afternoonShift.shiftType,
      startTime: afternoonShift.startTime,
      endTime: afternoonShift.endTime,
      durationHours: afternoonShift.durationHours,
      paidBreakMinutes: afternoonShift.paidBreakMinutes,
      notes: afternoonShift.notes
    });
    
    // Update the shift to be a Flexible Shift
    afternoonShift.shiftType = 'Flexible';
    afternoonShift.notes = 'Flexible shift – timings are indicative only; no sanctions applied.';
    
    // Save the updated shift
    const updatedShift = await afternoonShift.save();
    
    console.log('\nAfternoon Shift has been updated to Flexible Shift:');
    console.log({
      shiftName: updatedShift.shiftName,
      shiftType: updatedShift.shiftType,
      startTime: updatedShift.startTime,
      endTime: updatedShift.endTime,
      durationHours: updatedShift.durationHours,
      paidBreakMinutes: updatedShift.paidBreakMinutes,
      notes: updatedShift.notes
    });
    
    console.log('\n✅ Successfully updated Afternoon Shift to Flexible Shift');
    process.exit(0);
  } catch (error) {
    console.error('Error updating Afternoon Shift:', error);
    process.exit(1);
  }
}

// Run the function
updateAfternoonShift();
