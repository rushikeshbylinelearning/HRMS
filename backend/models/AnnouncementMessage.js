const mongoose = require("mongoose");

const announcementMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
      trim: true,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["general", "important", "holiday", "policy"],
      default: "general",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "AnnouncementMessage",
  announcementMessageSchema
);
