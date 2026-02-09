// frontend/src/components/WeeklyTimeCards.jsx

import React, { memo } from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import {
  CheckCircleOutline as CheckCircleIcon,
  HighlightOff as HighlightOffIcon,
  HelpOutline as HelpOutlineIcon,
  Weekend as WeekendIcon,
} from '@mui/icons-material';
import { getISTNow, getISTDateString, getISTWeekRange, parseISTDate, formatISTDate, getISTDateParts } from '../utils/istTime';

// Gets the current week days (Sun–Sat) in IST. Uses centralized IST utilities.
const getWeekDays = () => {
    const { startDateStr } = getISTWeekRange(getISTNow());
    const base = parseISTDate(startDateStr).getTime();
    const week = [];
    for (let i = 0; i < 7; i++) {
        week.push(new Date(base + i * 86400000));
    }
    return week;
};

// --- COMPONENT LOGIC ---

const WeeklyTimeCards = ({ logs, shift }) => {
    const todayDateString = getISTDateString(getISTNow());
    const weekDays = getWeekDays();

    const getStatusForDay = (day, dayOfWeek) => {
        const dateString = getISTDateString(day);
        const logForDay = logs.find(log => log.attendanceDate === dateString);

        if (logForDay) {
            if (logForDay.sessions?.length > 0) {
                 return { text: 'Present', Icon: CheckCircleIcon, color: 'success.main' };
            }
            return { text: 'Absent', Icon: HighlightOffIcon, color: 'error.main' };
        }
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return { text: 'Weekend', Icon: WeekendIcon, color: 'text.secondary' };
        }
        return { text: 'No Data', Icon: HelpOutlineIcon, color: 'text.disabled' };
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, letterSpacing: '0.025em', color: '#333333' }}>
                    Your Week
                </Typography>
                <Grid container spacing={1}>
                    {weekDays.map((day, index) => {
                        const dayString = getISTDateString(day);
                        const isToday = dayString === todayDateString;
                        const status = getStatusForDay(day, index);
                        const parts = getISTDateParts(day);

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
                                    <Typography variant="caption" sx={{ fontWeight: 400, letterSpacing: '0.025em', color: '#666666' }}>
                                        {formatISTDate(day, { weekday: 'short' })}
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, my: 0.5, letterSpacing: '0.025em', color: '#333333' }}>
                                        {parts.day}
                                    </Typography>
                                    <status.Icon sx={{ color: status.color, fontSize: '1.25rem' }} />
                                    <Typography 
                                        variant="caption" 
                                        display="block" 
                                        sx={{ 
                                            fontWeight: 400, 
                                            letterSpacing: '0.025em',
                                            color: isToday ? '#3b82f6' : '#666666'
                                        }}
                                    >
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