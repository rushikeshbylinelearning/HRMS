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
const { resolveMultipleDaysStatus, normalizeDateToIST } = require('../utils/attendanceStatusResolver');
const { determineHalfDayStatus } = require('../services/halfDayService');
const { formatDateIST, getTodayIST, addDaysIST } = require('../utils/dateUtils');
const { getCache, setCache, deleteCache } = require('../utils/redisClient');
const { queueNotification } = require('../queues/notificationQueue');

const router = express.Router();

const getShiftDateTimeIST = (onDate, shiftTime) => {
    const [hours, minutes] = shiftTime.split(':').map(Number);
    const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const [{ value: year },, { value: month },, { value: day }] = istDateFormatter.formatToParts(onDate);
    const shiftDateTimeISO_IST = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000+05:30`;
    return new Date(shiftDateTimeISO_IST);
};

// GET /api/attendance/status
// Cached with Redis to reduce DB load (30-second TTL)
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { date } = req.query;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'A valid `date` query parameter is required in YYYY-MM-DD format.' });
        }

        // Redis cache key format: status:{userId}:{date}
        const cacheKey = `status:${userId}:${date}`;
        const CACHE_TTL = 30; // 30 seconds

        // Try to get from cache first
        try {
            const cachedData = await getCache(cacheKey);
            if (cachedData) {
                // Cache hit - return immediately
                return res.json(JSON.parse(cachedData));
            }
        } catch (cacheError) {
            // Cache error is non-critical - continue to database query
            console.warn(`[Cache] Error reading cache for ${cacheKey}:`, cacheError.message);
        }

        // Cache miss - compute status from database
        const dailyStatus = await getUserDailyStatus(userId, date);

        // Store in cache (non-blocking, don't fail if cache fails)
        try {
            await setCache(cacheKey, JSON.stringify(dailyStatus), CACHE_TTL);
        } catch (cacheError) {
            // Cache write error is non-critical - response is already computed
            console.warn(`[Cache] Error writing cache for ${cacheKey}:`, cacheError.message);
        }

        return res.json(dailyStatus);
    } catch (error) {
        console.error("Error fetching status:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/clock-in', authenticateToken, geofencingMiddleware, async (req, res) => {
    const { userId } = req.user;
    const todayStr = formatDateIST(getTodayIST());
    try {
        const user = await User.findById(userId).populate('shiftGroup');
        if (!user) { return res.status(404).json({ error: 'User not found.' }); }
        if (!user.shiftGroup) { return res.status(400).json({ error: 'Cannot clock in. You have no shift assigned.' }); }
        
        let attendanceLog = await AttendanceLog.findOne({ user: userId, attendanceDate: todayStr });
        if (!attendanceLog) {
            attendanceLog = await AttendanceLog.create({
                user: userId,
                attendanceDate: todayStr,
                clockInTime: new Date(),
                shiftDurationMinutes: user.shiftGroup.durationHours * 60,
                penaltyMinutes: 0,
                paidBreakMinutesTaken: 0,
                unpaidBreakMinutesTaken: 0,
            });
        }
        
        // CRITICAL RACE CONDITION FIX: Use atomic create() with unique index protection
        // This ensures only ONE active session (endTime = null) can exist per AttendanceLog
        // The unique partial index on { attendanceLog: 1 } where { endTime: null } enforces this at DB level
        // 
        // How it works:
        // 1. Use create() to atomically create a new session
        // 2. If two requests race, the unique index ensures only one succeeds
        // 3. The other gets duplicate key error, which we catch and return "already clocked in"
        //
        // This is idempotent: repeated requests will either:
        // - Create the session (first request) and return it
        // - Get duplicate key error (subsequent requests) and return "already clocked in"
        const clockInTime = new Date();
        let newSession;
        try {
            newSession = await AttendanceSession.create({
                attendanceLog: attendanceLog._id,
                startTime: clockInTime,
                logoutType: 'MANUAL'
            });
        } catch (error) {
            // Handle duplicate key error (E11000) - means active session already exists
            // This happens when:
            // 1. Two requests race to create a session
            // 2. First request succeeds and creates session
            // 3. Second request tries to create, but unique index prevents it
            // 4. MongoDB throws duplicate key error
            if (error.code === 11000 || error.codeName === 'DuplicateKey') {
                // Verify that an active session actually exists (should always be true)
                const existingSession = await AttendanceSession.findOne({
                    attendanceLog: attendanceLog._id,
                    endTime: null
                });
                if (existingSession) {
                    return res.status(400).json({ error: 'You are already clocked in.' });
                }
                // If no session found but got duplicate key error, something is wrong
                // This should never happen, but we handle it gracefully
                console.error('Duplicate key error but no active session found. This indicates a data inconsistency:', error);
                return res.status(500).json({ error: 'Internal server error. Please try again.' });
            }
            // Re-throw other errors (validation errors, etc.)
            throw error;
        }

        // --- ANALYTICS: Check for late login and update status using unified service ---
        // Note: clockInTime is already set above in the atomic session creation
        
        // Update clock-in time if not already set
        if (!attendanceLog.clockInTime) {
            attendanceLog.clockInTime = clockInTime;
            await attendanceLog.save();
        }

        // Use unified half-day detection service
        const halfDayResult = await determineHalfDayStatus(attendanceLog, {
            user: user,
            shift: user.shiftGroup,
            skipNotifications: false, // Send notifications
            source: 'clock-in'
        });

        // Update isLate flag based on lateMinutes (for backward compatibility)
        const isLate = halfDayResult.lateMinutes > 0 && !halfDayResult.isHalfDay;
        await AttendanceLog.findByIdAndUpdate(attendanceLog._id, {
            isLate,
            isHalfDay: halfDayResult.isHalfDay,
            lateMinutes: halfDayResult.lateMinutes,
            attendanceStatus: halfDayResult.attendanceStatus
        });

        // Extract values for response
        const isHalfDay = halfDayResult.isHalfDay;
        const attendanceStatus = halfDayResult.attendanceStatus;
        const lateMinutes = halfDayResult.lateMinutes;

        // --- NOTIFICATION ---
        // Queue notifications for background processing (non-blocking)
        // API responds immediately, notifications processed async by queue worker
        // Errors in queue/processing don't affect API response
        queueNotification.checkIn(userId, user.fullName);
        queueNotification.custom({
            message: `You have successfully clocked in at ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })}.`,
            notificationType: 'success',
            userId,
            userName: user.fullName,
            recipientType: 'user',
            category: 'attendance',
            priority: 'medium',
        });

        // Track late login for weekly monitoring (needed for response payload)
        // This is awaited because weeklyLateWarning is included in the response
        let weeklyLateInfo = null;
        if (isLate) {
            try {
                const { trackLateLogin, getWeeklyLateStats } = require('../services/weeklyLateTrackingService');
                // Run tracking and stats fetch in parallel - they're independent operations
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

            // Email notification is backgrounded (non-blocking) - doesn't affect response
            (async () => {
                try {
                    const { sendLateLoginNotification } = require('../services/analyticsEmailService');
                    await sendLateLoginNotification(user, {
                        attendanceDate: todayStr,
                        clockInTime: clockInTime,
                        lateMinutes: lateMinutes,
                        isHalfDay: isHalfDay
                    });
                } catch (error) {
                    console.error('Error sending late login notification:', error);
                }
            })();
        }
        
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

        // Invalidate cache for this user's today status
        const cacheKey = `status:${userId}:${todayStr}`;
        deleteCache(cacheKey).catch(err => 
            console.warn(`[Cache] Error invalidating cache for ${cacheKey}:`, err.message)
        );

        res.status(201).json(responsePayload);
    } catch (error) {
        console.error('Clock-in Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/clock-out', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    const today = formatDateIST(getTodayIST());
    try {
        const log = await AttendanceLog.findOne({ user: userId, attendanceDate: today });
        if (!log) return res.status(400).json({ error: 'Cannot find attendance log. You must clock in first.' });
        
        const activeBreak = await BreakLog.findOne({ attendanceLog: log._id, endTime: null });
        if (activeBreak) return res.status(400).json({ error: 'You must end your break before clocking out.' });
        
        // Also check for auto-breaks
        const activeAutoBreak = await BreakLog.findOne({ 
            userId, 
            endTime: null, 
            isAutoBreak: true 
        });
        if (activeAutoBreak) return res.status(400).json({ error: 'You must end your auto-break before clocking out.' });
        
        const clockOutTime = new Date();
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
        
        // Calculate total working hours
        const sessions = await AttendanceSession.find({ attendanceLog: log._id }).sort({ startTime: 1 });
        const breaks = await BreakLog.find({ attendanceLog: log._id });
        
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
        
        // Update attendance log with clock-out time and working hours
        await AttendanceLog.findByIdAndUpdate(log._id, { 
            $set: { 
                clockOutTime: clockOutTime,
                totalWorkingHours: totalWorkingHours,
                logoutType: 'MANUAL', // Mark as manual logout
                autoLogoutReason: null // Clear any auto-logout reason
            } 
        });
        
        // Recalculate half-day status after clock-out (may change based on worked hours)
        const updatedLog = await AttendanceLog.findById(log._id);
        if (updatedLog) {
            const user = await User.findById(userId).populate('shiftGroup');
            if (user && user.shiftGroup) {
                await determineHalfDayStatus(updatedLog, {
                    user: user,
                    shift: user.shiftGroup,
                    skipNotifications: false, // Send notifications if status changes
                    source: 'clock-out'
                });
            }
        }
        
        // --- NOTIFICATION ---
        // Queue notifications for background processing (non-blocking)
        // API responds immediately, notifications processed async by queue worker
        const user = await User.findById(userId);
        if (user) {
            queueNotification.checkOut(userId, user.fullName);
            queueNotification.custom({
                message: `You have successfully clocked out at ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })}. Total working hours: ${totalWorkingHours.toFixed(1)}h`,
                notificationType: 'success',
                userId,
                userName: user.fullName,
                recipientType: 'user',
                category: 'attendance',
                priority: 'medium',
            });
        }
        
        // Invalidate cache for this user's today status
        const cacheKey = `status:${userId}:${today}`;
        deleteCache(cacheKey).catch(err => 
            console.warn(`[Cache] Error invalidating cache for ${cacheKey}:`, err.message)
        );
        
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
            const today = getTodayIST();
            const dayOfWeek = today.getDay();
            const firstDayOfWeek = addDaysIST(today, -dayOfWeek);
            const lastDayOfWeek = addDaysIST(firstDayOfWeek, 6);
            startDate = formatDateIST(firstDayOfWeek);
            endDate = formatDateIST(lastDayOfWeek);
        }

        // Fetch attendance logs
        const logs = await AttendanceLog.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId), attendanceDate: { $gte: startDate, $lte: endDate } } },
            { $lookup: { from: 'attendancesessions', localField: '_id', foreignField: 'attendanceLog', as: 'sessions' } },
            { $lookup: { from: 'breaklogs', localField: '_id', foreignField: 'attendanceLog', as: 'breaks' } },
            { $project: { _id: 1, attendanceDate: 1, status: 1, clockInTime: 1, clockOutTime: 1, notes: 1, paidBreakMinutesTaken: 1, unpaidBreakMinutesTaken: 1, penaltyMinutes: 1, attendanceStatus: 1, isHalfDay: 1, sessions: { $map: { input: "$sessions", as: "s", in: { startTime: "$$s.startTime", endTime: "$$s.endTime" } } }, breaks: { $map: { input: "$breaks", as: "b", in: { startTime: "$$b.startTime", endTime: "$$b.endTime", durationMinutes: "$$b.durationMinutes", breakType: "$$b.breakType" } } } } },
            { $sort: { attendanceDate: 1 } }
        ]);

        // UNIFIED RESOLUTION: Use the same resolver as Admin endpoint
        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Generate all dates in range
        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d));
        }

        // Build attendance log map
        const attendanceLogMap = new Map();
        logs.forEach(log => {
            attendanceLogMap.set(log.attendanceDate, log);
        });

        // Resolve status for all dates using unified resolver
        const resolvedStatusMap = await resolveMultipleDaysStatus({
            dates: dates,
            userId: userId,
            attendanceLogMap: attendanceLogMap,
            saturdayPolicy: user.alternateSaturdayPolicy || 'All Saturdays Working'
        });

        // Merge resolved status with attendance logs
        const logsWithResolvedStatus = logs.map(log => {
            const dateStr = log.attendanceDate;
            const resolved = resolvedStatusMap.get(dateStr);
            
            if (resolved) {
                return {
                    ...log,
                    attendanceStatus: resolved.status,
                    leave: resolved.leave ? {
                        _id: resolved.leave._id,
                        requestType: resolved.leave.requestType,
                        leaveType: resolved.leave.leaveType,
                        status: resolved.leave.status,
                        leaveDates: resolved.leave.leaveDates,
                        reason: resolved.leave.reason
                    } : null,
                    holiday: resolved.holiday ? {
                        _id: resolved.holiday._id,
                        name: resolved.holiday.name,
                        date: resolved.holiday.date
                    } : null,
                    isOnLeave: resolved.isOnLeave
                };
            }
            
            return log;
        });

        // Also include dates without attendance logs but with resolved status (holidays, leaves, weekends)
        const allDatesWithStatus = [];
        dates.forEach(date => {
            const dateStr = normalizeDateToIST(date);
            const log = attendanceLogMap.get(dateStr);
            const resolved = resolvedStatusMap.get(dateStr);
            
            if (log) {
                allDatesWithStatus.push({
                    ...log,
                    attendanceStatus: resolved ? resolved.status : log.attendanceStatus,
                    leave: resolved ? resolved.leave : null,
                    holiday: resolved ? resolved.holiday : null,
                    isOnLeave: resolved ? resolved.isOnLeave : false
                });
            } else if (resolved && resolved.status !== 'N/A') {
                // Include all resolved statuses (holidays, leaves, weekends, absent) even without attendance log
                // This ensures Absent days are visible in the UI
                allDatesWithStatus.push({
                    attendanceDate: dateStr,
                    attendanceStatus: resolved.status,
                    leave: resolved.leave,
                    holiday: resolved.holiday,
                    isOnLeave: resolved.isOnLeave,
                    sessions: [],
                    breaks: []
                });
            }
        });

        // Sort by date
        allDatesWithStatus.sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate));

        res.json(allDatesWithStatus);
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
        const today = formatDateIST(getTodayIST());

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
            startTime: new Date(),
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

        // Queue notifications for background processing (non-blocking)
        // API responds immediately, notifications processed async by queue worker
        try {
            const user = await User.findById(userId);
            if (user) {
                queueNotification.autoBreakStart(userId, user.fullName, reason);
                console.log(`[AUTO-BREAK] Notifications queued successfully`);
            }
        } catch (notificationError) {
            console.error('[AUTO-BREAK] Failed to queue notifications:', notificationError.message);
            // Don't fail the request if queueing fails
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
        const today = formatDateIST(getTodayIST());

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
        const today = formatDateIST(getTodayIST());

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
        const breakEndTime = new Date();
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
            
            // Queue notifications for background processing (non-blocking)
            // API responds immediately, notifications processed async by queue worker
            try {
                const user = await User.findById(userId);
                if (user) {
                    queueNotification.autoBreakEnd(userId, user.fullName, currentBreakDuration);
                    console.log(`[END-BREAK] Notifications queued successfully`);
                }
            } catch (notificationError) {
                console.error('[END-BREAK] Failed to queue notifications:', notificationError.message);
                // Don't fail the request if queueing fails
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
    // Use IST date utilities to ensure consistent timezone handling
    const { parseISTDate, formatDateIST, getTodayIST } = require('../utils/dateUtils');
    
    // Create month start date string in IST format
    const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthStart = parseISTDate(monthStartStr);
    
    // Get last day of month - create date in IST
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const monthEndStr = formatDateIST(lastDayOfMonth);
    const monthEnd = parseISTDate(monthEndStr);
    
    // Get today's date in IST to limit working dates if we're in the current month
    const todayIST = getTodayIST();
    const todayStr = formatDateIST(todayIST);
    
    // Check if we're querying the current month
    const todayParts = todayStr.split('-');
    const currentYear = parseInt(todayParts[0], 10);
    const currentMonth = parseInt(todayParts[1], 10) - 1; // month is 0-indexed
    const isCurrentMonth = (month === currentMonth && year === currentYear);
    
    // Determine the end date for working dates calculation
    // If current month, only count up to today; otherwise count entire month
    const endDateStr = isCurrentMonth ? todayStr : monthEndStr;
    const endDate = parseISTDate(endDateStr);
    
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
            .map(h => formatDateIST(h.date))
            .filter(dateStr => dateStr !== null)
    );
    
    const saturdayPolicy = employee?.alternateSaturdayPolicy || 'All Saturdays Working';
    const workingDates = [];
    
    // Iterate through dates using IST - start from month start, end at endDate
    let currentDate = new Date(monthStart);
    const endDateObj = new Date(endDate);
    
    while (currentDate <= endDateObj) {
        const dateStr = formatDateIST(currentDate);
        if (!dateStr) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        // Use IST date components for day of week calculation
        const dayOfWeek = currentDate.getDay();
        
        // Skip Sundays
        if (dayOfWeek === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        // Skip alternate Saturdays based on policy
        if (dayOfWeek === 6) {
            if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
        }
        
        // Skip holidays
        if (holidayDates.has(dateStr)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        workingDates.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
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

module.exports = router;
