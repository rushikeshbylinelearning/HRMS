// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';
import { CircularProgress, Box, Snackbar, Alert } from '@mui/material';
import socket from '../socket';

const AuthContext = createContext(null);

// Auth status states: 'unknown' | 'authenticated' | 'unauthenticated'
// 'unknown' = auth check in progress, UI should render with skeletons
// 'authenticated' = user is authenticated (from backend confirmation)
// 'unauthenticated' = user is not authenticated (from backend confirmation)
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authStatus, setAuthStatus] = useState('unknown'); // Changed from loading boolean to status string
    const [permissionNotification, setPermissionNotification] = useState({ open: false, message: '' });

    const logout = useCallback(() => {
        console.log('[AuthContext] Logging out user.');
        const authMethod = user?.authMethod;
        const ssoPortalUrl = import.meta.env.VITE_SSO_PORTAL_URL || 
                            (import.meta.env.DEV ? 'http://localhost:3000' : 'https://sso.bylinelms.com');
        
        // Clear all tokens (comprehensive cleanup to prevent refresh loops)
        // Clear both sessionStorage (tab-specific) and localStorage (persistence)
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('sso_processed_token');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('ams_token');
        localStorage.removeItem('token');
        localStorage.removeItem('sso_processed_token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('ams_token');
        
        // Clear Axios authorization header
        delete api.defaults.headers.common['Authorization'];
        
        // Clear user state
        setUser(null);
        setIsAuthenticated(false);
        setAuthStatus('unauthenticated'); // Backend confirmed: logged out = unauthenticated
        authInitializedRef.current = false; // Reset initialization flag
        
        // Disconnect socket if connected
        if (socket && socket.connected) {
            socket.disconnect();
        }
        
        // If user came via SSO, redirect to SSO login page
        if (authMethod === 'SSO') {
            console.log('[AuthContext] User logged in via SSO - redirecting to SSO portal');
            window.location.href = `${ssoPortalUrl}/login`;
        } else if (window.location.pathname !== '/login') {
            // Redirect to login page if not SSO and not already on login
            window.location.href = '/login';
        }
    }, [user?.authMethod]);

    // Guard to prevent duplicate /api/auth/me calls
    const authInitializedRef = React.useRef(false);

    const initializeAuth = useCallback(async () => {
        // Prevent duplicate initialization calls
        if (authInitializedRef.current) {
            console.log('[AuthContext] ⚠️ Auth already initialized, skipping duplicate call');
            return;
        }

        // NON-BLOCKING: Start with 'unknown' status - UI can render immediately
        // Backend remains the source of truth - we'll update status based on /api/auth/me response
        setAuthStatus('unknown');
        authInitializedRef.current = true; // Mark as initialized to prevent duplicate calls

        // Check for token in order: ams_token (SSO preference) > token
        // Note: SSO tokens are handled by LoginPage which validates and converts to AMS token
        // Hybrid approach: sessionStorage for tab isolation, localStorage for persistence
        // Check sessionStorage first (tab-specific), then localStorage (persistence)
        let amsToken = sessionStorage.getItem('ams_token');
        let token = sessionStorage.getItem('token');
        let tokenToUse = amsToken || token;
        
        // If no token in sessionStorage, restore from localStorage
        if (!tokenToUse) {
            amsToken = localStorage.getItem('ams_token');
            token = localStorage.getItem('token');
            tokenToUse = amsToken || token;
            
            // Copy from localStorage to sessionStorage for this tab
            if (tokenToUse) {
                sessionStorage.setItem('ams_token', amsToken || tokenToUse);
                sessionStorage.setItem('token', tokenToUse);
                console.log('[AuthContext] Token restored from localStorage to sessionStorage');
            }
        }
        
        console.log('[AuthContext] Initializing auth (non-blocking)...');
        console.log('[AuthContext] Token found:', !!tokenToUse);
        console.log('[AuthContext] Token source:', amsToken ? 'ams_token' : (token ? 'token' : 'none'));
        
        // If no token exists, we can immediately set unauthenticated without API call
        if (!tokenToUse) {
            console.log('[AuthContext] No token found, user not authenticated');
            setUser(null);
            setIsAuthenticated(false);
            setAuthStatus('unauthenticated'); // Backend confirmed: no token = unauthenticated
            return;
        }
        
        // Token exists - verify with backend (source of truth)
        // This runs asynchronously and does NOT block UI rendering
        try {
            // Set authorization header for the API call
            api.defaults.headers.common['Authorization'] = `Bearer ${tokenToUse}`;
            
            // Mark that we're in initial auth restoration phase
            // This prevents axios interceptor from logging out during legitimate auth check
            window.__AUTH_RESTORING__ = true;
            
            // Backend is source of truth - call /api/auth/me to verify token
            console.log('[AuthContext] Calling /api/auth/me to verify token (backend is source of truth)...');
            const response = await api.get('/auth/me');
            console.log('[AuthContext] ✅ /api/auth/me successful, user authenticated');
            
            // Backend confirmed authentication - update state
            setUser(response.data);
            setIsAuthenticated(true);
            setAuthStatus('authenticated'); // Backend confirmed: authenticated
            
            // Store token in both sessionStorage (tab-specific) and localStorage (persistence)
            sessionStorage.setItem('token', tokenToUse);
            localStorage.setItem('token', tokenToUse);
            if (amsToken) {
                sessionStorage.setItem('ams_token', tokenToUse);
                localStorage.setItem('ams_token', tokenToUse);
            }
        } catch (error) {
            console.error('[AuthContext] Auth initialization failed:', error);
            console.error('[AuthContext] Error details:', error.response?.data || error.message);
            
            // Backend is source of truth - if /api/auth/me fails, user is unauthenticated
            if (error.response?.status === 401) {
                // Backend confirmed: invalid token - user is unauthenticated
                console.log('[AuthContext] Backend returned 401 - user is unauthenticated');
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('ams_token');
                sessionStorage.removeItem('refreshToken');
                localStorage.removeItem('token');
                localStorage.removeItem('ams_token');
                localStorage.removeItem('refreshToken');
                delete api.defaults.headers.common['Authorization'];
                setUser(null);
                setIsAuthenticated(false);
                setAuthStatus('unauthenticated'); // Backend confirmed: unauthenticated
            } else {
                // Network error or other issue - keep as unknown (don't assume unauthenticated)
                // User can retry by refreshing, but we don't know auth state
                console.warn('[AuthContext] Network error during initialization - auth status remains unknown');
                setUser(null);
                setIsAuthenticated(false);
                setAuthStatus('unknown'); // Network error - we don't know auth state
            }
        } finally {
            // Clear the auth restoration flag
            window.__AUTH_RESTORING__ = false;
        }
    }, [logout]);

    const loginWithToken = useCallback(async (token) => {
        try {
            console.log('[AuthContext] Logging in with token:', token ? token.substring(0, 20) + '...' : 'null');
            
            // Store token in both sessionStorage (tab-specific) and localStorage (persistence)
            sessionStorage.setItem('ams_token', token);
            sessionStorage.setItem('token', token);
            localStorage.setItem('ams_token', token);
            localStorage.setItem('token', token);
            
            // Set authorization header
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            
            // Backend is source of truth - verify token with /api/auth/me
            console.log('[AuthContext] Verifying token via /api/auth/me (backend is source of truth)...');
            const response = await api.get('/auth/me');
            console.log('[AuthContext] ✅ Token verified, user authenticated');
            
            // Backend confirmed authentication - update state
            setUser(response.data);
            setIsAuthenticated(true);
            setAuthStatus('authenticated'); // Backend confirmed: authenticated
            
            console.log('[AuthContext] Token login successful for user:', response.data.email || response.data.user?.email);
            return response.data;
        } catch (error) {
            console.error('[AuthContext] Token login failed:', error);
            console.error('[AuthContext] Error details:', error.response?.data || error.message);
            
            // Backend rejected token - user is unauthenticated
            setAuthStatus('unauthenticated');
            logout();
            throw error;
        }
    }, [logout]);

    useEffect(() => {
        initializeAuth();

        // --- THIS IS THE REQUIRED NEW CODE ---
        // This listener will catch the 'auth-error' event dispatched by the axios interceptor.
        const handleAuthError = () => {
            logout();
        };

        window.addEventListener('auth-error', handleAuthError);

        // Cleanup the listener when the component unmounts
        return () => {
            window.removeEventListener('auth-error', handleAuthError);
        };
        // --- END OF NEW CODE ---
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount to prevent refresh loops

    const updateUserContext = useCallback((newUserData) => {
        setUser((currentUser) => {
            if (!currentUser) return null;
            return { ...currentUser, ...newUserData };
        });
    }, []);

    const refreshUserData = useCallback(async () => {
        try {
            // Backend is source of truth - call /api/auth/me
            const response = await api.get('/auth/me');
            
            // Backend confirmed authentication - update state
            setUser(response.data);
            setIsAuthenticated(true);
            setAuthStatus('authenticated'); // Backend confirmed: authenticated
            return response.data;
        } catch (error) {
            console.error('Failed to refresh user data:', error);
            
            // Backend rejected - user is unauthenticated
            if (error.response?.status === 401) {
                setAuthStatus('unauthenticated'); // Backend confirmed: unauthenticated
            }
            // If refresh fails, logout the user
            logout();
            throw error;
        }
    }, [logout]);

    // Socket connection and permission update listener
    // CRITICAL: Only connect when authStatus === 'authenticated' (backend confirmed)
    // Do NOT reconnect on user object reference changes - use authStatus as stable dependency
    useEffect(() => {
        // Only connect when backend has confirmed authentication
        if (authStatus !== 'authenticated' || !user) {
            return;
        }
        
        // Get token for socket authentication (check sessionStorage first)
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('ams_token') ||
                      localStorage.getItem('token') || localStorage.getItem('ams_token');
        if (!token) {
            console.error('[AuthContext] No token available for Socket.io authentication');
            return;
        }
        
        // Connect socket - no redundant /api/auth/me call needed (authStatus already confirmed by backend)
        const connectSocket = async () => {
            try {
                // Import socket connection helper (dynamic import for React)
                const socketModule = await import('../socket');
                const { connectSocketWithToken } = socketModule;
                
                // Connect socket with token in auth field
                connectSocketWithToken(token);
                console.log('[AuthContext] Socket.io connection initiated (authStatus confirmed by backend)');
            } catch (error) {
                console.error('[AuthContext] Failed to connect socket:', error);
            }
        };

        // Connect socket immediately (authStatus already confirmed authentication)
        connectSocket();
        
        // Reconnect socket when page becomes visible (handles idle timeouts)
        const handleVisibilityChange = async () => {
            if (!document.hidden && authStatus === 'authenticated' && user) {
                const socketModule = await import('../socket');
                const socket = socketModule.default;
                
                // If socket is disconnected, reconnect with current token
                if (socket.disconnected) {
                    console.log('[AuthContext] Page became visible, reconnecting socket...');
                    const currentToken = sessionStorage.getItem('token') || sessionStorage.getItem('ams_token') ||
                                      localStorage.getItem('token') || localStorage.getItem('ams_token');
                    if (currentToken) {
                        const { connectSocketWithToken } = socketModule;
                        connectSocketWithToken(currentToken);
                    }
                } else if (socket.connected) {
                    // Update token in case it was refreshed
                    const currentToken = sessionStorage.getItem('token') || sessionStorage.getItem('ams_token') ||
                                      localStorage.getItem('token') || localStorage.getItem('ams_token');
                    if (currentToken && socket.auth?.token !== currentToken) {
                        console.log('[AuthContext] Token updated, updating socket auth...');
                        socket.auth = { token: currentToken };
                    }
                }
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Listen for permission updates
        const handlePermissionUpdate = (data) => {
            setPermissionNotification({
                open: true,
                message: data.message
            });
            
            // Refresh user data after a short delay
            setTimeout(() => {
                refreshUserData().catch(console.error);
            }, 2000);
        };

        // Listen for employment status updates
        const handleEmploymentStatusUpdate = (data) => {
            // Only refresh if this update is for the current user
            if (data.userId === user._id || data.userId === user.id) {
                setPermissionNotification({
                    open: true,
                    message: data.message
                });
                
                // Refresh user data immediately to update employment status
                refreshUserData().catch(console.error);
            }
        };

        socket.on('permissions_updated', handlePermissionUpdate);
        socket.on('employment_status_updated', handleEmploymentStatusUpdate);

        return () => {
            socket.off('permissions_updated', handlePermissionUpdate);
            socket.off('employment_status_updated', handleEmploymentStatusUpdate);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // Don't disconnect socket here - let it handle reconnection automatically
            // socket.disconnect();
        };
    }, [authStatus, user?._id, user?.id, refreshUserData]); // Use authStatus and user IDs (stable) instead of entire user object

    const login = useCallback(async (email, password, location = null) => {
        const loginData = { email, password };
        if (location) {
            loginData.latitude = location.latitude;
            loginData.longitude = location.longitude;
        }
        
        const response = await api.post('/auth/login', loginData);
        const { token, user: userData } = response.data;
        
        // Store token in localStorage for persistence across browser sessions
        localStorage.setItem('token', token);
        sessionStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Backend confirmed authentication via login response
        setUser(userData);
        setIsAuthenticated(true);
        setAuthStatus('authenticated'); // Backend confirmed: authenticated
        return userData;
    }, []);

    const loginWithSSO = useCallback(async (userData, token) => {
        // Store token in both sessionStorage (tab-specific) and localStorage (persistence)
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('ams_token', token);
        localStorage.setItem('token', token);
        localStorage.setItem('ams_token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Backend confirmed authentication via SSO login response
        setUser(userData);
        setIsAuthenticated(true);
        setAuthStatus('authenticated'); // Backend confirmed: authenticated
        return userData;
    }, []);

    const value = useMemo(() => ({
        user,
        token: sessionStorage.getItem('token') || sessionStorage.getItem('ams_token') ||
               localStorage.getItem('token') || localStorage.getItem('ams_token'),
        isAuthenticated,
        authStatus, // Expose authStatus for components that need to handle 'unknown' state
        loading: authStatus === 'unknown', // Keep 'loading' for backward compatibility (deprecated)
        login,
        loginWithSSO,
        loginWithToken,
        logout,
        updateUserContext,
        refreshUserData,
    }), [user, isAuthenticated, authStatus, login, loginWithSSO, loginWithToken, logout, updateUserContext, refreshUserData]);

    // NON-BLOCKING: Always render children immediately
    // authStatus === 'unknown' does NOT block UI - components handle it with skeletons
    // Backend remains source of truth - we update authStatus based on /api/auth/me response
    return (
        <>
            <AuthContext.Provider value={value}>
                {children}
            </AuthContext.Provider>
            
            {/* Permission Update Notification */}
            <Snackbar
                open={permissionNotification.open}
                autoHideDuration={6000}
                onClose={() => setPermissionNotification({ open: false, message: '' })}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert 
                    onClose={() => setPermissionNotification({ open: false, message: '' })}
                    severity="info"
                    sx={{ width: '100%' }}
                >
                    {String(permissionNotification.message || '')}
                </Alert>
            </Snackbar>
        </>
    );
};

export const useAuth = () => useContext(AuthContext);