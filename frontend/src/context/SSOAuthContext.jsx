// frontend/src/context/SSOAuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';
import { CircularProgress, Box, Alert, Typography, Button } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';

const SSOAuthContext = createContext(null);

export const SSOAuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [ssoError, setSsoError] = useState(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // SSO Portal configuration
    const ssoPortalUrl = process.env.REACT_APP_SSO_PORTAL_URL || 'http://localhost:5000';
    const amsPortalUrl = process.env.REACT_APP_FRONTEND_URL || window.location.origin;

    const logout = useCallback(() => {
        console.log('[SSOAuthContext] Logging out user.');
        
        // Clear local storage
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('sso_token');
        
        // Clear API headers
        delete api.defaults.headers.common['Authorization'];
        
        // Reset state
        setUser(null);
        setIsAuthenticated(false);
        setSsoError(null);
        
        // Redirect to SSO Portal logout
        const logoutUrl = `${ssoPortalUrl}/logout?return_url=${encodeURIComponent(amsPortalUrl)}`;
        window.location.href = logoutUrl;
    }, [ssoPortalUrl, amsPortalUrl]);

    const login = useCallback(() => {
        console.log('[SSOAuthContext] Initiating SSO login...');
        
        // Clear any existing errors
        setSsoError(null);
        
        // Redirect to SSO Portal login with return URL
        const returnUrl = `${amsPortalUrl}/auth/sso-callback`;
        const loginUrl = `${ssoPortalUrl}/login?return_url=${encodeURIComponent(returnUrl)}`;
        
        console.log(`[SSOAuthContext] Redirecting to SSO Portal: ${loginUrl}`);
        window.location.href = loginUrl;
    }, [ssoPortalUrl, amsPortalUrl]);

    const handleSSOCallback = useCallback(async (ssoToken) => {
        try {
            console.log('[SSOAuthContext] Processing SSO callback...');
            
            if (!ssoToken) {
                throw new Error('No SSO token provided');
            }

            // Store SSO token temporarily
            sessionStorage.setItem('sso_token', ssoToken);
            
            // Validate token with backend
            const response = await api.post('/auth/validate-sso', {
                sso_token: ssoToken
            });

            const { token, user: userData } = response.data;
            
            // Store AMS token and user data
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('user', JSON.stringify(userData));
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            
            setUser(userData);
            setIsAuthenticated(true);
            setSsoError(null);
            
            console.log(`[SSOAuthContext] SSO login successful for: ${userData.email}`);
            
            // Clean up SSO token
            sessionStorage.removeItem('sso_token');
            
            return userData;
        } catch (error) {
            console.error('[SSOAuthContext] SSO callback failed:', error);
            setSsoError(error.response?.data?.message || error.message || 'SSO authentication failed');
            throw error;
        }
    }, []);

    const initializeAuth = useCallback(async () => {
        try {
            // Check for SSO token in URL parameters first
            const urlSsoToken = searchParams.get('sso_token');
            if (urlSsoToken) {
                console.log('[SSOAuthContext] Found SSO token in URL, processing...');
                await handleSSOCallback(urlSsoToken);
                setLoading(false);
                return;
            }

            // Check for existing AMS token
            const token = sessionStorage.getItem('token');
            const userData = sessionStorage.getItem('user');
            
            if (token && userData) {
                try {
                    const decoded = jwtDecode(token);
                    if (decoded.exp * 1000 > Date.now()) {
                        // Token is still valid
                        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                        
                        // Verify with backend
                        const response = await api.get('/auth/me');
                        setUser(response.data);
                        setIsAuthenticated(true);
                        console.log('[SSOAuthContext] Existing session restored');
                    } else {
                        console.log('[SSOAuthContext] Token expired, clearing session');
                        logout();
                    }
                } catch (error) {
                    console.error('[SSOAuthContext] Session validation failed:', error);
                    logout();
                }
            }
        } catch (error) {
            console.error('[SSOAuthContext] Auth initialization failed:', error);
            setSsoError('Failed to initialize authentication');
        } finally {
            setLoading(false);
        }
    }, [handleSSOCallback, logout, searchParams]);

    useEffect(() => {
        initializeAuth();

        // Listen for auth errors from axios interceptor
        const handleAuthError = () => {
            console.log('[SSOAuthContext] Auth error detected, logging out');
            logout();
        };

        window.addEventListener('auth-error', handleAuthError);
        return () => window.removeEventListener('auth-error', handleAuthError);
    }, [initializeAuth, logout]);

    const updateUserContext = useCallback((newUserData) => {
        setUser((currentUser) => {
            if (!currentUser) return null;
            const updatedUser = { ...currentUser, ...newUserData };
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
            return updatedUser;
        });
    }, []);

    const retrySSOLogin = useCallback(() => {
        setSsoError(null);
        login();
    }, [login]);

    const value = useMemo(() => ({
        user,
        token: sessionStorage.getItem('token'),
        isAuthenticated,
        loading,
        ssoError,
        login,
        logout,
        updateUserContext,
        retrySSOLogin,
        handleSSOCallback
    }), [user, isAuthenticated, loading, ssoError, login, logout, updateUserContext, retrySSOLogin, handleSSOCallback]);

    // Show loading spinner during initialization
    if (loading) {
        return (
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                flexDirection: 'column',
                gap: 2
            }}>
                <CircularProgress size={60} />
                <Typography variant="h6" color="primary">
                    Initializing Authentication...
                </Typography>
            </Box>
        );
    }

    // Show SSO error with retry option
    if (ssoError) {
        return (
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                flexDirection: 'column',
                gap: 2,
                p: 3
            }}>
                <Alert severity="error" sx={{ maxWidth: 500, width: '100%' }}>
                    <Typography variant="h6" gutterBottom>
                        SSO Authentication Error
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        {ssoError}
                    </Typography>
                    <Button 
                        variant="contained" 
                        onClick={retrySSOLogin}
                        fullWidth
                    >
                        Retry SSO Login
                    </Button>
                </Alert>
            </Box>
        );
    }

    return (
        <SSOAuthContext.Provider value={value}>
            {children}
        </SSOAuthContext.Provider>
    );
};

export const useSSOAuth = () => {
    const context = useContext(SSOAuthContext);
    if (!context) {
        throw new Error('useSSOAuth must be used within an SSOAuthProvider');
    }
    return context;
};

