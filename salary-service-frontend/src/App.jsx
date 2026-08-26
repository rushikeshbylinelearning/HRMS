// src/App.jsx — route definitions for salary-service frontend
import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import RequireAuth from './components/RequireAuth';

// Eager load — small, always needed
import LoginPage        from './pages/LoginPage';
import ShareRedeemPage  from './pages/ShareRedeemPage';
import NotFoundPage     from './pages/NotFoundPage';

// Lazy load — authenticated pages
const DashboardPage         = lazy(() => import('./pages/DashboardPage'));
const PayrollRunsPage       = lazy(() => import('./pages/PayrollRunsPage'));
const PayrollRunDetailPage  = lazy(() => import('./pages/PayrollRunDetailPage'));
const SalarySlipsPage       = lazy(() => import('./pages/SalarySlipsPage'));
const FinancialProfilesPage = lazy(() => import('./pages/FinancialProfilesPage'));
const PayrollSettingsPage   = lazy(() => import('./pages/PayrollSettingsPage'));
const FolderManagerPage     = lazy(() => import('./pages/FolderManagerPage'));
const LinksPage             = lazy(() => import('./pages/LinksPage'));
const AuditLogsPage         = lazy(() => import('./pages/AuditLogsPage'));
const UsersPage             = lazy(() => import('./pages/UsersPage'));

const Loader = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
    <CircularProgress />
  </Box>
);

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/share/:token" element={<ShareRedeemPage />} />

        {/* Protected routes — wrapped in RequireAuth */}
        <Route element={<RequireAuth />}>
          <Route path="/"                        element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"               element={<DashboardPage />} />
          <Route path="/payroll-runs"            element={<PayrollRunsPage />} />
          <Route path="/payroll-runs/:id"        element={<PayrollRunDetailPage />} />
          <Route path="/salary-slips"            element={<SalarySlipsPage />} />
          <Route path="/financial-profiles"      element={<FinancialProfilesPage />} />
          <Route path="/settings"                element={<PayrollSettingsPage />} />
          <Route path="/folders"                 element={<FolderManagerPage />} />
          <Route path="/links"                   element={<LinksPage />} />
          <Route path="/audit-logs"              element={<AuditLogsPage />} />
          <Route path="/users"                   element={<UsersPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
