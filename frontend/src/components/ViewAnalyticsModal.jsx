// frontend/src/components/ViewAnalyticsModal.jsx

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  Snackbar
} from '@mui/material';
import {
  Close,
  TrendingUp,
  AccessTime,
  CheckCircle,
  Person,
  Work,
  CalendarToday,
  Email,
  Business,
  Refresh,
  Timer,
  Schedule,
  EventAvailable,
  HourglassEmpty,
  BeachAccess,
  LocalHospital,
  CardGiftcard,
  SwapHoriz,
  Bookmark,
  DateRange,
  Gavel,
  ToggleOff,
  ToggleOn,
  Edit,
  EventBusy
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';
import { io } from 'socket.io-client';
import { formatDateYYYYMMDD, getTodayIST } from '../utils/dateUtils';
import './ViewAnalyticsModal.css';

const ViewAnalyticsModal = ({ open, onClose, employeeId, employeeName }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [employeeData, setEmployeeData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [viewMode, setViewMode] = useState('week'); // 'week', 'month', or 'custom'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customDateRange, setCustomDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    end: new Date()
  });
  const [counter, setCounter] = useState(0);
  const [tabValue, setTabValue] = useState(0);
  const [attendanceResolutionData, setAttendanceResolutionData] = useState(null);
  const [loadingResolution, setLoadingResolution] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Theme colors - Navy & White with Red accents
  const THEME = {
    primary: '#2C3E50',
    primaryLight: '#34495e',
    primaryDark: '#1a252f',
    accent: '#d32f2f',
    accentLight: '#ef5350',
    white: '#ffffff',
    background: '#f8f9fa',
    text: '#212121',
    textSecondary: '#666666',
    border: '#e0e0e0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3'
  };

  useEffect(() => {
    if (open && employeeId) {
      // Reset all state when opening modal or changing employee
      setTabValue(0);
      setAttendanceResolutionData(null);
      setEmployeeData(null);
      setAnalyticsData(null);
      setError(null);
      setCounter(0);
      
      console.log('Modal opened for employeeId:', employeeId);
      fetchEmployeeData();
    }
  }, [open, employeeId]);

  // Socket.IO connection for real-time updates
  useEffect(() => {
    if (!open || !employeeId) return;

    const token = sessionStorage.getItem('token');
    if (!token) return;

    // Connect to Socket.IO server
    const socketUrl = import.meta.env.DEV 
      ? 'http://localhost:3001' 
      : (import.meta.env.VITE_SOCKET_URL || 'https://attendance.bylinelms.com');
    
    // A2 Hosting: Polling first for better compatibility
    const socket = io(socketUrl, {
      auth: { token },
      path: '/api/socket.io',  // Match backend socket path
      transports: ['polling', 'websocket'], // Polling first (A2 Hosting compatible)
      timeout: 30000, // 30 seconds (A2 Hosting optimized)
      reconnection: true,
      reconnectionAttempts: 10, // More attempts for A2 Hosting
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000, // Increased for A2 Hosting
      upgrade: true,
      rememberUpgrade: false // A2 Hosting compatibility
    });

    // Listen for attendance log updates
    const handleAttendanceLogUpdate = (data) => {
      console.log('📡 ViewAnalyticsModal received attendance_log_updated event:', data);
      
      // Check if the update affects the current employee
      const isRelevantUpdate = (
        data.userId === employeeId || // Update affects current employee
        user.role === 'Admin' ||     // Current user is admin
        user.role === 'HR'           // Current user is HR
      );

      if (isRelevantUpdate) {
        console.log('🔄 Refreshing ViewAnalyticsModal data due to attendance log update');
        
        // Refresh the analytics data
        fetchEmployeeData();
        
        // If we're on the attendance resolution tab, refresh that data too
        if (tabValue === 1) {
          fetchAttendanceResolutionData();
        }
        
        // Show a subtle notification
        setSnackbar({
          open: true,
          message: `Attendance data updated: ${data.message}`,
          severity: 'info'
        });
      }
    };

    // Set up event listeners
    socket.on('connect', () => {
      console.log('🔌 ViewAnalyticsModal connected to Socket.IO server');
    });

    socket.on('disconnect', () => {
      console.log('🔌 ViewAnalyticsModal disconnected from Socket.IO server');
    });

    socket.on('attendance_log_updated', handleAttendanceLogUpdate);

    // Cleanup on unmount or when dependencies change
    return () => {
      socket.off('attendance_log_updated', handleAttendanceLogUpdate);
      socket.disconnect();
    };
  }, [open, employeeId, user, tabValue]);

  // Animated counter effect
  useEffect(() => {
    if (analyticsData && counter < 100) {
      const timer = setTimeout(() => setCounter(counter + 1), 20);
      return () => clearTimeout(timer);
    }
  }, [counter, analyticsData]);

  const fetchEmployeeData = async () => {
    setLoading(true);
    setError(null);
    setCounter(0);
    
    try {
      console.log('=== fetchEmployeeData called ===');
      console.log('Employee ID:', employeeId);
      console.log('Employee Name:', employeeName);
      
      // Format dates properly to avoid timezone issues
      const startYear = selectedYear;
      const startDate = `${startYear}-01-01`;
      const endDate = formatDateYYYYMMDD(getTodayIST());
      
      console.log('Fetching analytics for:', `/analytics/employee/${employeeId}?startDate=${startDate}&endDate=${endDate}`);
      
      // Fetch analytics data (includes basic employee info)
      const analyticsResponse = await axios.get(
        `/analytics/employee/${employeeId}?startDate=${startDate}&endDate=${endDate}`
      );
      
      console.log('Analytics response received:', analyticsResponse.data);
      
      // Fetch all employees to get full employee data
      const employeesResponse = await axios.get('/admin/employees?all=true');
      const employee = employeesResponse.data.find(emp => emp._id === employeeId);
      
      console.log('Looking for employee with ID:', employeeId);
      console.log('Found employee:', employee);
      
      if (!employee) {
        throw new Error('Employee not found');
      }

      setEmployeeData(employee);
      setAnalyticsData(analyticsResponse.data);
      
      console.log('=== State updated ===');
      console.log('Employee data set:', employee.fullName);
      console.log('Analytics data set for:', employee.fullName);
    } catch (error) {
      console.error('Error fetching employee analytics:', error);
      
      // Extract detailed error message
      let errorMessage = 'Failed to fetch employee data';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Log additional details for debugging
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          params: error.config?.params
        }
      });
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchEmployeeData();
    if (tabValue === 1) {
      fetchAttendanceResolutionData();
    }
  };

  const fetchAttendanceResolutionData = async () => {
    if (!employeeId) {
      console.error('No employeeId provided for attendance resolution');
      return;
    }
    
    setLoadingResolution(true);
    try {
      console.log('Fetching attendance data for employee:', employeeId);
      const response = await axios.get(`/admin/attendance/employee/${employeeId}`);
      console.log('Attendance resolution data received:', response.data);
      
      // Debug: Log each attendance record's calculated status
      if (response.data.attendanceLogs) {
        console.log('Grace Period:', response.data.gracePeriodMinutes, 'minutes');
        response.data.attendanceLogs.forEach((log, index) => {
          const gracePeriod = response.data.gracePeriodMinutes || 30;
          const isWithinGrace = log.lateMinutes > 0 && log.lateMinutes <= gracePeriod;
          const hasExceededGrace = log.lateMinutes > gracePeriod;
          
          console.log(`Record ${index} (${log.attendanceDate}):`, {
            calculatedStatus: log.calculatedStatus,
            lateMinutes: log.lateMinutes,
            gracePeriod: gracePeriod,
            isWithinGrace: isWithinGrace,
            hasExceededGrace: hasExceededGrace,
            hasManualOverride: log.hasManualOverride
          });
        });
      }
      
      setAttendanceResolutionData(response.data);
    } catch (error) {
      console.error('Error fetching attendance resolution data:', error);
      console.error('Error details:', error.response?.data);
      setSnackbar({
        open: true,
        message: 'Failed to fetch attendance data',
        severity: 'error'
      });
    } finally {
      setLoadingResolution(false);
    }
  };

  const handleToggleStatus = async (attendanceDate, statusType, currentStatus) => {
    try {
      let newStatus;
      
      console.log('Toggle clicked:', { attendanceDate, statusType, currentStatus });
      
      if (statusType === 'late') {
        // Toggle between On-time and Late (manual override)
        newStatus = currentStatus === 'Late' ? 'On-time' : 'Late';
      } else if (statusType === 'halfday') {
        // Toggle between On-time and Half-day
        newStatus = currentStatus === 'Half-day' ? 'On-time' : 'Half-day';
      }
      
      console.log('Calculated new status:', newStatus);
      console.log('Sending API request with:', { employeeId, attendanceDate, statusType, newStatus });
      
      await axios.patch('/admin/attendance/toggle-status', {
        employeeId,
        attendanceDate,
        statusType,
        newStatus
      });
      
      console.log('API request successful, refreshing data...');
      
      setSnackbar({
        open: true,
        message: `Status updated to "${newStatus}" successfully`,
        severity: 'success'
      });
      
      // Refresh the data
      fetchAttendanceResolutionData();
    } catch (error) {
      console.error('Error toggling attendance status:', error);
      console.error('Error details:', error.response?.data);
      setSnackbar({
        open: true,
        message: 'Failed to update attendance status',
        severity: 'error'
      });
    }
  };

  const handleTabChange = (event, newValue) => {
    console.log('Tab changed to:', newValue, 'employeeId:', employeeId);
    setTabValue(newValue);
    if (newValue === 1) {
      // Always fetch data when switching to attendance resolution tab
      fetchAttendanceResolutionData();
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (!open) return null;

  // Format time to HH:MM in IST
  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    // Convert to IST for display
    const istTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const hours = String(istTime.getHours()).padStart(2, '0');
    const minutes = String(istTime.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Format late minutes to HH:MM format
  const formatLateMinutes = (minutes) => {
    if (!minutes || minutes === 0) return '00:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  // Format duration (hours) to show minutes if less than 1 hour
  const formatDuration = (hours) => {
    if (hours === 0) return '0m';
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    return formatHoursAsHrsDotMM(hours);
  };

  // Format hours as Hrs.mm (e.g., 8.30 for 8h 30m)
  const formatHoursAsHrsDotMM = (hours) => {
    if (!hours || hours <= 0) return '0.00';
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    const mm = String(minutes).padStart(2, '0');
    return `${wholeHours}.${mm}`;
  };

  // Calculate KPIs using backend data
  const calculateKPIs = () => {
    if (!employeeData || !analyticsData) return null;

    const joinDate = new Date(employeeData.joiningDate);
    const today = new Date();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const daysSinceJoining = Math.floor((today - joinDate) / MS_PER_DAY);

    // Legacy system: Use joiningDate and probationDurationMonths
    const probationStart = joinDate;
    const probationDurationMonths = employeeData.probationDurationMonths || 3;
    const probationDays = probationDurationMonths * 30; // Approximate working days
    
    // Use backend-calculated probation progress if available
    let probationRemaining = 0;
    let probationProgress = 0;
    if (analyticsData.probationProgress) {
      probationRemaining = analyticsData.probationProgress.daysRemaining || 0;
      probationProgress = analyticsData.probationProgress.progressPercentage || 0;
    } else {
      // Fallback calculation (approximate)
      probationRemaining = Math.max(0, probationDays - daysSinceJoining);
      probationProgress = probationDays > 0 ? Math.min(100, (daysSinceJoining / probationDays) * 100) : 0;
    }
    
    // Use backend-calculated metrics directly
    const metrics = analyticsData.metrics || {};
    
    // Calculate total leaves from analytics data (prefer YTD if available)
    const totalLeaves =
      metrics.totalLeaveDaysYTD ?? analyticsData.totalLeaveDaysYTD ??
      metrics.totalLeaveDays ?? analyticsData.totalLeaveDays ?? 0;
    
    return {
      // Backend-calculated values
      totalWorkingDays: metrics.totalDays || 0,
      presentDays: metrics.onTimeDays || 0,
      lateDays: metrics.lateDays || 0,
      halfDays: metrics.halfDays || 0,
      absentDays: metrics.absentDays || 0,
      totalWorkingHours: metrics.totalWorkingHours || 0,
      averageWorkingHours: metrics.averageWorkingHours || 0,
      totalLeaves: totalLeaves,
      
      // Calculated values
      daysSinceJoining,
      probationRemaining,
      probationProgress
    };
  };

  const kpis = calculateKPIs();

  // Prepare attendance distribution data for pie chart
  const prepareAttendanceData = () => {
    if (!kpis) return [];
    
    return [
      { name: 'Present', value: kpis.presentDays, color: THEME.success },
      { name: 'Late', value: kpis.lateDays, color: THEME.warning },
      { name: 'Half-day', value: kpis.halfDays, color: THEME.error },
      { name: 'Absent', value: kpis.absentDays, color: THEME.textSecondary }
    ].filter(item => item.value > 0);
  };

  // Helper function to get IST date
  const getISTDate = () => {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  };

  // Helper function to format date consistently (avoid timezone issues)
  const formatDateKey = (date) => {
    // If date is already a string in YYYY-MM-DD format, return as is
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // For Date objects, format directly without timezone conversion
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Prepare daily attendance data for line chart with breaks
  const prepareDailyAttendanceData = () => {
    if (!analyticsData?.logs) return [];

    // Get current date in IST
    const todayIST = getISTDate();

    // Determine date range based on view mode (all in IST)
    let rangeStart;
    let rangeEnd;

    if (viewMode === 'week') {
      rangeEnd = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate());
      rangeStart = new Date(rangeEnd);
      rangeStart.setDate(rangeEnd.getDate() - 6); // last 7 days inclusive
    } else if (viewMode === 'month') {
      rangeEnd = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate());
      rangeStart = new Date(rangeEnd);
      rangeStart.setDate(rangeEnd.getDate() - 29); // last 30 days inclusive
    } else if (viewMode === 'custom' && customDateRange?.start && customDateRange?.end) {
      rangeStart = new Date(customDateRange.start.getFullYear(), customDateRange.start.getMonth(), customDateRange.start.getDate());
      rangeEnd = new Date(customDateRange.end.getFullYear(), customDateRange.end.getMonth(), customDateRange.end.getDate());
    } else {
      // default fallback: last 7 days
      rangeEnd = new Date(todayIST.getFullYear(), todayIST.getMonth(), todayIST.getDate());
      rangeStart = new Date(rangeEnd);
      rangeStart.setDate(rangeEnd.getDate() - 6);
    }

    // Map logs by date (YYYY-MM-DD) - ensure consistent date formatting
    const logByDate = new Map();
    analyticsData.logs.forEach(log => {
      // Use the attendanceDate directly if it's already in YYYY-MM-DD format
      // Otherwise, convert it properly
      const key = formatDateKey(log.attendanceDate);
      logByDate.set(key, log);
    });

    // Build continuous series across the date range
    const series = [];
    for (
      let cursor = new Date(rangeStart.getTime());
      cursor <= rangeEnd;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const key = formatDateKey(cursor);
      const log = logByDate.get(key);

      if (log) {
        // Calculate total break time from breaks array
        let totalBreakMinutes = 0;
        if (log.breaks && Array.isArray(log.breaks)) {
          totalBreakMinutes = log.breaks.reduce((sum, breakItem) => {
            if (breakItem.startTime && breakItem.endTime) {
              const duration = (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60);
              return sum + duration;
            }
            return sum;
          }, 0);
        }

        let workHours = log.totalWorkingHours || 0;
        if (workHours === 0 && log.clockInTime && log.clockOutTime) {
          const clockIn = new Date(log.clockInTime);
          const clockOut = new Date(log.clockOutTime);
          const totalMinutes = (clockOut - clockIn) / (1000 * 60);
          const breakHours = totalBreakMinutes / 60;
          workHours = Math.max(0, (totalMinutes / 60) - breakHours);
        }

        series.push({
          date: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          workHours: parseFloat(workHours.toFixed(2)),
          breakHours: parseFloat((totalBreakMinutes / 60).toFixed(2)),
          clockIn: formatTime(log.clockInTime),
          clockOut: formatTime(log.clockOutTime),
          status: log.attendanceStatus,
          breakCount: log.breaks ? log.breaks.length : 0,
          rawDate: key
        });
      } else {
        // No log for this date: treat as Absent with zero hours
        series.push({
          date: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          workHours: 0,
          breakHours: 0,
          clockIn: '--:--',
          clockOut: '--:--',
          status: 'Absent',
          breakCount: 0,
          rawDate: key
        });
      }
    }

    // Debug logging
    console.log('Date range:', {
      rangeStart: formatDateKey(rangeStart),
      rangeEnd: formatDateKey(rangeEnd),
      todayIST: formatDateKey(todayIST),
      availableLogs: Array.from(logByDate.keys()).sort(),
      rangeStartDay: rangeStart.getDay(), // 0 = Sunday, 1 = Monday, etc.
      rangeEndDay: rangeEnd.getDay(),
      todayISTDay: todayIST.getDay()
    });

    // Additional logging for each day in the series
    console.log('Series data:', series.map(item => ({
      date: item.date,
      rawDate: item.rawDate,
      workHours: item.workHours,
      status: item.status,
      dayOfWeek: new Date(item.rawDate).getDay()
    })));
    
    // Debug: Show the actual log mapping to verify dates are correct
    console.log('Log mapping verification:', Array.from(logByDate.entries()).map(([date, log]) => ({
      date,
      attendanceDate: log.attendanceDate,
      workHours: log.totalWorkingHours,
      status: log.attendanceStatus
    })));

    return series;
  };

  const attendanceData = prepareAttendanceData();
  const dailyAttendanceData = prepareDailyAttendanceData();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        className: 'view-analytics-modal',
        sx: { borderRadius: '16px', maxHeight: '95vh' }
      }}
    >
      {/* Header */}
      <Box className="modal-header">
        <Box display="flex" alignItems="center" gap={2}>
          <Box className="header-icon">
            <Person sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" className="header-title">
              {employeeName || 'Employee'} - Analytics Dashboard
            </Typography>
            <Typography variant="body2" className="header-subtitle">
              Comprehensive attendance and performance insights
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} className="close-button">
          <Close />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0, overflow: 'auto' }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="400px">
            <CircularProgress sx={{ color: THEME.primary }} />
          </Box>
        ) : error ? (
          <Box p={3}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : employeeData && analyticsData && kpis ? (
          <Box className="analytics-content">
            {/* Tabs Navigation */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange}
                sx={{
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 'bold',
                    minHeight: 48
                  },
                  '& .Mui-selected': {
                    color: THEME.primary
                  }
                }}
              >
                <Tab 
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <TrendingUp />
                      Analytics Overview
                    </Box>
                  } 
                />
                <Tab 
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Gavel />
                      Attendance Resolution
                    </Box>
                  } 
                />
              </Tabs>
            </Box>

            {/* Tab Content */}
            {tabValue === 0 && (
              <Box>
            {/* Overview Section - KPI Cards */}
            <Box className="section overview-section">
              <Typography variant="h6" className="section-title">
                <TrendingUp /> Overview Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card className="kpi-card kpi-primary">
                    <CardContent>
                      <CalendarToday className="kpi-icon" />
                      <Typography variant="h3" className="kpi-value">
                        {Math.floor(kpis.totalWorkingDays * (counter / 100))}
                      </Typography>
                      <Typography className="kpi-label">Total Working Days</Typography>
                      <Typography variant="caption" className="kpi-sublabel">Attendance logged</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card className="kpi-card kpi-success">
                    <CardContent>
                      <CheckCircle className="kpi-icon" />
                      <Typography variant="h3" className="kpi-value">
                        {Math.floor(kpis.presentDays * (counter / 100))}
                      </Typography>
                      <Typography className="kpi-label">Present Days</Typography>
                      <Typography variant="caption" className="kpi-sublabel">On-time attendance</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card className="kpi-card kpi-warning">
                    <CardContent>
                      <AccessTime className="kpi-icon" />
                      <Typography variant="h3" className="kpi-value">
                        {Math.floor(kpis.lateDays * (counter / 100))}
                      </Typography>
                      <Typography className="kpi-label">Late Arrivals</Typography>
                      <Typography variant="caption" className="kpi-sublabel">Days with late check-in</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card className="kpi-card kpi-error">
                    <CardContent>
                      <BeachAccess className="kpi-icon" />
                      <Typography variant="h3" className="kpi-value">
                        {Math.floor(kpis.halfDays * (counter / 100))}
                      </Typography>
                      <Typography className="kpi-label">Half Days</Typography>
                      <Typography variant="caption" className="kpi-sublabel">Partial attendance</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Additional Metrics */}
                <Grid item xs={12} sm={6} md={3}>
                  <Card className="kpi-card kpi-info">
                    <CardContent>
                      <EventAvailable className="kpi-icon" />
                      <Typography variant="h3" className="kpi-value">
                        {Math.floor(kpis.absentDays * (counter / 100))}
                      </Typography>
                      <Typography className="kpi-label">Absent Days</Typography>
                      <Typography variant="caption" className="kpi-sublabel">Total absences</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card className="kpi-card kpi-secondary">
                    <CardContent>
                      <Timer className="kpi-icon" />
                      <Typography variant="h3" className="kpi-value">
                        {formatDuration((kpis.averageWorkingHours || 0) * (counter / 100))}
                      </Typography>
                      <Typography className="kpi-label">Avg. Work Hours</Typography>
                      <Typography variant="caption" className="kpi-sublabel">Per day</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card className="kpi-card kpi-accent">
                    <CardContent>
                      <HourglassEmpty className="kpi-icon" />
                      <Typography variant="h3" className="kpi-value">
                        {Math.floor(kpis.probationRemaining * (counter / 100))}
                      </Typography>
                      <Typography className="kpi-label">Probation Days</Typography>
                      <Typography variant="caption" className="kpi-sublabel">Remaining</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card className="kpi-card kpi-primary-alt">
                    <CardContent>
                      <CalendarToday className="kpi-icon" />
                      <Typography variant="h3" className="kpi-value">
                        {Math.floor(kpis.daysSinceJoining * (counter / 100))}
                      </Typography>
                      <Typography className="kpi-label">Days Since Joining</Typography>
                      <Typography variant="caption" className="kpi-sublabel">Total tenure</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card className="kpi-card kpi-leave">
                    <CardContent>
                      <EventBusy className="kpi-icon" />
                      <Typography variant="h3" className="kpi-value">
                        {Math.floor(kpis.totalLeaves * (counter / 100))}
                      </Typography>
                      <Typography className="kpi-label">Total Leaves</Typography>
                      <Typography variant="caption" className="kpi-sublabel">Taken till today</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>

            {/* Employee Details Section */}
            <Box className="section employee-details-section">
              <Typography variant="h6" className="section-title">
                <Person /> Employee Information
              </Typography>
              <Card className="details-card fancy-info-card">
                <CardContent>
                  <Grid container spacing={2} className="info-grid">
                    <Grid item xs={12} sm={6} md={4}>
                      <Box className="info-item">
                        <Box className="info-icon" style={{ backgroundColor: 'rgba(44,62,80,0.08)' }}>
                          <Person sx={{ color: THEME.primary }} />
                        </Box>
                        <Box className="info-content">
                          <Typography className="info-label">Name</Typography>
                          <Typography className="info-value">{employeeData.fullName}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Box className="info-item">
                        <Box className="info-icon" style={{ backgroundColor: 'rgba(44,62,80,0.08)' }}>
                          <Bookmark sx={{ color: THEME.primary }} />
                        </Box>
                        <Box className="info-content">
                          <Typography className="info-label">Employee ID</Typography>
                          <Typography className="info-value">{employeeData.employeeCode || 'N/A'}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Box className="info-item">
                        <Box className="info-icon" style={{ backgroundColor: 'rgba(44,62,80,0.08)' }}>
                          <Business sx={{ color: THEME.primary }} />
                        </Box>
                        <Box className="info-content">
                          <Typography className="info-label">Department</Typography>
                          <Typography className="info-value">{employeeData.department || 'N/A'}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Box className="info-item">
                        <Box className="info-icon" style={{ backgroundColor: 'rgba(44,62,80,0.08)' }}>
                          <Work sx={{ color: THEME.primary }} />
                        </Box>
                        <Box className="info-content">
                          <Typography className="info-label">Designation</Typography>
                          <Typography className="info-value">{employeeData.designation || 'N/A'}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Box className="info-item">
                        <Box className="info-icon" style={{ backgroundColor: 'rgba(44,62,80,0.08)' }}>
                          <Email sx={{ color: THEME.primary }} />
                        </Box>
                        <Box className="info-content">
                          <Typography className="info-label">Email</Typography>
                          <Typography className="info-value">{employeeData.email}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Box className="info-item">
                        <Box className="info-icon" style={{ backgroundColor: 'rgba(44,62,80,0.08)' }}>
                          <CalendarToday sx={{ color: THEME.primary }} />
                        </Box>
                        <Box className="info-content">
                          <Typography className="info-label">Join Date</Typography>
                          <Typography className="info-value">
                            {new Date(employeeData.joiningDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Box className="info-item">
                        <Box className="info-icon" style={{ backgroundColor: 'rgba(44,62,80,0.08)' }}>
                          <Timer sx={{ color: THEME.primary }} />
                        </Box>
                        <Box className="info-content">
                          <Typography className="info-label">Work Duration</Typography>
                          <Typography className="info-value">{Math.floor(kpis.totalWorkingDays / 30)} months ({kpis.totalWorkingDays} days)</Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Box className="info-item">
                        <Box className="info-icon" style={{ backgroundColor: 'rgba(76,175,80,0.12)' }}>
                          <CheckCircle sx={{ color: THEME.success }} />
                        </Box>
                        <Box className="info-content">
                          <Typography className="info-label">Current Status</Typography>
                          <Chip label={employeeData.employmentStatus || 'Active'} size="small" className="status-chip" />
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Box>

            {/* Attendance & Performance Insights Section */}
            <Box className="section insights-section">
              <Typography variant="h6" className="section-title">
                <EventAvailable /> Attendance & Performance Insights
              </Typography>
              <Box display="flex" justifyContent="center">
                <Grid container spacing={3} sx={{ maxWidth: '1200px' }}>
                  {/* Attendance Breakdown - Expanded */}
                  <Grid item xs={12} md={6}>
                    <Card className="insight-card expanded-card">
                      <CardContent>
                        <Typography variant="h6" className="card-title">Attendance Summary</Typography>
                        <Divider sx={{ my: 2 }} />
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Stack spacing={2}>
                              <Box className="leave-breakdown-item">
                                <Box display="flex" alignItems="center" gap={1}>
                                  <CheckCircle sx={{ color: THEME.success, fontSize: 20 }} />
                                  <Typography variant="body2">Present Days</Typography>
                                </Box>
                                <Typography variant="body1" fontWeight={600}>
                                  {kpis.presentDays} days
                                </Typography>
                              </Box>
                              <Box className="leave-breakdown-item">
                                <Box display="flex" alignItems="center" gap={1}>
                                  <AccessTime sx={{ color: THEME.warning, fontSize: 20 }} />
                                  <Typography variant="body2">Late Arrivals</Typography>
                                </Box>
                                <Typography variant="body1" fontWeight={600}>
                                  {kpis.lateDays} days
                                </Typography>
                              </Box>
                            </Stack>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Stack spacing={2}>
                              <Box className="leave-breakdown-item">
                                <Box display="flex" alignItems="center" gap={1}>
                                  <BeachAccess sx={{ color: THEME.error, fontSize: 20 }} />
                                  <Typography variant="body2">Half Days</Typography>
                                </Box>
                                <Typography variant="body1" fontWeight={600}>
                                  {kpis.halfDays} days
                                </Typography>
                              </Box>
                              <Box className="leave-breakdown-item">
                                <Box display="flex" alignItems="center" gap={1}>
                                  <EventAvailable sx={{ color: THEME.textSecondary, fontSize: 20 }} />
                                  <Typography variant="body2">Absent Days</Typography>
                                </Box>
                                <Typography variant="body1" fontWeight={600}>
                                  {kpis.absentDays} days
                                </Typography>
                              </Box>
                            </Stack>
                          </Grid>
                        </Grid>

                        <Box mt={3} p={2} sx={{ backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Performance Metrics
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="body1" fontWeight={600}>
                                {kpis.totalWorkingDays} total working days
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" color="text.secondary">
                                {kpis.totalWorkingDays > 0 ? 
                                  `${Math.round((kpis.presentDays / kpis.totalWorkingDays) * 100)}% on-time attendance` : 
                                  'No attendance data'}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Attendance Distribution Pie Chart - Expanded */}
                  <Grid item xs={12} md={6}>
                    <Card className="insight-card expanded-card distribution-card">
                      <CardContent>
                        <Typography variant="h6" className="card-title">Attendance Distribution</Typography>
                        <Divider sx={{ my: 2 }} />
                        {attendanceData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={350}>
                            <PieChart>
                              <Pie
                                data={attendanceData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => {
                                  const fullName = name === 'Present' ? 'Present' : 
                                                  name === 'Late' ? 'Late' : 
                                                  name === 'Half-day' ? 'Half-day' : 
                                                  name === 'Absent' ? 'Absent' : name;
                                  return `${fullName}: ${(percent * 100).toFixed(0)}%`;
                                }}
                                outerRadius={100}
                                innerRadius={20}
                                fill="#8884d8"
                                dataKey="value"
                                paddingAngle={2}
                              >
                                {attendanceData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                formatter={(value, name) => {
                                  const fullName = name === 'Present' ? 'Present' : 
                                                  name === 'Late' ? 'Late' : 
                                                  name === 'Half-day' ? 'Half-day' : 
                                                  name === 'Absent' ? 'Absent' : name;
                                  return [`${value} days`, fullName];
                                }}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                height={36}
                                formatter={(value) => {
                                  const fullName = value === 'Present' ? 'Present' : 
                                                  value === 'Late' ? 'Late' : 
                                                  value === 'Half-day' ? 'Half-day' : 
                                                  value === 'Absent' ? 'Absent' : value;
                                  return fullName;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <Box textAlign="center" py={5}>
                            <Typography variant="body2" color="text.secondary">
                              No attendance data available
                            </Typography>
                          </Box>
                        )}

                        <Divider sx={{ my: 2 }} />
                        
                        {/* Work Performance */}
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Work Performance
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                              <Box textAlign="center" p={1}>
                                <Typography variant="h6" fontWeight={700} color={THEME.success}>
                                  {kpis.totalWorkingDays > 0 ?
                                    `${((kpis.presentDays / kpis.totalWorkingDays) * 100).toFixed(1)}%` :
                                    'N/A'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  On-time Rate
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Box textAlign="center" p={1}>
                                <Typography variant="h6" fontWeight={700} color={THEME.primary}>
                                  {formatDuration(kpis.averageWorkingHours)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Avg. Work Hours
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Box textAlign="center" p={1}>
                                <Typography variant="h6" fontWeight={700} color={THEME.info}>
                                  {formatDuration(kpis.totalWorkingHours)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Total Work Hours
                                </Typography>
                              </Box>
                            </Grid>
                          </Grid>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            </Box>

            {/* Daily Attendance Log Section */}
            <Box className="section attendance-log-section">
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" className="section-title">
                  <Schedule /> Daily Attendance Log
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(e, newMode) => newMode && setViewMode(newMode)}
                    size="small"
                    className="view-toggle"
                  >
                    <ToggleButton value="week">Week</ToggleButton>
                    <ToggleButton value="month">Month</ToggleButton>
                    <ToggleButton value="custom">Custom</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Box>

              {/* Custom Date Range Selector */}
              {viewMode === 'custom' && (
                <Box mb={3} p={2} sx={{ backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                  <Typography variant="subtitle2" sx={{ mb: 2, color: THEME.primary, fontWeight: 600 }}>
                    <DateRange sx={{ mr: 1, fontSize: 20 }} />
                    Select Date Range
                  </Typography>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                      <DatePicker
                        label="Start Date"
                        value={customDateRange.start}
                        onChange={(newValue) => setCustomDateRange(prev => ({ ...prev, start: newValue }))}
                        slotProps={{
                          textField: {
                            size: 'small',
                            sx: { minWidth: 150 }
                          }
                        }}
                      />
                      <Typography variant="body2" color="text.secondary">to</Typography>
                      <DatePicker
                        label="End Date"
                        value={customDateRange.end}
                        onChange={(newValue) => setCustomDateRange(prev => ({ ...prev, end: newValue }))}
                        slotProps={{
                          textField: {
                            size: 'small',
                            sx: { minWidth: 150 }
                          }
                        }}
                      />
                    </Box>
                  </LocalizationProvider>
                </Box>
              )}

              <Card className="chart-card">
                <CardContent>
                  <Typography variant="h6" className="card-title" gutterBottom>
                    Work Hours & Breaks Timeline
                  </Typography>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    {viewMode === 'week' ? 'Last 7 days' : 
                     viewMode === 'month' ? 'Last 30 days' : 
                     `Custom range: ${customDateRange.start.toLocaleDateString()} - ${customDateRange.end.toLocaleDateString()}`}
                  </Typography>
                  
                  {dailyAttendanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={dailyAttendanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => formatHoursAsHrsDotMM(value)}
                        />
                        <RechartsTooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: `2px solid ${THEME.primary}`,
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }}
                          formatter={(value, name, props) => {
                            const data = props.payload;
                            if (name === 'Work Hours') {
                              return [formatHoursAsHrsDotMM(value), 'Work Hours'];
                            } else if (name === 'Break Hours') {
                              return [formatHoursAsHrsDotMM(value), 'Break Hours'];
                            }
                            return [value, name];
                          }}
                          labelFormatter={(label, payload) => {
                            if (payload && payload.length > 0) {
                              const data = payload[0].payload;
                              return (
                                <div style={{ padding: '4px 0' }}>
                                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{label}</div>
                                  <div style={{ fontSize: '12px', color: '#666' }}>
                                    Clock In: {data.clockIn} | Clock Out: {data.clockOut}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#666' }}>
                                    Status: {data.status} | Breaks: {data.breakCount}
                                  </div>
                                </div>
                              );
                            }
                            return label;
                          }}
                        />
                        <Legend 
                          formatter={(value) => {
                            if (value === 'workHours') return 'Work Hours';
                            if (value === 'breakHours') return 'Break Hours';
                            return value;
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="workHours" 
                          stroke={THEME.primary} 
                          strokeWidth={3}
                          dot={{ fill: THEME.primary, r: 4 }}
                          name="Work Hours"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="breakHours" 
                          stroke={THEME.warning} 
                          strokeWidth={2}
                          dot={{ fill: THEME.warning, r: 3 }}
                          name="Break Hours"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box textAlign="center" py={5}>
                      <Typography variant="body2" color="text.secondary">
                        No attendance data available
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>

            {/* KPI & Probation Insights */}
            <Box className="section probation-section">
              <Typography variant="h6" className="section-title">
                <HourglassEmpty /> Probation & Performance
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Card className="metric-card probation-card">
                    <CardContent>
                      <Box className="probation-header">
                        <Box className="pill pill-primary">Total Working Days</Box>
                      </Box>
                      <Box className="probation-value" style={{ color: THEME.primary }}>{kpis.totalWorkingDays}</Box>
                      <Typography variant="caption" className="probation-subtext">Days with attendance logged</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card className="metric-card probation-card">
                    <CardContent>
                      <Box className="probation-header">
                        <Box className="pill pill-info">Days Since Joining</Box>
                      </Box>
                      <Box className="probation-value info">{kpis.daysSinceJoining}</Box>
                      <Typography variant="caption" className="probation-subtext">Since {new Date(employeeData.joiningDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card className="metric-card probation-card">
                    <CardContent>
                      <Box className="probation-header">
                        <Box className={`pill ${kpis.probationRemaining > 0 ? 'pill-warn' : 'pill-success'}`}>
                          {kpis.probationRemaining > 0 ? 'Active' : 'Completed'}
                        </Box>
                        <Typography variant="caption" className="probation-subtext" style={{ marginLeft: 8 }}>
                          {kpis.probationRemaining} days remaining
                        </Typography>
                      </Box>
                      <Box className="progress-rail">
                        <Box className="progress-bar" style={{ width: `${kpis.probationProgress}%` }} />
                      </Box>
                      <Box className="progress-labels">
                        <Typography variant="caption">0%</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>{kpis.probationProgress.toFixed(0)}%</Typography>
                        <Typography variant="caption">100%</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
              </Box>
            )}

            {/* Attendance Resolution Tab */}
            {tabValue === 1 && (
              <Box sx={{ p: 3 }}>
                {/* Header Section */}
                <Box sx={{ 
                  mb: 3, 
                  p: 3, 
                  backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px',
                  color: 'white'
                }}>
                  <Box display="flex" alignItems="center" gap={2} mb={1}>
                    <Gavel sx={{ fontSize: 28 }} />
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      Attendance Resolution
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ opacity: 0.9 }}>
                    {employeeData?.fullName} ({employeeData?.employeeCode})
                  </Typography>
                </Box>
                
                {/* Info Card */}
                <Card sx={{ mb: 3, borderRadius: '16px', border: '1px solid #e3f2fd' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <AccessTime sx={{ color: THEME.primary }} />
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: THEME.primary }}>
                        Grace Period Settings
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Current grace period: <strong>{attendanceResolutionData?.gracePeriodMinutes || 30} minutes</strong>
                    </Typography>
                    
                    {/* Visual Legend */}
                    <Box sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: '12px' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Visual Indicators:
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box sx={{ width: 4, height: 20, backgroundColor: '#4caf50', borderRadius: 1 }} />
                          <Typography variant="body2">
                            <strong>Green:</strong> On-time (0 minutes late)
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box sx={{ width: 4, height: 20, backgroundColor: '#fbc02d', borderRadius: 1 }} />
                          <Chip label="Grace" size="small" sx={{ fontSize: '9px', height: '16px', ml: 0.5 }} />
                          <Typography variant="body2">
                            <strong>Yellow:</strong> Late but within grace period
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box sx={{ width: 4, height: 20, backgroundColor: '#ff9800', borderRadius: 1 }} />
                          <Typography variant="body2">
                            <strong>Orange:</strong> Marked as Late (manual override)
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box sx={{ width: 4, height: 20, backgroundColor: '#f44336', borderRadius: 1 }} />
                          <Typography variant="body2">
                            <strong>Red:</strong> Half-day (exceeded grace period)
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip 
                          label="On-time" 
                          color="success" 
                          size="small" 
                          icon={<CheckCircle />}
                        />
                        <Typography variant="body2" color="text.secondary">
                          Within grace period
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip 
                          label="Late" 
                          color="warning" 
                          size="small" 
                          icon={<AccessTime />}
                        />
                        <Typography variant="body2" color="text.secondary">
                          Manual override
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip 
                          label="Half-day" 
                          color="error" 
                          size="small" 
                          icon={<EventBusy />}
                        />
                        <Typography variant="body2" color="text.secondary">
                          After grace period
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
                
                {loadingResolution ? (
                  <Box display="flex" justifyContent="center" p={4}>
                    <CircularProgress sx={{ color: THEME.primary }} />
                  </Box>
                ) : attendanceResolutionData ? (
                  <>
                    {/* Debug Info */}
                    {process.env.NODE_ENV === 'development' && (
                      <Box sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Debug: Found {attendanceResolutionData.attendanceLogs?.length || 0} attendance records
                          {attendanceResolutionData.attendanceLogs?.length > 0 && (
                            <span> - Latest: {attendanceResolutionData.attendanceLogs[0]?.attendanceDate}</span>
                          )}
                          <br />
                          Employee: {attendanceResolutionData.employee?.fullName} ({attendanceResolutionData.employee?.employeeCode})
                          <br />
                          Grace Period: {attendanceResolutionData.gracePeriodMinutes || 30} minutes
                          {attendanceResolutionData.attendanceLogs?.length > 0 && (
                            <span> - Status calculated based on grace period logic</span>
                          )}
                        </Typography>
                      </Box>
                    )}
                    <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                    <CardContent sx={{ p: 0 }}>
                      <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', color: THEME.primary }}>
                          Attendance Records
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Recent attendance records with manual override options
                        </Typography>
                      </Box>
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow sx={{ 
                              backgroundColor: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                              '& .MuiTableCell-head': {
                                fontWeight: 'bold',
                                color: '#2C3E50',
                                borderBottom: '2px solid #e0e0e0'
                              }
                            }}>
                              <TableCell>Date</TableCell>
                              <TableCell>Clock In</TableCell>
                              <TableCell>Clock Out</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Late Duration</TableCell>
                              <TableCell align="center">Mark Late</TableCell>
                              <TableCell align="center">Mark Half Day</TableCell>
                              <TableCell align="center">Quick Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {attendanceResolutionData.attendanceLogs.map((log, index) => {
                              const gracePeriod = attendanceResolutionData?.gracePeriodMinutes || 30;
                              const isWithinGrace = (log.lateMinutes || 0) > 0 && (log.lateMinutes || 0) <= gracePeriod;
                              const hasExceededGrace = (log.lateMinutes || 0) > gracePeriod;
                              
                              return (
                              <TableRow 
                                key={index} 
                                hover
                                sx={{ 
                                  '&:nth-of-type(odd)': { 
                                    backgroundColor: log.calculatedStatus === 'Half-day' ? '#ffebee' :
                                                     log.calculatedStatus === 'Late' ? '#fff3e0' :
                                                     isWithinGrace ? '#fffde7' :
                                                     '#fafafa'
                                  },
                                  '&:nth-of-type(even)': { 
                                    backgroundColor: log.calculatedStatus === 'Half-day' ? '#fce4ec' :
                                                     log.calculatedStatus === 'Late' ? '#ffe8cc' :
                                                     isWithinGrace ? '#fffacd' :
                                                     'white'
                                  },
                                  '&:hover': { 
                                    backgroundColor: log.calculatedStatus === 'Half-day' ? '#f8bbd0' :
                                                     log.calculatedStatus === 'Late' ? '#ffe0b2' :
                                                     isWithinGrace ? '#fff9c4' :
                                                     '#f0f8ff'
                                  },
                                  borderLeft: log.calculatedStatus === 'Half-day' ? '4px solid #f44336' :
                                             log.calculatedStatus === 'Late' ? '4px solid #ff9800' :
                                             isWithinGrace ? '4px solid #fbc02d' :
                                             'none'
                                }}
                              >
                                <TableCell sx={{ fontWeight: 'medium' }}>
                                  <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                      {new Date(log.attendanceDate).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {new Date(log.attendanceDate).toLocaleDateString('en-US', {
                                        weekday: 'short'
                                      })}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ 
                                    fontFamily: 'monospace',
                                    fontWeight: 'bold',
                                    color: log.clockInTime ? 'success.main' : 'text.secondary'
                                  }}>
                                    {log.clockInTime ? formatTime(log.clockInTime) : '--:--'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ 
                                    fontFamily: 'monospace',
                                    fontWeight: 'bold',
                                    color: log.clockOutTime ? 'success.main' : 'text.secondary'
                                  }}>
                                    {log.clockOutTime ? formatTime(log.clockOutTime) : '--:--'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Chip
                                      label={log.calculatedStatus || 'On-time'}
                                      color={
                                        log.calculatedStatus === 'On-time' ? 'success' :
                                        log.calculatedStatus === 'Late' ? 'warning' :
                                        log.calculatedStatus === 'Half-day' ? 'error' : 'default'
                                      }
                                      size="small"
                                      icon={
                                        isWithinGrace ? (
                                          <AccessTime sx={{ fontSize: 16 }} />
                                        ) : log.calculatedStatus === 'Late' ? (
                                          <AccessTime sx={{ fontSize: 16 }} />
                                        ) : log.calculatedStatus === 'Half-day' ? (
                                          <EventBusy sx={{ fontSize: 16 }} />
                                        ) : null
                                      }
                                      sx={{ 
                                        borderRadius: '12px',
                                        fontWeight: 'bold',
                                        minWidth: '80px',
                                        // Highlight with warning color if late minutes exist but still within grace
                                        ...(isWithinGrace && log.calculatedStatus === 'On-time' && {
                                          backgroundColor: '#fff3e0',
                                          color: '#e65100',
                                          border: '1px solid #ff9800'
                                        })
                                      }}
                                    />
                                    {log.hasManualOverride && (
                                      <Tooltip title="Manually overridden">
                                        <Edit sx={{ fontSize: 14, color: 'primary.main' }} />
                                      </Tooltip>
                                    )}
                                    {isWithinGrace && log.calculatedStatus === 'On-time' && (
                                      <Tooltip title={`Late ${log.lateMinutes} min but within grace period`}>
                                        <Chip 
                                          label="Grace" 
                                          size="small" 
                                          sx={{ 
                                            fontSize: '9px',
                                            height: '16px',
                                            backgroundColor: '#fff3e0',
                                            color: '#e65100',
                                            fontWeight: 'bold'
                                          }} 
                                        />
                                      </Tooltip>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Typography variant="body2" sx={{ 
                                      fontFamily: 'monospace',
                                      fontWeight: 'bold',
                                      color: hasExceededGrace ? 'error.main' :
                                             isWithinGrace ? 'warning.main' : 
                                             'text.secondary',
                                      backgroundColor: hasExceededGrace ? '#ffebee' :
                                                      isWithinGrace ? '#fff3e0' : 
                                                      'transparent',
                                      padding: '4px 8px',
                                      borderRadius: '8px',
                                      border: (log.lateMinutes || 0) > 0 ? '1px solid' : 'none',
                                      borderColor: hasExceededGrace ? 'error.main' :
                                                  isWithinGrace ? 'warning.main' : 
                                                  'transparent'
                                    }}>
                                      {formatLateMinutes(log.lateMinutes || 0)}
                                    </Typography>
                                    {hasExceededGrace && (
                                      <Tooltip title="Exceeded grace period">
                                        <EventBusy sx={{ fontSize: 16, color: 'error.main' }} />
                                      </Tooltip>
                                    )}
                                    {isWithinGrace && (
                                      <Tooltip title="Within grace period">
                                        <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                                      </Tooltip>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell align="center">
                                  <Switch
                                    checked={log.calculatedStatus === 'Late'}
                                    onChange={() => handleToggleStatus(log.attendanceDate, 'late', log.calculatedStatus)}
                                    color="warning"
                                    disabled={log.calculatedStatus === 'Half-day'}
                                    sx={{
                                      '& .MuiSwitch-thumb': {
                                        backgroundColor: log.calculatedStatus === 'Late' ? '#ff9800' : '#f5f5f5'
                                      },
                                      '& .MuiSwitch-track': {
                                        backgroundColor: log.calculatedStatus === 'Late' ? '#ffb74d' : '#e0e0e0'
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Switch
                                    checked={log.calculatedStatus === 'Half-day'}
                                    onChange={() => handleToggleStatus(log.attendanceDate, 'halfday', log.calculatedStatus)}
                                    color="error"
                                    disabled={log.calculatedStatus === 'Late'}
                                    sx={{
                                      '& .MuiSwitch-thumb': {
                                        backgroundColor: log.calculatedStatus === 'Half-day' ? '#f44336' : '#f5f5f5'
                                      },
                                      '& .MuiSwitch-track': {
                                        backgroundColor: log.calculatedStatus === 'Half-day' ? '#ef5350' : '#e0e0e0'
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Box display="flex" gap={0.5} justifyContent="center">
                                    <Tooltip title={log.calculatedStatus === 'Late' ? "Mark On-time" : "Mark Late"}>
                                      <IconButton
                                        onClick={() => handleToggleStatus(log.attendanceDate, 'late', log.calculatedStatus)}
                                        color={log.calculatedStatus === 'Late' ? "warning" : "default"}
                                        size="small"
                                        disabled={log.calculatedStatus === 'Half-day'}
                                        sx={{
                                          backgroundColor: log.calculatedStatus === 'Late' ? 'warning.light' : 'transparent',
                                          '&:hover': {
                                            backgroundColor: log.calculatedStatus === 'Late' ? 'warning.main' : 'action.hover'
                                          }
                                        }}
                                      >
                                        <AccessTime />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title={log.calculatedStatus === 'Half-day' ? "Mark On-time" : "Mark Half Day"}>
                                      <IconButton
                                        onClick={() => handleToggleStatus(log.attendanceDate, 'halfday', log.calculatedStatus)}
                                        color={log.calculatedStatus === 'Half-day' ? "error" : "default"}
                                        size="small"
                                        disabled={log.calculatedStatus === 'Late'}
                                        sx={{
                                          backgroundColor: log.calculatedStatus === 'Half-day' ? 'error.light' : 'transparent',
                                          '&:hover': {
                                            backgroundColor: log.calculatedStatus === 'Half-day' ? 'error.main' : 'action.hover'
                                          }
                                        }}
                                      >
                                        <EventBusy />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </TableCell>
                              </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      
                      {attendanceResolutionData.attendanceLogs.length === 0 && (
                        <Box display="flex" flexDirection="column" alignItems="center" p={6}>
                          <EventBusy sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No Attendance Records
                          </Typography>
                          <Typography variant="body2" color="text.secondary" textAlign="center">
                            No attendance records found for this employee in the selected period.
                          </Typography>
                        </Box>
                      )}
                      
                      {/* Summary Section */}
                      {attendanceResolutionData.attendanceLogs.length > 0 && (
                        <Box sx={{ p: 3, backgroundColor: '#f8f9fa', borderTop: '1px solid #e0e0e0' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Summary
                          </Typography>
                          <Box display="flex" gap={3} flexWrap="wrap">
                            <Box display="flex" alignItems="center" gap={1}>
                              <CheckCircle sx={{ color: 'success.main', fontSize: 16 }} />
                              <Typography variant="body2">
                                On-time: {attendanceResolutionData.attendanceLogs.filter(log => log.calculatedStatus === 'On-time').length}
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <AccessTime sx={{ color: 'warning.main', fontSize: 16 }} />
                              <Typography variant="body2">
                                Late: {attendanceResolutionData.attendanceLogs.filter(log => log.calculatedStatus === 'Late').length}
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <EventBusy sx={{ color: 'error.main', fontSize: 16 }} />
                              <Typography variant="body2">
                                Half-day: {attendanceResolutionData.attendanceLogs.filter(log => log.calculatedStatus === 'Half-day').length}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                  </>
                ) : (
                  <Box display="flex" justifyContent="center" p={4}>
                    <Typography variant="body2" color="text.secondary">
                      No data available
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions className="modal-footer">
        <Button 
          onClick={handleRefresh} 
          startIcon={<Refresh />}
          className="refresh-button"
        >
          Refresh
        </Button>
        <Button 
          onClick={onClose} 
          variant="contained"
          className="close-action-button"
        >
          Close
        </Button>
      </DialogActions>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default ViewAnalyticsModal;

