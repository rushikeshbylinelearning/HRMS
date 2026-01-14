// backend/routes/analytics.js

const express = require('express');
const mongoose = require('mongoose');
const authenticateToken = require('../middleware/authenticateToken');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const BreakLog = require('../models/BreakLog');
const LeaveRequest = require('../models/LeaveRequest');
const Setting = require('../models/Setting'); // <-- IMPORT SETTING MODEL
const Holiday = require('../models/Holiday');
const AntiExploitationLeaveService = require('../services/antiExploitationLeaveService');
const { sendEmail } = require('../services/mailService');
const { getISTNow, getISTDateString, parseISTDate, getShiftDateTimeIST, formatISTTime, getISTDateParts } = require('../utils/istTime');
const { invalidateGracePeriod } = require('../services/gracePeriodCache');
const { batchFetchLeaves } = require('../services/leaveCache');
const { resolveAttendanceStatus, generateDateRange } = require('../utils/attendanceStatusResolver');
const { getAttendanceSummaryForEmployees } = require('../services/attendanceSummaryBulkService');
const { getLeaveSummaryForEmployees } = require('../services/leaveSummaryService');
const {
  computeLeaveSummary,
  countLeaveRequestsInRangeAllStatuses,
  countLeaveRequestsInRangeAllStatuses: countLeaveRequestsYTDAllStatuses,
  countLeaveRequestsAllTime,
  getOldestLeaveDateStr
} = require('../services/leaveSummaryCoreService');

const router = express.Router();

/**
 * Helper function to get working dates for a date range
 * Excludes: Sundays, Alternate Saturdays (based on employee policy), Holidays
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Object} employee - Employee object with alternateSaturdayPolicy
 * @returns {Promise<Set<string>>} Set of working dates in YYYY-MM-DD format
 */
