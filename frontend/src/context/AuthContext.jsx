// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';
import { CircularProgress, Box, Snackbar, Alert } from '@mui/material';
import socket from '../socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [permissionNotification, setPermissionNotification] = useState({ open: false, message: '' });

    const logout = useCallback(() => {
        console.log('[AuthContext] Logging out user.');
        const authMethod = user?.authMethod;
        const ssoPortalUrl = import.meta.env.VITE_SSO_PORTAL_URL || 
                            (import.meta.env.DEV ? 'http://localhost:3000' : 'https://sso.bylinelms.com');
        
        // Clear all tokens (comprehensive cleanup to prevent refresh loops)
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('sso_processed_token'); // Clear SSO processed token
        sessionStorage.removeItem('refreshToken'); // Clear refresh token if exists
        sessionStorage.removeItem('ams_token'); // Clear SSO token
        
        // Clear Axios authorization header
        delete api.defaults.headers.common['Authorization'];
        
        // Clear user state
        setUser(null);
        setIsAuthenticated(false);
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

        // CRITICAL FIX: Keep loading=true until auth check completes
        // This prevents protected routes from rendering before auth is verified
        setLoading(true);
        authInitializedRef.current = true; // Mark as initialized to prevent duplicate calls

        // Check for token in order: ams_token (SSO preference) > token
        // Note: SSO tokens are handled by LoginPage which validates and converts to AMS token
        const amsToken = sessionStorage.getItem('ams_token');
        const token = sessionStorage.getItem('token');
        const tokenToUse = amsToken || token;
        
        console.log('[AuthContext] Initializing auth...');
        console.log('[AuthContext] Token found:', !!tokenToUse);
        console.log('[AuthContext] Token source:', amsToken ? 'ams_token' : (token ? 'token' : 'none'));
        
        try {
            if (tokenToUse) {
                // Validate token expiry before making API call
                const decoded = jwtDecode(tokenToUse);
                if (decoded.exp * 1000 > Date.now()) {
                    api.defaults.headers.common['Authorization'] = `Bearer ${tokenToUse}`;
                    
                    // Mark that we're in initial auth restoration phase
                    // This prevents axios interceptor from logging out during legitimate auth check
                    window.__AUTH_RESTORING__ = true;
                    
                    // Don't delay - make API call immediately
                    console.log('[AuthContext] Calling /api/auth/me with token...');
                    const response = await api.get('/auth/me');
                    console.log('[AuthContext] ✅ /api/auth/me successful, user authenticated');
                    setUser(response.data);
                    setIsAuthenticated(true);
                    
                    // Store token in sessionStorage for consistency
                    sessionStorage.setItem('token', tokenToUse);
                    if (amsToken) {
                        sessionStorage.setItem('ams_token', tokenToUse);
                    }
                } else {
                    console.warn('[AuthContext] Token expired');
                    // Clear expired token
                    sessionStorage.removeItem('token');
                    sessionStorage.removeItem('ams_token');
                    delete api.defaults.headers.common['Authorization'];
                    setUser(null);
                    setIsAuthenticated(false);
                }
            } else {
                console.log('[AuthContext] No token found, user not authenticated');
                setUser(null);
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error('[AuthContext] Auth initialization failed:', error);
            console.error('[AuthContext] Error details:', error.response?.data || error.message);
            
            // Only logout if it's a real auth error (401), not a network error
            if (error.response?.status === 401) {
                // Invalid token - clear everything
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('ams_token');
                sessionStorage.removeItem('refreshToken');
                delete api.defaults.headers.common['Authorization'];
                setUser(null);
                setIsAuthenticated(false);
            } else {
                // Network error or other issue - don't logout, just mark as unauthenticated
                // User can retry by refreshing
                console.warn('[AuthContext] Non-auth error during initialization, keeping user state');
                setUser(null);
                setIsAuthenticated(false);
            }
        } finally {
            // CRITICAL: Always set loading to false after auth check completes
            // This allows protected routes to render (or redirect to login)
            setLoading(false);
            // Clear the auth restoration flag
            window.__AUTH_RESTORING__ = false;
        }
    }, [logout]);

    const loginWithToken = useCallback(async (token) => {
        try {
            console.log('[AuthContext] Logging in with token:', token ? token.substring(0, 20) + '...' : 'null');
            
            // Store token in sessionStorage (as both 'token' and 'ams_token')
            sessionStorage.setItem('ams_token', token);
            sessionStorage.setItem('token', token);
            
            // Set authorization header
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            
            // Verify token with backend
            console.log('[AuthContext] Verifying token via /api/auth/me...');
            const response = await api.get('/auth/me');
            console.log('[AuthContext] ✅ Token verified, user authenticated');
            setUser(response.data);
            setIsAuthenticated(true);
            
            console.log('[AuthContext] Token login successful for user:', response.data.email || response.data.user?.email);
            return response.data;
        } catch (error) {
            console.error('[AuthContext] Token login failed:', error);
            console.error('[AuthContext] Error details:', error.response?.data || error.message);
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
            const response = await api.get('/auth/me');
            setUser(response.data);
            return response.data;
        } catch (error) {
            console.error('Failed to refresh user data:', error);
            // If refresh fails, logout the user
            logout();
            throw error;
        }
    }, [logout]);

    // Socket connection and permission update listener
    useEffect(() => {
        if (isAuthenticated && user) {
            // Add a delay to ensure session is fully established before connecting Socket.io
            const connectSocket = async () => {
                try {
                    // Verify session is established by calling /api/auth/me
                    await api.get('/auth/me');
                    console.log('[AuthContext] Session verified, connecting Socket.io...');
                    
                    // Get token for socket authentication
                    const token = sessionStorage.getItem('token');
                    if (!token) {
                        console.error('[AuthContext] No token available for Socket.io authentication');
                        return;
                    }
                    
                    // Import socket connection helper (dynamic import for React)
                    const socketModule = await import('../socket');
                    const { connectSocketWithToken } = socketModule;
                    
                    // Connect socket with token in auth field
                    connectSocketWithToken(token);
                    console.log('[AuthContext] Socket.io connection initiated with token');
                } catch (error) {
                    console.warn('[AuthContext] Session verification failed, delaying Socket.io connection:', error.message);
                    // Retry after a short delay
                    setTimeout(async () => {
                        if (isAuthenticated && user) {
                            const token = sessionStorage.getItem('token');
                            if (token) {
                                try {
                                    const socketModule = await import('../socket');
                                    const { connectSocketWithToken } = socketModule;
                                    connectSocketWithToken(token);
                                } catch (importError) {
                                    console.error('[AuthContext] Failed to import socket module:', importError);
                                }
                            }
                        }
                    }, 2000);
                }
            };

            // Connect socket with session verification
            connectSocket();
            
            // Reconnect socket when page becomes visible (handles idle timeouts)
            const handleVisibilityChange = async () => {
                if (!document.hidden && isAuthenticated && user) {
                    const socketModule = await import('../socket');
                    const socket = socketModule.default;
                    
                    // If socket is disconnected, reconnect with current token
                    if (socket.disconnected) {
                        console.log('[AuthContext] Page became visible, reconnecting socket...');
                        const token = sessionStorage.getItem('token') || sessionStorage.getItem('ams_token');
                        if (token) {
                            const { connectSocketWithToken } = socketModule;
                            connectSocketWithToken(token);
                        }
                    } else if (socket.connected) {
                        // Update token in case it was refreshed
                        const token = sessionStorage.getItem('token') || sessionStorage.getItem('ams_token');
                        if (token && socket.auth?.token !== token) {
                            console.log('[AuthContext] Token updated, updating socket auth...');
                            socket.auth = { token };
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
                if (data.userId === user._id) {
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
        }
    }, [isAuthenticated, user, refreshUserData]);

    const login = useCallback(async (email, password, location = null) => {
        const loginData = { email, password };
        if (location) {
            loginData.latitude = location.latitude;
            loginData.longitude = location.longitude;
        }
        
        const response = await api.post('/auth/login', loginData);
        const { token, user: userData } = response.data;
        
        // Store token in sessionStorage
        sessionStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(userData);
        setIsAuthenticated(true);
        return userData;
    }, []);

    const loginWithSSO = useCallback(async (userData, token) => {
        // Store token in sessionStorage
        sessionStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(userData);
        setIsAuthenticated(true);
        return userData;
    }, []);

    const value = useMemo(() => ({
        user,
        token: sessionStorage.getItem('token'),
        isAuthenticated,
        loading,
        login,
        loginWithSSO,
        loginWithToken,
        logout,
        updateUserContext,
        refreshUserData,
    }), [user, isAuthenticated, loading, login, loginWithSSO, loginWithToken, logout, updateUserContext, refreshUserData]);

    // Always provide the context, even during loading
    // This prevents children from accessing null context
    return (
        <>
            <AuthContext.Provider value={value}>
                {loading ? (
                    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
                        {children}
                    </Box>
                ) : (
                    children
                )}
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