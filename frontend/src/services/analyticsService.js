// frontend/src/services/analyticsService.js
// Analytics service that uses AUTHORITATIVE ADMIN APIs ONLY
// NO custom analytics endpoints - all data from Admin routes

import axios from '../api/axios';
import {
  mapAdminAttendanceToAnalytics,
  mapAdminLeavesToAnalytics,
  mapAdminEmployeesToOverview,
  mapAttendanceLogsToChartData,
  aggregateAttendanceByMonth
} from '../utils/analyticsMapper';

/**
 * Fetch attendance analytics for a specific employee
 * Uses: GET /api/admin/attendance/employee/:userId (Admin API)
 * @param {string} employeeId - Employee ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Analytics data with metrics and logs
 */
export async function fetchEmployeeAttendanceAnalytics(employeeId, startDate, endDate) {
  try {
    // Use Admin attendance API (authoritative source)
    const response = await axios.get(`/admin/attendance/employee/${employeeId}`, {
      params: { startDate, endDate }
    });

    // Transform Admin response to Analytics format
    return mapAdminAttendanceToAnalytics(response.data);
  } catch (error) {
    console.error('Error fetching employee attendance analytics:', error);
    throw error;
  }
}

/**
 * Fetch attendance analytics for all employees
 * Uses: GET /api/admin/attendance/employee/:userId for each employee (Admin API)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} department - Optional department filter
 * @returns {Promise<Object>} Analytics data for all employees
 */
export async function fetchAllEmployeesAttendanceAnalytics(startDate, endDate, department = null) {
  try {
    // First, get all employees
    const employeesResponse = await axios.get('/admin/employees', {
      params: { all: true }
    });

    const employees = Array.isArray(employeesResponse.data) 
      ? employeesResponse.data 
      : [];

    // Filter by department if specified
    const filteredEmployees = department
      ? employees.filter(emp => emp.department === department)
      : employees;

    // Fetch attendance data for each employee in parallel
    const attendancePromises = filteredEmployees.map(async (employee) => {
      try {
        const attendanceData = await fetchEmployeeAttendanceAnalytics(
          employee._id,
          startDate,
          endDate
        );

        return {
          employee: {
            _id: employee._id,
            name: employee.fullName || employee.name,
            employeeCode: employee.employeeCode,
            department: employee.department,
            email: employee.email
          },
          metrics: attendanceData.metrics,
          logs: attendanceData.logs
        };
      } catch (error) {
        console.error(`Error fetching attendance for employee ${employee._id}:`, error);
        // Return empty metrics on error
        return {
          employee: {
            _id: employee._id,
            name: employee.fullName || employee.name,
            employeeCode: employee.employeeCode,
            department: employee.department,
            email: employee.email
          },
          metrics: {
            totalDays: 0,
            onTimeDays: 0,
            lateDays: 0,
            absentDays: 0,
            leaveDays: 0,
            totalWorkingHours: 0,
            averageWorkingHours: 0
          },
          logs: []
        };
      }
    });

    const employeesWithAttendance = await Promise.all(attendancePromises);

    // Calculate overall stats
    const overallStats = {
      totalEmployees: filteredEmployees.length,
      totalOnTimeDays: employeesWithAttendance.reduce((sum, emp) => sum + (emp.metrics?.onTimeDays || 0), 0),
      totalLateDays: employeesWithAttendance.reduce((sum, emp) => sum + (emp.metrics?.lateDays || 0), 0),
      totalAbsentDays: employeesWithAttendance.reduce((sum, emp) => sum + (emp.metrics?.absentDays || 0), 0),
      totalLeaveDays: employeesWithAttendance.reduce((sum, emp) => sum + (emp.metrics?.leaveDays || 0), 0)
    };

    return {
      employees: employeesWithAttendance,
      overallStats
    };
  } catch (error) {
    console.error('Error fetching all employees attendance analytics:', error);
    throw error;
  }
}

/**
 * Fetch today's overview for dashboard cards
 * Uses: GET /api/admin/employees/:type (Admin API)
 * @returns {Promise<Object>} Today's overview data
 */
export async function fetchTodayOverview() {
  try {
    // Fetch all employee types in parallel
    const [presentRes, lateRes, leaveRes, totalRes] = await Promise.all([
      axios.get('/admin/employees/present'),
      axios.get('/admin/employees/late'),
      axios.get('/admin/employees/on-leave'),
      axios.get('/admin/employees/total', { params: { page: 1, limit: 1 } }) // Just need total count
    ]);

    // Transform to Analytics format
    return mapAdminEmployeesToOverview(
      presentRes.data,
      lateRes.data,
      leaveRes.data,
      totalRes.data
    );
  } catch (error) {
    console.error('Error fetching today overview:', error);
    throw error;
  }
}

