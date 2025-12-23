// src/components/LogDetailModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, Typography, Box, IconButton, DialogActions, 
    Button, TextField, Select, MenuItem, FormControl, InputLabel, Divider, 
    CircularProgress, Paper, Stack, ToggleButtonGroup, ToggleButton, Alert, Grid, Chip
} from '@mui/material';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab';
import CloseIcon from '@mui/icons-material/Close';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WorkIcon from '@mui/icons-material/Work';
import TimerIcon from '@mui/icons-material/Timer';
import SaveIcon from '@mui/icons-material/Save';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import { normalizeSession, validateSessionDuration, createNormalizedDateTime } from '../utils/timeNormalization';
import '../styles/LogDetailModal.css';

// --- SHARED HELPER FUNCTIONS ---
const formatTimeForDisplay = (dateTime) => {
    if (!dateTime) return '--:--';
    return new Date(dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatTimeToHHMM = (dateTime) => {
    if (!dateTime) return '';
    const dateObj = new Date(dateTime);
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

const formatDuration = (totalMins) => {
    if (isNaN(totalMins) || totalMins < 0) return '00:00 Hrs';
    const hours = String(Math.floor(totalMins / 60)).padStart(2, '0');
    const minutes = String(Math.round(totalMins % 60)).padStart(2, '0');
    return `${hours}:${minutes} Hrs`;
};

const formatDurationShort = (totalMins) => {
    if (isNaN(totalMins) || totalMins < 0) return '0 Min(s)';
    const mins = Math.round(totalMins);
    return `${mins} Min(s)`;
};

const formatDateForDisplay = (dateTime) => {
    if (!dateTime) return 'N/A';
    const date = new Date(dateTime);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = dayNames[date.getDay()];
    const day = String(date.getDate()).padStart(2, '0');
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName}, ${day} ${month} ${year}`;
};

const calculateEventDuration = (startTime, endTime, now = null) => {
    if (!startTime) return 0;
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : (now || new Date());
    return Math.max(0, (end - start) / (1000 * 60)); // Return minutes
};

const LogDetailModal = ({ open, onClose, log, date, isAdmin, onSave, holiday, leave }) => {
    const [editableLog, setEditableLog] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [adminView, setAdminView] = useState('view');
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (log) {
            const newEditableLog = JSON.parse(JSON.stringify(log));
            newEditableLog.sessions = (newEditableLog.sessions || []).map(s => ({ ...s, _id: s._id || uuidv4() }));
            newEditableLog.breaks = (newEditableLog.breaks || []).map(b => ({ ...b, _id: b._id || uuidv4() }));
            setEditableLog(newEditableLog);
        }
        if (open) {
            if (isAdmin) setAdminView('view');
            setLocalError('');
        }
    }, [log, open, isAdmin]);

    const timelineEvents = useMemo(() => {
        if (!log) return [];
        const sessions = (log.sessions || []).map(s => ({ ...s, eventType: 'session' }));
        const breaks = (log.breaks || []).map(b => ({ ...b, eventType: 'break' }));
        return [...sessions, ...breaks].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    }, [log]);
    
    // Allow modal to open even without log if there's holiday or leave info
    if (!date) return null;
    if (!log && !holiday && !leave) return null;
    if (log && !editableLog) return null;

    const fullDateStr = date.toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
    const dateForApi = log ? date.toLocaleDateString('en-CA') : null;

    const handleSessionChange = (id, field, value) => {
        const updatedSessions = editableLog.sessions.map(s => {
            if (s._id === id) {
                if (field === 'startTime' || field === 'endTime') {
                    if (!value) {
                        return { ...s, [field]: null };
                    }

                    // Create datetime from base date and time
                    let newDateTime = dayjs(`${dateForApi}T${value}`);

                    // If updating endTime, check if it should be next day
                    if (field === 'endTime' && s.startTime) {
                        const startTime = dayjs(s.startTime);
                        // If end time is before start time, add 1 day (cross-day scenario)
                        if (newDateTime.isBefore(startTime)) {
                            newDateTime = newDateTime.add(1, 'day');
                        }
                    }

                    // If updating startTime, check if endTime needs adjustment
                    if (field === 'startTime' && s.endTime) {
                        const endTime = dayjs(s.endTime);
                        // If new start is after current end, end might need to be next day
                        // But we'll let the endTime update handle this, so just ensure end is after start
                        if (endTime.isBefore(newDateTime)) {
                            // End time will be adjusted when user edits it, or we can auto-adjust here
                            // For now, we'll let the user update endTime if needed
                        }
                    }

                    return { ...s, [field]: newDateTime.toISOString() };
                }
                return { ...s, [field]: value };
            }
            return s;
        });
        setEditableLog(prev => ({ ...prev, sessions: updatedSessions }));
    };

    const handleBreakChange = (id, field, value) => {
        const updatedBreaks = editableLog.breaks.map(b => {
            if (b._id === id) {
                if (field === 'startTime' || field === 'endTime') {
                    if (!value) {
                        return { ...b, [field]: null };
                    }

                    // Create datetime from base date and time
                    let newDateTime = dayjs(`${dateForApi}T${value}`);

                    // If updating endTime, check if it should be next day
                    if (field === 'endTime' && b.startTime) {
                        const startTime = dayjs(b.startTime);
                        // If end time is before start time, add 1 day (cross-day scenario)
                        if (newDateTime.isBefore(startTime)) {
                            newDateTime = newDateTime.add(1, 'day');
                        }
                    }

                    // If updating startTime, check if endTime needs adjustment
                    if (field === 'startTime' && b.endTime) {
                        const endTime = dayjs(b.endTime);
                        // Similar logic as sessions - end will be adjusted when edited
                    }

                    return { ...b, [field]: newDateTime.toISOString() };
                }
                return { ...b, [field]: value };
            }
            return b;
        });
        setEditableLog(prev => ({ ...prev, breaks: updatedBreaks }));
    };

    const addSession = () => {
        const newSession = {
            _id: uuidv4(),
            startTime: new Date(`${dateForApi}T09:00:00`).toISOString(),
            endTime: new Date(`${dateForApi}T17:00:00`).toISOString()
        };
        setEditableLog(prev => ({ ...prev, sessions: [...prev.sessions, newSession] }));
    };
    
    const addBreak = () => {
        const newBreak = {
            _id: uuidv4(),
            breakType: 'Paid',
            startTime: new Date(`${dateForApi}T12:00:00`).toISOString(),
            endTime: new Date(`${dateForApi}T13:00:00`).toISOString()
        };
        setEditableLog(prev => ({ ...prev, breaks: [...prev.breaks, newBreak] }));
    };

    const deleteSession = (id) => {
        setEditableLog(prev => ({ ...prev, sessions: prev.sessions.filter(s => s._id !== id) }));
    };

    const deleteBreak = (id) => {
        setEditableLog(prev => ({ ...prev, breaks: prev.breaks.filter(b => b._id !== id) }));
    };

    /**
     * Centralized payload builder with strict validation
     * Ensures all required fields exist and are properly formatted before API call
     * 
     * Expected payload structure:
     * {
     *   sessions: Array<{ startTime: string (ISO), endTime: string (ISO) | null }>
     *   breaks: Array<{ startTime: string (ISO), endTime: string (ISO), breakType: 'Paid' | 'Unpaid' | 'Extra' }>
     *   notes: string
     *   attendanceDate: string (YYYY-MM-DD) - optional, for reference
     * }
     */
    const buildValidatedPayload = () => {
        try {
            // Ensure sessions and breaks are arrays
            const sessions = Array.isArray(editableLog?.sessions) ? editableLog.sessions : [];
            const breaks = Array.isArray(editableLog?.breaks) ? editableLog.breaks : [];

            // Validate and normalize sessions - strip extra fields, ensure valid times
            const normalizedSessions = sessions.map((session, index) => {
                if (!session || typeof session !== 'object') {
                    throw new Error(`Session #${index + 1} is invalid. Expected an object.`);
                }

                if (!session.startTime) {
                    throw new Error(`Session #${index + 1} is missing startTime.`);
                }

                // Convert to dayjs for validation
                const start = dayjs(session.startTime);
                if (!start.isValid()) {
                    throw new Error(`Session #${index + 1} has an invalid startTime: ${session.startTime}`);
                }

                // Build clean session object (only include required fields)
                const cleanSession = {
                    startTime: start.toISOString() // Ensure ISO format
                };

                // End time is optional, but if provided must be valid
                if (session.endTime) {
                    let end = dayjs(session.endTime);
                    if (!end.isValid()) {
                        throw new Error(`Session #${index + 1} has an invalid endTime: ${session.endTime}`);
                    }

                    // Normalize: if end is before start, add 1 day (cross-day scenario)
                    if (end.isBefore(start)) {
                        end = end.add(1, 'day');
                    }

                    // Validate duration (max 16 hours)
                    const durationHours = end.diff(start, 'hour', true);
                    if (durationHours <= 0) {
                        throw new Error(`Session #${index + 1} end time must be after start time.`);
                    }
                    if (durationHours > 16) {
                        throw new Error(`Session #${index + 1} duration cannot exceed 16 hours.`);
                    }

                    cleanSession.endTime = end.toISOString();
                } else {
                    cleanSession.endTime = null;
                }

                return cleanSession;
            });

            // Validate and normalize breaks - strip extra fields, ensure valid times and breakType
            const normalizedBreaks = breaks.map((brk, index) => {
                if (!brk || typeof brk !== 'object') {
                    throw new Error(`Break #${index + 1} is invalid. Expected an object.`);
                }

                if (!brk.startTime) {
                    throw new Error(`Break #${index + 1} is missing startTime.`);
                }

                if (!brk.endTime) {
                    throw new Error(`Break #${index + 1} is missing endTime.`);
                }

                const start = dayjs(brk.startTime);
                if (!start.isValid()) {
                    throw new Error(`Break #${index + 1} has an invalid startTime: ${brk.startTime}`);
                }

                let end = dayjs(brk.endTime);
                if (!end.isValid()) {
                    throw new Error(`Break #${index + 1} has an invalid endTime: ${brk.endTime}`);
                }

                // Normalize: if end is before start, add 1 day (cross-day scenario)
                if (end.isBefore(start)) {
                    end = end.add(1, 'day');
                }

                // Validate duration (max 16 hours for breaks too)
                const durationHours = end.diff(start, 'hour', true);
                if (durationHours <= 0) {
                    throw new Error(`Break #${index + 1} end time must be after start time.`);
                }
                if (durationHours > 16) {
                    throw new Error(`Break #${index + 1} duration cannot exceed 16 hours.`);
                }

                // Normalize breakType (handle both type and breakType for backward compatibility)
                const breakType = (brk.breakType || brk.type || 'Unpaid').trim();
                if (!['Paid', 'Unpaid', 'Extra'].includes(breakType)) {
                    throw new Error(`Break #${index + 1} has an invalid breakType: ${breakType}. Must be 'Paid', 'Unpaid', or 'Extra'.`);
                }

                // Build clean break object (only include required fields)
                return {
                    startTime: start.toISOString(),
                    endTime: end.toISOString(),
                    breakType: breakType
                };
            });

            // Build final payload - only send required fields to backend
            const payload = {
                sessions: normalizedSessions,
                breaks: normalizedBreaks,
                notes: (editableLog?.notes || '').toString().trim()
            };

            // Optional: include attendanceDate for reference (backend may not use it)
            if (dateForApi) {
                payload.attendanceDate = dateForApi;
            }

            // Log payload in development mode for debugging
            if (process.env.NODE_ENV === 'development') {
                console.log('📤 Payload being sent to backend:', {
                    sessionsCount: payload.sessions.length,
                    breaksCount: payload.breaks.length,
                    hasNotes: !!payload.notes,
                    sessions: payload.sessions,
                    breaks: payload.breaks
                });
            }

            return payload;
        } catch (validationError) {
            // Convert validation errors to user-friendly messages
            throw new Error(validationError.message || 'Validation failed. Please check all fields.');
        }
    };

    const handleSaveChanges = async () => {
        setLocalError('');
        setIsSaving(true);

        try {
            // Validate and build payload
            const payload = buildValidatedPayload();

            // Validate log ID exists
            if (!log?._id) {
                throw new Error('Attendance log ID is missing. Cannot save changes.');
            }

            // Call onSave with proper error handling
            await onSave(log._id, payload);
            
            // Success - onSave will handle UI updates
            setIsSaving(false);
        } catch (error) {
            // Handle validation errors and API errors safely
            const errorMessage = error?.message || error?.response?.data?.error || error?.response?.data?.message || 'Failed to save changes. Please try again.';
            setLocalError(errorMessage);
            setIsSaving(false);
            
            // Log error for debugging (only in development)
            if (process.env.NODE_ENV === 'development') {
                console.error('❌ Error saving attendance log:', {
                    error,
                    message: errorMessage,
                    logId: log?._id
                });
            }
        }
    };

    const ReadOnlyView = () => {
        // If no log but there's holiday or leave, show that information
        if (!log && (holiday || leave)) {
            return (
                <DialogContent className="dialog-content audit-dialog-content">
                    <Box className="audit-timeline-container">
                        <Alert severity="info" sx={{ mb: 2 }}>
                            {holiday ? (
                                <Box>
                                    <Typography variant="h6" gutterBottom>
                                        Holiday: {holiday.name}
                                    </Typography>
                                    {holiday.description && (
                                        <Typography variant="body2" color="text.secondary">
                                            {holiday.description}
                                        </Typography>
                                    )}
                                </Box>
                            ) : leave ? (
                                <Box>
                                    <Typography variant="h6" gutterBottom>
                                        Leave: {formatLeaveRequestType(leave.requestType)}
                                    </Typography>
                                    {leave.leaveType && (
                                        <Box sx={{ mt: 1, mb: 1 }}>
                                            <Chip 
                                                label={leave.leaveType === 'Full Day' ? 'Full Day Leave' : leave.leaveType}
                                                color={leave.leaveType === 'Full Day' ? 'primary' : 'secondary'}
                                                variant="outlined"
                                                sx={{ fontWeight: 600 }}
                                            />
                                        </Box>
                                    )}
                                    {leave.reason && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                            Reason: {leave.reason}
                                        </Typography>
                                    )}
                                </Box>
                            ) : null}
                        </Alert>
                    </Box>
                </DialogContent>
            );
        }

        const calculateStats = useMemo(() => {
            if (!log) return { 
                totalWorkMinutes: 0, 
                totalBreakMinutes: 0, 
                paidBreakMinutes: 0,
                firstCheckIn: null,
                lastCheckOut: null
            };
            
            const sessions = log.sessions || [];
            const breaks = log.breaks || [];
            
            const totalWorkMinutes = sessions.reduce((acc, session) => {
                if (session.startTime || session.start_time) {
                    const start = new Date(session.startTime || session.start_time);
                    const end = session.endTime || session.end_time ? 
                        new Date(session.endTime || session.end_time) : new Date();
                    return acc + (end - start) / (1000 * 60);
                }
                return acc;
            }, 0);
            
            const totalBreakMinutes = breaks.reduce((acc, breakItem) => {
                if (breakItem.startTime || breakItem.start_time) {
                    const start = new Date(breakItem.startTime || breakItem.start_time);
                    const end = breakItem.endTime || breakItem.end_time ? 
                        new Date(breakItem.endTime || breakItem.end_time) : new Date();
                    return acc + (end - start) / (1000 * 60);
                }
                return acc;
            }, 0);
            
            const paidBreakMinutes = breaks
                .filter(b => (b.breakType || b.type || '').toLowerCase() === 'paid')
                .reduce((acc, breakItem) => {
                    if (breakItem.startTime || breakItem.start_time) {
                        const start = new Date(breakItem.startTime || breakItem.start_time);
                        const end = breakItem.endTime || breakItem.end_time ? 
                            new Date(breakItem.endTime || breakItem.end_time) : new Date();
                        return acc + (end - start) / (1000 * 60);
                    }
                    return acc;
                }, 0);
            
            // Get first check-in and last check-out
            const firstCheckIn = sessions.length > 0 ? 
                (sessions[0].startTime || sessions[0].start_time) : null;
            
            const lastCheckOut = sessions.length > 0 && sessions[sessions.length - 1].endTime ? 
                (sessions[sessions.length - 1].endTime || sessions[sessions.length - 1].end_time) : 
                (log.clockOutTime || null);
            
            return {
                totalWorkMinutes: Math.max(0, totalWorkMinutes - totalBreakMinutes),
                totalBreakMinutes,
                paidBreakMinutes,
                firstCheckIn,
                lastCheckOut
            };
        }, [log]);

        // Process sessions and breaks into timeline
        // Breaks separate work sessions - split sessions at break boundaries
        const processedTimeline = useMemo(() => {
            if (!log) return [];
            
            const sessions = (log.sessions || [])
                .filter(s => s && (s.startTime || s.start_time))
                .map(s => ({
                    type: 'session',
                    startTime: s.startTime || s.start_time,
                    endTime: s.endTime || s.end_time,
                    location: s.location || s.address || null
                }));
            
            const breaks = (log.breaks || [])
                .filter(b => b && (b.startTime || b.start_time))
                .map(b => ({
                    type: 'break',
                    startTime: b.startTime || b.start_time,
                    endTime: b.endTime || b.end_time,
                    breakType: b.breakType || b.type || 'Break',
                    location: b.location || b.address || null
                }));
            
            // Split sessions at break boundaries
            // Example: Session 9am-5pm with break 12pm-1pm becomes:
            // Session 9am-12pm, Break 12pm-1pm, Session 1pm-5pm
            const timeline = [];
            
            for (const session of sessions) {
                const sessionStart = new Date(session.startTime);
                const sessionEnd = session.endTime ? new Date(session.endTime) : null;
                
                // Find all breaks that occur within this session
                const breaksInSession = breaks.filter(breakItem => {
                    const breakStart = new Date(breakItem.startTime);
                    const breakEnd = breakItem.endTime ? new Date(breakItem.endTime) : null;
                    
                    // Break is within session if:
                    // - Break starts after session starts
                    // - Break ends before session ends (or session has no end)
                    return breakStart >= sessionStart && 
                           (!sessionEnd || (breakEnd && breakEnd <= sessionEnd));
                }).sort((a, b) => {
                    return new Date(a.startTime) - new Date(b.startTime);
                });
                
                if (breaksInSession.length === 0) {
                    // No breaks in this session, add it as-is
                    timeline.push(session);
                } else {
                    // Split session at break boundaries
                    let currentStart = sessionStart;
                    
                    for (let i = 0; i < breaksInSession.length; i++) {
                        const breakItem = breaksInSession[i];
                        const breakStart = new Date(breakItem.startTime);
                        const breakEnd = breakItem.endTime ? new Date(breakItem.endTime) : null;
                        
                        // Add work session before this break
                        if (currentStart < breakStart) {
                            timeline.push({
                                type: 'session',
                                startTime: currentStart.toISOString(),
                                endTime: breakStart.toISOString(),
                                location: session.location
                            });
                        }
                        
                        // Add the break
                        timeline.push(breakItem);
                        
                        // Update current start to after the break
                        currentStart = breakEnd || breakStart;
                    }
                    
                    // Add remaining work session after last break
                    if (sessionEnd && currentStart < sessionEnd) {
                        timeline.push({
                            type: 'session',
                            startTime: currentStart.toISOString(),
                            endTime: sessionEnd.toISOString(),
                            location: session.location
                        });
                    } else if (!sessionEnd && currentStart > sessionStart) {
                        // Session has no end time, add remaining portion
                        timeline.push({
                            type: 'session',
                            startTime: currentStart.toISOString(),
                            endTime: null,
                            location: session.location
                        });
                    }
                }
            }
            
            // Add any breaks that don't fall within any session
            for (const breakItem of breaks) {
                const breakStart = new Date(breakItem.startTime);
                const isInSession = sessions.some(session => {
                    const sessionStart = new Date(session.startTime);
                    const sessionEnd = session.endTime ? new Date(session.endTime) : null;
                    return breakStart >= sessionStart && 
                           (!sessionEnd || breakStart <= sessionEnd);
                });
                
                if (!isInSession) {
                    timeline.push(breakItem);
                }
            }
            
            // Sort timeline chronologically
            timeline.sort((a, b) => {
                const timeA = new Date(a.startTime);
                const timeB = new Date(b.startTime);
                return timeA - timeB;
            });
            
            return timeline;
        }, [log]);

        // Get shift time range for header
        const getShiftTimeRange = () => {
            if (!log || !log.shiftInfo) return '';
            const shift = log.shiftInfo;
            const startTime = shift.startTime || shift.start_time || '09:00';
            const endTime = shift.endTime || shift.end_time || '18:00';
            
            const formatTo12h = (time24) => {
                const [hours, minutes] = time24.split(':');
                const hour = parseInt(hours);
                const period = hour >= 12 ? 'PM' : 'AM';
                const hour12 = hour % 12 || 12;
                return `${hour12}:${minutes} ${period}`;
            };
            
            return `${formatTo12h(startTime)} - ${formatTo12h(endTime)}`;
        };

        const getTimeOfDay = () => {
            if (!date) return 'Morning';
            const hour = date.getHours();
            if (hour < 12) return 'Morning';
            if (hour < 17) return 'Afternoon';
            return 'Evening';
        };

        const fullDateStr = date ? formatDateForDisplay(date) : 'Log Details';
        const shiftTimeRange = getShiftTimeRange();
        const timeOfDay = getTimeOfDay();

        return (
            <DialogContent className="dialog-content audit-dialog-content">
                <Box className="audit-timeline-container">
                    {/* Summary Cards */}
                    <Grid container spacing={2} className="summary-cards-container">
                        <Grid item xs={12} sm={6} md={2.4}>
                            <Paper className="summary-stat-card">
                                <Box className="summary-stat-content">
                                    <WorkIcon className="summary-stat-icon summary-stat-icon-primary" />
                                    <Box className="summary-stat-text">
                                        <Typography className="summary-stat-label">Total Work Time</Typography>
                                        <Typography className="summary-stat-value">
                                            {formatDuration(calculateStats.totalWorkMinutes)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2.4}>
                            <Paper className="summary-stat-card">
                                <Box className="summary-stat-content">
                                    <TimerIcon className="summary-stat-icon summary-stat-icon-warning" />
                                    <Box className="summary-stat-text">
                                        <Typography className="summary-stat-label">Total Breaks</Typography>
                                        <Typography className="summary-stat-value">
                                            {formatDuration(calculateStats.totalBreakMinutes)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2.4}>
                            <Paper className="summary-stat-card">
                                <Box className="summary-stat-content">
                                    <WatchLaterIcon className="summary-stat-icon summary-stat-icon-info" />
                                    <Box className="summary-stat-text">
                                        <Typography className="summary-stat-label">Paid Breaks</Typography>
                                        <Typography className="summary-stat-value">
                                            {formatDuration(calculateStats.paidBreakMinutes)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2.4}>
                            <Paper className="summary-stat-card">
                                <Box className="summary-stat-content">
                                    <AccessTimeIcon className="summary-stat-icon summary-stat-icon-success" />
                                    <Box className="summary-stat-text">
                                        <Typography className="summary-stat-label">First Check-in</Typography>
                                        <Typography className="summary-stat-value">
                                            {formatTimeForDisplay(calculateStats.firstCheckIn) || '--:--'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={2.4}>
                            <Paper className="summary-stat-card">
                                <Box className="summary-stat-content">
                                    <AccessTimeIcon className="summary-stat-icon summary-stat-icon-error" />
                                    <Box className="summary-stat-text">
                                        <Typography className="summary-stat-label">Last Check-out</Typography>
                                        <Typography className="summary-stat-value">
                                            {formatTimeForDisplay(calculateStats.lastCheckOut) || '--:--'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Timeline Events */}
                    {processedTimeline.length > 0 ? (
                        <Box className="timeline-events">
                            {processedTimeline.map((event, eventIndex) => {
                                const isBreak = event.type === 'break';
                                const duration = event.endTime ? 
                                    (new Date(event.endTime) - new Date(event.startTime)) / (1000 * 60) : 0;
                                
                                // Get break label text
                                const getBreakLabel = () => {
                                    if (!isBreak) return '';
                                    const breakType = (event.breakType || '').toLowerCase();
                                    if (breakType === 'paid' || breakType === 'meal') {
                                        return 'Meal Break';
                                    }
                                    return 'Unpaid Break';
                                };

                                return (
                                    <Box key={`event-${eventIndex}`} className="timeline-event-block">
                                        {/* Work Session or Break Card */}
                                        <Paper className={`timeline-entry-card ${isBreak ? 'break-card' : 'work-session-card'}`}>
                                            <Box className="timeline-entry-content">
                                                {/* Start Time (Left) */}
                                                <Box className="timeline-entry-left">
                                                    <Box className="timeline-time-icon-group">
                                                        <Box className={`timeline-icon ${isBreak ? 'timeline-icon-break' : 'timeline-icon-work'}`}>
                                                            <Box className={`icon-square ${isBreak ? 'icon-square-orange' : 'icon-square-green'}`}></Box>
                                                        </Box>
                                                        <Typography className={`timeline-time ${isBreak ? 'timeline-time-break' : 'timeline-time-work'}`}>
                                                            {formatTimeForDisplay(event.startTime)}
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                {/* Dotted Connector with Break Label (for breaks) */}
                                                <Box className="timeline-connector">
                                                    {isBreak ? (
                                                        <Box className="break-label-center">
                                                            <Typography className="break-label-text">
                                                                {getBreakLabel()}
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Box className="dotted-line"></Box>
                                                    )}
                                                </Box>

                                                {/* End Time (Right) */}
                                                <Box className="timeline-entry-right">
                                                    <Box className="timeline-time-icon-group">
                                                        <Box className={`timeline-icon ${isBreak ? 'timeline-icon-break' : 'timeline-icon-work'}`}>
                                                            <Box className={`icon-square ${isBreak ? 'icon-square-orange' : 'icon-square-green'}`}></Box>
                                                        </Box>
                                                        <Typography className={`timeline-time ${isBreak ? 'timeline-time-break' : 'timeline-time-work'}`}>
                                                            {formatTimeForDisplay(event.endTime) || '--:--'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </Paper>

                                        {/* Break Label (only for breaks) */}
                                        {isBreak && (
                                            <Box className="break-label-container">
                                                <Chip 
                                                    label={`${event.breakType || 'Break'} Break - ${formatDurationShort(duration)}`}
                                                    className={`break-label-chip ${(event.breakType || '').toLowerCase() === 'paid' ? 'break-label-paid' : 'break-label-unpaid'}`}
                                                    size="small"
                                                />
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    ) : (
                        <Alert severity="info" className="timeline-empty-alert">
                            No timeline events recorded for this day.
                        </Alert>
                    )}

                    {/* Summary Footer */}
                    <Box className="summary-footer">
                        <Box className="summary-item">
                            <Typography className="summary-label">First Check-In</Typography>
                            <Typography className="summary-value summary-value-success">
                                {formatTimeForDisplay(calculateStats.firstCheckIn) || '-'}
                            </Typography>
                        </Box>
                        <Box className="summary-item">
                            <Typography className="summary-label">Last Check-Out</Typography>
                            <Typography className="summary-value">
                                {formatTimeForDisplay(calculateStats.lastCheckOut) || '-'}
                            </Typography>
                        </Box>
                        <Box className="summary-item">
                            <Typography className="summary-label">Total Hours</Typography>
                            <Typography className="summary-value summary-value-success">
                                {formatDuration(calculateStats.totalWorkMinutes)}
                            </Typography>
                        </Box>
                        <Box className="summary-item">
                            <Typography className="summary-label">Paid break</Typography>
                            <Typography className="summary-value summary-value-info">
                                {formatDuration(calculateStats.paidBreakMinutes)}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </DialogContent>
        );
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            fullWidth 
            maxWidth="md"
            PaperProps={{ 
                className: 'log-detail-dialog'
            }}
        >
            <DialogTitle className="dialog-header">
                {(!isAdmin || (isAdmin && adminView === 'view')) ? (
                    <Box className="header-content">
                        <Box>
                            <Typography variant="body1" className="header-date">
                                {fullDateStr} {(() => {
                                    if (!date) return '';
                                    const hour = date.getHours();
                                    const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
                                    const shift = log?.shiftInfo;
                                    if (shift) {
                                        const startTime = shift.startTime || shift.start_time || '09:00';
                                        const endTime = shift.endTime || shift.end_time || '18:00';
                                        const formatTo12h = (time24) => {
                                            const [hours, minutes] = time24.split(':');
                                            const hour = parseInt(hours);
                                            const period = hour >= 12 ? 'PM' : 'AM';
                                            const hour12 = hour % 12 || 12;
                                            return `${hour12}:${minutes} ${period}`;
                                        };
                                        return `${timeOfDay} [${formatTo12h(startTime)} - ${formatTo12h(endTime)}]`;
                                    }
                                    return timeOfDay;
                                })()}
                            </Typography>
                        </Box>
                        <Box className="header-actions">
                            <IconButton onClick={onClose} size="small" className="close-button">
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </Box>
                ) : (
                    <Box>
                        <Typography variant="h6">{fullDateStr}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Admin Edit View
                        </Typography>
                    </Box>
                )}
                {isAdmin && (!isAdmin || (isAdmin && adminView === 'view')) && (
                    <Box className="dialog-header-actions" sx={{ mt: 1 }}>
                        <ToggleButtonGroup
                            value={adminView}
                            exclusive
                            onChange={(e, newView) => { if(newView) setAdminView(newView); }}
                            aria-label="admin view toggle"
                            size="small"
                        >
                            <ToggleButton value="view" aria-label="view mode"><VisibilityIcon /></ToggleButton>
                            <ToggleButton value="edit" aria-label="edit mode"><EditIcon /></ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                )}
                {isAdmin && adminView === 'edit' && (
                    <Box className="dialog-header-actions">
                        <IconButton onClick={onClose} className="close-button"><CloseIcon /></IconButton>
                    </Box>
                )}
            </DialogTitle>
            
            {(!isAdmin || (isAdmin && adminView === 'view')) ? <ReadOnlyView /> : (
            <>
                {/* ADMIN EDITABLE VIEW */}
                <DialogContent className="admin-edit-content">
                    {localError && <Alert severity="error" className="admin-edit-error-alert">{localError}</Alert>}
                    <Stack spacing={0}>
                        {/* Work Sessions Section */}
                        <Paper className="admin-edit-section admin-edit-section-sessions">
                            <Box className="admin-edit-section-header admin-edit-section-header-sessions">
                                <CheckCircleIcon className="admin-edit-section-icon admin-edit-section-icon-success" />
                                <Typography className="admin-edit-section-title">Work Sessions</Typography>
                            </Box>
                            
                            {editableLog.sessions.map((session, index) => (
                                <Paper key={session._id} className="admin-edit-entry-card admin-edit-entry-card-session">
                                    <Grid container className="admin-edit-entry-grid">
                                        <Grid item className="admin-edit-entry-index">
                                            <Typography className="admin-edit-entry-index-text">
                                                #{index + 1}
                                            </Typography>
                                        </Grid>
                                        <Grid item className="admin-edit-entry-fields">
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField 
                                                        label="Check-in" 
                                                        type="time" 
                                                        fullWidth 
                                                        size="small" 
                                                        value={formatTimeToHHMM(session.startTime)} 
                                                        onChange={(e) => handleSessionChange(session._id, 'startTime', e.target.value)} 
                                                        InputLabelProps={{ shrink: true }}
                                                        className="admin-edit-input admin-edit-input-checkin"
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField 
                                                        label="Check-out" 
                                                        type="time" 
                                                        fullWidth 
                                                        size="small" 
                                                        value={formatTimeToHHMM(session.endTime)} 
                                                        onChange={(e) => handleSessionChange(session._id, 'endTime', e.target.value)} 
                                                        InputLabelProps={{ shrink: true }}
                                                        className="admin-edit-input admin-edit-input-checkout"
                                                    />
                                                </Grid>
                                            </Grid>
                                        </Grid>
                                        <Grid item className="admin-edit-entry-delete">
                                            <IconButton 
                                                color="error" 
                                                onClick={() => deleteSession(session._id)}
                                                className="admin-edit-delete-button"
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </Grid>
                                    </Grid>
                                </Paper>
                            ))}
                            
                            <Button 
                                startIcon={<AddCircleOutlineIcon />} 
                                onClick={addSession}
                                variant="outlined"
                                className="admin-edit-add-button admin-edit-add-button-session"
                            >
                                Add Session
                            </Button>
                        </Paper>

                        {/* Breaks Section */}
                        <Paper className="admin-edit-section admin-edit-section-breaks">
                            <Box className="admin-edit-section-header admin-edit-section-header-breaks">
                                <WatchLaterIcon className="admin-edit-section-icon admin-edit-section-icon-warning" />
                                <Typography className="admin-edit-section-title">Breaks</Typography>
                            </Box>
                            
                            {editableLog.breaks.map((brk, index) => (
                                <Paper key={brk._id} className="admin-edit-entry-card admin-edit-entry-card-break">
                                    <Grid container className="admin-edit-entry-grid">
                                        <Grid item className="admin-edit-entry-index">
                                            <Typography className="admin-edit-entry-index-text">
                                                #{index + 1}
                                            </Typography>
                                        </Grid>
                                        <Grid item className="admin-edit-entry-fields">
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={4}>
                                                    <FormControl fullWidth size="small" className="admin-edit-input admin-edit-input-break-type">
                                                        <InputLabel>Type</InputLabel>
                                                        <Select 
                                                            value={brk.breakType} 
                                                            label="Type" 
                                                            onChange={(e) => handleBreakChange(brk._id, 'breakType', e.target.value)}
                                                        >
                                                            <MenuItem value="Paid">Paid</MenuItem>
                                                            <MenuItem value="Unpaid">Unpaid</MenuItem>
                                                            <MenuItem value="Extra">Extra</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Grid>
                                                <Grid item xs={12} sm={4}>
                                                    <TextField 
                                                        label="Start Time" 
                                                        type="time" 
                                                        fullWidth 
                                                        size="small" 
                                                        value={formatTimeToHHMM(brk.startTime)} 
                                                        onChange={(e) => handleBreakChange(brk._id, 'startTime', e.target.value)} 
                                                        InputLabelProps={{ shrink: true }}
                                                        className="admin-edit-input admin-edit-input-break-time"
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={4}>
                                                    <TextField 
                                                        label="End Time" 
                                                        type="time" 
                                                        fullWidth 
                                                        size="small" 
                                                        value={formatTimeToHHMM(brk.endTime)} 
                                                        onChange={(e) => handleBreakChange(brk._id, 'endTime', e.target.value)} 
                                                        InputLabelProps={{ shrink: true }}
                                                        className="admin-edit-input admin-edit-input-break-time"
                                                    />
                                                </Grid>
                                            </Grid>
                                        </Grid>
                                        <Grid item className="admin-edit-entry-delete">
                                            <IconButton 
                                                color="error" 
                                                onClick={() => deleteBreak(brk._id)}
                                                className="admin-edit-delete-button"
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </Grid>
                                    </Grid>
                                </Paper>
                            ))}
                            
                            <Button 
                                startIcon={<AddCircleOutlineIcon />} 
                                onClick={addBreak}
                                variant="outlined"
                                className="admin-edit-add-button admin-edit-add-button-break"
                            >
                                Add Break
                            </Button>
                        </Paper>

                        {/* Notes Section */}
                        <Paper className="admin-edit-section admin-edit-section-notes">
                            <Box className="admin-edit-section-header admin-edit-section-header-notes">
                                <EditIcon className="admin-edit-section-icon admin-edit-section-icon-primary" />
                                <Typography className="admin-edit-section-title">Notes</Typography>
                            </Box>
                            
                            <TextField 
                                fullWidth 
                                multiline 
                                rows={4} 
                                label="Notes for the day"
                                placeholder="Add any additional notes or comments for this day..."
                                value={editableLog.notes || ''}
                                onChange={(e) => setEditableLog(prev => ({...prev, notes: e.target.value}))}
                                className="admin-edit-input admin-edit-input-notes"
                            />
                        </Paper>
                    </Stack>
                </DialogContent>
                <DialogActions className="admin-edit-dialog-actions">
                    <Button 
                        onClick={onClose}
                        variant="outlined"
                        className="admin-edit-cancel-button"
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={handleSaveChanges} 
                        disabled={isSaving}
                        startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
                        className="admin-edit-save-button"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </>
            )}
        </Dialog>
    );
};

export default LogDetailModal;