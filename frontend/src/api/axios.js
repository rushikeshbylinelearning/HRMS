// frontend/src/api/axios.js
import axios from 'axios';

// Create a simple custom event that the AuthContext can listen for.
// This is a more robust way to handle authentication errors globally.
const authErrorEvent = new Event('auth-error');

// --- API Configuration ---
// Use Vite's environment variables for the baseURL
// If VITE_API_BASE_URL is set, use it. Otherwise use relative path (same domain).

// Debug: Log the environment variable
console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('NODE_ENV:', import.meta.env.NODE_ENV);
console.log('MODE:', import.meta.env.MODE);

// Determine baseURL:
// - Development: Use Vite proxy (/api)
// - Production: Use VITE_API_BASE_URL if set, otherwise use full URL
//   CRITICAL: In production, must use full URL: https://attendance.bylinelms.com/api
const baseURL = import.meta.env.DEV 
  ? '/api' // Use Vite proxy in development
  : (import.meta.env.VITE_API_BASE_URL 
      ? (import.meta.env.VITE_API_BASE_URL.endsWith('/api') 
          ? import.meta.env.VITE_API_BASE_URL 
          : `${import.meta.env.VITE_API_BASE_URL}/api`)
      : 'https://attendance.bylinelms.com/api'); // Use full URL in production