/**
 * Fetch monthly overview for charts
 * Uses: GET /api/admin/attendance/employee/:userId (Admin API)
 * @param {number} months - Number of months to fetch (default: 3)
 * @returns {Promise<Array>} Monthly aggregated data
 */
export async function fetchMonthlyOverview(months = 3) {
  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Get all employees
    const employeesResponse = await axios.get('/admin/employees', {
      params: { all: true }
    });

    const employees = Array.isArray(employeesResponse.data) 
      ? employeesResponse.data 
      : [];

    // Fetch attendance for all employees
    const attendancePromises = employees.map(async (employee) => {
      try {
        const response = await axios.get(`/admin/attendance/employee/${employee._id}`, {
          params: {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate)
          }
        });

        return response.data.attendanceLogs || [];
      } catch (error) {
        console.error(`Error fetching attendance for employee ${employee._id}:`, error);
        return [];
      }
    });

    const allAttendanceLogs = await Promise.all(attendancePromises);
    const flattenedLogs = allAttendanceLogs.flat();

    // Aggregate by month
    return aggregateAttendanceByMonth(flattenedLogs);
  } catch (error) {
    console.error('Error fetching monthly overview:', error);
    throw error;
  }
}

/**
 * Fetch leave analytics for an employee
 * Uses: GET /api/admin/leaves (Admin API)
 * @param {string} employeeId - Employee ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Leave analytics data
 */
export async function fetchEmployeeLeaveAnalytics(employeeId, startDate, endDate) {
  try {
    // Use Admin leaves API
    const response = await axios.get('/admin/leaves', {
      params: {
        employeeId,
        startDate,
        endDate,
        page: 1,
        limit: 1000 // Get all leaves for the period
      }
    });

    // Transform to Analytics format
    return mapAdminLeavesToAnalytics(response.data);
  } catch (error) {
    console.error('Error fetching employee leave analytics:', error);
    throw error;
  }
}

/**
 * Fetch attendance chart data for an employee
 * Uses: GET /api/admin/attendance/employee/:userId (Admin API)
 * @param {string} employeeId - Employee ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Chart-compatible data points
 */
export async function fetchEmployeeAttendanceChartData(employeeId, startDate, endDate) {
  try {
    const response = await axios.get(`/admin/attendance/employee/${employeeId}`, {
      params: { startDate, endDate }
    });

    const logs = response.data.attendanceLogs || [];
    return mapAttendanceLogsToChartData(logs);
  } catch (error) {
    console.error('Error fetching employee attendance chart data:', error);
    throw error;
  }
}

/**
 * Export analytics data to Excel/CSV
 * Note: This will need to be refactored to use Admin data
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} format - Export format ('csv' or 'excel')
 * @param {string} employeeId - Optional employee ID filter
 * @param {string} department - Optional department filter
 * @returns {Promise<Blob>} Export file blob
 */
export async function exportAnalyticsData(startDate, endDate, format = 'csv', employeeId = null, department = null) {
  try {
    // TODO: Refactor to use Admin data instead of custom analytics export endpoint
    // For now, keep using existing endpoint but mark for refactor
    const params = {
      startDate,
      endDate,
      format
    };

    if (employeeId) params.employeeId = employeeId;
    if (department) params.department = department;

    const response = await axios.get('/analytics/export', {
      params,
      responseType: 'blob'
    });

    return response.data;
  } catch (error) {
    console.error('Error exporting analytics data:', error);
    throw error;
  }
}

// ✅ Settings endpoints - Keep as-is (not attendance/leave data)
export async function fetchMonthlyContextSettings() {
  const response = await axios.get('/analytics/monthly-context-settings');
  return response.data;
}

export async function updateMonthlyContextSettings(days) {
  const response = await axios.put('/analytics/monthly-context-settings', { days });
  return response.data;
}

export async function fetchLateGraceSettings() {
  const response = await axios.get('/analytics/late-grace-settings');
  return response.data;
}

export async function updateLateGraceSettings(minutes) {
  const response = await axios.put('/analytics/late-grace-settings', { minutes });
  return response.data;
}

export async function fetchEmployeeFeatures() {
  const response = await axios.get('/analytics/employee-features');
  return response.data;
}

export async function addEmployeeFeature(feature) {
  const response = await axios.post('/analytics/employee-features', feature);
  return response.data;
}

export async function updateEmployeeFeature(id, feature) {
  const response = await axios.put(`/analytics/employee-features/${id}`, feature);
  return response.data;
}

export async function deleteEmployeeFeature(id) {
  const response = await axios.delete(`/analytics/employee-features/${id}`);
  return response.data;
}

// ✅ Probation tracker - Keep as-is (authoritative source)
export async function fetchProbationTracker() {
  const response = await axios.get('/analytics/probation-tracker');
  return response.data;
}
