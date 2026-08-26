// src/context/AuthContext.jsx
//
// Auth state for salary-service frontend.
// No AMS tokens. No SSO. Completely standalone.
//
// Pattern mirrors AMS AuthContext:
//   - Access token in memory only
//   - Refresh via httpOnly cookie
//   - Proactive refresh 2 min before expiry
//   - /api/auth/me on page load to restore session

import React, {
  createContext, useContext, useState, useCallback,
  useEffect, useRef, useMemo,
} from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';

const AuthContext = createContext(null);

// Singleton guard — only one /api/auth/me call per page load
let bootstrapPromise = null;

export function AuthProvider({ children }) {
  const [user,            setUser]            = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // 'unknown' | 'authenticated' | 'unauthenticated'
  const [authStatus,      setAuthStatus]      = useState('unknown');
  const [accessToken,     setAccessToken]     = useState(null);

  const proactiveTimerRef          = useRef(null);
  const executeRefreshRef          = useRef(null);
  const scheduleRefreshRef         = useRef(null);

  // ─── Proactive refresh ─────────────────────────────────────────────────────
  const scheduleProactiveRefresh = useCallback((token) => {
    if (proactiveTimerRef.current) {
      clearTimeout(proactiveTimerRef.current);
      proactiveTimerRef.current = null;
    }
    if (!token) return;
    let decoded;
    try { decoded = jwtDecode(token); } catch { return; }
    if (!decoded?.exp) return;

    const delayMs = (decoded.exp * 1000) - Date.now() - 2 * 60 * 1000;
    if (delayMs <= 0) {
      executeRefreshRef.current?.(0);
      return;
    }
    proactiveTimerRef.current = setTimeout(() => executeRefreshRef.current?.(0), delayMs);
  }, []);

  scheduleRefreshRef.current = scheduleProactiveRefresh;

  const executeProactiveRefresh = useCallback(async (attempt) => {
    try {
      const res = await api.post('/auth/refresh');
      const newToken = res.data.accessToken;
      setAccessToken(newToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      scheduleRefreshRef.current?.(newToken);
    } catch (err) {
      const isAuthErr = err?.response?.status === 401;
      if (!isAuthErr && attempt < 2) {
        proactiveTimerRef.current = setTimeout(() => executeRefreshRef.current?.(attempt + 1), 30_000);
      }
    }
  }, []);

  executeRefreshRef.current = executeProactiveRefresh;

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (proactiveTimerRef.current) {
      clearTimeout(proactiveTimerRef.current);
      proactiveTimerRef.current = null;
    }
    try { await api.post('/auth/logout'); } catch (_) {}
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setAuthStatus('unauthenticated');
    bootstrapPromise = null;
    delete api.defaults.headers.common['Authorization'];
  }, []);

  // ─── Session restore on page load ──────────────────────────────────────────
  const initializeAuth = useCallback(async () => {
    if (bootstrapPromise) return bootstrapPromise;

    bootstrapPromise = (async () => {
      setAuthStatus('unknown');
      try {
        // Try silent refresh first (httpOnly cookie sent automatically)
        const refreshRes = await api.post('/auth/refresh');
        const token = refreshRes.data.accessToken;
        setAccessToken(token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        const meRes = await api.get('/auth/me');
        setUser(meRes.data.user || meRes.data);
        setIsAuthenticated(true);
        setAuthStatus('authenticated');
        scheduleProactiveRefresh(token);
      } catch {
        setUser(null);
        setIsAuthenticated(false);
        setAuthStatus('unauthenticated');
      }
    })();

    return bootstrapPromise;
  }, [scheduleProactiveRefresh]);

  // ─── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken: token, user: userData } = res.data;
    setAccessToken(token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    setIsAuthenticated(true);
    setAuthStatus('authenticated');
    scheduleProactiveRefresh(token);
    return userData;
  }, [scheduleProactiveRefresh]);

  // ─── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    initializeAuth();

    const onAuthError  = () => logout();
    const onRefreshed  = (e) => {
      const t = e.detail?.accessToken;
      if (t) {
        setAccessToken(t);
        api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
        scheduleProactiveRefresh(t);
      }
    };

    window.addEventListener('payroll-auth-error', onAuthError);
    window.addEventListener('payroll-token-refreshed', onRefreshed);
    return () => {
      window.removeEventListener('payroll-auth-error', onAuthError);
      window.removeEventListener('payroll-token-refreshed', onRefreshed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    user,
    accessToken,
    isAuthenticated,
    authStatus,
    loading: authStatus === 'unknown',
    login,
    logout,
  }), [user, accessToken, isAuthenticated, authStatus, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
