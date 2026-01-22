// backend/services/cronService.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Setting = require('../models/Setting');
const LeaveRequest = require('../models/LeaveRequest'); // <-- NEW
const { sendEmail } = require('./mailService');
const { checkAndSendWeeklyLateWarnings } = require('./analyticsEmailService');
// REMOVED: Legacy probation tracking service import
// Reason: All probation calculations now use /api/analytics/probation-tracker endpoint
const { checkAndAutoLogout } = require('./autoLogoutService');
const { getISTNow, startOfISTDay, parseISTDate, getISTDateString, getISTDateParts } = require('../utils/istTime');

// --- CONFIGURATION (from .env) ---
const PROBATION_PERIOD_DAYS = parseInt(process.env.PROBATION_PERIOD_DAYS, 10) || 90;
// const INTERN_PERIOD_DAYS = parseInt(process.env.INTERN_PERIOD_DAYS, 10) || 180; // No longer needed
const REMINDER_WINDOW_DAYS = 7;

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
                
                // Calculate leave extensions (only approved leaves after joining date)
                const probationStartIST = parseISTDate(probationStartDateStr);
                const approvedLeaves = await LeaveRequest.find({
                    employee: user._id,
                    status: 'Approved',
                    leaveDates: {
                        $elemMatch: {
                            $gte: probationStartIST
                        }
                    }
                }).lean();
                
                let leaveExtensionDays = 0;
                const leaveDatesSet = new Set(); // Track leave dates to exclude from absent calculation
                
                approvedLeaves.forEach(leave => {
                    leave.leaveDates.forEach(leaveDate => {
                        const leaveDateStr = getISTDateString(leaveDate);
                        if (leaveDateStr >= probationStartDateStr) {
                            leaveDatesSet.add(leaveDateStr);
                            if (leave.leaveType === 'Full Day') {
                                leaveExtensionDays += 1;
                            } else if (leave.leaveType === 'Half Day - First Half' || leave.leaveType === 'Half Day - Second Half') {
                                leaveExtensionDays += 0.5;
                            }
                        }
                    });
                });
                
                // Calculate absence extensions (NEW - REQUIRED)
                const AttendanceLog = require('../models/AttendanceLog');
                const attendanceLogs = await AttendanceLog.find({
                    user: user._id,
                    attendanceDate: { $gte: probationStartDateStr }
                }).lean();
                
                let absentExtensionDays = 0;
                const absentDatesSet = new Set();
                
                attendanceLogs.forEach(log => {
                    const logDateStr = log.attendanceDate;
                    
                    // Skip if this date is covered by an approved leave
                    if (leaveDatesSet.has(logDateStr)) {
                        return;
                    }
                    
                    // Skip if already counted
                    if (absentDatesSet.has(logDateStr)) {
                        return;
                    }
                    
                    // Determine if absent (full or half day)
                    const status = log.attendanceStatus;
                    const hasClockIn = !!log.clockInTime;
                    const isHalfDayFlag = log.isHalfDay || false;
                    
                    // Full-day absent: No clock-in time OR status is 'Absent'
                    if (!hasClockIn || status === 'Absent') {
                        absentDatesSet.add(logDateStr);
                        absentExtensionDays += 1;
                    }
                    // Half-day absent: isHalfDay flag OR status is 'Half-day' (but no clock-in)
                    else if (isHalfDayFlag || status === 'Half-day') {
                        absentDatesSet.add(logDateStr);
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
                
                sendEmail({ to: recipients, subject, html, isHREmail: true }).catch(err => {
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
    // Daily jobs
    checkProbationAndInternshipEndings();
    setInterval(checkProbationAndInternshipEndings, 24 * 60 * 60 * 1000);
    
    // Daily probation completion check
    checkProbationCompletions();
    setInterval(checkProbationCompletions, 24 * 60 * 60 * 1000);
    
    // Weekly jobs (every Monday at 9 AM)
    checkWeeklyLateWarnings();
    setInterval(checkWeeklyLateWarnings, 7 * 24 * 60 * 60 * 1000);
    
    // Auto-logout job (runs every 5 minutes)
    startAutoLogoutJob();
    
    console.log('✅ Scheduled jobs (probation reminders, probation completions, weekly late warnings, auto-logout) have been started.');
};

module.exports = { startScheduledJobs, checkProbationAndInternshipEndings };