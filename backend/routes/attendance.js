const express = require('express');
const mongoose = require('mongoose');
const authenticateToken = require('../middleware/authenticateToken');
const { geofencingMiddleware } = require('../middleware/geofencingMiddleware');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const ExtraBreakRequest = require('../models/ExtraBreakRequest');
const Setting = require('../models/Setting');
const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');
const NewNotificationService = require('../services/NewNotificationService');
const logAction = require('../services/logAction');
const { getUserDailyStatus } = require('../services/dailyStatusService');
const AntiExploitationLeaveService = require('../services/antiExploitationLeaveService');
const cache = require('../utils/cache');
const cacheService = require('../services/cacheService');
const { getISTNow, getISTDateString, parseISTDate, getShiftDateTimeIST, formatISTTime } = require('../utils/istTime');
const { getGracePeriod } = require('../services/gracePeriodCache');
const { batchFetchLeaves } = require('../services/leaveCache');
const { invalidateStatus } = require('../services/statusCache');

const router = express.Router();

// GET /api/attendance/status
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { date } = req.query;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'A valid `date` query parameter is required in YYYY-MM-DD format.' });
        }

        // PHASE 3 OPTIMIZATION: Safe server-side caching
        // Cache key: status:userId:date
        // TTL: 30 seconds (short enough to prevent stale data, long enough to reduce load)
        const cacheKey = `status:${userId}:${date}`;
        const cached = cache.get(cacheKey);
        
        if (cached !== null) {
            return res.json(cached);
        }

        const dailyStatus = await getUserDailyStatus(userId, date);
        
        // Cache the result (30 second TTL)
        cache.set(cacheKey, dailyStatus, 30000);
        
        return res.json(dailyStatus);
    } catch (error) {
        console.error("Error fetching status:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/clock-in', authenticateToken, geofencingMiddleware, async (req, res) => {
    const { userId } = req.user;
    const todayStr = getISTDateString();
    try {
        // PHASE 2 OPTIMIZATION: Parallelize independent queries
        // Batch 1: User + TodayLog (independent, can run in parallel)
        // Note: Removed graceSetting from parallel batch - now using cache
        const [user, todayLog] = await Promise.all([
            User.findById(userId).populate('shiftGroup'),
            AttendanceLog.findOne({ user: userId, attendanceDate: todayStr })
        ]);

        if (!user) { return res.status(404).json({ error: 'User not found.' }); }
        if (!user.shiftGroup) { return res.status(400).json({ error: 'Cannot clock in. You have no shift assigned.' }); }
        
        // PHASE 6: Check if today is an approved leave day
        if (todayLog && todayLog.attendanceStatus === 'Leave') {
            // Check if leave is still active
            const LeaveRequest = require('../models/LeaveRequest');
            if (todayLog.leaveRequest) {
                const leaveRequest = await LeaveRequest.findById(todayLog.leaveRequest);
                if (leaveRequest && leaveRequest.status === 'Approved') {
                    return res.status(400).json({ 
                        error: 'Cannot clock in. You have an approved leave for today. Please contact HR if you need to work on a leave day.' 
                    });
                }
            }
        }
        
        let attendanceLog = todayLog;
        if (!attendanceLog) {
            attendanceLog = await AttendanceLog.create({
                user: userId,
                attendanceDate: todayStr,
                clockInTime: getISTNow(),
                shiftDurationMinutes: user.shiftGroup.durationHours * 60,
                penaltyMinutes: 0,
                paidBreakMinutesTaken: 0,
                unpaidBreakMinutesTaken: 0,
            });
        }
        
        const activeSession = await AttendanceSession.findOne({ attendanceLog: attendanceLog._id, endTime: null });
        if (activeSession) { return res.status(400).json({ error: 'You are already clocked in.' }); }
        
        const newSession = await AttendanceSession.create({ 
            attendanceLog: attendanceLog._id, 
            startTime: getISTNow() 
        });

        // --- ANALYTICS: Check for late login and update status ---
        const clockInTime = getISTNow();
        
        // Use the proper timezone-aware function to get shift start time
        const shiftStartTime = getShiftDateTimeIST(clockInTime, user.shiftGroup.startTime);
        
        const lateMinutes = Math.max(0, Math.floor((clockInTime - shiftStartTime) / (1000 * 60)));
        
        let isLate = false;
        let isHalfDay = false;
        let attendanceStatus = 'On-time';

        // Grace period: configurable via cached setting (1-hour TTL)
        let GRACE_PERIOD_MINUTES = 30;
        try {
            GRACE_PERIOD_MINUTES = await getGracePeriod();
        } catch (err) {
            console.error('Failed to fetch grace period from cache, using default 30', err);
        }
        console.log(`[Grace Period] Using grace period: ${GRACE_PERIOD_MINUTES} minutes for clock-in (lateMinutes: ${lateMinutes})`);

        // Consistent rules:
        // - If lateMinutes <= GRACE_PERIOD_MINUTES -> On-time (within grace period)
        // - If lateMinutes > GRACE_PERIOD_MINUTES -> Half-day AND Late (for tracking/notifications)
        // Grace period allows employees to arrive late without penalty
        let halfDayReasonCode = null;
        let halfDayReasonText = '';
        let halfDaySource = null;
        
        if (lateMinutes <= GRACE_PERIOD_MINUTES) {
            isLate = false;
            isHalfDay = false;
            attendanceStatus = 'On-time';
            // Clear half-day reason if not half-day
            halfDayReasonCode = null;
            halfDayReasonText = '';
            halfDaySource = null;
        } else if (lateMinutes > GRACE_PERIOD_MINUTES) {
            isHalfDay = true;
            isLate = true; // FIX: Set isLate=true for tracking and notifications
            attendanceStatus = 'Half-day';
            // Set half-day reason for late login
            halfDayReasonCode = 'LATE_LOGIN';
            const clockInTimeStr = formatISTTime(clockInTime, { hour12: true, hour: '2-digit', minute: '2-digit' });
            halfDayReasonText = `Late login beyond ${GRACE_PERIOD_MINUTES} min grace period (logged at ${clockInTimeStr}, ${lateMinutes} minutes late)`;
            halfDaySource = 'AUTO';
        }

        // Update the attendance log with analytics data and half-day reason
        const updateData = {
            isLate,
            isHalfDay,
            lateMinutes,
            attendanceStatus
        };
        
        // Only update half-day reason fields if half-day is true
        if (isHalfDay) {
            updateData.halfDayReasonCode = halfDayReasonCode;
            updateData.halfDayReasonText = halfDayReasonText;
            updateData.halfDaySource = halfDaySource;
            // Clear override fields if auto-marking as half-day (new auto determination)
            if (!attendanceLog.overriddenByAdmin) {
                updateData.overriddenByAdmin = false;
                updateData.overriddenAt = null;
                updateData.overriddenBy = null;
            }
        } else {
            // Clear half-day reason if not half-day (unless admin overridden)
            if (!attendanceLog.overriddenByAdmin) {
                updateData.halfDayReasonCode = null;
                updateData.halfDayReasonText = '';
                updateData.halfDaySource = null;
            }
        }
        
        await AttendanceLog.findByIdAndUpdate(attendanceLog._id, updateData);

        // Track late login for weekly monitoring
        // PHASE 2 OPTIMIZATION: Parallelize late tracking queries
        let weeklyLateInfo = null;
        if (isLate) {
            try {
                const { trackLateLogin, getWeeklyLateStats } = require('../services/weeklyLateTrackingService');
                // Parallelize tracking and stats fetch
                const [trackingRecord, stats] = await Promise.all([
                    trackLateLogin(userId, todayStr),
                    getWeeklyLateStats(userId)
                ]);
                weeklyLateInfo = {
                    currentWeekLateCount: stats.currentWeekLateCount,
                    lateDates: stats.lateDates
                };
            } catch (error) {
                console.error('Error tracking late login:', error);
                // Don't fail the clock-in if tracking fails
            }
        }

        // Send email notification if late
        if (isLate) {
            try {
                const { sendLateLoginNotification } = require('../services/analyticsEmailService');
                sendLateLoginNotification(user, {
                    attendanceDate: todayStr,
                    clockInTime: clockInTime,
                    lateMinutes: lateMinutes,
                    isHalfDay: isHalfDay
                }).catch(err => {
                    console.error('Error sending late login notification:', err);
                });
            } catch (error) {
                console.error('Error sending late login notification:', error);
            }
        }
        
        // --- NOTIFICATION ---
        // Notify admins about user clock-in using the new service
        NewNotificationService.notifyCheckIn(userId, user.fullName)
            .catch(err => console.error('Error sending clock-in notification to admins:', err));
        
        // Send confirmation notification to the user
        NewNotificationService.createAndEmitNotification({
            message: `You have successfully clocked in at ${formatISTTime(clockInTime, { hour12: true })}.`,
            type: 'success',
            userId,
            userName: user.fullName,
            recipientType: 'user',
            category: 'attendance',
            priority: 'medium',
        }).catch(err => console.error('Error sending clock-in confirmation to user:', err));
        
        const responsePayload = { 
            message: 'Clocked in successfully!', 
            session: newSession,
            analytics: {
                isLate,
                isHalfDay,
                lateMinutes,
                attendanceStatus
            }
        };

        // If weeklyLateInfo indicates user has been late 3 or more times this week,
        // include a flag so frontend can show a warning popup (do NOT lock the account).
        if (weeklyLateInfo && weeklyLateInfo.currentWeekLateCount >= 3) {
            responsePayload.weeklyLateWarning = {
                showPopup: true,
                lateCount: weeklyLateInfo.currentWeekLateCount,
                lateDates: weeklyLateInfo.lateDates
            };
        }

        // PHASE 4 OPTIMIZATION: Cache invalidation on mutation
        // Invalidate status cache for this user and date
        const cacheKey = `status:${userId}:${todayStr}`;
        cache.delete(cacheKey);
        // Also invalidate dashboard summary cache
        cache.deletePattern(`dashboard-summary:*`);
        // PERFORMANCE OPTIMIZATION: Invalidate status cache
        invalidateStatus(userId, todayStr);
        // Ensure Admin Dashboard cache refreshes after clock-in
        cacheService.invalidateDashboard(todayStr);

        // Emit Socket.IO event for real-time updates (replaces polling)
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                // PERFORMANCE OPTIMIZATION: Minimal payload for real-time updates
                io.emit('attendance_log_updated', {
                    logId: attendanceLog._id,
                    userId: userId,
                    attendanceDate: todayStr,
                    attendanceStatus: attendanceStatus,
                    isHalfDay: isHalfDay,
                    isLate: isLate,
                    halfDayReasonText: halfDayReasonText,
                    timestamp: getISTNow().toISOString(),
                    message: `${user.fullName} clocked in`
                });
                console.log(`📡 Emitted attendance_log_updated event for clock-in ${attendanceLog._id}`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        res.status(201).json(responsePayload);
    } catch (error) {
        console.error('Clock-in Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/clock-out', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    const today = getISTDateString();
    try {
        // PHASE 2 OPTIMIZATION: Parallelize independent queries
        // Batch 1: Log + Breaks check (can run in parallel)
        const log = await AttendanceLog.findOne({ user: userId, attendanceDate: today });
        if (!log) return res.status(400).json({ error: 'Cannot find attendance log. You must clock in first.' });
        
        const [activeBreak, activeAutoBreak] = await Promise.all([
            BreakLog.findOne({ attendanceLog: log._id, endTime: null }),
            BreakLog.findOne({ 
                userId, 
                endTime: null, 
                isAutoBreak: true 
            })
        ]);
        
        if (activeBreak) return res.status(400).json({ error: 'You must end your break before clocking out.' });
        if (activeAutoBreak) return res.status(400).json({ error: 'You must end your auto-break before clocking out.' });
        
        const clockOutTime = getISTNow();
        const updatedSession = await AttendanceSession.findOneAndUpdate(
            { attendanceLog: log._id, endTime: null },
            { 
                $set: { 
                    endTime: clockOutTime,
                    logoutType: 'MANUAL' // Mark as manual logout
                } 
            },
            { new: true, sort: { startTime: -1 } }
        );
        if (!updatedSession) return res.status(400).json({ error: 'You are not currently clocked in.' });
        
        // PHASE 2 OPTIMIZATION: Parallelize independent queries
        // Batch 2: Sessions + Breaks (for calculations) - can run in parallel
        const [sessions, breaks] = await Promise.all([
            AttendanceSession.find({ attendanceLog: log._id }).sort({ startTime: 1 }),
            BreakLog.find({ attendanceLog: log._id })
        ]);
        
        let totalWorkingMinutes = 0;
        let totalBreakMinutes = 0;
        
        // Calculate total session time
        sessions.forEach(session => {
            if (session.endTime) {
                totalWorkingMinutes += (session.endTime - session.startTime) / (1000 * 60);
            }
        });
        
        // Calculate total break time
        breaks.forEach(breakLog => {
            if (breakLog.endTime) {
                totalBreakMinutes += (breakLog.endTime - breakLog.startTime) / (1000 * 60);
            }
        });
        
        // Net working hours (excluding breaks)
        const netWorkingMinutes = Math.max(0, totalWorkingMinutes - totalBreakMinutes);
        const totalWorkingHours = netWorkingMinutes / 60;
        
        // Check if worked hours < 8 hours (480 minutes) - mark as half-day if so
        // Only if not already overridden by admin
        const MINIMUM_WORKING_HOURS = 8; // 8 hours = 480 minutes
        const MINIMUM_WORKING_MINUTES = MINIMUM_WORKING_HOURS * 60;
        
        let updateData = {
            clockOutTime: clockOutTime,
            totalWorkingHours: totalWorkingHours,
            logoutType: 'MANUAL',
            autoLogoutReason: null
        };
        
        // Get current log to check override status
        const currentLog = await AttendanceLog.findById(log._id);
        
        // Only auto-mark half-day if:
        // 1. Worked less than 8 hours
        // 2. Not already overridden by admin
        // 3. Not already marked as half-day due to late login
        if (netWorkingMinutes < MINIMUM_WORKING_MINUTES && 
            !currentLog?.overriddenByAdmin && 
            !currentLog?.isHalfDay) {
            
            updateData.isHalfDay = true;
            updateData.attendanceStatus = 'Half-day';
            updateData.halfDayReasonCode = 'INSUFFICIENT_WORKING_HOURS';
            updateData.halfDayReasonText = `Insufficient working hours (${totalWorkingHours.toFixed(1)} hours worked, minimum required: ${MINIMUM_WORKING_HOURS} hours)`;
            updateData.halfDaySource = 'AUTO';
        }
        
        await AttendanceLog.findByIdAndUpdate(log._id, { $set: updateData });
        
        // Refresh log to get updated status
        const updatedLog = await AttendanceLog.findById(log._id);
        
        // --- NOTIFICATION ---
        const user = await User.findById(userId);
        if (user) {
            // Notify admins about user clock-out
            NewNotificationService.notifyCheckOut(userId, user.fullName)
                .catch(err => console.error('Error sending clock-out notification to admins:', err));
            
            // Send confirmation to the user
            let message = `You have successfully clocked out at ${formatISTTime(clockOutTime, { hour12: true })}. Total working hours: ${totalWorkingHours.toFixed(1)}h`;
            if (updateData.isHalfDay) {
                message += ` (Marked as half-day due to insufficient working hours)`;
            }
            
            NewNotificationService.createAndEmitNotification({
                message: message,
                type: updateData.isHalfDay ? 'warning' : 'success',
                userId,
                userName: user.fullName,
                recipientType: 'user',
                category: 'attendance',
                priority: 'medium',
            }).catch(err => console.error('Error sending clock-out confirmation to user:', err));
        }
        
        // PHASE 4 OPTIMIZATION: Cache invalidation on mutation
        // Invalidate status cache for this user and date
        const cacheKey = `status:${userId}:${today}`;
        cache.delete(cacheKey);
        // Also invalidate dashboard summary cache
        cache.deletePattern(`dashboard-summary:*`);
        // PERFORMANCE OPTIMIZATION: Invalidate status cache
        invalidateStatus(userId, today);
        // Ensure Admin Dashboard cache refreshes after clock-out
        cacheService.invalidateDashboard(today);

        // Emit Socket.IO event for real-time updates (replaces polling)
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                // PERFORMANCE OPTIMIZATION: Minimal payload for real-time updates
                io.emit('attendance_log_updated', {
                    logId: log._id,
                    userId: userId,
                    attendanceDate: today,
                    attendanceStatus: updatedLog?.attendanceStatus || log.attendanceStatus,
                    isHalfDay: updatedLog?.isHalfDay || updateData.isHalfDay || log.isHalfDay,
                    halfDayReasonText: updatedLog?.halfDayReasonText || updateData.halfDayReasonText || null,
                    timestamp: getISTNow().toISOString(),
                    message: updateData.isHalfDay ? `Clocked out - Marked as half-day (insufficient hours)` : `Clocked out successfully`
                });
                console.log(`📡 Emitted attendance_log_updated event for clock-out ${log._id}`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        res.json({ 
            message: 'Clocked out successfully!', 
            session: updatedSession,
            totalWorkingHours: totalWorkingHours
        });
    } catch (error) {
        console.error('Clock-out Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/my-weekly-log', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        if (!mongoose.Types.ObjectId.isValid(userId)) { return res.status(400).json({ error: "Invalid user ID." }); }
        
        let { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            const today = getISTNow();
            const dayOfWeek = today.getDay();
            const firstDayOfWeek = new Date(today);
            firstDayOfWeek.setDate(today.getDate() - dayOfWeek);
            const lastDayOfWeek = new Date(firstDayOfWeek);
            lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
            startDate = getISTDateString(firstDayOfWeek);
            endDate = getISTDateString(lastDayOfWeek);
        }

        const logs = await AttendanceLog.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId), attendanceDate: { $gte: startDate, $lte: endDate } } },
            { $lookup: { from: 'attendancesessions', localField: '_id', foreignField: 'attendanceLog', as: 'sessions' } },
            { $lookup: { from: 'breaklogs', localField: '_id', foreignField: 'attendanceLog', as: 'breaks' } },
            { $project: { _id: 1, attendanceDate: 1, status: 1, clockInTime: 1, clockOutTime: 1, notes: 1, paidBreakMinutesTaken: 1, unpaidBreakMinutesTaken: 1, penaltyMinutes: 1, sessions: { $map: { input: "$sessions", as: "s", in: { startTime: "$$s.startTime", endTime: "$$s.endTime" } } }, breaks: { $map: { input: "$breaks", as: "b", in: { _id: "$$b._id", startTime: "$$b.startTime", endTime: "$$b.endTime", durationMinutes: "$$b.durationMinutes", breakType: "$$b.breakType" } } } } },
            { $sort: { attendanceDate: 1 } }
        ]);
        res.json(logs);
    } catch (error) {
        console.error("Error fetching weekly log:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

router.patch('/log/:logId/note', authenticateToken, async (req, res) => {
    const { logId } = req.params;
    const { notes } = req.body;
    const { userId } = req.user;

    try {
        if (!mongoose.Types.ObjectId.isValid(logId)) {
            return res.status(400).json({ error: 'Invalid log ID.' });
        }

        const log = await AttendanceLog.findOne({ _id: logId, user: userId });
        
        if (!log) {
            return res.status(404).json({ error: 'Attendance log not found or you do not have permission to edit it.' });
        }
        
        log.notes = notes || '';
        await log.save();
        
        res.json({ message: 'Note updated successfully.', log });

    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/attendance/auto-break - Start automatic unpaid break due to inactivity
router.post('/auto-break', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { type = 'Auto-Unpaid-Break', reason = 'Inactivity detected' } = req.body;
        const today = getISTDateString();

        console.log(`[AUTO-BREAK] Request from user ${userId}, reason: ${reason}`);

        // Check if user is already on a break
        const activeBreak = await BreakLog.findOne({
            userId,
            endTime: null
        });

        if (activeBreak) {
            console.log(`[AUTO-BREAK] User already on break: ${activeBreak._id}`);
            return res.status(400).json({ 
                error: 'User is already on a break.',
                success: false 
            });
        }

        // Check if user is checked in - need to find attendance log first
        const attendanceLog = await AttendanceLog.findOne({ 
            user: userId, 
            attendanceDate: today 
        });

        if (!attendanceLog) {
            console.log(`[AUTO-BREAK] No attendance log found for user ${userId} on ${today}`);
            return res.status(400).json({ 
                error: 'User must be checked in to start a break.',
                success: false 
            });
        }

        console.log(`[AUTO-BREAK] Found attendance log: ${attendanceLog._id}`);

        // Check for active session using attendanceLog
        const activeSession = await AttendanceSession.findOne({
            attendanceLog: attendanceLog._id,
            endTime: null
        });

        if (!activeSession) {
            console.log(`[AUTO-BREAK] No active session found for attendance log ${attendanceLog._id}`);
            return res.status(400).json({ 
                error: 'User must be checked in to start a break.',
                success: false 
            });
        }

        console.log(`[AUTO-BREAK] Found active session: ${activeSession._id}`);

        // Create auto-break log
        const breakLog = new BreakLog({
            userId,
            attendanceLog: attendanceLog._id,
            type,
            breakType: 'Unpaid', // Set for backward compatibility
            startTime: getISTNow(),
            reason,
            isAutoBreak: true
        });

        await breakLog.save();

        console.log(`[AUTO-BREAK] Break log created: ${breakLog._id}`);
        
        // Log to activity tracker (with error handling)
        try {
            await logAction(userId, 'AUTO_BREAK_START', {
                breakId: breakLog._id,
                reason,
                startTime: breakLog.startTime,
                type: type
            });
            console.log(`[AUTO-BREAK] Activity logged successfully`);
        } catch (logError) {
            console.error('[AUTO-BREAK] Failed to log activity:', logError.message);
            // Don't fail the request if logging fails
        }

        // Send notifications to user and admins
        try {
            const user = await User.findById(userId);
            if (user) {
                await NewNotificationService.notifyAutoBreakStart(userId, user.fullName, reason);
                console.log(`[AUTO-BREAK] Notifications sent successfully`);
            }
        } catch (notificationError) {
            console.error('[AUTO-BREAK] Failed to send notifications:', notificationError.message);
            // Don't fail the request if notifications fail
        }

        res.json({
            success: true,
            message: 'Auto-break started successfully.',
            breakId: breakLog._id,
            startTime: breakLog.startTime
        });

    } catch (error) {
        console.error('[AUTO-BREAK] Error starting auto-break:', error);
        res.status(500).json({ 
            error: 'Failed to start auto-break.',
            success: false,
            details: error.message
        });
    }
});

// GET /api/attendance/current-status - Get current attendance and break status
router.get('/current-status', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const today = getISTDateString();

        // Find today's attendance log
        const attendanceLog = await AttendanceLog.findOne({ 
            user: userId, 
            attendanceDate: today 
        });

        // Get current attendance session
        let activeSession = null;
        if (attendanceLog) {
            activeSession = await AttendanceSession.findOne({
                attendanceLog: attendanceLog._id,
                endTime: null
            });
        }

        // Get current break
        const activeBreak = await BreakLog.findOne({
            userId,
            endTime: null
        });

        res.json({
            isCheckedIn: !!activeSession,
            isOnBreak: !!activeBreak,
            breakType: activeBreak?.type || null,
            breakStartTime: activeBreak?.startTime || null,
            sessionStartTime: activeSession?.startTime || null
        });

    } catch (error) {
        console.error('Error getting current status:', error);
        res.status(500).json({ error: 'Failed to get current status.' });
    }
});

// PUT /api/attendance/end-break - End current break (including auto-break)
router.put('/end-break', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const today = getISTDateString();

        console.log(`[END-BREAK] Request from user ${userId}`);

        // Find active break by userId (for auto-breaks) or by attendanceLog (for regular breaks)
        let activeBreak = await BreakLog.findOne({
            userId,
            endTime: null
        }).sort({ startTime: -1 });

        // If not found by userId alone, try finding by attendanceLog
        if (!activeBreak) {
            console.log('[END-BREAK] No break found by userId, checking attendanceLog...');
            const attendanceLog = await AttendanceLog.findOne({ 
                user: userId, 
                attendanceDate: today 
            });
            
            if (attendanceLog) {
                activeBreak = await BreakLog.findOne({
                    attendanceLog: attendanceLog._id,
                    endTime: null
                }).sort({ startTime: -1 });
            }
        }

        if (!activeBreak) {
            console.log('[END-BREAK] No active break found');
            return res.status(400).json({ 
                error: 'No active break found.',
                success: false 
            });
        }

        console.log(`[END-BREAK] Found active break: ${activeBreak._id}, isAutoBreak: ${activeBreak.isAutoBreak}`);

        // End the break
        const breakEndTime = getISTNow();
        const currentBreakDuration = Math.round((breakEndTime - new Date(activeBreak.startTime)) / (1000 * 60));

        await BreakLog.findByIdAndUpdate(activeBreak._id, {
            $set: {
                endTime: breakEndTime,
                durationMinutes: currentBreakDuration
            }
        });

        console.log(`[END-BREAK] Break ended successfully. Duration: ${currentBreakDuration} minutes`);

        // If it's an auto-break, log the event
        if (activeBreak.isAutoBreak) {
            console.log(`[END-BREAK] Processing auto-break end actions...`);
            
            // Log to activity tracker (with error handling)
            try {
                await logAction(userId, 'AUTO_BREAK_END', {
                    breakId: activeBreak._id,
                    endTime: breakEndTime,
                    duration: currentBreakDuration,
                    type: activeBreak.type,
                    reason: activeBreak.reason
                });
                console.log(`[END-BREAK] Activity logged successfully`);
            } catch (logError) {
                console.error('[END-BREAK] Failed to log activity:', logError.message);
                // Don't fail the request if logging fails
            }
            
            // Send notifications to user and admins
            try {
                const user = await User.findById(userId);
                if (user) {
                    await NewNotificationService.notifyAutoBreakEnd(userId, user.fullName, currentBreakDuration);
                    console.log(`[END-BREAK] Notifications sent successfully`);
                }
            } catch (notificationError) {
                console.error('[END-BREAK] Failed to send notifications:', notificationError.message);
                // Don't fail the request if notifications fail
            }
        }

        res.json({
            success: true,
            message: 'Break ended successfully.',
            breakId: activeBreak._id,
            endTime: breakEndTime,
            duration: currentBreakDuration,
            wasAutoBreak: activeBreak.isAutoBreak || false
        });

    } catch (error) {
        console.error('[END-BREAK] Error ending break:', error);
        res.status(500).json({ 
            error: 'Failed to end break.',
            success: false,
            details: error.message
        });
    }
});

/**
 * Helper function to get working dates for a month
 * Excludes: Sundays, Alternate Saturdays (based on employee policy), Holidays
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @param {Object} employee - Employee object with alternateSaturdayPolicy
 * @returns {Promise<Array<string>>} Array of working dates in YYYY-MM-DD format
 */
const getWorkingDatesForMonth = async (month, year, employee) => {
    // month is 0-indexed (0-11), year is full year
    // Create IST date for month start
    const monthStartIST = parseISTDate(`${year}-${String(month + 1).padStart(2, '0')}-01`);
    const monthStart = new Date(monthStartIST);
    monthStart.setHours(0, 0, 0, 0);
    
    // Create IST date for month end
    const monthEndIST = parseISTDate(`${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`);
    const monthEnd = new Date(monthEndIST);
    monthEnd.setHours(23, 59, 59, 999);
    
    // Get all holidays in this month (exclude tentative holidays)
    const holidays = await Holiday.find({
        date: {
            $gte: monthStart,
            $lte: monthEnd,
            $ne: null
        },
        isTentative: { $ne: true }
    }).lean();
    
    const holidayDates = new Set(
        holidays
            .filter(h => h.date && !h.isTentative)
            .map(h => {
                const d = new Date(h.date);
                if (isNaN(d.getTime())) return null;
                return getISTDateString(d);
            })
            .filter(dateStr => dateStr !== null)
    );
    
    const saturdayPolicy = employee?.alternateSaturdayPolicy || 'All Saturdays Working';
    const workingDates = [];
    
    // Iterate through days in IST
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const dateStr = getISTDateString(d);
        
        // Skip Sundays
        if (dayOfWeek === 0) continue;
        
        // Skip alternate Saturdays based on policy
        if (dayOfWeek === 6) {
            if (AntiExploitationLeaveService.isOffSaturday(d, saturdayPolicy)) {
                continue;
            }
        }
        
        // Skip holidays
        if (holidayDates.has(dateStr)) continue;
        
        workingDates.push(dateStr);
    }
    
    return workingDates;
};

