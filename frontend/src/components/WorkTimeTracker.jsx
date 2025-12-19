// frontend/src/components/WorkTimeTracker.jsx
import React, { useState, useEffect, memo } from 'react';
import { Typography, Box, Stack } from '@mui/material';

const formatTimeUnit = (value) => String(value).padStart(2, '0');

const WorkTimeTracker = ({ sessions, breaks, status }) => {
    const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        const calculateWorkTime = () => {
            if (!sessions || sessions.length === 0) {
                setTime({ hours: 0, minutes: 0, seconds: 0 });
                return;
            }

            const now = new Date();
            // Calculate total time within all work sessions
            const grossTimeMs = sessions.reduce((total, s) => {
                const start = new Date(s.startTime);
                // If session is finished, use its endTime. If active, use now.
                const end = s.endTime ? new Date(s.endTime) : now;
                return total + (end - start);
            }, 0);

            // Calculate total duration of all breaks
            const totalBreakMs = (breaks || []).reduce((total, b) => {
                const start = new Date(b.startTime);
                 // If break is finished, use its endTime. If active, use now.
                const end = b.endTime ? new Date(b.endTime) : now;
                return total + (end - start);
            }, 0);

            // Net work time is the difference
            const netWorkMs = Math.max(0, grossTimeMs - totalBreakMs);
            const totalSeconds = Math.floor(netWorkMs / 1000);

            setTime({
                hours: Math.floor(totalSeconds / 3600),
                minutes: Math.floor((totalSeconds % 3600) / 60),
                seconds: totalSeconds % 60,
            });
        };

        calculateWorkTime(); // Run once on load/status change

        // The interval should ONLY run if the status is 'Clocked In'.
        // When on break, the timer will "pause" because the interval is cleared.
        if (status === 'Clocked In') {
            const interval = setInterval(calculateWorkTime, 1000);
            return () => clearInterval(interval);
        }
    }, [sessions, breaks, status]);

    const TimeBlock = ({ value, label }) => (
        <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" component="div" sx={{ fontWeight: 600, color: 'var(--theme-black)' }}>
                {formatTimeUnit(value)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
        </Box>
    );

    return (
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
            <TimeBlock value={time.hours} label="Hours" />
            <Typography variant="h4" sx={{ color: 'text.secondary' }}>:</Typography>
            <TimeBlock value={time.minutes} label="Minutes" />
            <Typography variant="h4" sx={{ color: 'text.secondary' }}>:</Typography>
            <TimeBlock value={time.seconds} label="Seconds" />
        </Stack>
    );
};

export default memo(WorkTimeTracker);