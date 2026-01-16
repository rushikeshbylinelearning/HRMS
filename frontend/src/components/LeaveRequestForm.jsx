// src/components/LeaveRequestForm.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
    Stack, Typography, Alert, Box, IconButton, LinearProgress, InputAdornment
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
import { getAllowedLeaveTypes, normalizeEmploymentType } from '../utils/leaveTypePolicy';

// isPlannedLeaveDisabled removed - Validation is now server-side only

// redesigned modal UI – neutral theme
const PRIMARY_COLOR = '#111827';
const PRIMARY_LIGHT = '#374151';
const PRIMARY_DARK = '#111827';
const PRIMARY_BORDER = 'rgba(17, 24, 39, 0.12)';
const PRIMARY_SHADOW = 'rgba(17, 24, 39, 0.12)';

const initialState = {
    requestType: 'Casual',
    leaveType: 'Full Day',
    startDate: null,
    endDate: null,
    alternateDate: null,
    reason: '',
    medicalCertificate: null,
    medicalCertificateUrl: null,
};

const LEAVE_CATEGORY_META = {
    Casual: { label: 'Casual Leave', icon: '☀️' },
    Planned: { label: 'Planned Leave', icon: '🌴' },
    Sick: { label: 'Sick Leave', icon: '🤒' },
    'Loss of Pay': { label: 'Loss of Pay', icon: '💼' },
    Compensatory: { label: 'Compensatory', icon: '🗓️' },
    'Backdated Leave': { label: 'Backdated Leave', icon: '⏳' },
};

const DAY_TYPE_OPTIONS = [
    { value: 'Full Day', label: 'Full Day', icon: '🌞' },
    { value: 'Half Day - First Half', label: 'Half Day (AM)', icon: '🌅' },
    { value: 'Half Day - Second Half', label: 'Half Day (PM)', icon: '🌇' },
];

const dateFieldStyles = {
    '& .MuiInputLabel-root': {
        color: '#6B7280',
        fontSize: '0.875rem',
        '&.Mui-focused': {
            color: '#111827',
        },
    },
    '& .MuiOutlinedInput-root': {
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#D1D5DB',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#9CA3AF',
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#111827',
            borderWidth: '1px',
        },
    },
};

