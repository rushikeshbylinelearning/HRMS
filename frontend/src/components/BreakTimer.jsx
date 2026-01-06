// frontend/src/components/BreakTimer.jsx
import React, { useState, useEffect, useMemo, memo, useRef } from 'react';
import { Typography, Box } from '@mui/material';

const formatCountdown = (totalSeconds) => {
    if (totalSeconds < 0) totalSeconds = 0;
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
};

const UNPAID_BREAK_ALLOWANCE_MINUTES = 10;

const BreakTimer = ({ breaks, paidBreakAllowance = 30 }) => {
    const [countdown, setCountdown] = useState(0);
    const [overtime, setOvertime] = useState(0);
    const intervalRef = useRef(null);
    const lastValuesRef = useRef({ countdown: 0, overtime: 0 });

    const activeBreak = useMemo(() => breaks?.find(b => !b.endTime), [breaks]);

    const paidMinutesAlreadyTaken = useMemo(() => {
        if (!activeBreak || activeBreak.breakType !== 'Paid') return 0;
        return breaks
            .filter(b => b.breakType === 'Paid' && b.endTime && b._id !== activeBreak._id)
            .reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    }, [breaks, activeBreak]);

    const allowanceSeconds = useMemo(() => {
        if (!activeBreak) return null;
        if (activeBreak.breakType === 'Paid') {
            const remaining = Math.max(0, (paidBreakAllowance - paidMinutesAlreadyTaken) * 60);
            return remaining;
        }
        return UNPAID_BREAK_ALLOWANCE_MINUTES * 60;
    }, [activeBreak, paidBreakAllowance, paidMinutesAlreadyTaken]);

    useEffect(() => {
        const clearTimer = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        clearTimer();

        if (!activeBreak || allowanceSeconds === null) {
            if (lastValuesRef.current.countdown !== 0 || lastValuesRef.current.overtime !== 0) {
                setCountdown(0);
                setOvertime(0);
                lastValuesRef.current = { countdown: 0, overtime: 0 };
            }
            return;
        }

        // Use performance.now() for UI precision, but calculate from break start time
        const startMs = new Date(activeBreak.startTime).getTime();
        const startPerformanceMs = performance.now();
        let rafId = null;

        const tick = () => {
            // Calculate elapsed time using performance.now() for smooth UI updates
            // But base calculation on actual break start time for accuracy
            const nowPerformance = performance.now();
            const elapsedPerformance = (nowPerformance - startPerformanceMs) / 1000;
            const actualElapsed = Math.floor((Date.now() - startMs) / 1000);
            
            // Use actual elapsed for calculation, but smooth display with performance timing
            const remainingSeconds = allowanceSeconds - actualElapsed;
            const nextCountdown = remainingSeconds > 0 ? remainingSeconds : 0;
            const nextOvertime = remainingSeconds < 0 ? Math.abs(remainingSeconds) : 0;

            // Only update state if values changed (prevents unnecessary re-renders)
            if (lastValuesRef.current.countdown !== nextCountdown) {
                setCountdown(nextCountdown);
            }
            if (lastValuesRef.current.overtime !== nextOvertime) {
                setOvertime(nextOvertime);
            }

            lastValuesRef.current = { countdown: nextCountdown, overtime: nextOvertime };
        };

        // Run immediately so UI updates without waiting a tick
        tick();
        
        // Use requestAnimationFrame for smoother updates (60fps)
        intervalRef.current = setInterval(() => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            rafId = requestAnimationFrame(tick);
        }, 100); // Update every 100ms for smooth animation

        return () => {
            clearTimer();
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
        };
    }, [activeBreak, allowanceSeconds]);

    if (!activeBreak) {
        return null;
    }

    const titleText = overtime > 0 
        ? 'Extra time taken:' 
        : `Time Remaining (${activeBreak.breakType})`;

    return (
        <Box sx={{ textAlign: 'center', width: '100%' }}>
            <Typography variant="body2" color="text.secondary">
                {titleText}
            </Typography>
            <Typography 
                variant="h5" 
                sx={{ 
                    color: overtime > 0 ? 'error.main' : 'success.main', 
                    fontWeight: 'bold' 
                }}
            >
                {overtime > 0 ? `+${formatCountdown(overtime)}` : formatCountdown(countdown)}
            </Typography>
        </Box>
    );
};

export default memo(BreakTimer);