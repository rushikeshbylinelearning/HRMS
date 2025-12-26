// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    // CRITICAL FIX: Show loader while auth is being checked
    // This prevents premature redirects and API calls before auth is ready
    if (loading) {
        return (
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '100vh' 
            }}>
                <CircularProgress />
            </Box>
        );
    }

    // Only redirect if auth check is complete AND user is not authenticated
    if (!isAuthenticated) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to. This is a good UX practice.
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;