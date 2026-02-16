// frontend/src/utils/analyticsMapper.js
// Mapping layer to transform Admin API responses to Analytics format
// NO BUSINESS LOGIC - Only shape transformation

/**
 * Map Admin attendance data to Analytics metrics format
 * @param {Object} adminData - Response from /api/admin/attendance/employee/:userId
 * @returns {Object} Analytics-compatible metrics and logs
 */
export function mapAdminAttendanceToAnalytics(adminData) {
  // Defensive: Handle null/undefined input
  if (!adminData || !Array.isArray(adminData.attendanceLogs)) {
    return {
      metrics: {
        totalDays: 0,
        onTimeDays: 0,
        lateDays: 0,
        absentDays: 0,
        leaveDays: 0,
        totalWorkingHours: 0,
        averageWorkingHours: 0,
        lateMinutes: 0,
        averageLateMinutes: 0,
        completedDays: 0,
        incompleteDays: 0
      },
      logs: [],
      gracePeriodMinutes: 30
    };
  }

  const logs = adminData.attendanceLogs;
  const metrics = {
    totalDays: 0,
    onTimeDays: 0,
    lateDays: 0,
    absentDays: 0,
    leaveDays: 0,
    totalWorkingHours: 0,
    averageWorkingHours: 0,
    lateMinutes: 0,
    averageLateMinutes: 0,
    completedDays: 0,
    incompleteDays: 0
  };

  // Process each attendance log
  logs.forEach(log => {
    // Count total days (only working days should be in the response)
    metrics.totalDays++;

    // Categorize by attendance status (single source of truth)
    const status = log.attendanceStatus || 'Absent';
    
    switch (status) {
      case 'On-time':
        metrics.onTimeDays++;
        break;
      case 'Late':
        metrics.lateDays++;
        metrics.lateMinutes += log.lateMinutes || 0;
        break;
      case 'Absent':
        metrics.absentDays++;
        break;
      case 'Leave':
        metrics.leaveDays++;
        break;
      // ❌ NO HALF-DAY CASE - Feature permanently closed
      default:
        // Unknown status - treat as absent
        metrics.absentDays++;
    }

    // Accumulate working hours (only for completed days with clock-out)
    if (log.clockOutTime && log.totalWorkingHours) {
      metrics.totalWorkingHours += log.totalWorkingHours;
      metrics.completedDays++;
    } else if (log.clockInTime && !log.clockOutTime) {
      metrics.incompleteDays++;
    }
  });

  // Calculate averages with division-by-zero guards
  metrics.averageWorkingHours = metrics.completedDays > 0
    ? metrics.totalWorkingHours / metrics.completedDays
    : 0;

  metrics.averageLateMinutes = metrics.lateDays > 0
    ? metrics.lateMinutes / metrics.lateDays
    : 0;

  return {
    metrics,
    logs: logs.map(log => ({
      _id: log._id,
      attendanceDate: log.attendanceDate,
      attendanceStatus: log.attendanceStatus || 'Absent',
      clockInTime: log.clockInTime || null,
      clockOutTime: log.clockOutTime || null,
      totalWorkingHours: log.totalWorkingHours || 0,
      lateMinutes: log.lateMinutes || 0,
      isLate: log.isLate || false,
      breaks: log.breaks || [],
      sessions: log.sessions || [],
      notes: log.notes || ''
    })),
    gracePeriodMinutes: adminData.gracePeriodMinutes || 30
  };
}

/**
 * Map Admin leave data to Analytics format
 * @param {Object} adminLeaveData - Response from /api/admin/leaves
 * @returns {Object} Analytics-compatible leave data
 */
export function mapAdminLeavesToAnalytics(adminLeaveData) {
  // Defensive: Handle null/undefined input
  if (!adminLeaveData || !Array.isArray(adminLeaveData.requests)) {
    return {
      leaveRequests: 0,
      totalLeaveDays: 0,
      items: []
    };
  }

  const requests = adminLeaveData.requests;
  let totalLeaveDays = 0;

  // Calculate total leave days from all requests
  requests.forEach(request => {
    if (Array.isArray(request.leaveDates)) {
      totalLeaveDays += request.leaveDates.length;
    }
  });

  return {
    leaveRequests: requests.length,
    totalLeaveDays,
    items: requests.map(request => ({
      id: request._id,
      status: request.status || 'Pending',
      type: request.requestType || 'Leave',
      leaveType: request.leaveType || 'Full Day',
      dates: request.leaveDates || [],
      reason: request.reason || '',
      appliedDate: request.createdAt || null,
      approvedDate: request.approvedAt || null
    }))
  };
}

/**
 * Map Admin employees by type to Analytics overview format
 * @param {Object} presentData - Response from /api/admin/employees/present
 * @param {Object} lateData - Response from /api/admin/employees/late
 * @param {Object} leaveData - Response from /api/admin/employees/on-leave
 * @param {Object} totalData - Response from /api/admin/employees/total
 * @returns {Object} Analytics-compatible overview data
 */
