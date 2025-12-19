// src/components/LeaveRequestForm.jsx
import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
    Stack, Typography, Alert, FormControl, InputLabel, Select, MenuItem, Divider,
    Box, IconButton, Avatar, LinearProgress, Tooltip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { isPlannedLeaveDisabled } from '../utils/leaveRules';

const PRIMARY_COLOR = '#2C3E50';
const PRIMARY_LIGHT = '#34495e';
const PRIMARY_DARK = '#23313f';
const PRIMARY_BORDER = 'rgba(44, 62, 80, 0.3)';
const PRIMARY_SHADOW = 'rgba(44, 62, 80, 0.3)';

const initialState = {
    // --- START OF FIX: Changed default to 'Casual' to match the first visible option ---
    requestType: 'Casual',
    // --- END OF FIX ---
    leaveType: 'Full Day',
    startDate: null,
    endDate: null,
    alternateDate: null,
    reason: '',
    medicalCertificate: null,
    medicalCertificateUrl: null,
};

const LeaveRequestForm = ({ open, onClose, onSubmissionSuccess }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState(initialState);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadingCertificate, setUploadingCertificate] = useState(false);
    const [plannedLeaveHistory, setPlannedLeaveHistory] = useState([]);
    
    // Fetch planned leave history when form opens
    useEffect(() => {
        const fetchPlannedLeaveHistory = async () => {
            if (open && user) {
                try {
                    const { data } = await api.get('/leaves/planned-leave-history');
                    setPlannedLeaveHistory(data.history || []);
                } catch (err) {
                    console.error('Error fetching planned leave history:', err);
                    // On error, set empty array to allow form to work
                    setPlannedLeaveHistory([]);
                }
            } else {
                // Reset when form closes
                setPlannedLeaveHistory([]);
            }
        };
        fetchPlannedLeaveHistory();
    }, [open, user]);
    
    useEffect(() => {
        if (open) {
            // If user is on probation, default to an allowed type
            const isProbation = user?.employmentStatus === 'Probation';
            const defaultRequestType = isProbation ? 'Unpaid' : initialState.requestType;
            setFormData({ ...initialState, requestType: defaultRequestType });
            setError('');
            setUploadingCertificate(false);
        }
    }, [open, user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleStartDateChange = (date) => {
        setFormData(prev => {
            const newEndDate = prev.endDate && date && date > prev.endDate ? null : prev.endDate;
            return { ...prev, startDate: date, endDate: newEndDate };
        });
        
        // Refresh planned leave history to get latest eligibility
        if (date && user) {
            api.get('/leaves/planned-leave-history')
                .then(({ data }) => setPlannedLeaveHistory(data.history || []))
                .catch(err => console.error('Error refreshing planned leave history:', err));
        }
    };

    const handleEndDateChange = (date) => {
        setFormData(prev => ({ ...prev, endDate: date }));
    };

    const handleAlternateDateChange = (date) => {
        setFormData(prev => ({ ...prev, alternateDate: date }));
    };

    const handleMedicalCertificateChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setError('Please upload a PDF or image file (JPEG, PNG, GIF).');
            return;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB.');
            return;
        }

        setError('');
        setUploadingCertificate(true);

        try {
            const formData = new FormData();
            formData.append('medicalCertificate', file);

            const { data } = await api.post('/leaves/upload-medical-certificate', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setFormData(prev => ({
                ...prev,
                medicalCertificate: file,
                medicalCertificateUrl: data.fileUrl
            }));
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to upload medical certificate.');
        } finally {
            setUploadingCertificate(false);
        }
    };

    const handleSubmit = async () => {
        setError('');
        if (!formData.reason || !formData.startDate) {
            setError('Please select a start date and provide a reason.');
            return;
        }
        if (formData.reason.trim().length < 100) {
            setError('Reason must be at least 100 characters long. Please provide more details.');
            return;
        }
        if (formData.requestType === 'Compensatory' && !formData.alternateDate) {
            setError('Please select an alternate date for the compensatory leave.');
            return;
        }
        if (formData.requestType === 'Sick' && !formData.medicalCertificateUrl) {
            setError('Medical certificate is mandatory for sick leave. Please upload a medical certificate.');
            return;
        }

        setLoading(true);
        
        const leaveDates = [];
        const start = new Date(formData.startDate);
        const end = formData.endDate ? new Date(formData.endDate) : new Date(start);

        let current = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
        const final = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));

        while (current <= final) {
            leaveDates.push(current.toISOString());
            current.setUTCDate(current.getUTCDate() + 1);
        }

        const payload = {
            requestType: formData.requestType,
            leaveType: formData.leaveType,
            alternateDate: formData.alternateDate,
            reason: formData.reason,
            leaveDates: leaveDates,
            ...(formData.requestType === 'Sick' && formData.medicalCertificateUrl && {
                medicalCertificate: formData.medicalCertificateUrl
            }),
        };

        try {
            const { data } = await api.post('/leaves/request', payload);
            onSubmissionSuccess(data.request);
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.errors?.join(' ') || 'Failed to submit request.');
        } finally {
            setLoading(false);
        }
    };
    
    const isBackdateFlow = formData.requestType === 'Backdated Leave';
    const modalTitle = 'Apply for Leave';
    const descriptionText = isBackdateFlow 
        ? 'Apply for a leave of absence for a past date. This will be sent for approval.' 
        : 'Please fill out the details for your request.';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderRadius: 4,
                    minWidth: '450px',
                    background: '#ffffff',
                    boxShadow: '0 8px 32px rgba(44, 62, 80, 0.12)',
                    overflow: 'hidden'
                }
            }}
        >
            {/* Header with red gradient */}
            <DialogTitle sx={{ 
                fontWeight: 700, 
                pb: 2,
                pt: 3,
                px: 3,
                background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 50%, ${PRIMARY_DARK} 100%)`,
                color: 'white',
                boxShadow: `0 4px 12px ${PRIMARY_SHADOW}`,
                position: 'relative'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ 
                            bgcolor: 'rgba(255,255,255,0.25)', 
                            width: 48, 
                            height: 48,
                            border: '2px solid rgba(255,255,255,0.3)'
                        }}>
                            <CalendarTodayIcon />
                        </Avatar>
                        <Box>
                            <Typography variant="h5" component="div" sx={{ fontWeight: 700, mb: 0.5 }}>
                                {modalTitle}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.95, fontWeight: 500 }}>
                                {descriptionText}
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton 
                        onClick={onClose} 
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
                <Stack spacing={3} sx={{ mt: 1 }}>
                    {error && (
                        <Alert 
                            severity="error"
                            sx={{
                                bgcolor: '#ffebee',
                                border: `1px solid ${PRIMARY_COLOR}`,
                                color: PRIMARY_COLOR,
                                borderRadius: 2,
                                '& .MuiAlert-icon': {
                                    color: PRIMARY_COLOR
                                }
                            }}
                        >
                            {error}
                        </Alert>
                    )}

                    <FormControl fullWidth size="medium">
                        <InputLabel 
                            sx={{ 
                                color: PRIMARY_COLOR,
                                fontWeight: 600,
                                '&.Mui-focused': {
                                    color: PRIMARY_COLOR
                                }
                            }}
                        >
                            Leave Category
                        </InputLabel>
                        <Select
                            name="requestType"
                            value={formData.requestType}
                            label="Leave Category"
                            onChange={handleChange}
                            sx={{
                                bgcolor: 'white',
                                borderRadius: 2,
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: PRIMARY_BORDER
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: PRIMARY_COLOR
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: PRIMARY_COLOR,
                                    borderWidth: 2
                                }
                            }}
                        >
                            {/* Disable certain categories when user is on probation */}
                            <MenuItem value="Casual" disabled={user?.employmentStatus === 'Probation'}>Casual Leave</MenuItem>
                            {(() => {
                                try {
                                    // Ensure we have valid inputs
                                    const history = Array.isArray(plannedLeaveHistory) ? plannedLeaveHistory : [];
                                    
                                    const plannedLeaveStatus = isPlannedLeaveDisabled(
                                        user,
                                        history,
                                        formData.startDate,
                                        formData.endDate,
                                        formData.leaveType || 'Full Day'
                                    );
                                    
                                    // Ensure we got a valid result
                                    if (!plannedLeaveStatus || typeof plannedLeaveStatus.disabled !== 'boolean') {
                                        // Fallback: allow for permanent employees
                                        const isPermanent = user?.employmentStatus === 'Permanent';
                                        const isProbation = user?.employmentStatus === 'Probation';
                                        return (
                                            <MenuItem 
                                                value="Planned" 
                                                disabled={!isPermanent || isProbation}
                                            >
                                                Planned Leave (Earned)
                                            </MenuItem>
                                        );
                                    }
                                    
                                    // If disabled, wrap in Tooltip with span for proper disabled state handling
                                    if (plannedLeaveStatus.disabled) {
                                        return (
                                            <Tooltip 
                                                title={plannedLeaveStatus.tooltip || 'Planned Leave is currently unavailable'} 
                                                arrow 
                                                placement="right"
                                            >
                                                <span>
                                                    <MenuItem 
                                                        value="Planned" 
                                                        disabled={true}
                                                        sx={{
                                                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                            color: 'rgba(0, 0, 0, 0.38)',
                                                            cursor: 'not-allowed'
                                                        }}
                                                    >
                                                        Planned Leave (Earned)
                                                    </MenuItem>
                                                </span>
                                            </Tooltip>
                                        );
                                    }
                                    
                                    // If not disabled, render normally without wrapper (no Tooltip needed)
                                    return (
                                        <MenuItem value="Planned">
                                            Planned Leave (Earned)
                                        </MenuItem>
                                    );
                                } catch (error) {
                                    console.error('Error checking Planned Leave eligibility:', error);
                                    // On error, default to allowing selection for permanent employees
                                    // This ensures the option is always available if check fails
                                    const isPermanent = user?.employmentStatus === 'Permanent';
                                    const isProbation = user?.employmentStatus === 'Probation';
                                    const shouldDisable = !isPermanent || isProbation;
                                    return (
                                        <MenuItem 
                                            value="Planned" 
                                            disabled={shouldDisable}
                                        >
                                            Planned Leave (Earned)
                                        </MenuItem>
                                    );
                                }
                            })()}
                            <MenuItem value="Sick" disabled={user?.employmentStatus === 'Probation'}>Sick Leave</MenuItem>
                            <MenuItem value="Unpaid">LOP Loss of Pay</MenuItem>
                            <MenuItem value="Compensatory">Compensatory Leave</MenuItem>
                            <Divider />
                            <MenuItem value="Backdated Leave">Backdate Leave</MenuItem>
                        </Select>
                    </FormControl>

                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker
                            label="Start Date"
                            value={formData.startDate}
                            onChange={handleStartDateChange}
                            slotProps={{ 
                                textField: { 
                                    size: 'medium',
                                    fullWidth: true,
                                    sx: {
                                        bgcolor: 'white',
                                        borderRadius: 2,
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: PRIMARY_BORDER
                                            },
                                            '&:hover fieldset': {
                                                borderColor: PRIMARY_COLOR
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: PRIMARY_COLOR,
                                                borderWidth: 2
                                            }
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: PRIMARY_COLOR,
                                            fontWeight: 600,
                                            '&.Mui-focused': {
                                                color: PRIMARY_COLOR
                                            }
                                        }
                                    }
                                } 
                            }}
                        />
                    </LocalizationProvider>
                    
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker
                            label="End Date (optional)"
                            value={formData.endDate}
                            onChange={handleEndDateChange}
                            minDate={formData.startDate}
                            disabled={!formData.startDate}
                            slotProps={{ 
                                textField: { 
                                    size: 'medium',
                                    fullWidth: true,
                                    sx: {
                                        bgcolor: 'white',
                                        borderRadius: 2,
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: PRIMARY_BORDER
                                            },
                                            '&:hover fieldset': {
                                                borderColor: PRIMARY_COLOR
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: PRIMARY_COLOR,
                                                borderWidth: 2
                                            }
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: PRIMARY_COLOR,
                                            fontWeight: 600,
                                            '&.Mui-focused': {
                                                color: PRIMARY_COLOR
                                            }
                                        }
                                    }
                                } 
                            }}
                        />
                    </LocalizationProvider>
                    
                    {formData.requestType !== 'Compensatory' && (
                        <FormControl fullWidth size="medium">
                            <InputLabel 
                                sx={{ 
                                color: PRIMARY_COLOR,
                                    fontWeight: 600,
                                    '&.Mui-focused': {
                                    color: PRIMARY_COLOR
                                    }
                                }}
                            >
                                Day Type
                            </InputLabel>
                            <Select
                                name="leaveType"
                                value={formData.leaveType}
                                label="Day Type"
                                onChange={handleChange}
                                sx={{
                                    bgcolor: 'white',
                                    borderRadius: 2,
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: PRIMARY_BORDER
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: PRIMARY_COLOR
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: PRIMARY_COLOR,
                                        borderWidth: 2
                                    }
                                }}
                            >
                                <MenuItem value="Full Day">Full Day</MenuItem>
                                <MenuItem value="Half Day - First Half">Half Day - First Half</MenuItem>
                                <MenuItem value="Half Day - Second Half">Half Day - Second Half</MenuItem>
                            </Select>
                        </FormControl>
                    )}


                    {formData.requestType === 'Compensatory' && (
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="Alternate Working Date"
                                value={formData.alternateDate}
                                onChange={handleAlternateDateChange}
                                slotProps={{ 
                                    textField: { 
                                        size: 'medium',
                                        fullWidth: true,
                                        sx: {
                                            bgcolor: 'white',
                                            borderRadius: 2,
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                borderColor: PRIMARY_BORDER
                                                },
                                                '&:hover fieldset': {
                                                borderColor: PRIMARY_COLOR
                                                },
                                                '&.Mui-focused fieldset': {
                                                borderColor: PRIMARY_COLOR,
                                                    borderWidth: 2
                                                }
                                            },
                                            '& .MuiInputLabel-root': {
                                            color: PRIMARY_COLOR,
                                                fontWeight: 600,
                                                '&.Mui-focused': {
                                                color: PRIMARY_COLOR
                                                }
                                            }
                                        }
                                    } 
                                }}
                            />
                        </LocalizationProvider>
                    )}

                    {formData.requestType === 'Sick' && (
                        <Box>
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    mb: 1.5, 
                                    color: PRIMARY_COLOR, 
                                    fontWeight: 600,
                                    fontSize: '0.875rem'
                                }}
                            >
                                Medical Certificate <span style={{ color: PRIMARY_COLOR }}>*</span>
                            </Typography>
                            <Box
                                sx={{
                                    border: formData.medicalCertificateUrl 
                                        ? '2px dashed #2e7d32' 
                                        : `2px dashed ${PRIMARY_BORDER}`,
                                    borderRadius: 2,
                                    p: 2,
                                    bgcolor: formData.medicalCertificateUrl ? '#f1f8f4' : 'white',
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        borderColor: formData.medicalCertificateUrl ? '#2e7d32' : PRIMARY_COLOR,
                                        bgcolor: formData.medicalCertificateUrl ? '#f1f8f4' : 'rgba(44, 62, 80, 0.02)'
                                    }
                                }}
                            >
                                {uploadingCertificate ? (
                                    <Box>
                                        <LinearProgress sx={{ mb: 1 }} />
                                        <Typography variant="body2" color="text.secondary">
                                            Uploading medical certificate...
                                        </Typography>
                                    </Box>
                                ) : formData.medicalCertificateUrl ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <CheckCircleIcon sx={{ color: '#2e7d32', fontSize: 24 }} />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                                                Medical certificate uploaded
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formData.medicalCertificate?.name || 'File uploaded successfully'}
                                            </Typography>
                                        </Box>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    medicalCertificate: null,
                                                    medicalCertificateUrl: null
                                                }));
                                            }}
                                            sx={{
                                                borderColor: PRIMARY_COLOR,
                                                color: PRIMARY_COLOR,
                                                '&:hover': {
                                                    borderColor: PRIMARY_DARK,
                                                    bgcolor: 'rgba(44, 62, 80, 0.05)'
                                                }
                                            }}
                                        >
                                            Remove
                                        </Button>
                                    </Box>
                                ) : (
                                    <Box>
                                        <input
                                            accept=".pdf,.jpg,.jpeg,.png,.gif"
                                            style={{ display: 'none' }}
                                            id="medical-certificate-upload"
                                            type="file"
                                            onChange={handleMedicalCertificateChange}
                                        />
                                        <label htmlFor="medical-certificate-upload">
                                            <Button
                                                component="span"
                                                variant="outlined"
                                                startIcon={<UploadFileIcon />}
                                                fullWidth
                                                sx={{
                                                    borderColor: PRIMARY_BORDER,
                                                    color: PRIMARY_COLOR,
                                                    fontWeight: 600,
                                                    py: 1.5,
                                                    '&:hover': {
                                                        borderColor: PRIMARY_COLOR,
                                                        bgcolor: 'rgba(44, 62, 80, 0.05)'
                                                    }
                                                }}
                                            >
                                                Upload Medical Certificate
                                            </Button>
                                        </label>
                                        <Typography 
                                            variant="caption" 
                                            sx={{ 
                                                display: 'block', 
                                                mt: 1, 
                                                color: 'text.secondary',
                                                textAlign: 'center'
                                            }}
                                        >
                                            PDF, JPEG, PNG, or GIF (Max 10MB)
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                            {!formData.medicalCertificateUrl && (
                                <Typography 
                                    variant="caption" 
                                    sx={{ 
                                        mt: 0.5, 
                                                color: PRIMARY_COLOR,
                                        fontSize: '0.75rem',
                                        display: 'block'
                                    }}
                                >
                                    Medical certificate is mandatory for sick leave applications.
                                </Typography>
                            )}
                        </Box>
                    )}

                    <TextField
                        name="reason"
                        label="Reason (Minimum 100 characters required)"
                        value={formData.reason}
                        onChange={handleChange}
                        multiline
                        rows={4}
                        fullWidth
                        size="medium"
                        error={formData.reason.trim().length > 0 && formData.reason.trim().length < 100}
                        helperText={
                            formData.reason.trim().length > 0 && formData.reason.trim().length < 100
                                ? `Please write at least ${100 - formData.reason.trim().length} more characters (${formData.reason.trim().length}/100)`
                                : formData.reason.trim().length >= 100
                                ? `${formData.reason.trim().length} characters ✓`
                                : 'Please provide a detailed reason for your leave request (minimum 100 characters)'
                        }
                        FormHelperTextProps={{
                            sx: {
                                color: formData.reason.trim().length >= 100 
                                    ? '#2e7d32' 
                                    : formData.reason.trim().length > 0 && formData.reason.trim().length < 100
                                        ? PRIMARY_COLOR
                                        : 'rgba(44, 62, 80, 0.7)',
                                fontWeight: formData.reason.trim().length >= 100 ? 600 : 500,
                                fontSize: '0.75rem',
                                mt: 1
                            }
                        }}
                        sx={{
                            bgcolor: 'white',
                            borderRadius: 2,
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: formData.reason.trim().length > 0 && formData.reason.trim().length < 100
                                        ? PRIMARY_COLOR
                                        : PRIMARY_BORDER
                                },
                                '&:hover fieldset': {
                                        borderColor: PRIMARY_COLOR
                                },
                                '&.Mui-focused fieldset': {
                                        borderColor: PRIMARY_COLOR,
                                    borderWidth: 2
                                },
                                '&.Mui-error fieldset': {
                                        borderColor: PRIMARY_COLOR
                                }
                            },
                            '& .MuiInputLabel-root': {
                                    color: PRIMARY_COLOR,
                                fontWeight: 600,
                                '&.Mui-focused': {
                                        color: PRIMARY_COLOR
                                },
                                '&.Mui-error': {
                                        color: PRIMARY_COLOR
                                }
                            }
                        }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ 
                p: 3, 
                pt: 2,
                bgcolor: '#fafafa',
                borderTop: '1px solid rgba(44, 62, 80, 0.1)',
                gap: 2
            }}>
                <Button 
                    onClick={onClose} 
                    disabled={loading}
                    variant="outlined"
                    sx={{
                        borderColor: PRIMARY_BORDER,
                        color: PRIMARY_COLOR,
                        fontWeight: 600,
                        px: 3,
                        borderRadius: 2,
                        '&:hover': {
                            borderColor: PRIMARY_COLOR,
                            bgcolor: 'rgba(44, 62, 80, 0.05)'
                        },
                        '&:disabled': {
                            borderColor: 'rgba(44, 62, 80, 0.2)',
                            color: 'rgba(44, 62, 80, 0.4)'
                        }
                    }}
                >
                    Cancel
                </Button>
                <Button 
                    variant="contained" 
                    onClick={handleSubmit} 
                    disabled={
                        loading || 
                        !formData.reason || 
                        formData.reason.trim().length < 100 || 
                        !formData.startDate ||
                        (formData.requestType === 'Sick' && !formData.medicalCertificateUrl) ||
                        uploadingCertificate
                    }
                    sx={{ 
                        bgcolor: PRIMARY_COLOR,
                        color: 'white',
                        fontWeight: 700,
                        px: 3,
                        borderRadius: 2,
                        boxShadow: `0 4px 12px ${PRIMARY_SHADOW}`,
                        '&:hover': { 
                            bgcolor: PRIMARY_LIGHT,
                            boxShadow: '0 6px 16px rgba(44, 62, 80, 0.4)'
                        },
                        '&:disabled': {
                            bgcolor: 'rgba(44, 62, 80, 0.5)',
                            boxShadow: 'none',
                            color: 'rgba(255, 255, 255, 0.6)'
                        }
                    }}
                >
                    {loading ? 'Submitting...' : 'Submit Request'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default LeaveRequestForm;