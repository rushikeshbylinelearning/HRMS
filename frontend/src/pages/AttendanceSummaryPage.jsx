// src/pages/AttendanceSummaryPage.jsx - Redesigned to match Admin layout
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Typography, CircularProgress, Alert, 
    IconButton, Tooltip, Snackbar, Dialog, 
    DialogTitle, DialogContent, DialogActions, 
    Button, TextField
} from '@mui/material';
import {
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    CalendarToday as CalendarTodayIcon,
    ViewList as ViewListIcon,
    ViewModule as ViewModuleIcon,
    CalendarMonth as CalendarMonthIcon,
    MoreVert as MoreVertIcon
} from '@mui/icons-material';
import api from '../api/axios';
import AttendanceTimeline from '../components/AttendanceTimeline';
import AttendanceCalendar from '../components/AttendanceCalendar';
import LogDetailModal from '../components/LogDetailModal';
import UserLogModal from '../components/UserLogModal';
import { useAuth } from '../context/AuthContext';
import { getAttendanceStatus, formatLeaveRequestType } from '../utils/saturdayUtils';
import '../styles/AdminAttendanceSummaryPage.css';

const AttendanceSummaryPage = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedHoliday, setSelectedHoliday] = useState(null);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });
    const [viewMode, setViewMode] = useState('timeline'); // 'timeline', 'list', or 'calendar'
    const [notesModal, setNotesModal] = useState({ open: false, logId: null, notes: '', date: '' });

    const fetchLogsForWeekRef = useRef(null);
    
    // Create stable fetch function
    fetchLogsForWeekRef.current = async (date) => {
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
                api.get(`/attendance/my-weekly-log?startDate=${startDate}&endDate=${endDate}`),
                api.get('/leaves/holidays'),
                api.get('/leaves/my-requests')
            ]);
            
            const fetchedLogs = Array.isArray(logsRes.data) ? logsRes.data : [];
            const fetchedHolidays = Array.isArray(holidaysRes.data) ? holidaysRes.data : [];
            const fetchedLeaves = Array.isArray(leavesRes.data.requests) ? leavesRes.data.requests : [];
            
            setLogs(fetchedLogs);
            setHolidays(fetchedHolidays);
            setLeaves(fetchedLeaves);
            

        } catch (err) {
            setError('Failed to fetch attendance summary.');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };
    
    const fetchLogsForWeek = useCallback((date) => {
        return fetchLogsForWeekRef.current?.(date);
    }, [viewMode]);

    useEffect(() => {
        if (fetchLogsForWeekRef.current) {
            fetchLogsForWeekRef.current(currentDate);
        }
    }, [currentDate, viewMode]); // Include viewMode to refetch when view changes

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

    const handleDayClick = (dayData) => {
        const { date, log, holiday, leave } = dayData;
        // Always open modal for any day click (even if no log, to show leave/holiday info)
        setSelectedLog(log || null);
        setSelectedDate(date);
        setSelectedHoliday(holiday || null);
        setSelectedLeave(leave || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedLog(null);
        setSelectedDate(null);
        setSelectedHoliday(null);
        setSelectedLeave(null);
    };

    const handleSaveLog = (updatedLog) => {
        setLogs(prevLogs => 
            prevLogs.map(log => 
                log._id === updatedLog._id ? updatedLog : log
            )
        );
        setSnackbar({ open: true, message: 'Log updated successfully!' });
    };

    const handleEditNotes = (logId, currentNotes) => {
        if (!logId) {
            setSnackbar({ open: true, message: 'Cannot add notes for future dates without attendance data.' });
            return;
        }
        
        const log = logs.find(l => l._id === logId);
        const dateStr = log ? new Date(log.attendanceDate).toLocaleDateString('en-GB', { 
            weekday: 'short', 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        }).replace(/,/g, '') : '';
        
        setNotesModal({
            open: true,
            logId: logId,
            notes: currentNotes,
            date: dateStr
        });
    };

    const handleSaveNotes = async () => {
        if (!notesModal.logId) return;
        
        try {
            await api.patch(`/attendance/log/${notesModal.logId}/note`, {
                notes: notesModal.notes
            });
            
            // Update the logs state
            setLogs(prevLogs => 
                prevLogs.map(log => 
                    log._id === notesModal.logId 
                        ? { ...log, notes: notesModal.notes }
                        : log
                )
            );
            
            setNotesModal({ open: false, logId: null, notes: '', date: '' });
            setSnackbar({ open: true, message: 'Notes saved successfully!' });
        } catch (error) {
            console.error('Error saving notes:', error);
            setSnackbar({ open: true, message: 'Failed to save notes. Please try again.' });
        }
    };

    const handleCloseNotesModal = () => {
        setNotesModal({ open: false, logId: null, notes: '', date: '' });
    };

    const formatDateRange = (date) => {
        const start = new Date(date);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const formatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        return `${start.toLocaleDateString('en-GB', formatOptions)} - ${end.toLocaleDateString('en-GB', formatOptions)}`;
    };

    // Helper function to check if a date is a holiday
    const getHolidayForDate = (date) => {
        // Use local date formatting to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        return holidays.find(holiday => {
            // Skip tentative holidays (no date or isTentative flag)
            if (!holiday.date || holiday.isTentative) {
                return false;
            }
            const holidayDate = new Date(holiday.date);
            if (isNaN(holidayDate.getTime())) {
                return false;
            }
            const holidayYear = holidayDate.getFullYear();
            const holidayMonth = String(holidayDate.getMonth() + 1).padStart(2, '0');
            const holidayDay = String(holidayDate.getDate()).padStart(2, '0');
            const holidayDateStr = `${holidayYear}-${holidayMonth}-${holidayDay}`;
            return holidayDateStr === dateStr;
        });
    };

    // Helper function to check if a date is a leave
    const getLeaveForDate = (date) => {
        // Use local date formatting to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        return leaves.find(leave => {
            if (leave.status !== 'Approved') return false;
            return leave.leaveDates.some(leaveDateItem => {
                const leaveDate = new Date(leaveDateItem);
                const leaveYear = leaveDate.getFullYear();
                const leaveMonth = String(leaveDate.getMonth() + 1).padStart(2, '0');
                const leaveDay = String(leaveDate.getDate()).padStart(2, '0');
                const leaveDateStr = `${leaveYear}-${leaveMonth}-${leaveDay}`;
                return leaveDateStr === dateStr;
            });
        });
    };

    // Format attendance data for list view
    const formatAttendanceDataForList = () => {
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
            let shift = 'Morning';
            
            // Check for holidays and leaves FIRST (they take priority over attendance logs)
            const holiday = getHolidayForDate(date);
            const leave = getLeaveForDate(date);
            
            if (holiday) {
                status = `Holiday - ${holiday.name}`;
                statusColor = '#9c27b0';
                payableHours = '09:00';
            } else if (leave) {
                // Handle different leave types
                if (leave.requestType === 'Compensatory') {
                    status = 'Comp Off';
                    statusColor = '#1976d2';
                } else if (leave.requestType === 'Swap Leave') {
                    status = 'Swap Leave';
                    statusColor = '#f57c00';
                } else {
                    const leaveTypeText = leave.leaveType === 'Full Day' ? 'Full Day' : (leave.leaveType || 'Full Day');
                    status = `Leave - ${formatLeaveRequestType(leave.requestType)} (${leaveTypeText})`;
                    statusColor = '#74c0fc';
                }
                payableHours = leave.leaveType === 'Full Day' ? '00:00' : '04:30';
            } else if (log && log.sessions && log.sessions.length > 0) {
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
                const now = new Date(); // Calculate inline instead of using state
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
                
                payableHours = '09:00';
                
                // Determine status - use backend status directly (no UI recalculation)
                // Backend determines half-day based on: applied leave, worked hours < 8.5, or late beyond grace period
                if (log.status === 'On Leave') {
                    status = 'On Leave';
                    statusColor = '#74c0fc';
                } else if (log.isHalfDay || log.attendanceStatus === 'Half-day' || log.attendanceStatus === 'Half Day') {
                    status = 'Half Day';
                    statusColor = '#ff9800';
                } else {
                    // If there are work sessions, they are present regardless of log.status
                    // Note: We've already checked for holidays/leaves above, so if we reach here,
                    // there's no holiday/leave, or it's a half-day leave (which allows attendance)
                    status = 'Present';
                    statusColor = '#51cf66';
                }
            } else {
                // No log with sessions - use centralized attendance status function
                // This will properly check for holidays/leaves before marking as Absent
                const statusInfo = getAttendanceStatus(date, log, user?.alternateSaturdayPolicy || 'All Saturdays Working', holidays, leaves);
                status = statusInfo.status;
                statusColor = statusInfo.statusColor || statusInfo.color;
                
                // Map status to appropriate payable hours
                if (statusInfo.status.startsWith('Holiday -')) {
                    payableHours = '09:00';
                } else if (statusInfo.status === 'Comp Off' || statusInfo.status.startsWith('Leave -')) {
                    // Check if it's a half-day leave
                    const leave = getLeaveForDate(date);
                    payableHours = leave && leave.leaveType && leave.leaveType.startsWith('Half Day') ? '04:30' : '00:00';
                } else if (statusInfo.status === 'Weekend' || statusInfo.status === 'Week Off') {
                    payableHours = '09:00';
                } else if (statusInfo.status === 'Absent') {
                    payableHours = '00:00';
                } else {
                    payableHours = '09:00';
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
                shift,
                notes: log?.notes || '',
                logId: log?._id || null
            };
        });
    };

    const renderTimelineContent = () => {
        // Map shift info from user object
        const mappedShiftInfo = user?.shiftGroup 
            ? {
                name: user.shiftGroup.shiftName,
                startTime: user.shiftGroup.startTime,
                endTime: user.shiftGroup.endTime
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
                        isAdminView={false}
                        saturdayPolicy={user?.alternateSaturdayPolicy || 'All Saturdays Working'}
                        shiftInfo={mappedShiftInfo}
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
                            My AMS Portal
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
                                {viewMode === 'calendar' 
                                    ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                                    : formatDateRange(currentDate)
                                }
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
                            <Tooltip title="More Options">
                                <IconButton size="small">
                                    <MoreVertIcon />
                                </IconButton>
                            </Tooltip>
                        </div>
                    </div>
                </header>
                
                {error && <Alert severity="error" className="error-alert">{error}</Alert>}
                
                {/* Weekly Attendance - Timeline, List, or Calendar View */}
                {viewMode === 'timeline' ? (
                    renderTimelineContent()
                ) : viewMode === 'list' ? (
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
                            
                            {formatAttendanceDataForList().map((row, index) => (
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
                                    <div className="table-cell">
                                        {row.notes ? (
                                            <div className="notes-cell">
                                                <span className="notes-text" title={row.notes}>
                                                    {row.notes.length > 20 ? `${row.notes.substring(0, 20)}...` : row.notes}
                                                </span>
                                                <button 
                                                    className="edit-notes-btn"
                                                    onClick={() => handleEditNotes(row.logId, row.notes)}
                                                    title="Edit notes"
                                                >
                                                    ✏️
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                className="add-notes-btn"
                                                onClick={() => handleEditNotes(row.logId, '')}
                                                title="Add notes"
                                            >
                                                + Add
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <AttendanceCalendar
                        logs={logs}
                        currentDate={currentDate}
                        onDayClick={handleDayClick}
                        holidays={holidays}
                        leaves={leaves}
                        saturdayPolicy={user?.alternateSaturdayPolicy || 'All Saturdays Working'}
                    />
                )}
            </div>
            
            {/* Use UserLogModal for regular users, LogDetailModal for admins */}
            {user && ['Admin', 'HR'].includes(user.role) ? (
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
            ) : (
                <UserLogModal
                    open={isModalOpen}
                    onClose={handleCloseModal}
                    log={selectedLog}
                    date={selectedDate}
                    loading={false}
                    holiday={selectedHoliday}
                    leave={selectedLeave}
                />
            )}
            <Snackbar 
                open={snackbar.open} 
                autoHideDuration={3000} 
                onClose={() => setSnackbar({ open: false, message: '' })}
                message={snackbar.message}
            />
            
            {/* Notes Modal */}
            <Dialog 
                open={notesModal.open} 
                onClose={handleCloseNotesModal}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Add Notes - {notesModal.date}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Notes"
                        fullWidth
                        multiline
                        rows={4}
                        variant="outlined"
                        value={notesModal.notes}
                        onChange={(e) => setNotesModal(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Enter your notes for this date..."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseNotesModal}>
                        Cancel
                    </Button>
                    <Button onClick={handleSaveNotes} variant="contained">
                        Save Notes
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default AttendanceSummaryPage;