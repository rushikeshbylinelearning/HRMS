// src/api/axios.js
//
// Axios instance for salary-service frontend.
// Points to the salary-service backend — NEVER the AMS backend.
//
// Auth model (mirrors AMS Phase-1 pattern):
//   Access token  → in-memory only (AuthContext state + axios default header)
//   Refresh token → httpOnly cookie, sent automatically to /api/auth/refresh
//
// 401 handling:
//   TOKEN_EXPIRED  → silent refresh via POST /api/auth/refresh (cookie sent automatically)
//   Refresh fails  → dispatch 'auth-error' event → AuthContext logs out

import axios from 'axios';

// In production this will be the same origin (payroll.bylinelms.com)
// In dev, Vite proxy forwards /api → http://127.0.0.1:3012
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL:       BASE_URL,
  withCredentials: true, // sends the httpOnly refreshToken cookie
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor ──────────────────────────────────────────────────────
// When sending FormData let the browser set Content-Type (with the multipart
// boundary). The default 'application/json' header must be removed, otherwise
// busboy on the server sees the wrong Content-Type and rejects the upload.
api.interceptors.request.use(config => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// ─── Token refresh helper ─────────────────────────────────────────────────────
let isRefreshing     = false;
let refreshQueue     = [];

function processQueue(error, token = null) {
  refreshQueue.forEach(cb => cb(error, token));
  refreshQueue = [];
}

async function silentRefresh() {
  const res = await api.post('/auth/refresh');
  return res.data.accessToken;
}

// ─── Response interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config;

    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/auth/refresh') ||
      original.url?.includes('/auth/login')
    ) {
      return Promise.reject(error);
    }

    // Queue concurrent 401s while one refresh is in-flight
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((err, token) => {
          if (err) return reject(err);
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    original._retry = true;
    isRefreshing    = true;

    try {
      const newToken = await silentRefresh();
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      window.dispatchEvent(new CustomEvent('payroll-token-refreshed', { detail: { accessToken: newToken } }));
      processQueue(null, newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      delete api.defaults.headers.common['Authorization'];
      window.dispatchEvent(new Event('payroll-auth-error'));
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
