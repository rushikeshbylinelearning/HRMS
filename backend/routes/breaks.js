// backend/routes/breaks.js

const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const ExtraBreakRequest = require('../models/ExtraBreakRequest');
const NewNotificationService = require('../services/NewNotificationService');
const { getUserDailyStatus } = require('../services/dailyStatusService');
const { formatDateIST, getTodayIST } = require('../utils/dateUtils');
const { deleteCache } = require('../utils/redisClient');
const { queueNotification } = require('../queues/notificationQueue');

const router = express.Router();

const UNPAID_BREAK_ALLOWANCE_MINUTES = 10;
const EXTRA_BREAK_ALLOWANCE_MINUTES = 10;

router.post('/start', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    const { breakType } = req.body;
    const today = formatDateIST(getTodayIST());

    if (!breakType || !['Paid', 'Unpaid', 'Extra'].includes(breakType)) {
        return res.status(400).json({ error: 'A valid break type is required.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const log = await AttendanceLog.findOne({ user: userId, attendanceDate: today }).session(session);
        if (!log) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'You must be clocked in to start a break.' });
        }
        
        const activeSession = await AttendanceSession.findOne({ attendanceLog: log._id, endTime: null }).session(session);
        if (!activeSession) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'You must be in an active work session to start a break.' });
        }

        // Atomic check: Only allow break start if no active break exists (idempotent)
        const existingActiveBreak = await BreakLog.findOne({ attendanceLog: log._id, endTime: null }).session(session);
        if (existingActiveBreak) {
            await session.abortTransaction();
            session.endSession();
            // Idempotent: If break already exists, return success with existing state
            const dailyStatus = await getUserDailyStatus(userId, today, {
                includeSessions: true,
                includeBreaks: true,
                includeAutoBreak: true
            });
            return res.status(200).json({ 
                message: 'Break already active.', 
                break: existingActiveBreak,
                serverStartTime: existingActiveBreak.startTime.toISOString(),
                calculatedLogoutTime: dailyStatus.calculatedLogoutTime,
                alreadyActive: true
            });
        }

        if (breakType === 'Extra') {
            const availableRequest = await ExtraBreakRequest.findOneAndUpdate(
                { user: userId, attendanceLog: log._id, status: 'Approved', isUsed: false },
                { $set: { isUsed: true } },
                { session, new: true }
            );
            if (!availableRequest) {
                await session.abortTransaction();
                session.endSession();
                return res.status(403).json({ error: 'You do not have an approved extra break to use.' });
            }
        }

        const serverStartTime = new Date();
        const newBreak = await BreakLog.create([{
            attendanceLog: log._id,
            userId: userId,
            type: breakType,
            breakType: breakType,
            startTime: serverStartTime
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // PARALLELIZATION: These queries are independent after transaction commit
        // - getUserDailyStatus reads attendance data (doesn't depend on user data)
        // - User.findById reads user data (doesn't depend on attendance data)
        // Both are read-only operations on different collections, safe to run concurrently
        const [dailyStatus, user] = await Promise.all([
            getUserDailyStatus(userId, today, {
                includeSessions: true,
                includeBreaks: true,
                includeAutoBreak: true
            }),
            User.findById(userId)
        ]);
        // Queue notifications for background processing (non-blocking)
        // API responds immediately, notifications processed async by queue worker
        if (user) {
            // FIX: Prevent user from getting their own notification
            if (user.role !== 'Admin' && user.role !== 'HR') {
                queueNotification.custom({
                    message: `You have started a ${breakType} break.`,
                    notificationType: 'info',
                    userId,
                    userName: user.fullName,
                    recipientType: 'user',
                    category: 'break',
                });
            }
            // Always notify admins
            queueNotification.breakStart(userId, user.fullName, breakType);
        }

        // Invalidate cache for this user's today status
        const cacheKey = `status:${userId}:${today}`;
        deleteCache(cacheKey).catch(err => 
            console.warn(`[Cache] Error invalidating cache for ${cacheKey}:`, err.message)
        );

        res.status(201).json({ 
            message: 'Break started successfully.', 
            break: newBreak[0],
            serverStartTime: serverStartTime.toISOString(),
            calculatedLogoutTime: dailyStatus.calculatedLogoutTime
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Start Break Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/end', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    const today = formatDateIST(getTodayIST());

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const log = await AttendanceLog.findOne({ user: userId, attendanceDate: today }).session(session);
        if (!log) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Cannot find attendance log for today.' });
        }

        // Atomic check: Only allow break end if active break exists (idempotent)
        const activeBreak = await BreakLog.findOneAndUpdate(
            { attendanceLog: log._id, endTime: null },
            { $set: { _processing: new Date() } }, // Temporary lock
            { session, sort: { startTime: -1 }, new: true }
        );

        if (!activeBreak) {
            await session.abortTransaction();
            session.endSession();
            // Idempotent: If no active break, return success (already ended)
            const dailyStatus = await getUserDailyStatus(userId, today, {
                includeSessions: true,
                includeBreaks: true,
                includeAutoBreak: true
            });
            return res.status(200).json({ 
                message: 'No active break to end.', 
                calculatedLogoutTime: dailyStatus.calculatedLogoutTime,
                alreadyEnded: true
            });
        }
        
        const breakEndTime = new Date();
        const currentBreakDuration = Math.round((breakEndTime - new Date(activeBreak.startTime)) / (1000 * 60));
        let penalty = 0, paidBreakToAdd = 0, unpaidBreakToAdd = 0;
        
        if (activeBreak.breakType === 'Paid') {
            const user = await User.findById(userId).populate('shiftGroup').session(session);
            const paidBreakAllowance = user?.shiftGroup?.paidBreakMinutes || 30;
            const remainingPaidAllowance = paidBreakAllowance - log.paidBreakMinutesTaken;
            if (currentBreakDuration > remainingPaidAllowance) {
                penalty = currentBreakDuration - Math.max(0, remainingPaidAllowance);
                paidBreakToAdd = Math.max(0, remainingPaidAllowance);
            } else {
                paidBreakToAdd = currentBreakDuration;
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

        // Atomic update: Break end + AttendanceLog update in transaction
        const updatedBreak = await BreakLog.findByIdAndUpdate(
            activeBreak._id, 
            { $set: { endTime: breakEndTime, durationMinutes: currentBreakDuration }, $unset: { _processing: 1 } }, 
            { session, new: true }
        );

        const updatePayload = { $inc: {} };
        if (penalty > 0) updatePayload.$inc.penaltyMinutes = penalty;
        if (paidBreakToAdd > 0) updatePayload.$inc.paidBreakMinutesTaken = paidBreakToAdd;
        if (unpaidBreakToAdd > 0) updatePayload.$inc.unpaidBreakMinutesTaken = unpaidBreakToAdd;
        
        if (Object.keys(updatePayload.$inc).length > 0) {
            await AttendanceLog.findByIdAndUpdate(log._id, updatePayload, { session });
        }

        await session.commitTransaction();
        session.endSession();

        // PARALLELIZATION: These queries are independent after transaction commit
        // - getUserDailyStatus reads attendance data (doesn't depend on user data)
        // - User.findById reads user data (doesn't depend on attendance data)
        // Both are read-only operations on different collections, safe to run concurrently
        const [dailyStatus, user] = await Promise.all([
            getUserDailyStatus(userId, today, {
                includeSessions: true,
                includeBreaks: true,
                includeAutoBreak: true
            }),
            User.findById(userId)
        ]);
        // Queue notifications for background processing (non-blocking)
        // API responds immediately, notifications processed async by queue worker
        if (user) {
            // FIX: Prevent user from getting their own notification
            if (user.role !== 'Admin' && user.role !== 'HR') {
                queueNotification.custom({
                    message: `Your ${activeBreak.breakType} break has ended.`,
                    notificationType: 'info',
                    userId,
                    userName: user.fullName,
                    recipientType: 'user',
                    category: 'break',
                });
            }
            // Always notify admins
            queueNotification.breakEnd(userId, user.fullName, activeBreak.breakType);
        }

        // Invalidate dashboard cache to ensure updated logout time is reflected
        const cacheService = require('../services/cacheService');
        cacheService.invalidateDashboard(today);

        // Invalidate Redis cache for this user's today status
        const cacheKey = `status:${userId}:${today}`;
        deleteCache(cacheKey).catch(err => 
            console.warn(`[Cache] Error invalidating cache for ${cacheKey}:`, err.message)
        );

        res.json({ 
            message: 'Break ended successfully.', 
            break: updatedBreak,
            finalDurationMinutes: currentBreakDuration,
            calculatedLogoutTime: dailyStatus.calculatedLogoutTime,
            updatedAttendanceSnapshot: {
                paidBreakMinutesTaken: log.paidBreakMinutesTaken + paidBreakToAdd,
                unpaidBreakMinutesTaken: log.unpaidBreakMinutesTaken + unpaidBreakToAdd,
                penaltyMinutes: log.penaltyMinutes + penalty
            }
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('End Break Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Extra break request logic is fine as it correctly notifies admins and confirms with user.
router.post('/request-extra', authenticateToken, async (req, res) => {
    // ... this route's logic is already correct
    const { userId } = req.user;
    const { reason } = req.body;
    const today = formatDateIST(getTodayIST());
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