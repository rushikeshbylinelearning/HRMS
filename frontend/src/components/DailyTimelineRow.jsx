// src/components/DailyTimelineRow.jsx
import React, { Fragment, useState, useEffect, useRef, useMemo } from 'react';
import { Typography, Box, Chip } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import dayjs from 'dayjs';

// --- CONFIGURATION & HELPERS ---
const FULL_DAY_MINUTES = 480; // 8 hours * 60 minutes
const HALF_DAY_MINUTES = 300; // 5 hours * 60 minutes

/**
 * Parses a time string in "HH:mm" format and returns hours as a decimal number.
 * @param {string} timeStr - Time string in "HH:mm" format
 * @returns {number} - Hours as decimal (e.g., "14:30" -> 14.5)
 */
const parseTimeString = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes || 0) / 60;
};

/**
 * Creates a dayjs object for a time on a specific date.
 * @param {Date|dayjs.Dayjs} date - The date
 * @param {string} timeStr - Time string in "HH:mm" format
 * @returns {dayjs.Dayjs} - dayjs object
 */
const createTimeOnDate = (date, timeStr) => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return dayjs(date).hour(hours).minute(minutes || 0).second(0).millisecond(0);
};

/**
 * Normalizes a time relative to shift start, handling overnight shifts.
 * Returns normalized hours (e.g., next day 01:00 = 25.0)
 * @param {string|Date|dayjs.Dayjs} dateTime - The datetime to normalize
 * @param {dayjs.Dayjs} shiftStart - Shift start time
 * @param {Object} shiftInfo - Shift information { startTime, endTime }
 * @returns {number} - Normalized hours from shift start
 */
const normalizeTimeToShift = (dateTime, shiftStart, shiftInfo) => {
    if (!dateTime || !shiftStart || !shiftInfo) return 0;
    
    let time = dayjs(dateTime);
    const startHours = parseTimeString(shiftInfo.startTime);
    const endHours = parseTimeString(shiftInfo.endTime);
    const isOvernightShift = endHours < startHours;
    
    // Calculate hours difference
    let diffMs = time.diff(shiftStart);
    let diffHours = diffMs / (1000 * 60 * 60);
    
    // For overnight shifts, check if time is on next day but within shift window
    if (isOvernightShift) {
        // If time is before shiftStart on same day, it's from previous shift (negative)
        // If time is after midnight but before endTime, it's within the shift window
        const timeHours = time.hour() + time.minute() / 60;
        const daysDiff = time.diff(shiftStart, 'day');
        
        if (daysDiff === 1 && timeHours < endHours) {
            // Time is on next day but before shift end (e.g., 1 AM for 4 PM - 1 AM shift)
            // Calculate as: hours from shift start to midnight + hours from midnight to time
            diffHours = (24 - startHours) + timeHours;
        } else if (daysDiff === 0 && diffHours < 0) {
            // Time is before shift start on same day - likely from previous shift
            // Don't normalize, return 0 or negative (we'll clamp to 0)
            return 0;
        }
    }
    
    return Math.max(0, diffHours);
};

/**
 * Converts a datetime to a percentage position on the timeline based on shift window.
 * @param {string|Date|dayjs.Dayjs} dateTime - The datetime to convert
 * @param {Object} shiftInfo - Shift information { startTime, endTime }
 * @param {Date} attendanceDate - The attendance date
 * @param {number} shiftDurationHours - Total shift duration in hours
 * @returns {number} - Percentage position (0-100+ for overtime)
 */
const timeToPercentage = (dateTime, shiftInfo, attendanceDate, shiftDurationHours) => {
    if (!dateTime || !shiftInfo || !shiftInfo.startTime || shiftDurationHours <= 0) return 0;
    
    const shiftStart = createTimeOnDate(attendanceDate, shiftInfo.startTime);
    if (!shiftStart) return 0;
    
    const normalizedHours = normalizeTimeToShift(dateTime, shiftStart, shiftInfo);
    const percentage = (normalizedHours / shiftDurationHours) * 100;
    
    return Math.max(0, percentage);
};

/**
 * Calculates shift duration in hours, handling overnight shifts.
 * @param {Object} shiftInfo - Shift information { startTime, endTime }
 * @returns {number} - Shift duration in hours
 */
