// frontend/src/components/LiveClock.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Typography, Box } from '@mui/material';

const LiveClock = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const intervalRef = useRef(null);
    const rafRef = useRef(null);
    const lastTimeStringRef = useRef('');

    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            // Only update state if time string changed (prevents unnecessary re-renders)
            if (lastTimeStringRef.current !== timeString) {
                lastTimeStringRef.current = timeString;
                setCurrentTime(now);
            }
        };

        // Update immediately
        updateTime();

        // Use requestAnimationFrame for smoother updates
        intervalRef.current = setInterval(() => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
            rafRef.current = requestAnimationFrame(updateTime);
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, []);

    return (
        <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Typography>
        </Box>
    );
};
export default LiveClock;