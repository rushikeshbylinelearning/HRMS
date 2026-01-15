// frontend/src/components/WorkTimeTracker.jsx
import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Typography, Box, Stack } from '@mui/material';

const formatTimeUnit = (value) => String(value).padStart(2, '0');

const WorkTimeTracker = ({ sessions, breaks, status }) => {
    const [time, setTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const intervalRef = useRef(null);
    const lastTimeRef = useRef({ hours: 0, minutes: 0, seconds: 0 });
    const displayRef = useRef(null);

    const calculateWorkTime = useCallback(() => {
        if (!sessions || sessions.length === 0) {
            const zeroTime = { hours: 0, minutes: 0, seconds: 0 };
            if (JSON.stringify(lastTimeRef.current) !== JSON.stringify(zeroTime)) {
                lastTimeRef.current = zeroTime;
                setTime(zeroTime);
            }
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
    }, [sessions, breaks]);

    useEffect(() => {
        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Calculate immediately
        calculateWorkTime();

        // The interval should ONLY run if the status is 'Clocked In'.
        // When on break, the timer will "pause" because the interval is cleared.
        if (status === 'Clocked In') {
            intervalRef.current = setInterval(() => {
                // Use requestAnimationFrame for smooth updates
                if (displayRef.current) {
                    cancelAnimationFrame(displayRef.current);
                }
                displayRef.current = requestAnimationFrame(() => {
                    calculateWorkTime();
                });
            }, 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (displayRef.current) {
                cancelAnimationFrame(displayRef.current);
                displayRef.current = null;
            }
        };
    }, [status, calculateWorkTime]);

    const TimeBlock = ({ value, label }) => (
        <Box sx={{
            textAlign: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            borderRadius: 1,
            px: 1.5,
            py: 0.5
        }}>
            <Typography variant="h4" component="div" sx={{ fontWeight: 500, color: 'var(--theme-black)' }}>
                {formatTimeUnit(value)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 400, letterSpacing: '0.025em' }}>
                {label}
            </Typography>
        </Box>
    );

    return (
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
            <TimeBlock value={time.hours} label="Hours" />
            <Typography variant="h4" sx={{ color: 'text.secondary', fontWeight: 400 }}>:</Typography>
            <TimeBlock value={time.minutes} label="Minutes" />
            <Typography variant="h4" sx={{ color: 'text.secondary', fontWeight: 400 }}>:</Typography>
            <TimeBlock value={time.seconds} label="Seconds" />
        </Stack>
    );
};

export default memo(WorkTimeTracker);