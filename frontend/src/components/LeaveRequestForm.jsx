// src/components/LeaveRequestForm.jsx
import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
    Stack, Typography, Alert, FormControl, InputLabel, Select, MenuItem, Divider,
    Box, IconButton, Avatar, LinearProgress, Tooltip, ListItemIcon, ListItemText
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import HistoryIcon from '@mui/icons-material/History';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { isPlannedLeaveDisabled } from '../utils/leaveRules';

const PRIMARY_COLOR = '#e74c3c';
const PRIMARY_LIGHT = '#ec7063';
const PRIMARY_DARK = '#c0392b';
const PRIMARY_BORDER = 'rgba(231, 76, 60, 0.3)';
const PRIMARY_SHADOW = 'rgba(231, 76, 60, 0.3)';

const DRAFT_STORAGE_KEY = 'leaveRequestDraft';

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
    medicalCertificateFileName: null, // Store filename for draft restoration
};

/**
 * Save form draft to sessionStorage (without File objects)
 */
const saveDraftToStorage = (formData) => {
    try {
        const draftData = {
            requestType: formData.requestType,
            leaveType: formData.leaveType,
            startDate: formData.startDate ? formData.startDate.toISOString() : null,
            endDate: formData.endDate ? formData.endDate.toISOString() : null,
            alternateDate: formData.alternateDate ? formData.alternateDate.toISOString() : null,
            reason: formData.reason,
            medicalCertificateUrl: formData.medicalCertificateUrl,
            medicalCertificateFileName: formData.medicalCertificateFileName,
        };
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    } catch (error) {
        console.warn('Failed to save draft to sessionStorage:', error);
    }
};

/**
 * Load form draft from sessionStorage
 */
const loadDraftFromStorage = () => {
    try {
        const draftJson = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (!draftJson) return null;
        
        const draftData = JSON.parse(draftJson);
        return {
            requestType: draftData.requestType || initialState.requestType,
            leaveType: draftData.leaveType || initialState.leaveType,
            startDate: draftData.startDate ? new Date(draftData.startDate) : null,
            endDate: draftData.endDate ? new Date(draftData.endDate) : null,
            alternateDate: draftData.alternateDate ? new Date(draftData.alternateDate) : null,
            reason: draftData.reason || '',
            medicalCertificate: null, // Cannot restore File object
            medicalCertificateUrl: draftData.medicalCertificateUrl || null,
            medicalCertificateFileName: draftData.medicalCertificateFileName || null,
        };
    } catch (error) {
        console.warn('Failed to load draft from sessionStorage:', error);
        return null;
    }
};

/**
 * Clear form draft from sessionStorage
 */
const clearDraftFromStorage = () => {
    try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to clear draft from sessionStorage:', error);
    }
};

