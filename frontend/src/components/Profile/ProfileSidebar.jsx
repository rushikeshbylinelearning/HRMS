import { memo, useState, useRef, useCallback } from 'react';
import { Card, Typography, Stack, Box, Chip, Divider, IconButton, CircularProgress, Snackbar, Alert } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UserAvatar from '../common/UserAvatar'; // CENTRALIZED AVATAR COMPONENT
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

/**
 * ROOT CAUSE FIX: Memoize ProfileSidebar to prevent unnecessary re-renders
 * This component should ONLY re-render when user data actually changes
 * 
 * REFACTORED: Modern UI with red accent color and improved vertical spacing
 * UPDATED: Uses centralized UserAvatar component with GridFS support
 * ENHANCED: Profile image upload with real-time updates across app
 */
const ProfileSidebar = memo(({ user }) => {
    const { updateUserContext, refreshUserData } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const fileInputRef = useRef(null);

    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Date formatting error:', error);
            return 'Not specified';
        }
    };

    const getStatusBadge = () => {
        // Prioritize employmentStatus for more specific status
        if (user?.employmentStatus) {
            return user.employmentStatus;
        }
        // Fallback to role if employmentStatus is not available
        if (user?.role) {
            return user.role;
        }
        // Default fallback
        return 'Staff';
    };

    // Handle avatar upload
    const handleAvatarClick = () => {
        if (!uploading) {
            fileInputRef.current?.click();
        }
    };

    const handleFileSelect = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset input to allow re-uploading same file
        event.target.value = '';

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setSnackbar({
                open: true,
                message: 'Please select a valid image file (JPEG, PNG, GIF, or WebP)',
                severity: 'error'
            });
            return;
        }

        // Validate file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            setSnackbar({
                open: true,
                message: 'File size exceeds 5MB limit. Please choose a smaller image.',
                severity: 'error'
            });
            return;
        }

        // Upload file
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('profileImage', file);

            // IMPORTANT: Do NOT set Content-Type manually for FormData.
            // The browser/axios automatically sets 'multipart/form-data; boundary=...'
            // Setting it manually strips the boundary parameter and breaks parsing.
            const response = await api.post('/users/upload-avatar', formData);

            console.log('[ProfileSidebar] Upload response:', response.data);

            // Immediately update local context for instant UI feedback
            const newImageUrl = response.data.imageUrl;
            console.log('[ProfileSidebar] New image URL:', newImageUrl);
            updateUserContext({ profileImageUrl: newImageUrl });

            // Also refresh from server to sync cache (backend invalidates user cache after upload)
            try {
                await refreshUserData();
            } catch (refreshErr) {
                // Non-fatal: local context already updated above
                console.warn('[ProfileSidebar] Could not refresh user data:', refreshErr);
            }

            setSnackbar({
                open: true,
                message: 'Profile image updated successfully!',
                severity: 'success'
            });

        } catch (error) {
            console.error('[ProfileSidebar] Avatar upload error:', error);
            const errorMessage = error.response?.data?.error || 'Failed to upload image. Please try again.';
            setSnackbar({
                open: true,
                message: errorMessage,
                severity: 'error'
            });
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveAvatar = useCallback(async () => {
        if (uploading || !user?.profileImageUrl) return;

        setUploading(true);
        try {
            // Call backend to clear profileImageUrl in DB
            await api.delete('/users/remove-avatar');

            // Update local context immediately for instant UI feedback
            updateUserContext({ profileImageUrl: '' });

            // Refresh from server to ensure cache is synced
            try {
                await refreshUserData();
            } catch (refreshErr) {
                console.warn('[ProfileSidebar] Could not refresh user data after removal:', refreshErr);
            }

            setSnackbar({
                open: true,
                message: 'Profile image removed successfully!',
                severity: 'success'
            });

        } catch (error) {
            console.error('[ProfileSidebar] Avatar removal error:', error);
            setSnackbar({
                open: true,
                message: error.response?.data?.error || 'Failed to remove image. Please try again.',
                severity: 'error'
            });
        } finally {
            setUploading(false);
        }
    }, [uploading, user?.profileImageUrl, updateUserContext, refreshUserData]);

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    return (
        <Card 
            elevation={0}
            sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: 320,
                minWidth: 280,
                overflow: 'hidden',
                transition: 'box-shadow 0.3s ease',
                '&:hover': {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }
            }}
        >
            {/* Red accent bar at top */}
            <Box 
                sx={{ 
                    height: 4, 
                    background: 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)',
                    width: '100%'
                }} 
            />

            <Stack spacing={3.5} sx={{ p: 3.5 }}>
                {/* Avatar with upload overlay */}
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
                    <Box
                        sx={{
                            position: 'relative',
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                inset: -4,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                                opacity: 0.1,
                                zIndex: 0
                            }
                        }}
                    >
                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                            disabled={uploading}
                        />

                        {/* Avatar with hover overlay */}
                        <Box
                            sx={{
                                position: 'relative',
                                cursor: uploading ? 'not-allowed' : 'pointer',
                                '&:hover .avatar-overlay': {
                                    opacity: uploading ? 0 : 1
                                }
                            }}
                            onClick={handleAvatarClick}
                        >
                            <UserAvatar
                                user={user}
                                size="lg"
                                key={user?.profileImageUrl} // Force re-render on URL change
                                sx={{
                                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                                    position: 'relative',
                                    zIndex: 1
                                }}
                            />

                            {/* Upload overlay */}
                            <Box
                                className="avatar-overlay"
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    borderRadius: '50%',
                                    background: 'rgba(0, 0, 0, 0.55)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0,
                                    transition: 'opacity 0.3s ease',
                                    zIndex: 2,
                                    pointerEvents: 'none'
                                }}
                            >
                                <CameraAltIcon sx={{ color: 'white', fontSize: 28, mb: 0.5 }} />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'white',
                                        fontWeight: 600,
                                        fontSize: '0.7rem',
                                        textAlign: 'center'
                                    }}
                                >
                                    Change Photo
                                </Typography>
                            </Box>

                            {/* Loading spinner */}
                            {uploading && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        borderRadius: '50%',
                                        background: 'rgba(0, 0, 0, 0.7)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 3
                                    }}
                                >
                                    <CircularProgress
                                        size={32}
                                        sx={{
                                            color: 'white'
                                        }}
                                    />
                                </Box>
                            )}
                        </Box>

                        {/* Remove avatar button (only if avatar exists) */}
                        {user?.profileImageUrl && !uploading && (
                            <IconButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveAvatar();
                                }}
                                sx={{
                                    position: 'absolute',
                                    bottom: -4,
                                    right: -4,
                                    bgcolor: 'white',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                    width: 32,
                                    height: 32,
                                    zIndex: 3,
                                    '&:hover': {
                                        bgcolor: '#fee',
                                        '& svg': {
                                            color: '#dc2626'
                                        }
                                    }
                                }}
                                size="small"
                            >
                                <DeleteOutlineIcon sx={{ fontSize: 18, color: '#666' }} />
                            </IconButton>
                        )}
                    </Box>
                </Box>

                {/* Name & Status */}
                <Stack spacing={1.5} alignItems="center">
                    <Typography 
                        variant="h5" 
                        sx={{ 
                            fontWeight: 700,
                            textAlign: 'center',
                            color: '#1a1a1a',
                            letterSpacing: '-0.02em'
                        }}
                    >
                        {user?.fullName || 'Test Admin'}
                    </Typography>
                    
                    <Typography 
                        variant="body2" 
                        sx={{ 
                            color: 'text.secondary',
                            textAlign: 'center',
                            fontSize: '0.9rem'
                        }}
                    >
                        {user?.designation || 'Not specified'}
                    </Typography>
                    
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                        <Chip 
                            label={user?.employeeCode || 'A200001'}
                            size="small"
                            sx={{
                                bgcolor: '#f5f5f5',
                                color: '#525252',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                height: 28,
                                borderRadius: 2,
                                '& .MuiChip-label': {
                                    px: 1.5
                                }
                            }}
                        />
                        <Chip 
                            label={getStatusBadge()}
                            size="small"
                            sx={{
                                background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                height: 28,
                                borderRadius: 2,
                                '& .MuiChip-label': {
                                    px: 1.5
                                }
                            }}
                        />
                    </Stack>
                </Stack>

                {/* Divider */}
                <Divider sx={{ my: 1 }} />

                {/* Details with icons */}
                <Stack spacing={3}>
                    {/* Department */}
                    <Box>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <BusinessIcon sx={{ fontSize: 16, color: '#dc2626' }} />
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    fontWeight: 700,
                                    color: '#737373',
                                    fontSize: '0.7rem',
                                    letterSpacing: '0.8px',
                                    textTransform: 'uppercase'
                                }}
                            >
                                Department
                            </Typography>
                        </Stack>
                        <Typography 
                            variant="body1" 
                            sx={{ 
                                color: '#1a1a1a',
                                fontWeight: 600,
                                fontSize: '0.95rem',
                                pl: 3
                            }}
                        >
                            {user?.department || 'IT'}
                        </Typography>
                    </Box>

                    {/* Join Date */}
                    <Box>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <CalendarTodayIcon sx={{ fontSize: 16, color: '#dc2626' }} />
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    fontWeight: 700,
                                    color: '#737373',
                                    fontSize: '0.7rem',
                                    letterSpacing: '0.8px',
                                    textTransform: 'uppercase'
                                }}
                            >
                                Join Date
                            </Typography>
                        </Stack>
                        <Typography 
                            variant="body1" 
                            sx={{ 
                                color: '#1a1a1a',
                                fontWeight: 600,
                                fontSize: '0.95rem',
                                pl: 3
                            }}
                        >
                            {formatDate(user?.joiningDate)}
                        </Typography>
                    </Box>

                    {/* Work Email */}
                    <Box>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <EmailIcon sx={{ fontSize: 16, color: '#dc2626' }} />
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    fontWeight: 700,
                                    color: '#737373',
                                    fontSize: '0.7rem',
                                    letterSpacing: '0.8px',
                                    textTransform: 'uppercase'
                                }}
                            >
                                Work Email
                            </Typography>
                        </Stack>
                        <Typography 
                            variant="body1" 
                            sx={{ 
                                color: '#1a1a1a',
                                fontWeight: 500,
                                fontSize: '0.9rem',
                                wordBreak: 'break-word',
                                pl: 3
                            }}
                        >
                            {user?.email || 'sudhirtech@example.com'}
                        </Typography>
                    </Box>
                </Stack>
            </Stack>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Card>
    );
});

ProfileSidebar.displayName = 'ProfileSidebar';

export default ProfileSidebar;
