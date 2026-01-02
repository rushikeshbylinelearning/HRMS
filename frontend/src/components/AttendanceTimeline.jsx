// src/components/AttendanceTimeline.jsx
import React, { useMemo } from 'react';
import { Typography, Box, Paper } from '@mui/material';
import DailyTimelineRow from './DailyTimelineRow';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import { findLeaveForDate, findHolidayForDate } from '../utils/dateUtils';
import '../styles/AttendanceTimeline.css';

// Helper to format shift time from "HH:mm" to "hh:mm AM/PM"
const formatShiftTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const date = new Date(0, 0, 0, hours, minutes);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// Helper to format total minutes into HH:MM Hrs
const formatDuration = (totalMins) => {
    if (isNaN(totalMins) || totalMins < 0) return '00:00 Hrs';
    const hours = String(Math.floor(totalMins / 60)).padStart(2, '0');
    const minutes = String(Math.round(totalMins % 60)).padStart(2, '0');
    return `${hours}:${minutes} Hrs`;
};

// Optimized: Calculate 'now' internally to prevent unnecessary re-renders
const AttendanceTimeline = ({ logs, currentDate, onDayClick, saturdayPolicy = 'All Saturdays Working', shiftInfo, isAdminView, holidays = [], leaves = [] }) => {

    // Helper function to check if a date is a holiday
    // CRITICAL FIX: Use centralized date utility to handle timezone issues
    const getHolidayForDate = (date) => {
        return findHolidayForDate(date, holidays);
    };

    // Helper function to check if a date is a leave
    // CRITICAL FIX: Use centralized date utility to handle timezone issues
    // This ensures compensatory leaves and all leave types are found correctly
    const getLeaveForDate = (date) => {
        return findLeaveForDate(date, leaves);
    };

    const weekDays = useMemo(() => {
        const start = new Date(currentDate);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - start.getDay());

        const today = new Date(); // Calculate inline instead of using prop
        today.setHours(0, 0, 0, 0);

        const days = [];
        const logMap = new Map((logs || []).map(log => [new Date(log.attendanceDate).toLocaleDateString('en-CA'), log]));

        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateString = d.toLocaleDateString('en-CA');
            const log = logMap.get(dateString);
            let status = ''; 

            // UNIFIED RESOLUTION: Use backend's resolved attendanceStatus
            // The backend already resolves status using unified logic (Holiday > Leave > Weekend > Present > Absent)
            if (log && log.attendanceStatus) {
                // Use backend's resolved status directly
                status = log.attendanceStatus;
            } else {
                // No log - determine status based on day of week and Saturday policy
                const dayOfWeek = d.getDay();
                if (dayOfWeek === 0) {
                    status = 'Weekend';
                } else if (dayOfWeek === 6) {
                    const weekNum = Math.ceil(d.getDate() / 7);
                    let isWorkingSaturday = true;
                    if (saturdayPolicy === 'All Saturdays Off') {
                        isWorkingSaturday = false;
                    } else if (saturdayPolicy === 'Week 1 & 3 Off' && (weekNum === 1 || weekNum === 3)) {
                        isWorkingSaturday = false;
                    } else if (saturdayPolicy === 'Week 2 & 4 Off' && (weekNum === 2 || weekNum === 4)) {
                        isWorkingSaturday = false;
                    }

                    if (!isWorkingSaturday) {
                        status = 'Week Off';
                    } else if (d.getTime() < today.getTime()) {
                        status = 'Absent';
                    } else {
                        status = 'Working Day';
                    }
                } else {
                    // Weekday without log
                    if (d.getTime() < today.getTime()) {
                        status = 'Absent';
                    } else {
                        status = 'Working Day';
                    }
                }
            }
            
            // Use leave and holiday from backend if available, otherwise fallback to local lookup
            const holiday = log?.holiday ? {
                _id: log.holiday._id,
                name: log.holiday.name,
                date: log.holiday.date
            } : getHolidayForDate(d);
            const leave = log?.leave ? {
                _id: log.leave._id,
                requestType: log.leave.requestType,
                leaveType: log.leave.leaveType,
                status: log.leave.status,
                leaveDates: log.leave.leaveDates,
                reason: log.leave.reason
            } : getLeaveForDate(d);

            days.push({ 
                date: d, 
                log: log,
                status: status,
                leave: leave || null,
                holiday: holiday || null
            });
        }
        return days;
    }, [logs, currentDate, saturdayPolicy, holidays, leaves]);

    const summaryStats = useMemo(() => {
        const stats = { present: 0 };
        weekDays.forEach(day => {
            if (day.log) {
                stats.present++;
            }
        });
        stats.payable = stats.present; // Simplified for now
        return stats;
    }, [weekDays]);

    const summaryHours = useMemo(() => {
        let totalMinutes = 0;
        weekDays.forEach(day => {
            if (day.log && day.log.sessions) {
                const totalSessionMs = day.log.sessions.reduce((acc, s) => {
                    const sessionStart = new Date(s.startTime);
                    const now = new Date(); // Calculate inline for ongoing session check
                    const isTodayOngoing = !s.endTime && new Date(s.startTime).toDateString() === now.toDateString();
                    const sessionEnd = s.endTime ? new Date(s.endTime) : (isTodayOngoing ? now : sessionStart);
                    
                    return acc + (sessionEnd - sessionStart);
                }, 0);
                 const totalBreakMs = (day.log.breaks || []).reduce((acc, b) => {
                    if (b.startTime && b.endTime) {
                        return acc + (new Date(b.endTime) - new Date(b.startTime));
                    }
                    return acc;
                }, 0);
                const netMs = Math.max(0, totalSessionMs - totalBreakMs);
                totalMinutes += netMs / 60000;
            }
        });
        return formatDuration(totalMinutes);
    }, [weekDays]);

    const timeAxisLabels = ['10AM', '11AM', '12PM', '01PM', '02PM', '03PM', '04PM', '05PM', '06PM', '07PM'];

    return (
        <div className="attendance-timeline-container">
            {/* Daily Attendance Cards */}
            <div className="daily-cards-container">
                {weekDays.map(day => (
                    <DailyTimelineRow 
                        key={day.date.toISOString()} 
                        dayData={day}
                        onClick={() => onDayClick(day)}
                        shiftInfo={shiftInfo}
                    />
                ))}
            </div>

            {/* Time Axis */}
            <div className="time-axis-container">
                <div className="time-axis">
                    {timeAxisLabels.map(label => <span key={label} className="time-label">{label}</span>)}
                </div>
            </div>
            
            {/* Summary Section */}
            <div className="summary-section">
                <div className="summary-header-card">
                    <div className="summary-header-text">
                        <span>Days</span>
                        <span>Hours</span>
                    </div>
                </div>
                <div className="summary-cards">
                    <div className="summary-card total-hours">
                        <div className="summary-card-indicator"></div>
                        <div className="summary-card-content">
                            <span className="summary-card-label">Total Hours</span>
                            <span className="summary-card-value">{summaryHours}</span>
                        </div>
                    </div>
                    <div className="summary-card payable-hours">
                        <div className="summary-card-indicator"></div>
                        <div className="summary-card-content">
                            <span className="summary-card-label">Payable Hours</span>
                            <span className="summary-card-value">54:00 Hrs</span>
                        </div>
                    </div>
                    <div className="summary-card present-hours">
                        <div className="summary-card-indicator"></div>
                        <div className="summary-card-content">
                            <span className="summary-card-label">Present Hours</span>
                            <span className="summary-card-value">00:00 Hrs</span>
                        </div>
                    </div>
                    <div className="summary-card on-duty">
                        <div className="summary-card-indicator"></div>
                        <div className="summary-card-content">
                            <span className="summary-card-label">On Duty</span>
                            <span className="summary-card-value">00:00 Hrs</span>
                        </div>
                    </div>
                    <div className="summary-card paid-leave">
                        <div className="summary-card-indicator"></div>
                        <div className="summary-card-content">
                            <span className="summary-card-label">Planned leave</span>
                            <span className="summary-card-value">00:00 Hrs</span>
                        </div>
                    </div>
                    <div className="summary-card holidays">
                        <div className="summary-card-indicator"></div>
                        <div className="summary-card-content">
                            <span className="summary-card-label">Holidays</span>
                            <span className="summary-card-value">00:00 Hrs</span>
                        </div>
                    </div>
                    <div className="summary-more">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="4" cy="8" r="1"/>
                            <circle cx="8" cy="8" r="1"/>
                            <circle cx="12" cy="8" r="1"/>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceTimeline;