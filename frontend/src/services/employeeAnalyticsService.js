/**
 * EMPLOYEE ANALYTICS SERVICE
 * 
 * API service for fetching individual employee detailed analytics.
 */

import api from '../api/axios';
import { cachedApiCall } from '../utils/apiCache';

/**
 * Fetch detailed analytics for a single employee
 * 
 * @param {string} employeeId - Employee ID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (YYYY)
 * @returns {Promise<Object>} Employee analytics data
 */
export async function fetchEmployeeDetailedAnalytics(employeeId, month, year) {
    try {
        // Build query params
        const params = new URLSearchParams();
        params.append('month', String(month).padStart(2, '0'));
        params.append('year', String(year));
        
        // Make API request using centralized axios instance with caching
        const response = await cachedApiCall(
            () => api.get(`/analytics/employee/${employeeId}?${params.toString()}`),
            { method: 'GET', url: `/analytics/employee/${employeeId}`, params: Object.fromEntries(params) },
            { ttl: 180000, staleWhileRevalidate: true }
        );
        
        if (response.data.success) {
            return response.data.data;
        } else {
            throw new Error(response.data.message || 'Failed to fetch employee analytics');
        }
    } catch (error) {
        console.error('[EmployeeAnalyticsService] Error:', error);
        
        if (error.response) {
            throw new Error(error.response.data.message || 'Server error');
        } else if (error.request) {
            throw new Error('Network error. Please check your connection.');
        } else {
            throw error;
        }
    }
}

export default {
    fetchEmployeeDetailedAnalytics
};
