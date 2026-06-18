const express = require("express");
const router = express.Router();
const AnnouncementMessage = require("../models/AnnouncementMessage");
const AnnouncementRead = require("../models/AnnouncementRead");
const authenticateToken = require("../middleware/authenticateToken");

// PERFORMANCE FIX: In-memory cache for the announcements list.
// Announcements change rarely (admin posts them). Cache for 60 seconds.
// Cache is invalidated on POST/PUT/DELETE/PATCH so users always see fresh data after writes.
let _announcementsCache = null;
let _announcementsCacheAt = 0;
const ANNOUNCEMENTS_CACHE_TTL_MS = 60 * 1000; // 60 seconds

function invalidateAnnouncementsCache() {
  _announcementsCache = null;
  _announcementsCacheAt = 0;
}

// Helper: transform fullName → firstName/lastName (compute at write-time, stored at read-time)
function transformMessages(messages) {
  return messages.map(msg => {
    const msgObj = typeof msg.toObject === 'function' ? msg.toObject() : msg;
    if (msgObj.sender && msgObj.sender.fullName) {
      const nameParts = msgObj.sender.fullName.split(' ');
      msgObj.sender.firstName = nameParts[0] || '';
      msgObj.sender.lastName = nameParts.slice(1).join(' ') || '';
    }
    return msgObj;
  });
}

