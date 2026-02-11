const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    version: {
        type: String,
        required: true,
        trim: true
    },
    effectiveFrom: {
        type: Date,
        required: true
    },
    department: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Archived'],
        default: 'Active'
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    replacedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Policy'
    }
}, {
    timestamps: true
});

// Index for faster queries
policySchema.index({ status: 1, effectiveFrom: -1 });
policySchema.index({ name: 1, version: 1 });

const Policy = mongoose.model('Policy', policySchema);

module.exports = Policy;