const getWorkingDatesForRange = async (startDate, endDate, employee) => {
  const startDateObj = parseISTDate(startDate);
  const endDateObj = parseISTDate(endDate);
  endDateObj.setHours(23, 59, 59, 999);
  
  // Get all holidays in this date range (exclude tentative holidays)
  const holidays = await Holiday.find({
    date: {
      $gte: startDateObj,
      $lte: endDateObj,
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
  const workingDates = new Set();
  
  // Iterate through each day in the range
  for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
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
    
    // It's a working day
    workingDates.add(dateStr);
  }
  
  return workingDates;
};

// Helper function to calculate analytics metrics
const calculateAnalyticsMetrics = async (userId, startDate, endDate, monthlyContextDays) => { // <-- ADDED PARAM
  // Ensure dates are in YYYY-MM-DD format (string comparison for MongoDB) - use IST
  const normalizedStartDate = typeof startDate === 'string' ? startDate : getISTDateString(startDate);
  const normalizedEndDate = typeof endDate === 'string' ? endDate : getISTDateString(endDate);
  
  // Fetch employee to get alternateSaturdayPolicy for working days calculation
  // This is required to determine which Saturdays are working days for this employee
  let employee = null;
  try {
    employee = await User.findById(userId).select('alternateSaturdayPolicy').lean();
  } catch (userError) {
    console.error('Error fetching employee for working days calculation:', userError);
    // Continue with default policy if employee fetch fails
    employee = { alternateSaturdayPolicy: 'All Saturdays Working' };
  }
  
  // Get working dates for the period (excludes Sundays, holidays, alternate off-Saturdays)
  // This ensures we only count attendance on valid working days
  const workingDatesSet = await getWorkingDatesForRange(normalizedStartDate, normalizedEndDate, employee);
  
  // Fetch all attendance logs in the date range
  const logs = await AttendanceLog.find({
    user: userId,
    attendanceDate: { $gte: normalizedStartDate, $lte: normalizedEndDate }
  }).sort({ attendanceDate: 1 });

  // Filter logs to only include working days
  // This ensures totalDays represents ACTUAL WORKED DAYS, not all attendance records
  const workingDayLogs = logs.filter(log => workingDatesSet.has(log.attendanceDate));

  const metrics = {
    totalDays: workingDayLogs.length, // ← FIXED: Now counts only working days, not all attendance logs
    onTimeDays: 0,
    lateDays: 0,
    halfDays: 0,
    absentDays: 0,
    leaveDays: 0, // PHASE 5: Add separate count for leave days
    totalWorkingHours: 0,
    averageWorkingHours: 0,
    lateMinutes: 0,
    averageLateMinutes: 0
  };
  // Read dynamic late-grace setting so our derivation matches runtime behavior
  let lateGraceMinutes = 30;
  try {
    const graceSetting = await Setting.findOne({ key: 'lateGraceMinutes' });
    if (graceSetting && !isNaN(Number(graceSetting.value))) {
      lateGraceMinutes = Number(graceSetting.value);
    }
  } catch (err) {
    console.error('Failed to fetch late grace setting for analytics derivation, using default 30 minutes', err);
  }

  // Process only working day logs for status calculations
  // This ensures all metrics (onTimeDays, lateDays, etc.) are based on working days only
  // PHASE 5: Use AttendanceLog.attendanceStatus as single source of truth (includes Leave status)
  workingDayLogs.forEach(log => {
    // Use attendanceStatus directly - it's the single source of truth
    // After Phase 2, this field includes 'Leave' status from leave approval sync
    let status = log.attendanceStatus;
    
    // Fallback for legacy records that might not have attendanceStatus set
    if (!status) {
      const lm = log.lateMinutes || 0;

      // Consistent rules:
      // - If clockInTime exists, employee was present (not absent)
      // - If lm <= lateGraceMinutes -> On-time (within grace period)
      // - If lm > lateGraceMinutes -> Half-day
      // - Else -> Absent
      // Grace period allows employees to arrive late without penalty
      if (log.clockInTime) {
        // Employee was present, determine if on-time or half-day
        if (log.isHalfDay || lm > lateGraceMinutes) {
          status = 'Half-day';
        } else {
          status = 'On-time';
        }
      } else {
        // No clock-in time means truly absent
        status = 'Absent';
      }
    }

    // PHASE 5: Count Leave separately and exclude from absentDays
    if (status === 'On-time') metrics.onTimeDays++;
    else if (status === 'Late') metrics.lateDays++;
    else if (status === 'Half-day') metrics.halfDays++;
    else if (status === 'Leave') metrics.leaveDays++; // Count leave separately
    else if (status === 'Absent') metrics.absentDays++; // Only count true absences (not leaves)

    // Only count working hours for days that have been completed (clocked out)
    // Leave days don't have working hours
    if (log.clockOutTime && log.totalWorkingHours && status !== 'Leave') {
      metrics.totalWorkingHours += log.totalWorkingHours;
    }
    
    // Only count late minutes for non-leave days
    if (status !== 'Leave') {
      metrics.lateMinutes += log.lateMinutes || 0;
    }
  });

  // Calculate average working hours only for completed days (from working day logs)
  const completedDays = workingDayLogs.filter(log => log.clockOutTime && log.totalWorkingHours).length;
  metrics.averageWorkingHours = completedDays > 0 ? (metrics.totalWorkingHours / completedDays) : 0;
  
  // Add additional metrics for better debugging
  metrics.completedDays = completedDays;
  metrics.incompleteDays = metrics.totalDays - completedDays;
  metrics.averageLateMinutes = metrics.lateDays > 0 ? (metrics.lateMinutes / metrics.lateDays) : 0;

  // Calculate monthly working days context
  const startDateObj = new Date(normalizedStartDate);
  const endDateObj = new Date(normalizedEndDate);
  
  // Get leave requests for the period (all statuses to show applied leaves count)
  /**
   * @deprecated
   * Inline leave calculations have been extracted to
   * backend/services/leaveSummaryCoreService.js.
   * Routes must not implement leave-day counting.
   */

  let leaveRequestsCount = 0;
  try {
    // Preserve existing behavior: "applied leaves count" includes all statuses.
    leaveRequestsCount = await countLeaveRequestsInRangeAllStatuses({
      employeeId: userId,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate
    });
  } catch (leaveError) {
    console.error('Error fetching leave requests:', leaveError);
    leaveRequestsCount = 0;
  }

  // Preserve existing semantics: totalLeaveDays counts each leave date as 1 day
  const leaveSummaryPeriod = await computeLeaveSummary({
    employeeId: userId,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate
  });
  const totalLeaveDays = (leaveSummaryPeriod.fullDayLeaveCount || 0) + (leaveSummaryPeriod.halfDayLeaveCount || 0);

  // Additionally compute Year-To-Date and All-Time leave aggregates so UI can show
  // leaves even when current table period is a different month
  const nowIST = getISTNow();
  const dateParts = getISTDateParts(nowIST);
  const ytdStart = new Date(dateParts.year, 0, 1);
  const todayDate = nowIST;

  const ytdStartStr = `${dateParts.year}-01-01`;
  const todayStr = getISTDateString(todayDate);

  let leaveRequestsYTDCount = 0;
  try {
    leaveRequestsYTDCount = await countLeaveRequestsYTDAllStatuses({
      employeeId: userId,
      startDate: ytdStartStr,
      endDate: todayStr
    });
  } catch (leaveYTDError) {
    console.error('Error fetching YTD leave requests:', leaveYTDError);
    leaveRequestsYTDCount = 0;
  }

  const leaveSummaryYTD = await computeLeaveSummary({
    employeeId: userId,
    startDate: ytdStartStr,
    endDate: todayStr
  });
  const totalLeaveDaysYTD = (leaveSummaryYTD.fullDayLeaveCount || 0) + (leaveSummaryYTD.halfDayLeaveCount || 0);

  // All-time aggregates (no date filter)
  // Preserve existing semantics: all-time totalLeaveDays counts each leave date as 1 day
  const allTimeStartStr = (await getOldestLeaveDateStr({ employeeId: userId })) || todayStr;
  const leaveSummaryAllTime = await computeLeaveSummary({
    employeeId: userId,
    startDate: allTimeStartStr,
    endDate: todayStr
  });
  const totalLeaveDaysAllTime = (leaveSummaryAllTime.fullDayLeaveCount || 0) + (leaveSummaryAllTime.halfDayLeaveCount || 0);

  const leaveRequestsAllTimeCount = await countLeaveRequestsAllTime({ employeeId: userId });

  // --- START OF FIX ---
  // Use the monthlyContextDays from settings for the denominator.
  metrics.totalDaysInPeriod = monthlyContextDays;
  metrics.workingDaysRatio = monthlyContextDays > 0 ? (metrics.totalDays / monthlyContextDays) : 0;
  metrics.totalLeaveDays = totalLeaveDays;
  metrics.leaveRequests = leaveRequestsCount;
  metrics.totalLeaveDaysYTD = totalLeaveDaysYTD;
  metrics.leaveRequestsYTD = leaveRequestsYTDCount;
  metrics.totalLeaveDaysAllTime = totalLeaveDaysAllTime;
  metrics.leaveRequestsAllTime = leaveRequestsAllTimeCount;
  metrics.monthlyContext = `${metrics.totalDays}/${monthlyContextDays} days worked`;
  // --- END OF FIX ---

  return metrics;
};

// Use central IST utility for shift date/time calculation
// getShiftDateTimeIST is imported from '../utils/istTime'

// Helper function to check if login is late and update attendance log
const checkAndUpdateLateStatus = async (attendanceLog, user) => {
  if (!user.shiftGroup || !user.shiftGroup.startTime) return;

  const clockInTime = new Date(attendanceLog.clockInTime);
  
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
    if (graceSetting) {
      // FIX: Explicitly convert to integer to ensure type consistency
      const graceValue = parseInt(Number(graceSetting.value), 10);
      if (!isNaN(graceValue) && graceValue >= 0) {
        GRACE_PERIOD_MINUTES = graceValue;
      } else {
        console.warn(`[Grace Period] Invalid value in database: ${graceSetting.value}, using default 30`);
      }
    }
  } catch (err) {
    console.error('Failed to fetch late grace setting, falling back to 30 minutes', err);
  }
  console.log(`[Grace Period] Using grace period: ${GRACE_PERIOD_MINUTES} minutes for late calculation (lateMinutes: ${lateMinutes})`);

  // Consistent rules:
  // - If lateMinutes <= GRACE_PERIOD_MINUTES -> On-time (within grace period)
  // - If lateMinutes > GRACE_PERIOD_MINUTES -> Half-day AND Late (for tracking/notifications)
  // - Employee is always present if they clocked in (never absent)
  // Grace period allows employees to arrive late without penalty
  let halfDayReasonCode = null;
  let halfDayReasonText = '';
  let halfDaySource = null;
  
  if (lateMinutes <= GRACE_PERIOD_MINUTES) {
    isLate = false;
    isHalfDay = false;
    attendanceStatus = 'On-time';
  } else if (lateMinutes > GRACE_PERIOD_MINUTES) {
    isHalfDay = true;
    isLate = true; // FIX: Set isLate=true for tracking and notifications
    attendanceStatus = 'Half-day';
    // Set half-day reason for late login
    halfDayReasonCode = 'LATE_LOGIN';
    const clockInTimeStr = clockInTime.toLocaleTimeString('en-US', { 
      timeZone: 'Asia/Kolkata',
      hour12: true, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    halfDayReasonText = `Late login beyond ${GRACE_PERIOD_MINUTES} min grace period (logged at ${clockInTimeStr}, ${lateMinutes} minutes late)`;
    halfDaySource = 'AUTO';
  }

  // Update the attendance log with half-day reason
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

  // Send email notification if late and not already sent
  if (isLate && !attendanceLog.lateNotificationSent) {
    try {
      // Convert minutes to hours and minutes for better readability
      const lateHours = Math.floor(lateMinutes / 60);
      const remainingMinutes = lateMinutes % 60;
      const lateTimeText = lateHours > 0 
        ? `${lateHours}h ${remainingMinutes}m` 
        : `${remainingMinutes}m`;

      const subject = "Late Login Notification - AMS Portal";
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <!-- Header with Company Logo -->
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #ddd;">
            <img src="https://bylinelearning.com/wp-content/uploads/2023/08/Byline-Logo.png" alt="Byline Learning" style="height: 40px; max-width: 200px;">
          </div>
          
          <!-- Main Content -->
          <div style="padding: 30px;">
            <!-- Alert Header -->
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
              <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                <span style="color: #856404; font-size: 20px; font-weight: bold;">⚠️</span>
              </div>
              <h2 style="color: #d32f2f; margin: 0; font-size: 24px;">Late Login Alert</h2>
            </div>

            <!-- Login Details -->
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <p style="margin: 0 0 10px 0; font-size: 16px;">Dear <strong>${user.fullName}</strong>,</p>
              <p style="margin: 0 0 10px 0; font-size: 16px;">You logged in late on <strong>${attendanceLog.attendanceDate}</strong> at <strong>${clockInTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true })}</strong>.</p>
              <p style="margin: 0; font-size: 16px; color: #d32f2f; font-weight: bold;">Late by: <strong>${lateTimeText}</strong></p>
            </div>

            <!-- Policy Notification -->
            ${isHalfDay ? `
            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <div style="display: flex; align-items: center;">
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; margin-right: 10px;">
                  <span style="color: #856404; font-size: 16px; font-weight: bold;">⚠️</span>
                </div>
                <p style="margin: 0; color: #d32f2f; font-weight: bold; font-size: 16px;">HALF DAY MARKED: As per company policy, this will be considered as Half Day.</p>
              </div>
            </div>
            ` : ''}

            <!-- Reminder -->
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <p style="margin: 0; color: #0c5460; font-size: 16px;">Please ensure you arrive on time to maintain good attendance records.</p>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #ddd; padding-top: 20px; text-align: center;">
              <p style="color: #666; font-size: 12px; margin: 0 0 5px 0;">This is an automated notification from AMS Portal.</p>
              <p style="color: #666; font-size: 12px; margin: 0;">If you have any concerns, please contact HR.</p>
            </div>
          </div>
        </div>
      `;
      
      sendEmail({
        to: user.email,
        subject,
        html,
        isHREmail: false,
        mailType: 'EmployeeLateLogin',
        recipientType: 'employee'
      }).catch(err => {
        console.error('Error sending late login notification:', err);
      });
      
      // Mark that notification has been sent
      await AttendanceLog.findByIdAndUpdate(attendanceLog._id, {
        lateNotificationSent: true
      });
      
      console.log(`Late login notification sent to ${user.email} for ${attendanceLog.attendanceDate}`);
    } catch (error) {
      console.error('Error sending late login notification:', error);
    }
  }

  return { isLate, isHalfDay, lateMinutes, attendanceStatus };
};

// GET /api/analytics/monthly-overview - Get monthly overview data for charts
router.get('/monthly-overview', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all active users
    const users = await User.find({ isActive: true }).lean();
    const userIds = users.map(user => user._id);
    
    // Generate monthly data for the last 3 months
    const monthlyData = [];
    
    for (let i = 2; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      
      const monthLogs = await AttendanceLog.find({
        user: { $in: userIds },
        attendanceDate: { 
          $gte: getISTDateString(monthStart),
          $lte: getISTDateString(monthEnd)
        }
      }).populate('user', 'fullName email department').lean();
      
      const monthMetrics = {
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        onTime: monthLogs.filter(log => log.attendanceStatus === 'On-time').length,
        late: monthLogs.filter(log => log.attendanceStatus === 'Late').length,
        halfDay: monthLogs.filter(log => log.attendanceStatus === 'Half-day').length,
        absent: monthLogs.filter(log => log.attendanceStatus === 'Absent').length
      };
      
      monthlyData.push(monthMetrics);
    }
    
    console.log('Monthly overview data:', monthlyData);
    res.json({ monthlyData });

  } catch (error) {
    console.error('Error fetching monthly overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/overview - Get today's overview for dashboard cards
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    const { date } = req.query;
    
    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const targetDate = date || getISTDateString();
    
    // Get all active users
    const users = await User.find({ isActive: true }).lean();
    const userIds = users.map(user => user._id);
    
    // Get today's attendance logs
    const todayLogs = await AttendanceLog.find({
      user: { $in: userIds },
      attendanceDate: targetDate
    }).populate('user', 'fullName email department').lean();
    
    // Calculate overview metrics
    const totalEmployees = users.length;
    const presentEmployees = todayLogs.length;
    const lateEmployees = todayLogs.filter(log => log.isLate).length;
    const halfDayEmployees = todayLogs.filter(log => log.isHalfDay).length;
    const absentEmployees = totalEmployees - presentEmployees;
    
    console.log('Analytics overview calculation:', {
      targetDate,
      totalEmployees,
      presentEmployees,
      lateEmployees,
      halfDayEmployees,
      absentEmployees,
      todayLogsCount: todayLogs.length
    });
    
    // Get detailed lists for clickable cards
    const lateEmployeesList = todayLogs
      .filter(log => log.isLate)
      .map(log => ({
        id: log.user._id,
        name: log.user.fullName,
        email: log.user.email,
        department: log.user.department,
        loginTime: log.clockInTime,
        lateMinutes: log.lateMinutes,
        status: log.attendanceStatus
      }));
    
    const halfDayEmployeesList = todayLogs
      .filter(log => log.isHalfDay)
      .map(log => ({
        id: log.user._id,
        name: log.user.fullName,
        email: log.user.email,
        department: log.user.department,
        loginTime: log.clockInTime,
        lateMinutes: log.lateMinutes,
        status: log.attendanceStatus
      }));
    
    const absentEmployeesList = users
      .filter(user => !todayLogs.some(log => log.user._id.toString() === user._id.toString()))
      .map(user => ({
        id: user._id,
        name: user.fullName,
        email: user.email,
        department: user.department,
        status: 'Absent'
      }));
    
    // Present employees include ALL who have attendance logs (on-time, late, half-day)
    const presentEmployeesList = todayLogs
      .map(log => ({
        id: log.user._id,
        name: log.user.fullName,
        email: log.user.email,
        department: log.user.department,
        loginTime: log.clockInTime,
        lateMinutes: log.lateMinutes || 0,
        status: log.attendanceStatus || 'Present'
      }));

    const responseData = {
      date: targetDate,
      overview: {
        totalEmployees,
        presentEmployees,
        lateEmployees,
        halfDayEmployees,
        absentEmployees
      },
      details: {
        lateEmployees: lateEmployeesList,
        halfDayEmployees: halfDayEmployeesList,
        absentEmployees: absentEmployeesList,
        presentEmployees: presentEmployeesList
      }
    };
    
    console.log('Analytics overview response:', responseData);
    res.json(responseData);

  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/employee/:id - Get analytics for specific employee
router.get('/employee/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user;
    const { startDate, endDate } = req.query;

    // Check permissions
    if (role !== 'Admin' && role !== 'HR' && userId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }
    
    console.log('Analytics request for user ID:', id);

    const user = await User.findById(id).populate('shiftGroup');
    if (!user) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Default to last 3 months if no dates provided to get more data
    // Use IST timezone for consistent date calculations
    const nowIST = getISTNow();
    const dateParts = getISTDateParts(nowIST);
    const defaultStartDate = getISTDateString(new Date(dateParts.year, dateParts.monthIndex - 3, 1));
    const defaultEndDate = getISTDateString(new Date(dateParts.year, dateParts.monthIndex + 1, 0));
    
    const start = startDate || defaultStartDate;
    const end = endDate || defaultEndDate;
    
    console.log(`Fetching analytics for user ${id} from ${start} to ${end}`);
    
    // Debug: Log the date range and timezone info
    console.log('Analytics API - Date info:', {
      serverTime: now.toISOString(),
      serverTimeIST: nowIST.toISOString(),
      startDate: start,
      endDate: end,
      startDateObj: new Date(start),
      endDateObj: new Date(end)
    });

    // Get attendance logs with analytics data (including sessions and breaks)
    let logs = [];
    try {
      logs = await AttendanceLog.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(id), attendanceDate: { $gte: start, $lte: end } } },
        { $lookup: { from: 'attendancesessions', localField: '_id', foreignField: 'attendanceLog', as: 'sessions' } },
        { $lookup: { from: 'breaklogs', localField: '_id', foreignField: 'attendanceLog', as: 'breaks' } },
        { $sort: { attendanceDate: -1 } }
      ]);
      
      console.log(`Found ${logs.length} attendance logs for user ${id}`);
      console.log('Log dates:', logs.map(log => ({
        date: log.attendanceDate,
        hasSessions: log.sessions && log.sessions.length > 0,
        hasBreaks: log.breaks && log.breaks.length > 0,
        clockInTime: log.clockInTime,
        clockOutTime: log.clockOutTime
      })));
    } catch (aggregationError) {
      console.error('Aggregation error details:', {
        error: aggregationError.message,
        stack: aggregationError.stack,
        employeeId: id,
        dateRange: { start, end }
      });
      // Fallback to simple find query if aggregation fails
      try {
        logs = await AttendanceLog.find({
          user: id,
          attendanceDate: { $gte: start, $lte: end }
        }).sort({ attendanceDate: -1 });
        console.log(`Fallback: Found ${logs.length} attendance logs for user ${id}`);
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        throw new Error(`Failed to fetch attendance logs: ${fallbackError.message}`);
      }
    }

    // Fetch the monthly context setting
    let monthlyContextDays = 30;
    try {
      const contextSetting = await Setting.findOne({ key: 'monthlyContextDays' });
      monthlyContextDays = contextSetting ? parseInt(contextSetting.value) : 30;
      console.log(`Using monthlyContextDays: ${monthlyContextDays}`);
    } catch (settingError) {
      console.error('Setting query error:', {
        error: settingError.message,
        stack: settingError.stack
      });
      // Use default value
      monthlyContextDays = 30;
    }

    // Calculate metrics
    let metrics;
    try {
      metrics = await calculateAnalyticsMetrics(id, start, end, monthlyContextDays);
      console.log('Calculated metrics successfully:', {
        totalDays: metrics.totalDays,
        onTimeDays: metrics.onTimeDays,
        totalWorkingHours: metrics.totalWorkingHours
      });
    } catch (metricsError) {
      console.error('Error calculating metrics:', {
        error: metricsError.message,
        stack: metricsError.stack,
        employeeId: id,
        dateRange: { start, end },
        monthlyContextDays
      });
      // Return default metrics if calculation fails
      metrics = {
        totalDays: 0,
        onTimeDays: 0,
        presentDays: 0,
        lateDays: 0,
        halfDays: 0,
        absentDays: 0,
        totalWorkingHours: 0,
        averageWorkingHours: 0,
        completedDays: 0,
        totalLeaveDays: 0,
        leaveRequests: 0,
        totalLeaveDaysYTD: 0,
        leaveRequestsYTD: 0,
        totalLeaveDaysAllTime: 0,
        leaveRequestsAllTime: 0
      };
    }

    // Analytics-only derived data (must remain read-only): working hours computed in-memory
    // for logs that do not already have totalWorkingHours.
    let computedWorkingHoursByLogId = null;
    
    // Calculate actual working hours from attendance sessions if not available
    if (metrics.totalWorkingHours === 0 && metrics.totalDays > 0) {
      console.log('Calculating working hours from attendance sessions for user:', id);
      
      try {
        let totalCalculatedHours = 0;
        let daysWithSessions = 0;
        computedWorkingHoursByLogId = new Map();
      
      for (const log of logs) {
        // Use sessions data if available, otherwise fall back to clockInTime/clockOutTime
        let workingHours = 0;
        
        if (log.sessions && log.sessions.length > 0) {
          // Calculate from sessions
          let totalSessionMinutes = 0;
          for (const session of log.sessions) {
            if (session.startTime && session.endTime) {
              const sessionMinutes = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60);
              totalSessionMinutes += sessionMinutes;
            }
          }
          workingHours = totalSessionMinutes / 60;
        } else if (log.clockInTime && log.clockOutTime) {
          // Fallback to clock-in/out times
          const workingMinutes = (new Date(log.clockOutTime) - new Date(log.clockInTime)) / (1000 * 60);
          workingHours = workingMinutes / 60;
        }
        
        if (workingHours > 0) {
          // Calculate break time from breaks array
          let totalBreakMinutes = 0;
          if (log.breaks && log.breaks.length > 0) {
            for (const breakItem of log.breaks) {
              if (breakItem.startTime && breakItem.endTime) {
                const breakMinutes = (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60);
                totalBreakMinutes += breakMinutes;
              }
            }
          } else {
            // Fallback to stored break minutes
            totalBreakMinutes = (log.paidBreakMinutesTaken || 0) + (log.unpaidBreakMinutesTaken || 0);
          }
          
          const netWorkingHours = Math.max(0, workingHours - (totalBreakMinutes / 60));
          
          totalCalculatedHours += netWorkingHours;
          daysWithSessions++;

          // Analytics must be read-only: compute in-memory only (do NOT persist)
          computedWorkingHoursByLogId.set(String(log._id), netWorkingHours);
        }
      }
      
        if (daysWithSessions > 0) {
          metrics.totalWorkingHours = totalCalculatedHours;
          metrics.averageWorkingHours = totalCalculatedHours / daysWithSessions;
          metrics.completedDays = daysWithSessions;
          console.log(`Calculated working hours for user ${id}: ${totalCalculatedHours.toFixed(2)}h total, ${(totalCalculatedHours / daysWithSessions).toFixed(2)}h average`);
        }
      } catch (workingHoursError) {
        console.error('Error calculating working hours:', workingHoursError);
        // Continue with existing metrics
      }
    }
    
    // Debug logging
    console.log(`Analytics for user ${id}:`, {
      totalDays: metrics.totalDays,
      totalWorkingHours: metrics.totalWorkingHours,
      averageWorkingHours: metrics.averageWorkingHours,
      completedDays: metrics.completedDays,
      incompleteDays: metrics.incompleteDays,
      logsWithWorkingHours: logs.filter(log => log.totalWorkingHours > 0).length
    });
    
    // Additional debug: Log all attendance logs with their working hours
    console.log('All attendance logs for user:', logs.map(log => ({
      date: log.attendanceDate,
      clockInTime: log.clockInTime,
      clockOutTime: log.clockOutTime,
      totalWorkingHours: log.totalWorkingHours,
      attendanceStatus: log.attendanceStatus
    })));

    // Get detailed logs with sessions and breaks
    const sessionsByLogId = new Map();
    const breaksByLogId = new Map();

    const logsNeedingSessions = logs.filter(log => !log.sessions || log.sessions.length === 0).map(log => log._id);
    const logsNeedingBreaks = logs.filter(log => !log.breaks || log.breaks.length === 0).map(log => log._id);

    if (logsNeedingSessions.length > 0) {
      const sessions = await AttendanceSession.find({ attendanceLog: { $in: logsNeedingSessions } })
        .sort({ startTime: 1 })
        .lean();
      sessions.forEach(s => {
        const key = String(s.attendanceLog);
        const arr = sessionsByLogId.get(key);
        if (arr) arr.push(s);
        else sessionsByLogId.set(key, [s]);
      });
    }

    if (logsNeedingBreaks.length > 0) {
      const breaks = await BreakLog.find({ attendanceLog: { $in: logsNeedingBreaks } })
        .sort({ startTime: 1 })
        .lean();
      breaks.forEach(b => {
        const key = String(b.attendanceLog);
        const arr = breaksByLogId.get(key);
        if (arr) arr.push(b);
        else breaksByLogId.set(key, [b]);
      });
    }

    const detailedLogs = logs.map((log) => {
      // If log already has sessions and breaks from aggregation, use them
      // Otherwise, fetch them separately
      const logObject = log.toObject ? log.toObject() : { ...log };
      const logIdStr = String(logObject._id);

      let sessions = logObject.sessions || [];
      let breaks = logObject.breaks || [];

      if (!logObject.sessions || logObject.sessions.length === 0) {
        sessions = sessionsByLogId.get(logIdStr) || [];
      }
      if (!logObject.breaks || logObject.breaks.length === 0) {
        breaks = breaksByLogId.get(logIdStr) || [];
      }

      // If we computed working hours in-memory earlier, reflect that in the response
      // without writing back to the database.
      if (logObject && (logObject.totalWorkingHours === 0 || logObject.totalWorkingHours == null)) {
        const computed = computedWorkingHoursByLogId
          ? computedWorkingHoursByLogId.get(String(logObject._id))
          : undefined;
        if (typeof computed === 'number' && !Number.isNaN(computed)) {
          logObject.totalWorkingHours = computed;
        }
      }

      return {
        ...logObject,
        sessions,
        breaks
      };
    });

    // Calculate weekly and monthly trends for charts
    const weeklyData = [];
    const monthlyData = [];

    const weekRanges = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + (i * 7)));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekRanges.push({
        label: `Week ${8-i}`,
        start: getISTDateString(weekStart),
        end: getISTDateString(weekEnd)
      });
    }

    const monthRanges = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthRanges.push({
        startDateObj: monthStart,
        start: getISTDateString(monthStart),
        end: getISTDateString(monthEnd)
      });
    }

    const chartMinStart = weekRanges.length > 0 ? weekRanges[0].start : null;
    const chartMaxEnd = weekRanges.length > 0 ? weekRanges[weekRanges.length - 1].end : null;
    const monthMinStart = monthRanges.length > 0 ? monthRanges[0].start : null;
    const monthMaxEnd = monthRanges.length > 0 ? monthRanges[monthRanges.length - 1].end : null;

    const minStart = [chartMinStart, monthMinStart].filter(Boolean).sort()[0];
    const maxEnd = [chartMaxEnd, monthMaxEnd].filter(Boolean).sort().slice(-1)[0];

    let chartLogsAll = [];
    if (minStart && maxEnd) {
      chartLogsAll = await AttendanceLog.find({
        user: id,
        attendanceDate: { $gte: minStart, $lte: maxEnd }
      }).lean();
    }

    const buildBucket = (bucketLogs) => {
      const onTime = bucketLogs.filter(l => l.attendanceStatus === 'On-time').length;
      const late = bucketLogs.filter(l => l.attendanceStatus === 'Late').length;
      const halfDay = bucketLogs.filter(l => l.attendanceStatus === 'Half-day').length;
      const absent = bucketLogs.filter(l => l.attendanceStatus === 'Absent').length;
      const avgWorkingHours = bucketLogs.length > 0
        ? (bucketLogs.reduce((sum, l) => sum + (l.totalWorkingHours || 0), 0) / bucketLogs.length)
        : 0;
      return { onTime, late, halfDay, absent, avgWorkingHours };
    };
    
    // Generate weekly data for the last 8 weeks
    for (const r of weekRanges) {
      const weekLogs = chartLogsAll.filter(l => l.attendanceDate >= r.start && l.attendanceDate <= r.end);
      const b = buildBucket(weekLogs);
      weeklyData.push({
        week: r.label,
        onTime: b.onTime,
        late: b.late,
        halfDay: b.halfDay,
        absent: b.absent,
        avgWorkingHours: b.avgWorkingHours
      });
    }
    
    // Generate monthly data for the last 6 months
    for (const r of monthRanges) {
      const monthLogs = chartLogsAll.filter(l => l.attendanceDate >= r.start && l.attendanceDate <= r.end);
      const b = buildBucket(monthLogs);
      monthlyData.push({
        month: r.startDateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        onTime: b.onTime,
        late: b.late,
        halfDay: b.halfDay,
        absent: b.absent,
        avgWorkingHours: b.avgWorkingHours
      });
    }

    res.json({
      employee: {
        id: user._id,
        name: user.fullName,
        email: user.email,
        department: user.department,
        designation: user.designation
      },
      period: { start, end },
      metrics,
      logs: detailedLogs,
      charts: {
        weekly: weeklyData,
        monthly: monthlyData
      }
    });

  } catch (error) {
    console.error('Error fetching employee analytics:', {
      error: error.message,
      stack: error.stack,
      employeeId: req.params.id,
      query: req.query
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/analytics/all - Get analytics for all employees (Admin/HR only)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    const { startDate, endDate, department, employeeId } = req.query;

    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Default to current month (IST) if no dates provided
    const nowIST = getISTNow();
    const dp = getISTDateParts(nowIST);
    const defaultStartDate = getISTDateString(new Date(dp.year, dp.monthIndex, 1));
    const defaultEndDate = getISTDateString(new Date(dp.year, dp.monthIndex + 1, 0));
    
    const start = startDate || defaultStartDate;
    const end = endDate || defaultEndDate;

    // --- START OF FIX ---
    // Fetch the monthly context setting before processing employees
    const contextSetting = await Setting.findOne({ key: 'monthlyContextDays' });
    const monthlyContextDays = contextSetting ? contextSetting.value : 30; // Default to 30 if not set
    // --- END OF FIX ---

    // Build query for users
    let userQuery = { isActive: true };
    if (department) userQuery.department = department;
    if (employeeId) userQuery._id = employeeId;

    const users = await User.find(userQuery).populate('shiftGroup');

    const userIds = users.map(u => u._id);
    const logsAll = await AttendanceLog.find({
      user: { $in: userIds },
      attendanceDate: { $gte: start, $lte: end }
    })
      .sort({ attendanceDate: -1 })
      .lean();

    const logsByUserId = new Map();
    logsAll.forEach(l => {
      const key = String(l.user);
      const arr = logsByUserId.get(key);
      if (arr) arr.push(l);
      else logsByUserId.set(key, [l]);
    });
    
    // Get analytics for each user
    const employeeAnalytics = await Promise.all(users.map(async (user) => {
      // Pass the fetched setting to the metrics calculator
      const metrics = await calculateAnalyticsMetrics(user._id, start, end, monthlyContextDays);
      
      // Calculate actual working hours from attendance sessions if not available
      if (metrics.totalWorkingHours === 0 && metrics.totalDays > 0) {
        console.log(`Calculating working hours from attendance sessions for user: ${user.fullName}`);
        
        // Use pre-fetched logs (analytics must remain read-only)
        const userLogs = logsByUserId.get(String(user._id)) || [];
        
        let totalCalculatedHours = 0;
        let daysWithSessions = 0;
        
        for (const log of userLogs) {
          if (log.clockInTime && log.clockOutTime) {
            // Calculate working hours from clock-in to clock-out
            const workingMinutes = (new Date(log.clockOutTime) - new Date(log.clockInTime)) / (1000 * 60);
            const workingHours = workingMinutes / 60;
            
            // Subtract break time if available
            const breakMinutes = (log.paidBreakMinutesTaken || 0) + (log.unpaidBreakMinutesTaken || 0);
            const netWorkingHours = Math.max(0, workingHours - (breakMinutes / 60));
            
            totalCalculatedHours += netWorkingHours;
            daysWithSessions++;
          }
        }
        
        if (daysWithSessions > 0) {
          metrics.totalWorkingHours = totalCalculatedHours;
          metrics.averageWorkingHours = totalCalculatedHours / daysWithSessions;
          metrics.completedDays = daysWithSessions;
          console.log(`Calculated working hours for user ${user.fullName}: ${totalCalculatedHours.toFixed(2)}h total, ${(totalCalculatedHours / daysWithSessions).toFixed(2)}h average`);
        }
      }
      
      // Get recent logs for this user
      const recentLogs = (logsByUserId.get(String(user._id)) || []).slice(0, 5);

      return {
        employee: {
          id: user._id,
          _id: user._id, // Include both id and _id for compatibility
          name: user.fullName,
          email: user.email,
          department: user.department,
          designation: user.designation,
          role: user.role // Include role for frontend filtering (Intern vs Employee)
        },
        metrics,
        recentLogs
      };
    }));

    // Calculate overall statistics
    const overallStats = {
      totalEmployees: employeeAnalytics.length,
      totalOnTimeDays: employeeAnalytics.reduce((sum, emp) => sum + emp.metrics.onTimeDays, 0),
      totalLateDays: employeeAnalytics.reduce((sum, emp) => sum + emp.metrics.lateDays, 0),
      totalHalfDays: employeeAnalytics.reduce((sum, emp) => sum + emp.metrics.halfDays, 0),
      totalAbsentDays: employeeAnalytics.reduce((sum, emp) => sum + emp.metrics.absentDays, 0),
      averageWorkingHours: employeeAnalytics.length > 0 
        ? employeeAnalytics.reduce((sum, emp) => sum + emp.metrics.averageWorkingHours, 0) / employeeAnalytics.length 
        : 0
    };

    res.json({
      period: { start, end },
      filters: { department, employeeId },
      overallStats,
      employees: employeeAnalytics
    });

  } catch (error) {
    console.error('Error fetching all analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/analytics - Create/update analytics entry (Admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { userId, attendanceDate, isLate, isHalfDay, lateMinutes, attendanceStatus, notes } = req.body;

    if (!userId || !attendanceDate) {
      return res.status(400).json({ error: 'User ID and attendance date are required' });
    }

    // Find or create attendance log
    let attendanceLog = await AttendanceLog.findOne({ user: userId, attendanceDate });
    
    if (!attendanceLog) {
      const user = await User.findById(userId).populate('shiftGroup');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      attendanceLog = await AttendanceLog.create({
        user: userId,
        attendanceDate,
        clockInTime: getISTNow(),
        shiftDurationMinutes: user.shiftGroup?.durationHours * 60 || 480,
        penaltyMinutes: 0,
        paidBreakMinutesTaken: 0,
        unpaidBreakMinutesTaken: 0,
        isLate: isLate || false,
        isHalfDay: isHalfDay || false,
        lateMinutes: lateMinutes || 0,
        attendanceStatus: attendanceStatus || 'On-time',
        notes: notes || ''
      });
    } else {
      // Update existing log
      const updateData = {};
      if (isLate !== undefined) updateData.isLate = isLate;
      if (isHalfDay !== undefined) updateData.isHalfDay = isHalfDay;
      if (lateMinutes !== undefined) updateData.lateMinutes = lateMinutes;
      if (attendanceStatus) updateData.attendanceStatus = attendanceStatus;
      if (notes !== undefined) updateData.notes = notes;

      // Recalculate total working hours if clock-in/out times exist
      if (attendanceLog.clockInTime && attendanceLog.clockOutTime) {
        const workingMinutes = (new Date(attendanceLog.clockOutTime) - new Date(attendanceLog.clockInTime)) / (1000 * 60);
        const totalBreakMinutes = (attendanceLog.paidBreakMinutesTaken || 0) + (attendanceLog.unpaidBreakMinutesTaken || 0);
        const netWorkingMinutes = Math.max(0, workingMinutes - totalBreakMinutes);
        updateData.totalWorkingHours = netWorkingMinutes / 60;
      }

      attendanceLog = await AttendanceLog.findByIdAndUpdate(
        attendanceLog._id,
        updateData,
        { new: true }
      );
    }

    // Emit Socket.IO event to notify all clients about the attendance log update
    try {
      const { getIO } = require('../socketManager');
      const io = getIO();
      if (io) {
        io.emit('attendance_log_updated', {
          logId: attendanceLog._id,
          userId: attendanceLog.user,
          attendanceDate: attendanceLog.attendanceDate,
          attendanceStatus: attendanceLog.attendanceStatus,
          isHalfDay: attendanceLog.isHalfDay,
          isLate: attendanceLog.isLate,
          totalWorkingHours: attendanceLog.totalWorkingHours,
          clockInTime: attendanceLog.clockInTime,
          clockOutTime: attendanceLog.clockOutTime,
          updatedBy: req.user.userId,
          timestamp: getISTNow().toISOString(),
          message: `Analytics entry updated - Working hours: ${attendanceLog.totalWorkingHours.toFixed(2)}h`
        });
        console.log(`📡 Emitted attendance_log_updated event for analytics update ${attendanceLog._id}`);
      }
    } catch (socketError) {
      console.error('Failed to emit Socket.IO event:', socketError);
    }

    res.status(201).json({ message: 'Analytics entry updated successfully', attendanceLog });

  } catch (error) {
    console.error('Error creating/updating analytics entry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/monthly-context-settings - Get monthly context settings
router.get('/monthly-context-settings', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const setting = await Setting.findOne({ key: 'monthlyContextDays' });
    const days = setting ? setting.value : 30; // Default to 30 days

    res.json({ days });
  } catch (error) {
    console.error('Error fetching monthly context settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/late-grace-settings - Get late grace minutes setting
router.get('/late-grace-settings', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const setting = await Setting.findOne({ key: 'lateGraceMinutes' });
    // FIX: Explicitly convert to integer to ensure type consistency
    const minutes = setting ? parseInt(Number(setting.value), 10) : 30; // default 30
    if (isNaN(minutes)) {
      console.warn('[Grace Period] Invalid value in database, using default 30');
      return res.json({ minutes: 30 });
    }
    console.log(`[Grace Period] Retrieved: ${minutes} minutes (type: ${typeof minutes})`);
    res.json({ minutes });
  } catch (error) {
    console.error('Error fetching late grace settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/analytics/late-grace-settings - Update late grace minutes setting
router.put('/late-grace-settings', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { minutes } = req.body;
    // FIX: Explicitly convert to number and ensure it's an integer
    const numeric = parseInt(Number(minutes), 10);
    if (isNaN(numeric) || numeric < 0 || numeric > 1440) {
      return res.status(400).json({ error: 'Minutes must be a valid number between 0 and 1440' });
    }

    // FIX: Explicitly store as number to prevent type issues
    const setting = await Setting.findOneAndUpdate(
      { key: 'lateGraceMinutes' },
      { value: numeric }, // Store as number
      { upsert: true, new: true }
    );

    // PERFORMANCE OPTIMIZATION: Invalidate grace period cache
    invalidateGracePeriod();

    // FIX: Ensure response value is always a number
    const responseValue = Number(setting.value);
    console.log(`[Grace Period] Updated to ${responseValue} minutes (type: ${typeof responseValue})`);
    res.json({ minutes: responseValue });
  } catch (error) {
    console.error('Error updating late grace settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/analytics/monthly-context-settings - Update monthly context settings
router.put('/monthly-context-settings', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { days } = req.body;

    if (!days || typeof days !== 'number' || days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be a number between 1 and 365' });
    }

    // Update or create the setting
    const setting = await Setting.findOneAndUpdate(
      { key: 'monthlyContextDays' },
      { value: days },
      { upsert: true, new: true }
    );

    res.json({ days: setting.value });
  } catch (error) {
    console.error('Error updating monthly context settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/analytics/:id - Update analytics record with admin override
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { 
      isLate, 
      isHalfDay, 
      lateMinutes, 
      attendanceStatus, 
      notes, 
      adminOverride, 
      overrideReason 
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid analytics record ID' });
    }

    const updateData = {};
    if (isLate !== undefined) updateData.isLate = isLate;
    if (isHalfDay !== undefined) updateData.isHalfDay = isHalfDay;
    if (lateMinutes !== undefined) updateData.lateMinutes = lateMinutes;
    if (attendanceStatus) updateData.attendanceStatus = attendanceStatus;
    if (notes !== undefined) updateData.notes = notes;
    if (adminOverride) updateData.adminOverride = adminOverride;
    if (overrideReason !== undefined) updateData.overrideReason = overrideReason;

    // Handle admin overrides
    if (adminOverride === 'Override Half Day') {
      updateData.isHalfDay = false;
      updateData.attendanceStatus = isLate ? 'Late' : 'On-time';
    } else if (adminOverride === 'Override Late') {
      updateData.isLate = false;
      updateData.lateMinutes = 0;
      updateData.attendanceStatus = 'On-time';
    }

    // Get the current log to check for working hours recalculation
    const currentLog = await AttendanceLog.findById(id);
    if (!currentLog) {
      return res.status(404).json({ error: 'Analytics record not found' });
    }

    // Recalculate total working hours if clock-in/out times exist
    if (currentLog.clockInTime && currentLog.clockOutTime) {
      const workingMinutes = (new Date(currentLog.clockOutTime) - new Date(currentLog.clockInTime)) / (1000 * 60);
      const totalBreakMinutes = (currentLog.paidBreakMinutesTaken || 0) + (currentLog.unpaidBreakMinutesTaken || 0);
      const netWorkingMinutes = Math.max(0, workingMinutes - totalBreakMinutes);
      updateData.totalWorkingHours = netWorkingMinutes / 60;
    }

    const attendanceLog = await AttendanceLog.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('user', 'fullName email');

    // Emit Socket.IO event to notify all clients about the attendance log update
    try {
      const { getIO } = require('../socketManager');
      const io = getIO();
      if (io) {
        io.emit('attendance_log_updated', {
          logId: attendanceLog._id,
          userId: attendanceLog.user,
          attendanceDate: attendanceLog.attendanceDate,
          attendanceStatus: attendanceLog.attendanceStatus,
          isHalfDay: attendanceLog.isHalfDay,
          isLate: attendanceLog.isLate,
          totalWorkingHours: attendanceLog.totalWorkingHours,
          clockInTime: attendanceLog.clockInTime,
          clockOutTime: attendanceLog.clockOutTime,
          updatedBy: req.user.userId,
          timestamp: getISTNow().toISOString(),
          message: `Analytics record updated - Working hours: ${attendanceLog.totalWorkingHours.toFixed(2)}h`
        });
        console.log(`📡 Emitted attendance_log_updated event for analytics record update ${attendanceLog._id}`);
      }
    } catch (socketError) {
      console.error('Failed to emit Socket.IO event:', socketError);
    }

    res.json({ 
      message: 'Analytics record updated successfully', 
      attendanceLog,
      overrideApplied: adminOverride !== 'None'
    });

  } catch (error) {
    console.error('Error updating analytics record:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/analytics/:id - Delete analytics record
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid analytics record ID' });
    }

    const attendanceLog = await AttendanceLog.findByIdAndDelete(id);

    if (!attendanceLog) {
      return res.status(404).json({ error: 'Analytics record not found' });
    }

    res.json({ message: 'Analytics record deleted successfully' });

  } catch (error) {
    console.error('Error deleting analytics record:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/export - Export analytics to Excel/CSV
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    const { startDate, endDate, format = 'csv' } = req.query;

    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Default to current month if no dates provided
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    
    const start = startDate || defaultStartDate;
    const end = endDate || defaultEndDate;

    // Get all attendance logs in the date range
    const logs = await AttendanceLog.find({
      attendanceDate: { $gte: start, $lte: end }
    }).populate('user', 'fullName email department designation');

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Date,Employee Name,Email,Department,Designation,Login Time,Status,Late Minutes,Working Hours,Notes\n';
      const csvRows = logs.map(log => {
        const loginTime = log.clockInTime ? new Date(log.clockInTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' }) : '';
        return `${log.attendanceDate},"${log.user.fullName}","${log.user.email}","${log.user.department || ''}","${log.user.designation || ''}","${loginTime}","${log.attendanceStatus}",${log.lateMinutes || 0},${log.totalWorkingHours || 0},"${log.notes || ''}"`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${start}-to-${end}.csv"`);
      res.send(csvHeader + csvRows);
    } else {
      // Return JSON for Excel generation
      res.json({
        period: { start, end },
        data: logs.map(log => ({
          date: log.attendanceDate,
          employeeName: log.user.fullName,
          email: log.user.email,
          department: log.user.department || '',
          designation: log.user.designation || '',
          loginTime: log.clockInTime ? new Date(log.clockInTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' }) : '',
          status: log.attendanceStatus,
          lateMinutes: log.lateMinutes || 0,
          workingHours: log.totalWorkingHours || 0,
          notes: log.notes || ''
        }))
      });
    }

  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/employee-features - Get employee features settings
router.get('/employee-features', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // For now, return default features. In production, this would come from a database
    const defaultFeatures = [
      { id: 1, name: 'Attendance Tracking', description: 'Track daily attendance', enabled: true },
      { id: 2, name: 'Leave Management', description: 'Manage leave requests', enabled: true },
      { id: 3, name: 'Performance Analytics', description: 'View performance metrics', enabled: true },
      { id: 4, name: 'Time Tracking', description: 'Track working hours', enabled: false }
    ];

    res.json(defaultFeatures);

  } catch (error) {
    console.error('Error fetching employee features:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/analytics/employee-features - Add new employee feature
router.post('/employee-features', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, description, enabled } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }

    // For now, generate a simple ID. In production, this would be saved to database
    const newFeature = {
      id: Date.now(), // Simple ID generation
      name,
      description,
      enabled: enabled !== undefined ? enabled : true
    };

    res.status(201).json(newFeature);

  } catch (error) {
    console.error('Error adding employee feature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/analytics/employee-features/:id - Update employee feature
router.put('/employee-features/:id', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { name, description, enabled } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Feature ID is required' });
    }

    // For now, just return success. In production, this would update the database
    const updatedFeature = {
      id: parseInt(id),
      name: name || 'Updated Feature',
      description: description || 'Updated description',
      enabled: enabled !== undefined ? enabled : true
    };

    res.json(updatedFeature);

  } catch (error) {
    console.error('Error updating employee feature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/analytics/employee-features/:id - Delete employee feature
router.delete('/employee-features/:id', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Feature ID is required' });
    }

    // For now, just return success. In production, this would delete from database
    res.json({ message: 'Feature deleted successfully', id: parseInt(id) });

  } catch (error) {
    console.error('Error deleting employee feature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/probation-tracker - Get probation tracker data for all employees on probation
// AUTHORITATIVE PROBATION CALCULATION - SINGLE SOURCE OF TRUTH
// COMPANY POLICY: Probation is 6 calendar months from joining date, extended by approved leaves AND absences.
// Full-day leave/absent = +1 day, Half-day leave/absent = +0.5 day
// Weekends and holidays do NOT affect probation except when employee is absent on those days.
router.get('/probation-tracker', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all employees with status "Probation" and exclude Interns, Permanent, and inactive
    const probationEmployees = await User.find({
      employmentStatus: 'Probation',
      isActive: true,
      role: { $ne: 'Intern' } // Explicitly exclude Interns
    }).select('_id fullName employeeCode joiningDate email department designation alternateSaturdayPolicy').lean();

    /**
     * ⚠️ DEPRECATED:
     * Probation calculation must NOT directly read AttendanceLog,
     * LeaveRequest, or Holiday collections.
     * Data must come from Attendance Summary & Leave Summary endpoints only.
     */

    const todayIST = getISTNow();
    const todayStr = getISTDateString(todayIST);

    const employeeIds = probationEmployees.map(e => e._id.toString());
    const startDateByEmployeeId = {};
    let globalStartDate = todayStr;

    probationEmployees.forEach(employee => {
      const joiningDate = new Date(employee.joiningDate);
      const joiningDateIST = new Date(joiningDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const probationStartDate = new Date(
        joiningDateIST.getFullYear(),
        joiningDateIST.getMonth(),
        joiningDateIST.getDate(),
        0, 0, 0, 0
      );
      const probationStartDateStr = `${probationStartDate.getFullYear()}-${String(probationStartDate.getMonth() + 1).padStart(2, '0')}-${String(probationStartDate.getDate()).padStart(2, '0')}`;
      startDateByEmployeeId[employee._id.toString()] = probationStartDateStr;
      if (probationStartDateStr < globalStartDate) {
        globalStartDate = probationStartDateStr;
      }
    });

    const [attendanceSummaries, leaveSummaries] = await Promise.all([
      getAttendanceSummaryForEmployees({
        employeeIds,
        startDate: globalStartDate,
        endDate: todayStr,
        startDateByEmployeeId
      }),
      getLeaveSummaryForEmployees({
        employeeIds,
        startDate: globalStartDate,
        endDate: todayStr
      })
    ]);

    // Process each employee
    const employeesWithAnalytics = await Promise.all(
      probationEmployees.map(async (employee) => {
        try {
          const probationStartDateStr = startDateByEmployeeId[employee._id.toString()];

          // STEP 2: Base Probation End Date = Joining Date + 6 calendar months (month-aware)
          const probationStartDate = parseISTDate(probationStartDateStr);
          const baseProbationEndDate = new Date(probationStartDate);
          baseProbationEndDate.setMonth(baseProbationEndDate.getMonth() + 6);
          const baseProbationEndDateStr = `${baseProbationEndDate.getFullYear()}-${String(baseProbationEndDate.getMonth() + 1).padStart(2, '0')}-${String(baseProbationEndDate.getDate()).padStart(2, '0')}`;

          const attendanceSummary = attendanceSummaries.get(employee._id.toString());
          const leaveSummary = leaveSummaries.get(employee._id.toString());

          if (!attendanceSummary || !leaveSummary) {
            console.error('[PROBATION] Missing summary data', {
              employeeId: employee._id.toString(),
              hasAttendanceSummary: !!attendanceSummary,
              hasLeaveSummary: !!leaveSummary
            });
          }

          const attendance = attendanceSummary || { fullDayAbsentCount: 0, halfDayAbsentCount: 0 };
          const leave = leaveSummary || { fullDayLeaveCount: 0, halfDayLeaveCount: 0 };

          const fullDayLeaves = leave.fullDayLeaveCount || 0;
          const halfDayLeaves = leave.halfDayLeaveCount || 0;
          const leaveExtensionDays = fullDayLeaves + (halfDayLeaves * 0.5);

          const fullDayAbsents = attendance.fullDayAbsentCount || 0;
          const halfDayAbsents = attendance.halfDayAbsentCount || 0;
          const absentExtensionDays = fullDayAbsents + (halfDayAbsents * 0.5);

          console.log(
            `[PROBATION] employee=${employee.employeeCode || employee._id.toString()} range=${probationStartDateStr}..${todayStr} absent=${absentExtensionDays} (full=${fullDayAbsents}, half=${halfDayAbsents})`
          );

          // STEP 5: Final Probation End Date = Base End Date + Leave Extension Days + Absent Extension Days
          const finalProbationEndDate = new Date(baseProbationEndDate);
          const totalExtensionDays = leaveExtensionDays + absentExtensionDays;
          finalProbationEndDate.setDate(finalProbationEndDate.getDate() + Math.ceil(totalExtensionDays));
          const finalProbationEndDateStr = `${finalProbationEndDate.getFullYear()}-${String(finalProbationEndDate.getMonth() + 1).padStart(2, '0')}-${String(finalProbationEndDate.getDate()).padStart(2, '0')}`;

          // STEP 6: Calculate Days Left (calendar days from today to final end date)
          const today = new Date(
            todayIST.getFullYear(),
            todayIST.getMonth(),
            todayIST.getDate(),
            0, 0, 0, 0
          );
          const endDate = new Date(finalProbationEndDateStr + 'T00:00:00+05:30');
          const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          // Ensure daysLeft is never undefined, NaN, or negative zero
          const safeDaysLeft = isNaN(daysLeft) || daysLeft === -0 ? 0 : daysLeft;

          return {
            employeeId: employee._id.toString(),
            employeeName: employee.fullName,
            employeeCode: employee.employeeCode,
            joiningDate: probationStartDateStr,
            probationStartDate: probationStartDateStr,
            baseProbationEndDate: baseProbationEndDateStr,
            fullDayLeaves: fullDayLeaves || 0,
            halfDayLeaves: halfDayLeaves || 0,
            leaveExtensionDays: leaveExtensionDays || 0,
            fullDayAbsents: fullDayAbsents || 0,
            halfDayAbsents: halfDayAbsents || 0,
            absentExtensionDays: absentExtensionDays || 0,
            finalProbationEndDate: finalProbationEndDateStr,
            daysLeft: safeDaysLeft
          };
        } catch (error) {
          console.error(`Error calculating probation analytics for ${employee.fullName}:`, error);
          const probationStartDateStr = startDateByEmployeeId[employee._id.toString()] || null;
          return {
            employeeId: employee._id.toString(),
            employeeName: employee.fullName,
            employeeCode: employee.employeeCode,
            joiningDate: probationStartDateStr,
            probationStartDate: probationStartDateStr,
            baseProbationEndDate: null,
            fullDayLeaves: 0,
            halfDayLeaves: 0,
            leaveExtensionDays: 0,
            fullDayAbsents: 0,
            halfDayAbsents: 0,
            absentExtensionDays: 0,
            finalProbationEndDate: null,
            daysLeft: 0,
            error: 'Failed to calculate analytics'
          };
        }
      })
    );

    res.json({
      employees: employeesWithAnalytics
    });

  } catch (error) {
    console.error('Error fetching probation tracker data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

module.exports = router;