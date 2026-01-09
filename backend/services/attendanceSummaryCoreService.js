// backend/services/attendanceSummaryCoreService.js

const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const Holiday = require('../models/Holiday');
const { parseISTDate } = require('../utils/istTime');
const { resolveAttendanceStatus, generateDateRange } = require('../utils/attendanceStatusResolver');
const { countWorkingDaysInDateRange } = require('../utils/dateUtils');
const { getApprovedLeaveMapBulk } = require('./leaveSummaryCoreService');

const VALID_SATURDAY_POLICIES = ['Week 1 & 3 Off', 'Week 2 & 4 Off', 'All Saturdays Working', 'All Saturdays Off'];

function normalizeSaturdayPolicy(policy) {
  if (!policy || !VALID_SATURDAY_POLICIES.includes(policy)) {
    return 'All Saturdays Working';
  }
  return policy;
}

async function fetchAttendanceInputsBulk({ employeeIds, startDate, endDate, includeHolidays }) {
  const ids = (employeeIds || []).filter(Boolean).map(id => id.toString());

  const shouldIncludeHolidays = includeHolidays === true;

  const [employees, logs, holidays, leaveByUserId] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('_id alternateSaturdayPolicy').lean(),
    AttendanceLog.aggregate([
      {
        $match: {
          user: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) },
          attendanceDate: { $gte: startDate, $lte: endDate }
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
        $lookup: {
          from: 'breaklogs',
          localField: '_id',
          foreignField: 'attendanceLog',
          as: 'breaks'
        }
      },
      {
        $project: {
          _id: 1,
          user: 1,
          attendanceDate: 1,
          attendanceStatus: 1,
          clockInTime: 1,
          clockOutTime: 1,
          notes: 1,
          isLate: 1,
          isHalfDay: 1,
          halfDayReasonCode: 1,
          halfDayReasonText: 1,
          halfDaySource: 1,
          overriddenByAdmin: 1,
          overriddenAt: 1,
          overriddenBy: 1,
          lateMinutes: 1,
          totalWorkingHours: 1,
          paidBreakMinutesTaken: 1,
          unpaidBreakMinutesTaken: 1,
          penaltyMinutes: 1,
          logoutType: 1,
          autoLogoutReason: 1,
          sessions: {
            $map: {
              input: '$sessions',
              as: 's',
              in: {
                startTime: '$$s.startTime',
                endTime: '$$s.endTime'
              }
            }
          },
          breaks: {
            $map: {
              input: '$breaks',
              as: 'b',
              in: {
                startTime: '$$b.startTime',
                endTime: '$$b.endTime',
                durationMinutes: '$$b.durationMinutes',
                breakType: '$$b.breakType'
              }
            }
          }
        }
      },
      { $sort: { attendanceDate: 1 } }
    ]),
    shouldIncludeHolidays
      ? (async () => {
          const startDateIST = parseISTDate(startDate);
          const endDateIST = parseISTDate(endDate);
          return Holiday.find({
            date: {
              $gte: startDateIST,
              $lte: endDateIST
            },
            isTentative: { $ne: true }
          })
            .sort({ date: 1 })
            .lean();
        })()
      : Promise.resolve([]),
    getApprovedLeaveMapBulk({ employeeIds: ids, startDate, endDate })
  ]);

  const employeeById = new Map();
  employees.forEach(e => employeeById.set(e._id.toString(), e));

  const logsByUserId = new Map();
  logs.forEach(log => {
    const uid = log.user?.toString();
    if (!uid) return;
    if (!logsByUserId.has(uid)) logsByUserId.set(uid, new Map());
    logsByUserId.get(uid).set(log.attendanceDate, log);
  });

  return {
    employeeById,
    logsByUserId,
    holidays: holidays || [],
    leaveByUserId
  };
}

