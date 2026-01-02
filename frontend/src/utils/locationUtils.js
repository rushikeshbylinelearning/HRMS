// frontend/src/utils/locationUtils.js
import { getCachedLocationOnly } from '../services/locationService';

/**
 * Cache location in cookie (re-exported from locationService for internal use)
 */
const cacheLocation = (location) => {
    try {
        const LOCATION_COOKIE_NAME = 'ams_location_data';
        const LOCATION_COOKIE_DURATION = 365;
        
        const setCookie = (name, value, days) => {
            const expires = new Date();
            expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict;Secure`;
        };
        
        const getDeviceId = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillText('Device fingerprint', 2, 2);
                
                const fingerprint = [
                    navigator.userAgent,
                    navigator.language,
                    screen.width + 'x' + screen.height,
                    new Date().getTimezoneOffset(),
                    canvas.toDataURL()
                ].join('|');
                
                let hash = 0;
                for (let i = 0; i < fingerprint.length; i++) {
                    const char = fingerprint.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                
                return Math.abs(hash).toString(36);
            } catch (error) {
                return 'unknown-device';
            }
        };
        
        const deviceId = getDeviceId();
        const cacheData = {
            location,
            timestamp: Date.now(),
            deviceId
        };
        setCookie(LOCATION_COOKIE_NAME, JSON.stringify(cacheData), LOCATION_COOKIE_DURATION);
    } catch (error) {
        console.error('Error caching location:', error);
    }
};

/**
 * Get user location with a timeout to prevent UI blocking.
 * Uses Promise.race to ensure location fetching never blocks longer than specified timeout.
 * 
 * @param {number} timeoutMs - Maximum time to wait for location (default: 3000ms)
 * @returns {Promise<{latitude: number, longitude: number} | null>}
 *          Returns location object if successful, null if timeout or error occurs.
 *          Never throws unhandled errors - always resolves gracefully.
 */
export const getLocationWithTimeout = async (timeoutMs = 3000) => {
    try {
        // Try cached location first (instant, no timeout needed)
        const cachedLocation = getCachedLocationOnly();
        if (cachedLocation) {
            return cachedLocation;
        }

        // Check if geolocation is supported
        if (!navigator.geolocation) {
            console.warn('Geolocation is not supported by this browser');
            return null;
        }

        // Create a timeout promise that resolves to null after timeoutMs
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                resolve(null);
            }, timeoutMs);
        });

        // Create location promise with reduced timeout to match our wrapper timeout
        const locationPromise = new Promise((resolve) => {
            const options = {
                enableHighAccuracy: true,
                timeout: timeoutMs, // Match wrapper timeout
                maximumAge: 300000 // 5 minutes
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    // Cache the location for future use
                    cacheLocation(location);
                    resolve(location);
                },
                (error) => {
                    // Don't reject - resolve with null for graceful fallback
                    console.warn('Location error:', error.message);
                    resolve(null);
                },
                options
            );
        });

        // Race between location fetch and timeout
        const result = await Promise.race([locationPromise, timeoutPromise]);
        
        // If result is null (timeout or error), return null gracefully
        return result || null;
    } catch (error) {
        // Catch any unexpected errors and return null gracefully
        console.warn('Unexpected error in getLocationWithTimeout:', error);
        return null;
    }
};