const LeaveRequestForm = ({ open, onClose, onSubmissionSuccess }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState(initialState);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadingCertificate, setUploadingCertificate] = useState(false);
    const [plannedLeaveHistory, setPlannedLeaveHistory] = useState([]);

    const employeeType = normalizeEmploymentType(user?.employmentStatus);
    const allowedLeaveTypes = useMemo(() => getAllowedLeaveTypes(employeeType), [employeeType]);

    // Remove planned leave history fetching - validation is server-side only
    useEffect(() => {
        if (open) {
            // Reset planned leave history when form opens
            setPlannedLeaveHistory([]);
        }
    }, [open, user]);

    useEffect(() => {
        if (open) {
            // Reset form to initial state - set a safe default requestType based on employee type
            const nextRequestType = allowedLeaveTypes.includes(initialState.requestType)
                ? initialState.requestType
                : (allowedLeaveTypes[0] || 'Loss of Pay');
            setFormData({ ...initialState, requestType: nextRequestType });
            setError('');
            setUploadingCertificate(false);
        }
    }, [open, user, allowedLeaveTypes]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectRequestType = (type) => {
        setFormData(prev => ({ ...prev, requestType: type }));
    };

    const handleSelectDayType = (type) => {
        setFormData(prev => ({ ...prev, leaveType: type }));
    };

    const getDateTextFieldProps = () => ({
        size: 'medium',
        fullWidth: true,
        sx: dateFieldStyles,
        InputProps: {
            endAdornment: (
                <InputAdornment position="end">
                    <CalendarTodayIcon sx={{ color: '#6B7280' }} />
                </InputAdornment>
            ),
        },
    });

    const handleStartDateChange = (date) => {
        setFormData(prev => {
            const newEndDate = prev.endDate && date && date > prev.endDate ? null : prev.endDate;
            return { ...prev, startDate: date, endDate: newEndDate };
        });
        // Remove frontend eligibility checking - handled by backend
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
        if (!allowedLeaveTypes.includes(formData.requestType)) {
            setError('Selected leave type is not available for your employment status.');
            return;
        }
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
        // redesigned modal UI – neutral theme
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderRadius: '16px',
                    width: '580px',
                    maxHeight: '80vh',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden'
                }
            }}
        >
            {/* redesigned header UI – neutral theme */}
            <DialogTitle sx={{
                backgroundColor: '#FFFFFF',
                borderBottom: '1px solid #E5E7EB',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <Box>
                    <Typography variant="h6" sx={{ color: '#111827', fontWeight: 600, fontSize: '1.125rem' }}>
                        Apply for Leave
                    </Typography>
                    <Typography sx={{ color: '#6B7280', fontWeight: 400, fontSize: '0.875rem', mt: '4px' }}>
                        Please fill out the details for your leave request.
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: '#6B7280',
                        '&:hover': {
                            backgroundColor: '#F3F4F6',
                            color: '#111827',
                        },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{
                padding: 0,
                backgroundColor: '#FFFFFF',
                overflow: 'hidden',
            }}>
            <Box sx={{
                px: '22px',
                pt: '20px',
                pb: '12px',
                maxHeight: 'calc(80vh - 180px)',
                overflowY: 'auto',
            }}>
                <Stack spacing={2}>
                        {error && (
                            <Alert
                                severity="warning"
                                sx={{
                                    backgroundColor: '#F9FAFB',
                                    color: '#111827',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '12px',
                                    '& .MuiAlert-icon': {
                                        color: '#6B7280'
                                    }
                                }}
                            >
                                {error}
                            </Alert>
                        )}

                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                                Leave Category
                            </Typography>
                            <Typography variant="body2" color="#6B7280" sx={{ mt: 0.5 }}>
                                Select the leave category that applies to your request.
                            </Typography>
                            <Box sx={{
                                mt: 1.25,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: 8,
                            }}>
                                {allowedLeaveTypes.map((type) => {
                                    const meta = LEAVE_CATEGORY_META[type] || { label: type, icon: '📁' };
                                    const isActive = formData.requestType === type;
                                    return (
                                        <Box
                                            key={type}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleSelectRequestType(type)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    handleSelectRequestType(type);
                                                }
                                            }}
                                        sx={{
                                            borderRadius: '14px',
                                            border: '1px solid',
                                            borderColor: isActive ? '#4F46E5' : '#E5E7EB',
                                            padding: '12px 10px',
                                            backgroundColor: isActive ? 'rgba(79, 70, 229, 0.08)' : '#F7F7FB',
                                            minHeight: '88px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 1,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: isActive ? '0 6px 14px rgba(79, 70, 229, 0.15)' : 'none',
                                            '&:hover': {
                                                borderColor: '#4F46E5',
                                            },
                                        }}
                                        >
                                            <Typography variant="h3" component="span" sx={{ fontSize: '1.3rem', lineHeight: 1 }}>
                                                {meta.icon}
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 600, textAlign: 'center', mt: 0.25 }}>
                                                {meta.label}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {type}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                                Date Range
                            </Typography>
                            <Typography variant="body2" color="#6B7280" sx={{ mt: 0.5 }}>
                                Start date is required. End date is optional but recommended for planning.
                            </Typography>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <Box sx={{
                                    mt: 2,
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: 16,
                                }}>
                                    <DatePicker
                                        label="Start Date"
                                        value={formData.startDate}
                                        onChange={handleStartDateChange}
                                        slotProps={{
                                            textField: getDateTextFieldProps(),
                                        }}
                                    />
                                    <DatePicker
                                        label="End Date (optional)"
                                        value={formData.endDate}
                                        onChange={handleEndDateChange}
                                        minDate={formData.startDate}
                                        disabled={!formData.startDate}
                                        slotProps={{
                                            textField: getDateTextFieldProps(),
                                        }}
                                    />
                                </Box>
                            </LocalizationProvider>
                        </Box>

                        {formData.requestType !== 'Compensatory' && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                                    Day Type
                                </Typography>
                                <Typography variant="body2" color="#6B7280" sx={{ mt: 0.5 }}>
                                    Choose whether you are applying for a full day or half day.
                                </Typography>
                            <Box sx={{
                                mt: 1.25,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: 8,
                            }}>
                                    {DAY_TYPE_OPTIONS.map(option => {
                                        const isSelected = formData.leaveType === option.value;
                                        return (
                                            <Box
                                                key={option.value}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => handleSelectDayType(option.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        handleSelectDayType(option.value);
                                                    }
                                                }}
                                                sx={{
                                                    borderRadius: '12px',
                                                    border: '1px solid',
                                                    borderColor: isSelected ? '#4F46E5' : '#E5E7EB',
                                                    backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.06)' : '#FFFFFF',
                                                    minHeight: '92px',
                                                    padding: '10px 8px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 0.25,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease',
                                                    boxShadow: isSelected ? '0 6px 14px rgba(79, 70, 229, 0.12)' : 'none',
                                                    '&:hover': {
                                                        borderColor: '#4F46E5',
                                                    },
                                                }}
                                            >
                                                <Typography variant="h3" component="span" sx={{ fontSize: '1.2rem', lineHeight: 1 }}>
                                                    {option.icon}
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                                                    {option.label}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {option.value.includes('Half Day') ? 'Half Day' : 'Full Day'}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>
                        )}

                        {formData.requestType === 'Compensatory' && (
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
                                        Alternate Working Date
                                    </Typography>
                                    <Typography variant="body2" color="#6B7280" sx={{ mt: 0.5 }}>
                                        Select the compensatory work date that offsets the leave.
                                    </Typography>
                                    <DatePicker
                                        label="Alternate Working Date"
                                        value={formData.alternateDate}
                                        onChange={handleAlternateDateChange}
                                        slotProps={{
                                            textField: getDateTextFieldProps(),
                                        }}
                                        sx={{ mt: 2 }}
                                    />
                                </Box>
                            </LocalizationProvider>
                        )}

                        {formData.requestType === 'Sick' && (
                            <Box>
                                <Typography variant="body2" sx={{ mb: 1, color: '#374151', fontWeight: 500 }}>
                                    Medical Certificate <span style={{ color: '#6B7280' }}>*</span>
                                </Typography>
                                <Box
                                    sx={{
                                        border: formData.medicalCertificateUrl ? '2px dashed #9CA3AF' : '2px dashed #D1D5DB',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        backgroundColor: formData.medicalCertificateUrl ? '#F9FAFB' : '#FFFFFF',
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            borderColor: formData.medicalCertificateUrl ? '#6B7280' : '#9CA3AF',
                                            backgroundColor: formData.medicalCertificateUrl ? '#F3F4F6' : '#F9FAFB',
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
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <CheckCircleIcon sx={{ color: '#6B7280', fontSize: 24 }} />
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827' }}>
                                                    Certificate Uploaded
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {formData.medicalCertificate?.name || 'File uploaded successfully'}
                                                </Typography>
                                            </Box>
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={() => setFormData(prev => ({ ...prev, medicalCertificate: null, medicalCertificateUrl: null }))}
                                                sx={{
                                                    color: '#6B7280',
                                                    textTransform: 'none',
                                                    '&:hover': {
                                                        backgroundColor: '#F3F4F6',
                                                        color: '#111827',
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
                                                        borderColor: '#D1D5DB',
                                                        color: '#374151',
                                                        fontWeight: 600,
                                                        textTransform: 'none',
                                                        py: 1.5,
                                                        '&:hover': {
                                                            borderColor: '#9CA3AF',
                                                            backgroundColor: '#F9FAFB',
                                                        }
                                                    }}
                                                >
                                                    Upload Certificate
                                                </Button>
                                            </label>
                                            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary', textAlign: 'center' }}>
                                                PDF, JPEG, PNG, or GIF (Max 10MB)
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                                {!formData.medicalCertificateUrl && (
                                    <Typography variant="caption" sx={{ mt: 1, color: '#6B7280', fontSize: '0.75rem', display: 'block' }}>
                                        A medical certificate is mandatory for sick leave applications.
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
                                    color: '#6B7280',
                                    fontWeight: 500,
                                    fontSize: '0.75rem',
                                    mt: 0.5
                                }
                            }}
                            sx={{
                                '& .MuiInputLabel-root': {
                                    color: '#6B7280',
                                    fontSize: '0.875rem',
                                    '&.Mui-focused': {
                                        color: '#111827',
                                    },
                                    '&.Mui-error': {
                                        color: '#6B7280',
                                    },
                                },
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: '12px',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#D1D5DB',
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#9CA3AF',
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#111827',
                                        borderWidth: '1px',
                                    },
                                    '&.Mui-error .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#9CA3AF',
                                    },
                                },
                            }}
                        />
                    </Stack>
                </Box>
            </DialogContent>
            {/* redesigned footer UI – neutral theme */}
            <DialogActions sx={{
                position: 'sticky',
                bottom: 0,
                zIndex: 10,
                padding: '16px 24px',
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid #E5E7EB',
            }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    disabled={loading}
                    sx={{
                        // redesigned secondary button UI – neutral theme
                        borderColor: '#D1D5DB',
                        color: '#374151',
                        fontWeight: 600,
                        borderRadius: '8px',
                        textTransform: 'none',
                        '&:hover': {
                            borderColor: '#9CA3AF',
                            backgroundColor: '#F9FAFB',
                        },
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading}
                    sx={{
                        // redesigned primary button UI – neutral theme
                        backgroundColor: '#111827',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        borderRadius: '8px',
                        textTransform: 'none',
                        boxShadow: 'none',
                        '&:hover': {
                            backgroundColor: '#1F2937',
                        },
                        '&:disabled': {
                            backgroundColor: '#D1D5DB',
                            color: '#9CA3AF',
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