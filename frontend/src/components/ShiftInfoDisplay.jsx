
// frontend/src/components/ShiftInfoDisplay.jsx
import React, { useState, useEffect, useRef } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import UpdateIcon from '@mui/icons-material/Update';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TimerOffIcon from '@mui/icons-material/TimerOff';
import '../styles/ShiftInfoDisplay.css';

const formatTimeIST = (time) => {
    if (!time) return 'N/A';

    let date;
    if (String(time).includes('T')) {
        date = new Date(time);
    } 
    else {
        const timeParts = String(time).split(':');
        if (timeParts.length < 2) return 'N/A';
        const hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        if (isNaN(hours) || isNaN(minutes)) return 'N/A';
        date = new Date();
        date.setHours(hours, minutes, 0, 0);
    }

    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
    });
};

/**
 * Creates a timezone-correct Date object for the shift's start time on a given day in IST.
 * This is crucial for accurately calculating lateness penalties.
 * @param {Date} onDate - The date of the clock-in.
 * @param {string} shiftStartTime - The shift start time in "HH:mm" format.
 * @returns {Date} A Date object representing the exact moment the shift was supposed to start.
 */
const getShiftStartDateTimeIST = (onDate, shiftStartTime) => {
    const [hours, minutes] = shiftStartTime.split(':').map(Number);

    // Create a formatter to get the date parts as they are in India for the given timestamp.
    const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    const [{ value: yearStr },, { value: monthStr },, { value: dayStr }] = istDateFormatter.formatToParts(onDate);

    // Construct a full ISO 8601 string with the explicit IST timezone offset (+05:30).
    // This creates an unambiguous point-in-time that the Date constructor can parse correctly into a UTC timestamp.
    const shiftStartISO_IST = `${yearStr}-${monthStr}-${dayStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000+05:30`;
    
    return new Date(shiftStartISO_IST);
};


