// frontend/src/components/WeeklyTimeCards.jsx

import React, { memo } from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
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
            <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2, letterSpacing: '0.025em' }}>
                    Your Week
                </Typography>
                <Grid container spacing={1}>
                    {weekDays.map((day, index) => {
                        const dayString = getLocalDateString(day);
                        const isToday = dayString === todayDateString;
                        const status = getStatusForDay(day);

                        return (
                            <Grid item xs key={index} sx={{ minWidth: '80px' }}>
                                <Paper 
                                    elevation={isToday ? 3 : 0}
                                    sx={{
                                        p: 1.5,
                                        textAlign: 'center',
                                        borderRadius: '10px',
                                        border: isToday ? '2px solid #3b82f6' : '2px solid transparent',
                                        transition: 'all 0.2s ease-in-out',
                                        backgroundColor: isToday ? '#eff6ff' : '#ffffff',
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 400, letterSpacing: '0.025em' }}>
                                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 500, my: 0.5, letterSpacing: '0.025em' }}>
                                        {day.getDate()}
                                    </Typography>
                                    <status.Icon sx={{ color: status.color, fontSize: '1.25rem' }} />
                                    <Typography variant="caption" display="block" color="text.secondary" sx={{ fontWeight: 400, letterSpacing: '0.025em' }}>
                                        {status.text}
                                    </Typography>
                                </Paper>
                            </Grid>
                        );
                    })}
                </Grid>
            </Paper>
        </Box>
    );
};

export default WeeklyTimeCards;