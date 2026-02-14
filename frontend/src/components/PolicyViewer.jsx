import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Stack } from '@mui/material';
import SecurePdfViewer from './SecurePdfViewer';
import { useAuth } from '../context/AuthContext';

const PolicyViewer = ({ policy, onClose }) => {
    const { user } = useAuth();
    
    if (!policy) return null;

    // Construct full URL for PDF
    const getPdfUrl = () => {
        if (!policy.fileUrl) return '';
        
        // If it's already a full URL, use it as is
        if (policy.fileUrl.startsWith('http://') || policy.fileUrl.startsWith('https://')) {
            return policy.fileUrl;
        }
        
        // In development, use the Vite dev server proxy
        // In production, use the full backend URL
        if (import.meta.env.DEV) {
            // Development: Vite proxy will forward to backend
            return policy.fileUrl; // e.g., /policies/policy-xxx.pdf
        } else {
            // Production: Use full backend URL
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://attendance.legatolxp.online';
            return `${apiBaseUrl}${policy.fileUrl}`;
        }
    };

    const pdfUrl = getPdfUrl();
    const role = user?.role === 'Admin' ? 'admin' : 'employee';

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} px={2} pt={2}>
                <Box>
                    <Typography variant="h6" fontWeight={700} color="#222">
                        {policy.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Version {policy.version} • Effective from {new Date(policy.effectiveFrom).toLocaleDateString()}
                    </Typography>
                </Box>
            </Stack>
            
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <SecurePdfViewer
                    pdfUrl={pdfUrl}
                    policyName={policy.name}
                    role={role}
                    onClose={onClose}
                />
            </Box>
        </Box>
    );
};

PolicyViewer.propTypes = {
    policy: PropTypes.object,
    onClose: PropTypes.func.isRequired
};

export default PolicyViewer;