/**
 * GET /api/attendance/actual-work-days
 * Calculate Actual Worked Days (Present Days) for employee(s) in a given month
 * 
 * Query Params:
 * - employeeId (optional): Specific employee ID. If not provided, returns data for all employees (Admin/HR only)
 * - month (required): Month (1-12)
 * - year (required): Year
 * 
 * Response:
 * Single employee: {
 *   employeeId: string,
 *   month: number,
 *   year: number,
 *   totalWorkingDays: number,
 *   actualWorkedDays: number,
 *   absentDays: number
 * }
 * 
 * Multiple employees: Array of above objects
 */
router.get('/actual-work-days', authenticateToken, async (req, res) => {
    try {
        const { employeeId, month, year } = req.query;
        const { userId, role } = req.user;
        
        // Validate required params
        if (!month || !year) {
            return res.status(400).json({ 
                error: 'Month and year are required query parameters.' 
            });
        }
        
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);
        
        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            return res.status(400).json({ 
                error: 'Month must be a number between 1 and 12.' 
            });
        }
        
        if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
            return res.status(400).json({ 
                error: 'Year must be a valid year.' 
            });
        }
        
        // Access control: Employee can only see their own data
        if (employeeId) {
            if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                return res.status(400).json({ error: 'Invalid employee ID format.' });
            }
            
            // If employee is requesting, ensure they can only see their own data
            if (role !== 'Admin' && role !== 'HR' && employeeId !== userId) {
                return res.status(403).json({ 
                    error: 'You do not have permission to view this employee\'s data.' 
                });
            }
        } else {
            // Bulk request (no employeeId) - only Admin/HR allowed
            if (role !== 'Admin' && role !== 'HR') {
                return res.status(403).json({ 
                    error: 'Only Admin and HR can view all employees\' data.' 
                });
            }
        }
        
        // Convert month to 0-indexed for Date constructor
        const monthIndex = monthNum - 1;
        
        // Determine which employees to process
        let employeesToProcess = [];
        
        if (employeeId) {
            // Single employee
            const employee = await User.findById(employeeId).select('_id fullName employeeCode alternateSaturdayPolicy role');
            if (!employee) {
                return res.status(404).json({ error: 'Employee not found.' });
            }
            employeesToProcess = [employee];
        } else {
            // All employees (Admin/HR only)
            employeesToProcess = await User.find({ 
                isActive: true 
            }).select('_id fullName employeeCode alternateSaturdayPolicy role').lean();
        }
        
        // Process each employee
        const results = await Promise.all(
            employeesToProcess.map(async (employee) => {
                try {
                    // Get working dates for this employee's month
                    const workingDates = await getWorkingDatesForMonth(
                        monthIndex, 
                        yearNum, 
                        employee
                    );
                    
                    const totalWorkingDays = workingDates.length;
                    
                    // Fetch attendance records for working dates only
                    // Count unique dates where employee has check-in
                    const attendanceLogs = await AttendanceLog.find({
                        user: employee._id,
                        attendanceDate: { $in: workingDates },
                        clockInTime: { $exists: true, $ne: null }
                    }).select('attendanceDate').lean();
                    
                    // Deduplicate by date (in case of multiple records per date)
                    const presentDateSet = new Set(
                        attendanceLogs.map(log => log.attendanceDate)
                    );
                    
                    const actualWorkedDays = presentDateSet.size;
                    const absentDays = totalWorkingDays - actualWorkedDays;
                    
                    return {
                        employeeId: employee._id.toString(),
                        employeeName: employee.fullName,
                        employeeCode: employee.employeeCode,
                        month: monthNum,
                        year: yearNum,
                        totalWorkingDays,
                        actualWorkedDays,
                        absentDays
                    };
                } catch (error) {
                    console.error(`Error processing employee ${employee._id}:`, error);
                    // Return error data for this employee
                    return {
                        employeeId: employee._id.toString(),
                        employeeName: employee.fullName,
                        employeeCode: employee.employeeCode,
                        month: monthNum,
                        year: yearNum,
                        error: 'Failed to calculate work days'
                    };
                }
            })
        );
        
        // Return single object if single employee requested, array if bulk
        if (employeeId) {
            res.json(results[0]);
        } else {
            res.json(results);
        }
        
    } catch (error) {
        console.error('Error calculating actual work days:', error);
        res.status(500).json({ 
            error: 'Internal server error while calculating actual work days.',
            details: error.message
        });
    }
});

