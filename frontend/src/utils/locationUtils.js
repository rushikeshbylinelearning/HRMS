// frontend/src/utils/locationUtils.js
import { getCurrentLocation, getCachedLocationOnly } from '../services/locationService';

/**
 * Get location with a timeout - tries cached first, then fresh location
 * Never throws - returns null if location is unavailable
 * @param {number} timeoutMs - Maximum time to wait in milliseconds
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
export const getLocationWithTimeout = async (timeoutMs = 3000) => {
    try {
        // First, try to get cached location (instant)
        const cachedLocation = getCachedLocationOnly();
        if (cachedLocation) {
            return cachedLocation;
        }

        // If no cached location, try to get fresh location with timeout
        if (!navigator.geolocation) {
            return null;
        }

        // Create a promise that resolves with location or null
        const locationPromise = getCurrentLocation(false).catch(() => null);

        // Race between location promise and timeout
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => resolve(null), timeoutMs);
        });

        // Return the first one that resolves (location or timeout -> null)
        return await Promise.race([locationPromise, timeoutPromise]);
    } catch (error) {
        // Never throw - always return null on error
        console.error('Error getting location:', error);
        return null;
    }
};

