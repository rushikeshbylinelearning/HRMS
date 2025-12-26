// frontend/src/App.jsx

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NewNotificationProvider } from './hooks/useNewNotifications.jsx'; // Corrected import path
import { CssBaseline, ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import optimizedTheme from './theme/optimizedTheme';
import { consumeSsoTokenIfPresent } from './utils/ssoConsumer';

// Import Layout and Pages
import MainLayout from './components/MainLayout';
import LoginPage from './pages/LoginPage';
import SSOLoginPage from './pages/SSOLoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import PermissionProtectedRoute from './components/PermissionProtectedRoute';
import IdleDetectionProvider from './components/IdleDetectionProvider';

// Lazy load pages for better performance
import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { CircularProgress, Box } from '@mui/material';

// Import error boundary
import AnalyticsErrorBoundary from './components/AnalyticsErrorBoundary';

// Lazy load all pages
const EmployeeDashboardPage = lazy(() => import('./pages/EmployeeDashboardPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const ShiftsPage = lazy(() => import('./pages/ShiftsPage'));
const LeavesPage = lazy(() => import('./pages/LeavesPage'));
const AdminLeavesPage = lazy(() => import('./pages/AdminLeavesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AttendanceSummaryPage = lazy(() => import('./pages/AttendanceSummaryPage'));
const AdminAttendanceSummaryPage = lazy(() => import('./pages/AdminAttendanceSummaryPage'));
const NewActivityLogPage = lazy(() => import('./pages/NewActivityLogPage'));
const OfficeLocationsPage = lazy(() => import('./pages/OfficeLocationsPage'));
const ManageSectionPage = lazy(() => import('./pages/ManageSectionPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SSOCallbackPage = lazy(() => import('./pages/SSOCallbackPage'));
const EmployeeMusterRollPage = lazy(() => import('./pages/EmployeeMusterRollPage'));
const LeavesTrackerPage = lazy(() => import('./pages/LeavesTrackerPage'));
const PayrollManagementPage = lazy(() => import('./pages/PayrollManagementPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Import skeleton loaders
import { PageSkeleton } from './components/SkeletonLoaders';

// Enhanced loading component for Suspense - uses skeleton loaders
const PageLoader = ({ type = 'default' }) => (
    <Box sx={{ 
        width: '100%', 
        minHeight: 'calc(100vh - 200px)',
        p: 3 
    }}>
        <PageSkeleton type={type} />
    </Box>
);

// Use optimized theme

const DashboardRouter = () => {
    const { user } = useAuth();
    if (!user) return null;
    if (user.role === 'Admin' || user.role === 'HR') {
        return <AdminDashboardPage />;
    }
    return <EmployeeDashboardPage />;
};

// Root route component - redirects based on authentication status
const RootRoute = () => {
    const { isAuthenticated, loading } = useAuth();
    
    // Show loading while checking authentication
    if (loading) {
        return <PageLoader />;
    }
    
    // If authenticated, redirect to dashboard
    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }
    
    // If not authenticated, redirect to login page for standalone login
    return <Navigate to="/login" replace />;
};

function App() {
    // Ref to prevent multiple redirects on refresh
    const ssoTokenProcessedRef = useRef(false);
    
    // Handle SSO token consumption on app startup
    // This handles both SSO tokens from SSO portal and AMS tokens from backend middleware auto-login
    useEffect(() => {
        // Prevent multiple executions (especially in React StrictMode)
        if (ssoTokenProcessedRef.current) {
            return;
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check for AMS token from backend middleware auto-login
        const amsToken = urlParams.get('ams_token');
        const ssoAutoLogin = urlParams.get('sso_auto_login') === 'true';
        
        if (amsToken && ssoAutoLogin) {
            // Mark as processed immediately to prevent re-execution
            ssoTokenProcessedRef.current = true;
            
            console.log('[App] AMS token received from backend SSO auto-login - storing and redirecting');
            // Store the AMS token
            sessionStorage.setItem('ams_token', amsToken);
            sessionStorage.setItem('token', amsToken);
            
            // Clean up URL parameters
            const url = new URL(window.location);
            const redirectPath = url.pathname || '/dashboard';
            url.searchParams.delete('ams_token');
            url.searchParams.delete('sso_auto_login');
            window.history.replaceState({}, document.title, redirectPath + (url.search ? url.search : ''));
            
            // Instead of reload, navigate directly to trigger AuthContext
            // This is faster and preserves the iframe context
            window.location.href = redirectPath;
            return;
        }
        
        // Check for SSO token from SSO portal (only if not on login page)
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
            const ssoToken = urlParams.get('sso_token') || urlParams.get('token');
            if (ssoToken) {
                // Mark as processed immediately to prevent re-execution
                ssoTokenProcessedRef.current = true;
                
                console.log('[App] SSO token found in URL, but not on login page - redirecting to login');
                window.location.href = `/login?${ssoToken ? `token=${ssoToken}` : ''}`;
                return;
            }
        }
        
        // Mark as processed if no tokens found (to prevent re-checking)
        ssoTokenProcessedRef.current = true;
    }, []);

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <ThemeProvider theme={optimizedTheme}>
                <CssBaseline />
                <Router>
                    <AuthProvider>
                        <NewNotificationProvider> {/* <-- CORRECT NESTING */}
                            <IdleDetectionProvider>
                                <Routes>
                                {/* Public routes - accessible without authentication */}
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/sso-login" element={<SSOLoginPage />} />
                                <Route path="/auth/sso-callback" element={
                                    <Suspense fallback={<PageLoader />}>
                                        <SSOCallbackPage />
                                    </Suspense>
                                } />
                                
                                {/* Root route - smart redirect based on authentication */}
                                <Route path="/" element={<RootRoute />} />
                                
                                {/* Protected routes - require authentication */}
                                <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                                    <Route path="/dashboard" element={
                                        <Suspense fallback={<PageLoader type="dashboard" />}>
                                            <DashboardRouter />
                                        </Suspense>
                                    } />

                                    <Route path="/leaves" element={
                                        <Suspense fallback={<PageLoader type="list" />}>
                                            <PermissionProtectedRoute requiredPermission="leaves">
                                                <LeavesPage />
                                            </PermissionProtectedRoute>
                                        </Suspense>
                                    } />
                                    <Route path="/attendance-summary" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <AttendanceSummaryPage />
                                        </Suspense>
                                    } />
                                    <Route path="/profile" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <ProfilePage />
                                        </Suspense>
                                    } />
                                    
                                    <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                                    <Route path="/admin/dashboard" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <AdminDashboardPage />
                                        </Suspense>
                                    } />
                                    <Route path="/employees" element={
                                        <Suspense fallback={<PageLoader type="table" />}>
                                            <EmployeesPage />
                                        </Suspense>
                                    } />
                                    <Route path="/admin/leaves" element={
                                        <Suspense fallback={<PageLoader type="table" />}>
                                            <AdminLeavesPage />
                                        </Suspense>
                                    } />
                                    <Route path="/reports" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <PermissionProtectedRoute requiredPermission="viewReports">
                                                <ReportsPage />
                                            </PermissionProtectedRoute>
                                        </Suspense>
                                    } />
                                    <Route path="/activity-log" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <NewActivityLogPage />
                                        </Suspense>
                                    } />
                                    <Route path="/admin/attendance-summary" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <AdminAttendanceSummaryPage />
                                        </Suspense>
                                    } />
                                    <Route path="/shifts" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <ShiftsPage />
                                        </Suspense>
                                    } />
                                    <Route path="/office-locations" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <OfficeLocationsPage />
                                        </Suspense>
                                    } />
                                    <Route path="/manage-section" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <ManageSectionPage />
                                        </Suspense>
                                    } />
                                    <Route path="/analytics" element={
                                        <AnalyticsErrorBoundary>
                                            <Suspense fallback={<PageLoader />}>
                                                <PermissionProtectedRoute requiredPermission="viewAnalytics">
                                                    <AnalyticsPage />
                                                </PermissionProtectedRoute>
                                            </Suspense>
                                        </AnalyticsErrorBoundary>
                                    } />
                                    <Route path="/employee-muster-roll" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <EmployeeMusterRollPage />
                                        </Suspense>
                                    } />
                                    <Route path="/admin/leaves/more-options/leaves-tracker" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <LeavesTrackerPage />
                                        </Suspense>
                                    } />
                                    <Route path="/analytics/payroll_management" element={
                                        <Suspense fallback={<PageLoader />}>
                                            <PermissionProtectedRoute requiredPermission="viewAnalytics">
                                                <PayrollManagementPage />
                                            </PermissionProtectedRoute>
                                        </Suspense>
                                    } />
                                </Route>

                                {/* Catch-all route - redirect to login for unknown routes */}
                                <Route path="*" element={<Navigate to="/login" replace />} />
                            </Routes>
                            </IdleDetectionProvider>
                        </NewNotificationProvider>
                    </AuthProvider>
                </Router>
            </ThemeProvider>
        </LocalizationProvider>
    );
}

export default App;