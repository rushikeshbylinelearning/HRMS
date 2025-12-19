// frontend/src/components/EmployeeAnalyticsModal.jsx

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Tooltip
} from '@mui/material';
import {
  Close,
  TrendingUp,
  TrendingDown,
  AccessTime,
  Warning,
  CheckCircle,
  Cancel,
  Person,
  ToggleOn,
  ToggleOff,
  Schedule,
  Work,
  Timer,
  CalendarToday,
  Email,
  Business,
  Refresh,
  Analytics,
  Assessment
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';
import { io } from 'socket.io-client';

// Format hours as Hrs.mm (e.g., 8.30 for 8h 30m)
const formatHoursAsHrsDotMM = (hours) => {
  if (!hours || hours <= 0) return '0.00';
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  const mm = String(minutes).padStart(2, '0');
  return `${wholeHours}.${mm}`;
};

const EmployeeAnalyticsModal = ({ open, onClose, employeeId, employeeName }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [updatingHalfDay, setUpdatingHalfDay] = useState(null); // Track which log is being updated

  // Early return if not open to prevent unnecessary rendering
  if (!open) {
    return null;
  }

  // Theme colors matching the rest of the app
  const COLORS = {
    primary: '#d32f2f', // Red
    secondary: '#ffffff', // White
    background: '#f8f9fa', // Light gray background
    navy: '#1e3a8a', // Navy blue
    success: '#4caf50', // Green for on-time
    warning: '#ff9800', // Orange for late
    error: '#f44336', // Red for half-day/absent
    info: '#2196f3', // Blue for info
    cardBackground: '#ffffff',
    cardHover: '#f5f5f5',
    textPrimary: '#212121',
    textSecondary: '#757575'
  };

  const chartColors = {
    onTime: COLORS.success,
    late: COLORS.warning,
    halfDay: COLORS.error,
    absent: '#9e9e9e'
  };

  useEffect(() => {
    if (open && employeeId) {
      // default to previous month
      const nowDate = new Date();
      const prev = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
      setSelectedMonth(prev.getMonth());
      setSelectedYear(prev.getFullYear());
      fetchEmployeeAnalytics(prev.getFullYear(), prev.getMonth());
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
      console.log('📡 EmployeeAnalyticsModal received attendance_log_updated event:', data);
      
      // Check if the update affects the current employee
      const isRelevantUpdate = (
        data.userId === employeeId || // Update affects current employee
        user.role === 'Admin' ||     // Current user is admin
        user.role === 'HR'           // Current user is HR
      );

      if (isRelevantUpdate) {
        console.log('🔄 Refreshing EmployeeAnalyticsModal data due to attendance log update');
        
        // Refresh the analytics data
        fetchEmployeeAnalytics();
      }
    };

    // Set up event listeners
    socket.on('connect', () => {
      console.log('🔌 EmployeeAnalyticsModal connected to Socket.IO server');
    });

    socket.on('disconnect', () => {
      console.log('🔌 EmployeeAnalyticsModal disconnected from Socket.IO server');
    });

    socket.on('attendance_log_updated', handleAttendanceLogUpdate);

    // Cleanup on unmount or when dependencies change
    return () => {
      socket.off('attendance_log_updated', handleAttendanceLogUpdate);
      socket.disconnect();
    };
  }, [open, employeeId, user]);

  const handleToggleHalfDay = async (logId, currentValue) => {
    try {
      setUpdatingHalfDay(logId);
      const response = await axios.put(`/admin/attendance/half-day/${logId}`, {
        isHalfDay: !currentValue
      });
      
      // Show success message with status transition details
      if (response.data?.message) {
        console.log('Half-day status updated:', response.data.message);
      }
      
      // Refresh the analytics data
      await fetchEmployeeAnalytics();
    } catch (error) {
      console.error('Error updating half-day status:', error);
      setError('Failed to update half-day status');
    } finally {
      setUpdatingHalfDay(null);
    }
  };

  const fetchEmployeeAnalytics = async (yearParam, monthParam) => {
    if (!employeeId) {
      console.warn('No employee ID provided for analytics');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const nowDate = new Date();
      const year = typeof yearParam === 'number' ? yearParam : (selectedYear ?? nowDate.getFullYear());
      const month = typeof monthParam === 'number' ? monthParam : (selectedMonth ?? nowDate.getMonth());

      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0);
      const startDate = startOfMonth.toISOString().slice(0, 10);
      const endDate = endOfMonth.toISOString().slice(0, 10);
      
      console.log('Fetching analytics for date range:', { startDate, endDate });
      const response = await axios.get(`/analytics/employee/${employeeId}?startDate=${startDate}&endDate=${endDate}`);
      
      if (response.data) {
        console.log('Employee analytics response:', response.data);
        setAnalyticsData(response.data);
      } else {
        throw new Error('No data received from server');
      }
    } catch (error) {
      console.error('Error fetching employee analytics:', error);
      setError(error.response?.data?.message || 'Failed to fetch employee analytics');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'On-time': return COLORS.success;
      case 'Late': return COLORS.warning;
      case 'Half-day': return COLORS.error;
      case 'Absent': return COLORS.error;
      default: return COLORS.info;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'On-time': return <CheckCircle />;
      case 'Late': return <Warning />;
      case 'Half-day': return <Cancel />;
      case 'Absent': return <AccessTime />;
      default: return <AccessTime />;
    }
  };

  // Safety check to prevent rendering issues
  if (!open || !employeeId) {
    return null;
  }

  const prepareChartData = () => {
    if (!analyticsData || !analyticsData.metrics) {
      return { weekly: [], monthly: [], pie: [] };
    }

    // Prepare pie chart data with safety checks
    const pieData = [
      { name: 'Present', value: analyticsData.metrics.onTimeDays || 0, color: chartColors.onTime },
      { name: 'Late', value: analyticsData.metrics.lateDays || 0, color: chartColors.late },
      { name: 'Half-day', value: analyticsData.metrics.halfDays || 0, color: chartColors.halfDay },
      { name: 'Absent', value: analyticsData.metrics.absentDays || 0, color: chartColors.absent }
    ];

    return {
      weekly: analyticsData.charts?.weekly || [],
      monthly: analyticsData.charts?.monthly || [],
      pie: pieData
    };
  };

  const { weekly, monthly, pie } = prepareChartData();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: '12px', maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', 
        color: COLORS.secondary,
        p: 4,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box 
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            transform: 'translate(50%, -50%)'
          }}
        />
        <Box display="flex" justifyContent="space-between" alignItems="center" position="relative" zIndex={1}>
          <Box display="flex" alignItems="center" gap={3}>
            <Avatar sx={{ 
              backgroundColor: COLORS.secondary, 
              color: COLORS.navy,
              width: 64,
              height: 64,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              border: '3px solid rgba(255,255,255,0.2)'
            }}>
              <Person sx={{ fontSize: 32 }} />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ 
                fontWeight: '700',
                mb: 1,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                {employeeName || 'Employee'} Analytics
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Analytics sx={{ fontSize: 20, opacity: 0.9 }} />
                <Typography variant="body1" sx={{ 
                  opacity: 0.9,
                  fontWeight: '500'
                }}>
                  Detailed attendance analysis and trends
                </Typography>
              </Box>
            </Box>
          </Box>
          <IconButton 
            onClick={onClose} 
            sx={{ 
              color: COLORS.secondary,
              backgroundColor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.2)',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="400px">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box p={3}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : analyticsData ? (
          <Box>
            {/* Employee Info */}
            <Paper elevation={0} sx={{ 
              p: 4, 
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              borderBottom: `2px solid ${COLORS.navy}20`
            }}>
              <Grid container spacing={4}>
                <Grid item xs={12} md={8}>
                  <Box display="flex" alignItems="center" gap={2} mb={3}>
                    <Avatar sx={{ 
                      backgroundColor: COLORS.primary,
                      width: 48,
                      height: 48
                    }}>
                      <Person sx={{ fontSize: 24 }} />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ 
                        color: COLORS.navy, 
                        fontWeight: '700',
                        mb: 0.5
                      }}>
                        {analyticsData.employee.name}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: COLORS.textSecondary,
                        fontWeight: '500'
                      }}>
                        Employee ID: {analyticsData.employee.employeeCode || 'N/A'}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Stack spacing={2}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Email sx={{ color: COLORS.primary, fontSize: 20 }} />
                      <Typography variant="body1" sx={{ 
                        color: COLORS.textPrimary,
                        fontWeight: '500'
                      }}>
                        {analyticsData.employee.email}
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Business sx={{ color: COLORS.primary, fontSize: 20 }} />
                      <Typography variant="body1" sx={{ 
                        color: COLORS.textPrimary,
                        fontWeight: '500'
                      }}>
                        {analyticsData.employee.department} • {analyticsData.employee.designation}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card sx={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                    p: 3,
                    borderRadius: '16px',
                    border: `2px solid ${COLORS.primary}20`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                  }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <CalendarToday sx={{ color: COLORS.primary, fontSize: 20 }} />
                        <Typography variant="body2" sx={{ 
                          color: COLORS.textSecondary,
                          fontWeight: '600'
                        }}>
                          Analysis Period
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ 
                        color: COLORS.navy,
                        fontWeight: '500',
                        textAlign: 'center'
                      }}>
                        {analyticsData.period.start} to {analyticsData.period.end}
                      </Typography>
                      
                      <Divider sx={{ width: '100%', my: 1 }} />
                      
                      <Box display="flex" gap={1} width="100%">
                        <FormControl size="small" sx={{ flex: 1 }}>
                          <InputLabel>Month</InputLabel>
                          <Select 
                            value={selectedMonth ?? ''} 
                            label="Month" 
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            sx={{ 
                              borderRadius: '8px',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: COLORS.primary + '40'
                              }
                            }}
                          >
                            {Array.from({ length: 12 }).map((_, i) => (
                              <MenuItem key={i} value={i}>
                                {new Date(0, i).toLocaleString(undefined, { month: 'long' })}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ flex: 1 }}>
                          <InputLabel>Year</InputLabel>
                          <Select 
                            value={selectedYear ?? ''} 
                            label="Year" 
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            sx={{ 
                              borderRadius: '8px',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: COLORS.primary + '40'
                              }
                            }}
                          >
                            {Array.from({ length: 4 }).map((_, idx) => {
                              const y = new Date().getFullYear() - idx;
                              return <MenuItem key={y} value={y}>{y}</MenuItem>;
                            })}
                          </Select>
                        </FormControl>
                      </Box>
                      <Button 
                        variant="contained" 
                        startIcon={<Refresh />}
                        sx={{ 
                          backgroundColor: COLORS.primary,
                          borderRadius: '8px',
                          px: 3,
                          py: 1,
                          fontWeight: '600',
                          textTransform: 'none',
                          '&:hover': {
                            backgroundColor: COLORS.primary,
                            transform: 'translateY(-1px)',
                            boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)'
                          },
                          transition: 'all 0.2s ease'
                        }} 
                        onClick={() => fetchEmployeeAnalytics()}
                      >
                        Update Data
                      </Button>
                    </Box>
                  </Card>
                </Grid>
              </Grid>
            </Paper>

            {/* Metrics Cards */}
            <Box p={4} sx={{ backgroundColor: COLORS.background }}>
              <Box textAlign="center" mb={4}>
                <Box display="flex" alignItems="center" justifyContent="center" gap={2} mb={2}>
                  <Assessment sx={{ color: COLORS.primary, fontSize: 32 }} />
                  <Typography variant="h4" sx={{ 
                    color: COLORS.navy, 
                    fontWeight: '700'
                  }}>
                    Attendance Metrics
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ 
                  color: COLORS.textSecondary, 
                  fontWeight: '500'
                }}>
                  September 2025 (24 working days)
                </Typography>
                {analyticsData && (
                  <Typography variant="caption" sx={{ 
                    color: COLORS.textSecondary, 
                    display: 'block',
                    mt: 1,
                    fontSize: '0.75rem',
                    opacity: 0.7
                  }}>
                    Total logs: {analyticsData.logs?.length || 0} | Working days: {analyticsData.metrics?.totalDays || 0}
                  </Typography>
                )}
              </Box>
              
              <Grid container spacing={3} mb={4}>
                <Grid item xs={6} md={3}>
                  <Card sx={{ 
                    background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)', 
                    color: 'white',
                    borderRadius: '20px',
                    boxShadow: '0 8px 32px rgba(76, 175, 80, 0.4)',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 12px 40px rgba(76, 175, 80, 0.5)'
                    }
                  }}>
                    <Box sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '100px',
                      height: '100px',
                      background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                      borderRadius: '50%',
                      transform: 'translate(30%, -30%)'
                    }} />
                    <CardContent sx={{ textAlign: 'center', p: 3, position: 'relative', zIndex: 1 }}>
                      <CheckCircle sx={{ fontSize: 48, mb: 2, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                      <Typography variant="h2" sx={{ fontWeight: '800', mb: 1, textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                        {analyticsData.metrics.onTimeDays || 0}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: '600', mb: 1 }}>
                        Present
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                        out of {analyticsData.metrics?.totalDays || 24} days
                      </Typography>
                      <Box mt={2}>
                        <LinearProgress 
                          variant="determinate" 
                          value={((analyticsData.metrics.onTimeDays || 0) / (analyticsData.metrics?.totalDays || 24)) * 100}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: 'rgba(255,255,255,0.8)',
                              borderRadius: 3
                            }
                          }}
                        />
                        <Typography variant="caption" sx={{ 
                          display: 'block', 
                          mt: 1, 
                          opacity: 0.8,
                          fontSize: '0.75rem'
                        }}>
                          {(((analyticsData.metrics.onTimeDays || 0) / (analyticsData.metrics?.totalDays || 24)) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ 
                    background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', 
                    color: 'white',
                    borderRadius: '20px',
                    boxShadow: '0 8px 32px rgba(255, 152, 0, 0.4)',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 12px 40px rgba(255, 152, 0, 0.5)'
                    }
                  }}>
                    <Box sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '100px',
                      height: '100px',
                      background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                      borderRadius: '50%',
                      transform: 'translate(30%, -30%)'
                    }} />
                    <CardContent sx={{ textAlign: 'center', p: 3, position: 'relative', zIndex: 1 }}>
                      <Warning sx={{ fontSize: 48, mb: 2, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                      <Typography variant="h2" sx={{ fontWeight: '800', mb: 1, textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                        {analyticsData.metrics.lateDays || 0}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: '600', mb: 1 }}>
                        Late Days
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                        out of {analyticsData.metrics?.totalDays || 24} days
                      </Typography>
                      <Box mt={2}>
                        <LinearProgress 
                          variant="determinate" 
                          value={((analyticsData.metrics.lateDays || 0) / (analyticsData.metrics?.totalDays || 24)) * 100}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: 'rgba(255,255,255,0.8)',
                              borderRadius: 3
                            }
                          }}
                        />
                        <Typography variant="caption" sx={{ 
                          display: 'block', 
                          mt: 1, 
                          opacity: 0.8,
                          fontSize: '0.75rem'
                        }}>
                          {(((analyticsData.metrics.lateDays || 0) / (analyticsData.metrics?.totalDays || 24)) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ 
                    background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)', 
                    color: 'white',
                    borderRadius: '20px',
                    boxShadow: '0 8px 32px rgba(244, 67, 54, 0.4)',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 12px 40px rgba(244, 67, 54, 0.5)'
                    }
                  }}>
                    <Box sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '100px',
                      height: '100px',
                      background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                      borderRadius: '50%',
                      transform: 'translate(30%, -30%)'
                    }} />
                    <CardContent sx={{ textAlign: 'center', p: 3, position: 'relative', zIndex: 1 }}>
                      <Cancel sx={{ fontSize: 48, mb: 2, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                      <Typography variant="h2" sx={{ fontWeight: '800', mb: 1, textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                        {analyticsData.metrics.halfDays || 0}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: '600', mb: 1 }}>
                        Half Days
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.85rem' }}>
                        out of {analyticsData.metrics?.totalDays || 24} days
                      </Typography>
                      <Box mt={2}>
                        <LinearProgress 
                          variant="determinate" 
                          value={((analyticsData.metrics.halfDays || 0) / (analyticsData.metrics?.totalDays || 24)) * 100}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: 'rgba(255,255,255,0.8)',
                              borderRadius: 3
                            }
                          }}
                        />
                        <Typography variant="caption" sx={{ 
                          display: 'block', 
                          mt: 1, 
                          opacity: 0.8,
                          fontSize: '0.75rem'
                        }}>
                          {(((analyticsData.metrics.halfDays || 0) / (analyticsData.metrics?.totalDays || 24)) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)', 
                    color: '#333',
                    border: '2px solid #e0e0e0',
                    borderRadius: '20px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2)'
                    }
                  }}>
                    <Box sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '100px',
                      height: '100px',
                      background: 'radial-gradient(circle, rgba(0,0,0,0.05) 0%, transparent 70%)',
                      borderRadius: '50%',
                      transform: 'translate(30%, -30%)'
                    }} />
                    <CardContent sx={{ textAlign: 'center', p: 3, position: 'relative', zIndex: 1 }}>
                      <AccessTime sx={{ fontSize: 48, mb: 2, color: '#666', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} />
                      <Typography variant="h2" sx={{ fontWeight: '800', mb: 1, color: '#333' }}>
                        {analyticsData.metrics.absentDays || 0}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: '600', mb: 1, color: '#333' }}>
                        Absent Days
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.7, fontSize: '0.85rem', color: '#666' }}>
                        out of {analyticsData.metrics?.totalDays || 24} days
                      </Typography>
                      <Box mt={2}>
                        <LinearProgress 
                          variant="determinate" 
                          value={((analyticsData.metrics.absentDays || 0) / (analyticsData.metrics?.totalDays || 24)) * 100}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: 'rgba(0,0,0,0.1)',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: '#666',
                              borderRadius: 3
                            }
                          }}
                        />
                        <Typography variant="caption" sx={{ 
                          display: 'block', 
                          mt: 1, 
                          opacity: 0.7,
                          fontSize: '0.75rem',
                          color: '#666'
                        }}>
                          {(((analyticsData.metrics.absentDays || 0) / (analyticsData.metrics?.totalDays || 24)) * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Additional Metrics */}
              <Grid container spacing={3} mb={4}>
                <Grid item xs={12} md={4}>
                  <Card sx={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    border: `2px solid ${COLORS.primary}30`,
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(211, 47, 47, 0.1)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(211, 47, 47, 0.15)'
                    }
                  }}>
                    <CardContent sx={{ textAlign: 'center', p: 3 }}>
                      <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={2}>
                        <Work sx={{ color: COLORS.primary, fontSize: 24 }} />
                        <Typography variant="h4" sx={{ 
                          color: COLORS.primary, 
                          fontWeight: '700'
                        }}>
                          {analyticsData.metrics?.averageWorkingHours ? formatHoursAsHrsDotMM(analyticsData.metrics.averageWorkingHours) : '0.00'}
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ 
                        color: COLORS.textSecondary,
                        fontWeight: '600'
                      }}>
                        Average Working Hours
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: COLORS.textSecondary,
                        opacity: 0.7,
                        display: 'block',
                        mt: 1
                      }}>
                        Per working day
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card sx={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    border: `2px solid ${COLORS.warning}30`,
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(255, 152, 0, 0.1)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(255, 152, 0, 0.15)'
                    }
                  }}>
                    <CardContent sx={{ textAlign: 'center', p: 3 }}>
                      <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={2}>
                        <Timer sx={{ color: COLORS.warning, fontSize: 24 }} />
                        <Typography variant="h4" sx={{ 
                          color: COLORS.warning, 
                          fontWeight: '700'
                        }}>
                          {analyticsData.metrics.averageLateMinutes.toFixed(0)}m
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ 
                        color: COLORS.textSecondary,
                        fontWeight: '600'
                      }}>
                        Average Late Minutes
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: COLORS.textSecondary,
                        opacity: 0.7,
                        display: 'block',
                        mt: 1
                      }}>
                        When arriving late
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card sx={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    border: `2px solid ${COLORS.info}30`,
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(33, 150, 243, 0.1)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(33, 150, 243, 0.15)'
                    }
                  }}>
                    <CardContent sx={{ textAlign: 'center', p: 3 }}>
                      <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={2}>
                        <Schedule sx={{ color: COLORS.info, fontSize: 24 }} />
                        <Typography variant="h4" sx={{ 
                          color: COLORS.info, 
                          fontWeight: '700'
                        }}>
                          {analyticsData.metrics.totalDays}
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ 
                        color: COLORS.textSecondary,
                        fontWeight: '600'
                      }}>
                        Working Days
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: COLORS.textSecondary,
                        opacity: 0.7,
                        display: 'block',
                        mt: 1
                      }}>
                        Out of {analyticsData.metrics?.totalDays || 24} total days
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Charts Tabs */}
              <Paper elevation={0} sx={{ 
                borderRadius: '16px',
                border: `2px solid ${COLORS.navy}20`,
                overflow: 'hidden',
                mb: 3
              }}>
                <Box sx={{ 
                  borderBottom: 1, 
                  borderColor: 'divider',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
                }}>
                  <Tabs 
                    value={tabValue} 
                    onChange={(e, newValue) => setTabValue(newValue)}
                    sx={{
                      '& .MuiTab-root': {
                        textTransform: 'none',
                        fontWeight: '600',
                        fontSize: '1rem',
                        minHeight: 60,
                        '&.Mui-selected': {
                          color: COLORS.primary,
                          backgroundColor: 'rgba(211, 47, 47, 0.1)'
                        }
                      },
                      '& .MuiTabs-indicator': {
                        backgroundColor: COLORS.primary,
                        height: 3
                      }
                    }}
                  >
                    <Tab label="📊 Overview" />
                    <Tab label="📈 Weekly Trends" />
                    <Tab label="📅 Monthly Trends" />
                  </Tabs>
                </Box>

                {/* Overview Tab - Pie Chart */}
                {tabValue === 0 && (
                  <Box p={4} sx={{ backgroundColor: 'white' }}>
                    <Box textAlign="center" mb={3}>
                      <Typography variant="h5" sx={{ 
                        color: COLORS.navy, 
                        fontWeight: '700',
                        mb: 1
                      }}>
                        📊 Attendance Distribution
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: COLORS.textSecondary,
                        opacity: 0.8
                      }}>
                        Visual breakdown of attendance patterns
                      </Typography>
                    </Box>
                    <Box height={400} position="relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pie}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                            stroke="#fff"
                            strokeWidth={2}
                          >
                            {pie.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value, name) => [value, name]}
                            labelStyle={{ color: COLORS.navy, fontWeight: '600' }}
                            contentStyle={{
                              backgroundColor: 'white',
                              border: `2px solid ${COLORS.primary}20`,
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                )}

                {/* Weekly Trends Tab */}
                {tabValue === 1 && (
                  <Box p={4} sx={{ backgroundColor: 'white' }}>
                    <Box textAlign="center" mb={3}>
                      <Typography variant="h5" sx={{ 
                        color: COLORS.navy, 
                        fontWeight: '700',
                        mb: 1
                      }}>
                        📈 Weekly Attendance Trends
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: COLORS.textSecondary,
                        opacity: 0.8
                      }}>
                        Last 8 weeks performance overview
                      </Typography>
                    </Box>
                    <Box height={400}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weekly} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="week" 
                            tick={{ fontSize: 12, fill: COLORS.textSecondary }}
                            axisLine={{ stroke: COLORS.navy + '40' }}
                          />
                          <YAxis 
                            tick={{ fontSize: 12, fill: COLORS.textSecondary }}
                            axisLine={{ stroke: COLORS.navy + '40' }}
                          />
                          <RechartsTooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: `2px solid ${COLORS.primary}20`,
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                            }}
                          />
                          <Legend 
                            wrapperStyle={{ paddingTop: '20px' }}
                          />
                          <Bar dataKey="onTime" stackId="a" fill={chartColors.onTime} name="On-time" radius={[0, 0, 4, 4]} />
                          <Bar dataKey="late" stackId="a" fill={chartColors.late} name="Late" radius={[0, 0, 4, 4]} />
                          <Bar dataKey="halfDay" stackId="a" fill={chartColors.halfDay} name="Half-day" radius={[0, 0, 4, 4]} />
                          <Bar dataKey="absent" stackId="a" fill={chartColors.absent} name="Absent" radius={[0, 0, 4, 4]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                )}

                {/* Monthly Trends Tab */}
                {tabValue === 2 && (
                  <Box p={4} sx={{ backgroundColor: 'white' }}>
                    <Box textAlign="center" mb={3}>
                      <Typography variant="h5" sx={{ 
                        color: COLORS.navy, 
                        fontWeight: '700',
                        mb: 1
                      }}>
                        📅 Monthly Attendance Trends
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        color: COLORS.textSecondary,
                        opacity: 0.8
                      }}>
                        Last 6 months performance analysis
                      </Typography>
                    </Box>
                    <Box height={400}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthly} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 12, fill: COLORS.textSecondary }}
                            axisLine={{ stroke: COLORS.navy + '40' }}
                          />
                          <YAxis 
                            tick={{ fontSize: 12, fill: COLORS.textSecondary }}
                            axisLine={{ stroke: COLORS.navy + '40' }}
                          />
                          <RechartsTooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: `2px solid ${COLORS.primary}20`,
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                            }}
                          />
                          <Legend 
                            wrapperStyle={{ paddingTop: '20px' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="onTime" 
                            stroke={chartColors.onTime} 
                            strokeWidth={3}
                            dot={{ fill: chartColors.onTime, strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: chartColors.onTime, strokeWidth: 2 }}
                            name="On-time" 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="late" 
                            stroke={chartColors.late} 
                            strokeWidth={3}
                            dot={{ fill: chartColors.late, strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: chartColors.late, strokeWidth: 2 }}
                            name="Late" 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="halfDay" 
                            stroke={chartColors.halfDay} 
                            strokeWidth={3}
                            dot={{ fill: chartColors.halfDay, strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: chartColors.halfDay, strokeWidth: 2 }}
                            name="Half-day" 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="absent" 
                            stroke={chartColors.absent} 
                            strokeWidth={3}
                            dot={{ fill: chartColors.absent, strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: chartColors.absent, strokeWidth: 2 }}
                            name="Absent" 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Box>

            {/* Attendance Logs Management - Admin Only */}
            {user && (user.role === 'Admin' || user.role === 'HR') && analyticsData?.logs && (
              <Paper elevation={0} sx={{ 
                p: 4, 
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderTop: `2px solid ${COLORS.navy}20`
              }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <Assessment sx={{ color: COLORS.primary, fontSize: 28 }} />
                  <Box>
                    <Typography variant="h5" sx={{ 
                      color: COLORS.navy, 
                      fontWeight: '700',
                      mb: 0.5
                    }}>
                      📅 Attendance Logs & Half-Day Management
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: COLORS.textSecondary,
                      fontWeight: '500'
                    }}>
                      Toggle half-day status for individual attendance logs
                    </Typography>
                  </Box>
                </Box>
                
                <Paper elevation={0} sx={{ 
                  maxHeight: '400px', 
                  overflow: 'auto',
                  border: `2px solid ${COLORS.primary}20`,
                  borderRadius: '16px',
                  backgroundColor: 'white',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    backgroundColor: 'white'
                  }}>
                    <thead style={{ 
                      position: 'sticky', 
                      top: 0, 
                      background: `linear-gradient(135deg, ${COLORS.navy} 0%, #3b82f6 100%)`,
                      color: 'white',
                      zIndex: 1,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                      <tr>
                        <th style={{ 
                          padding: '16px 12px', 
                          textAlign: 'left', 
                          borderBottom: `2px solid ${COLORS.primary}`,
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          📅 Date
                        </th>
                        <th style={{ 
                          padding: '16px 12px', 
                          textAlign: 'left', 
                          borderBottom: `2px solid ${COLORS.primary}`,
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          📊 Status
                        </th>
                        <th style={{ 
                          padding: '16px 12px', 
                          textAlign: 'center', 
                          borderBottom: `2px solid ${COLORS.primary}`,
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          ⏰ Clock In
                        </th>
                        <th style={{ 
                          padding: '16px 12px', 
                          textAlign: 'center', 
                          borderBottom: `2px solid ${COLORS.primary}`,
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          ⏰ Clock Out
                        </th>
                        <th style={{ 
                          padding: '16px 12px', 
                          textAlign: 'center', 
                          borderBottom: `2px solid ${COLORS.primary}`,
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          ⏱️ Hours
                        </th>
                        <th style={{ 
                          padding: '16px 12px', 
                          textAlign: 'center', 
                          borderBottom: `2px solid ${COLORS.primary}`,
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          🔄 Half-Day
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.logs.slice().reverse().map((log, index) => (
                        <tr 
                          key={log._id} 
                          style={{ 
                            borderBottom: `1px solid ${COLORS.navy}10`,
                            transition: 'all 0.2s ease',
                            backgroundColor: index % 2 === 0 ? 'white' : '#fafafa'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = COLORS.cardHover;
                            e.currentTarget.style.transform = 'scale(1.01)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#fafafa';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <td style={{ padding: '16px 12px' }}>
                            <Typography variant="body2" sx={{ 
                              fontWeight: '600',
                              color: COLORS.textPrimary
                            }}>
                              {new Date(log.attendanceDate).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </Typography>
                          </td>
                          <td style={{ padding: '16px 12px' }}>
                            <Chip 
                              label={log.attendanceStatus || 'N/A'}
                              size="small"
                              sx={{ 
                                backgroundColor: getStatusColor(log.attendanceStatus),
                                color: 'white',
                                fontWeight: '600',
                                borderRadius: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                              }}
                            />
                          </td>
                          <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ 
                              fontWeight: '500',
                              color: COLORS.textPrimary
                            }}>
                              {log.clockInTime ? new Date(log.clockInTime).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              }) : '-'}
                            </Typography>
                          </td>
                          <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ 
                              fontWeight: '500',
                              color: COLORS.textPrimary
                            }}>
                              {log.clockOutTime ? new Date(log.clockOutTime).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              }) : '-'}
                            </Typography>
                          </td>
                          <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ 
                              fontWeight: '600',
                              color: COLORS.primary
                            }}>
                              {log.totalWorkingHours ? formatHoursAsHrsDotMM(log.totalWorkingHours) : '-'}
                            </Typography>
                          </td>
                          <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                            <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                              <Tooltip title={log.isHalfDay ? "Mark as full day" : "Mark as half day"}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleToggleHalfDay(log._id, log.isHalfDay)}
                                  disabled={updatingHalfDay === log._id}
                                  sx={{
                                    color: log.isHalfDay ? COLORS.error : COLORS.textSecondary,
                                    backgroundColor: log.isHalfDay ? `${COLORS.error}10` : `${COLORS.navy}10`,
                                    borderRadius: '8px',
                                    '&:hover': {
                                      backgroundColor: log.isHalfDay ? `${COLORS.error}20` : `${COLORS.navy}20`,
                                      transform: 'scale(1.1)'
                                    },
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  {updatingHalfDay === log._id ? (
                                    <CircularProgress size={20} />
                                  ) : log.isHalfDay ? (
                                    <ToggleOn fontSize="medium" />
                                  ) : (
                                    <ToggleOff fontSize="medium" />
                                  )}
                                </IconButton>
                              </Tooltip>
                              <Typography variant="caption" sx={{ 
                                color: log.isHalfDay ? COLORS.error : COLORS.textSecondary,
                                fontWeight: log.isHalfDay ? '700' : '500',
                                fontSize: '0.75rem'
                              }}>
                                {log.isHalfDay ? 'Half Day' : 'Full Day'}
                              </Typography>
                            </Box>
                          </td>
                        </tr>
                      ))}
                      {analyticsData.logs.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '24px', textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                              No attendance logs found for this period
                            </Typography>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Paper>
              </Paper>
            )}
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ 
        p: 3, 
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        borderTop: `2px solid ${COLORS.navy}20`
      }}>
        <Button 
          onClick={onClose} 
          variant="outlined"
          sx={{
            borderColor: COLORS.primary,
            color: COLORS.primary,
            borderRadius: '8px',
            px: 3,
            py: 1.5,
            fontWeight: '600',
            textTransform: 'none',
            '&:hover': {
              borderColor: COLORS.primary,
              backgroundColor: `${COLORS.primary}10`,
              transform: 'translateY(-1px)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Close
        </Button>
        <Button 
          onClick={fetchEmployeeAnalytics} 
          variant="contained" 
          startIcon={<Refresh />}
          sx={{ 
            backgroundColor: COLORS.primary,
            borderRadius: '8px',
            px: 3,
            py: 1.5,
            fontWeight: '600',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: COLORS.primary,
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Refresh Data
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmployeeAnalyticsModal;