const api = axios.create({
  baseURL: baseURL,
  withCredentials: true, // Enable credentials for cross-origin requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Debug: Log the actual baseURL being used
console.log('Axios baseURL:', api.defaults.baseURL);

// Auto-restore token on app load (for SSO persistence)
// Check for ams_token first (SSO preference), then fallback to token
const restoreToken = () => {
  const amsToken = sessionStorage.getItem('ams_token');
  const token = sessionStorage.getItem('token');
  const tokenToUse = amsToken || token;
  
  if (tokenToUse) {
    api.defaults.headers.common['Authorization'] = `Bearer ${tokenToUse}`;
    console.log('[Axios] Token auto-restored from sessionStorage');
    console.log('[Axios] Token source:', amsToken ? 'ams_token' : 'token');
  }
};

// Restore token immediately on module load
restoreToken();

// Request interceptor - ensures Authorization header is always included
api.interceptors.request.use(
  (config) => {
    // Check for token in order: ams_token (SSO) > token
    const amsToken = sessionStorage.getItem('ams_token');
    const token = sessionStorage.getItem('token');
    const tokenToUse = amsToken || token;
    
    if (tokenToUse) {
      config.headers.Authorization = `Bearer ${tokenToUse}`;
      // Debug logging in development
      if (import.meta.env.DEV) {
        console.log('[Axios] Request with token:', {
          url: config.url,
          method: config.method,
          hasToken: !!tokenToUse,
          tokenPreview: tokenToUse.substring(0, 20) + '...'
        });
      }
    } else {
      console.warn('[Axios] ⚠️ Request without token:', {
        url: config.url,
        method: config.method
      });
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- FIX #2: Make the 401 error handling more graceful ---
// Implement token refresh with proper error handling to prevent infinite loops
// --- ALSO: Implement API Fallback Mechanism ---

// Global flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshSubscribers = [];
let isLoggingOut = false; // Flag to prevent multiple logout attempts

// Function to add request to queue while token is being refreshed
const onTokenRefreshed = (callback) => {
  refreshSubscribers.push(callback);
};

// Function to process all queued requests after token refresh
const processQueue = (error, token = null) => {
  refreshSubscribers.forEach(callback => callback(error, token));
  refreshSubscribers = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if it's a 401 Unauthorized error and we are not already on the login page
    if (error.response && error.response.status === 401 && window.location.pathname !== '/login' && !isLoggingOut) {
      // Check if this request has already been retried to prevent infinite loops
      if (originalRequest._retry || originalRequest._retryFailed) {
        // If we've already retried and still got 401, the session is invalid
        console.error('[Axios Interceptor] Token refresh failed or token is invalid. Logging out.');
        
        // Prevent multiple logout attempts
        if (isLoggingOut) {
          return Promise.reject(error);
        }
        isLoggingOut = true;
        
        // Clear all tokens
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('ams_token');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('sso_processed_token');
        delete api.defaults.headers.common['Authorization'];
        
        // Dispatch logout event
        window.dispatchEvent(authErrorEvent);
        
        // Redirect to login
        setTimeout(() => {
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }, 100);
        
        return Promise.reject(error);
      }

      // If we're already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          onTokenRefreshed((err, token) => {
            if (err) {
              reject(err);
            } else {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            }
          });
        });
      }

      // Mark that we're attempting a refresh
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token
        // Check if we have a refresh token stored (if refresh token system exists)
        const refreshToken = sessionStorage.getItem('refreshToken');
        
        // If no refresh token exists, treat as expired session and logout immediately
        if (!refreshToken) {
          throw new Error('No refresh token available - session expired');
        }
        
        // Proceed with refresh attempt (refreshToken exists at this point)
        console.log('[Axios Interceptor] Attempting to refresh token...');
        
        // Use a temporary axios instance without interceptors to avoid infinite loop
        const refreshAxios = axios.create({
          baseURL: baseURL,
          withCredentials: true,
        });
        
        try {
          const response = await refreshAxios.post('/auth/refresh', { 
            token: refreshToken 
          });
          
          const { accessToken, token: newToken } = response.data;
          const newAccessToken = accessToken || newToken;
          
          if (newAccessToken) {
            // Update token in storage and headers
            sessionStorage.setItem('token', newAccessToken);
            sessionStorage.setItem('ams_token', newAccessToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            
            // Process all queued requests
            processQueue(null, newAccessToken);
            isRefreshing = false;
            
            // Retry the original request
            return api(originalRequest);
          } else {
            throw new Error('No access token received from refresh endpoint');
          }
        } catch (refreshRequestError) {
          // Re-throw to be caught by outer catch block
          throw refreshRequestError;
        }
      } catch (refreshError) {
        // CRITICAL FIX: If refresh fails, we must logout to prevent infinite loop
        console.error('[Axios Interceptor] Token refresh failed:', refreshError.message);
        console.error('[Axios Interceptor] Refresh error details:', refreshError.response?.data || refreshError.message);
        
        // Reset refresh state to prevent further refresh attempts
        isRefreshing = false;
        processQueue(refreshError, null);
        
        // Mark the original request as permanently failed to prevent retry loops
        originalRequest._retryFailed = true;
        
        // Prevent multiple logout attempts
        if (isLoggingOut) {
          return Promise.reject(refreshError);
        }
        isLoggingOut = true;
        
        // Clear all tokens immediately
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('ams_token');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('sso_processed_token');
        delete api.defaults.headers.common['Authorization'];
        
        // Dispatch logout event (AuthContext will handle additional cleanup)
        window.dispatchEvent(authErrorEvent);
        
        // Redirect to login page if not already there
        // Small delay to ensure tokens are cleared first
        setTimeout(() => {
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }, 100);
        
        // Reject the promise to prevent further processing
        return Promise.reject(refreshError);
      }
    }

    // --- API Fallback Logic ---
    // Only trigger fallback for 5xx errors or network errors (server unreachable)
    // Do NOT fallback on 4xx errors (client errors like validation, unauthorized, etc.)
    const shouldFallback = 
      // Network error (no response from server)
      (!error.response && error.code !== 'ECONNABORTED') || 
      // Server error (5xx)
      (error.response && error.response.status >= 500);

    // Fallback logic removed - use single API endpoint (bylinelms.com)
    // If you need fallback in the future, configure it via environment variables

    // Always reject the promise so the component's catch block can still handle it.
    return Promise.reject(error);
  }
);

export default api;