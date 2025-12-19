import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Chip,
    Divider,
    Alert,
    Fade,
    Slide,
    Paper,
    Avatar,
    Stack,
    IconButton,
    Tooltip
} from '@mui/material';
import { formatLeaveRequestType } from '../utils/saturdayUtils';
import {
    Close as CloseIcon,
    Person as PersonIcon,
    CalendarToday as CalendarIcon,
    Description as DescriptionIcon,
    Cancel as CancelIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    AccessTime as AccessTimeIcon,
    Event as EventIcon
} from '@mui/icons-material';

// Add CSS animations
const styles = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes spin-fast {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
        20%, 40%, 60%, 80% { transform: translateX(2px); }
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

const LeaveRejectionModal = ({ open, onClose, onConfirm, request, loading = false }) => {
    const [rejectionReason, setRejectionReason] = useState('');
    const [error, setError] = useState('');

    const handleClose = () => {
        setRejectionReason('');
        setError('');
        onClose();
    };

    const handleConfirm = () => {
        if (!rejectionReason.trim()) {
            setError('Please provide a reason for rejection');
            return;
        }
        
        if (rejectionReason.trim().length < 10) {
            setError('Rejection reason must be at least 10 characters long');
            return;
        }

        onConfirm(rejectionReason.trim());
    };

    const formatDateRange = (dateStrings) => {
        if (!dateStrings || dateStrings.length === 0) return 'N/A';
        
        const dates = dateStrings
            .map(dateStr => new Date(dateStr))
            .filter(date => !isNaN(date.getTime()))
            .sort((a, b) => a - b);
        
        if (dates.length === 0) return 'N/A';
        if (dates.length === 1) return dates[0].toLocaleDateString();
        
        // Group consecutive dates into ranges
        const ranges = [];
        let start = dates[0];
        let end = dates[0];
        
        for (let i = 1; i < dates.length; i++) {
            const currentDate = dates[i];
            const previousDate = dates[i - 1];
            const dayDiff = (currentDate - previousDate) / (1000 * 60 * 60 * 24);
            
            if (dayDiff === 1) {
                end = currentDate;
            } else {
                ranges.push({ start, end });
                start = currentDate;
                end = currentDate;
            }
        }
        
        ranges.push({ start, end });
        
        return ranges.map(range => {
            if (range.start.getTime() === range.end.getTime()) {
                return range.start.toLocaleDateString();
            } else {
                return `${range.start.toLocaleDateString()} - ${range.end.toLocaleDateString()}`;
            }
        }).join(', ');
    };

    const countLeaveDays = (dateStrings) => {
        if (!dateStrings || dateStrings.length === 0) return 0;
        return dateStrings.length;
    };

    if (!request) return null;

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            TransitionComponent={Slide}
            transitionDuration={300}
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            {/* Header with gradient background */}
            <DialogTitle sx={{ 
                background: 'linear-gradient(135deg, #d32f2f 0%, #f44336 100%)',
                color: 'white',
                p: 3,
                position: 'relative',
                overflow: 'hidden'
            }}>
                <Box sx={{ 
                    position: 'absolute', 
                    top: 0, 
                    right: 0, 
                    width: '100px', 
                    height: '100px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '50%',
                    transform: 'translate(30px, -30px)'
                }} />
                <Box sx={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    left: 0, 
                    width: '80px', 
                    height: '80px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '50%',
                    transform: 'translate(-20px, 20px)'
                }} />
                
                <Stack direction="row" alignItems="center" spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
                    <Avatar sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)', 
                        width: 48, 
                        height: 48,
                        backdropFilter: 'blur(10px)'
                    }}>
                        <CancelIcon sx={{ fontSize: 28 }} />
                    </Avatar>
                    <Box>
                        <Typography variant="h5" component="div" sx={{ 
                            fontWeight: 600,
                            mb: 0.5
                        }}>
                            Reject Leave Request
                        </Typography>
                        <Typography variant="body2" sx={{ 
                            opacity: 0.9,
                            fontWeight: 400
                        }}>
                            Please provide a reason for rejection
                        </Typography>
                    </Box>
                </Stack>
                
                <IconButton
                    onClick={handleClose}
                    sx={{ 
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        color: 'white',
                        bgcolor: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.2)'
                        }
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ 
                p: 0, 
                flex: 1,
                overflow: 'auto',
                '&::-webkit-scrollbar': {
                    width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                    background: '#f1f1f1',
                    borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb': {
                    background: '#c1c1c1',
                    borderRadius: '3px',
                    '&:hover': {
                        background: '#a8a8a8',
                    },
                },
            }}>
                {/* Leave Request Details Card */}
                <Fade in timeout={400}>
                    <Paper elevation={0} sx={{ 
                        m: 3, 
                        mb: 2,
                        borderRadius: 2,
                        border: '1px solid #e3f2fd',
                        background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                        overflow: 'hidden'
                    }}>
                        <Box sx={{ 
                            background: '#2C3E50',
                            p: 2,
                            color: 'white'
                        }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <PersonIcon />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Leave Request Details
                                </Typography>
                            </Stack>
                        </Box>
                        
                        <Box sx={{ p: 3 }}>
                            {/* Employee Info Row */}
                            <Stack direction="row" spacing={3} sx={{ mb: 3 }}>
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1,
                                    flex: 1,
                                    p: 2,
                                    bgcolor: 'grey.50',
                                    borderRadius: 2,
                                    border: '1px solid #e0e0e0',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        bgcolor: 'grey.100',
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                    }
                                }}>
                                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                                        <PersonIcon fontSize="small" />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                            EMPLOYEE
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                            {request.employee?.fullName || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Box>
                                
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1,
                                    flex: 1,
                                    p: 2,
                                    bgcolor: 'grey.50',
                                    borderRadius: 2,
                                    border: '1px solid #e0e0e0',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        bgcolor: 'grey.100',
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                    }
                                }}>
                                    <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                                        <EventIcon fontSize="small" />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                            LEAVE TYPE
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                            {formatLeaveRequestType(request.requestType)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Stack>
                            
                            {/* Duration and Leave Type Row */}
                            <Stack direction="row" spacing={3} sx={{ mb: 3 }}>
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1,
                                    flex: 1,
                                    p: 2,
                                    bgcolor: 'grey.50',
                                    borderRadius: 2,
                                    border: '1px solid #e0e0e0',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        bgcolor: 'grey.100',
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                    }
                                }}>
                                    <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                                        <AccessTimeIcon fontSize="small" />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                            DURATION
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                            {countLeaveDays(request.leaveDates)} day{countLeaveDays(request.leaveDates) !== 1 ? 's' : ''}
                                        </Typography>
                                    </Box>
                                </Box>
                                
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1,
                                    flex: 1,
                                    p: 2,
                                    bgcolor: 'grey.50',
                                    borderRadius: 2,
                                    border: '1px solid #e0e0e0',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        bgcolor: 'grey.100',
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                    }
                                }}>
                                    <Avatar sx={{ bgcolor: 'info.main', width: 32, height: 32 }}>
                                        <CalendarIcon fontSize="small" />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                            LEAVE TYPE
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                            {request.leaveType}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Stack>
                            
                            {/* Dates Row */}
                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1,
                                p: 2,
                                bgcolor: 'grey.50',
                                borderRadius: 2,
                                border: '1px solid #e0e0e0',
                                mb: 3
                            }}>
                                <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}>
                                    <CalendarIcon fontSize="small" />
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        REQUESTED DATES
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                        {formatDateRange(request.leaveDates)}
                                    </Typography>
                                </Box>
                            </Box>
                            
                            {/* Reason Section */}
                            {request.reason && (
                                <Box sx={{ 
                                    p: 2,
                                    bgcolor: 'grey.50',
                                    borderRadius: 2,
                                    border: '1px solid #e0e0e0',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        bgcolor: 'grey.100',
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                    }
                                }}>
                                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                                        <Avatar sx={{ bgcolor: 'grey.600', width: 32, height: 32, mt: 0.5 }}>
                                            <DescriptionIcon fontSize="small" />
                                        </Avatar>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                                                REASON FOR LEAVE
                                            </Typography>
                                            <Paper elevation={0} sx={{ 
                                                p: 2, 
                                                bgcolor: 'white',
                                                borderRadius: 1,
                                                border: '1px solid #e0e0e0'
                                            }}>
                                                <Typography variant="body2" sx={{ 
                                                    whiteSpace: 'pre-wrap',
                                                    lineHeight: 1.6
                                                }}>
                                                    {request.reason}
                                                </Typography>
                                            </Paper>
                                        </Box>
                                    </Stack>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Fade>

                {/* Rejection Reason Input Section */}
                <Fade in timeout={600}>
                    <Paper elevation={0} sx={{ 
                        m: 3, 
                        mt: 0,
                        borderRadius: 2,
                        border: '1px solid #ffebee',
                        background: 'linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)',
                        overflow: 'hidden'
                    }}>
                        <Box sx={{ 
                            background: 'linear-gradient(135deg, #d32f2f 0%, #f44336 100%)',
                            p: 2,
                            color: 'white'
                        }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <WarningIcon />
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Rejection Reason
                                </Typography>
                            </Stack>
                        </Box>
                        
                        <Box sx={{ p: 3 }}>
                            <Alert 
                                severity="info" 
                                sx={{ 
                                    mb: 3,
                                    borderRadius: 2,
                                    '& .MuiAlert-icon': {
                                        fontSize: '1.2rem'
                                    }
                                }}
                                icon={<CheckCircleIcon />}
                            >
                                <Typography variant="body2">
                                    <strong>Important:</strong> Please provide a clear and constructive reason for rejecting this leave request. 
                                    This reason will be sent to the employee and should help them understand the decision.
                                </Typography>
                            </Alert>
                            
                            {error && (
                                <Fade in>
                                    <Alert 
                                        severity="error" 
                                        sx={{ 
                                            mb: 3,
                                            borderRadius: 2,
                                            animation: 'shake 0.5s ease-in-out'
                                        }}
                                    >
                                        {error}
                                    </Alert>
                                </Fade>
                            )}
                            
                            <TextField
                                fullWidth
                                multiline
                                rows={5}
                                value={rejectionReason}
                                onChange={(e) => {
                                    setRejectionReason(e.target.value);
                                    if (error) setError('');
                                }}
                                placeholder="Please provide a detailed reason for rejecting this leave request. Be specific and constructive in your feedback..."
                                variant="outlined"
                                error={!!error}
                                helperText={
                                    <Box sx={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        mt: 1
                                    }}>
                                        <Typography variant="caption" color={error ? 'error' : 'text.secondary'}>
                                            {rejectionReason.length < 10 
                                                ? `Minimum 10 characters required (${10 - rejectionReason.length} more needed)`
                                                : 'Reason looks good!'
                                            }
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {rejectionReason.length}/500 characters
                                        </Typography>
                                    </Box>
                                }
                                inputProps={{ maxLength: 500 }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        transition: 'all 0.3s ease',
                                        '&:hover fieldset': {
                                            borderColor: 'error.main',
                                            borderWidth: 2,
                                        },
                                        '&.Mui-focused fieldset': {
                                            borderColor: 'error.main',
                                            borderWidth: 2,
                                        },
                                        '&.Mui-error fieldset': {
                                            borderColor: 'error.main',
                                            borderWidth: 2,
                                        }
                                    },
                                    '& .MuiInputBase-input': {
                                        fontSize: '0.95rem',
                                        lineHeight: 1.6
                                    }
                                }}
                            />
                            
                            {/* Character count indicator */}
                            <Box sx={{ 
                                mt: 2, 
                                display: 'flex', 
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}>
                                <Box sx={{ 
                                    width: '100%',
                                    height: 4,
                                    bgcolor: 'grey.200',
                                    borderRadius: 2,
                                    overflow: 'hidden'
                                }}>
                                    <Box sx={{ 
                                        width: `${Math.min((rejectionReason.length / 500) * 100, 100)}%`,
                                        height: '100%',
                                        bgcolor: rejectionReason.length >= 10 ? 'success.main' : 'warning.main',
                                        transition: 'all 0.3s ease',
                                        borderRadius: 2
                                    }} />
                                </Box>
                            </Box>
                        </Box>
                    </Paper>
                </Fade>
            </DialogContent>

            <DialogActions sx={{ 
                p: 3, 
                pt: 2, 
                gap: 2,
                background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                borderTop: '1px solid #e0e0e0'
            }}>
                <Button
                    onClick={handleClose}
                    disabled={loading}
                    variant="outlined"
                    size="large"
                    sx={{ 
                        minWidth: 120,
                        height: 48,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: 'grey.400',
                        color: 'grey.700',
                        '&:hover': {
                            borderColor: 'grey.600',
                            bgcolor: 'grey.50'
                        }
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={loading || !rejectionReason.trim() || rejectionReason.length < 10}
                    variant="contained"
                    size="large"
                    sx={{ 
                        minWidth: 140,
                        height: 48,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 700,
                        color: 'white',
                        background: 'linear-gradient(135deg, #d32f2f 0%, #f44336 100%)',
                        boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)',
                        '&:hover': {
                            background: 'linear-gradient(135deg, #b71c1c 0%, #d32f2f 100%)',
                            boxShadow: '0 6px 16px rgba(211, 47, 47, 0.4)',
                            transform: 'translateY(-1px)',
                            color: 'white'
                        },
                        '&:disabled': {
                            background: 'grey.300',
                            color: 'grey.500',
                            boxShadow: 'none',
                            transform: 'none'
                        },
                        transition: 'all 0.3s ease',
                        '& .MuiButton-startIcon': {
                            color: 'white'
                        }
                    }}
                >
                    {loading ? (
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Box sx={{ 
                                width: 16, 
                                height: 16, 
                                border: '2px solid rgba(255,255,255,0.3)',
                                borderTop: '2px solid white',
                                borderRadius: '50%',
                                animation: 'spin-fast 0.5s linear infinite'
                            }} />
                            <Typography sx={{ 
                                color: 'white', 
                                fontWeight: 700,
                                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                            }}>
                                Rejecting...
                            </Typography>
                        </Stack>
                    ) : (
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <CancelIcon fontSize="small" sx={{ color: 'white' }} />
                            <Typography sx={{ 
                                color: 'white', 
                                fontWeight: 700,
                                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                            }}>
                                Reject Leave
                            </Typography>
                        </Stack>
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default LeaveRejectionModal;