const ShiftInfoDisplay = ({ dailyData, fallbackShift }) => {
    const [liveLogoutTime, setLiveLogoutTime] = useState(null);
    const { shift, sessions, breaks, status } = dailyData || {};
    const clockInTime = sessions?.[0]?.startTime;
    const intervalRef = useRef(null);
    const rafRef = useRef(null);
    const lastTimeStringRef = useRef('');
    
    // Use shift from dailyData, or fallback to the user's assigned shift
    const effectiveShift = shift || fallbackShift;

    useEffect(() => {
        // Clear any existing timers
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        // Check if log exists - if not, reset all state
        const hasLog = dailyData?.hasLog === true && dailyData?.attendanceLog !== null;
        if (!hasLog) {
            if (liveLogoutTime !== null) {
                setLiveLogoutTime(null);
            }
            return;
        }

        // Fallback to the server-calculated time if it exists, especially on initial load.
        if (dailyData?.calculatedLogoutTime && !liveLogoutTime) {
            setLiveLogoutTime(new Date(dailyData.calculatedLogoutTime));
        }

        if (!clockInTime || !effectiveShift) {
            if (liveLogoutTime !== null) {
                setLiveLogoutTime(null);
            }
            return;
        }

        // The live calculation should only run when the user is actively clocked in or on break.
        const shouldRunTimer = status === 'Clocked In' || status === 'On Break';

        if (!shouldRunTimer) {
             // If not clocked in, but we have a server time, display that statically.
            if (dailyData.calculatedLogoutTime) {
                const staticTime = new Date(dailyData.calculatedLogoutTime);
                setLiveLogoutTime(staticTime);
            }
            return; // Exit the effect, no timer needed.
        }

        // BACKEND-AUTHORITATIVE: Use server-calculated logout time directly
        // The backend already includes active break duration in its calculation
        // Frontend only displays the authoritative backend value
        const updateLogoutTime = () => {
            if (dailyData?.calculatedLogoutTime) {
                const serverLogoutTime = new Date(dailyData.calculatedLogoutTime);
                const timeString = serverLogoutTime.toISOString();
                
                // Only update state if time actually changed (prevents unnecessary re-renders)
                if (lastTimeStringRef.current !== timeString) {
                    lastTimeStringRef.current = timeString;
                    setLiveLogoutTime(serverLogoutTime);
                }
            }
        };
        
        updateLogoutTime(); // Run once immediately

        // Refresh logout time periodically when clocked in or on break
        // This ensures we get updated backend calculations as active breaks progress
        // The backend recalculates on each API call, including current active break duration
        intervalRef.current = setInterval(() => {
            // Trigger a refresh by updating the logout time from dailyData
            // The parent component should refresh dailyData periodically or via socket events
            updateLogoutTime();
        }, 5000); // Refresh every 5 seconds to get updated backend calculation
        
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

    }, [clockInTime, breaks, effectiveShift, status, dailyData?.calculatedLogoutTime, dailyData?.hasLog, dailyData?.attendanceLog]);

    if (!effectiveShift) {
        return <div className="shift-info-display-container no-shift">No shift assigned for today.</div>;
    }

    const shiftName = effectiveShift.name || effectiveShift.shiftName || 'Unknown Shift';
    const isFlexible = !effectiveShift.startTime;
    
    const formattedClockIn = formatTimeIST(clockInTime);
    const formattedLiveLogout = formatTimeIST(liveLogoutTime);
    
    // CRITICAL: Only show late/half-day flags if log actually exists
    // This prevents stale UI state after log deletion
    const hasLog = dailyData?.hasLog === true && dailyData?.attendanceLog !== null && dailyData?.attendanceLog !== undefined;
    const penaltyMinutes = hasLog ? (dailyData?.attendanceLog?.penaltyMinutes || 0) : 0;
    const isLate = hasLog ? (dailyData?.attendanceLog?.isLate || false) : false;
    const isHalfDay = hasLog ? (dailyData?.attendanceLog?.isHalfDay || false) : false;
    const lateMinutes = hasLog ? (dailyData?.attendanceLog?.lateMinutes || 0) : 0;
    const attendanceStatus = hasLog ? (dailyData?.attendanceLog?.attendanceStatus || 'On-time') : 'On-time';

    const renderLogoutInfo = () => {
        if (!clockInTime) {
            return <div className="info-value logout-time-awaiting"><TimerOffIcon fontSize="small" /> Awaiting Clock-In</div>;
        }
        
        const Icon = penaltyMinutes > 0 ? WarningAmberIcon : UpdateIcon;
        const className = penaltyMinutes > 0 ? 'logout-time-warning' : 'logout-time-normal';

        return <div className={`info-value logout-time-display ${className}`}><Icon fontSize="small" /> {formattedLiveLogout}</div>;
    };

    return (
        <div className="shift-info-display-container">
            <div className="info-row">
                <span className="info-label">Your Shift</span>
                <div className="info-value shift-name-value">
                    <AccessTimeIcon fontSize="small" />
                    {isFlexible
                        ? `${shiftName} (${effectiveShift.duration || effectiveShift.durationHours || 'Unknown'} Hours)`
                        : `${shiftName} (${formatTimeIST(effectiveShift.startTime)} - ${formatTimeIST(effectiveShift.endTime)})`
                    }
                </div>
            </div>
            <hr className="info-divider" />
            <div className="info-row">
                <span className="info-label">Clocked In At</span>
                {/* ZERO TRUST: Only apply late/half-day styling if log exists */}
                <div className={`info-value clock-in-time ${formattedClockIn !== 'N/A' ? 'active' : ''} ${hasLog && isLate ? 'late-highlight' : ''} ${hasLog && isHalfDay ? 'half-day-highlight' : ''}`}>
                    <div className="clock-in-content">
                        <div className="clock-in-time-display">{formattedClockIn}</div>
                        {/* ZERO TRUST: Only show warnings if log exists AND flags are true */}
                        {hasLog && isHalfDay && clockInTime && (
                            <div className="half-day-message">Half day marked as you are late than allowed grace period</div>
                        )}
                        {hasLog && isLate && !isHalfDay && clockInTime && (
                            <div className="late-message-only">You're late today, let's not happen next time</div>
                        )}
                    </div>
                </div>
            </div>
            <hr className="info-divider" />
            <div className="info-row">
                <span className="info-label">Required Log Out</span>
                {renderLogoutInfo()}
            </div>
        </div>
    );
};

export default ShiftInfoDisplay;
