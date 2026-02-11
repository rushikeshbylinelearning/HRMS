import { memo } from 'react';
import { Card, Avatar, Typography, Stack, Box, Chip, Divider } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

/**
 * ROOT CAUSE FIX: Memoize ProfileSidebar to prevent unnecessary re-renders
 * This component should ONLY re-render when user data actually changes
 * 
 * REFACTORED: Modern UI with red accent color and improved vertical spacing
 */
const ProfileSidebar = memo(({ user }) => {
    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        return (parts.length >= 2 
            ? parts[0][0] + parts[parts.length - 1][0] 
            : name.substring(0, 2)
        ).toUpperCase();
    };

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

    // Debug: Log user data to check joiningDate
    console.log('ProfileSidebar - User data:', {
        joiningDate: user?.joiningDate,
        fullName: user?.fullName,
        department: user?.department
    });

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
                {/* Avatar with red gradient background */}
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
                        <Avatar
                            sx={{
                                width: 90,
                                height: 90,
                                fontSize: '2rem',
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                                color: 'white',
                                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                                position: 'relative',
                                zIndex: 1
                            }}
                        >
                            {getInitials(user?.fullName)}
                        </Avatar>
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
        </Card>
    );
});

ProfileSidebar.displayName = 'ProfileSidebar';

export default ProfileSidebar;
