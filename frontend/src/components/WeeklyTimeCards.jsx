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

// Gets the local date string (YYYY-MM-DD) to avoid timezone issues.
const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Gets the days of the current week, starting from Sunday.
const getWeekDays = () => {
    const today = new Date();
    const week = [];
    // Go back to the last Sunday.
    const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(firstDayOfWeek);
        day.setDate(day.getDate() + i);
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
        
        // Handle weekends based on day of the week
        const dayIndex = day.getDay();
        if (dayIndex === 0 || dayIndex === 6) { // Sunday or Saturday
            return { text: 'Weekend', Icon: WeekendIcon, color: 'text.secondary' };
        }

        // Default for days with no log data
        return { text: 'No Data', Icon: HelpOutlineIcon, color: 'text.disabled' };
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
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
                                    <Typography variant="caption" color="text.secondary">
                                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </Typography>
                                    <Typography variant="h6" fontWeight="bold" sx={{ my: 0.5 }}>
                                        {day.getDate()}
                                    </Typography>
                                    <status.Icon sx={{ color: status.color, fontSize: '1.25rem' }} />
                                    <Typography variant="caption" display="block" color="text.secondary">
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