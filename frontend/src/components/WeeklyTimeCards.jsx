// frontend/src/components/WeeklyTimeCards.jsx

import React, { memo } from 'react';
import { Box, Typography, Paper, Grid, Stack } from '@mui/material';
import {
  CheckCircleOutline as CheckCircleIcon,
  HighlightOff as HighlightOffIcon,
  HelpOutline as HelpOutlineIcon,
  Weekend as WeekendIcon,
} from '@mui/icons-material';

// --- HELPER FUNCTIONS FOR ACCURATE DATE HANDLING ---
// CRITICAL: Use IST timezone for all date comparisons to match backend

// Gets the IST date string (YYYY-MM-DD) to match backend timezone
const getLocalDateString = (date) => {
    // Use Intl.DateTimeFormat to get the date in IST (Asia/Kolkata)
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return istFormatter.format(date);
};

// Gets the current IST day of week (0-6, Sunday = 0)
const getISTDayOfWeek = (date) => {
    const istFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short'
    });
    const dayName = istFormatter.format(date);
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    return dayMap[dayName] ?? date.getDay();
};

// Gets the days of the current week (in IST), starting from Sunday.
const getWeekDays = () => {
    const now = new Date();
    const week = [];
    const currentDayOfWeek = getISTDayOfWeek(now);
    
    // Calculate the Sunday of this week in IST
    const firstDayOfWeek = new Date(now);
    firstDayOfWeek.setDate(now.getDate() - currentDayOfWeek);
    firstDayOfWeek.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(firstDayOfWeek);
        day.setDate(firstDayOfWeek.getDate() + i);
        week.push(day);
    }
    return week;
};

// --- COMPONENT LOGIC ---

const WeeklyTimeCards = ({ logs, shift }) => {
    const todayDateString = getLocalDateString(new Date());
    const weekDays = getWeekDays();

    const getStatusForDay = (day) => {
        const dateString = getLocalDateString(day);
        const logForDay = logs.find(log => log.attendanceDate === dateString);

        if (logForDay) {
            // This can be expanded with more statuses like 'Late', 'On Leave' etc.
            if (logForDay.sessions?.length > 0) {
                 return { text: 'Present', Icon: CheckCircleIcon, color: 'success.main' };
            }
            return { text: 'Absent', Icon: HighlightOffIcon, color: 'error.main' };
        }
        
        // Handle weekends based on day of the week (using IST)
        const dayIndex = getISTDayOfWeek(day);
        if (dayIndex === 0 || dayIndex === 6) { // Sunday or Saturday
            return { text: 'Weekend', Icon: WeekendIcon, color: 'text.secondary' };
        }

        // Default for days with no log data
        return { text: 'No Data', Icon: HelpOutlineIcon, color: 'text.disabled' };
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Paper elevation={0} className="weekly-week-card">
                <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2, letterSpacing: '0.025em' }}>
                    Your Week
                </Typography>
                <Grid container spacing={1.25}>
                    {weekDays.map((day, index) => {
                        const dayString = getLocalDateString(day);
                        const isToday = dayString === todayDateString;
                        const status = getStatusForDay(day);

                        return (
                            <Grid item xs key={index}>
                                <Paper
                                    elevation={isToday ? 3 : 0}
                                    className="week-day-tile"
                                    sx={{
                                        border: isToday ? '1.5px solid #3b82f6' : '1px solid rgba(148, 163, 184, 0.3)',
                                        backgroundColor: isToday ? '#eff6ff' : '#ffffff',
                                        boxShadow: isToday ? '0 10px 20px rgba(59, 130, 246, 0.12)' : 'none'
                                    }}
                                >
                                    <Stack spacing={0.35} alignItems="center">
                                        <Typography className="week-day-name">
                                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </Typography>
                                        <Typography className="week-day-date">
                                            {day.getDate()}
                                        </Typography>
                                    </Stack>
                                    <Stack spacing={0.25} alignItems="center" sx={{ mt: 1 }}>
                                        <status.Icon className="week-day-status-icon" sx={{ color: status.color }} />
                                        <Typography className="week-day-status-label">
                                            {status.text}
                                        </Typography>
                                    </Stack>
                                </Paper>
                            </Grid>
                        );
                    })}
                </Grid>
            </Paper>
        </Box>
    );
};

export default memo(WeeklyTimeCards);