function buildResolvedAttendanceLogs({ startDate, endDate, saturdayPolicy, logsMap, holidays, leaveMap }) {
  const dateRange = generateDateRange(startDate, endDate);

  return dateRange.map(attendanceDate => {
    const log = logsMap.get(attendanceDate) || null;
    const leaveRequest = leaveMap.get(attendanceDate) || null;

    const statusInfo = resolveAttendanceStatus({
      attendanceDate,
      attendanceLog: log,
      holidays: holidays || [],
      leaveRequest,
      saturdayPolicy
    });

    const result = {
      attendanceDate,
      attendanceStatus: statusInfo.status,
      isWorkingDay: statusInfo.isWorkingDay,
      isHoliday: statusInfo.isHoliday,
      isWeeklyOff: statusInfo.isWeeklyOff,
      isLeave: statusInfo.isLeave,
      isAbsent: statusInfo.isAbsent,
      isHalfDay: statusInfo.isHalfDay,
      statusReason: statusInfo.statusReason || null,
      halfDayReason: statusInfo.halfDayReason || null,
      halfDayReasonCode: statusInfo.halfDayReasonCode || null,
      halfDaySource: statusInfo.halfDaySource || null,
      overriddenByAdmin: statusInfo.overriddenByAdmin || false,
      leaveReason: statusInfo.leaveReason || null,
      holidayInfo: statusInfo.holidayInfo,
      leaveInfo: statusInfo.leaveInfo,
      _id: log?._id || null,
      clockInTime: log?.clockInTime || null,
      clockOutTime: log?.clockOutTime || null,
      notes: log?.notes || null,
      isLate: log?.isLate || false,
      lateMinutes: log?.lateMinutes || 0,
      penaltyMinutes: log?.penaltyMinutes || 0,
      logoutType: log?.logoutType || null,
      autoLogoutReason: log?.autoLogoutReason || null,
      sessions: log?.sessions || [],
      breaks: Array.isArray(log?.breaks) ? log.breaks : [],
      breaksSummary: {
        paid: log?.paidBreakMinutesTaken || 0,
        unpaid: log?.unpaidBreakMinutesTaken || 0,
        total: (log?.paidBreakMinutesTaken || 0) + (log?.unpaidBreakMinutesTaken || 0)
      },
      firstIn: null,
      lastOut: null,
      totalWorkedMinutes: log?.totalWorkingHours ? Math.round(log.totalWorkingHours * 60) : 0,
      payableMinutes: (() => {
        if (statusInfo.status === 'Holiday' || statusInfo.status === 'Weekly Off') {
          return 0;
        }
        if (statusInfo.status === 'Leave') {
          if (statusInfo.isHalfDay) {
            return 270;
          }
          return 0;
        }
        if (statusInfo.status === 'Half-day' || statusInfo.isHalfDay) {
          return 270;
        }
        if (statusInfo.status === 'Absent') {
          return 0;
        }
        return 540;
      })()
    };

    if (log?.sessions && Array.isArray(log.sessions) && log.sessions.length > 0) {
      const sortedSessions = [...log.sessions].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      if (sortedSessions[0]?.startTime) {
        result.firstIn = sortedSessions[0].startTime;
      }

      const sessionsWithEnd = sortedSessions.filter(s => s.endTime);
      if (sessionsWithEnd.length > 0) {
        const lastSession = sessionsWithEnd[sessionsWithEnd.length - 1];
        result.lastOut = lastSession.endTime;
      }
    }

    return result;
  });
}

async function computeAttendanceSummary({ employeeId, startDate, endDate, includeHolidays = false }) {
  const id = employeeId?.toString();
  const bulk = await computeAttendanceSummaryBulk({ employeeIds: [id], startDate, endDate, includeHolidays });
  return bulk.get(id);
}

async function computeAttendanceSummaryBulk({ employeeIds, startDate, endDate, includeHolidays = false, startDateByEmployeeId = null }) {
  const ids = (employeeIds || []).filter(Boolean).map(id => id.toString());
  const result = new Map();
  if (ids.length === 0) return result;

  const perEmployeeStart = startDateByEmployeeId && typeof startDateByEmployeeId === 'object'
    ? new Map(Object.entries(startDateByEmployeeId).map(([k, v]) => [k.toString(), v]))
    : null;

  const { employeeById, logsByUserId, holidays, leaveByUserId } = await fetchAttendanceInputsBulk({
    employeeIds: ids,
    startDate,
    endDate,
    includeHolidays
  });

  await Promise.all(
    ids.map(async userId => {
      const employee = employeeById.get(userId);
      if (!employee) {
        result.set(userId, { error: 'Employee not found.' });
        return;
      }

      const saturdayPolicy = normalizeSaturdayPolicy(employee?.alternateSaturdayPolicy);
      const logsMap = logsByUserId.get(userId) || new Map();
      const leaveMap = leaveByUserId.get(userId) || new Map();

      const resolvedLogs = buildResolvedAttendanceLogs({
        startDate,
        endDate,
        saturdayPolicy,
        logsMap,
        holidays,
        leaveMap
      });

      const userStartDate = perEmployeeStart?.get(userId) || startDate;
      const resolvedLogsInScope = userStartDate === startDate
        ? resolvedLogs
        : resolvedLogs.filter(l => l.attendanceDate >= userStartDate);

      const workingDaysCount = await countWorkingDaysInDateRange(userStartDate, endDate, saturdayPolicy, holidays || []);

      let totalWorkedMinutes = 0;
      let presentDaysCount = 0;

      resolvedLogsInScope.forEach(log => {
        if (log.isWorkingDay && !log.isAbsent && !log.isLeave) {
          presentDaysCount++;
        }
        if (log.totalWorkedMinutes) {
          totalWorkedMinutes += log.totalWorkedMinutes;
        }
      });

      const STANDARD_WORKDAY_MINUTES = 540;
      const totalPayableMinutes = workingDaysCount * STANDARD_WORKDAY_MINUTES;

      const summary = {
        totalWorkingDays: workingDaysCount,
        presentDays: presentDaysCount,
        totalWorkedMinutes: totalWorkedMinutes,
        totalWorkedHours: totalWorkedMinutes / 60,
        totalPayableMinutes: totalPayableMinutes,
        totalPayableHours: totalPayableMinutes / 60,
        standardWorkdayHours: 9
      };

      const fullDayAbsentCount = resolvedLogsInScope.reduce((sum, l) => sum + (l.isWorkingDay && l.attendanceStatus === 'Absent' ? 1 : 0), 0);
      const halfDayAbsentCount = resolvedLogsInScope.reduce((sum, l) => sum + (l.isWorkingDay && l.attendanceStatus === 'Half-day' ? 1 : 0), 0);

      const payload = {
        logs: resolvedLogs,
        summary,
        fullDayAbsentCount,
        halfDayAbsentCount
      };

      if (includeHolidays) {
        payload.holidays = (holidays || []).map(h => ({
          _id: h._id,
          name: h.name,
          date: h.date,
          isTentative: h.isTentative || false
        }));
      }

      result.set(userId, payload);
    })
  );

  return result;
}

module.exports = {
  computeAttendanceSummary,
  computeAttendanceSummaryBulk
};
