// src/components/ShiftProgressBar.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Stack, Tooltip } from '@mui/material';

const ShiftProgressBar = ({ workedMinutes, unpaidBreakMinutes, paidBreakExcess, status, breaks, sessions, activeBreakOverride = null }) => {
  const [now, setNow] = useState(new Date());
  const baseShiftMinutes = 540; // 9 hours = 540 minutes

  // Helper function to format minutes into "Xh Ym"
  const formatMinutesToHM = (minutes) => {
    if (isNaN(minutes) || minutes < 0) {
      return '0h 0m';
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };
  
  // Calculate active unpaid break duration (if any)
  const activeUnpaidBreakMinutes = useMemo(() => {
    const activeBreak = activeBreakOverride || breaks?.find(b => !b.endTime);
    if (!activeBreak || !activeBreak.startTime) return 0;
    const activeBreakType = (activeBreak.breakType || activeBreak.type || '').toString().trim();
    if (activeBreakType !== 'Unpaid' && activeBreakType !== 'Extra') return 0;
    const breakStart = new Date(activeBreak.startTime);
    return Math.floor((now - breakStart) / 60000);
  }, [activeBreakOverride, breaks, now]);
  
  // The total required shift time, adjusted for unpaid breaks and paid break excess
  // This matches the logout calculation: 9 hours + unpaid breaks + paid break excess
  const adjustedTotalShiftMinutes = baseShiftMinutes + (unpaidBreakMinutes || 0) + (paidBreakExcess || 0) + activeUnpaidBreakMinutes;

  // Effect to update the 'now' time every second when there's an active break or session
  useEffect(() => {
    const hasActiveBreak = !!activeBreakOverride || breaks?.some(b => !b.endTime);
    const hasActiveSession = sessions?.some(s => !s.endTime);
    
    if (hasActiveBreak || hasActiveSession) {
      const timerId = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(timerId);
    }
  }, [status, breaks, sessions, activeBreakOverride]);

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
        
        // Position break based on elapsed time in the adjusted shift timeline
        // Use adjustedTotalShiftMinutes for accurate positioning
        const currentAdjustedTotal = baseShiftMinutes + (unpaidBreakMinutes || 0) + (paidBreakExcess || 0) + activeUnpaidBreakMinutes;
        const leftPercent = currentAdjustedTotal > 0 ? (elapsedTimeBeforeBreak / currentAdjustedTotal) * 100 : 0;
        const widthPercent = currentAdjustedTotal > 0 ? (durationMinutes / currentAdjustedTotal) * 100 : 0;
        
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
  }, [sessions, breaks, now, status, unpaidBreakMinutes, paidBreakExcess, activeUnpaidBreakMinutes]);

  // Progress calculation: total elapsed time (work + break) / adjusted total shift time
  // totalElapsed = workedMinutes + breakMinutes
  // adjustedTotalShiftMinutes = 540 + unpaid breaks + paid break excess + active unpaid break
  // progress = (totalElapsed / adjustedTotalShiftMinutes) * 100
  // This ensures progress syncs with the logout time calculation
  const totalElapsedMinutes = workedMinutes + totalBreakMinutes;
  const workProgress = adjustedTotalShiftMinutes > 0 
    ? Math.min((totalElapsedMinutes / adjustedTotalShiftMinutes) * 100, 100)
    : 0;
  const activeBreak = activeBreakOverride || breaks?.find(b => !b.endTime);
  
  // For display, show total elapsed time but cap it at the adjusted total shift minutes
  // This ensures that when a shift is completed, it shows "9h 0m / 9h 0m" instead of "8h 30m / 9h 0m"
  const displayElapsedMinutes = Math.min(totalElapsedMinutes, adjustedTotalShiftMinutes);

  return (
    <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Shift Progress
        </Typography>
        <Typography variant="body2" color={(unpaidBreakMinutes > 0 || paidBreakExcess > 0) ? 'error' : 'textSecondary'}>
          {formatMinutesToHM(displayElapsedMinutes)} / {formatMinutesToHM(adjustedTotalShiftMinutes)}
        </Typography>
      </Stack>
      
      <div className="progress-bar-container">
        {/* Main Work Segment (Green, or Red if penalty) */}
        <div
          className={`progress-bar-segment progress-bar-work ${(unpaidBreakMinutes > 0 || paidBreakExcess > 0) ? 'overtime' : ''}`}
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
        ) : (unpaidBreakMinutes > 0 || paidBreakExcess > 0) ? (
            <Typography variant="caption" color="error">
                {unpaidBreakMinutes > 0 && paidBreakExcess > 0 ? (
                    `Your shift has been extended by ${unpaidBreakMinutes} minute${unpaidBreakMinutes !== 1 ? 's' : ''} (unpaid break) and ${paidBreakExcess} minute${paidBreakExcess !== 1 ? 's' : ''} (paid break excess).`
                ) : unpaidBreakMinutes > 0 ? (
                    `You have taken ${unpaidBreakMinutes} minute${unpaidBreakMinutes !== 1 ? 's' : ''} unpaid break, therefore your shift has been extended by ${unpaidBreakMinutes} minute${unpaidBreakMinutes !== 1 ? 's' : ''}.`
                ) : (
                    `You have taken ${paidBreakExcess} minute${paidBreakExcess !== 1 ? 's' : ''} excess paid break, therefore your shift has been extended by ${paidBreakExcess} minute${paidBreakExcess !== 1 ? 's' : ''}.`
                )}
            </Typography>
        ) : null}
      </Box>
    </Box>
  );
};

export default ShiftProgressBar;