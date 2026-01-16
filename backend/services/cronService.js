// backend/services/cronService.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Setting = require('../models/Setting');
const LeaveRequest = require('../models/LeaveRequest'); 
const { sendEmail } = require('./mailService');
const { checkAndSendWeeklyLateWarnings } = require('./analyticsEmailService');
const cron = require('node-cron');
// REMOVED: Legacy probation tracking service import
// Reason: All probation calculations now use /api/analytics/probation-tracker endpoint
const { checkAndAutoLogout } = require('./autoLogoutService');
const { getISTNow, startOfISTDay, parseISTDate, getISTDateString, getISTDateParts } = require('../utils/istTime');
const { resolveAttendanceStatus, generateDateRange } = require('../utils/attendanceStatusResolver');
const { batchFetchLeaves } = require('./leaveCache');
const Holiday = require('../models/Holiday');
const { getGracePeriod } = require('./gracePeriodCache');

// --- CONFIGURATION (from .env) ---
const PROBATION_PERIOD_DAYS = parseInt(process.env.PROBATION_PERIOD_DAYS, 10) || 90;
// const INTERN_PERIOD_DAYS = parseInt(process.env.INTERN_PERIOD_DAYS, 10) || 180; // No longer needed
const REMINDER_WINDOW_DAYS = 7;

// --- Distributed lock to avoid multi-instance duplicate cron execution ---
// Uses MongoDB collection "cron_locks" with TTL via expiresAt.
const CronLock = mongoose.model(
    'CronLock',
    new mongoose.Schema(
        {
            key: { type: String, required: true, unique: true, index: true },
            owner: { type: String, required: true },
            expiresAt: { type: Date, required: true, index: true },
        },
        { timestamps: true, collection: 'cron_locks' }
    )
);

const CRON_OWNER = `${process.pid}`;

