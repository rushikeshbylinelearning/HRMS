// src/components/AttendanceCalendar.jsx
import React, { useMemo } from 'react';
import { Typography, Box } from '@mui/material';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import '../styles/AttendanceCalendar.css';

// Optimized: Calculate 'now' internally to prevent unnecessary re-renders
const AttendanceCalendar = ({ logs, currentDate, onDayClick, holidays = [], leaves = [], saturdayPolicy = 'All Saturdays Working' }) => {
    // Helper function to check if a date is a holiday
    const getHolidayForDate = (date) => {
        // Use local date formatting to avoid timezone issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const holiday = holidays.find(holiday => {
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
        return holiday;
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

    // Generate calendar data for the current month
    const calendarData = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Get first day of month and last day of month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Get first Sunday of the calendar view
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        // Get last Saturday of the calendar view
        const endDate = new Date(lastDay);
        endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
        
        const days = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
            // Use local date formatting to avoid timezone issues
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;
            const log = logs.find(l => l.attendanceDate === dateKey);
            
            // UNIFIED RESOLUTION: Use backend's resolved attendanceStatus
            // The backend already resolves status using unified logic (Holiday > Leave > Weekend > Present > Absent)
            // The backend now returns dates with Absent status even when there's no log
            let status = 'blank';
            let hoursWorked = '';
            let isCurrentMonth = current.getMonth() === currentDate.getMonth();
            const now = new Date(); // Calculate inline
            let isToday = current.toDateString() === now.toDateString();
            
            // Use backend's resolved status if log/date entry exists (backend returns all dates with status)
            if (log && log.attendanceStatus) {
                const resolvedStatus = log.attendanceStatus;
                
                // Map backend resolved status to calendar display status
                if (resolvedStatus.startsWith('Holiday -')) {
                    status = 'holiday';
                } else if (resolvedStatus === 'Comp Off') {
                    status = 'comp-off';
                } else if (resolvedStatus === 'Swap Leave') {
                    status = 'swap-leave';
                } else if (resolvedStatus.startsWith('Leave -')) {
                    status = 'leave';
                } else if (resolvedStatus === 'Week Off') {
                    status = 'week-off';
                } else if (resolvedStatus === 'Weekend') {
                    status = 'weekend';
                } else if (resolvedStatus === 'Present' || resolvedStatus === 'On-time') {
                    status = 'present';
                } else if (resolvedStatus === 'Late') {
                    status = 'present'; // Late is still present, just late
                } else if (resolvedStatus === 'Half Day' || resolvedStatus === 'Half-day') {
                    status = 'half-day';
                } else if (resolvedStatus === 'Absent') {
                    status = 'absent';
                } else if (resolvedStatus === 'N/A') {
                    status = 'blank';
                } else {
                    // Fallback for any other status
                    status = 'blank';
                }
                
                // Calculate hours worked if log has sessions
                if (log.sessions && log.sessions.length > 0) {
                    let totalWorkTime = 0;
                    let totalBreakTime = 0;
                    
                    log.sessions.forEach(session => {
                        if (session.startTime) {
                            const start = new Date(session.startTime);
                            const now = new Date(); // Calculate inline for ongoing sessions
                            const end = session.endTime ? new Date(session.endTime) : now;
                            totalWorkTime += (end - start) / (1000 * 60 * 60);
                        }
                    });
                    
                    if (log.breaks && log.breaks.length > 0) {
                        log.breaks.forEach(breakLog => {
                            if (breakLog.startTime && breakLog.endTime) {
                                const start = new Date(breakLog.startTime);
                                const end = new Date(breakLog.endTime);
                                totalBreakTime += (end - start) / (1000 * 60 * 60);
                            }
                        });
                    }
                    
                    const netHours = Math.max(0, totalWorkTime - totalBreakTime);
                    const hours = Math.floor(netHours);
                    const minutes = Math.round((netHours - hours) * 60);
                    hoursWorked = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} Hrs`;
                }
            } else if (isCurrentMonth) {
                // No log for this date - check backend resolved status first
                // The backend should now include Absent dates, but if not, determine status based on day
                const dayOfWeek = current.getDay();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const checkDate = new Date(current);
                checkDate.setHours(0, 0, 0, 0);
                const isPastDate = checkDate < today;
                
                if (dayOfWeek === 0) {
                    status = 'weekend';
                } else if (dayOfWeek === 6) {
                    // Check Saturday policy
                    const weekNum = Math.ceil(current.getDate() / 7);
                    let isWorkingSaturday = true;
                    if (saturdayPolicy === 'All Saturdays Off') {
                        isWorkingSaturday = false;
                    } else if (saturdayPolicy === 'Week 1 & 3 Off' && (weekNum === 1 || weekNum === 3)) {
                        isWorkingSaturday = false;
                    } else if (saturdayPolicy === 'Week 2 & 4 Off' && (weekNum === 2 || weekNum === 4)) {
                        isWorkingSaturday = false;
                    }
                    if (!isWorkingSaturday) {
                        status = 'week-off';
                    } else if (isPastDate) {
                        // Past working Saturday without log = Absent
                        status = 'absent';
                    } else {
                        status = 'blank'; // Future working day
                    }
                } else {
                    // Weekday without log
                    if (isPastDate) {
                        // Past working day without log = Absent
                        status = 'absent';
                    } else {
                        status = 'blank'; // Future working day
                    }
                }
            }
            
            // Use leave and holiday from backend if available, otherwise fallback to local lookup
            const holidayForDate = log?.holiday ? {
                _id: log.holiday._id,
                name: log.holiday.name,
                date: log.holiday.date
            } : getHolidayForDate(current);
            const leaveForDate = log?.leave ? {
                _id: log.leave._id,
                requestType: log.leave.requestType,
                leaveType: log.leave.leaveType,
                status: log.leave.status,
                leaveDates: log.leave.leaveDates,
                reason: log.leave.reason
            } : getLeaveForDate(current);
            
            days.push({
                date: new Date(current),
                dayNumber: current.getDate(),
                status,
                hoursWorked,
                isCurrentMonth,
                isToday,
                log,
                leave: leaveForDate || null,
                holiday: holidayForDate || null
            });
            
            current.setDate(current.getDate() + 1);
        }
        
        return days;
    }, [logs, currentDate, holidays, leaves]);

    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="attendance-calendar-container">
            <div className="calendar-header">
                <Typography variant="h5" className="calendar-title">
                    {monthName}
                </Typography>
            </div>
            
            <div className="calendar-grid">
                {/* Day names header */}
                <div className="calendar-header-row">
                    {dayNames.map(day => (
                        <div key={day} className="calendar-day-header">
                            {day}
                        </div>
                    ))}
                </div>
                
                {/* Calendar days */}
                <div className="calendar-days">
                    {calendarData.map((day, index) => {
                        // Check if this day should be clickable
                        const now = new Date(); // Calculate inline
                        const today = new Date(now);
                        today.setHours(0, 0, 0, 0);
                        const clickedDate = new Date(day.date);
                        clickedDate.setHours(0, 0, 0, 0);
                        const isFutureDate = clickedDate > today;
                        const hasNoAttendanceData = !day.log || !day.log.sessions || day.log.sessions.length === 0;
                        const isNotHolidayOrLeave = !day.status || (!day.status.startsWith('holiday') && !day.status.startsWith('leave') && day.status !== 'comp-off' && day.status !== 'swap-leave');
                        const isClickable = !(isFutureDate && hasNoAttendanceData && isNotHolidayOrLeave);

                        const holiday = day.holiday || getHolidayForDate(day.date);
                        const leave = day.leave || getLeaveForDate(day.date);
                        const isHalfDayLeave = leave?.leaveType && leave.leaveType.startsWith('Half Day');
                        const leaveInitial = leave ? (isHalfDayLeave ? 'HF' : 'FF') : null;

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
                                key={index}
                                className={`calendar-day ${day.status} ${day.isToday ? 'today' : ''} ${!day.isCurrentMonth ? 'other-month' : ''} ${!isClickable ? 'non-clickable' : ''}`}
                                onClick={isClickable ? () => onDayClick(dayData) : undefined}
                            >
                            <div className={`day-number-wrapper ${leaveInitial ? 'has-leave' : ''}`}>
                                <div className="day-number">{day.dayNumber}</div>
                                {leaveInitial && (
                                    <span className={`leave-initial-chip ${isHalfDayLeave ? 'half-day' : 'full-day'}`}>
                                        {leaveInitial}
                                    </span>
                                )}
                            </div>
                            
                            {day.status === 'present' && (
                                <div className="attendance-status present">
                                    <div className="status-label">Present</div>
                                    <div className="hours-worked">{day.hoursWorked}</div>
                                </div>
                            )}
                            
                            {day.status === 'half-day' && (
                                <div className="attendance-status half-day">
                                    <div className="status-label">Half Day</div>
                                    <div className="hours-worked">{day.hoursWorked}</div>
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
                                    <div className="status-label">Holiday</div>
                                    <div className="holiday-name">{holiday?.name}</div>
                                </div>
                            )}
                            
                            {day.status === 'leave' && (
                                <div className="attendance-status leave">
                                    <div className="status-label">Leave</div>
                                    <div className="leave-type">{formatLeaveRequestType(leave?.requestType || getLeaveForDate(day.date)?.requestType)}</div>
                                    {leave?.leaveType && (
                                        <div className="leave-day-type" style={{ 
                                            fontSize: '0.7rem', 
                                            marginTop: '2px',
                                            fontWeight: 500
                                        }}>
                                            {leave.leaveType === 'Full Day' ? 'Full Day' : leave.leaveType}
                                        </div>
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
                    })}
                </div>
            </div>
        </div>
    );
};

export default AttendanceCalendar;