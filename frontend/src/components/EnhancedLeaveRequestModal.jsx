// frontend/src/components/EnhancedLeaveRequestModal.jsx
import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Chip,
    Avatar,
    TextField,
    Stack,
    IconButton,
    Tooltip,
    Alert,
    CircularProgress,
    Paper
} from '@mui/material';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import api from '../api/axios';
import {
    Person as PersonIcon,
    CalendarToday as CalendarIcon,
    AccessTime as TimeIcon,
    Description as DescriptionIcon,
    CheckCircle as CheckIcon,
    Cancel as CancelIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Close as CloseIcon,
    Warning as WarningIcon,
    AttachFile as AttachFileIcon,
    PictureAsPdf as PdfIcon,
    Image as ImageIcon,
    Visibility as VisibilityIcon,
    Receipt as ReceiptIcon,
    Label as LabelIcon
} from '@mui/icons-material';

const EnhancedLeaveRequestModal = ({ 
    open, 
    onClose, 
    request, 
    onStatusChange, 
    onEdit, 
    onDelete,
    loading = false 
}) => {
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectionNotes, setRejectionNotes] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [loadingCertificate, setLoadingCertificate] = useState(false);

    const primaryColor = {
        main: '#2C3E50',
        dark: '#1a252f',
        darker: '#0f1619',
        light: '#34495e',
        tint: '#f5f6f7',
        subtle: 'rgba(44, 62, 80, 0.08)',
        subtleStrong: 'rgba(44, 62, 80, 0.12)',
        border: 'rgba(44, 62, 80, 0.18)',
        borderStrong: 'rgba(44, 62, 80, 0.28)',
        shadow: 'rgba(44, 62, 80, 0.14)',
        shadowStrong: 'rgba(44, 62, 80, 0.24)',
        gradient: 'linear-gradient(135deg, #34495e 0%, #2C3E50 55%, #1a252f 100%)',
        solidGradient: 'linear-gradient(135deg, #2C3E50 0%, #1a252f 100%)',
        paperGradient: 'linear-gradient(135deg, #ffffff 0%, #f5f6f7 100%)'
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    };

    // Format date for metadata row (shorter format)
    const formatShortDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Utility function to convert individual dates to date ranges (for highlight section)
    const formatDateRange = (dateStrings) => {
        if (!dateStrings || dateStrings.length === 0) return 'N/A';
        
        // Convert to Date objects and sort
        const dates = dateStrings
            .map(dateStr => new Date(dateStr))
            .filter(date => !isNaN(date.getTime()))
            .sort((a, b) => a - b);
        
        if (dates.length === 0) return 'N/A';
        if (dates.length === 1) {
            const date = dates[0];
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                weekday: 'long'
            });
        }
        
        // Format as range: "Dec 31, 2025 → Jan 1, 2026"
        const start = dates[0];
        const end = dates[dates.length - 1];
        
        const startStr = start.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            weekday: 'long'
        });
        const endStr = end.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            weekday: 'long'
        });
        
        return `${startStr} → ${endStr}`;
    };

    // Utility function to count total leave days
    const countLeaveDays = (dateStrings) => {
        if (!dateStrings || dateStrings.length === 0) return 0;
        return dateStrings.length;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved': return '#4caf50'; // Green
            case 'Rejected': return '#f44336'; // Red
            case 'Pending': return '#ff9800'; // Amber
            default: return '#757575';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Approved': return <CheckIcon />;
            case 'Rejected': return <CancelIcon />;
            case 'Pending': return <TimeIcon />;
            default: return <TimeIcon />;
        }
    };

    const handleApprove = async () => {
        // If blocked by validation, require override reason
        if (request.validationBlocked && !request.adminOverride) {
            if (!overrideReason.trim()) {
                setShowOverrideForm(true);
                return;
            }
        }
        
        setActionLoading(true);
        try {
            await onStatusChange(request._id, 'Approved', null, overrideReason.trim() || undefined);
            onClose();
        } catch (error) {
            console.error('Error approving request:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectionNotes.trim()) return;
        
        setActionLoading(true);
        try {
            await onStatusChange(request._id, 'Rejected', rejectionNotes);
            setShowRejectForm(false);
            setRejectionNotes('');
            onClose();
        } catch (error) {
            console.error('Error rejecting request:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleClose = () => {
        setShowRejectForm(false);
        setRejectionNotes('');
        onClose();
    };

    // Handle medical certificate viewing
    // Fetch the file using fetch API to avoid SSO redirects
    const handleViewCertificate = async (certificateUrl) => {
        if (!certificateUrl) return;
        
        setLoadingCertificate(true);
        
        try {
            // Extract filename from URL
            const urlParts = certificateUrl.split('/');
            const filename = urlParts[urlParts.length - 1];
            
            // Construct the correct URL based on environment
            let fileUrl = certificateUrl;
            
            if (import.meta.env.DEV) {
                // In development, if URL has production domain, replace with local backend
                if (certificateUrl.includes('https://') || certificateUrl.includes('http://localhost:') === false) {
                    // Extract filename and construct local backend URL
                    const backendUrl = api.defaults.baseURL?.replace('/api', '') || 'http://localhost:3001';
                    fileUrl = `${backendUrl}/medical-certificates/${filename}`;
                } else if (!certificateUrl.startsWith('http')) {
                    // Relative path - construct full local URL
                    const backendUrl = api.defaults.baseURL?.replace('/api', '') || 'http://localhost:3001';
                    fileUrl = `${backendUrl}/medical-certificates/${filename}`;
                }
            }
            
            // Get auth token
            const token = sessionStorage.getItem('ams_token') || sessionStorage.getItem('token');
            
            // Fetch the file as a blob
            const response = await fetch(fileUrl, {
                method: 'GET',
                headers: token ? {
                    'Authorization': `Bearer ${token}`
                } : {},
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Create a blob from the response
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            // Open in new tab
            const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
            
            if (!newWindow) {
                // Popup blocked, create a download link instead
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            
            // Clean up blob URL after a delay
            setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
            }, 1000);
            
        } catch (error) {
            console.error('Error viewing medical certificate:', error);
            console.error('Original URL:', certificateUrl);
            
            // Fallback: try opening directly with relative path
            try {
                const urlParts = certificateUrl.split('/');
                const filename = urlParts[urlParts.length - 1];
                const relativeUrl = `/medical-certificates/${filename}`;
                console.log('Trying fallback URL:', relativeUrl);
                window.open(relativeUrl, '_blank', 'noopener,noreferrer');
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                alert('Failed to open medical certificate. The file may not be accessible. Please contact support.');
            }
        } finally {
            setLoadingCertificate(false);
        }
    };

    if (!request) return null;

    const statusColor = getStatusColor(request.status);

    return (
        <Dialog 
            open={open} 
            onClose={handleClose} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: { 
                    borderRadius: 2,
                    background: '#ffffff',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '90vh',
                    overflow: 'hidden'
                }
            }}
        >
            {/* Sticky Header with Employee Info & Status */}
            <DialogTitle sx={{ 
                p: 3,
                bgcolor: '#ffffff',
                borderBottom: '1px solid #e0e0e0',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Avatar 
                            src={request.employee?.profileImageUrl}
                            sx={{ 
                                width: 56, 
                                height: 56, 
                                bgcolor: primaryColor.main,
                                fontSize: '1.5rem',
                                fontWeight: 600
                            }}
                        >
                            {request.employee?.fullName?.charAt(0) || 'E'}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#212121', mb: 0.5 }}>
                                {request.employee?.fullName || 'Unknown Employee'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#757575', fontWeight: 500 }}>
                                {request.employee?.employeeCode || 'N/A'}
                            </Typography>
                        </Box>
                        <Chip
                            icon={getStatusIcon(request.status)}
                            label={request.status}
                            sx={{
                                bgcolor: statusColor,
                                color: 'white',
                                fontWeight: 600,
                                height: 36,
                                fontSize: '0.875rem',
                                '& .MuiChip-icon': {
                                    color: 'white'
                                }
                            }}
                        />
                    </Box>
                    <IconButton 
                        onClick={handleClose} 
                        sx={{ 
                            color: '#757575',
                            ml: 2,
                            '&:hover': {
                                bgcolor: '#f5f5f5'
                            }
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 0, flex: 1, overflow: 'auto', bgcolor: '#fafafa' }}>
                <Box sx={{ p: 3 }}>
                    {/* Primary Highlight: Leave Dates Section */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 4,
                            mb: 3,
                            bgcolor: '#ffebee',
                            borderRadius: 2,
                            border: '1px solid #ffcdd2'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                            <Box sx={{ flex: 1, minWidth: 200 }}>
                                <Typography variant="h5" sx={{ fontWeight: 700, color: '#c62828', mb: 1.5, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                                    {formatDateRange(request.leaveDates)}
                                </Typography>
                                {request.requestType === 'Compensatory' && request.alternateDate && (
                                    <Typography variant="body2" sx={{ color: '#424242', mt: 1 }}>
                                        Alternate Work Date: {formatShortDate(request.alternateDate)}
                                    </Typography>
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                <Chip
                                    label={`${countLeaveDays(request.leaveDates)} Day${countLeaveDays(request.leaveDates) !== 1 ? 's' : ''}`}
                                    sx={{
                                        bgcolor: '#c62828',
                                        color: 'white',
                                        fontWeight: 700,
                                        height: 36,
                                        fontSize: '0.9375rem'
                                    }}
                                />
                                <Chip
                                    label={request.leaveType}
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#c62828',
                                        color: '#c62828',
                                        fontWeight: 600,
                                        height: 36,
                                        fontSize: '0.9375rem'
                                    }}
                                />
                            </Box>
                        </Box>
                    </Paper>

                    {/* Key Metadata Row */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2.5,
                            mb: 3,
                            bgcolor: '#ffffff',
                            borderRadius: 2,
                            border: '1px solid #e0e0e0',
                            fontFamily: '"Aptos", "Segoe UI", sans-serif'
                        }}
                    >
                        <Box sx={{ 
                            display: 'grid', 
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, 
                            gap: 3,
                            alignItems: 'center'
                        }}>
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <TimeIcon sx={{ fontSize: 18, color: '#757575' }} />
                                    <Typography variant="caption" sx={{ color: '#757575', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'inherit' }}>
                                        Submitted On
                                    </Typography>
                                </Box>
                                <Typography variant="body1" sx={{ fontWeight: 700, color: '#1565c0', fontFamily: 'inherit' }}>
                                    {formatShortDate(request.createdAt)}
                                </Typography>
                            </Box>
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <ReceiptIcon sx={{ fontSize: 18, color: '#757575' }} />
                                    <Typography variant="caption" sx={{ color: '#757575', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'inherit' }}>
                                        Request Type
                                    </Typography>
                                </Box>
                                <Typography variant="body1" sx={{ fontWeight: 700, color: '#212121', fontFamily: 'inherit' }}>
                                    {formatLeaveRequestType(request.requestType)}
                                </Typography>
                            </Box>
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <LabelIcon sx={{ fontSize: 18, color: '#757575' }} />
                                    <Typography variant="caption" sx={{ color: '#757575', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'inherit' }}>
                                        Leave Type
                                    </Typography>
                                </Box>
                                <Typography variant="body1" sx={{ fontWeight: 700, color: '#212121', fontFamily: 'inherit' }}>
                                    {request.leaveType}
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>

                    {/* Reason Section */}
                    <Paper
                        elevation={0}
                        sx={{
                            mb: 3,
                            bgcolor: '#ffffff',
                            borderRadius: 2,
                            border: '1px solid #e0e0e0'
                        }}
                    >
                        <Box sx={{ p: 2.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#212121', mb: 2 }}>
                                Reason for Leave
                            </Typography>
                            <Typography variant="body1" sx={{ 
                                color: '#424242', 
                                lineHeight: 1.7,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}>
                                {request.reason || 'No reason provided'}
                            </Typography>
                        </Box>
                    </Paper>

                    {/* Medical Certificate (for Sick Leave) */}
                    {request.requestType === 'Sick' && request.medicalCertificate && (
                        <Paper
                            elevation={0}
                            sx={{
                                mb: 3,
                                bgcolor: '#ffffff',
                                borderRadius: 2,
                                border: '1px solid #e0e0e0'
                            }}
                        >
                            <Box sx={{ p: 2.5 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#212121', mb: 2 }}>
                                    Medical Certificate
                                </Typography>
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    gap: 2,
                                    p: 2,
                                    bgcolor: '#f5f5f5',
                                    borderRadius: 1,
                                    border: '1px solid #e0e0e0'
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                                        {request.medicalCertificate.toLowerCase().endsWith('.pdf') ? (
                                            <PdfIcon sx={{ color: '#d32f2f', fontSize: 36 }} />
                                        ) : (
                                            <ImageIcon sx={{ color: '#757575', fontSize: 36 }} />
                                        )}
                                        <Typography variant="body2" sx={{ color: '#757575' }}>
                                            {request.medicalCertificate.split('/').pop() || 'Certificate file'}
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="outlined"
                                        startIcon={loadingCertificate ? <CircularProgress size={16} /> : <VisibilityIcon />}
                                        onClick={() => handleViewCertificate(request.medicalCertificate)}
                                        disabled={loadingCertificate}
                                        sx={{
                                            borderColor: '#757575',
                                            color: '#212121',
                                            fontWeight: 600,
                                            '&:hover': {
                                                borderColor: '#424242',
                                                bgcolor: '#f5f5f5'
                                            }
                                        }}
                                    >
                                        View
                                    </Button>
                                </Box>
                            </Box>
                        </Paper>
                    )}

                    {/* Validation Blocked Details (if blocked by policy) */}
                    {request.validationBlocked && (
                        <Paper
                            elevation={0}
                            sx={{
                                mb: 3,
                                bgcolor: '#fff3e0',
                                borderRadius: 2,
                                border: '2px solid #ff9800'
                            }}
                        >
                            <Box sx={{ p: 2.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <WarningIcon sx={{ color: '#ff9800', fontSize: 22 }} />
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#e65100' }}>
                                        Policy Blocked
                                    </Typography>
                                </Box>
                                <Alert severity="warning" sx={{ mb: 2, bgcolor: '#fff3e0' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                                        This leave request was blocked by company policy:
                                    </Typography>
                                    {request.blockedRules && request.blockedRules.length > 0 && (
                                        <Box sx={{ mb: 1 }}>
                                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                                Blocked Rules:
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                {request.blockedRules.map((rule, idx) => (
                                                    <Chip 
                                                        key={idx}
                                                        label={rule.replace(/_/g, ' ')}
                                                        size="small"
                                                        sx={{ 
                                                            bgcolor: '#ff9800',
                                                            color: 'white',
                                                            fontWeight: 600,
                                                            fontSize: '0.7rem'
                                                        }}
                                                    />
                                                ))}
                                            </Box>
                                        </Box>
                                    )}
                                    {request.blockedReason && (
                                        <Typography variant="body2" sx={{ 
                                            whiteSpace: 'pre-wrap', 
                                            color: '#424242',
                                            lineHeight: 1.7,
                                            mt: 1
                                        }}>
                                            <strong>Reason:</strong> {request.blockedReason}
                                        </Typography>
                                    )}
                                    {request.adminOverride && (
                                        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32', mb: 0.5 }}>
                                                ✓ Admin Override Applied
                                            </Typography>
                                            {request.overrideReason && (
                                                <Typography variant="caption" sx={{ color: '#424242' }}>
                                                    Override Reason: {request.overrideReason}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                </Alert>
                            </Box>
                        </Paper>
                    )}

                    {/* Rejection Notes (if exists) */}
                    {request.rejectionNotes && (
                        <Paper
                            elevation={0}
                            sx={{
                                mb: 3,
                                bgcolor: '#ffebee',
                                borderRadius: 2,
                                border: '1px solid #ffcdd2'
                            }}
                        >
                            <Box sx={{ p: 2.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <WarningIcon sx={{ color: '#d32f2f', fontSize: 20 }} />
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#c62828' }}>
                                        Rejection Reason
                                    </Typography>
                                </Box>
                                <Typography variant="body1" sx={{ 
                                    whiteSpace: 'pre-wrap', 
                                    color: '#424242',
                                    lineHeight: 1.7
                                }}>
                                    {request.rejectionNotes}
                                </Typography>
                            </Box>
                        </Paper>
                    )}

                    {/* Override Form (for blocked leaves) */}
                    {showOverrideForm && request.validationBlocked && !request.adminOverride && (
                        <Paper
                            elevation={0}
                            sx={{
                                mb: 3,
                                bgcolor: '#fff3e0',
                                borderRadius: 2,
                                border: '2px solid #ff9800'
                            }}
                        >
                            <Box sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <WarningIcon sx={{ color: '#ff9800', fontSize: 22 }} />
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#e65100' }}>
                                        Admin Override Required
                                    </Typography>
                                </Box>
                                <Alert 
                                    severity="warning" 
                                    sx={{ 
                                        mb: 2.5,
                                        bgcolor: 'rgba(255, 152, 0, 0.1)',
                                        border: '1px solid rgba(255, 152, 0, 0.3)',
                                        borderRadius: 1
                                    }}
                                >
                                    This leave request was blocked by company policy. To approve it, you must provide an override reason. This will be logged and visible to the employee.
                                </Alert>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={4}
                                    label="Override Reason *"
                                    placeholder="Enter the reason for overriding the policy block..."
                                    value={overrideReason}
                                    onChange={(e) => setOverrideReason(e.target.value)}
                                    variant="outlined"
                                    error={!overrideReason.trim() && actionLoading}
                                    helperText={!overrideReason.trim() && actionLoading ? "Override reason is required" : "This reason will be visible to the employee and logged for audit purposes."}
                                    sx={{
                                        bgcolor: '#ffffff',
                                        '& .MuiOutlinedInput-root': {
                                            '&:hover fieldset': {
                                                borderColor: '#ff9800'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#ff9800'
                                            }
                                        }
                                    }}
                                />
                            </Box>
                        </Paper>
                    )}

                    {/* Rejection Form */}
                    {showRejectForm && (
                        <Paper
                            elevation={0}
                            sx={{
                                mb: 3,
                                bgcolor: '#ffebee',
                                borderRadius: 2,
                                border: '1px solid #ffcdd2'
                            }}
                        >
                            <Box sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <WarningIcon sx={{ color: '#d32f2f', fontSize: 22 }} />
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#c62828' }}>
                                        Rejection Reason Required
                                    </Typography>
                                </Box>
                                <Alert 
                                    severity="warning" 
                                    sx={{ 
                                        mb: 2.5,
                                        bgcolor: 'rgba(255, 152, 0, 0.1)',
                                        border: '1px solid rgba(255, 152, 0, 0.3)',
                                        borderRadius: 1
                                    }}
                                >
                                    Please provide a reason for rejecting this leave request. This will be visible to the employee and sent as a notification.
                                </Alert>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={4}
                                    label="Rejection Reason"
                                    placeholder="Enter the reason for rejection..."
                                    value={rejectionNotes}
                                    onChange={(e) => setRejectionNotes(e.target.value)}
                                    variant="outlined"
                                    error={!rejectionNotes.trim() && actionLoading}
                                    helperText={!rejectionNotes.trim() && actionLoading ? "Rejection reason is required" : ""}
                                    sx={{
                                        bgcolor: '#ffffff',
                                        '& .MuiOutlinedInput-root': {
                                            '&:hover fieldset': {
                                                borderColor: '#d32f2f'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: '#d32f2f'
                                            }
                                        }
                                    }}
                                />
                            </Box>
                        </Paper>
                    )}
                </Box>
            </DialogContent>

            {/* Sticky Footer Actions */}
            <DialogActions sx={{ 
                p: 3, 
                bgcolor: '#ffffff', 
                borderTop: '1px solid #e0e0e0',
                position: 'sticky',
                bottom: 0,
                zIndex: 10
            }}>
                <Box sx={{ display: 'flex', gap: 2, width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Left side - Edit/Delete actions */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Edit Request">
                            <IconButton 
                                onClick={() => onEdit(request)} 
                                sx={{
                                    color: '#757575',
                                    '&:hover': {
                                        bgcolor: '#f5f5f5',
                                        color: '#212121'
                                    }
                                }}
                            >
                                <EditIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Request">
                            <IconButton 
                                onClick={() => onDelete(request)}
                                sx={{
                                    color: '#757575',
                                    '&:hover': {
                                        bgcolor: '#f5f5f5',
                                        color: '#212121'
                                    }
                                }}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    {/* Right side - Status actions */}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        {!showRejectForm ? (
                            <>
                                <Button 
                                    onClick={handleClose} 
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#e0e0e0',
                                        color: '#424242',
                                        fontWeight: 600,
                                        px: 3,
                                        '&:hover': {
                                            borderColor: '#bdbdbd',
                                            bgcolor: '#fafafa'
                                        }
                                    }}
                                >
                                    Close
                                </Button>
                                {request.status === 'Pending' && (
                                    <>
                                        <Button 
                                            onClick={() => {
                                                setShowRejectForm(true);
                                                setShowOverrideForm(false);
                                            }} 
                                            variant="outlined"
                                            startIcon={<CancelIcon />}
                                            sx={{
                                                borderColor: '#f44336',
                                                color: '#f44336',
                                                fontWeight: 600,
                                                px: 3,
                                                '&:hover': {
                                                    borderColor: '#d32f2f',
                                                    bgcolor: '#ffebee'
                                                }
                                            }}
                                        >
                                            Reject
                                        </Button>
                                        <Button 
                                            onClick={handleApprove} 
                                            variant="contained"
                                            startIcon={<CheckIcon />}
                                            disabled={actionLoading}
                                            sx={{
                                                bgcolor: request.validationBlocked && !request.adminOverride ? '#ff9800' : '#4caf50',
                                                color: 'white',
                                                fontWeight: 700,
                                                px: 3,
                                                '&:hover': {
                                                    bgcolor: request.validationBlocked && !request.adminOverride ? '#f57c00' : '#388e3c'
                                                },
                                                '&:disabled': {
                                                    bgcolor: 'rgba(76, 175, 80, 0.5)'
                                                }
                                            }}
                                        >
                                            {actionLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : (request.validationBlocked && !request.adminOverride ? 'Override & Approve' : 'Approve')}
                                        </Button>
                                    </>
                                )}
                            </>
                        ) : showOverrideForm ? (
                            <>
                                <Button 
                                    onClick={() => {
                                        setShowOverrideForm(false);
                                        setOverrideReason('');
                                    }} 
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#e0e0e0',
                                        color: '#424242',
                                        fontWeight: 600,
                                        px: 3,
                                        '&:hover': {
                                            borderColor: '#bdbdbd',
                                            bgcolor: '#fafafa'
                                        }
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handleApprove} 
                                    variant="contained"
                                    startIcon={<CheckIcon />}
                                    disabled={!overrideReason.trim() || actionLoading}
                                    sx={{
                                        bgcolor: '#ff9800',
                                        color: 'white',
                                        fontWeight: 700,
                                        px: 3,
                                        '&:hover': {
                                            bgcolor: '#f57c00'
                                        },
                                        '&:disabled': {
                                            bgcolor: 'rgba(255, 152, 0, 0.5)'
                                        }
                                    }}
                                >
                                    {actionLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Override & Approve'}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button 
                                    onClick={() => setShowRejectForm(false)} 
                                    variant="outlined"
                                    sx={{
                                        borderColor: '#e0e0e0',
                                        color: '#424242',
                                        fontWeight: 600,
                                        px: 3,
                                        '&:hover': {
                                            borderColor: '#bdbdbd',
                                            bgcolor: '#fafafa'
                                        }
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={handleReject} 
                                    variant="contained"
                                    startIcon={<CancelIcon />}
                                    disabled={!rejectionNotes.trim() || actionLoading}
                                    sx={{
                                        bgcolor: '#f44336',
                                        color: 'white',
                                        fontWeight: 700,
                                        px: 3,
                                        '&:hover': {
                                            bgcolor: '#d32f2f'
                                        },
                                        '&:disabled': {
                                            bgcolor: 'rgba(244, 67, 54, 0.5)'
                                        }
                                    }}
                                >
                                    {actionLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Confirm Rejection'}
                                </Button>
                            </>
                        )}
                    </Box>
                </Box>
            </DialogActions>
        </Dialog>
    );
};

export default EnhancedLeaveRequestModal;