const LeaveRequestForm = ({ open, onClose, onSubmissionSuccess }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState(initialState);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadingCertificate, setUploadingCertificate] = useState(false);
    const [plannedLeaveHistory, setPlannedLeaveHistory] = useState([]);
    const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
    
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
    
    // Restore draft when modal opens
    useEffect(() => {
        if (open && !hasRestoredDraft) {
            const savedDraft = loadDraftFromStorage();
            if (savedDraft) {
                // If user is on probation, default to an allowed type
                const isProbation = user?.employmentStatus === 'Probation';
                const defaultRequestType = isProbation ? 'Loss of Pay' : initialState.requestType;
                
                setFormData({
                    ...savedDraft,
                    requestType: savedDraft.requestType || defaultRequestType,
                });
                setHasRestoredDraft(true);
            } else {
                // No draft found - use defaults
                const isProbation = user?.employmentStatus === 'Probation';
                const defaultRequestType = isProbation ? 'Loss of Pay' : initialState.requestType;
                setFormData({ ...initialState, requestType: defaultRequestType });
                setHasRestoredDraft(true);
            }
            setError('');
            setUploadingCertificate(false);
        } else if (!open) {
            // Reset flag when modal closes
            setHasRestoredDraft(false);
        }
    }, [open, user, hasRestoredDraft]);
    
    // Persist form data to sessionStorage whenever it changes (debounced)
    useEffect(() => {
        if (open && hasRestoredDraft) {
            // Save draft after a short delay to avoid excessive writes
            const timeoutId = setTimeout(() => {
                saveDraftToStorage(formData);
            }, 300);
            
            return () => clearTimeout(timeoutId);
        }
    }, [formData, open, hasRestoredDraft]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            // If switching to Compensatory Leave, clear end date as it's not needed
            if (name === 'requestType' && value === 'Compensatory') {
                return { ...prev, [name]: value, endDate: null };
            }
            // If switching away from Compensatory Leave and end date was cleared, keep it cleared
            return { ...prev, [name]: value };
        });
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

    // Handle modal close - clear draft if user explicitly closes
    const handleClose = () => {
        // Clear draft when user closes modal
        clearDraftFromStorage();
        onClose();
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
                medicalCertificateUrl: data.fileUrl,
                medicalCertificateFileName: file.name // Store filename for draft
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
        
        // CRITICAL: Frontend MUST NOT calculate dates
        // Send raw dates to backend - backend will handle all date logic in IST
        // Format dates as YYYY-MM-DD strings (backend will parse as IST)
        const formatDateToString = (date) => {
            if (!date) return null;
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        const leaveDates = [];
        const startStr = formatDateToString(formData.startDate);
        const endStr = formData.endDate ? formatDateToString(formData.endDate) : startStr;
        
        if (!startStr) {
            setError('Invalid start date provided.');
            setLoading(false);
            return;
        }
        
        // Generate date range as YYYY-MM-DD strings
        // Backend will parse these as IST and validate
        const startDate = new Date(formData.startDate);
        const endDate = formData.endDate ? new Date(formData.endDate) : new Date(startDate);
        
        let current = new Date(startDate);
        current.setHours(0, 0, 0, 0);
        const final = new Date(endDate);
        final.setHours(0, 0, 0, 0);
        
        while (current <= final) {
            const dateStr = formatDateToString(current);
            if (dateStr) {
                leaveDates.push(dateStr); // Send as YYYY-MM-DD string
            }
            current.setDate(current.getDate() + 1);
        }

        const payload = {
            requestType: formData.requestType,
            leaveType: formData.leaveType,
            alternateDate: formData.alternateDate ? formatDateToString(formData.alternateDate) : null,
            reason: formData.reason,
            leaveDates: leaveDates, // Send as array of YYYY-MM-DD strings
            ...(formData.requestType === 'Sick' && formData.medicalCertificateUrl && {
                medicalCertificate: formData.medicalCertificateUrl
            }),
        };

        try {
            const { data } = await api.post('/leaves/request', payload);
            // Clear draft on successful submission
            clearDraftFromStorage();
            onSubmissionSuccess(data.request);
        } catch (err) {
            // Display validation errors properly
            const errorData = err.response?.data;
            if (errorData) {
                if (errorData.errors && Array.isArray(errorData.errors)) {
                    // Show all errors as a bulleted list
                    const errorMessages = errorData.errors.map((e, idx) => `${idx + 1}. ${e}`).join('\n');
                    setError(errorMessages);
                } else if (errorData.error) {
                    setError(errorData.error);
                } else {
                    setError('Failed to submit request. Please check your input and try again.');
                }
            } else {
                setError('Failed to submit request. Please try again.');
            }
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
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    minWidth: '600px',
                    maxWidth: '700px',
                    width: '100%',
                    background: '#ffffff',
                    boxShadow: '0 12px 48px rgba(231, 76, 60, 0.15)',
                    overflow: 'hidden',
                    maxHeight: '90vh'
                }
            }}
        >
            {/* Header with red gradient */}
            <DialogTitle sx={{ 
                fontWeight: 700, 
                pb: 2.5,
                pt: 3.5,
                px: 4,
                background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%)`,
                color: 'white',
                boxShadow: `0 4px 16px ${PRIMARY_SHADOW}`,
                position: 'relative',
                borderBottom: '3px solid rgba(255, 255, 255, 0.2)'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                        <Avatar sx={{ 
                            bgcolor: 'rgba(255,255,255,0.25)', 
                            width: 52, 
                            height: 52,
                            border: '2px solid rgba(255,255,255,0.35)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}>
                            <CalendarTodayIcon sx={{ fontSize: 28 }} />
                        </Avatar>
                        <Box>
                            <Typography variant="h5" component="div" sx={{ fontWeight: 700, mb: 0.5, fontSize: '1.5rem' }}>
                                {modalTitle}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.95, fontWeight: 400, fontSize: '0.9rem' }}>
                                {descriptionText}
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton 
                        onClick={handleClose} 
                        sx={{ 
                            color: 'white',
                            bgcolor: 'rgba(255,255,255,0.15)',
                            width: 40,
                            height: 40,
                            '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.25)',
                                transform: 'rotate(90deg)'
                            },
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            
            <DialogContent sx={{ 
                p: 4, 
                bgcolor: '#ffffff',
                overflowY: 'auto',
                maxHeight: 'calc(90vh - 200px)'
            }}>
                <Stack spacing={3.5} sx={{ mt: 1 }}>
                    {/* Draft restoration banner */}
                    {hasRestoredDraft && (() => {
                        const savedDraft = loadDraftFromStorage();
                        // Show banner if draft exists and has some data (not just defaults)
                        const hasDraftData = savedDraft && (savedDraft.reason || savedDraft.startDate || savedDraft.endDate);
                        return hasDraftData && (
                            <Alert 
                                severity="info"
                                sx={{
                                    bgcolor: '#e3f2fd',
                                    border: '1px solid #2196f3',
                                    borderRadius: 2,
                                    fontSize: '0.875rem',
                                    '& .MuiAlert-icon': {
                                        color: '#1976d2'
                                    }
                                }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: 500, mb: formData.medicalCertificateFileName && !formData.medicalCertificateUrl ? 0.5 : 0 }}>
                                    🕒 Your draft has been restored automatically.
                                </Typography>
                                {formData.medicalCertificateFileName && !formData.medicalCertificateUrl && (
                                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#1565c0', fontWeight: 500 }}>
                                        ⚠️ Please reattach your medical certificate file ({formData.medicalCertificateFileName}).
                                    </Typography>
                                )}
                            </Alert>
                        );
                    })()}
                    
                    {error && (
                        <Alert 
                            severity="error"
                            sx={{
                                bgcolor: '#ffebee',
                                border: `2px solid ${PRIMARY_COLOR}`,
                                color: PRIMARY_DARK,
                                borderRadius: 2,
                                fontWeight: 500,
                                '& .MuiAlert-icon': {
                                    color: PRIMARY_COLOR,
                                    fontSize: '1.5rem'
                                }
                            }}
                        >
                            {error}
                        </Alert>
                    )}

                    <Box>
                        <FormControl fullWidth size="medium">
                            <InputLabel 
                                sx={{ 
                                    color: PRIMARY_COLOR,
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                    '&.Mui-focused': {
                                        color: PRIMARY_COLOR
                                    }
                                }}
                            >
                                Select Leave Type
                            </InputLabel>
                            <Select
                                name="requestType"
                                value={formData.requestType}
                                label="Select Leave Type"
                                onChange={handleChange}
                                MenuProps={{
                                    PaperProps: {
                                        sx: {
                                            borderRadius: 2,
                                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                                            mt: 1,
                                            maxHeight: '400px'
                                        }
                                    }
                                }}
                                sx={{
                                    bgcolor: 'white',
                                    borderRadius: 2.5,
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: PRIMARY_BORDER,
                                        borderWidth: '1.5px'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: PRIMARY_COLOR,
                                        borderWidth: '2px'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: PRIMARY_COLOR,
                                        borderWidth: '2px'
                                    }
                                }}
                            >
                                {/* Regular Leaves Section */}
                                <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                                    <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Regular Leaves
                                    </Typography>
                                </Box>
                                
                                <MenuItem 
                                    value="Casual" 
                                    disabled={user?.employmentStatus === 'Probation'}
                                    sx={{ 
                                        py: 1.5,
                                        '&:hover': { bgcolor: '#f5f5f5' },
                                        '&.Mui-selected': { bgcolor: '#e3f2fd' },
                                        '&.Mui-disabled': { opacity: 0.6 }
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <WorkOutlineIcon sx={{ color: PRIMARY_COLOR, fontSize: 24 }} />
                                    </ListItemIcon>
                                    <ListItemText 
                                        primary="Casual Leave"
                                        secondary="For personal work, appointments, or casual activities"
                                        primaryTypographyProps={{ 
                                            fontWeight: 600, 
                                            fontSize: '0.95rem',
                                            color: user?.employmentStatus === 'Probation' ? 'rgba(0,0,0,0.38)' : 'inherit'
                                        }}
                                        secondaryTypographyProps={{ 
                                            fontSize: '0.75rem', 
                                            color: 'text.secondary',
                                            sx: { mt: 0.5 }
                                        }}
                                    />
                                </MenuItem>
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
                                            sx={{ 
                                                py: 1.5,
                                                '&:hover': { bgcolor: '#f5f5f5' },
                                                '&.Mui-selected': { bgcolor: '#e3f2fd' },
                                                '&.Mui-disabled': { opacity: 0.6 }
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 40 }}>
                                                <BeachAccessIcon sx={{ color: PRIMARY_COLOR, fontSize: 24 }} />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary="Planned Leave (Earned)"
                                                secondary={isProbation ? "Available for permanent employees only" : "Earned leave for vacation, family time, or planned activities"}
                                                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem' }}
                                                secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary', sx: { mt: 0.5 } }}
                                            />
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
                                                            py: 1.5,
                                                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                            cursor: 'not-allowed',
                                                            opacity: 0.6
                                                        }}
                                                    >
                                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                                            <BeachAccessIcon sx={{ color: 'rgba(0, 0, 0, 0.38)', fontSize: 24 }} />
                                                        </ListItemIcon>
                                                        <ListItemText 
                                                            primary="Planned Leave (Earned)"
                                                            secondary={plannedLeaveStatus.tooltip || 'Currently unavailable'}
                                                            primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem' }}
                                                            secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary', sx: { mt: 0.5 } }}
                                                        />
                                                    </MenuItem>
                                                </span>
                                            </Tooltip>
                                        );
                                    }
                                    
                                    // If not disabled, render normally without wrapper (no Tooltip needed)
                                    return (
                                        <MenuItem 
                                            value="Planned"
                                            sx={{ 
                                                py: 1.5,
                                                '&:hover': { bgcolor: '#f5f5f5' },
                                                '&.Mui-selected': { bgcolor: '#e3f2fd' }
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 40 }}>
                                                <BeachAccessIcon sx={{ color: PRIMARY_COLOR, fontSize: 24 }} />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary="Planned Leave (Earned)"
                                                secondary="Earned leave for vacation, family time, or planned activities"
                                                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem' }}
                                                secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary', sx: { mt: 0.5 } }}
                                            />
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
                                            sx={{ 
                                                py: 1.5,
                                                '&:hover': { bgcolor: '#f5f5f5' },
                                                '&.Mui-selected': { bgcolor: '#e3f2fd' },
                                                '&.Mui-disabled': { opacity: 0.6 }
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 40 }}>
                                                <BeachAccessIcon sx={{ color: PRIMARY_COLOR, fontSize: 24 }} />
                                            </ListItemIcon>
                                            <ListItemText 
                                                primary="Planned Leave (Earned)"
                                                secondary={shouldDisable ? "Available for permanent employees only" : "Earned leave for vacation, family time, or planned activities"}
                                                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem' }}
                                                secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary', sx: { mt: 0.5 } }}
                                            />
                                        </MenuItem>
                                    );
                                }
                            })()}
                                <MenuItem 
                                    value="Sick" 
                                    disabled={user?.employmentStatus === 'Probation'}
                                    sx={{ 
                                        py: 1.5,
                                        '&:hover': { bgcolor: '#f5f5f5' },
                                        '&.Mui-selected': { bgcolor: '#e3f2fd' },
                                        '&.Mui-disabled': { opacity: 0.6 }
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <LocalHospitalIcon sx={{ color: PRIMARY_COLOR, fontSize: 24 }} />
                                    </ListItemIcon>
                                    <ListItemText 
                                        primary="Sick Leave"
                                        secondary="For illness or medical emergencies (Medical certificate required)"
                                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem' }}
                                        secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary', sx: { mt: 0.5 } }}
                                    />
                                </MenuItem>
                                
                                <Divider sx={{ my: 0.5 }} />
                                
                                {/* Other Leave Types Section */}
                                <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderTop: '1px solid #e0e0e0', borderBottom: '1px solid #e0e0e0' }}>
                                    <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Other Leave Types
                                    </Typography>
                                </Box>
                                
                                <MenuItem 
                                    value="Loss of Pay"
                                    sx={{ 
                                        py: 1.5,
                                        '&:hover': { bgcolor: '#f5f5f5' },
                                        '&.Mui-selected': { bgcolor: '#e3f2fd' }
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <AttachMoneyIcon sx={{ color: PRIMARY_COLOR, fontSize: 24 }} />
                                    </ListItemIcon>
                                    <ListItemText 
                                        primary="Loss of Pay (LOP)"
                                        secondary="Unpaid leave when no leave balance is available"
                                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem' }}
                                        secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary', sx: { mt: 0.5 } }}
                                    />
                                </MenuItem>
                                
                                <MenuItem 
                                    value="Compensatory"
                                    sx={{ 
                                        py: 1.5,
                                        '&:hover': { bgcolor: '#f5f5f5' },
                                        '&.Mui-selected': { bgcolor: '#e3f2fd' }
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <SwapHorizIcon sx={{ color: PRIMARY_COLOR, fontSize: 24 }} />
                                    </ListItemIcon>
                                    <ListItemText 
                                        primary="Compensatory Leave"
                                        secondary="Leave in exchange for working on a holiday/weekend"
                                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem' }}
                                        secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary', sx: { mt: 0.5 } }}
                                    />
                                </MenuItem>
                                
                                <Divider sx={{ my: 0.5 }} />
                                
                                {/* Special Requests Section */}
                                <Box sx={{ px: 2, py: 1, bgcolor: '#fff3e0', borderTop: '1px solid #ffe0b2', borderBottom: '1px solid #ffe0b2' }}>
                                    <Typography variant="caption" sx={{ color: '#e65100', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Special Request
                                    </Typography>
                                </Box>
                                
                                <MenuItem 
                                    value="Backdated Leave"
                                    sx={{ 
                                        py: 1.5,
                                        '&:hover': { bgcolor: '#f5f5f5' },
                                        '&.Mui-selected': { bgcolor: '#e3f2fd' }
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <HistoryIcon sx={{ color: PRIMARY_COLOR, fontSize: 24 }} />
                                    </ListItemIcon>
                                    <ListItemText 
                                        primary="Backdated Leave"
                                        secondary="Apply for leave for a past date (Requires approval)"
                                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.95rem' }}
                                        secondaryTypographyProps={{ fontSize: '0.75rem', color: 'text.secondary', sx: { mt: 0.5 } }}
                                    />
                                </MenuItem>
                            </Select>
                        </FormControl>
                        
                        {/* Helper text below the selector */}
                        {formData.requestType && (
                            <Box sx={{ mt: 1.5, p: 2, bgcolor: '#e3f2fd', borderRadius: 2, border: `1px solid ${PRIMARY_COLOR}20` }}>
                                <Typography variant="body2" sx={{ color: PRIMARY_DARK, fontSize: '0.85rem', fontWeight: 500 }}>
                                    <strong>{formData.requestType === 'Casual' && '💡'}</strong>
                                    <strong>{formData.requestType === 'Planned' && '🏖️'}</strong>
                                    <strong>{formData.requestType === 'Sick' && '🏥'}</strong>
                                    <strong>{formData.requestType === 'Loss of Pay' && '💰'}</strong>
                                    <strong>{formData.requestType === 'Compensatory' && '🔄'}</strong>
                                    <strong>{formData.requestType === 'Backdated Leave' && '📅'}</strong>
                                    {' '}
                                    {formData.requestType === 'Casual' && 'Casual leave can be used for personal work or appointments.'}
                                    {formData.requestType === 'Planned' && 'Planned leave is earned leave that can be used for vacations or planned activities.'}
                                    {formData.requestType === 'Sick' && 'Sick leave requires a medical certificate. Please upload one before submitting.'}
                                    {formData.requestType === 'Loss of Pay' && 'Loss of Pay leave will result in salary deduction for the days taken.'}
                                    {formData.requestType === 'Compensatory' && 'You need to specify an alternate working date when applying for compensatory leave.'}
                                    {formData.requestType === 'Backdated Leave' && 'This is a special request for a past date and requires manager approval.'}
                                </Typography>
                            </Box>
                        )}
                    </Box>

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
                                        borderRadius: 2.5,
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: PRIMARY_BORDER,
                                                borderWidth: '1.5px'
                                            },
                                            '&:hover fieldset': {
                                                borderColor: PRIMARY_COLOR,
                                                borderWidth: '2px'
                                            },
                                            '&.Mui-focused fieldset': {
                                                borderColor: PRIMARY_COLOR,
                                                borderWidth: '2px'
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
                    
                    {/* Hide End Date when Compensatory Leave is selected */}
                    {formData.requestType !== 'Compensatory' && (
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
                                            borderRadius: 2.5,
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: PRIMARY_BORDER,
                                                    borderWidth: '1.5px'
                                                },
                                                '&:hover fieldset': {
                                                    borderColor: PRIMARY_COLOR,
                                                    borderWidth: '2px'
                                                },
                                                '&.Mui-focused fieldset': {
                                                    borderColor: PRIMARY_COLOR,
                                                    borderWidth: '2px'
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
                                        bgcolor: formData.medicalCertificateUrl ? '#f1f8f4' : '#ffebee'
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
                                                {formData.medicalCertificate?.name || formData.medicalCertificateFileName || 'File uploaded successfully'}
                                            </Typography>
                                        </Box>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    medicalCertificate: null,
                                                    medicalCertificateUrl: null,
                                                    medicalCertificateFileName: null
                                                }));
                                            }}
                                            sx={{
                                                borderColor: PRIMARY_COLOR,
                                                color: PRIMARY_COLOR,
                                                borderWidth: '2px',
                                                '&:hover': {
                                                    borderColor: PRIMARY_DARK,
                                                    bgcolor: '#ffebee'
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
                                                    borderWidth: '2px',
                                                    color: PRIMARY_COLOR,
                                                    fontWeight: 600,
                                                    py: 1.5,
                                                    '&:hover': {
                                                        borderColor: PRIMARY_COLOR,
                                                        bgcolor: '#ffebee',
                                                        borderWidth: '2px'
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
                                        : 'rgba(231, 76, 60, 0.7)',
                                fontWeight: formData.reason.trim().length >= 100 ? 600 : 500,
                                fontSize: '0.75rem',
                                mt: 1
                            }
                        }}
                        sx={{
                            bgcolor: 'white',
                            borderRadius: 2.5,
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: formData.reason.trim().length > 0 && formData.reason.trim().length < 100
                                        ? PRIMARY_COLOR
                                        : PRIMARY_BORDER,
                                    borderWidth: formData.reason.trim().length > 0 && formData.reason.trim().length < 100
                                        ? '2px'
                                        : '1.5px'
                                },
                                '&:hover fieldset': {
                                        borderColor: PRIMARY_COLOR,
                                        borderWidth: '2px'
                                },
                                '&.Mui-focused fieldset': {
                                        borderColor: PRIMARY_COLOR,
                                    borderWidth: 2
                                },
                                '&.Mui-error fieldset': {
                                        borderColor: PRIMARY_COLOR,
                                        borderWidth: '2px'
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
                p: 4, 
                pt: 3,
                bgcolor: '#ffffff',
                borderTop: '2px solid #f5f5f5',
                gap: 2,
                justifyContent: 'flex-end'
            }}>
                <Button 
                    onClick={handleClose} 
                    disabled={loading}
                    variant="outlined"
                    sx={{
                        borderColor: PRIMARY_BORDER,
                        borderWidth: '2px',
                        color: PRIMARY_COLOR,
                        fontWeight: 600,
                        px: 4,
                        py: 1.25,
                        borderRadius: 2.5,
                        textTransform: 'none',
                        fontSize: '0.95rem',
                        '&:hover': {
                            borderColor: PRIMARY_COLOR,
                            bgcolor: '#ffebee',
                            borderWidth: '2px'
                        },
                        '&:disabled': {
                            borderColor: 'rgba(231, 76, 60, 0.2)',
                            color: 'rgba(231, 76, 60, 0.4)'
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
                        px: 4,
                        py: 1.25,
                        borderRadius: 2.5,
                        textTransform: 'none',
                        fontSize: '0.95rem',
                        boxShadow: `0 4px 16px ${PRIMARY_SHADOW}`,
                        '&:hover': { 
                            bgcolor: PRIMARY_DARK,
                            boxShadow: `0 6px 20px rgba(231, 76, 60, 0.4)`,
                            transform: 'translateY(-1px)'
                        },
                        '&:disabled': {
                            bgcolor: 'rgba(231, 76, 60, 0.5)',
                            boxShadow: 'none',
                            color: 'rgba(255, 255, 255, 0.6)'
                        },
                        transition: 'all 0.3s ease'
                    }}
                >
                    {loading ? 'Submitting...' : 'Submit Request'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default LeaveRequestForm;