const calculateShiftDuration = (shiftInfo) => {
    if (!shiftInfo || !shiftInfo.startTime || !shiftInfo.endTime) {
        // Default to 8 hours if no shift info
        return 8;
    }
    
    const startHours = parseTimeString(shiftInfo.startTime);
    const endHours = parseTimeString(shiftInfo.endTime);
    
    // If end is before start, it's an overnight shift
    if (endHours < startHours) {
        return (24 - startHours) + endHours;
    } else {
        return endHours - startHours;
    }
};

/**
 * Normalizes a time pair for cross-day scenarios and returns both times as dayjs objects.
 * 
 * @param {string|Date} startTime - Start time
 * @param {string|Date} endTime - End time
 * @returns {Object} - { start: dayjs, end: dayjs (normalized) }
 */
const normalizeTimePair = (startTime, endTime) => {
    if (!startTime) return { start: null, end: null };
    
    const start = dayjs(startTime);
    let end = endTime ? dayjs(endTime) : null;
    
    if (end && end.isBefore(start)) {
        end = end.add(1, 'day');
    }
    
    return { start, end };
};

const formatTime = (dateTime) => dateTime ? new Date(dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--';

const getDurationInfo = (log, now) => {
    if (!log || !log.sessions?.length) return { formatted: '00:00:00', totalMinutes: 0 };
    
    const totalSessionMs = log.sessions.reduce((acc, s) => {
        const start = new Date(s.startTime);
        const end = s.endTime ? new Date(s.endTime) : now;
        return acc + (end - start);
    }, 0);

    const totalBreakMs = (log.breaks || []).reduce((acc, b) => {
        const start = new Date(b.startTime);
        const end = b.endTime ? new Date(b.endTime) : now;
        return acc + (end - start);
    }, 0);

    const netMs = Math.max(0, totalSessionMs - totalBreakMs);
    const totalMinutes = Math.floor(netMs / 60000);

    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    const seconds = String(Math.floor((netMs / 1000) % 60)).padStart(2, '0');
    
    return { 
        formatted: `${hours}:${minutes}:${seconds}`,
        totalMinutes 
    };
};

// Optimized: Calculate 'now' internally using refs for real-time updates
const DailyTimelineRow = ({ dayData, onClick, shiftInfo }) => {
    const { date, log, status, leave } = dayData;
    const [now, setNow] = useState(new Date());
    const intervalRef = useRef(null);
    const rafRef = useRef(null);
    const lastTimeStringRef = useRef('');
    
    // Only update timer if this is today and there's an active session
    const isToday = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rowDate = new Date(date);
        rowDate.setHours(0, 0, 0, 0);
        return today.getTime() === rowDate.getTime();
    }, [date]);
    
    const hasActiveSession = useMemo(() => {
        return log?.sessions?.some(s => !s.endTime);
    }, [log]);
    
    // Only run timer if today and has active session
    useEffect(() => {
        if (!isToday || !hasActiveSession) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }
        
        const updateTime = () => {
            const currentNow = new Date();
            const timeString = currentNow.toISOString();
            
            // Only update state if time actually changed (prevents unnecessary re-renders)
            if (lastTimeStringRef.current !== timeString) {
                lastTimeStringRef.current = timeString;
                setNow(currentNow);
            }
        };
        
        updateTime();
        
        intervalRef.current = setInterval(() => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
            rafRef.current = requestAnimationFrame(updateTime);
        }, 1000);
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [isToday, hasActiveSession]);
    
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayOfMonth = date.getDate();
    
    // Calculate shift duration
    const shiftDurationHours = calculateShiftDuration(shiftInfo);

    // Check if this day should be clickable
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const clickedDate = new Date(date);
    clickedDate.setHours(0, 0, 0, 0);
    const isFutureDate = clickedDate > today;
    const hasNoAttendanceData = !log || !log.sessions || log.sessions.length === 0;
    const isNotHolidayOrLeave = !status || (!status.startsWith('Holiday -') && !status.startsWith('Leave -') && status !== 'Comp Off' && status !== 'Swap Leave');
    const isClickable = !(isFutureDate && hasNoAttendanceData && isNotHolidayOrLeave);

    const durationInfo = getDurationInfo(log, now);
    
    // Check if employee has clocked out (has clockOutTime or all sessions have endTime)
    const hasClockOut = log?.clockOutTime || (log?.sessions && log.sessions.length > 0 && log.sessions.every(s => s.endTime));
    
    // Calculate working hours to check for half-day (at component level so it's accessible everywhere)
    const workingHours = durationInfo.totalMinutes / 60;
    const MINIMUM_FULL_DAY_HOURS = 8;
    // Only mark as half-day if employee has clocked out AND worked less than 8 hours
    const isHalfDayByHours = hasClockOut && workingHours > 0 && workingHours < MINIMUM_FULL_DAY_HOURS;
    
    // Check if attendance is marked as half-day (late beyond grace period or working hours < 8 after clock-out)
    const isHalfDayMarked = hasClockOut && (log?.isHalfDay || log?.attendanceStatus === 'Half-day' || isHalfDayByHours);
    
    // Check if there's a half day leave
    const isHalfDayLeave = leave?.leaveType && leave.leaveType.startsWith('Half Day');

    const renderTimelineContent = () => {
        if (log && log.sessions && log.sessions.length > 0) {
            const sessions = log.sessions;
            const checkInTime = sessions[0]?.startTime;
            const checkOutTime = sessions[sessions.length - 1]?.endTime;
            
            // Use shift info or default to 9:00-18:00
            const effectiveShiftInfo = shiftInfo || { startTime: '09:00', endTime: '18:00' };
            
            // Calculate timeline width - base is 100% for shift duration, extend for overtime
            const maxEndTime = checkOutTime || now;
            const maxEndPercentage = timeToPercentage(maxEndTime, effectiveShiftInfo, date, shiftDurationHours);
            const timelineWidth = Math.max(100, maxEndPercentage);
            
            return (
                <div className="timeline-content" style={{ position: 'relative', width: `${timelineWidth}%` }}>
                    {/* Half Day Leave Badge */}
                    {isHalfDayLeave && (
                        <div style={{ 
                            position: 'absolute',
                            top: '-20px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: '#fff3cd',
                            color: '#856404',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            border: '1px solid #ffc107',
                            zIndex: 10,
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            {leave.leaveType}
                        </div>
                    )}
                    {/* Half Day Marked Badge (late beyond grace period or working hours < 8) */}
                    {isHalfDayMarked && !isHalfDayLeave && (
                        <div style={{ 
                            position: 'absolute',
                            top: '-20px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: '#ffebee',
                            color: '#c62828',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            border: '1px solid #d32f2f',
                            zIndex: 10,
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            Half Day {isHalfDayByHours ? '(Less than 8 hours)' : '(Late beyond grace period)'}
                        </div>
                    )}
                    <div className="timeline-line" style={
                        isHalfDayLeave ? { borderTop: '2px dashed #ffc107' } : 
                        isHalfDayMarked ? { borderTop: '2px dashed #d32f2f' } : {}
                    }>
                        {/* Check-in marker */}
                        {checkInTime && (
                            <div className="timeline-marker check-in-marker" style={{ left: `${timeToPercentage(checkInTime, effectiveShiftInfo, date, shiftDurationHours)}%` }}>
                                <div className="marker-dot"></div>
                            </div>
                        )}
                        
                        {/* Work period segments (excluding breaks) */}
                        {(() => {
                            const workSegments = [];
                            const checkInPos = timeToPercentage(checkInTime, effectiveShiftInfo, date, shiftDurationHours);
                            let currentStart = checkInPos;
                            
                            // Sort breaks by start time
                            const sortedBreaks = (log.breaks || []).sort((a, b) => 
                                new Date(a.startTime) - new Date(b.startTime)
                            );
                            
                            sortedBreaks.forEach(breakItem => {
                                const breakStartPos = timeToPercentage(breakItem.startTime, effectiveShiftInfo, date, shiftDurationHours);
                                const breakEndPos = timeToPercentage(breakItem.endTime || now, effectiveShiftInfo, date, shiftDurationHours);
                                
                                // Add work segment before break
                                if (breakStartPos > currentStart) {
                                    workSegments.push({
                                        left: currentStart,
                                        width: breakStartPos - currentStart
                                    });
                                }
                                
                                // Update current start to after break
                                currentStart = breakEndPos;
                            });
                            
                            // Add final segment after last break
                            const finalEndPos = checkOutTime ? 
                                timeToPercentage(checkOutTime, effectiveShiftInfo, date, shiftDurationHours) : 
                                timeToPercentage(now, effectiveShiftInfo, date, shiftDurationHours);
                            
                            if (currentStart < finalEndPos) {
                                workSegments.push({
                                    left: currentStart,
                                    width: finalEndPos - currentStart
                                });
                            }
                            
                            return workSegments.map((segment, index) => (
                                <div 
                                    key={`work-segment-${index}`}
                                    className="work-period-line"
                                    style={{ 
                                        left: `${segment.left}%`, 
                                        width: `${segment.width}%` 
                                    }}
                                ></div>
                            ));
                        })()}
                        
                        {/* Break bars and markers */}
                        {log.breaks && log.breaks.map((br, index) => {
                            const breakStartPercentage = timeToPercentage(br.startTime, effectiveShiftInfo, date, shiftDurationHours);
                            const breakEndPercentage = timeToPercentage(br.endTime || now, effectiveShiftInfo, date, shiftDurationHours);
                            const breakWidth = breakEndPercentage - breakStartPercentage;
                            
                            return (
                                <Fragment key={`break-${index}`}>
                                    {/* Break start marker */}
                                    <div 
                                        className="timeline-marker break-start-marker" 
                                        style={{ left: `${breakStartPercentage}%` }}
                                    >
                                        <div className="marker-dot"></div>
                                    </div>
                                    
                                    {/* Break bar */}
                                    <div 
                                        className={`break-bar ${!br.endTime ? 'active-break' : ''}`}
                                        style={{ 
                                            left: `${breakStartPercentage}%`, 
                                            width: `${breakWidth}%` 
                                        }}
                                        title={`Break: ${formatTime(br.startTime)} - ${br.endTime ? formatTime(br.endTime) : 'Ongoing'}`}
                                    ></div>
                                    
                                    {/* Break end marker */}
                                    {br.endTime && (
                                        <div 
                                            className="timeline-marker break-end-marker" 
                                            style={{ left: `${breakEndPercentage}%` }}
                                        >
                                            <div className="marker-dot"></div>
                                        </div>
                                    )}
                                </Fragment>
                            );
                        })}
                        
                        {/* Check-out marker */}
                        {checkOutTime && (
                            <div className="timeline-marker check-out-marker" style={{ left: `${timeToPercentage(checkOutTime, effectiveShiftInfo, date, shiftDurationHours)}%` }}>
                                <div className="marker-dot"></div>
                            </div>
                        )}
                        
                        {/* Current time indicator for today */}
                        {isToday && !checkOutTime && (
                            <div className="current-time-indicator" style={{ left: `${timeToPercentage(now, effectiveShiftInfo, date, shiftDurationHours)}%` }}>
                                <div className="current-time-line"></div>
                                <div className="current-time-dot"></div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // Handle different status types
        if (status && status.startsWith('Holiday -')) {
            const holidayName = status.replace('Holiday - ', '');
            return (
                <div className="timeline-content">
                    <div className="timeline-line">
                        <div className="status-line holiday-line"></div>
                        <div className="status-label holiday-label">Holiday</div>
                        <div className="holiday-name">{holidayName}</div>
                    </div>
                </div>
            );
        }
        
        if (status && status.startsWith('Leave -')) {
            const leaveType = status.replace('Leave - ', '');
            // Get leave type information (Full Day or Half Day)
            const leaveTypeInfo = leave?.leaveType || '';
            const isHalfDay = leaveTypeInfo && leaveTypeInfo.startsWith('Half Day');
            const halfDayInfo = isHalfDay ? leaveTypeInfo : '';
            
            return (
                <div className="timeline-content">
                    <div className="timeline-line">
                        <div className="status-line leave-line"></div>
                        <div className="status-label leave-label">Leave</div>
                        <div className="leave-type">{leaveType}</div>
                        {isHalfDay && (
                            <div className="leave-half-day-info" style={{ 
                                fontSize: '0.75rem', 
                                color: '#f57c00', 
                                fontWeight: 600,
                                marginTop: '4px'
                            }}>
                                {halfDayInfo}
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        
        if (status === 'Comp Off') {
            return (
                <div className="timeline-content">
                    <div className="timeline-line">
                        <div className="status-line comp-off-line"></div>
                        <div className="status-label comp-off-label">⚙️ Comp Off</div>
                        <div className="comp-off-type">Comp Off</div>
                    </div>
                </div>
            );
        }
        
        if (status === 'Swap Leave') {
            return (
                <div className="timeline-content">
                    <div className="timeline-line">
                        <div className="status-line swap-leave-line"></div>
                        <div className="status-label swap-leave-label">🔁 Swap Leave</div>
                        <div className="swap-leave-type">Swap Leave</div>
                    </div>
                </div>
            );
        }
        if (status === 'Day Off') {
            return (
                <div className="timeline-content">
                    <div className="timeline-line">
                        <div className="status-line weekend-line"></div>
                        <div className="status-label weekend-label">Day Off</div>
                    </div>
                </div>
            );
        }
        
        switch (status) {
            case 'Weekend':
                return (
                    <div className="timeline-content">
                        <div className="timeline-line">
                            <div className="status-line weekend-line"></div>
                            <div className="status-label weekend-label">Weekend</div>
                        </div>
                    </div>
                );
            case 'Absent':
                return (
                    <div className="timeline-content">
                        <div className="timeline-line">
                            <div className="status-line absent-line"></div>
                            <div className="status-label absent-label">Absent</div>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="timeline-content">
                        <div className="timeline-line">
                            <div className="status-line working-day-line"></div>
                            <div className="status-label working-day-label">Working Day</div>
                        </div>
                    </div>
                );
        }
    };

    // Get check-in and check-out times for display
    const getCheckInTime = () => {
        if (log && log.sessions && log.sessions.length > 0) {
            return formatTime(log.sessions[0]?.startTime);
        }
        return '--:--';
    };

    const getCheckOutTime = () => {
        if (log && log.sessions && log.sessions.length > 0) {
            const lastSession = log.sessions[log.sessions.length - 1];
            return formatTime(lastSession?.endTime);
        }
        return '--:--';
    };

    return (
        <div 
            className={`daily-card ${isToday ? 'today' : ''} ${!isClickable ? 'non-clickable' : ''}`} 
            onClick={isClickable ? onClick : undefined}
        >
            {/* Left: Date and Day */}
            <div className="date-section">
                <div className="day-name">{isToday ? 'Today' : dayOfWeek}</div>
                <div className={`day-number ${isToday ? 'today-highlight' : ''}`}>{dayOfMonth}</div>
            </div>
            
            {/* Middle: Timeline with Check-in/Check-out Times */}
            <div className="timeline-section">
                {/* Check-in Time Display */}
                <div className="check-time-display check-in-time">
                    {getCheckInTime()}
                </div>
                
                {/* Timeline Content */}
                <div className="timeline-content-wrapper">
                    {renderTimelineContent()}
                </div>
                
                {/* Check-out Time Display */}
                <div className="check-time-display check-out-time">
                    {getCheckOutTime()}
                </div>
            </div>
            
            {/* Right: Hours Worked */}
            <div className="hours-section">
                <div className="hours-worked">
                    {isToday && log && !log.clockOutTime ? durationInfo.formatted : durationInfo.formatted.slice(0, 5)} Hrs worked
                </div>
                {/* Show half day leave info if present, even when there's attendance data */}
                {leave?.leaveType && leave.leaveType.startsWith('Half Day') && (
                    <div style={{ 
                        fontSize: '0.7rem',
                        color: '#f57c00',
                        fontWeight: 600,
                        marginTop: '4px',
                        textAlign: 'center'
                    }}>
                        {leave.leaveType}
                    </div>
                )}
                {/* Show half day marked info if attendance is marked as half-day or working hours < 8 */}
                {log && isHalfDayMarked && !leave?.leaveType?.startsWith('Half Day') && (
                    <div style={{ 
                        fontSize: '0.7rem',
                        color: '#d32f2f',
                        fontWeight: 600,
                        marginTop: '4px',
                        textAlign: 'center',
                        backgroundColor: '#ffebee',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid #d32f2f'
                    }}>
                        Half Day {isHalfDayByHours ? '(Less than 8 hours)' : '(Late)'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyTimelineRow;