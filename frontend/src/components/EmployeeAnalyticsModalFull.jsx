// frontend/src/components/EmployeeAnalyticsModalFull.jsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Alert, Card, CardContent, Grid, FormControl, InputLabel, Select, MenuItem, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, ToggleButton, ToggleButtonGroup, Divider, Avatar, List, ListItem, ListItemText, Stack } from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Person,
  AccessTime,
  EventAvailable,
  EventBusy,
  Warning,
  CheckCircle,
  Cancel,
  Coffee,
  CalendarToday,
  Close
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { SkeletonBox } from '../components/SkeletonLoaders';
const EmployeeAnalyticsModalFull = ({ open, onClose, employeeId, employeeName }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [chartView, setChartView] = useState('weekly'); // 'weekly' or 'monthly'
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState(new Date());

  const fetchEmployeeAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const formatISTDateForAPI = (date) => {
        const dtf = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        return dtf.format(date);
      };

      const start = formatISTDateForAPI(startDate);
      const end = formatISTDateForAPI(endDate);
      
      console.log(`Fetching analytics for employee ${employeeId} from ${start} to ${end}`);
      
      const response = await axios.get(`/analytics/employee/${employeeId}?startDate=${start}&endDate=${end}`);
      
      console.log('Analytics response:', response.data);
      
      if (response.data) {
        setAnalyticsData(response.data);
      } else {
        setError('No data received from server');
      }
    } catch (error) {
      console.error('Error fetching employee analytics:', error);
      console.error('Error details:', error.response?.data || error.message);
      setError(`Failed to fetch employee analytics: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && employeeId) {
      fetchEmployeeAnalytics();
    }
  }, [open, employeeId, startDate, endDate]);

  // Helper functions
  const getStatusColor = (status) => {
    const colors = {
      'On-time': '#4CAF50',
      'Present': '#4CAF50',
      'Late': '#FF9800',
      'Half-day': '#FFC107',
      'Absent': '#F44336',
      'Leave': '#9C27B0'
    };
    return colors[status] || '#757575';
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const date = new Date(timeString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}.${minutes}`;
  };

  const formatDuration = (minutes) => {
    if (!minutes || isNaN(minutes)) return '0.00';
    const hours = minutes / 60;
    const wholeHours = Math.floor(hours);
    const mins = Math.round((hours - wholeHours) * 60);
    return `${String(wholeHours).padStart(2, '0')}.${String(mins).padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (!analyticsData || !analyticsData.charts) return [];
    
    if (chartView === 'weekly') {
      return analyticsData.charts.weekly || [];
    } else {
      return analyticsData.charts.monthly || [];
    }
  };

  // Calculate weekly statistics
  const calculateWeeklyStats = () => {
    if (!analyticsData || !analyticsData.logs) return [];
    
    const weeklyStats = {};
    
    analyticsData.logs.forEach(log => {
      const date = new Date(log.attendanceDate);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      
      if (!weeklyStats[weekKey]) {
        weeklyStats[weekKey] = {
          week: formatDate(weekKey),
          present: 0,
          late: 0,
          absent: 0,
          breaks: 0,
          totalHours: 0
        };
      }
      
      if (log.clockInTime) {
        if (log.isLate) weeklyStats[weekKey].late++;
        else weeklyStats[weekKey].present++;
      } else {
        weeklyStats[weekKey].absent++;
      }
      
      weeklyStats[weekKey].breaks += (log.breaks?.length || 0);
      weeklyStats[weekKey].totalHours += (log.totalWorkingHours || 0);
    });
    
    return Object.values(weeklyStats);
  };

  if (!open) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xl" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(220, 53, 69, 0.3)',
          minHeight: '85vh',
          maxHeight: '92vh',
          overflow: 'hidden'
        }
      }}
    >
       <DialogTitle sx={{ 
         background: 'linear-gradient(135deg, #dc3545 0%, #b02a37 100%)',
         color: 'white',
         display: 'flex',
         alignItems: 'center',
         gap: 2.5,
         py: 4,
         px: 4,
         position: 'relative',
         overflow: 'hidden',
         '&::before': {
           content: '""',
           position: 'absolute',
           top: 0,
           right: 0,
           width: '200px',
           height: '200px',
           background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
           borderRadius: '50%',
           transform: 'translate(50%, -50%)'
         },
         '&::after': {
           content: '""',
           position: 'absolute',
           bottom: 0,
           left: 0,
           right: 0,
           height: '6px',
           background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.3) 100%)'
         }
       }}>
         <Box sx={{ position: 'relative', zIndex: 1 }}>
           <Avatar sx={{ 
             backgroundColor: 'rgba(255,255,255,0.25)', 
             width: 70, 
             height: 70,
             border: '4px solid rgba(255,255,255,0.4)',
             boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
           }}>
             <Person sx={{ fontSize: 36, color: 'white' }} />
           </Avatar>
         </Box>
         <Box flex={1} sx={{ position: 'relative', zIndex: 1 }}>
           <Typography variant="h4" fontWeight="bold" sx={{ 
             letterSpacing: '0.5px',
             textShadow: '0 2px 8px rgba(0,0,0,0.3)',
             mb: 1
           }}>
             {employeeName || 'Employee'} - Analytics Dashboard
           </Typography>
           <Typography variant="h6" sx={{ 
             opacity: 0.95, 
             fontWeight: 500,
             letterSpacing: '0.3px',
             textShadow: '0 1px 4px rgba(0,0,0,0.2)'
           }}>
             📊 Comprehensive attendance and performance analytics
           </Typography>
         </Box>
      </DialogTitle>

      <DialogContent sx={{ 
        backgroundColor: '#f8f9fa', 
        p: 3,
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          width: '8px'
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: '#f1f1f1',
          borderRadius: '10px'
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: '#dc3545',
          borderRadius: '10px',
          '&:hover': {
            backgroundColor: '#c82333'
          }
        }
      }}>
        {loading ? (
          <Box 
            display="flex" 
            flexDirection="column"
            justifyContent="center" 
            alignItems="center" 
            height="500px"
            gap={3}
          >
            <SkeletonBox width="70px" height="70px" borderRadius="50%" />
            <Typography variant="h6" sx={{ color: '#666', fontWeight: 500 }}>
              Loading Analytics Data...
            </Typography>
            <Typography variant="body2" sx={{ color: '#999' }}>
              Please wait while we fetch the employee's attendance records
            </Typography>
          </Box>
        ) : error ? (
          <Alert 
            severity="error" 
            sx={{ 
              borderRadius: '16px',
              border: '2px solid #F44336',
              boxShadow: '0 4px 20px rgba(244, 67, 54, 0.2)',
              '& .MuiAlert-icon': {
                fontSize: 32
              }
            }}
          >
            <Typography variant="h6" gutterBottom fontWeight="600">
              Error Loading Analytics
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {error}
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={fetchEmployeeAnalytics}
              sx={{
                backgroundColor: '#dc3545',
                '&:hover': { backgroundColor: '#c82333' }
              }}
            >
              Try Again
            </Button>
          </Alert>
        ) : analyticsData ? (
          <Box>
            {/* Date Range Filters */}
            <Card sx={{ 
              mb: 3, 
              borderRadius: '16px', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid rgba(220, 53, 69, 0.1)',
              overflow: 'hidden',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 30px rgba(220, 53, 69, 0.15)',
                transform: 'translateY(-2px)'
              }
            }}>
              <Box sx={{ 
                background: 'linear-gradient(90deg, rgba(220, 53, 69, 0.05) 0%, rgba(220, 53, 69, 0.02) 100%)',
                p: 2,
                borderBottom: '2px solid rgba(220, 53, 69, 0.1)'
              }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <CalendarToday sx={{ color: '#dc3545', fontSize: 24 }} />
                  <Typography variant="h6" fontWeight="600" sx={{ color: '#2c3e50' }}>
                    Filter & Analysis Options
                  </Typography>
                </Stack>
              </Box>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        label="Start Date"
                        value={startDate}
                        onChange={(newValue) => setStartDate(newValue)}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                            sx: {
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '10px',
                                '&:hover fieldset': {
                                  borderColor: '#dc3545'
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: '#dc3545'
                                }
                              }
                            }
                          }
                        }}
                      />
                    </LocalizationProvider>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        label="End Date"
                        value={endDate}
                        onChange={(newValue) => setEndDate(newValue)}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                            sx: {
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '10px',
                                '&:hover fieldset': {
                                  borderColor: '#dc3545'
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: '#dc3545'
                                }
                              }
                            }
                          }
                        }}
                      />
                    </LocalizationProvider>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <ToggleButtonGroup
                      value={chartView}
                      exclusive
                      onChange={(e, newView) => newView && setChartView(newView)}
                      fullWidth
                      size="small"
                      sx={{
                        '& .MuiToggleButton-root': {
                          borderRadius: '10px',
                          textTransform: 'none',
                          fontWeight: 600,
                          '&.Mui-selected': {
                            backgroundColor: '#dc3545',
                            color: 'white',
                            '&:hover': {
                              backgroundColor: '#c82333'
                            }
                          }
                        }
                      }}
                    >
                      <ToggleButton value="weekly">📅 Weekly</ToggleButton>
                      <ToggleButton value="monthly">📊 Monthly</ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={fetchEmployeeAnalytics}
                      startIcon={<CalendarToday />}
                      sx={{
                        backgroundColor: '#dc3545',
                        borderRadius: '10px',
                        py: 1.2,
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)',
                        '&:hover': { 
                          backgroundColor: '#c82333',
                          boxShadow: '0 6px 16px rgba(220, 53, 69, 0.4)',
                          transform: 'translateY(-1px)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Apply Filters
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

             {/* Summary Cards */}
             <Grid container spacing={4} sx={{ mb: 5 }}>
               <Grid item xs={12} sm={6} md={3}>
                 <Card sx={{ 
                   borderRadius: '20px', 
                   boxShadow: '0 12px 32px rgba(76, 175, 80, 0.3)',
                   background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                   color: 'white',
                   position: 'relative',
                   overflow: 'hidden',
                   transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                   '&:hover': {
                     transform: 'translateY(-12px) scale(1.02)',
                     boxShadow: '0 20px 48px rgba(76, 175, 80, 0.4)'
                   },
                   '&::before': {
                     content: '""',
                     position: 'absolute',
                     top: 0,
                     right: 0,
                     width: '120px',
                     height: '120px',
                     background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)',
                     borderRadius: '50%',
                     transform: 'translate(40%, -40%)'
                   }
                 }}>
                  <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={3}>
                      <Box sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        borderRadius: '18px',
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}>
                        <CheckCircle sx={{ fontSize: 42 }} />
                      </Box>
                      <Box flex={1}>
                        <Typography variant="h2" fontWeight="bold" sx={{ mb: 1, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                          {analyticsData.metrics?.onTimeDays || 0}
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                          ✅ Present Days
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

               <Grid item xs={12} sm={6} md={3}>
                 <Card sx={{ 
                   borderRadius: '20px', 
                   boxShadow: '0 12px 32px rgba(255, 152, 0, 0.3)',
                   background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                   color: 'white',
                   position: 'relative',
                   overflow: 'hidden',
                   transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                   '&:hover': {
                     transform: 'translateY(-12px) scale(1.02)',
                     boxShadow: '0 20px 48px rgba(255, 152, 0, 0.4)'
                   },
                   '&::before': {
                     content: '""',
                     position: 'absolute',
                     top: 0,
                     right: 0,
                     width: '120px',
                     height: '120px',
                     background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)',
                     borderRadius: '50%',
                     transform: 'translate(40%, -40%)'
                   }
                 }}>
                  <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={3}>
                      <Box sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        borderRadius: '18px',
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}>
                        <Warning sx={{ fontSize: 42 }} />
                      </Box>
                      <Box flex={1}>
                        <Typography variant="h2" fontWeight="bold" sx={{ mb: 1, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                          {analyticsData.metrics?.lateDays || 0}
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                          ⚠️ Late Days
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

               <Grid item xs={12} sm={6} md={3}>
                 <Card sx={{ 
                   borderRadius: '20px', 
                   boxShadow: '0 12px 32px rgba(255, 193, 7, 0.3)',
                   background: 'linear-gradient(135deg, #FFC107 0%, #FFA000 100%)',
                   color: 'white',
                   position: 'relative',
                   overflow: 'hidden',
                   transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                   '&:hover': {
                     transform: 'translateY(-12px) scale(1.02)',
                     boxShadow: '0 20px 48px rgba(255, 193, 7, 0.4)'
                   },
                   '&::before': {
                     content: '""',
                     position: 'absolute',
                     top: 0,
                     right: 0,
                     width: '120px',
                     height: '120px',
                     background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)',
                     borderRadius: '50%',
                     transform: 'translate(40%, -40%)'
                   }
                 }}>
                  <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={3}>
                      <Box sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        borderRadius: '18px',
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}>
                        <AccessTime sx={{ fontSize: 42 }} />
                      </Box>
                      <Box flex={1}>
                        <Typography variant="h2" fontWeight="bold" sx={{ mb: 1, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                          {analyticsData.metrics?.halfDays || 0}
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                          ⏰ Half Days
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  borderRadius: '20px', 
                  boxShadow: '0 12px 32px rgba(244, 67, 54, 0.3)',
                  background: 'linear-gradient(135deg, #F44336 0%, #D32F2F 100%)',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-12px) scale(1.02)',
                    boxShadow: '0 20px 48px rgba(244, 67, 54, 0.4)'
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '120px',
                    height: '120px',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)',
                    borderRadius: '50%',
                    transform: 'translate(40%, -40%)'
                  }
                }}>
                  <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={3}>
                      <Box sx={{ 
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        borderRadius: '18px',
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}>
                        <Cancel sx={{ fontSize: 42 }} />
                      </Box>
                      <Box flex={1}>
                        <Typography variant="h2" fontWeight="bold" sx={{ mb: 1, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                          {analyticsData.metrics?.absentDays || 0}
                        </Typography>
                        <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                          ❌ Absent Days
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

             {/* Charts */}
             <Grid container spacing={4} sx={{ mb: 5 }}>
               <Grid item xs={12} lg={6}>
                 <Card sx={{ 
                   borderRadius: '20px', 
                   boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                   border: '2px solid rgba(220, 53, 69, 0.15)',
                   overflow: 'hidden',
                   transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                   '&:hover': {
                     boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
                     transform: 'translateY(-8px)',
                     borderColor: 'rgba(220, 53, 69, 0.25)'
                   }
                 }}>
                  <Box sx={{ 
                    background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.08) 0%, rgba(220, 53, 69, 0.04) 100%)',
                    p: 3,
                    borderBottom: '3px solid rgba(220, 53, 69, 0.2)',
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent 0%, rgba(220, 53, 69, 0.3) 50%, transparent 100%)'
                    }
                  }}>
                    <Typography variant="h5" fontWeight="700" sx={{ 
                      color: '#2c3e50',
                      textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      letterSpacing: '0.3px'
                    }}>
                      📈 {chartView === 'weekly' ? 'Weekly' : 'Monthly'} Attendance Trend
                    </Typography>
                  </Box>
                   <CardContent sx={{ p: 3, backgroundColor: '#fafafa' }}>
                      <ResponsiveContainer width="100%" height={500}>
                        <LineChart data={prepareChartData()} margin={{ top: 30, right: 40, left: 40, bottom: 40 }}>
                          <defs>
                            <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#4CAF50" stopOpacity={0.1}/>
                            </linearGradient>
                            <linearGradient id="lateGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FF9800" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#FF9800" stopOpacity={0.1}/>
                            </linearGradient>
                            <linearGradient id="halfDayGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FFC107" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#FFC107" stopOpacity={0.1}/>
                            </linearGradient>
                            <linearGradient id="absentGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F44336" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#F44336" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" strokeWidth={1} />
                          <XAxis 
                            dataKey={chartView === 'weekly' ? 'week' : 'month'}
                            tick={{ fill: '#333', fontSize: 14, fontWeight: 600 }}
                            tickLine={{ stroke: '#666', strokeWidth: 2 }}
                            axisLine={{ stroke: '#666', strokeWidth: 2 }}
                            tickMargin={10}
                          />
                          <YAxis 
                            tick={{ fill: '#333', fontSize: 14, fontWeight: 600 }}
                            tickLine={{ stroke: '#666', strokeWidth: 2 }}
                            axisLine={{ stroke: '#666', strokeWidth: 2 }}
                            domain={[0, 'dataMax + 1']}
                            tickMargin={10}
                            label={{ value: 'Days', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#333', fontWeight: 700, fontSize: '16px' } }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)',
                              border: '2px solid #dc3545',
                              borderRadius: '16px',
                              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                              fontSize: '15px',
                              fontWeight: 600,
                              padding: '16px'
                            }}
                            labelStyle={{ color: '#333', fontWeight: 700, fontSize: '16px' }}
                            formatter={(value, name) => [`${value} days`, name]}
                          />
                          <Legend 
                            wrapperStyle={{ 
                              paddingTop: '30px', 
                              fontSize: '16px',
                              fontWeight: 600,
                              color: '#333'
                            }}
                            iconType="circle"
                            iconSize={12}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="onTime" 
                            name="Present" 
                            stroke="#4CAF50" 
                            strokeWidth={6}
                            dot={{ fill: '#4CAF50', stroke: '#4CAF50', strokeWidth: 3, r: 8 }}
                            activeDot={{ r: 12, stroke: '#4CAF50', strokeWidth: 4, fill: '#fff' }}
                            connectNulls={false}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="late" 
                            name="Late" 
                            stroke="#FF9800" 
                            strokeWidth={6}
                            dot={{ fill: '#FF9800', stroke: '#FF9800', strokeWidth: 3, r: 8 }}
                            activeDot={{ r: 12, stroke: '#FF9800', strokeWidth: 4, fill: '#fff' }}
                            connectNulls={false}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="halfDay" 
                            name="Half-day" 
                            stroke="#FFC107" 
                            strokeWidth={6}
                            dot={{ fill: '#FFC107', stroke: '#FFC107', strokeWidth: 3, r: 8 }}
                            activeDot={{ r: 12, stroke: '#FFC107', strokeWidth: 4, fill: '#fff' }}
                            connectNulls={false}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="absent" 
                            name="Absent" 
                            stroke="#F44336" 
                            strokeWidth={6}
                            dot={{ fill: '#F44336', stroke: '#F44336', strokeWidth: 3, r: 8 }}
                            activeDot={{ r: 12, stroke: '#F44336', strokeWidth: 4, fill: '#fff' }}
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                   </CardContent>
                </Card>
              </Grid>

               <Grid item xs={12} lg={6}>
                 <Card sx={{ 
                   borderRadius: '20px', 
                   boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                   border: '2px solid rgba(220, 53, 69, 0.15)',
                   overflow: 'hidden',
                   transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                   '&:hover': {
                     boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
                     transform: 'translateY(-8px)',
                     borderColor: 'rgba(220, 53, 69, 0.25)'
                   }
                 }}>
                   <Box sx={{ 
                     background: 'linear-gradient(135deg, rgba(220, 53, 69, 0.08) 0%, rgba(220, 53, 69, 0.04) 100%)',
                     p: 3,
                     borderBottom: '3px solid rgba(220, 53, 69, 0.2)',
                     position: 'relative',
                     '&::after': {
                       content: '""',
                       position: 'absolute',
                       bottom: 0,
                       left: 0,
                       right: 0,
                       height: '2px',
                       background: 'linear-gradient(90deg, transparent 0%, rgba(220, 53, 69, 0.3) 50%, transparent 100%)'
                     }
                   }}>
                     <Typography variant="h5" fontWeight="700" sx={{ 
                       color: '#2c3e50',
                       textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                       letterSpacing: '0.3px'
                     }}>
                       ⏱️ Average Working Hours
                     </Typography>
                   </Box>
                   <CardContent sx={{ p: 3, backgroundColor: '#fafafa' }}>
                      <ResponsiveContainer width="100%" height={500}>
                        <BarChart data={prepareChartData()} margin={{ top: 30, right: 40, left: 40, bottom: 40 }}>
                          <defs>
                            <linearGradient id="workingHoursGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2196F3" stopOpacity={1} />
                              <stop offset="50%" stopColor="#1976D2" stopOpacity={1} />
                              <stop offset="100%" stopColor="#1565C0" stopOpacity={1} />
                            </linearGradient>
                            <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.3"/>
                            </filter>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" strokeWidth={1} />
                          <XAxis 
                            dataKey={chartView === 'weekly' ? 'week' : 'month'}
                            tick={{ fill: '#333', fontSize: 14, fontWeight: 600 }}
                            tickLine={{ stroke: '#666', strokeWidth: 2 }}
                            axisLine={{ stroke: '#666', strokeWidth: 2 }}
                            tickMargin={10}
                          />
                          <YAxis 
                            tick={{ fill: '#333', fontSize: 14, fontWeight: 600 }}
                            tickLine={{ stroke: '#666', strokeWidth: 2 }}
                            axisLine={{ stroke: '#666', strokeWidth: 2 }}
                            domain={[0, 12]}
                            tickMargin={10}
                            label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#333', fontWeight: 700, fontSize: '16px' } }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(255, 255, 255, 0.98)',
                              border: '2px solid #dc3545',
                              borderRadius: '16px',
                              boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                              fontSize: '15px',
                              fontWeight: 600,
                              padding: '16px'
                            }}
                            labelStyle={{ color: '#333', fontWeight: 700, fontSize: '16px' }}
                            formatter={(value, name) => [`${value.toFixed(2)} hours`, 'Working Hours']}
                          />
                          <Legend 
                            wrapperStyle={{ 
                              paddingTop: '30px', 
                              fontSize: '16px',
                              fontWeight: 600,
                              color: '#333'
                            }}
                            iconType="circle"
                            iconSize={12}
                          />
                          <Bar 
                            dataKey="avgWorkingHours" 
                            name="Working Hours"
                            fill="url(#workingHoursGradient)"
                            radius={[12, 12, 0, 0]}
                            maxBarSize={100}
                            filter="url(#barShadow)"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                   </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Weekly Statistics */}
            <Card sx={{ 
              borderRadius: '16px', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid rgba(220, 53, 69, 0.1)',
              mb: 4,
              overflow: 'hidden'
            }}>
              <Box sx={{ 
                background: 'linear-gradient(90deg, rgba(220, 53, 69, 0.05) 0%, rgba(220, 53, 69, 0.02) 100%)',
                p: 2.5,
                borderBottom: '2px solid rgba(220, 53, 69, 0.1)'
              }}>
                <Typography variant="h6" fontWeight="600" sx={{ color: '#2c3e50' }}>
                  📊 Weekly Summary & Statistics
                </Typography>
              </Box>
              <CardContent sx={{ p: 0 }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ 
                        backgroundColor: 'rgba(220, 53, 69, 0.08)',
                        '& th': {
                          fontWeight: 700,
                          color: '#2c3e50',
                          fontSize: '0.9rem',
                          py: 2
                        }
                      }}>
                        <TableCell>Week Starting</TableCell>
                        <TableCell align="center">Present</TableCell>
                        <TableCell align="center">Late</TableCell>
                        <TableCell align="center">Absent</TableCell>
                        <TableCell align="center">Total Breaks</TableCell>
                        <TableCell align="center">Total Hours</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {calculateWeeklyStats().map((week, index) => (
                        <TableRow 
                          key={index} 
                          hover
                          sx={{
                            '&:hover': {
                              backgroundColor: 'rgba(220, 53, 69, 0.04)',
                              transform: 'scale(1.001)',
                              transition: 'all 0.2s ease'
                            },
                            borderBottom: '1px solid rgba(0,0,0,0.05)'
                          }}
                        >
                          <TableCell sx={{ fontWeight: 600, color: '#2c3e50' }}>
                            {week.week}
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={week.present} 
                              size="small" 
                              sx={{ 
                                backgroundColor: '#4CAF50', 
                                color: 'white',
                                fontWeight: 600,
                                minWidth: '40px'
                              }} 
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={week.late} 
                              size="small" 
                              sx={{ 
                                backgroundColor: '#FF9800', 
                                color: 'white',
                                fontWeight: 600,
                                minWidth: '40px'
                              }} 
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={week.absent} 
                              size="small" 
                              sx={{ 
                                backgroundColor: '#F44336', 
                                color: 'white',
                                fontWeight: 600,
                                minWidth: '40px'
                              }} 
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              icon={<Coffee sx={{ fontSize: 16 }} />}
                              label={week.breaks} 
                              size="small" 
                              sx={{ 
                                backgroundColor: '#2196F3', 
                                color: 'white',
                                fontWeight: 600,
                                minWidth: '50px'
                              }} 
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={formatDuration(week.totalHours * 60)} 
                              size="small" 
                              sx={{ 
                                backgroundColor: '#9C27B0', 
                                color: 'white',
                                fontWeight: 600,
                                minWidth: '60px'
                              }} 
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Daily Attendance Details */}
            <Card sx={{ 
              borderRadius: '16px', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid rgba(220, 53, 69, 0.1)',
              overflow: 'hidden'
            }}>
              <Box sx={{ 
                background: 'linear-gradient(90deg, rgba(220, 53, 69, 0.05) 0%, rgba(220, 53, 69, 0.02) 100%)',
                p: 2.5,
                borderBottom: '2px solid rgba(220, 53, 69, 0.1)'
              }}>
                <Typography variant="h6" fontWeight="600" sx={{ color: '#2c3e50' }}>
                  📅 Daily Attendance Log
                </Typography>
              </Box>
              <CardContent sx={{ p: 0 }}>
                <TableContainer sx={{ maxHeight: 450 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow sx={{ 
                        '& th': {
                          backgroundColor: 'rgba(220, 53, 69, 0.08)',
                          fontWeight: 700,
                          color: '#2c3e50',
                          fontSize: '0.9rem',
                          py: 2,
                          borderBottom: '2px solid rgba(220, 53, 69, 0.2)'
                        }
                      }}>
                        <TableCell>Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Clock In</TableCell>
                        <TableCell>Clock Out</TableCell>
                        <TableCell>Working Hours</TableCell>
                        <TableCell align="center">Breaks</TableCell>
                        <TableCell>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analyticsData.logs && analyticsData.logs.length > 0 ? (
                        analyticsData.logs.map((log, index) => (
                          <TableRow 
                            key={index} 
                            hover
                            sx={{
                              '&:hover': {
                                backgroundColor: 'rgba(220, 53, 69, 0.04)',
                                transition: 'all 0.2s ease'
                              },
                              borderBottom: '1px solid rgba(0,0,0,0.05)'
                            }}
                          >
                            <TableCell sx={{ fontWeight: 600, color: '#2c3e50' }}>
                              {formatDate(log.attendanceDate)}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={log.attendanceStatus || 'N/A'}
                                size="small"
                                sx={{
                                  backgroundColor: getStatusColor(log.attendanceStatus),
                                  color: 'white',
                                  fontWeight: 600,
                                  minWidth: '80px'
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 500, color: '#555' }}>
                              {formatTime(log.clockInTime)}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 500, color: '#555' }}>
                              {formatTime(log.clockOutTime)}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#2196F3' }}>
                              {formatDuration(log.totalWorkingHours * 60)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                icon={<Coffee sx={{ fontSize: 16 }} />}
                                label={log.breaks?.length || 0}
                                size="small"
                                sx={{ 
                                  backgroundColor: '#2196F3', 
                                  color: 'white',
                                  fontWeight: 600,
                                  minWidth: '50px'
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5}>
                                {log.isLate && (
                                  <Chip 
                                    label="Late" 
                                    size="small" 
                                    sx={{ 
                                      backgroundColor: '#FF9800', 
                                      color: 'white',
                                      fontWeight: 600
                                    }} 
                                  />
                                )}
                                {log.isHalfDay && (
                                  <Chip 
                                    label="Half-day" 
                                    size="small" 
                                    sx={{ 
                                      backgroundColor: '#FFC107', 
                                      color: 'white',
                                      fontWeight: 600
                                    }} 
                                  />
                                )}
                                {!log.isLate && !log.isHalfDay && log.clockInTime && (
                                  <Typography variant="caption" sx={{ color: '#999' }}>
                                    No remarks
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                            <Box>
                              <EventBusy sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
                              <Typography variant="h6" color="textSecondary">
                                No attendance data available
                              </Typography>
                              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                Try adjusting the date range filters
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        ) : (
          <Typography>No data available</Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ 
        background: 'linear-gradient(to top, #f8f9fa 0%, #ffffff 100%)',
        px: 3, 
        py: 2.5,
        borderTop: '1px solid rgba(220, 53, 69, 0.1)',
        gap: 2
      }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          size="large"
          startIcon={<Close />}
          sx={{
            borderColor: '#dc3545',
            color: '#dc3545',
            borderRadius: '10px',
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
            borderWidth: 2,
            '&:hover': {
              borderColor: '#c82333',
              backgroundColor: 'rgba(220, 53, 69, 0.04)',
              borderWidth: 2,
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(220, 53, 69, 0.2)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          Close
        </Button>
        <Button 
          onClick={fetchEmployeeAnalytics} 
          variant="contained"
          size="large"
          startIcon={<CalendarToday />}
          sx={{
            backgroundColor: '#dc3545',
            borderRadius: '10px',
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)',
            '&:hover': { 
              backgroundColor: '#c82333',
              transform: 'translateY(-1px)',
              boxShadow: '0 6px 16px rgba(220, 53, 69, 0.4)'
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

export default EmployeeAnalyticsModalFull;

