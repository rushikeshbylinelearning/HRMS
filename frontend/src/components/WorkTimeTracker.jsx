// frontend/src/components/WorkTimeTracker.jsx
import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Typography, Box, Stack } from '@mui/material';
import useGlobalNow from '../hooks/useGlobalNow';

const formatTimeUnit = (value) => String(value).padStart(2, '0');

const WorkTimeTracker = ({ sessions, breaks, status }) => {
    // Uses shared global time source to prevent multiple timers and reduce re-renders
    const nowTimestamp = useGlobalNow(status === 'Clocked In');
    const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const lastTimeRef = useRef({ hours: 0, minutes: 0, seconds: 0 });

    const calculateWorkTime = useCallback(() => {
        if (!sessions || sessions.length === 0) {
            const zeroTime = { hours: 0, minutes: 0, seconds: 0 };
            if (JSON.stringify(lastTimeRef.current) !== JSON.stringify(zeroTime)) {
                lastTimeRef.current = zeroTime;
                setTime(zeroTime);
            }
            return;
        }

        const now = new Date(nowTimestamp);
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

        const newTime = {
            hours: Math.floor(totalSeconds / 3600),
            minutes: Math.floor((totalSeconds % 3600) / 60),
            seconds: totalSeconds % 60,
        };

        // Only update state if time actually changed (prevents unnecessary re-renders)
        if (JSON.stringify(lastTimeRef.current) !== JSON.stringify(newTime)) {
            lastTimeRef.current = newTime;
            setTime(newTime);
        }
    }, [sessions, breaks, nowTimestamp]);

    useEffect(() => {
        calculateWorkTime();
    }, [calculateWorkTime]);

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