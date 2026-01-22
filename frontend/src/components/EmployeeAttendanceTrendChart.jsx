// frontend/src/components/EmployeeAttendanceTrendChart.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Card, CardContent, Typography, Grid, FormControl, InputLabel, Select, MenuItem, Chip, IconButton, Tooltip, Alert } from '@mui/material';
import {
  TrendingUp,
  FilterList,
  Refresh,
  CalendarToday,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import axios from '../api/axios';

import { SkeletonBox } from '../components/SkeletonLoaders';
// Color scheme for attendance statuses
const ATTENDANCE_COLORS = {
  present: '#4CAF50',      // Green
  late: '#FFC107',         // Yellow/Orange
  halfDay: '#FF9800',      // Orange
  absent: '#F44336',       // Red
  leave: '#9C27B0',        // Purple
  nonWorking: '#000000'    // Black for holidays, Sundays, and day-offs
};

const COLORS = {
  primary: '#dc3545',
  secondary: '#ffffff',
  background: '#f8f9fa',
  textPrimary: '#343a40',
  textSecondary: '#6c757d',
  borderColor: '#dee2e6',
  navy: '#2c3e50',
  cardHover: '#f1f3f4'
};

const EmployeeAttendanceTrendChart = ({ user, employeeData, startDate, endDate, onRangeChange, filterPeriod: externalFilterPeriod, onFilterPeriodChange }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filterPeriod, setFilterPeriod] = useState(externalFilterPeriod || 'currentMonth');
  const [customStartDate, setCustomStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [visibleLines, setVisibleLines] = useState({
    present: true,
    late: true,
    halfDay: true,
    absent: true,
    leave: true,
    nonWorking: true
  });
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);

  // Fetch holidays and leaves data
  const fetchHolidaysAndLeaves = async () => {
    try {
      const [holidaysRes, leavesRes] = await Promise.all([
        axios.get('/leaves/holidays'),
        axios.get('/leaves/my-requests')
      ]);
      setHolidays(Array.isArray(holidaysRes.data) ? holidaysRes.data : []);
      setLeaves(Array.isArray(leavesRes.data) ? leavesRes.data : []);
    } catch (err) {
      console.error('Error fetching holidays and leaves:', err);
      // Continue with empty arrays if fetch fails
      setHolidays([]);
      setLeaves([]);
    }
  };

  const dateKey = useCallback((date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Precompute lookups to speed up classification
  const holidaySet = useMemo(() => {
    if (!Array.isArray(holidays)) return new Set();
    // Filter out tentative holidays before creating set
    return new Set(
      holidays
        .filter(h => h.date && !h.isTentative)
        .map(h => {
          const d = new Date(h.date);
          return isNaN(d.getTime()) ? null : dateKey(d);
        })
        .filter(key => key !== null)
    );
  }, [holidays, dateKey]);

  const leaveMap = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(leaves)) return map;
    leaves.forEach(leave => {
      if (leave.status !== 'Approved') return;
      (leave.leaveDates || []).forEach(ld => {
        map.set(dateKey(new Date(ld)), leave);
      });
    });
    return map;
  }, [leaves, dateKey]);

  // Helper function to check if a date is a holiday
  const getHolidayForDate = (date) => holidaySet.has(dateKey(date));

  // Helper function to check if a date is a leave (returns leave object for status logic)
  const getLeaveForDate = (date) => leaveMap.get(dateKey(date));

  // Helper function to check if a date is a day-off (Sunday or Saturday based on policy)
  const isDayOff = (date) => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Always consider Sunday as day-off
    if (dayOfWeek === 0) return true;
    
    // Check Saturday policy
    if (dayOfWeek === 6) {
      const saturdayPolicy = user?.alternateSaturdayPolicy || 'All Saturdays Working';
      const weekNum = Math.ceil(date.getDate() / 7);
      
      if (saturdayPolicy === 'All Saturdays Off') {
        return true;
      } else if (saturdayPolicy === 'Week 1 & 3 Off' && (weekNum === 1 || weekNum === 3)) {
        return true;
      } else if (saturdayPolicy === 'Week 2 & 4 Off' && (weekNum === 2 || weekNum === 4)) {
        return true;
      }
    }
    
    return false;
  };

  const computeRange = useCallback(() => {
    const now = new Date();
    const floor = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let start;
    let end;

    switch (filterPeriod) {
      case 'currentMonth':
        start = floor(new Date(now.getFullYear(), now.getMonth(), 1));
        end = floor(now);
        break;
      case 'lastMonth': {
        const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        start = floor(s);
        end = floor(new Date(now.getFullYear(), now.getMonth(), 0));
        break;
      }
      case 'last3Months':
        start = floor(new Date(now.getFullYear(), now.getMonth() - 3, 1));
        end = floor(now);
        break;
      case 'last6Months':
        start = floor(new Date(now.getFullYear(), now.getMonth() - 6, 1));
        end = floor(now);
        break;
      case 'custom':
        start = floor(customStartDate || new Date());
        end = floor(customEndDate || new Date());
        break;
      default:
        start = floor(new Date(now.getFullYear(), now.getMonth(), 1));
        end = floor(now);
    }
    return { start, end };
  }, [filterPeriod, customStartDate, customEndDate]);

  // Fetch attendance data
  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Determine date range based on filter (normalized to local midnight)
      const { start, end } = computeRange();

      // Notify parent immediately so cards update without waiting for network
      if (onRangeChange) {
        onRangeChange({ start, end, period: filterPeriod, customStartDate, customEndDate });
      }

      // Fetch holidays and leaves data first
      await fetchHolidaysAndLeaves();

      // Fetch employee attendance data - fix timezone issues
      const formatDateForAPI = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const response = await axios.get(`/analytics/employee/${user.id}`, {
        params: {
          startDate: formatDateForAPI(start),
          endDate: formatDateForAPI(end)
        }
      });

      if (response.data && response.data.logs) {
        // Process the data into daily attendance records
        const processedData = processAttendanceData(response.data.logs, start, end);
        setAttendanceData(processedData);
        setFilteredData(processedData);
      } else {
        // No data available
        setAttendanceData([]);
        setFilteredData([]);
        setError('No data available for the selected period');
      }

      // Range already notified before fetch

    } catch (err) {
      console.error('Error fetching attendance data:', err);
      setError('Failed to load attendance data');
      setAttendanceData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  // Process real attendance data into chart format
  const processAttendanceData = (logs, startDate, endDate) => {
    const dataMap = new Map();
    
    // Get employee joining date to avoid showing data before joining
    const joiningDate = user?.joiningDate ? new Date(user.joiningDate) : null;
    if (joiningDate) {
      joiningDate.setHours(0, 0, 0, 0);
    }
    
    // Initialize all dates in range - fix timezone issues
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    // Set time to avoid timezone issues
    current.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    while (current <= end) {
      // Skip dates before employee joining date
      if (joiningDate && current < joiningDate) {
        current.setDate(current.getDate() + 1);
        continue;
      }
      
      // Use local date formatting to avoid timezone conversion
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Check for holidays, leaves, and day-offs first
      const holiday = getHolidayForDate(current);
      const leave = getLeaveForDate(current);
      const isNonWorkingDay = isDayOff(current);
      
      // Determine default status based on day type
      let defaultStatus = { present: 0, late: 0, halfDay: 0, absent: 0, leave: 0, nonWorking: 0 };
      
      if (holiday || isNonWorkingDay) {
        // Mark as non-working day (holiday or day-off)
        defaultStatus.nonWorking = 1;
      } else if (leave) {
        // Mark as leave
        defaultStatus.leave = 1;
      } else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // For weekdays (Monday-Friday), default to absent if no log
        defaultStatus.absent = 1;
      }
      // For weekends that are working days, don't mark as absent by default
      
      dataMap.set(dateStr, {
        date: dateStr,
        displayDate: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...defaultStatus
      });
      current.setDate(current.getDate() + 1);
    }

    // Process actual attendance logs - if log exists, employee was present
    logs.forEach(log => {
      // Fix: Use the attendanceDate directly if it's already in YYYY-MM-DD format
      // to avoid timezone conversion issues
      const dateStr = typeof log.attendanceDate === 'string' && log.attendanceDate.includes('-') 
        ? log.attendanceDate 
        : new Date(log.attendanceDate).toISOString().split('T')[0];
      if (dataMap.has(dateStr)) {
        const dayData = dataMap.get(dateStr);
        const logDate = new Date(log.attendanceDate);
        
        // Check if this is a non-working day
        const holiday = getHolidayForDate(logDate);
        const leave = getLeaveForDate(logDate);
        const isNonWorkingDay = isDayOff(logDate);
        
        // If it's a non-working day, keep it as non-working regardless of attendance log
        if (holiday || isNonWorkingDay) {
          dayData.nonWorking = 1;
          dayData.present = 0;
          dayData.late = 0;
          dayData.halfDay = 0;
          dayData.absent = 0;
          dayData.leave = 0;
        } else if (leave) {
          // If it's a leave day, keep it as leave
          dayData.leave = 1;
          dayData.present = 0;
          dayData.late = 0;
          dayData.halfDay = 0;
          dayData.absent = 0;
          dayData.nonWorking = 0;
        } else {
          // Reset non-working status since we have an attendance log for a working day
          dayData.nonWorking = 0;
          dayData.absent = 0;
          
          // FIXED: If employee has clockInTime, they cannot be absent
          if (log.clockInTime) {
            // Employee was present, determine correct status
            switch (log.attendanceStatus) {
              case 'On-time':
                dayData.present = 1;
                break;
              case 'Late':
                dayData.late = 1;
                break;
              case 'Half-day':
                dayData.halfDay = 1;
                break;
              case 'Absent':
                // FIXED: If they have clockInTime but status is Absent, treat as Present
                console.warn(`Employee has clockInTime but status is Absent for ${dateStr}. Treating as Present.`);
                dayData.present = 1;
                break;
              default:
                // Check if it's a leave
                if (log.leaveType) {
                  dayData.leave = 1;
                } else {
                  dayData.present = 1;
                }
            }
          } else {
            // No clock-in time in the log means truly absent
            dayData.absent = 1;
          }
        }
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Update data and propagate range when filter changes
  useEffect(() => {
    // Propagate range immediately (even before fetch completes)
    if (onRangeChange) {
      const { start, end } = computeRange();
      onRangeChange({ start, end, period: filterPeriod, customStartDate, customEndDate });
    }
    fetchAttendanceData();
  }, [filterPeriod, customStartDate, customEndDate, computeRange, onRangeChange]);

  const handleFilterChange = (event) => {
    const next = event.target.value;
    setFilterPeriod(next);
    if (onFilterPeriodChange) onFilterPeriodChange(next);
  };

  // Keep internal period in sync with parent-controlled value (if provided)
  useEffect(() => {
    if (externalFilterPeriod && externalFilterPeriod !== filterPeriod) {
      setFilterPeriod(externalFilterPeriod);
    }
  }, [externalFilterPeriod, filterPeriod]);

  const lineAnimationProps = useMemo(() => ({
    isAnimationActive: true,
    animationDuration: 800,
    animationEasing: 'ease-in-out'
  }), []);

  const toggleLineVisibility = (lineType) => {
    setVisibleLines(prev => ({
      ...prev,
      [lineType]: !prev[lineType]
    }));
  };

  const getFilterLabel = () => {
    switch (filterPeriod) {
      case 'currentMonth':
        return 'Current Month';
      case 'lastMonth':
        return 'Last Month';
      case 'last3Months':
        return 'Last 3 Months';
      case 'last6Months':
        return 'Last 6 Months';
      case 'custom':
        return 'Custom Range';
      default:
        return 'Current Month';
    }
  };

  if (loading) {
    return (
      <Card sx={{ 
        backgroundColor: COLORS.secondary,
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        border: `1px solid ${COLORS.borderColor}`
      }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <SkeletonBox width="24px" height="24px" borderRadius="50%" />
          <Typography variant="body1" sx={{ mt: 2, color: COLORS.textSecondary }}>
            Loading attendance data...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Card sx={{ 
        backgroundColor: COLORS.secondary,
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        border: `1px solid ${COLORS.borderColor}`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
        }
      }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header with Title and Controls */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 3,
            flexWrap: 'wrap',
            gap: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarToday sx={{ color: COLORS.primary, fontSize: 28 }} />
              <Typography variant="h5" sx={{ 
                color: COLORS.navy, 
                fontWeight: 'bold'
              }}>
                My Attendance Trend
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Time Period</InputLabel>
                <Select
                  value={filterPeriod}
                  onChange={handleFilterChange}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: COLORS.borderColor
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: COLORS.primary
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: COLORS.primary
                    }
                  }}
                >
                  <MenuItem value="currentMonth">Current Month</MenuItem>
                  <MenuItem value="lastMonth">Last Month</MenuItem>
                  <MenuItem value="last3Months">Last 3 Months</MenuItem>
                  <MenuItem value="last6Months">Last 6 Months</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                </Select>
              </FormControl>
              
              <Tooltip title="Refresh Data">
                <IconButton 
                  onClick={fetchAttendanceData}
                  sx={{ 
                    color: COLORS.primary,
                    '&:hover': {
                      backgroundColor: `${COLORS.primary}10`
                    }
                  }}
                >
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Custom Date Range Controls */}
          {filterPeriod === 'custom' && (
            <Box sx={{ mb: 3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={customStartDate}
                  onChange={(date) => setCustomStartDate(date)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: {
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: COLORS.borderColor
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: COLORS.primary
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: COLORS.primary
                        }
                      }
                    }
                  }}
                />
              </LocalizationProvider>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={customEndDate}
                  onChange={(date) => setCustomEndDate(date)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: {
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: COLORS.borderColor
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: COLORS.primary
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: COLORS.primary
                        }
                      }
                    }
                  }}
                />
              </LocalizationProvider>
            </Box>
          )}


          {/* Chart Container */}
          <Box sx={{ 
            position: 'relative',
            height: '400px',
            width: '100%',
            mb: 3
          }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderColor} />
                <XAxis 
                  dataKey="displayDate" 
                  stroke={COLORS.textSecondary}
                  fontSize={12}
                />
                <YAxis 
                  stroke={COLORS.textSecondary}
                  domain={[0, 1]}
                  tick={{ fontSize: 12 }}
                />
                <RechartsTooltip 
                  contentStyle={{
                    backgroundColor: COLORS.secondary,
                    border: `1px solid ${COLORS.borderColor}`,
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value, name) => [value === 1 ? 'Yes' : 'No', name]}
                />
                <Legend />
                
                {/* Attendance Status Lines */}
                {visibleLines.present && (
                  <Line 
                    type="monotone" 
                    dataKey="present" 
                    stroke={ATTENDANCE_COLORS.present} 
                    strokeWidth={3}
                    name="Present"
                    dot={{ fill: ATTENDANCE_COLORS.present, strokeWidth: 2, r: 4 }}
                    {...lineAnimationProps}
                  />
                )}
                {visibleLines.late && (
                  <Line 
                    type="monotone" 
                    dataKey="late" 
                    stroke={ATTENDANCE_COLORS.late} 
                    strokeWidth={3}
                    name="Late"
                    dot={{ fill: ATTENDANCE_COLORS.late, strokeWidth: 2, r: 4 }}
                    {...lineAnimationProps}
                  />
                )}
                {visibleLines.halfDay && (
                  <Line 
                    type="monotone" 
                    dataKey="halfDay" 
                    stroke={ATTENDANCE_COLORS.halfDay} 
                    strokeWidth={3}
                    name="Half-day"
                    dot={{ fill: ATTENDANCE_COLORS.halfDay, strokeWidth: 2, r: 4 }}
                    {...lineAnimationProps}
                  />
                )}
                {visibleLines.absent && (
                  <Line 
                    type="monotone" 
                    dataKey="absent" 
                    stroke={ATTENDANCE_COLORS.absent} 
                    strokeWidth={3}
                    name="Absent"
                    dot={{ fill: ATTENDANCE_COLORS.absent, strokeWidth: 2, r: 4 }}
                    {...lineAnimationProps}
                  />
                )}
                {visibleLines.leave && (
                  <Line 
                    type="monotone" 
                    dataKey="leave" 
                    stroke={ATTENDANCE_COLORS.leave} 
                    strokeWidth={3}
                    name="Leave"
                    dot={{ fill: ATTENDANCE_COLORS.leave, strokeWidth: 2, r: 4 }}
                    {...lineAnimationProps}
                  />
                )}
                {visibleLines.nonWorking && (
                  <Line 
                    type="monotone" 
                    dataKey="nonWorking" 
                    stroke={ATTENDANCE_COLORS.nonWorking} 
                    strokeWidth={3}
                    name="Non-Working Days"
                    dot={{ fill: ATTENDANCE_COLORS.nonWorking, strokeWidth: 2, r: 4 }}
                    {...lineAnimationProps}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </Box>

          {/* Legend Controls */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 1, 
            flexWrap: 'wrap',
            mb: 2
          }}>
            {Object.entries(ATTENDANCE_COLORS).map(([status, color]) => {
              // Customize label for nonWorking
              const label = status === 'nonWorking' ? 'Non-Working Days' : 
                           status === 'halfDay' ? 'Half-day' :
                           status.charAt(0).toUpperCase() + status.slice(1);
              
              return (
                <Chip
                  key={status}
                  icon={visibleLines[status] ? <CheckCircle /> : <Cancel />}
                  label={label}
                  onClick={() => toggleLineVisibility(status)}
                  sx={{
                    backgroundColor: visibleLines[status] ? color : COLORS.background,
                    color: visibleLines[status] ? 'white' : COLORS.textSecondary,
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8
                    }
                  }}
                />
              );
            })}
          </Box>

          {/* Period Information */}
          <Typography variant="body2" sx={{ 
            textAlign: 'center', 
            color: COLORS.textSecondary,
            fontStyle: 'italic'
          }}>
            Showing data for {getFilterLabel()} ({filteredData.length} days)
            {user?.joiningDate && (
              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.85em' }}>
                Employee joined on {new Date(user.joiningDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            )}
          </Typography>

          {error && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {error} - Showing sample data for demonstration.
            </Alert>
          )}
        </CardContent>
      </Card>
    </LocalizationProvider>
  );
};

export default EmployeeAttendanceTrendChart;
