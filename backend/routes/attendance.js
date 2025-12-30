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
const NewNotificationService = require('../services/NewNotificationService');
const logAction = require('../services/logAction');
const { getUserDailyStatus } = require('../services/dailyStatusService');
const AntiExploitationLeaveService = require('../services/antiExploitationLeaveService');

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
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { date } = req.query;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'A valid `date` query parameter is required in YYYY-MM-DD format.' });
        }

        const dailyStatus = await getUserDailyStatus(userId, date);
        return res.json(dailyStatus);
    } catch (error) {
        console.error("Error fetching status:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/clock-in', authenticateToken, geofencingMiddleware, async (req, res) => {
    const { userId } = req.user;
    const todayStr = new Date().toISOString().slice(0, 10);
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
        
        const activeSession = await AttendanceSession.findOne({ attendanceLog: attendanceLog._id, endTime: null });
        if (activeSession) { return res.status(400).json({ error: 'You are already clocked in.' }); }
        
        const newSession = await AttendanceSession.create({ 
            attendanceLog: attendanceLog._id, 
            startTime: new Date() 
        });

        // --- ANALYTICS: Check for late login and update status ---
        const clockInTime = new Date();
        
        // Use the proper timezone-aware function to get shift start time
        const shiftStartTime = getShiftDateTimeIST(clockInTime, user.shiftGroup.startTime);
        
        const lateMinutes = Math.max(0, Math.floor((clockInTime - shiftStartTime) / (1000 * 60)));
        
        let isLate = false;
        let isHalfDay = false;
        let attendanceStatus = 'On-time';

        // Grace period: configurable via settings (default 30 minutes)
        let GRACE_PERIOD_MINUTES = 30;
        try {
            const graceSetting = await Setting.findOne({ key: 'lateGraceMinutes' });
            if (graceSetting && !isNaN(Number(graceSetting.value))) {
                GRACE_PERIOD_MINUTES = Number(graceSetting.value);
            }
        } catch (err) {
            console.error('Failed to fetch late grace setting, falling back to 30 minutes', err);
        }

        // Consistent rules:
        // - If lateMinutes <= GRACE_PERIOD_MINUTES -> On-time (within grace period)
        // - If lateMinutes > GRACE_PERIOD_MINUTES -> Half-day
        // Grace period allows employees to arrive late without penalty
        if (lateMinutes <= GRACE_PERIOD_MINUTES) {
            isLate = false;
            isHalfDay = false;
            attendanceStatus = 'On-time';
        } else if (lateMinutes > GRACE_PERIOD_MINUTES) {
            isHalfDay = true;
            isLate = false;
            attendanceStatus = 'Half-day';
        }

        // Update the attendance log with analytics data
        await AttendanceLog.findByIdAndUpdate(attendanceLog._id, {
            isLate,
            isHalfDay,
            lateMinutes,
            attendanceStatus
        });

        // Track late login for weekly monitoring
        let weeklyLateInfo = null;
        if (isLate) {
            try {
                const { trackLateLogin, getWeeklyLateStats } = require('../services/weeklyLateTrackingService');
                const trackingRecord = await trackLateLogin(userId, todayStr);
                // Also fetch current week stats to inform frontend whether to show a popup
                const stats = await getWeeklyLateStats(userId);
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
                await sendLateLoginNotification(user, {
                    attendanceDate: todayStr,
                    clockInTime: clockInTime,
                    lateMinutes: lateMinutes,
                    isHalfDay: isHalfDay
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
            message: `You have successfully clocked in at ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })}.`,
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

        res.status(201).json(responsePayload);
    } catch (error) {
        console.error('Clock-in Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/clock-out', authenticateToken, async (req, res) => {
    const { userId } = req.user;
    const today = new Date().toISOString().slice(0, 10);
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
        
        await AttendanceLog.findByIdAndUpdate(log._id, { 
            $set: { 
                clockOutTime: clockOutTime,
                totalWorkingHours: totalWorkingHours,
                logoutType: 'MANUAL', // Mark as manual logout
                autoLogoutReason: null // Clear any auto-logout reason
            } 
        });
        
        // --- NOTIFICATION ---
        const user = await User.findById(userId);
        if (user) {
            // Notify admins about user clock-out
            NewNotificationService.notifyCheckOut(userId, user.fullName)
                .catch(err => console.error('Error sending clock-out notification to admins:', err));
            
            // Send confirmation to the user
            NewNotificationService.createAndEmitNotification({
                message: `You have successfully clocked out at ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })}. Total working hours: ${totalWorkingHours.toFixed(1)}h`,
                type: 'success',
                userId,
                userName: user.fullName,
                recipientType: 'user',
                category: 'attendance',
                priority: 'medium',
            }).catch(err => console.error('Error sending clock-out confirmation to user:', err));
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
            const today = new Date();
            const dayOfWeek = today.getDay();
            const firstDayOfWeek = new Date(today.setDate(today.getDate() - dayOfWeek));
            const lastDayOfWeek = new Date(firstDayOfWeek);
            lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
            startDate = firstDayOfWeek.toISOString().slice(0, 10);
            endDate = lastDayOfWeek.toISOString().slice(0, 10);
        }

        const logs = await AttendanceLog.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId), attendanceDate: { $gte: startDate, $lte: endDate } } },
            { $lookup: { from: 'attendancesessions', localField: '_id', foreignField: 'attendanceLog', as: 'sessions' } },
            { $lookup: { from: 'breaklogs', localField: '_id', foreignField: 'attendanceLog', as: 'breaks' } },
            { $project: { _id: 1, attendanceDate: 1, status: 1, clockInTime: 1, clockOutTime: 1, notes: 1, paidBreakMinutesTaken: 1, unpaidBreakMinutesTaken: 1, penaltyMinutes: 1, sessions: { $map: { input: "$sessions", as: "s", in: { startTime: "$$s.startTime", endTime: "$$s.endTime" } } }, breaks: { $map: { input: "$breaks", as: "b", in: { startTime: "$$b.startTime", endTime: "$$b.endTime", durationMinutes: "$$b.durationMinutes", breakType: "$$b.breakType" } } } } },
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
        const today = new Date().toISOString().slice(0, 10);

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
        const today = new Date().toISOString().slice(0, 10);

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
        const today = new Date().toISOString().slice(0, 10);

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
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    
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
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })
            .filter(dateStr => dateStr !== null)
    );
    
    const saturdayPolicy = employee?.alternateSaturdayPolicy || 'All Saturdays Working';
    const workingDates = [];
    
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
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

module.exports = router;
