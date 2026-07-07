import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Snackbar,
    Alert,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Divider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PageHeroHeader from '../components/PageHeroHeader';
import PolicyUploadForm from '../components/PolicyUploadForm';
import PolicyViewer from '../components/PolicyViewer';
import AnonymousMessagesList from '../components/AnonymousMessagesList';
import PolicyListCompact from '../components/PolicyListCompact';
import api from '../api/axios';
import '../styles/AdminPoliciesPage.css';

const cardBaseSx = {
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
};

const AdminPoliciesPage = () => {
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
    const [policyToReplace, setPolicyToReplace] = useState(null);
    const [anonymousMessages, setAnonymousMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(true);

    useEffect(() => {
        loadPolicies();
        loadAnonymousMessages();
    }, []);

    const loadPolicies = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/policies-gridfs');
            setPolicies(data.policies || []);
        } catch (error) {
            console.error('Failed to load policies:', error);
            setSnackbar({ open: true, message: 'Failed to load policies', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const loadAnonymousMessages = async () => {
        setMessagesLoading(true);
        try {
            const { data } = await api.get('/policies/anonymous-feedback');
            setAnonymousMessages(data.feedback || []);
        } catch (error) {
            console.error('Failed to load anonymous messages:', error);
            setSnackbar({ open: true, message: 'Failed to load anonymous messages', severity: 'error' });
        } finally {
            setMessagesLoading(false);
        }
    };

    const handleDeleteMessage = (messageId) => {
        // Optimistically remove from UI
        setAnonymousMessages(prev => prev.filter(msg => msg._id !== messageId));
        setSnackbar({ open: true, message: 'Message deleted successfully', severity: 'success' });
    };

    const handleUpload = async (formData) => {
        setSubmitting(true);
        try {
            await api.post('/policies-gridfs/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSnackbar({ open: true, message: 'Policy uploaded successfully', severity: 'success' });
            loadPolicies();
        } catch (error) {
            console.error('Failed to upload policy:', error);
            setSnackbar({ 
                open: true, 
                message: error.response?.data?.error || 'Failed to upload policy', 
                severity: 'error' 
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleReplace = async (policyId, formData) => {
        setSubmitting(true);
        try {
            await api.post(`/policies-gridfs/${policyId}/replace`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSnackbar({ open: true, message: 'Policy replaced successfully', severity: 'success' });
            setReplaceDialogOpen(false);
            setPolicyToReplace(null);
            loadPolicies();
        } catch (error) {
            console.error('Failed to replace policy:', error);
            setSnackbar({ 
                open: true, 
                message: error.response?.data?.error || 'Failed to replace policy', 
                severity: 'error' 
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (policyId) => {
        if (!window.confirm('Are you sure you want to delete this policy?')) return;

        try {
            await api.delete(`/policies-gridfs/${policyId}`);
            setSnackbar({ open: true, message: 'Policy deleted successfully', severity: 'success' });
            loadPolicies();
        } catch (error) {
            console.error('Failed to delete policy:', error);
            setSnackbar({ 
                open: true, 
                message: error.response?.data?.error || 'Failed to delete policy', 
                severity: 'error' 
            });
        }
    };

    const handleView = (policy) => {
        setSelectedPolicy(policy);
        setViewerOpen(true);
    };

    const openReplaceDialog = (policy) => {
        setPolicyToReplace(policy);
        setReplaceDialogOpen(true);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <Box className="admin-policies-page" sx={{ width: '100%', minHeight: '100vh', background: '#f5f6fb' }}>
            <PageHeroHeader
                eyebrow="Operations Control"
                title="Policies Management"
                description="Upload and manage company policies."
            />
            
            <Box sx={{ py: 0, px: 0, maxWidth: '100%' }}>
                {/* Two Column Grid Layout */}
                <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 3,
                    width: '100%'
                }}>
                    {/* Upload Form & Existing Policies */}
                    <Box sx={cardBaseSx}>
                        <Typography variant="h6" fontWeight={700} color="#222" mb={3}>
                            Upload New Policy
                        </Typography>
                        <PolicyUploadForm onSubmit={handleUpload} submitting={submitting} />
                        
                        <Divider sx={{ my: 3 }} />
                        
                        <Typography variant="h6" fontWeight={700} color="#222" mb={2}>
                            Existing Policies
                        </Typography>
                        <Box sx={{ 
                            maxHeight: '400px', 
                            overflowY: 'auto',
                            pr: 1,
                            '&::-webkit-scrollbar': {
                                width: '6px'
                            },
                            '&::-webkit-scrollbar-track': {
                                background: '#f1f1f1',
                                borderRadius: '4px'
                            },
                            '&::-webkit-scrollbar-thumb': {
                                background: '#888',
                                borderRadius: '4px'
                            },
                            '&::-webkit-scrollbar-thumb:hover': {
                                background: '#555'
                            }
                        }}>
                            <PolicyListCompact
                                policies={policies}
                                loading={loading}
                                onView={handleView}
                                onReplace={openReplaceDialog}
                                onDelete={handleDelete}
                                formatDate={formatDate}
                            />
                        </Box>
                    </Box>

                    {/* Anonymous Messages */}
                    <Box sx={cardBaseSx}>
                        <Typography variant="h6" fontWeight={700} color="#222" mb={3}>
                            Anonymous Messages
                        </Typography>
                        <Box sx={{ 
                            maxHeight: '700px', 
                            overflowY: 'auto',
                            pr: 1,
                            '&::-webkit-scrollbar': {
                                width: '6px'
                            },
                            '&::-webkit-scrollbar-track': {
                                background: '#f1f1f1',
                                borderRadius: '4px'
                            },
                            '&::-webkit-scrollbar-thumb': {
                                background: '#888',
                                borderRadius: '4px'
                            },
                            '&::-webkit-scrollbar-thumb:hover': {
                                background: '#555'
                            }
                        }}>
                            <AnonymousMessagesList 
                                messages={anonymousMessages} 
                                loading={messagesLoading}
                                onDelete={handleDeleteMessage}
                            />
                        </Box>
                    </Box>
                </Box>
            </Box>

            {/* Policy Viewer Dialog */}
            <Dialog
                open={viewerOpen}
                onClose={() => setViewerOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { height: '80vh' }
                }}
            >
                <DialogContent sx={{ p: 3 }}>
                    <PolicyViewer
                        policy={selectedPolicy}
                        onClose={() => setViewerOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Replace Policy Dialog */}
            <Dialog
                open={replaceDialogOpen}
                onClose={() => setReplaceDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Replace Policy: {policyToReplace?.name}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        Upload a new version. The current version will be automatically archived.
                    </Typography>
                    <PolicyUploadForm
                        onSubmit={(formData) => handleReplace(policyToReplace._id, formData)}
                        submitting={submitting}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReplaceDialogOpen(false)}>Cancel</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AdminPoliciesPage;