/**
 * GET /api/attendance/summary
 * Unified endpoint for attendance summary with FULL STATUS RESOLUTION.
 * This is the SINGLE SOURCE OF TRUTH - backend resolves ALL statuses.
 * 
 * Query params:
 * - startDate (required): YYYY-MM-DD
 * - endDate (required): YYYY-MM-DD
 * - userId (optional, admin only): Specific user ID, defaults to current user
 * - includeHolidays (optional): Include holidays in response
 * 
 * Returns: Array of attendance entries for ALL dates in range, with resolved status.
 * Status precedence: Holiday > Approved Leave > Weekly Off > Present > Half-day > Absent
 */
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, userId, includeHolidays } = req.query;
        const { userId: currentUserId, role } = req.user;

        // Validate date range
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                error: 'Start date and end date are required (format: YYYY-MM-DD).' 
            });
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({ 
                error: 'Invalid date format. Use YYYY-MM-DD.' 
            });
        }

        // Determine which user's data to fetch
        let targetUserId = currentUserId;
        if (userId) {
            // Admin/HR can view any user's data
            if (role !== 'Admin' && role !== 'HR') {
                return res.status(403).json({ 
                    error: 'Only Admin and HR can view other users\' attendance.' 
                });
            }
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: 'Invalid user ID format.' });
            }
            targetUserId = userId;
        }

        /**
         * @deprecated
         * Attendance summary resolution logic has been extracted to
         * backend/services/attendanceSummaryCoreService.js.
         * Routes must not implement attendance resolution.
         */

        const { computeAttendanceSummary } = require('../services/attendanceSummaryCoreService');
        const shouldIncludeHolidays = includeHolidays === 'true' || includeHolidays === true;

        const computed = await computeAttendanceSummary({
            employeeId: targetUserId,
            startDate,
            endDate,
            includeHolidays: shouldIncludeHolidays
        });

        if (!computed) {
            console.error(`[ATTENDANCE SUMMARY] Missing computed summary for userId: ${targetUserId}`);
            return res.status(500).json({ error: 'Internal server error while fetching attendance summary.' });
        }
        if (computed.error === 'Employee not found.') {
            console.error(`[ATTENDANCE SUMMARY] Employee not found for userId: ${targetUserId}`);
            return res.status(404).json({ error: 'Employee not found.' });
        }

        if (shouldIncludeHolidays) {
            res.json({
                logs: computed.logs,
                holidays: computed.holidays,
                summary: computed.summary
            });
        } else {
            res.json({
                logs: computed.logs,
                summary: computed.summary
            });
        }
    } catch (error) {
        console.error('Error fetching attendance summary:', error);
        res.status(500).json({ error: 'Internal server error while fetching attendance summary.' });
    }
});

