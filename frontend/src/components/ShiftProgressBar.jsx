// src/components/ShiftProgressBar.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Stack, Tooltip } from '@mui/material';
import useGlobalNow from '../hooks/useGlobalNow';

const ShiftProgressBar = ({ workedMinutes, extraMinutes, status, breaks, sessions, calculatedLogoutTime, clockInTime }) => {
  // Uses shared global time source to prevent multiple timers and reduce re-renders
  const hasActiveBreak = breaks?.some(b => !b.endTime);
  const hasActiveSession = sessions?.some(s => !s.endTime);
  const nowTimestamp = useGlobalNow(hasActiveBreak || hasActiveSession);
  const now = new Date(nowTimestamp);

  // Helper function to format minutes into "Xh Ym"
  const formatMinutesToHM = (minutes) => {
    if (isNaN(minutes) || minutes < 0) {
      return '0h 0m';
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };
  
  // Calculate total required shift duration dynamically from backend calculatedLogoutTime
  // This is the SINGLE SOURCE OF TRUTH - matches Today's Shift card
  const totalRequiredShiftMinutes = useMemo(() => {
    if (!calculatedLogoutTime || !clockInTime) {
      // Fallback to 9 hours if backend data not available
      return 540;
    }
    const logoutTime = new Date(calculatedLogoutTime);
    const clockIn = new Date(clockInTime);
    const durationMs = logoutTime - clockIn;
    const durationMinutes = Math.floor(durationMs / 60000);
    // Ensure minimum of 540 minutes (9 hours) as safety fallback
    return Math.max(540, durationMinutes);
  }, [calculatedLogoutTime, clockInTime]);

  // Calculate total break minutes (for progress calculation)
  const totalBreakMinutes = useMemo(() => {
    if (!breaks || breaks.length === 0) return 0;
    
    return breaks.reduce((total, breakItem) => {
      if (!breakItem.startTime) return total;
      const breakStart = new Date(breakItem.startTime);
      const breakEnd = breakItem.endTime ? new Date(breakItem.endTime) : now;
      const durationMinutes = (breakEnd - breakStart) / 60000;
      return total + Math.max(0, durationMinutes);
    }, 0);
  }, [breaks, now]);

  // Calculate segments for all breaks (completed and active)
  const breakSegments = useMemo(() => {
    if (!sessions || sessions.length === 0 || !breaks || breaks.length === 0) return [];

    const sessionStart = new Date(sessions[0].startTime);
    const sortedBreaks = [...breaks].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    const segments = [];

    sortedBreaks.forEach(breakItem => {
      // Ensure we have required fields
      if (!breakItem.startTime || (!breakItem.breakType && !breakItem.type)) return;
      
      const breakStart = new Date(breakItem.startTime);
      const breakEnd = breakItem.endTime ? new Date(breakItem.endTime) : now;
      const durationMinutes = (breakEnd - breakStart) / 60000;

      if (durationMinutes > 0) {
        // Calculate elapsed time from session start to break start (includes all previous breaks)
        const elapsedTimeBeforeBreak = (breakStart - sessionStart) / 60000;
        
        // Position break based on elapsed time in the dynamic shift timeline
        const leftPercent = (elapsedTimeBeforeBreak / totalRequiredShiftMinutes) * 100;
        const widthPercent = (durationMinutes / totalRequiredShiftMinutes) * 100;
        
        segments.push({
          left: Math.max(0, Math.min(100, leftPercent)),
          width: Math.max(0, Math.min(100 - leftPercent, widthPercent)),
          type: breakItem.breakType || breakItem.type || 'Paid',
          duration: Math.floor(durationMinutes),
          isComplete: !!breakItem.endTime,
        });
      }
    });

    return segments;
  }, [sessions, breaks, now, status, totalRequiredShiftMinutes]);

  // Progress calculation: total elapsed time (work + break) / total required shift time
  // totalElapsed = workedMinutes + breakMinutes
  // totalShiftMinutes = calculatedLogoutTime - clockInTime (from backend)
  // progress = (totalElapsed / totalShiftMinutes) * 100
  const totalElapsedMinutes = workedMinutes + totalBreakMinutes;
  const workProgress = Math.min((totalElapsedMinutes / totalRequiredShiftMinutes) * 100, 100);
  const activeBreak = breaks?.find(b => !b.endTime);
  
  // For display, show total elapsed time but cap it at the total required shift minutes
  // This ensures that when a shift is completed, it shows the correct duration
  const displayElapsedMinutes = Math.min(totalElapsedMinutes, totalRequiredShiftMinutes);

  return (
    <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Shift Progress
        </Typography>
        <Typography variant="body2" color={extraMinutes > 0 ? 'error' : 'textSecondary'}>
          {formatMinutesToHM(displayElapsedMinutes)} / {formatMinutesToHM(totalRequiredShiftMinutes)}
        </Typography>
      </Stack>
      
      <div className="progress-bar-container">
        {/* Main Work Segment (Green, or Red if penalty) */}
        <div
          className={`progress-bar-segment progress-bar-work ${extraMinutes > 0 ? 'overtime' : ''}`}
          style={{ width: `${workProgress}%` }}
        />
        
        {/* Break Segments with Tooltips */}
        {breakSegments.map((seg, index) => {
          const tooltipTitle = seg.isComplete 
            ? `${seg.type} Break: ${seg.duration} min`
            : `Ongoing ${seg.type} Break: ${seg.duration} min`;
            
          return (
            <Tooltip key={index} title={tooltipTitle} arrow>
              <div
                className="progress-bar-segment progress-bar-break"
                style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
              />
            </Tooltip>
          );
        })}
      </div>

      {/* Conditional text for active break or updated penalty message */}
      <Box sx={{ mt: 0.5, minHeight: '20px', textAlign: 'right' }}>
        {activeBreak ? (
            <Typography variant="caption" sx={{ color: '#1976d2' /* Match break bar color */ }}>
                On {activeBreak.breakType} Break since {new Date(activeBreak.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
        ) : extraMinutes > 0 ? (
            <Typography variant="caption" color="error">
                {`You have taken ${extraMinutes} minute${extraMinutes !== 1 ? 's' : ''} unpaid break, therefore your shift has been extended by ${extraMinutes} minute${extraMinutes !== 1 ? 's' : ''}.`}
            </Typography>
        ) : null}
      </Box>
    </Box>
  );
};

export default ShiftProgressBar;