const withCronLock = async (key, ttlMs, fn) => {
    if (mongoose.connection.readyState !== 1) {
        console.log('[CRON] Database not connected, skipping locked job:', key);
        return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    try {
        const lock = await CronLock.findOneAndUpdate(
            {
                key,
                $or: [
                    { expiresAt: { $lte: now } },
                    { owner: CRON_OWNER }
                ]
            },
            { $set: { owner: CRON_OWNER, expiresAt } },
            { upsert: true, new: true }
        );

        if (!lock || lock.owner !== CRON_OWNER) {
            console.log('[CRON] Lock not acquired, skipping job:', key);
            return;
        }

        await fn();
    } catch (err) {
        console.error('[CRON] Error running locked job:', key, err);
    }
};

/**
 * A daily job to check for employees whose probation or internship is ending soon.
 */
const checkProbationAndInternshipEndings = async () => {
    console.log(`[CRON] Running daily check for probation/internship endings at ${new Date().toLocaleString()}`);

    // Check if database is connected before running queries
    if (mongoose.connection.readyState !== 1) {
        console.log('[CRON] Database not connected, skipping daily check');
        return;
    }

    try {
        // First try to get hiring-specific email setting
        let recipients = null;
        
        const hiringEmailSetting = await Setting.findOne({ key: 'hiringNotificationEmails' });
        if (hiringEmailSetting && Array.isArray(hiringEmailSetting.value) && hiringEmailSetting.value.length > 0) {
            recipients = hiringEmailSetting.value.join(',');
        } else {
            // Fallback to general HR emails if hiring emails not configured
            const hrEmailSetting = await Setting.findOne({ key: 'hrNotificationEmails' });
            if (hrEmailSetting && Array.isArray(hrEmailSetting.value) && hrEmailSetting.value.length > 0) {
                recipients = hrEmailSetting.value.join(',');
            }
        }

        if (!recipients) {
            console.log('[CRON] No hiring/HR email recipients configured. Skipping reminder emails.');
            return;
        }

        const today = startOfISTDay();
        let gracePeriodMinutes = 30;
        try {
            const graceValue = await getGracePeriod();
            if (typeof graceValue === 'number' && !isNaN(graceValue) && graceValue >= 0) {
                gracePeriodMinutes = graceValue;
            }
        } catch (graceError) {
            console.error('[CRON] Failed to load late grace setting, defaulting to 30 minutes', graceError);
        }

        const targetUsers = await User.find({
            isActive: true,
            employmentStatus: { $in: ['Probation', 'Intern'] }
        }).lean();

        for (const user of targetUsers) {
            const joiningDate = new Date(user.joiningDate);
            let endDate;
            let periodType = user.employmentStatus;

            if (user.employmentStatus === 'Probation') {
                // COMPANY POLICY: Probation is 6 calendar months from joining date, extended by approved leaves AND absences
                // Use IST utilities for all date calculations
                const probationStartDate = startOfISTDay(joiningDate);
                const probationStartDateStr = getISTDateString(probationStartDate);
                
                // Base end date: 6 calendar months from joining
                const baseEndDate = new Date(probationStartDate);
                baseEndDate.setMonth(baseEndDate.getMonth() + 6);
                
                const todayIST = getISTNow();
                const todayStr = getISTDateString(todayIST);
                const rangeStart = probationStartDateStr;
                const rangeEnd = todayStr;
                const saturdayPolicy = user?.alternateSaturdayPolicy || 'All Saturdays Working';

                const dateRange = generateDateRange(rangeStart, rangeEnd);

                const AttendanceLog = require('../models/AttendanceLog');
                const [logs, holidays, leaveRequestsMap] = await Promise.all([
                    AttendanceLog.aggregate([
                        {
                            $match: {
                                user: user._id,
                                attendanceDate: { $gte: rangeStart, $lte: rangeEnd }
                            }
                        },
                        {
                            $lookup: {
                                from: 'attendancesessions',
                                localField: '_id',
                                foreignField: 'attendanceLog',
                                as: 'sessions'
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                attendanceDate: 1,
                                attendanceStatus: 1,
                                isHalfDay: 1,
                                halfDayReasonCode: 1,
                                halfDayReasonText: 1,
                                halfDaySource: 1,
                                overriddenByAdmin: 1,
                                lateMinutes: 1,
                                totalWorkingHours: 1,
                                logoutType: 1,
                                autoLogoutReason: 1,
                                overrideReason: 1,
                                sessions: {
                                    $map: {
                                        input: '$sessions',
                                        as: 's',
                                        in: {
                                            startTime: '$$s.startTime',
                                            endTime: '$$s.endTime'
                                        }
                                    }
                                }
                            }
                        },
                        { $sort: { attendanceDate: 1 } }
                    ]),
                    (async () => {
                        const startDateIST = parseISTDate(rangeStart);
                        const endDateIST = parseISTDate(rangeEnd);
                        return Holiday.find({
                            date: {
                                $gte: startDateIST,
                                $lte: endDateIST
                            },
                            isTentative: { $ne: true }
                        }).sort({ date: 1 }).lean();
                    })(),
                    batchFetchLeaves(user._id, rangeStart, rangeEnd)
                ]);

                const logsMap = new Map();
                logs.forEach(log => {
                    logsMap.set(log.attendanceDate, log);
                });

                let leaveExtensionDays = 0;
                let absentExtensionDays = 0;
                const countedLeaveDates = new Set();

                dateRange.forEach(attendanceDate => {
                    const log = logsMap.get(attendanceDate) || null;
                    const leaveRequest = leaveRequestsMap.get(attendanceDate) || null;

                    const statusInfo = resolveAttendanceStatus({
                        attendanceDate,
                        attendanceLog: log,
                        holidays: holidays || [],
                        leaveRequest,
                        saturdayPolicy,
                        gracePeriodMinutes
                    });

                    if (statusInfo.isLeave) {
                        if (!countedLeaveDates.has(attendanceDate)) {
                            countedLeaveDates.add(attendanceDate);
                            const leaveType = leaveRequest?.leaveType;
                            if (leaveType === 'Full Day') {
                                leaveExtensionDays += 1;
                            } else if (leaveType === 'Half Day - First Half' || leaveType === 'Half Day - Second Half') {
                                leaveExtensionDays += 0.5;
                            }
                        }
                        return;
                    }

                    if (statusInfo.isHoliday || statusInfo.isWeeklyOff) {
                        return;
                    }

                    if (statusInfo.status === 'Absent') {
                        absentExtensionDays += 1;
                        return;
                    }

                    if (statusInfo.status === 'Half-day') {
                        absentExtensionDays += 0.5;
                    }
                });
                
                // Final end date: base + leave extensions + absent extensions (calendar days)
                endDate = new Date(baseEndDate);
                const totalExtensionDays = leaveExtensionDays + absentExtensionDays;
                endDate.setDate(baseEndDate.getDate() + Math.ceil(totalExtensionDays));
            } else if (user.employmentStatus === 'Intern' && user.internshipDurationMonths > 0) {
                // --- START: Internship Extension Logic ---
                // 1. Calculate base end date
                const baseEndDate = new Date(joiningDate.getTime());
                baseEndDate.setMonth(baseEndDate.getMonth() + user.internshipDurationMonths);

                // 2. Find all approved Planned or Sick leaves for this intern
                const approvedLeaves = await LeaveRequest.find({
                    employee: user._id,
                    status: 'Approved',
                    requestType: { $in: ['Planned', 'Sick'] }
                }).lean();

                // 3. Calculate total leave days to extend the internship
                let totalLeaveDays = 0;
                approvedLeaves.forEach(leave => {
                    const duration = leave.leaveDates.length * (leave.leaveType === 'Full Day' ? 1 : 0.5);
                    totalLeaveDays += duration;
                });
                
                // 4. Calculate the actual, extended end date
                endDate = new Date(baseEndDate.getTime());
                endDate.setDate(baseEndDate.getDate() + Math.ceil(totalLeaveDays)); // Use ceil to be safe
                // --- END: Internship Extension Logic ---
            }

            if (!endDate) continue; // Skip if no valid end date could be calculated
            
            const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntilEnd > 0 && daysUntilEnd <= REMINDER_WINDOW_DAYS) {
                console.log(`[CRON] Sending reminder for ${user.fullName} whose ${periodType} period ends on ${endDate.toLocaleDateString()}`);

                const subject = `Reminder: ${user.fullName}'s ${periodType} Period Ending Soon`;
                const html = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h2 style="color: #D32F2F;">Automated Reminder</h2>
                        <p>This is a notification that the <strong>${periodType}</strong> period for the following employee is scheduled to end soon:</p>
                        <ul>
                            <li><strong>Employee Name:</strong> ${user.fullName}</li>
                            <li><strong>Employee Code:</strong> ${user.employeeCode}</li>
                            <li><strong>Calculated End Date:</strong> ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</li>
                        </ul>
                        <p>Please take the necessary action (e.g., confirmation, extension, etc.) in the admin panel.</p>
                        <p style="font-size: 0.9em; color: #777;">This is an automated message from the Attendance Management System.</p>
                    </div>
                `;
                
                sendEmail({
                    to: recipients,
                    subject,
                    html,
                    isHREmail: true,
                    mailType: 'HRProbationInternshipEndingReminder',
                    recipientType: 'hr'
                }).catch(err => {
                    console.error(`[CRON] Failed to send reminder email for ${user.fullName}:`, err);
                });
            }
        }
    } catch (error) {
        console.error('[CRON] Error during daily check:', error);
    }
};

/**
 * Weekly job to check for employees with 3+ late days and send warnings
 */
const checkWeeklyLateWarnings = async () => {
    console.log(`[CRON] Running weekly late attendance check at ${new Date().toLocaleString()}`);
    
    if (mongoose.connection.readyState !== 1) {
        console.log('[CRON] Database not connected, skipping weekly late check');
        return;
    }

    try {
        await checkAndSendWeeklyLateWarnings();
    } catch (error) {
        console.error('[CRON] Error during weekly late check:', error);
    }
};

/**
 * Daily job to check for probation completions
 */
// REMOVED: Legacy probation completion check
// Reason: All probation calculations now use /api/analytics/probation-tracker endpoint
// This cron job has been disabled. Use the probation tracker endpoint for accurate probation data.
const checkProbationCompletions = async () => {
    // REMOVED: Legacy working-days-based probation completion check
    // Use /api/analytics/probation-tracker endpoint for accurate probation calculations
    console.log('[CRON] Legacy probation completion check has been removed. Use /api/analytics/probation-tracker endpoint instead.');
};

/**
 * Auto-logout check job - runs every 5 minutes
 * This checks for employees who should be auto-logged out and performs the logout
 */
const startAutoLogoutJob = () => {
    // Run immediately on startup (with a small delay to ensure DB is ready), then every 5 minutes
    // Use setTimeout to give the database a moment to be fully ready
    setTimeout(() => {
        checkAndAutoLogout().catch(err => {
            console.error('[cronService] Error in initial auto-logout check:', err);
        });
    }, 2000); // 2 second delay
    
    const AUTO_LOGOUT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const intervalId = setInterval(() => {
        checkAndAutoLogout().catch(err => {
            console.error('[cronService] Error in scheduled auto-logout check:', err);
        });
    }, AUTO_LOGOUT_INTERVAL_MS);
    
    console.log('✅ Auto-logout job started (runs every 5 minutes)');
    console.log(`   First check will run in 2 seconds, then every ${AUTO_LOGOUT_INTERVAL_MS / 1000 / 60} minutes`);
    
    // Store interval ID for potential cleanup (if needed in future)
    return intervalId;
};

/**
 * Starts the scheduled jobs for the application.
 */
const startScheduledJobs = () => {
    // NOTE: process.env.TZ is set to Asia/Kolkata in server.js before startup.
    // node-cron will use process TZ; we also pass timezone explicitly for safety.
    const tz = process.env.TZ || 'Asia/Kolkata';

    // Daily job: probation/internship ending reminders at 09:00 IST
    cron.schedule('0 9 * * *', () => {
        withCronLock('daily:probation_internship_endings', 60 * 60 * 1000, async () => {
            await checkProbationAndInternshipEndings();
        });
    }, { timezone: tz });

    // Daily probation completion check at 09:10 IST (kept for compatibility; job currently logs only)
    cron.schedule('10 9 * * *', () => {
        withCronLock('daily:probation_completions', 60 * 60 * 1000, async () => {
            await checkProbationCompletions();
        });
    }, { timezone: tz });

    // Weekly late warnings every Monday at 09:00 IST
    cron.schedule('0 9 * * 1', () => {
        withCronLock('weekly:late_warnings', 2 * 60 * 60 * 1000, async () => {
            await checkWeeklyLateWarnings();
        });
    }, { timezone: tz });

    // Auto-logout job (runs every 5 minutes)
    startAutoLogoutJob();

    console.log('✅ Scheduled jobs (probation reminders, probation completions, weekly late warnings, auto-logout) have been started via node-cron.');
};

module.exports = { startScheduledJobs, checkProbationAndInternshipEndings };