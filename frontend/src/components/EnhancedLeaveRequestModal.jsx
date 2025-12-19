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
    Divider,
    TextField,
    Stack,
    Card,
    CardContent,
    IconButton,
    Tooltip,
    Alert,
    CircularProgress
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
    OpenInNew as OpenInNewIcon,
    Visibility as VisibilityIcon
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

    // Utility function to convert individual dates to date ranges
    const formatDateRange = (dateStrings) => {
        if (!dateStrings || dateStrings.length === 0) return 'N/A';
        
        // Convert to Date objects and sort
        const dates = dateStrings
            .map(dateStr => new Date(dateStr))
            .filter(date => !isNaN(date.getTime()))
            .sort((a, b) => a - b);
        
        if (dates.length === 0) return 'N/A';
        if (dates.length === 1) return formatDate(dates[0]);
        
        // Group consecutive dates into ranges
        const ranges = [];
        let start = dates[0];
        let end = dates[0];
        
        for (let i = 1; i < dates.length; i++) {
            const currentDate = dates[i];
            const previousDate = dates[i - 1];
            const dayDiff = (currentDate - previousDate) / (1000 * 60 * 60 * 24);
            
            if (dayDiff === 1) {
                // Consecutive date, extend the range
                end = currentDate;
            } else {
                // Gap found, save current range and start new one
                ranges.push({ start, end });
                start = currentDate;
                end = currentDate;
            }
        }
        
        // Add the last range
        ranges.push({ start, end });
        
        // Format ranges
        return ranges.map(range => {
            if (range.start.getTime() === range.end.getTime()) {
                return formatDate(range.start);
            } else {
                return `${formatDate(range.start)} to ${formatDate(range.end)}`;
            }
        }).join(', ');
    };

    // Utility function to count total leave days
    const countLeaveDays = (dateStrings) => {
        if (!dateStrings || dateStrings.length === 0) return 0;
        return dateStrings.length;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved': return 'success';
            case 'Rejected': return 'error';
            case 'Pending': return 'warning';
            default: return 'default';
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
        setActionLoading(true);
        try {
            await onStatusChange(request._id, 'Approved');
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

    return (
        <Dialog 
            open={open} 
            onClose={handleClose} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: { 
                    borderRadius: 4,
                    minHeight: '60vh',
                    background: '#ffffff',
                    boxShadow: `0 8px 32px ${primaryColor.shadow}`
                }
            }}
        >
            {/* Header */}
            <DialogTitle sx={{ 
                pb: 2, 
                pt: 3,
                px: 3,
                background: primaryColor.gradient,
                color: 'white',
                position: 'relative',
                boxShadow: `0 4px 12px ${primaryColor.shadowStrong}`
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                        <Avatar sx={{ 
                            bgcolor: 'rgba(255,255,255,0.25)', 
                            width: 56, 
                            height: 56,
                            border: '2px solid rgba(255,255,255,0.3)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                            <PersonIcon sx={{ fontSize: 28 }} />
                        </Avatar>
                        <Box>
                            <Typography variant="h5" component="div" sx={{ fontWeight: 700, mb: 0.5 }}>
                                Leave Request Details
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.95, fontWeight: 500 }}>
                                Request ID: {request._id?.slice(-8) || 'N/A'}
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton 
                        onClick={handleClose} 
                        sx={{ 
                            color: 'white',
                            bgcolor: 'rgba(255,255,255,0.1)',
                            '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.2)'
                            }
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 3, bgcolor: '#fafafa' }}>
                {/* Employee Information Card */}
                <Card sx={{ 
                    mb: 3, 
                    boxShadow: `0 2px 12px ${primaryColor.shadow}`,
                    borderRadius: 3,
                    border: `1px solid ${primaryColor.border}`,
                    background: primaryColor.paperGradient
                }}>
                    <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                            <Avatar 
                                src={request.employee?.profileImageUrl} 
                                sx={{ 
                                    width: 64, 
                                    height: 64, 
                                    bgcolor: primaryColor.main,
                                    border: '3px solid #fff',
                                    boxShadow: `0 4px 12px ${primaryColor.shadowStrong}`,
                                    fontSize: '1.5rem',
                                    fontWeight: 600
                                }}
                            >
                                {request.employee?.fullName?.charAt(0) || 'E'}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: primaryColor.main, mb: 0.5 }}>
                                    {request.employee?.fullName || 'Unknown Employee'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.25 }}>
                                    {request.employee?.employeeCode || 'N/A'} • {request.employee?.designation || 'N/A'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {request.employee?.department || 'N/A'}
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                {/* Request Details Grid */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
                    {/* Request Type & Leave Type */}
                    <Card sx={{ 
                        boxShadow: `0 2px 8px ${primaryColor.shadow}`,
                        borderRadius: 3,
                        border: `1px solid ${primaryColor.border}`,
                        background: '#ffffff'
                    }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryColor.main, mb: 2 }}>
                                Request Information
                            </Typography>
                            <Stack spacing={2.5}>
                                <Box>
                                    <Typography variant="body2" sx={{ 
                                        mb: 1.5, 
                                        fontWeight: 700,
                                        color: '#1976d2',
                                        fontSize: '0.875rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Request Type
                                    </Typography>
                                    <Chip 
                                        label={formatLeaveRequestType(request.requestType)} 
                                        sx={{ 
                                            bgcolor: '#1976d2',
                                            color: 'white',
                                            border: 'none',
                                            fontWeight: 700,
                                            height: 40,
                                            fontSize: '0.95rem',
                                            boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
                                            '&:hover': {
                                                bgcolor: '#1565c0',
                                                boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)'
                                            }
                                        }}
                                        size="medium"
                                    />
                                </Box>
                                <Box>
                                    <Typography variant="body2" sx={{ 
                                        mb: 1.5, 
                                        fontWeight: 700,
                                        color: '#d32f2f',
                                        fontSize: '0.875rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Leave Type
                                    </Typography>
                                    <Chip 
                                        label={request.leaveType} 
                                        sx={{ 
                                            bgcolor: '#d32f2f',
                                            color: 'white',
                                            border: 'none',
                                            fontWeight: 700,
                                            height: 40,
                                            fontSize: '0.95rem',
                                            boxShadow: '0 2px 8px rgba(211, 47, 47, 0.3)',
                                            '&:hover': {
                                                bgcolor: '#c62828',
                                                boxShadow: '0 4px 12px rgba(211, 47, 47, 0.4)'
                                            }
                                        }}
                                        size="medium"
                                    />
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Status & Dates */}
                    <Card sx={{ 
                        boxShadow: `0 2px 8px ${primaryColor.shadow}`,
                        borderRadius: 3,
                        border: `1px solid ${primaryColor.border}`,
                        background: '#ffffff'
                    }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryColor.main, mb: 2 }}>
                                Status & Timeline
                            </Typography>
                            <Stack spacing={2.5}>
                                <Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                                        Status
                                    </Typography>
                                    <Chip 
                                        icon={getStatusIcon(request.status)}
                                        label={request.status} 
                                        color={getStatusColor(request.status)}
                                        size="medium"
                                        sx={{ 
                                            fontWeight: 600,
                                            height: 32,
                                            '& .MuiChip-icon': {
                                                color: 'inherit'
                                            }
                                        }}
                                    />
                                </Box>
                                <Box sx={{
                                    bgcolor: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                                    background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                                    borderRadius: 2,
                                    p: 2,
                                    border: '2px solid #4caf50',
                                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.25)'
                                }}>
                                    <Typography variant="body2" sx={{ 
                                        mb: 1.5, 
                                        fontWeight: 700,
                                        color: 'white',
                                        fontSize: '0.875rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Submitted
                                    </Typography>
                                    <Typography variant="body1" sx={{ 
                                        fontWeight: 700, 
                                        color: 'white',
                                        fontSize: '1.1rem',
                                        textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                    }}>
                                        {formatDate(request.createdAt)}
                                    </Typography>
                                </Box>
                                {request.approvedAt && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                                            {request.status === 'Approved' ? 'Approved' : 'Rejected'} On
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontWeight: 500, color: '#424242' }}>
                                            {formatDate(request.approvedAt)}
                                        </Typography>
                                    </Box>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                </Box>

                {/* Leave Dates */}
                <Card sx={{ 
                    mb: 3, 
                    boxShadow: `0 2px 8px ${primaryColor.shadow}`,
                    borderRadius: 3,
                    border: `1px solid ${primaryColor.border}`,
                    background: '#ffffff'
                }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                            <CalendarIcon sx={{ color: primaryColor.dark, fontSize: 24 }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryColor.main }}>
                                Leave Dates
                            </Typography>
                        </Box>
                        {request.requestType === 'Compensatory' && request.alternateDate ? (
                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                <Box sx={{ 
                                    p: 2.5, 
                                    background: primaryColor.solidGradient,
                                    borderRadius: 2,
                                    color: 'white',
                                    boxShadow: `0 4px 12px ${primaryColor.shadowStrong}`
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                                        <Chip 
                                            label={`${countLeaveDays(request.leaveDates)} day${countLeaveDays(request.leaveDates) !== 1 ? 's' : ''}`} 
                                            size="small" 
                                            sx={{ 
                                                bgcolor: 'rgba(255,255,255,0.25)',
                                                color: 'white',
                                                border: '1px solid rgba(255,255,255,0.4)',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                                minWidth: '70px',
                                                justifyContent: 'center',
                                                height: 28
                                            }}
                                            variant="outlined"
                                        />
                                        <Typography variant="body2" fontWeight={700}>Leave Date</Typography>
                                    </Box>
                                    <Typography variant="body1" sx={{ ml: 9, fontWeight: 500 }}>
                                        {formatDateRange(request.leaveDates)}
                                    </Typography>
                                </Box>
                                <Box sx={{ 
                                    p: 2.5, 
                                    bgcolor: primaryColor.subtle,
                                    borderRadius: 2,
                                    border: `2px solid ${primaryColor.border}`,
                                    color: primaryColor.main
                                }}>
                                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                                        Alternate Work Date
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                        {formatDate(request.alternateDate)}
                                    </Typography>
                                </Box>
                            </Box>
                        ) : (
                            <Box sx={{ 
                                p: 2.5, 
                                background: primaryColor.solidGradient,
                                borderRadius: 2,
                                color: 'white',
                                boxShadow: `0 4px 12px ${primaryColor.shadowStrong}`
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                    <Chip 
                                        label={`${countLeaveDays(request.leaveDates)} day${countLeaveDays(request.leaveDates) !== 1 ? 's' : ''}`} 
                                        size="small" 
                                        sx={{ 
                                            bgcolor: 'rgba(255,255,255,0.25)',
                                            color: 'white',
                                            border: '1px solid rgba(255,255,255,0.4)',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            minWidth: '70px',
                                            justifyContent: 'center',
                                            height: 28
                                        }}
                                        variant="outlined"
                                    />
                                    <Typography variant="body1" sx={{ fontWeight: 500, pt: 0.5 }}>
                                        {formatDateRange(request.leaveDates)}
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </CardContent>
                </Card>

                {/* Reason */}
                <Card sx={{ 
                    mb: 3, 
                    boxShadow: `0 2px 8px ${primaryColor.shadow}`,
                    borderRadius: 3,
                    border: `1px solid ${primaryColor.border}`,
                    background: '#ffffff'
                }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                            <DescriptionIcon sx={{ color: primaryColor.dark, fontSize: 24 }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryColor.main }}>
                                Reason
                            </Typography>
                        </Box>
                        <Box sx={{ 
                            p: 2.5, 
                            bgcolor: 'rgba(44, 62, 80, 0.06)',
                            borderRadius: 2, 
                            border: `1px solid ${primaryColor.border}`,
                            minHeight: 80
                        }}>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: '#424242', lineHeight: 1.7 }}>
                                {request.reason}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>

                {/* Medical Certificate (for Sick Leave) */}
                {request.requestType === 'Sick' && request.medicalCertificate && (
                    <Card sx={{ 
                        mb: 3, 
                        boxShadow: `0 2px 8px ${primaryColor.shadow}`,
                        borderRadius: 3,
                        border: `1px solid ${primaryColor.border}`,
                        background: '#ffffff'
                    }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                                <AttachFileIcon sx={{ color: primaryColor.dark, fontSize: 24 }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryColor.main }}>
                                    Medical Certificate
                                </Typography>
                            </Box>
                            <Box sx={{ 
                                p: 2.5, 
                                bgcolor: 'rgba(44, 62, 80, 0.06)',
                                borderRadius: 2, 
                                border: `1px solid ${primaryColor.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 2
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                                    {request.medicalCertificate.toLowerCase().endsWith('.pdf') ? (
                                        <PdfIcon sx={{ color: '#d32f2f', fontSize: 40 }} />
                                    ) : (
                                        <ImageIcon sx={{ color: primaryColor.main, fontSize: 40 }} />
                                    )}
                                    <Box>
                                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#424242', mb: 0.5 }}>
                                            Medical Certificate
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {request.medicalCertificate.split('/').pop() || 'Certificate file'}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Stack direction="row" spacing={1}>
                                    <Button
                                        variant="outlined"
                                        startIcon={loadingCertificate ? <CircularProgress size={16} /> : <VisibilityIcon />}
                                        onClick={() => handleViewCertificate(request.medicalCertificate)}
                                        disabled={loadingCertificate}
                                        sx={{
                                            borderColor: primaryColor.borderStrong,
                                            color: primaryColor.main,
                                            fontWeight: 600,
                                            '&:hover': {
                                                borderColor: primaryColor.main,
                                                bgcolor: primaryColor.subtle
                                            },
                                            '&:disabled': {
                                                borderColor: primaryColor.border,
                                                color: primaryColor.main,
                                                opacity: 0.6
                                            }
                                        }}
                                    >
                                        View
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={loadingCertificate ? <CircularProgress size={16} /> : <OpenInNewIcon />}
                                        onClick={() => handleViewCertificate(request.medicalCertificate)}
                                        disabled={loadingCertificate}
                                        sx={{
                                            bgcolor: primaryColor.main,
                                            color: 'white',
                                            fontWeight: 600,
                                            '&:hover': {
                                                bgcolor: primaryColor.dark
                                            },
                                            '&:disabled': {
                                                bgcolor: primaryColor.light,
                                                opacity: 0.7
                                            }
                                        }}
                                    >
                                        Open
                                    </Button>
                                </Stack>
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {/* Rejection Notes (if exists) */}
                {request.rejectionNotes && (
                    <Card sx={{ 
                        mb: 3, 
                        boxShadow: `0 2px 8px ${primaryColor.shadowStrong}`,
                        borderRadius: 3, 
                        border: `2px solid ${primaryColor.main}`,
                        background: 'linear-gradient(135deg, #ffecec 0%, #ffdcdc 100%)'
                    }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                <WarningIcon sx={{ color: primaryColor.dark, fontSize: 24 }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryColor.main }}>
                                    Rejection Reason
                                </Typography>
                            </Box>
                            <Box sx={{ 
                                p: 2.5, 
                                bgcolor: primaryColor.subtleStrong,
                                borderRadius: 2,
                                border: `1px solid ${primaryColor.borderStrong}`,
                                color: primaryColor.dark
                            }}>
                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>
                                    {request.rejectionNotes}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {/* Rejection Form */}
                {showRejectForm && (
                    <Card sx={{ 
                        mb: 3, 
                        boxShadow: `0 4px 16px ${primaryColor.shadowStrong}`,
                        borderRadius: 3, 
                        border: `2px solid ${primaryColor.main}`,
                        background: 'linear-gradient(135deg, #ffecec 0%, #ffdcdc 100%)'
                    }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                                <WarningIcon sx={{ color: primaryColor.dark, fontSize: 26 }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: primaryColor.main }}>
                                    Rejection Reason Required
                                </Typography>
                            </Box>
                            <Alert 
                                severity="warning" 
                                sx={{ 
                                    mb: 2.5,
                                    bgcolor: 'rgba(255, 152, 0, 0.1)',
                                    border: '1px solid rgba(255, 152, 0, 0.3)',
                                    borderRadius: 2,
                                    '& .MuiAlert-icon': {
                                        color: '#f57c00'
                                    }
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
                                    '& .MuiOutlinedInput-root': {
                                        bgcolor: 'white',
                                        '&:hover fieldset': {
                                            borderColor: primaryColor.main
                                        },
                                        '&.Mui-focused fieldset': {
                                            borderColor: primaryColor.main,
                                            borderWidth: 2
                                        }
                                    }
                                }}
                            />
                        </CardContent>
                    </Card>
                )}
            </DialogContent>

            {/* Actions */}
            <DialogActions sx={{ p: 3, pt: 2, bgcolor: '#fafafa', borderTop: `1px solid ${primaryColor.border}` }}>
                <Box sx={{ display: 'flex', gap: 2, width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Left side - Edit/Delete actions */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Edit Request">
                            <IconButton 
                                onClick={() => onEdit(request)} 
                                sx={{
                                    bgcolor: primaryColor.subtle,
                                    color: primaryColor.dark,
                                    border: `1px solid ${primaryColor.border}`,
                                    '&:hover': {
                                        bgcolor: primaryColor.subtleStrong,
                                        borderColor: primaryColor.main
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
                                    bgcolor: primaryColor.subtle,
                                    color: primaryColor.dark,
                                    border: `1px solid ${primaryColor.border}`,
                                    '&:hover': {
                                        bgcolor: primaryColor.subtleStrong,
                                        borderColor: primaryColor.main
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
                                        borderColor: primaryColor.borderStrong,
                                        color: primaryColor.main,
                                        fontWeight: 600,
                                        px: 3,
                                        '&:hover': {
                                            borderColor: primaryColor.main,
                                            bgcolor: primaryColor.subtle
                                        }
                                    }}
                                >
                                    Close
                                </Button>
                                {request.status === 'Pending' && (
                                    <>
                                        <Button 
                                            onClick={() => setShowRejectForm(true)} 
                                            variant="outlined"
                                            startIcon={<CancelIcon />}
                                            sx={{
                                                borderColor: primaryColor.main,
                                                color: primaryColor.main,
                                                fontWeight: 600,
                                                px: 3,
                                                '&:hover': {
                                                    borderColor: primaryColor.dark,
                                                    bgcolor: primaryColor.subtleStrong
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
                                                bgcolor: primaryColor.main,
                                                color: 'white',
                                                fontWeight: 700,
                                                px: 3,
                                                boxShadow: `0 4px 12px ${primaryColor.shadowStrong}`,
                                                '&:hover': {
                                                    bgcolor: primaryColor.dark,
                                                    boxShadow: `0 6px 16px ${primaryColor.shadowStrong}`
                                                },
                                                '&:disabled': {
                                                    bgcolor: 'rgba(44, 62, 80, 0.5)'
                                                }
                                            }}
                                        >
                                            {actionLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Approve'}
                                        </Button>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <Button 
                                    onClick={() => setShowRejectForm(false)} 
                                    variant="outlined"
                                    sx={{
                                        borderColor: primaryColor.borderStrong,
                                        color: primaryColor.main,
                                        fontWeight: 600,
                                        px: 3,
                                        '&:hover': {
                                            borderColor: primaryColor.main,
                                            bgcolor: primaryColor.subtle
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
                                        bgcolor: primaryColor.main,
                                        color: 'white',
                                        fontWeight: 700,
                                        px: 3,
                                        boxShadow: `0 4px 12px ${primaryColor.shadowStrong}`,
                                        '&:hover': {
                                            bgcolor: primaryColor.dark,
                                            boxShadow: `0 6px 16px ${primaryColor.shadowStrong}`
                                        },
                                        '&:disabled': {
                                            bgcolor: 'rgba(205, 92, 92, 0.5)'
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

