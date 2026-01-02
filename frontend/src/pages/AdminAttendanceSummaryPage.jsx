// src/pages/AdminAttendanceSummaryPage.jsx - Redesigned to match ZOHO design
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Typography, CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem, 
    IconButton, Tooltip, Snackbar, Avatar, Menu, ListItemIcon, ListItemText
} from '@mui/material';
import {
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    CalendarToday as CalendarTodayIcon,
    ViewList as ViewListIcon,
    ViewModule as ViewModuleIcon,
    CalendarMonth as CalendarMonthIcon,
    FilterList as FilterIcon,
    MoreVert as MoreVertIcon,
    People as PeopleIcon
} from '@mui/icons-material';
import api from '../api/axios';
import AttendanceTimeline from '../components/AttendanceTimeline';
import AttendanceCalendar from '../components/AttendanceCalendar';
import LogDetailModal from '../components/LogDetailModal';
import { normalizeDate, findLeaveForDate, findHolidayForDate } from '../utils/dateUtils';
import '../styles/AdminAttendanceSummaryPage.css';

const AdminAttendanceSummaryPage = () => {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingEmployees, setLoadingEmployees] = useState(true);
    const [error, setError] = useState('');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedHoliday, setSelectedHoliday] = useState(null);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });
    const [anchorEl, setAnchorEl] = useState(null);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [now, setNow] = useState(new Date());
    const [viewMode, setViewMode] = useState('timeline'); // 'timeline', 'list', or 'calendar'
    const [holidays, setHolidays] = useState([]);
    const [leaves, setLeaves] = useState([]);

    const selectedEmployeeObject = useMemo(() => {
        const employee = employees.find(emp => emp._id === selectedEmployeeId);
        if (employee) {
            console.log('Selected employee:', {
                name: employee.fullName,
                alternateSaturdayPolicy: employee.alternateSaturdayPolicy
            });
        }
        return employee;
    }, [employees, selectedEmployeeId]);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const { data } = await api.get('/admin/employees?all=true');
                // Filter to show only active employees
                const activeEmployees = Array.isArray(data) 
                    ? data.filter(emp => emp.isActive !== false) 
                    : [];
                setEmployees(activeEmployees);
            } catch (err) {
                setError('Failed to fetch employee list. Please try again.');
            } finally {
                setLoadingEmployees(false);
            }
        };
        fetchEmployees();
    }, []);

    // Continuous timer to update the 'now' state
    // TODO: Replace this local timer with useGlobalNow hook to reduce multiple timers
    // Example: const nowTimestamp = useGlobalNow(true); const now = new Date(nowTimestamp);
    useEffect(() => {
        const timerId = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    // Cleanup on unmount to prevent style leakage
    useEffect(() => {
        return () => {
            // Reset any potential global styles that might have been applied
            // This ensures clean state when navigating away from this page
            const body = document.body;
            if (body) {
                body.style.transform = '';
                body.style.zoom = '';
                body.style.maxWidth = '';
                body.style.width = '';
            }
            const html = document.documentElement;
            if (html) {
                html.style.transform = '';
                html.style.zoom = '';
                html.style.maxWidth = '';
                html.style.width = '';
            }
        };
    }, []);

    const fetchLogsForWeek = useCallback(async (date, employeeId) => {
        if (!employeeId) return;
        setLoading(true);
        setError('');
        try {
            let startDate, endDate;
            
            if (viewMode === 'calendar') {
                // For calendar view, fetch entire month
                const year = date.getFullYear();
                const month = date.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                startDate = firstDay.toLocaleDateString('en-CA');
                endDate = lastDay.toLocaleDateString('en-CA');
            } else {
                // For timeline/list view, fetch current week
                const start = new Date(date);
                start.setDate(start.getDate() - start.getDay());
                const end = new Date(start);
                end.setDate(end.getDate() + 6);
                startDate = start.toLocaleDateString('en-CA');
                endDate = end.toLocaleDateString('en-CA');
            }
            
            // Fetch attendance logs, holidays, and leaves in parallel
            const [logsRes, holidaysRes, leavesRes] = await Promise.all([
                api.get(`/admin/attendance/user/${employeeId}?startDate=${startDate}&endDate=${endDate}`),
                api.get('/leaves/holidays'),
                api.get('/admin/leaves/all') // Admin endpoint for all leave requests
            ]);
            
            const fetchedLogs = Array.isArray(logsRes.data) ? logsRes.data : [];
            const fetchedHolidays = Array.isArray(holidaysRes.data) ? holidaysRes.data : [];
            const allLeaves = Array.isArray(leavesRes.data.requests) ? leavesRes.data.requests : [];
            
            // Filter leaves for the selected employee and approved status
            const fetchedLeaves = allLeaves.filter(leave => {
                if (leave.status !== 'Approved') return false;
                // Handle both cases: employee as object with _id, or employee as string ID
                const employeeIdStr = String(employeeId);
                const leaveEmployeeId = leave.employee?._id ? String(leave.employee._id) : String(leave.employee);
                return leaveEmployeeId === employeeIdStr;
            });
            
            setHolidays(fetchedHolidays);
            setLeaves(fetchedLeaves);

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const processedLogs = fetchedLogs.map(log => {
                const logDate = new Date(log.attendanceDate);
                logDate.setHours(0, 0, 0, 0);

                if (logDate.getTime() < todayStart.getTime()) {
                    const updatedSessions = log.sessions.map(session => {
                        if (!session.endTime) {
                            return { ...session, endTime: session.startTime };
                        }
                        return session;
                    });
                    return { ...log, sessions: updatedSessions };
                }
                return log;
            });
            setLogs(processedLogs);

        } catch (err) {
            setError('Failed to fetch attendance summary for the selected employee.');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [viewMode]);

    useEffect(() => {
        if (selectedEmployeeId) {
            fetchLogsForWeek(currentDate, selectedEmployeeId);
        } else {
            setLogs([]);
        }
    }, [currentDate, selectedEmployeeId, fetchLogsForWeek]);

    const handleWeekChange = (direction) => {
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate);
            if (viewMode === 'calendar') {
                // For calendar view, navigate by month
                if (direction === 'prev') {
                    newDate.setMonth(newDate.getMonth() - 1);
                } else {
                    newDate.setMonth(newDate.getMonth() + 1);
                }
            } else {
                // For timeline/list view, navigate by week
                if (direction === 'prev') {
                    newDate.setDate(newDate.getDate() - 7);
                } else {
                    newDate.setDate(newDate.getDate() + 7);
                }
            }
            return newDate;
        });
    };
    
    const handleEmployeeChange = (event) => {
        setLogs([]);
        setSelectedEmployeeId(event.target.value);
    };

    const handleDayClick = (dayData) => {
        // Always open modal for any day click (even if no log, to show leave/holiday info)
        setSelectedLog(dayData.log || null);
        setSelectedDate(dayData.date);
        setSelectedHoliday(dayData.holiday || null);
        setSelectedLeave(dayData.leave || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedLog(null);
        setSelectedDate(null);
        setSelectedHoliday(null);
        setSelectedLeave(null);
    };

    const handleMoreMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
        setMoreMenuOpen(true);
    };

    const handleMoreMenuClose = () => {
        setAnchorEl(null);
        setMoreMenuOpen(false);
    };

    const handleMusterRollClick = () => {
        handleMoreMenuClose();
        window.location.href = '/employee-muster-roll';
    };

    /**
     * Save attendance log with proper error handling
     * Handles 400 Bad Request and other errors gracefully
     * Never crashes the application
     */
    const handleSaveLog = async (logId, updatedData) => {
        try {
            // Validate logId exists
            if (!logId) {
                throw new Error('Attendance log ID is missing. Cannot save changes.');
            }

            // Log request in development mode
            if (process.env.NODE_ENV === 'development') {
                console.log('📤 Saving attendance log:', {
                    logId,
                    sessionsCount: updatedData?.sessions?.length || 0,
                    breaksCount: updatedData?.breaks?.length || 0,
                    hasNotes: !!updatedData?.notes
                });
            }

            // Make API call
            await api.put(`/admin/attendance/log/${logId}`, updatedData);
            
            // Success - show success message and refresh data
            setSnackbar({ open: true, message: 'Log updated successfully!' });
            handleCloseModal();
            fetchLogsForWeek(currentDate, selectedEmployeeId); // Refresh data
        } catch (err) {
            // Extract error message safely - handle different error response structures
            let errorMessage = 'Failed to save changes. Please try again.';
            
            if (err?.response?.data) {
                // Backend returned structured error
                errorMessage = err.response.data.message || err.response.data.error || errorMessage;
            } else if (err?.message) {
                // Network error or other error with message
                errorMessage = err.message;
            }

            // Show error to user
            setError(errorMessage);
            setSnackbar({ 
                open: true, 
                message: errorMessage, 
                severity: 'error' 
            });
            
            // Log error for debugging (only in development)
            if (process.env.NODE_ENV === 'development') {
                console.error('❌ Failed to save attendance log:', {
                    logId,
                    error: err,
                    response: err?.response?.data,
                    status: err?.response?.status,
                    message: errorMessage
                });
            }
        }
    };

    const formatDateRange = (date) => {
        if (viewMode === 'calendar') {
            return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else {
            const start = new Date(date);
            start.setDate(start.getDate() - start.getDay());
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            const formatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
            return `${start.toLocaleDateString('en-GB', formatOptions)} - ${end.toLocaleDateString('en-GB', formatOptions)}`;
        }
    };

    // Use centralized date utilities (same as Employee view)
    const getHolidayForDate = (date) => findHolidayForDate(date, holidays);
    const getLeaveForDate = (date) => findLeaveForDate(date, leaves);


    // Format attendance data for admin list view
    const formatAdminAttendanceDataForList = () => {
        if (!logs || logs.length === 0) return [];
        
        // Generate week days for the current week
        const startDate = new Date(currentDate);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday
        
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            weekDays.push(date);
        }
        
        return weekDays.map(date => {
            const dateKey = date.toISOString().split('T')[0];
            const log = logs.find(l => l.attendanceDate === dateKey);
            
            const dateString = date.toLocaleDateString('en-GB', { 
                weekday: 'short', 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            }).replace(/,/g, '');
            
            let firstIn = '-';
            let lastOut = '-';
            let totalHours = '-';
            let paidBreak = '00:00';
            let unpaidBreak = '00:00';
            let payableHours = '-';
            let status = 'Absent';
            let statusColor = '#ff6b6b';
            let shift = selectedEmployeeObject?.shiftGroup?.shiftName || 'Morning';
            
            // UNIFIED RESOLUTION: Trust backend's resolved status first (from attendanceStatusResolver)
            // The backend now returns fully resolved status that considers holidays, leaves, weekends, etc.
            if (log && log.attendanceStatus) {
                // Backend has already resolved the status - use it directly
                const resolvedStatus = log.attendanceStatus;
                
                // Map resolved status to display format
                if (resolvedStatus.startsWith('Holiday -')) {
                    status = resolvedStatus;
                    statusColor = '#9c27b0';
                    payableHours = '09:00';
                } else if (resolvedStatus === 'Comp Off') {
                    status = 'Comp Off';
                    statusColor = '#1976d2';
                    payableHours = '00:00';
                } else if (resolvedStatus === 'Swap Leave') {
                    status = 'Swap Leave';
                    statusColor = '#f57c00';
                    payableHours = '00:00';
                } else if (resolvedStatus.startsWith('Leave -')) {
                    status = resolvedStatus;
                    statusColor = '#74c0fc';
                    // Check leave type for payable hours
                    const leave = log.leave || getLeaveForDate(date);
                    payableHours = leave && leave.leaveType && leave.leaveType.startsWith('Half Day') ? '04:30' : '00:00';
                } else if (resolvedStatus === 'Weekend' || resolvedStatus === 'Week Off') {
                    status = resolvedStatus;
                    statusColor = '#9e9e9e';
                    payableHours = '09:00';
                } else if (resolvedStatus === 'Present' || resolvedStatus === 'On-time') {
                    status = 'Present';
                    statusColor = '#51cf66';
                    payableHours = '09:00';
                } else if (resolvedStatus === 'Late') {
                    status = 'Late';
                    statusColor = '#ff9800';
                    payableHours = '09:00';
                } else if (resolvedStatus === 'Half Day' || resolvedStatus === 'Half-day') {
                    status = 'Half Day';
                    statusColor = '#ff9800';
                    payableHours = '04:30';
                } else if (resolvedStatus === 'Absent') {
                    status = 'Absent';
                    statusColor = '#ff6b6b';
                    payableHours = '00:00';
                } else {
                    // Fallback: use resolved status as-is
                    status = resolvedStatus;
                }
            }
            
            // If log has sessions, calculate work hours (but status is already resolved by backend)
            if (log && log.sessions && log.sessions.length > 0) {
                // Sort sessions by start time
                const sortedSessions = log.sessions.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
                
                // Find first check-in
                const firstSession = sortedSessions[0];
                if (firstSession && firstSession.startTime) {
                    firstIn = new Date(firstSession.startTime).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                }
                
                // Find last check-out
                const lastSessionWithEnd = sortedSessions.filter(s => s.endTime).pop();
                if (lastSessionWithEnd && lastSessionWithEnd.endTime) {
                    lastOut = new Date(lastSessionWithEnd.endTime).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                }
                
                // Calculate total work time
                let totalWorkTime = 0;
                sortedSessions.forEach(session => {
                    if (session.startTime) {
                        const start = new Date(session.startTime);
                        const end = session.endTime ? new Date(session.endTime) : now;
                        totalWorkTime += (end - start) / (1000 * 60 * 60);
                    }
                });
                
                // Calculate break time
                let paidBreakMinutes = 0;
                let unpaidBreakMinutes = 0;
                
                if (log.breaks && log.breaks.length > 0) {
                    log.breaks.forEach(breakLog => {
                        if (breakLog.startTime && breakLog.endTime) {
                            const start = new Date(breakLog.startTime);
                            const end = new Date(breakLog.endTime);
                            const breakDuration = (end - start) / (1000 * 60 * 60);
                            const breakMinutes = breakLog.durationMinutes || Math.round(breakDuration * 60);
                            
                            if (breakLog.breakType === 'paid' || breakLog.breakType === 'lunch') {
                                paidBreakMinutes += breakMinutes;
                            } else {
                                unpaidBreakMinutes += breakMinutes;
                            }
                        }
                    });
                }
                
                // Format break times
                const paidHours = Math.floor(paidBreakMinutes / 60);
                const paidMins = paidBreakMinutes % 60;
                paidBreak = `${paidHours.toString().padStart(2, '0')}:${paidMins.toString().padStart(2, '0')}`;
                
                const unpaidHours = Math.floor(unpaidBreakMinutes / 60);
                const unpaidMins = unpaidBreakMinutes % 60;
                unpaidBreak = `${unpaidHours.toString().padStart(2, '0')}:${unpaidMins.toString().padStart(2, '0')}`;
                
                // Calculate net hours
                const totalBreakTime = (paidBreakMinutes + unpaidBreakMinutes) / 60;
                const netHours = Math.max(0, totalWorkTime - totalBreakTime);
                const hours = Math.floor(netHours);
                const minutes = Math.round((netHours - hours) * 60);
                totalHours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                
                // Status is already resolved by backend, but ensure payable hours are set for present days
                if (!payableHours || payableHours === '-') {
                    payableHours = '09:00';
                }
            } else if (!log || !log.attendanceStatus) {
                // No log or no resolved status - this should be rare with new backend
                // For dates without logs, determine status based on day of week
                const dayOfWeek = date.getDay();
                if (dayOfWeek === 0) {
                    status = 'Weekend';
                    statusColor = '#9e9e9e';
                    payableHours = '09:00';
                } else if (dayOfWeek === 6) {
                    // Check Saturday policy
                    const weekNum = Math.ceil(date.getDate() / 7);
                    const satPolicy = selectedEmployeeObject?.alternateSaturdayPolicy || 'All Saturdays Working';
                    let isWorkingSaturday = true;
                    if (satPolicy === 'All Saturdays Off') {
                        isWorkingSaturday = false;
                    } else if (satPolicy === 'Week 1 & 3 Off' && (weekNum === 1 || weekNum === 3)) {
                        isWorkingSaturday = false;
                    } else if (satPolicy === 'Week 2 & 4 Off' && (weekNum === 2 || weekNum === 4)) {
                        isWorkingSaturday = false;
                    }
                    if (!isWorkingSaturday) {
                        status = 'Week Off';
                        statusColor = '#9e9e9e';
                        payableHours = '09:00';
                    } else {
                        status = 'Absent';
                        statusColor = '#ff6b6b';
                        payableHours = '00:00';
                    }
                } else {
                    status = 'Absent';
                    statusColor = '#ff6b6b';
                    payableHours = '00:00';
                }
            }
            
            return {
                date: dateString,
                firstIn,
                lastOut,
                totalHours,
                paidBreak,
                unpaidBreak,
                payableHours,
                status,
                statusColor,
                shift
            };
        });
    };

    const renderTimelineContent = () => {
        if (!selectedEmployeeId) {
            return (
                <div className="timeline-placeholder">
                    <Alert severity="info">
                        Please select an employee to view their attendance summary.
                    </Alert>
                </div>
            );
        }

        if (viewMode === 'list') {
            return (
                <div className="attendance-list-container">
                    <div className="attendance-table">
                        <div className="table-header">
                            <div className="table-cell">Date</div>
                            <div className="table-cell">First In</div>
                            <div className="table-cell">Last Out</div>
                            <div className="table-cell">Total Hours</div>
                            <div className="table-cell">Paid break</div>
                            <div className="table-cell">Unpaid break</div>
                            <div className="table-cell">Payable Hours</div>
                            <div className="table-cell">Status</div>
                            <div className="table-cell">Shift(s)</div>
                            <div className="table-cell">Regularization</div>
                        </div>
                        
                        {formatAdminAttendanceDataForList().map((row, index) => (
                            <div key={index} className="table-row">
                                <div className="table-cell">{row.date}</div>
                                <div className="table-cell">{row.firstIn}</div>
                                <div className="table-cell">{row.lastOut}</div>
                                <div className="table-cell">{row.totalHours}</div>
                                <div className="table-cell">{row.paidBreak}</div>
                                <div className="table-cell">{row.unpaidBreak}</div>
                                <div className="table-cell">{row.payableHours}</div>
                                <div className="table-cell">
                                    <div className="status-cell">
                                        <div 
                                            className="status-indicator" 
                                            style={{ backgroundColor: row.statusColor }}
                                        ></div>
                                        <span>{row.status}</span>
                                    </div>
                                </div>
                                <div className="table-cell">{row.shift}</div>
                                <div className="table-cell">-</div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (viewMode === 'calendar') {
            return (
                <AttendanceCalendar
                    logs={logs}
                    currentDate={currentDate}
                    onDayClick={handleDayClick}
                    now={now}
                    holidays={holidays}
                    leaves={leaves}
                    saturdayPolicy={selectedEmployeeObject?.alternateSaturdayPolicy || 'All Saturdays Working'}
                />
            );
        }

        const mappedShiftInfo = selectedEmployeeObject?.shiftGroup 
            ? {
                name: selectedEmployeeObject.shiftGroup.shiftName,
                startTime: selectedEmployeeObject.shiftGroup.startTime,
                endTime: selectedEmployeeObject.shiftGroup.endTime
              } 
            : null;

        return (
             <div className="timeline-container">
                {loading && (
                    <div className="loading-overlay">
                        <CircularProgress />
                    </div>
                )}
                <div className={`timeline-wrapper ${loading ? 'loading' : ''}`}>
                    <AttendanceTimeline
                        logs={logs}
                        currentDate={currentDate}
                        onDayClick={handleDayClick}
                        isAdminView={true}
                        saturdayPolicy={selectedEmployeeObject?.alternateSaturdayPolicy || 'All Saturdays Working'}
                        shiftInfo={mappedShiftInfo}
                        now={now}
                        holidays={holidays}
                        leaves={leaves}
                    />
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="admin-attendance-summary-page">
                {/* Main Header */}
                <header className="summary-header">
                    <div className="header-left">
                        <Typography variant="h4" component="h1" className="summary-title">
                            Employee Attendance
                        </Typography>
                    </div>
                    
                    <div className="header-center">
                        <div className="date-range-selector">
                            <IconButton 
                                size="small" 
                                onClick={() => handleWeekChange('prev')}
                                className="nav-button"
                            >
                                <ChevronLeftIcon />
                            </IconButton>
                            <CalendarTodayIcon className="calendar-icon" />
                            <Typography variant="body2" className="date-range-text">
                                {formatDateRange(currentDate)}
                            </Typography>
                            <IconButton 
                                size="small" 
                                onClick={() => handleWeekChange('next')}
                                className="nav-button"
                            >
                                <ChevronRightIcon />
                            </IconButton>
                        </div>
                    </div>
                    
                    <div className="header-right">
                        <div className="employee-selector-inline">
                            <FormControl className="employee-select" size="small">
                                <InputLabel id="employee-select-label">Select Employee</InputLabel>
                                <Select
                                    labelId="employee-select-label"
                                    value={selectedEmployeeId}
                                    label="Select Employee"
                                    onChange={handleEmployeeChange}
                                    disabled={loadingEmployees}
                                >
                                    {employees.map((emp) => (
                                        <MenuItem key={emp._id} value={emp._id}>
                                            <div className="employee-option">
                                                <Avatar src={emp.profileImageUrl} sx={{ width: 24, height: 24, mr: 1 }}>
                                                    {emp.fullName.charAt(0)}
                                                </Avatar>
                                                <div className="employee-info">
                                                    <span className="employee-name">{emp.fullName}</span>
                                                    <span className="employee-id">({emp.employeeCode})</span>
                                                </div>
                                            </div>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </div>
                        
                        <div className="action-icons">
                            <Tooltip title="List View">
                                <IconButton 
                                    size="small" 
                                    onClick={() => setViewMode('list')}
                                    color={viewMode === 'list' ? 'primary' : 'default'}
                                >
                                    <ViewListIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Timeline View">
                                <IconButton 
                                    size="small" 
                                    onClick={() => setViewMode('timeline')}
                                    color={viewMode === 'timeline' ? 'primary' : 'default'}
                                >
                                    <ViewModuleIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Calendar View">
                                <IconButton 
                                    size="small" 
                                    onClick={() => setViewMode('calendar')}
                                    color={viewMode === 'calendar' ? 'primary' : 'default'}
                                >
                                    <CalendarMonthIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Filter">
                                <IconButton size="small">
                                    <FilterIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="More Options">
                                <IconButton size="small" onClick={handleMoreMenuClick}>
                                    <MoreVertIcon />
                                </IconButton>
                            </Tooltip>
                        </div>
                    </div>
                </header>
                
                {error && <Alert severity="error" className="error-alert">{error}</Alert>}
                
                {renderTimelineContent()}
            </div>
            
            <LogDetailModal
                open={isModalOpen}
                onClose={handleCloseModal}
                log={selectedLog}
                date={selectedDate}
                isAdmin={true}
                onSave={handleSaveLog}
                holiday={selectedHoliday}
                leave={selectedLeave}
            />
             <Snackbar 
                open={snackbar.open} 
                autoHideDuration={4000} 
                onClose={() => setSnackbar({ ...snackbar, open: false })} 
                message={snackbar.message} 
            />

            {/* More Options Menu */}
            <Menu
                anchorEl={anchorEl}
                open={moreMenuOpen}
                onClose={handleMoreMenuClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <MenuItem onClick={handleMusterRollClick}>
                    <ListItemIcon>
                        <PeopleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Employee Muster Roll</ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
};

export default AdminAttendanceSummaryPage;