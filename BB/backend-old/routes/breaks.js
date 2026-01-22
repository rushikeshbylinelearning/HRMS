// backend/routes/breaks.js

const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const ExtraBreakRequest = require('../models/ExtraBreakRequest');
const NewNotificationService = require('../services/NewNotificationService');
const cache = require('../utils/cache');
const cacheService = require('../services/cacheService');
const { invalidateStatus } = require('../services/statusCache');
const { getISTNow, getISTDateString } = require('../utils/istTime');
const { 
    UNPAID_BREAK_ALLOWANCE_MINUTES, 
    EXTRA_BREAK_ALLOWANCE_MINUTES,
    PAID_BREAK_ALLOWANCE_MINUTES 
} = require('../config/shiftPolicy');

const router = express.Router();

router.post('/start', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    const { breakType } = req.body;
    const today = getISTDateString();

    if (!breakType || !['Paid', 'Unpaid', 'Extra'].includes(breakType)) {
        return res.status(400).json({ error: 'A valid break type is required.' });
    }

    try {
        const log = await AttendanceLog.findOne({ user: userId, attendanceDate: today });
        if (!log) return res.status(400).json({ error: 'You must be clocked in to start a break.' });
        
        // ... (rest of the validation logic is fine)
        const activeSession = await AttendanceSession.findOne({ attendanceLog: log._id, endTime: null });
        if (!activeSession) return res.status(400).json({ error: 'You must be in an active work session to start a break.' });
        const activeBreak = await BreakLog.findOne({ attendanceLog: log._id, endTime: null });
        if (activeBreak) return res.status(400).json({ error: 'You are already on a break.' });
        if (breakType === 'Extra') {
            const availableRequest = await ExtraBreakRequest.findOne({ user: userId, attendanceLog: log._id, status: 'Approved', isUsed: false });
            if (!availableRequest) return res.status(403).json({ error: 'You do not have an approved extra break to use.' });
            availableRequest.isUsed = true;
            await availableRequest.save();
        }

        const newBreak = await BreakLog.create({
            attendanceLog: log._id,
            userId: userId,
            type: breakType,
            breakType: breakType,
            startTime: getISTNow()
        });

        const user = await User.findById(userId);
        if (user) {
            // FIX: Prevent user from getting their own notification
            if (user.role !== 'Admin' && user.role !== 'HR') {
                NewNotificationService.createAndEmitNotification({
                    message: `You have started a ${breakType} break.`,
                    type: 'info',
                    userId,
                    userName: user.fullName,
                    recipientType: 'user',
                    category: 'break',
                }).catch(err => console.error('Error sending break start confirmation to user:', err));
            }
            // Always notify admins
            NewNotificationService.notifyBreakStart(userId, user.fullName, breakType)
                .catch(err => console.error('Error sending break start notification to admins:', err));
        }

        // PHASE 4 OPTIMIZATION: Cache invalidation on mutation
        // Invalidate status cache for this user and date
        const cacheKey = `status:${userId}:${today}`;
        cache.delete(cacheKey);
        invalidateStatus(userId, today);
        // Also invalidate dashboard summary cache
        cache.deletePattern(`dashboard-summary:*`);
        // Ensure Admin Dashboard cache refreshes after break start
        cacheService.invalidateDashboard(today);

        // Emit Socket.IO event for real-time updates (replaces polling)
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                io.emit('attendance_log_updated', {
                    logId: log._id,
                    userId: userId,
                    attendanceDate: today,
                    timestamp: getISTNow().toISOString(),
                    message: `${user.fullName} started a ${breakType} break`
                });
                console.log(`📡 Emitted attendance_log_updated event for break start ${log._id}`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        res.status(201).json({ message: 'Break started successfully.', break: newBreak });
    } catch (error) {
        console.error('Start Break Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// =================================================================
// CRITICAL FIX: Explicit break ending with breakId parameter
// =================================================================
//
// PREVIOUS BUG: Frontend sent empty payload to /breaks/end
// Backend tried to infer active break, causing 400 errors when inference failed
//
// NEW FIX: Backend accepts optional breakId parameter for explicit break ending
// Frontend now validates and sends { breakId: activeBreak._id }
// This eliminates ambiguity and prevents 400 errors
// =================================================================

router.post('/end', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    // NOTE: Frontend may send no body at all. Never destructure req.body directly.
    const body = req.body || {};
    const breakId = typeof body.breakId === 'string' && body.breakId.trim().length > 0
        ? body.breakId.trim()
        : undefined;

    try {
        let activeBreak;
        if (breakId) {
            // CASE 1: Explicit break end
            const breakDoc = await BreakLog.findById(breakId);
            if (!breakDoc) {
                return res.status(404).json({ error: 'Break not found.', code: 'BREAK_NOT_FOUND' });
            }
            if (String(breakDoc.userId) !== String(userId)) {
                return res.status(403).json({ error: 'Unauthorized break access.', code: 'UNAUTHORIZED_BREAK_ACCESS' });
            }
            if (breakDoc.endTime) {
                return res.status(400).json({ error: 'Break is already ended.', code: 'BREAK_ALREADY_ENDED' });
            }
            activeBreak = breakDoc;
        } else {
            // CASE 2: Implicit break end (default) - find most recent ACTIVE break for this user
            activeBreak = await BreakLog
                .findOne({ userId: userId, endTime: null })
                .sort({ startTime: -1, _id: -1 });
            if (!activeBreak) {
                return res.status(400).json({ error: 'No active break to end.', code: 'NO_ACTIVE_BREAK' });
            }
        }

        // Breaks are tied to an attendance log; update the correct log for this break
        const log = activeBreak.attendanceLog
            ? await AttendanceLog.findById(activeBreak.attendanceLog)
            : null;
        if (!log) {
            return res.status(500).json({ error: 'Attendance log not found for break.', code: 'ATTENDANCE_LOG_MISSING' });
        }

        const businessDate = log.attendanceDate || getISTDateString();
        
        // ... (rest of the break ending logic is fine)
        const breakEndTime = getISTNow();
        const startTime = new Date(activeBreak.startTime);
        if (Number.isNaN(startTime.getTime())) {
            return res.status(500).json({ error: 'Invalid break startTime.', code: 'INVALID_BREAK_START_TIME' });
        }
        const currentBreakDuration = Math.max(0, Math.round((breakEndTime - startTime) / (1000 * 60)));
        let penalty = 0, paidBreakToAdd = 0, unpaidBreakToAdd = 0;
        if (activeBreak.breakType === 'Paid') {
            const user = await User.findById(userId).populate('shiftGroup');
            const paidBreakAllowance = user?.shiftGroup?.paidBreakMinutes || PAID_BREAK_ALLOWANCE_MINUTES;
            const remainingPaidAllowance = paidBreakAllowance - log.paidBreakMinutesTaken;
            
            // CRITICAL FIX: Always add the FULL paid break duration to paidBreakMinutesTaken
            // The logout calculation will correctly identify excess beyond the allowance
            // This ensures required logout time extends when paid breaks exceed 30 minutes
            paidBreakToAdd = currentBreakDuration;
            
            // Calculate penalty for excess (for reporting purposes)
            if (currentBreakDuration > Math.max(0, remainingPaidAllowance)) {
                penalty = currentBreakDuration - Math.max(0, remainingPaidAllowance);
            }
        } else if (activeBreak.breakType === 'Unpaid' || activeBreak.breakType === 'Extra') {
            const allowance = activeBreak.breakType === 'Unpaid' ? UNPAID_BREAK_ALLOWANCE_MINUTES : EXTRA_BREAK_ALLOWANCE_MINUTES;
            // The FULL unpaid break duration extends the shift, not just the allowance
            unpaidBreakToAdd = currentBreakDuration;
            // Penalty is tracked separately for reporting, but doesn't affect shift extension
            if (currentBreakDuration > allowance) {
                penalty = currentBreakDuration - allowance;
            }
        }
        // Atomic end: ensures we never overwrite a previously-ended break (race-safe, deterministic)
        const updatedBreak = await BreakLog.findOneAndUpdate(
            { _id: activeBreak._id, endTime: null },
            { $set: { endTime: breakEndTime, durationMinutes: currentBreakDuration } },
            { new: true }
        );
        if (!updatedBreak) {
            return res.status(400).json({ error: 'Break is already ended.', code: 'BREAK_ALREADY_ENDED' });
        }
        const updatePayload = { $inc: {} };
        if (penalty > 0) updatePayload.$inc.penaltyMinutes = penalty;
        if (paidBreakToAdd > 0) updatePayload.$inc.paidBreakMinutesTaken = paidBreakToAdd;
        if (unpaidBreakToAdd > 0) updatePayload.$inc.unpaidBreakMinutesTaken = unpaidBreakToAdd;
        if (Object.keys(updatePayload.$inc).length > 0) {
            await AttendanceLog.findByIdAndUpdate(log._id, updatePayload);
        }

        const user = await User.findById(userId);
        if (user) {
            // FIX: Prevent user from getting their own notification
            if (user.role !== 'Admin' && user.role !== 'HR') {
                NewNotificationService.createAndEmitNotification({
                    message: `Your ${activeBreak.breakType} break has ended.`,
                    type: 'info',
                    userId,
                    userName: user.fullName,
                    recipientType: 'user',
                    category: 'break',
                }).catch(err => console.error('Error sending break end confirmation to user:', err));
            }
            // Always notify admins
            NewNotificationService.notifyBreakEnd(userId, user.fullName, activeBreak.breakType)
                .catch(err => console.error('Error sending break end notification to admins:', err));
        }

        // PHASE 4 OPTIMIZATION: Cache invalidation on mutation
        // Invalidate status cache for this user and date
        const cacheKey = `status:${userId}:${businessDate}`;
        cache.delete(cacheKey);
        invalidateStatus(userId, businessDate);
        // Also invalidate dashboard summary cache
        cache.deletePattern(`dashboard-summary:*`);
        // Also invalidate existing cacheService dashboard cache
        cacheService.invalidateDashboard(businessDate);

        // Emit Socket.IO event for real-time updates (replaces polling)
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                io.emit('attendance_log_updated', {
                    logId: log._id,
                    userId: userId,
                    attendanceDate: businessDate,
                    timestamp: getISTNow().toISOString(),
                    message: `${user?.fullName || 'User'} ended ${activeBreak.breakType} break`
                });
                console.log(`📡 Emitted attendance_log_updated event for break end ${log._id}`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        res.json({ message: 'Break ended successfully.', break: updatedBreak });
    } catch (error) {
        console.error('End Break Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Extra break request logic is fine as it correctly notifies admins and confirms with user.
router.post('/request-extra', authenticateToken, async (req, res) => {
    // ... this route's logic is already correct
    const { userId } = req.user;
    const { reason } = req.body;
    const today = getISTDateString();
    if (!reason || reason.trim().length === 0) return res.status(400).json({ error: 'A reason is required.' });
    try {
        const log = await AttendanceLog.findOne({ user: userId, attendanceDate: today });
        if (!log) return res.status(400).json({ error: 'You must be clocked in.' });
        const existingRequest = await ExtraBreakRequest.findOne({ user: userId, attendanceLog: log._id });
        if (existingRequest) return res.status(400).json({ error: 'You have already requested an extra break today.' });
        const newRequest = await ExtraBreakRequest.create({ user: userId, attendanceLog: log._id, reason: reason.trim() });
        const user = await User.findById(userId);
        if (user) {
            NewNotificationService.notifyExtraBreakRequest(userId, user.fullName, reason.trim()).catch(err => console.error(err));
            NewNotificationService.createAndEmitNotification({
                message: `Your extra break request for "${reason.trim()}" has been submitted.`,
                type: 'info', userId, userName: user.fullName, recipientType: 'user', category: 'break'
            }).catch(err => console.error(err));
        }
        
        // Invalidate dashboard cache to ensure new extra break request appears in recent activity
        const cacheService = require('../services/cacheService');
        cacheService.invalidateDashboard(today);
        
        res.status(201).json({ message: 'Your request has been sent for approval.', request: newRequest });
    } catch (error) {
        console.error('Extra Break Request Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;