// Get last 50 messages
router.get("/", authenticateToken, async (req, res) => {
  try {
    const now = Date.now();

    // Return from memory cache if still fresh
    if (_announcementsCache && (now - _announcementsCacheAt) < ANNOUNCEMENTS_CACHE_TTL_MS) {
      // Allow browser to cache for 30 seconds (shorter than server cache so users stay fresh)
      res.set('Cache-Control', 'private, max-age=30');
      return res.json(_announcementsCache);
    }

    const messages = await AnnouncementMessage.find()
      .populate("sender", "fullName role profileImageUrl")
      .sort({ pinned: -1, createdAt: -1 })
      .limit(50)
      .lean(); // lean() — no need for Mongoose doc methods on read

    const transformed = transformMessages(messages).reverse();

    // Cache result
    _announcementsCache = transformed;
    _announcementsCacheAt = now;

    res.set('Cache-Control', 'private, max-age=30');
    res.json(transformed);
  } catch (err) {
    console.error("[Announcements] Error fetching messages:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Post message
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { message, type, isTEABreak, teaBreakType } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Message is required" });
    }

    if (message.length > 1000) {
      return res.status(400).json({ message: "Message too long (max 1000 characters)" });
    }

    const User = require("../models/User");
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const createPayload = {
      sender: user._id,
      message: message.trim(),
      type: type || "general",
    };

    if (isTEABreak === true) {
      if (!['Admin', 'HR'].includes(req.user.role)) {
        return res.status(403).json({ message: "Only Admin/HR can post tea break announcements" });
      }
      if (!teaBreakType || !['morning', 'evening'].includes(teaBreakType)) {
        return res.status(400).json({ message: "teaBreakType must be 'morning' or 'evening'" });
      }
      const { getISTNow } = require('../utils/istTime');
      createPayload.isTEABreak = true;
      createPayload.teaBreakType = teaBreakType;
      createPayload.teaBreakStartedAt = getISTNow();
    }

    const newMessage = await AnnouncementMessage.create(createPayload);

    const populated = await newMessage.populate(
      "sender",
      "fullName role profileImageUrl"
    );

    // Transform fullName to firstName/lastName for frontend compatibility
    const msgObj = populated.toObject();
    if (msgObj.sender && msgObj.sender.fullName) {
      const nameParts = msgObj.sender.fullName.split(' ');
      msgObj.sender.firstName = nameParts[0] || '';
      msgObj.sender.lastName = nameParts.slice(1).join(' ') || '';
    }

    // Invalidate list cache so next GET reflects new message immediately
    invalidateAnnouncementsCache();

    // Server-side broadcast — do not rely on the sender's browser socket.emit
    try {
      const { getIO } = require('../socketManager');
      const io = getIO();
      if (io) {
        io.to('announcements')
          .except(`user_${req.user.userId}`)
          .emit('receiveAnnouncement', msgObj);
      }
    } catch (socketErr) {
      console.error('[Announcements] receiveAnnouncement emit failed:', socketErr.message);
    }

    if (msgObj.isTEABreak && msgObj.teaBreakStartedAt) {
      const teaPayload = {
        announcementId: msgObj._id,
        teaBreakStartedAt: msgObj.teaBreakStartedAt,
        teaBreakType: msgObj.teaBreakType,
        durationMinutes: 10,
      };

      try {
        const { getIO } = require('../socketManager');
        const io = getIO();
        if (io) {
          io.to('announcements').emit('tea_break_started', teaPayload);
        }
      } catch (socketErr) {
        console.error('[Announcements] tea_break_started emit failed:', socketErr.message);
      }

      try {
        const { scheduleTeaBreakEnforcement } = require('../jobs/teaBreakEnforcer');
        scheduleTeaBreakEnforcement(msgObj._id, msgObj.teaBreakStartedAt);
      } catch (jobErr) {
        console.error('[Announcements] tea break enforcer schedule failed:', jobErr.message);
      }
    }

    res.status(201).json(msgObj);
  } catch (err) {
    console.error("[Announcements] Error posting message:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update message (only sender or admin can update)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Message is required" });
    }

    if (message.length > 1000) {
      return res.status(400).json({ message: "Message too long (max 1000 characters)" });
    }

    const announcement = await AnnouncementMessage.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    // Check if user is the sender or an admin/HR
    const isOwner = announcement.sender.toString() === req.user.userId;
    const isAdmin = ['Admin', 'HR'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to update this announcement" });
    }

    announcement.message = message.trim();
    await announcement.save();

    const populated = await announcement.populate(
      "sender",
      "fullName role profileImageUrl"
    );

    // Transform fullName to firstName/lastName for frontend compatibility
    const msgObj = populated.toObject();
    if (msgObj.sender && msgObj.sender.fullName) {
      const nameParts = msgObj.sender.fullName.split(' ');
      msgObj.sender.firstName = nameParts[0] || '';
      msgObj.sender.lastName = nameParts.slice(1).join(' ') || '';
    }

    invalidateAnnouncementsCache();
    res.json(msgObj);
  } catch (err) {
    console.error("[Announcements] Error updating message:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete message (only sender or admin can delete)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await AnnouncementMessage.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    // Check if user is the sender or an admin/HR
    const isOwner = announcement.sender.toString() === req.user.userId;
    const isAdmin = ['Admin', 'HR'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to delete this announcement" });
    }

    await AnnouncementMessage.findByIdAndDelete(id);

    invalidateAnnouncementsCache();
    res.json({ message: "Announcement deleted successfully", id });
  } catch (err) {
    console.error("[Announcements] Error deleting message:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Pin/Unpin message (admin/HR only)
router.patch("/:id/pin", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { pinned } = req.body;

    // Only admin/HR can pin messages
    if (!['Admin', 'HR'].includes(req.user.role)) {
      return res.status(403).json({ message: "Only Admin/HR can pin announcements" });
    }

    const announcement = await AnnouncementMessage.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    announcement.pinned = pinned;
    await announcement.save();

    const populated = await announcement.populate(
      "sender",
      "fullName role profileImageUrl"
    );

    // Transform fullName to firstName/lastName for frontend compatibility
    const msgObj = populated.toObject();
    if (msgObj.sender && msgObj.sender.fullName) {
      const nameParts = msgObj.sender.fullName.split(' ');
      msgObj.sender.firstName = nameParts[0] || '';
      msgObj.sender.lastName = nameParts.slice(1).join(' ') || '';
    }

    invalidateAnnouncementsCache();
    res.json(msgObj);
  } catch (err) {
    console.error("[Announcements] Error pinning message:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark announcements as read (for cross-device sync)
router.post("/mark-read", authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    
    await AnnouncementRead.findOneAndUpdate(
      { userId: req.user.userId },
      { lastReadTime: now },
      { upsert: true, new: true }
    );

    console.log(`[Announcements] User ${req.user.userId} marked as read at ${now.toISOString()}`);
    
    res.json({ 
      success: true, 
      lastReadTime: now.toISOString() 
    });
  } catch (err) {
    console.error("[Announcements] Error marking as read:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get last read time (for cross-device sync)
router.get("/last-read", authenticateToken, async (req, res) => {
  try {
    const record = await AnnouncementRead.findOne({ userId: req.user.userId });
    
    res.json({ 
      lastReadTime: record?.lastReadTime?.toISOString() || null 
    });
  } catch (err) {
    console.error("[Announcements] Error fetching last read time:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
