// backend/routes/probation.js
// Probation Tracker API - Independent from Analytics
// REFACTORED: Now uses AttendanceSummaryService as single source of truth

const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const User = require('../models/User');
const AttendanceSummaryService = require('../services/AttendanceSummaryService');
const NodeCache = require('node-cache');

const router = express.Router();

// Short-lived cache: probation data is expensive to compute; cache for 1 minute
const probationCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

// GET /api/probation/tracker - Get probation tracker data for all employees on probation
// COMPANY POLICY: Probation is 6 calendar months from joining date, extended by approved leaves AND absences.
// ACCESS: Admin and HR only
router.get('/tracker', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'Admin' && role !== 'HR') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Return cached result if available (cache key is role-agnostic; both Admin+HR see same data)
    const cacheKey = 'probation_tracker';
    const cached = probationCache.get(cacheKey);
    if (cached) {
      console.log('[Probation] Returning cached tracker data');
      return res.json(cached);
    }

    // Get all employees with status "Probation" and exclude Interns, Permanent, and inactive
    const probationEmployees = await User.find({
      employmentStatus: 'Probation',
      isActive: true,
      role: { $ne: 'Intern' }
    }).select('_id fullName employeeCode joiningDate email department designation').lean();

    // PERFORMANCE FIX: Pre-fetch shared data ONCE for all employees.
    // Previously, holidays and grace period were fetched inside each employee's call to
    // AttendanceSummaryService — causing N separate DB queries for N employees.
    const { getGracePeriodMinutes } = require('../utils/gracePeriod');
    const { parseISTDate } = require('../utils/istTime');
    const Holiday = require('../models/Holiday');

    // Compute the widest possible date range across all employees so one holiday fetch covers all
    const now = new Date();
    const earliestJoining = probationEmployees.reduce((earliest, emp) => {
      const d = new Date(emp.joiningDate);
      return d < earliest ? d : earliest;
    }, now);

    const sharedHolidays = await Holiday.find({
      date: { $gte: earliestJoining, $lte: now },
      isTentative: { $ne: true }
    }).sort({ date: 1 }).lean();

    const sharedGracePeriodMinutes = await getGracePeriodMinutes();

    const sharedData = {
      holidays: sharedHolidays,
      gracePeriodMinutes: sharedGracePeriodMinutes
    };

    // Process each employee
    const employeesWithAnalytics = await Promise.all(
      probationEmployees.map(async (employee) => {
        try {
          // STEP 1: Normalize Dates (IST ONLY)
          const joiningDate = new Date(employee.joiningDate);
          const joiningDateIST = new Date(joiningDate.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
          const probationStartDate = new Date(
            joiningDateIST.getFullYear(),
            joiningDateIST.getMonth(),
            joiningDateIST.getDate(),
            0, 0, 0, 0
          );
          const probationStartDateStr = `${probationStartDate.getFullYear()}-${String(probationStartDate.getMonth() + 1).padStart(2, '0')}-${String(probationStartDate.getDate()).padStart(2, '0')}`;

          // STEP 2: Base Probation End Date = Joining Date + 6 calendar months
          const baseProbationEndDate = new Date(probationStartDate);
          baseProbationEndDate.setMonth(baseProbationEndDate.getMonth() + 6);
          const baseProbationEndDateStr = `${baseProbationEndDate.getFullYear()}-${String(baseProbationEndDate.getMonth() + 1).padStart(2, '0')}-${String(baseProbationEndDate.getDate()).padStart(2, '0')}`;

          // STEP 3: Get Attendance Summary (SINGLE SOURCE OF TRUTH)
          // Pass pre-fetched sharedData to avoid re-querying holidays and grace period for each employee
          const attendanceSummary = await AttendanceSummaryService.getEmployeeAttendanceSummary(
            employee._id,
            probationStartDateStr,
            new Date(), // Today
            sharedData  // ← shared holidays + grace period pre-fetched once above
          );

          // STEP 4: Calculate Extensions Using Resolved Summary Data
          // Apply correct probation rules: count leaves and absences, exclude holidays and weekly offs
          let fullDayLeaves = 0;
          let halfDayLeaves = 0;
          let fullDayAbsences = 0;
          let halfDayAbsences = 0;

          attendanceSummary.forEach(day => {
            // Skip holidays (company policy: holidays don't extend probation)
            if (day.isHoliday) return;
            
            // Skip weekly offs (Saturdays off + Sundays don't extend probation)
            if (day.isWeeklyOff) return;
            
            // Count leaves (approved leaves extend probation)
            if (day.finalStatus === 'Leave') {
              if (day.isHalfDay) {
                halfDayLeaves++;
              } else {
                fullDayLeaves++;
              }
            }
            
            // Count absences (absences extend probation)
            if (day.finalStatus === 'Absent') {
              if (day.isHalfDay) {
                halfDayAbsences++;
              } else {
                fullDayAbsences++;
              }
            }
            
            // Count half-day status (late login, insufficient hours, etc.)
            if (day.finalStatus === 'Half-day') {
              halfDayAbsences++;
            }
          });

          // Calculate extension days (support decimals for accurate tracking)
          const leaveExtensionDays = fullDayLeaves + (halfDayLeaves * 0.5);
          const absentExtensionDays = fullDayAbsences + (halfDayAbsences * 0.5);
          const totalExtensionDays = leaveExtensionDays + absentExtensionDays;

          // STEP 5: Calculate Final Probation End Date
          // Note: Removed Math.ceil() to support decimal extensions properly
          const finalProbationEndDate = new Date(baseProbationEndDate);
          finalProbationEndDate.setDate(finalProbationEndDate.getDate() + totalExtensionDays);
          const finalProbationEndDateStr = `${finalProbationEndDate.getFullYear()}-${String(finalProbationEndDate.getMonth() + 1).padStart(2, '0')}-${String(finalProbationEndDate.getDate()).padStart(2, '0')}`;

          // STEP 6: Calculate Days Left
          const today = new Date();
          const todayIST = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
          const todayMidnight = new Date(
            todayIST.getFullYear(),
            todayIST.getMonth(),
            todayIST.getDate(),
            0, 0, 0, 0
          );
          const daysLeft = Math.ceil((finalProbationEndDate - todayMidnight) / (1000 * 60 * 60 * 24));

          // STEP 7: Return Detailed Transparent Breakdown
          return {
            employeeId: employee._id,
            employeeName: employee.fullName,
            employeeCode: employee.employeeCode,
            email: employee.email,
            department: employee.department,
            designation: employee.designation,
            joiningDate: probationStartDateStr,
            baseProbationEndDate: baseProbationEndDateStr,
            
            // Detailed leave breakdown
            fullDayLeaves,
            halfDayLeaves,
            leaveExtensionDays: Math.round(leaveExtensionDays * 10) / 10, // Round to 1 decimal
            
            // Detailed absence breakdown
            fullDayAbsents: fullDayAbsences,
            halfDayAbsents: halfDayAbsences,
            absentExtensionDays: Math.round(absentExtensionDays * 10) / 10, // Round to 1 decimal
            
            // Total and final dates
            totalExtensionDays: Math.round(totalExtensionDays * 10) / 10, // Round to 1 decimal
            finalProbationEndDate: finalProbationEndDateStr,
            daysLeft
          };
        } catch (error) {
          console.error(`Error processing probation for employee ${employee._id}:`, error);
          return null;
        }
      })
    );

    const validEmployees = employeesWithAnalytics.filter(emp => emp !== null);

    const result = {
      employees: validEmployees,
      totalCount: validEmployees.length
    };

    // Cache result for 2 minutes to avoid rerunning expensive per-employee aggregates
    probationCache.set('probation_tracker', result);

    res.json(result);

  } catch (error) {
    console.error('Error fetching probation tracker data:', error);
    res.status(500).json({ error: 'Failed to fetch probation tracker data' });
  }
});

module.exports = router;
