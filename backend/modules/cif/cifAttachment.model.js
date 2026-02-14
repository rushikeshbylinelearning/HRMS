const mongoose = require('mongoose');

const cifAttachmentSchema = new mongoose.Schema({
  cifId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CIF',
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  fileType: {
    type: String,
    required: true,
    trim: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
cifAttachmentSchema.index({ cifId: 1, createdAt: -1 });

module.exports = mongoose.model('CIFAttachment', cifAttachmentSchema);
