// frontend/src/components/BreakTimer.jsx
import React, { useState, useEffect, useMemo, memo } from 'react';
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

    const activeBreak = useMemo(() => breaks?.find(b => !b.endTime), [breaks]);

    const paidMinutesAlreadyTaken = useMemo(() => {
        if (!activeBreak || activeBreak.breakType !== 'Paid') return 0;
        return breaks
            .filter(b => b.breakType === 'Paid' && b.endTime && b._id !== activeBreak._id)
            .reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    }, [breaks, activeBreak]);

    useEffect(() => {
        if (!activeBreak) {
            setCountdown(0);
            setOvertime(0);
            return;
        }

        let allowanceSeconds;
        if (activeBreak.breakType === 'Paid') {
            allowanceSeconds = (paidBreakAllowance - paidMinutesAlreadyTaken) * 60;
        } else { // Unpaid break
            allowanceSeconds = UNPAID_BREAK_ALLOWANCE_MINUTES * 60;
        }

        const breakStartTime = new Date(activeBreak.startTime);
        
        const timerId = setInterval(() => {
            const elapsedSeconds = Math.floor((new Date() - breakStartTime) / 1000);
            const remainingSeconds = allowanceSeconds - elapsedSeconds;

            if (remainingSeconds >= 0) {
                setCountdown(remainingSeconds);
                setOvertime(0);
            } else {
                setCountdown(0);
                setOvertime(Math.abs(remainingSeconds));
            }
        }, 1000);

        return () => clearInterval(timerId);
    }, [activeBreak, paidBreakAllowance, paidMinutesAlreadyTaken]);

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