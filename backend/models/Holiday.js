// backend/models/Holiday.js
const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    date: {
        type: Date,
        required: function() {
            return !this.isTentative; // Date is required only if not tentative
        },
        default: null,
    },
    isTentative: {
        type: Boolean,
        default: false,
    },
    day: {
        type: String,
        trim: true,
        // Store day as provided (can be single or multiple days)
    },
}, { timestamps: true });

// Compound index: unique date only if date exists and not tentative
holidaySchema.index({ date: 1 }, { 
    unique: true, 
    sparse: true, // Only index documents where date exists
    partialFilterExpression: { isTentative: false }
});

// Index for tentative holidays (one per name)
holidaySchema.index({ name: 1, isTentative: 1 }, { 
    unique: true, 
    partialFilterExpression: { isTentative: true }
});

module.exports = mongoose.model('Holiday', holidaySchema);