// =================================================================
// AGGREGATE ENDPOINT: /api/dashboard/employee
// Combines: /attendance/status, /attendance/my-weekly-log, /leaves/my-requests
// Purpose: Single endpoint for employee dashboard (reduces 3 calls to 1)
// =================================================================
router.get('/dashboard/employee', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { date } = req.query;
        const localDate = date || getISTDateString();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
            return res.status(400).json({ error: 'A valid `date` query parameter is required in YYYY-MM-DD format.' });
        }

        // Calculate weekly date range for weekly logs
        const today = parseISTDate(localDate);
        const dayOfWeek = today.getDay();
        const firstDayOfWeek = new Date(today);
        firstDayOfWeek.setDate(today.getDate() - dayOfWeek);
        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
        const startDate = getISTDateString(firstDayOfWeek);
        const endDate = getISTDateString(lastDayOfWeek);

        // Parallelize all three data fetches
        const [dailyStatus, weeklyLogs, leaveRequests] = await Promise.all([
            // 1. Daily status (reuse existing logic with caching)
            (async () => {
                const cacheKey = `status:${userId}:${localDate}`;
                const cached = cache.get(cacheKey);
                if (cached !== null) {
                    return cached;
                }
                const status = await getUserDailyStatus(userId, localDate);
                cache.set(cacheKey, status, 30000);
                return status;
            })(),
            // 2. Weekly logs (reuse existing logic)
            AttendanceLog.aggregate([
                { $match: { user: new mongoose.Types.ObjectId(userId), attendanceDate: { $gte: startDate, $lte: endDate } } },
                { $lookup: { from: 'attendancesessions', localField: '_id', foreignField: 'attendanceLog', as: 'sessions' } },
                { $lookup: { from: 'breaklogs', localField: '_id', foreignField: 'attendanceLog', as: 'breaks' } },
                { $project: { _id: 1, attendanceDate: 1, status: 1, clockInTime: 1, clockOutTime: 1, notes: 1, paidBreakMinutesTaken: 1, unpaidBreakMinutesTaken: 1, penaltyMinutes: 1, sessions: { $map: { input: "$sessions", as: "s", in: { startTime: "$$s.startTime", endTime: "$$s.endTime" } } }, breaks: { $map: { input: "$breaks", as: "b", in: { _id: "$$b._id", startTime: "$$b.startTime", endTime: "$$b.endTime", durationMinutes: "$$b.durationMinutes", breakType: "$$b.breakType" } } } } },
                { $sort: { attendanceDate: 1 } }
            ]),
            // 3. Leave requests (reuse existing logic, no pagination for dashboard)
            LeaveRequest.find({ employee: userId })
                .sort({ createdAt: -1 })
                .limit(10) // Limit to recent 10 for dashboard
                .lean()
        ]);

        res.json({
            dailyStatus,
            weeklyLogs: Array.isArray(weeklyLogs) ? weeklyLogs : [],
            leaveRequests: Array.isArray(leaveRequests) ? leaveRequests : []
        });
    } catch (error) {
        console.error("Error fetching employee dashboard data:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// =================================================================
// ENHANCED: /api/attendance/summary (includes holidays)
// Purpose: Include holidays in response to reduce frontend calls
// =================================================================
// Note: The existing /summary endpoint is above. We'll enhance it inline.
// For backward compatibility, we'll add a new query param ?includeHolidays=true
// But we'll also update the response to always include holidays when requested

module.exports = router;
