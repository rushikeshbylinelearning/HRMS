// src/components/AttendanceTimeline.jsx - IST-ENFORCED, BACKEND-DRIVEN
import React, { useMemo, memo } from 'react';
import { Typography, Box, Paper } from '@mui/material';
import DailyTimelineRow from './DailyTimelineRow';
import { 
    getISTNow, 
    getISTDateString, 
    parseISTDate, 
    getISTWeekRange,
    isSameISTDay
} from '../utils/istTime';
import {
    formatDuration,
    getDisplayStatus
} from '../utils/attendanceRenderUtils';
import '../styles/AttendanceTimeline.css';

// Helper to format shift time from "HH:mm" to "hh:mm AM/PM" in IST
const formatShiftTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    // Create a date at midnight IST, then set the hours
    const todayIST = getISTNow();
    const todayStr = getISTDateString(todayIST);
    const date = parseISTDate(`${todayStr}T${hours}:${minutes}:00+05:30`);
    return date.toLocaleTimeString('en-US', { 
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    });
};

// Optimized: Calculate 'now' internally using IST
const AttendanceTimeline = ({ logs, currentDate, onDayClick, saturdayPolicy = 'All Saturdays Working', shiftInfo, isAdminView, holidays = [], summary = null }) => {
    
    const weekDays = useMemo(() => {
        // Generate week days in IST
        const weekRange = getISTWeekRange(currentDate);
        const todayIST = getISTNow();
        const todayStr = getISTDateString(todayIST);
        
        const days = [];
        const logMap = new Map((logs || []).map(log => [log.attendanceDate, log]));
        
        // Generate 7 days starting from Sunday
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekRange.startDate);
            date.setDate(date.getDate() + i);
            const dateIST = parseISTDate(getISTDateString(date));
            const dateStr = getISTDateString(dateIST);
            const log = logMap.get(dateStr);
            
            // Use backend computed fields - holidayInfo and leaveInfo come from backend
            const holidayInfo = log?.holidayInfo || null;
            const leaveInfo = log?.leaveInfo || null;
            
            // CRITICAL: Backend has already resolved status with proper precedence
            // Frontend MUST use backend status - NO RECALCULATION
            const statusInfo = getDisplayStatus(log, holidayInfo, leaveInfo);
            const status = statusInfo.status;
            
            // Defensive check: If backend says it's a holiday/weekly off but status is Absent, log warning
            if (process.env.NODE_ENV === 'development' && log) {
                if ((log.isHoliday || log.isWeeklyOff) && log.attendanceStatus === 'Absent') {
                    console.warn(`[STATUS MISMATCH] Date ${dateStr}: Backend flags indicate holiday/weekly off but status is Absent`, {
                        isHoliday: log.isHoliday,
                        isWeeklyOff: log.isWeeklyOff,
                        attendanceStatus: log.attendanceStatus
                    });
                }
            }
            
            days.push({ 
                date: dateIST, 
                log: log,
                status: status,
                leave: leaveInfo || null,
                holiday: holidayInfo || null
            });
        }
        return days;
    }, [logs, currentDate]); // Removed saturdayPolicy and holidays - backend handles all

    const summaryStats = useMemo(() => {
        const stats = { present: 0 };
        weekDays.forEach(day => {
            if (day.log && day.log.attendanceStatus && ['On-time', 'Late', 'Half-day'].includes(day.log.attendanceStatus)) {
                stats.present++;
            }
        });
        stats.payable = stats.present;
        return stats;
    }, [weekDays]);

    const summaryHours = useMemo(() => {
        // FIXED: Use backend summary if available (includes all dates in range)
        if (summary && summary.totalWorkedMinutes !== undefined) {
            return formatDuration(summary.totalWorkedMinutes);
        }
        // Fallback: Calculate from weekDays (only for backward compatibility)
        let totalMinutes = 0;
        weekDays.forEach(day => {
            if (day.log && day.log.totalWorkedMinutes) {
                // Use backend computed totalWorkedMinutes
                totalMinutes += day.log.totalWorkedMinutes;
            }
        });
        return formatDuration(totalMinutes);
    }, [weekDays, summary]);
    
    const payableHours = useMemo(() => {
        // FIXED: Use backend payable hours calculation based on working days and alternate Saturday policy
        if (summary && summary.totalPayableMinutes !== undefined) {
            return formatDuration(summary.totalPayableMinutes);
        }
        // Fallback: Old calculation (incorrect - only for backward compatibility)
        return formatDuration(summaryStats.present * 540); // 9 hours per present day
    }, [summaryStats, summary]);

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
                            <span className="summary-card-value">{payableHours}</span>
                        </div>
                    </div>
                    <div className="summary-card present-hours">
                        <div className="summary-card-indicator"></div>
                        <div className="summary-card-content">
                            <span className="summary-card-label">Present Days</span>
                            <span className="summary-card-value">{summaryStats.present}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// PERFORMANCE OPTIMIZATION: Memoize component to prevent unnecessary re-renders
export default memo(AttendanceTimeline);
