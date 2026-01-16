// src/components/AttendanceCalendar.jsx - IST-ENFORCED, BACKEND-DRIVEN
import React, { useMemo, memo } from 'react';
import { Typography, Box } from '@mui/material';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import { 
    getISTNow, 
    getISTDateString, 
    parseISTDate, 
    getISTDateParts,
    isSameISTDay
} from '../utils/istTime';
import {
    formatDuration,
    getDisplayStatus,
    isTodayIST
} from '../utils/attendanceRenderUtils';
import '../styles/AttendanceCalendar.css';

// Memoized calendar day cell component to prevent unnecessary re-renders
// Only re-renders when day-specific props change (status, log, etc.)
const DayCell = memo(({ day, onDayClick, holiday, leave }) => {
    const isFutureDate = day.date > getISTNow() && !day.log && day.status !== 'holiday' && day.status !== 'leave' && day.status !== 'weekend' && day.status !== 'week-off';
    const hasNoAttendanceData = !day.log || !day.log.sessions || day.log.sessions.length === 0;
    const isNotHolidayOrLeave = !day.status || (!day.status.startsWith('holiday') && !day.status.startsWith('leave') && day.status !== 'comp-off' && day.status !== 'swap-leave');
    const isClickable = !(isFutureDate && hasNoAttendanceData && isNotHolidayOrLeave);

    // Determine if this is a half-day leave for UI rendering (UI-only; backend remains source of truth)
    const isHalfDayLeave = leave?.leaveType && leave.leaveType.startsWith('Half Day');
    const leaveTypeText = day.log?.leaveInfo?.requestType
        ? formatLeaveRequestType(day.log.leaveInfo.requestType)
        : leave?.requestType
            ? formatLeaveRequestType(leave.requestType)
            : 'Leave';

    const lateMinutes = Number(day.log?.lateMinutes || 0);
    const isLateHalfDay = day.status === 'half-day' && day.log?.halfDayReasonCode === 'LATE_LOGIN';

    const dayData = {
        log: day.log,
        date: day.date,
        status: day.status,
        holiday,
        leave,
        hoursWorked: day.hoursWorked
    };

    return (
        <div 
            className={`calendar-day ${day.status} ${day.isToday ? 'today' : ''} ${!day.isCurrentMonth ? 'other-month' : ''} ${!isClickable ? 'non-clickable' : ''}`}
            onClick={isClickable ? () => onDayClick(dayData) : undefined}
        >
            <div className="day-number-wrapper">
                <div className="day-number">{day.dayNumber}</div>
            </div>
            
            {day.status === 'present' && (
                <div className="attendance-status present">
                    <div className="status-label">Present</div>
                    <div className="hours-worked">{day.hoursWorked}</div>
                </div>
            )}
            
            {day.status === 'half-day' && (
                <div className="attendance-status half-day">
                    {day.hoursWorked && (
                        <div className="status-meta status-meta-top">{day.hoursWorked}</div>
                    )}
                    <div className="status-badge">Half Day</div>
                    {isLateHalfDay ? (
                        <>
                            <div className="status-primary">Late Arrival</div>
                            <div className="status-secondary">Late by {lateMinutes} minutes</div>
                        </>
                    ) : (
                        <>
                            <div className="status-primary">Half Day</div>
                            {day.log?.halfDayReason && (
                                <div className="status-secondary">{day.log.halfDayReason}</div>
                            )}
                        </>
                    )}
                </div>
            )}
            
            {day.status === 'absent' && (
                <div className="attendance-status absent">
                    <div className="status-label">Absent</div>
                </div>
            )}
            
            {day.status === 'weekend' && (
                <div className="attendance-status weekend">
                    <div className="status-label">Weekend</div>
                </div>
            )}
            
            {day.status === 'week-off' && (
                <div className="attendance-status week-off">
                    <div className="status-label">Week Off</div>
                </div>
            )}
            
            {day.status === 'working-day' && (
                <div className="attendance-status working-day">
                    <div className="status-label">Working Day</div>
                </div>
            )}
            
            {day.status === 'holiday' && (
                <div className="attendance-status holiday">
                    <div className="holiday-name">{holiday?.name}</div>
                </div>
            )}
            
            {day.status === 'leave' && (
                <div className={`attendance-status leave ${isHalfDayLeave ? 'half-day-leave' : 'full-day-leave'}`} title={leave?.reason || ''}>
                    {/* Half-day leave: keep badge, move leave type into the translucent secondary box (no "Applied leave") */}
                    {isHalfDayLeave ? (
                        <>
                            {day.hoursWorked && (
                                <div className="status-meta status-meta-top">{day.hoursWorked}</div>
                            )}
                            <div className="status-badge">Half Day</div>
                            <div className="status-secondary">Leave — {leaveTypeText}</div>
                        </>
                    ) : (
                        <>
                            {/* Full-day leave: remove redundant top "Leave" text */}
                            <div className="status-primary">Full Day</div>
                            <div className="status-secondary">Leave — {leaveTypeText}</div>
                        </>
                    )}
                </div>
            )}
            
            {day.status === 'comp-off' && (
                <div className="attendance-status comp-off">
                    <div className="status-label">⚙️ Comp Off</div>
                    <div className="comp-off-type">Comp Off</div>
                </div>
            )}
            
            {day.status === 'swap-leave' && (
                <div className="attendance-status swap-leave">
                    <div className="status-label">🔁 Swap Leave</div>
                    <div className="swap-leave-type">Swap Leave</div>
                </div>
            )}
        </div>
    );
});

DayCell.displayName = 'DayCell';

// Status resolution is backend-driven; calendar only renders resolved data.
// All status logic (holidays, weekly offs, leaves, attendance) is determined by backend API.
const AttendanceCalendar = ({ logs, currentDate, onDayClick }) => {
    
    // Generate calendar data for the current month in IST
    const calendarData = useMemo(() => {
        const parts = getISTDateParts(currentDate);
        const year = parts.year;
        const monthIndex = parts.monthIndex;
        
        // Get first day of month and last day of month in IST
        const firstDay = parseISTDate(`${year}-${String(parts.month).padStart(2, '0')}-01`);
        // Note: new Date(year, monthIndex + 1, 0) uses browser timezone temporarily
        // This is immediately converted to IST string and parsed back for safety
        const lastDay = new Date(year, monthIndex + 1, 0);
        const lastDayIST = parseISTDate(getISTDateString(lastDay));
        
        // Get first Sunday of the calendar view in IST
        const firstDayWeekday = firstDay.getDay();
        // Temporary Date object for calculation - immediately converted to IST
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDayWeekday);
        const startDateIST = parseISTDate(getISTDateString(startDate));
        
        // Get last Saturday of the calendar view in IST
        const lastDayWeekday = lastDayIST.getDay();
        // Temporary Date object for calculation - immediately converted to IST
        const endDate = new Date(lastDayIST);
        endDate.setDate(endDate.getDate() + (6 - lastDayWeekday));
        const endDateIST = parseISTDate(getISTDateString(endDate));
        
        const days = [];
        const logMap = new Map((logs || []).map(log => [log.attendanceDate, log]));
        const todayIST = getISTNow();
        const todayStr = getISTDateString(todayIST);
        
        // Iterate through calendar days in IST
        // Start with IST date, but use temporary Date for iteration
        // Each iteration converts to IST string then parses back to ensure IST correctness
        let current = new Date(startDateIST);
        while (current <= endDateIST) {
            // CRITICAL: Convert to IST string then parse to ensure IST timezone
            const currentIST = parseISTDate(getISTDateString(current));
            const dateKey = getISTDateString(currentIST);
            const log = logMap.get(dateKey);
            
            // Determine if this day is in current month
            const currentParts = getISTDateParts(currentIST);
            const isCurrentMonth = currentParts.monthIndex === monthIndex;
            
            // Determine if this is today in IST
            const isToday = dateKey === todayStr;
            
            // Get status from backend via shared utility
            const statusInfo = getDisplayStatus(log, log?.holidayInfo, log?.leaveInfo);
            let status = 'blank';
            let hoursWorked = '';
            
            if (isCurrentMonth) {
                // Map status to calendar status codes
                if (statusInfo.status.startsWith('Holiday -')) {
                    status = 'holiday';
                } else if (statusInfo.status === 'Comp Off') {
                    status = 'comp-off';
                } else if (statusInfo.status === 'Swap Leave') {
                    status = 'swap-leave';
                } else if (statusInfo.status.startsWith('Leave -') || statusInfo.status === 'Leave' || statusInfo.status === 'On Leave') {
                    status = 'leave';
                    // UI-only: if backend indicates a half-day leave and provides worked minutes, display it (no recalculation)
                    const isHalfDayLeave = log?.leaveInfo?.leaveType && String(log.leaveInfo.leaveType).startsWith('Half Day');
                    if (isHalfDayLeave && log?.totalWorkedMinutes) {
                        hoursWorked = formatDuration(log.totalWorkedMinutes) + ' Hrs';
                    }
                } else if (statusInfo.status === 'Weekly Off' || statusInfo.status === 'Week Off' || statusInfo.status === 'Day Off') {
                    status = 'week-off';
                } else if (statusInfo.status === 'Weekend') {
                    status = 'weekend';
                } else if (statusInfo.status === 'Working Day') {
                    status = 'working-day';
                } else if (statusInfo.status === 'Absent') {
                    status = 'absent';
                } else if (statusInfo.status === 'Present' || statusInfo.status === 'On-time' || statusInfo.status === 'Late') {
                    status = 'present';
                    // Use backend computed totalWorkedMinutes
                    if (log?.totalWorkedMinutes) {
                        hoursWorked = formatDuration(log.totalWorkedMinutes) + ' Hrs';
                    }
                } else if (statusInfo.status === 'Half-day') {
                    status = 'half-day';
                    if (log?.totalWorkedMinutes) {
                        hoursWorked = formatDuration(log.totalWorkedMinutes) + ' Hrs';
                    }
                } else {
                    status = 'absent';
                }
                
                // CRITICAL: Backend has already resolved status for ALL dates
                // If no log exists for a date, backend still provides status
                // Frontend must use backend status - NO RECALCULATION
                
                // Defensive check: If backend says it's a holiday/weekly off but status is absent, log warning
                if (process.env.NODE_ENV === 'development' && log) {
                    if ((log.isHoliday || log.isWeeklyOff) && log.attendanceStatus === 'Absent') {
                        console.warn(`[STATUS MISMATCH] Date ${dateKey}: Backend flags indicate holiday/weekly off but status is Absent`, {
                            isHoliday: log.isHoliday,
                            isWeeklyOff: log.isWeeklyOff,
                            attendanceStatus: log.attendanceStatus
                        });
                    }
                }
            }
            
            days.push({
                date: currentIST,
                dayNumber: currentParts.day,
                status,
                hoursWorked,
                isCurrentMonth,
                isToday,
                log,
                leave: log?.leaveInfo || null,
                holiday: log?.holidayInfo || null
            });
            
            current.setDate(current.getDate() + 1);
        }
        
        return days;
    }, [logs, currentDate]); // Backend provides all resolved status data - no local props needed

    const monthName = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        month: 'long',
        year: 'numeric'
    }).format(parseISTDate(getISTDateString(currentDate)));
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="attendance-calendar-container">
            <div className="calendar-header">
                <Typography variant="h5" className="calendar-title">
                    {monthName}
                </Typography>
            </div>
            
            <div className="calendar-grid">
                <div className="calendar-header-row">
                    {dayNames.map(day => (
                        <div key={day} className="calendar-day-header">
                            {day}
                        </div>
                    ))}
                </div>
                
                <div className="calendar-days">
                    {calendarData.map((day, index) => (
                        <DayCell
                            key={day.log?.attendanceDate || `day-${index}`}
                            day={day}
                            onDayClick={onDayClick}
                            holiday={day.holiday}
                            leave={day.leave}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AttendanceCalendar;