export function mapAdminEmployeesToOverview(presentData, lateData, leaveData, totalData) {
  // Defensive: Handle null/undefined inputs
  const present = presentData?.items ?? [];
  const late = lateData?.items ?? [];
  const onLeave = leaveData?.items ?? [];
  const total = totalData?.total ?? 0;

  // Calculate counts
  const presentCount = present.length;
  const lateCount = late.length;
  const leaveCount = onLeave.length;
  const absentCount = Math.max(0, total - presentCount - lateCount - leaveCount);

  return {
    overview: {
      totalEmployees: total,
      presentEmployees: presentCount,
      lateEmployees: lateCount,
      absentEmployees: absentCount,
      onLeaveEmployees: leaveCount
    },
    details: {
      presentEmployees: present.map(emp => ({
        id: emp._id,
        name: emp.fullName || 'Unknown',
        email: emp.email || '',
        department: emp.department || 'N/A',
        employeeCode: emp.employeeCode || '',
        status: 'On-time',
        loginTime: emp.clockInTime || null,
        lateMinutes: 0
      })),
      lateEmployees: late.map(emp => ({
        id: emp._id,
        name: emp.fullName || 'Unknown',
        email: emp.email || '',
        department: emp.department || 'N/A',
        employeeCode: emp.employeeCode || '',
        status: 'Late',
        loginTime: emp.clockInTime || null,
        lateMinutes: emp.lateMinutes || 0
      })),
      onLeaveEmployees: onLeave.map(emp => ({
        id: emp._id,
        name: emp.fullName || 'Unknown',
        email: emp.email || '',
        department: emp.department || 'N/A',
        employeeCode: emp.employeeCode || '',
        status: 'On Leave',
        leaveType: emp.leaveType || 'Leave',
        leaveReason: emp.leaveReason || ''
      })),
      absentEmployees: [] // Calculated, not fetched
    },
    date: new Date().toISOString().split('T')[0]
  };
}

/**
 * Map Admin attendance logs to chart-safe format
 * @param {Array} logs - Attendance logs from Admin API
 * @returns {Array} Chart-compatible data points
 */
export function mapAttendanceLogsToChartData(logs) {
  // Defensive: Handle null/undefined input
  if (!Array.isArray(logs)) {
    return [];
  }

  return logs.map(log => {
    const status = log.attendanceStatus || 'Absent';
    
    return {
      date: log.attendanceDate || 'Unknown',
      displayDate: log.attendanceDate 
        ? new Date(log.attendanceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Unknown',
      // Binary flags for chart lines (0 or 1)
      present: status === 'On-time' ? 1 : 0,
      late: status === 'Late' ? 1 : 0,
      absent: status === 'Absent' ? 1 : 0,
      leave: status === 'Leave' ? 1 : 0,
      // ❌ NO halfDay - Feature permanently closed
      // Additional data for tooltips
      clockIn: log.clockInTime || null,
      clockOut: log.clockOutTime || null,
      workHours: Number(log.totalWorkingHours) || 0,
      breakCount: Array.isArray(log.breaks) ? log.breaks.length : 0,
      status: status
    };
  });
}

/**
 * Aggregate attendance data by month for monthly overview charts
 * @param {Array} logs - Attendance logs from Admin API
 * @returns {Array} Monthly aggregated data
 */
export function aggregateAttendanceByMonth(logs) {
  // Defensive: Handle null/undefined input
  if (!Array.isArray(logs)) {
    return [];
  }

  const monthlyData = {};

  logs.forEach(log => {
    if (!log.attendanceDate) return;

    const date = new Date(log.attendanceDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthLabel,
        monthKey,
        onTime: 0,
        late: 0,
        absent: 0,
        leave: 0
        // ❌ NO halfDay
      };
    }

    const status = log.attendanceStatus || 'Absent';
    switch (status) {
      case 'On-time':
        monthlyData[monthKey].onTime++;
        break;
      case 'Late':
        monthlyData[monthKey].late++;
        break;
      case 'Absent':
        monthlyData[monthKey].absent++;
        break;
      case 'Leave':
        monthlyData[monthKey].leave++;
        break;
    }
  });

  // Convert to array and sort by month
  return Object.values(monthlyData).sort((a, b) => 
    a.monthKey.localeCompare(b.monthKey)
  );
}

/**
 * Calculate percentage with division-by-zero guard
 * @param {number} part - Numerator
 * @param {number} total - Denominator
 * @param {number} decimals - Decimal places (default: 1)
 * @returns {number} Percentage (0 if total is 0)
 */
export function safePercentage(part, total, decimals = 1) {
  if (!total || total === 0) return 0;
  const percentage = (part / total) * 100;
  return Number(percentage.toFixed(decimals));
}

/**
 * Ensure value is a valid number for charts
 * @param {any} value - Value to validate
 * @param {number} fallback - Fallback value (default: 0)
 * @returns {number} Valid number
 */
export function chartSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

/**
 * Ensure array is valid for charts
 * @param {any} value - Value to validate
 * @returns {Array} Valid array
 */
export function chartSafeArray(value) {
  return Array.isArray(value) ? value : [];
}
