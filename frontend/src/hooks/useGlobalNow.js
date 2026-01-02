import { useState, useEffect, useRef } from 'react';

/**
 * Global time source hook to reduce multiple timers and re-renders across the application.
 * 
 * This hook provides a single, centralized time source that can be shared across multiple
 * components, eliminating the need for each component to maintain its own setInterval timer.
 * This reduces:
 * - Memory overhead from multiple timers
 * - CPU usage from redundant time calculations
 * - Unnecessary re-renders when multiple components update simultaneously
 * 
 * @param {boolean} active - Whether the timer should be active. When false, the timer
 *                           is stopped and the hook returns the last known time value.
 *                           Set to false when the component is not visible or when
 *                           time updates are not needed.
 * 
 * @returns {number} The current timestamp as returned by Date.now() (milliseconds since epoch).
 *                   When inactive, returns the last known timestamp value.
 * 
 * @example
 * // In a component that needs real-time updates
 * const now = useGlobalNow(true);
 * 
 * @example
 * // In a component that only needs time when visible
 * const isVisible = useIsVisible();
 * const now = useGlobalNow(isVisible);
 * 
 * @example
 * // In a component that needs time only for today's active sessions
 * const isToday = date === today;
 * const hasActiveSession = log?.sessions?.some(s => !s.endTime);
 * const now = useGlobalNow(isToday && hasActiveSession);
 */
const useGlobalNow = (active = true) => {
    const [now, setNow] = useState(() => Date.now());
    const intervalRef = useRef(null);
    const lastUpdateRef = useRef(now);

    useEffect(() => {
        // Clear any existing interval when active state changes
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Only start the timer if active
        if (!active) {
            return;
        }

        // Update time immediately when becoming active
        const currentNow = Date.now();
        setNow(currentNow);
        lastUpdateRef.current = currentNow;

        // Set up the interval to update every second
        intervalRef.current = setInterval(() => {
            const currentNow = Date.now();
            // Only update if time actually changed (defensive check)
            if (currentNow !== lastUpdateRef.current) {
                lastUpdateRef.current = currentNow;
                setNow(currentNow);
            }
        }, 1000);

        // Cleanup function
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [active]);

    return now;
};

export default useGlobalNow;

