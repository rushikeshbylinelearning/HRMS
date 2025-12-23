
// frontend/src/components/ShiftInfoDisplay.jsx
import React, { useState, useEffect } from 'react';
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
    const { shift, sessions, breaks, status, hasLog } = dailyData || {};
    // CRITICAL: Only use clockInTime if log exists (hasLog === true)
    // If log was deleted, sessions will be empty array but we should treat clockInTime as null
    const clockInTime = (hasLog === true && sessions?.[0]?.startTime) ? sessions[0].startTime : null;
    
    // Use shift from dailyData, or fallback to the user's assigned shift
    const effectiveShift = shift || fallbackShift;



    useEffect(() => {
        // Reset logout time if log doesn't exist (log was deleted)
        if (hasLog === false) {
            setLiveLogoutTime(null);
            return;
        }

        // Fallback to the server-calculated time if it exists, especially on initial load.
        if (dailyData?.calculatedLogoutTime && !liveLogoutTime) {
            setLiveLogoutTime(new Date(dailyData.calculatedLogoutTime));
        }

        if (!clockInTime || !effectiveShift) {
            setLiveLogoutTime(null);
            return;
        }

        // The live calculation should only run when the user is actively clocked in or on break.
        const shouldRunTimer = status === 'Clocked In' || status === 'On Break';

        if (!shouldRunTimer) {
             // If not clocked in, but we have a server time, display that statically.
            if (dailyData.calculatedLogoutTime) {
                setLiveLogoutTime(new Date(dailyData.calculatedLogoutTime));
            }
            return; // Exit the effect, no timer needed.
        }

        const calculateLiveLogoutTime = () => {
            const now = new Date();
            
            // Check if this is the special 10 AM - 7 PM shift with early clock-in
            const isSpecialShift = effectiveShift?.shiftType === 'Fixed' && 
                                   effectiveShift?.startTime === '10:00' && 
                                   effectiveShift?.endTime === '19:00';
            
            // For special shift early clock-in, backend handles ALL special case calculation
            // Frontend uses server-calculated time (which includes active break at calculation time)
            // For real-time UI updates, we use server time directly (server recalculates on each API call)
            if (isSpecialShift && clockInTime && dailyData?.calculatedLogoutTime) {
                const clockIn = new Date(clockInTime);
                const tenAM = getShiftStartDateTimeIST(clockIn, '10:00');
                
                // If clocked in before 10 AM, use server-calculated time
                // Server has already done all special case calculation including active break
                if (clockIn < tenAM) {
                    // Server calculated logout time includes all logic (early login buffer, break classification, adjustment)
                    // Server time is authoritative - use it directly
                    const serverLogoutTime = new Date(dailyData.calculatedLogoutTime);
                    setLiveLogoutTime(serverLogoutTime);
                    return;
                }
            }
            
            // For all other cases, use the standard calculation
            // The active break is the only "live" component we need to account for.
            const activeBreak = (breaks || []).find(b => !b.endTime);
            let activeBreakDurationMs = 0;

            if (activeBreak) {
                const breakType = (activeBreak.breakType || activeBreak.type || '').toLowerCase();
                // Only unpaid breaks (including Extra breaks) extend the shift duration
                // Paid breaks don't extend the shift, so we don't add them to logout time
                if (breakType === 'unpaid' || breakType === 'extra') {
                    activeBreakDurationMs = now.getTime() - new Date(activeBreak.startTime).getTime();
                }
            }

            // The base logout time is what the server calculated initially (includes completed unpaid breaks).
            const baseLogoutTime = new Date(dailyData.calculatedLogoutTime);

            // The live logout time is the server's calculation plus the duration of any currently active unpaid break.
            const newLiveLogoutTime = new Date(baseLogoutTime.getTime() + activeBreakDurationMs);
            setLiveLogoutTime(newLiveLogoutTime);
        };
        
        calculateLiveLogoutTime(); // Run once immediately

        // Set up the interval to update the live time.
        const timerId = setInterval(calculateLiveLogoutTime, 1000);
        return () => clearInterval(timerId); 

    }, [clockInTime, breaks, effectiveShift, status, dailyData?.calculatedLogoutTime, hasLog]);

    if (!effectiveShift) {
        return <div className="shift-info-display-container no-shift">No shift assigned for today.</div>;
    }

    const shiftName = effectiveShift.name || effectiveShift.shiftName || 'Unknown Shift';
    const isFlexible = !effectiveShift.startTime;
    
    const formattedClockIn = formatTimeIST(clockInTime);
    const formattedLiveLogout = formatTimeIST(liveLogoutTime);
    
    // CRITICAL: Check if log exists before reading late/half-day flags
    // If log was deleted, hasLog will be false and we must not show late/half-day messages
    const hasLog = dailyData?.hasLog === true;
    const attendanceLog = hasLog ? dailyData?.attendanceLog : null;
    
    // Only read late/half-day flags if log actually exists
    // This prevents showing stale late/half-day messages after log deletion
    const penaltyMinutes = hasLog ? (attendanceLog?.penaltyMinutes || 0) : 0;
    const isLate = hasLog && attendanceLog ? (attendanceLog.isLate || false) : false;
    const isHalfDay = hasLog && attendanceLog ? (attendanceLog.isHalfDay || false) : false;
    const lateMinutes = hasLog ? (attendanceLog?.lateMinutes || 0) : 0;
    const attendanceStatus = hasLog ? (attendanceLog?.attendanceStatus || 'On-time') : 'On-time';

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
                <div className={`info-value clock-in-time ${formattedClockIn !== 'N/A' ? 'active' : ''} ${isLate ? 'late-highlight' : ''} ${isHalfDay ? 'half-day-highlight' : ''}`}>
                    <div className="clock-in-content">
                        <div className="clock-in-time-display">{formattedClockIn}</div>
                        {/* Only show late/half-day messages if log exists and flags are set */}
                        {hasLog && isHalfDay && (
                            <div className="half-day-message">Half day marked as you are late than allowed grace period</div>
                        )}
                        {hasLog && isLate && !isHalfDay && (
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
