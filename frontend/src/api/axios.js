// frontend/src/api/axios.js
import axios from 'axios';

const authErrorEvent = new Event('auth-error');

// ─── Base URL ────────────────────────────────────────────────────────────────
const baseURL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL
      ? (import.meta.env.VITE_API_BASE_URL.endsWith('/api')
          ? import.meta.env.VITE_API_BASE_URL
          : `${import.meta.env.VITE_API_BASE_URL}/api`)
      : 'https://attendance.bylinelms.com/api');

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Token auto-restore ──────────────────────────────────────────────────────
const restoreToken = () => {
  const tokenToUse = sessionStorage.getItem('ams_token') || sessionStorage.getItem('token');
  if (tokenToUse) {
    api.defaults.headers.common['Authorization'] = `Bearer ${tokenToUse}`;
  }
};
restoreToken();

// ─── Request interceptor ─────────────────────────────────────────────────────
// PERFORMANCE FIX: Adding ?_t=<timestamp> to every GET request defeats the
// browser's HTTP cache and forces a new network round-trip on every poll
// cycle.  On A2 Hosting the extra DNS + TCP + TLS cost for cross-origin API
// calls is significant.
//
// Strategy: only bust cache for endpoints that are truly time-sensitive and
// are NOT already served with short Cache-Control / no-cache headers by the
// server.  Everything that uses server-side NodeCache or has its own TTL
// should be exempt so the browser can honour the server's Cache-Control header.
//
// Exempt patterns (server already handles freshness):
//   /attendance/status      – 30 s NodeCache, returns fresh data on clock events
//   /attendance/summary     – summaries keyed by date
//   /leaves                 – short TTL cache
//   /admin/leaves           – short TTL cache
//   /admin/dashboard*       – 2-min NodeCache
//   /attendance/dashboard*  – NodeCache
//   /probation/tracker      – 10-min server cache
//   /announcements          – 60 s server cache
//   /analytics              – 5-min analytics cache
//   /holidays               – rarely changes; long server TTL
//   /admin/settings         – 30-min settings cache
//   /new-notifications      – realtime via socket; DB results cached 60 s
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_BUST_EXEMPT_PATTERNS = [
  '/auth/me',            // server-side 5-min userCache; _t only inflates URL and defeats CDN/edge caching
  '/leaves',
  '/admin/leaves',
  '/admin/dashboard',
  '/attendance/dashboard',
  '/attendance/status',
  '/attendance/summary',
  '/probation/tracker',
  '/announcements',
  '/analytics',
  '/holidays',
  '/admin/settings',
  '/new-notifications',
  '/admin/leave-years',
];

api.interceptors.request.use(
  (config) => {
    const tokenToUse = sessionStorage.getItem('ams_token') || sessionStorage.getItem('token');
    if (tokenToUse) {
      config.headers.Authorization = `Bearer ${tokenToUse}`;
    }

    // Add cache-buster only where strictly needed
    const isGet = config.method?.toUpperCase() === 'GET';
    const url = config.url || '';
    const isExempt = CACHE_BUST_EXEMPT_PATTERNS.some(pattern => url.includes(pattern));

    if (isGet && !config.params?._t && !isExempt) {
      config.params = { ...config.params, _t: Date.now() };
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor ─────────────────────────────────────────────────────
let isRefreshing = false;
let refreshSubscribers = [];
let isLoggingOut = false;

const onTokenRefreshed = (callback) => refreshSubscribers.push(callback);

const processQueue = (error, token = null) => {
  refreshSubscribers.forEach(cb => cb(error, token));
  refreshSubscribers = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      window.location.pathname !== '/login' &&
      window.location.pathname !== '/public-form' &&
      !isLoggingOut
    ) {
      const isAuthRestoring = window.__AUTH_RESTORING__ === true;
      const isAuthMeCall = originalRequest.url?.includes('/auth/me');

      if (isAuthRestoring && isAuthMeCall) {
        return Promise.reject(error);
      }

      if (originalRequest._retry || originalRequest._retryFailed) {
        if (isLoggingOut) return Promise.reject(error);
        isLoggingOut = true;
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('ams_token');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('sso_processed_token');
        delete api.defaults.headers.common['Authorization'];
        window.dispatchEvent(authErrorEvent);
        setTimeout(() => {
          if (window.location.pathname !== '/login' && window.location.pathname !== '/public-form') window.location.href = '/login';
        }, 100);
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          onTokenRefreshed((err, token) => {
            if (err) return reject(err);
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = sessionStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token available');

        const refreshAxios = axios.create({ baseURL, withCredentials: true });
        const response = await refreshAxios.post('/auth/refresh', { token: refreshToken });
        const newAccessToken = response.data.accessToken || response.data.token;

        if (!newAccessToken) throw new Error('No access token in refresh response');

        sessionStorage.setItem('token', newAccessToken);
        sessionStorage.setItem('ams_token', newAccessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        originalRequest._retryFailed = true;

        if (!isLoggingOut) {
          isLoggingOut = true;
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('ams_token');
          sessionStorage.removeItem('refreshToken');
          sessionStorage.removeItem('sso_processed_token');
          delete api.defaults.headers.common['Authorization'];
          window.dispatchEvent(authErrorEvent);
          setTimeout(() => {
            if (window.location.pathname !== '/login' && window.location.pathname !== '/public-form') window.location.href = '/login';
          }, 100);
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
