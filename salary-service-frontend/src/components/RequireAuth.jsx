// src/components/RequireAuth.jsx
// Redirects to /login if not authenticated.
// Shows a full-page spinner while auth status is still being determined.
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import AppLayout from './AppLayout';

export default function RequireAuth() {
  const { authStatus } = useAuth();

  if (authStatus === 'unknown') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  // authenticated
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
