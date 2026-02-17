// src/components/LeaveRequestForm.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
import CategoryIcon from '@mui/icons-material/Category';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import UpdateIcon from '@mui/icons-material/Update';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HistoryIcon from '@mui/icons-material/History';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { getAllowedLeaveTypes, normalizeEmploymentType } from '../utils/leaveTypePolicy';

// isPlannedLeaveDisabled removed - Validation is now server-side only

// Modern white theme with red accents
const STORAGE_KEY = 'leave_form_draft';

// Leave Category: UI config (labels, icons, descriptions); backend values unchanged
const LEAVE_CATEGORY_CONFIG = {
    'Casual': { label: 'Casual Leave', description: 'Short personal time off', Icon: BeachAccessIcon },
    'Planned': { label: 'Earned Leave', description: 'Accrued paid leave', Icon: WorkspacePremiumIcon },
    'Sick': { label: 'Sick Leave', description: 'Health-related absence', Icon: LocalHospitalIcon },
    'Compensatory': { label: 'Compensatory Off', description: 'Against worked weekend/holiday', Icon: UpdateIcon },
    'Loss of Pay': { label: 'Loss of Pay (LOP)', description: 'Unpaid leave', Icon: WarningAmberIcon },
    'Backdated Leave': { label: 'Backdated Leave', description: 'Applied for past dates', Icon: HistoryIcon },
};
const STANDARD_LEAVES = ['Casual', 'Planned', 'Sick', 'Compensatory'];
const SPECIAL_CASES = ['Loss of Pay', 'Backdated Leave'];
const LEAVE_CATEGORY_PLACEHOLDER = 'Select leave type';

// --- Date helpers for Comp-Off (and reuse elsewhere) ---
const toDateKey = (d) => {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
const getDayOfWeek = (d) => (d instanceof Date ? d : new Date(d)).getDay();
const isSunday = (d) => getDayOfWeek(d) === 0;
const isSaturday = (d) => getDayOfWeek(d) === 6;
const isWeekend = (d) => { const day = getDayOfWeek(d); return day === 0 || day === 6; };

/**
 * Check if a Saturday is a working Saturday based on employee's policy
 * @param {Date} date - The date to check
 * @param {string} saturdayPolicy - Employee's alternateSaturdayPolicy
 * @returns {boolean} - True if it's a working Saturday
 */
const isWorkingSaturday = (date, saturdayPolicy = 'All Saturdays Working') => {
    if (!isSaturday(date)) return false;
    
    const weekNum = Math.ceil(date.getDate() / 7);
    
    switch (saturdayPolicy) {
        case 'All Saturdays Working':
            return true;
        case 'All Saturdays Off':
            return false;
        case 'Week 1 & 3 Off':
            return !(weekNum === 1 || weekNum === 3);
        case 'Week 2 & 4 Off':
            return !(weekNum === 2 || weekNum === 4);
        default:
            return true; // Default to working if policy is unclear
    }
};

const isPastDate = (d) => {
    const date = d instanceof Date ? new Date(d.getTime()) : new Date(d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
};
const isFutureDate = (d) => {
    const date = d instanceof Date ? new Date(d.getTime()) : new Date(d);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    date.setHours(23, 59, 59, 999);
    return date > today;
};
const isInCurrentMonth = (d) => {
    const date = d instanceof Date ? new Date(d.getTime()) : new Date(d);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
};
const isHoliday = (d, holidays) => {
    if (!holidays || !holidays.length) return false;
    const key = toDateKey(d);
    return holidays.some((h) => {
        if (!h.date || h.isTentative) return false;
        return toDateKey(h.date) === key;
    });
};
/** Leave Date (Comp-Off): allow only working days — disable Sunday, holidays, past */
const shouldDisableLeaveDateCompOff = (date, holidays) =>
    isSunday(date) || isHoliday(date, holidays) || isPastDate(date);
/** Worked Date (Comp-Off): allow only Saturday & Sunday; allow past and current-month weekends; disable weekdays, future months, holidays */
const shouldDisableWorkedDateCompOff = (date, holidays) => {
    if (!isWeekend(date)) return true;
    if (isHoliday(date, holidays)) return true;
    if (!isFutureDate(date)) return false;
    return !isInCurrentMonth(date);
};

/** 
 * Regular Leave Dates: disable holidays and Sundays always
 * For LOP: allow all Saturdays and Mondays (no clubbing restrictions)
 * For Casual: allow working Saturdays, block non-working Saturdays
 * For other leave types: block all Saturdays
 * CRITICAL: Block Monday after non-working Saturday for Casual only (weekend clubbing prevention)
 */
const shouldDisableRegularLeaveDate = (date, holidays, requestType, saturdayPolicy) => {
    // Always disable holidays and Sundays
    if (isHoliday(date, holidays) || isSunday(date)) return true;
    
    // Handle Saturday logic based on leave type
    if (isSaturday(date)) {
        // For LOP, allow all Saturdays (working and non-working)
        if (requestType === 'Loss of Pay') {
            return false; // Allow all Saturdays for LOP
        }
        // For Casual, allow working Saturdays only
        if (requestType === 'Casual') {
            return !isWorkingSaturday(date, saturdayPolicy);
        }
        // For all other leave types, block all Saturdays
        return true;
    }
    
    // CRITICAL: Block Monday after non-working Saturday for Casual only (weekend clubbing prevention)
    // LOP has no Monday restrictions
    if (getDayOfWeek(date) === 1) { // Monday
        if (requestType === 'Casual') {
            const saturdayBefore = new Date(date);
            saturdayBefore.setDate(date.getDate() - 2);
            
            // If Saturday before is a non-working Saturday, block Monday
            if (isSaturday(saturdayBefore) && !isWorkingSaturday(saturdayBefore, saturdayPolicy)) {
                return true; // Block Monday after non-working Saturday
            }
        }
        // LOP: Allow Monday without restrictions
    }
    
    return false;
};

const datePickerTextFieldSx = {
    '& .MuiInputLabel-root': { color: '#374151', fontSize: '13px', fontWeight: 500, '&.Mui-focused': { color: '#EF4444' }, '& .MuiFormLabel-asterisk': { color: '#EF4444' } },
    '& .MuiOutlinedInput-root': {
        height: '44px',
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        transition: 'all 200ms ease',
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E5E7EB', borderWidth: '1.5px' },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#D1D5DB' },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#EF4444', borderWidth: '1.5px', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)' },
        '& .MuiOutlinedInput-input': { fontSize: '14px', padding: '12px 16px' },
        '& .MuiInputAdornment-root .MuiSvgIcon-root': { color: '#EF4444', fontSize: '20px' },
    },
};

const getInitialFormData = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Validate and sanitize saved data
            const validated = {
                requestType: parsed.requestType || 'Casual',
                leaveType: parsed.leaveType || 'Full Day',
                startDate: parsed.startDate ? new Date(parsed.startDate) : null,
                endDate: parsed.endDate ? new Date(parsed.endDate) : null,
                alternateDate: parsed.alternateDate ? new Date(parsed.alternateDate) : null,
                reason: parsed.reason || '',
                medicalCertificate: null, // Don't persist file objects
                medicalCertificateUrl: null, // Don't persist URLs
            };
            return validated;
        }
    } catch (error) {
        console.warn('Failed to load draft data:', error);
        localStorage.removeItem(STORAGE_KEY); // Clear corrupted data
    }

    return {
        requestType: 'Casual',
        leaveType: 'Full Day',
        startDate: null,
        endDate: null,
        alternateDate: null,
        reason: '',
        medicalCertificate: null,
        medicalCertificateUrl: null,
    };
};

const LeaveRequestForm = ({ open, onClose, onSubmissionSuccess, holidays = [] }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState(getInitialFormData);
    const [error, setError] = useState('');
    const [showCategoryError, setShowCategoryError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploadingCertificate, setUploadingCertificate] = useState(false);
    const [plannedLeaveHistory, setPlannedLeaveHistory] = useState([]);
    const [draftSaved, setDraftSaved] = useState(false);
    const [showDraftBanner, setShowDraftBanner] = useState(false);
    const [monthlyLimitWarning, setMonthlyLimitWarning] = useState(null);
    const [checkingEligibility, setCheckingEligibility] = useState(false);

    const employeeType = normalizeEmploymentType(user?.employmentStatus);
    const allowedLeaveTypes = useMemo(() => getAllowedLeaveTypes(employeeType), [employeeType]);

    // Remove planned leave history fetching - validation is server-side only
    useEffect(() => {
        if (open) {
            // Reset planned leave history when form opens
            setPlannedLeaveHistory([]);

            // Check if we have saved draft data and show banner
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    const hasData = parsed.reason || parsed.startDate || parsed.endDate || parsed.alternateDate;
                    setShowDraftBanner(hasData);
                } catch (error) {
                    console.warn('Failed to parse draft data:', error);
                }
            }
        }
    }, [open, user]);

    // Auto-save form data to localStorage with debouncing
    useEffect(() => {
        if (!open) return; // Only save when form is open

        const timeoutId = setTimeout(() => {
            try {
                const dataToSave = {
                    requestType: formData.requestType,
                    leaveType: formData.leaveType,
                    startDate: formData.startDate?.toISOString(),
                    endDate: formData.endDate?.toISOString(),
                    alternateDate: formData.alternateDate?.toISOString(),
                    reason: formData.reason,
                    // Don't save file objects or URLs
                };

                localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
                setDraftSaved(true);

                // Hide draft saved indicator after 2 seconds
                setTimeout(() => setDraftSaved(false), 2000);
            } catch (error) {
                console.warn('Failed to save draft:', error);
            }
        }, 500); // Debounce by 500ms

        return () => clearTimeout(timeoutId);
    }, [formData, open]);

    // Check monthly limit when dates or leave type changes
    useEffect(() => {
        if (!open || !formData.startDate || !formData.requestType) {
            setMonthlyLimitWarning(null);
            return;
        }

        // Only check for non-Planned, non-Compensatory leaves
        if (formData.requestType === 'Planned' || formData.requestType === 'Compensatory') {
            setMonthlyLimitWarning(null);
            return;
        }

        const checkEligibility = async () => {
            setCheckingEligibility(true);
            try {
                const pad = (n) => String(n).padStart(2, '0');
                let leaveDates = [];
                if (formData.requestType === 'Compensatory') {
                    if (!formData.startDate) return;
                    leaveDates = [toDateKey(formData.startDate)];
                } else {
                    const start = new Date(formData.startDate);
                    const end = formData.endDate ? new Date(formData.endDate) : new Date(start);
                    let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
                    while (cur <= last) {
                        leaveDates.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
                        cur.setDate(cur.getDate() + 1);
                    }
                }

                if (leaveDates.length === 0) {
                    setMonthlyLimitWarning(null);
                    return;
                }

                const response = await api.post('/leaves/check-eligibility', {
                    requestType: formData.requestType,
                    leaveType: formData.leaveType || 'Full Day',
                    leaveDates,
                    alternateDate: formData.alternateDate ? toDateKey(formData.alternateDate) : null,
                    medicalCertificate: formData.medicalCertificateUrl || null,
                });

                // Show warning if monthly limit info is available
                if (response.data.alreadyUsed !== undefined && response.data.totalAfterRequest !== undefined) {
                    const { alreadyUsed, requestedDays, remainingDays, totalAfterRequest } = response.data;
                    // Always show warning if:
                    // 1. Request would exceed limit (totalAfterRequest > 5), OR
                    // 2. Remaining days after request is <= 2 (approaching limit - show early warning), OR
                    // 3. Already used >= 3 days (show warning for any new request)
                    const wouldExceed = totalAfterRequest > 5;
                    const isCloseToLimit = remainingDays !== undefined && remainingDays <= 2 && remainingDays >= 0;
                    const hasSignificantUsage = (alreadyUsed || 0) >= 3;
                    
                    if (wouldExceed || isCloseToLimit || hasSignificantUsage) {
                        setMonthlyLimitWarning({
                            alreadyUsed: alreadyUsed || 0,
                            requestedDays: requestedDays || 0,
                            remainingDays: remainingDays !== undefined ? remainingDays : Math.max(0, 5 - totalAfterRequest),
                            totalAfterRequest: totalAfterRequest || 0,
                            wouldExceed: wouldExceed
                        });
                    } else {
                        setMonthlyLimitWarning(null);
                    }
                } else {
                    setMonthlyLimitWarning(null);
                }
            } catch (err) {
                // Silently fail - this is just for warning, not blocking
                setMonthlyLimitWarning(null);
            } finally {
                setCheckingEligibility(false);
            }
        };

        const timeoutId = setTimeout(checkEligibility, 800); // Debounce eligibility check
        return () => clearTimeout(timeoutId);
    }, [formData.startDate, formData.endDate, formData.requestType, formData.leaveType, open]);

    // Listen for storage events (when data changes in another tab)
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    const updatedData = {
                        ...formData,
                        ...parsed,
                        startDate: parsed.startDate ? new Date(parsed.startDate) : null,
                        endDate: parsed.endDate ? new Date(parsed.endDate) : null,
                        alternateDate: parsed.alternateDate ? new Date(parsed.alternateDate) : null,
                    };
                    setFormData(updatedData);
                } catch (error) {
                    console.warn('Failed to sync draft data:', error);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [formData]);

    useEffect(() => {
        if (open) {
            const initial = getInitialFormData();
            const nextRequestType = allowedLeaveTypes.includes(initial.requestType)
                ? initial.requestType
                : (allowedLeaveTypes[0] || 'Loss of Pay');
            setFormData({ ...initial, requestType: nextRequestType });
            setError('');
            setShowCategoryError(false);
            setUploadingCertificate(false);
        }
    }, [open, user, allowedLeaveTypes]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'requestType') setShowCategoryError(false);
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            if (name === 'requestType' && value === 'Compensatory') next.endDate = null;
            return next;
        });
    };

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
        const categoryInvalid = !formData.requestType || !allowedLeaveTypes.includes(formData.requestType);
        if (categoryInvalid) {
            setShowCategoryError(true);
            setError(formData.requestType ? 'Selected leave type is not available for your employment status.' : 'Please select a leave category.');
            return;
        }
        setShowCategoryError(false);
        if (!formData.reason || !formData.startDate) {
            setError('Please select a leave date and provide a reason.');
            return;
        }
        if (formData.reason.trim().length < 100) {
            setError('Reason must be at least 100 characters long. Please provide more details.');
            return;
        }
        if (formData.requestType === 'Compensatory') {
            if (!formData.alternateDate) {
                setError('Please select Worked Date (Saturday or Sunday) for Comp-Off leave.');
                return;
            }
            if (toDateKey(formData.startDate) === toDateKey(formData.alternateDate)) {
                setError('Leave Date and Worked Date must be different.');
                return;
            }
            const leaveD = new Date(formData.startDate.getFullYear(), formData.startDate.getMonth(), formData.startDate.getDate());
            const workedD = new Date(formData.alternateDate.getFullYear(), formData.alternateDate.getMonth(), formData.alternateDate.getDate());
            if (leaveD <= workedD) {
                setError('Leave Date must be after Worked Date.');
                return;
            }
        }
        // Medical certificate is now OPTIONAL for Sick Leave
        // Certificate will be required only for consecutive SL >= threshold days (handled by backend)
        // No need to block submission here

        setLoading(true);

        const pad = (n) => String(n).padStart(2, '0');
        let leaveDates = [];
        if (formData.requestType === 'Compensatory') {
            leaveDates = [toDateKey(formData.startDate)];
        } else {
            const start = new Date(formData.startDate);
            const end = formData.endDate ? new Date(formData.endDate) : new Date(start);
            let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
            while (cur <= last) {
                leaveDates.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
                cur.setDate(cur.getDate() + 1);
            }
        }

        const payload = {
            requestType: formData.requestType,
            leaveType: formData.requestType === 'Compensatory' ? 'Full Day' : formData.leaveType,
            alternateDate: formData.alternateDate ? toDateKey(formData.alternateDate) : null,
            reason: formData.reason,
            leaveDates,
            ...(formData.requestType === 'Sick' && formData.medicalCertificateUrl && {
                medicalCertificate: formData.medicalCertificateUrl
            }),
        };

        try {
            const { data } = await api.post('/leaves/request', payload);
            // Clear draft on successful submission
            localStorage.removeItem(STORAGE_KEY);
            setFormData(getInitialFormData());
            setShowDraftBanner(false);
            onSubmissionSuccess(data.request);
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.errors?.join(' ') || 'Failed to submit request.');
        } finally {
            setLoading(false);
        }
    };

    // Check if form has unsaved changes
    const hasUnsavedChanges = () => {
        const initial = getInitialFormData();
        return (
            formData.requestType !== initial.requestType ||
            formData.leaveType !== initial.leaveType ||
            formData.startDate !== initial.startDate ||
            formData.endDate !== initial.endDate ||
            formData.alternateDate !== initial.alternateDate ||
            formData.reason !== initial.reason ||
            formData.medicalCertificateUrl !== initial.medicalCertificateUrl
        );
    };

    const handleCancel = () => {
        if (hasUnsavedChanges()) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to discard your draft?');
            if (!confirmed) return;
        }
        localStorage.removeItem(STORAGE_KEY);
        setShowDraftBanner(false);
        onClose();
    };

    const handleClearDraft = () => {
        const confirmed = window.confirm('Are you sure you want to clear your draft and start fresh?');
        if (confirmed) {
            localStorage.removeItem(STORAGE_KEY);
            setFormData(getInitialFormData());
            setShowDraftBanner(false);
        }
    };

    const isBackdateFlow = formData.requestType === 'Backdated Leave';
    const modalTitle = 'Apply for Leave';
    const descriptionText = isBackdateFlow
        ? 'Apply for a leave of absence for a past date. This will be sent for approval.'
        : 'Please fill out the details for your request.';

    return (
        // Modern white theme with red accents
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderRadius: '16px',
                    width: '560px',
                    maxWidth: '560px',
                    maxHeight: '90vh',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                    backdropFilter: 'blur(8px)',
                    animation: 'slideIn 0.3s ease-out',
                    '@keyframes slideIn': {
                        '0%': {
                            opacity: 0,
                            transform: 'translateY(-20px) scale(0.95)',
                        },
                        '100%': {
                            opacity: 1,
                            transform: 'translateY(0) scale(1)',
                        },
                    },
                }
            }}
        >
            {/* Modern header with red accents */}
            <DialogTitle sx={{
                backgroundColor: '#FFFFFF',
                borderBottom: '1px solid #E5E7EB',
                padding: '24px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <Box>
                    <Typography
                        id="leave-form-title"
                        variant="h5"
                        sx={{
                            color: '#1A202C',
                            fontWeight: 600,
                            fontSize: '24px',
                            mb: '4px'
                        }}
                    >
                        Apply for Leave
                    </Typography>
                    <Typography
                        id="leave-form-description"
                        sx={{
                            color: '#6B7280',
                            fontWeight: 400,
                            fontSize: '14px'
                        }}
                    >
                        Please fill out the details for your leave request.
                    </Typography>
                </Box>
                <IconButton
                    onClick={handleCancel}
                    sx={{
                        color: '#6B7280',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        transition: 'all 200ms ease',
                        '&:hover': {
                            backgroundColor: '#F3F4F6',
                            color: '#EF4444',
                            transform: 'scale(1.05)',
                        },
                    }}
                    aria-label="Close form"
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{
                padding: '24px',
                backgroundColor: '#FFFFFF',
                overflow: 'auto'
            }}>
                <Box
                    component="form"
                    role="form"
                    aria-labelledby="leave-form-title"
                    aria-describedby="leave-form-description"
                    noValidate
                    autoComplete="off"
                >
                    <Stack spacing={3}>
                    {/* Draft restored banner */}
                    {showDraftBanner && (
                        <Alert
                            severity="info"
                            sx={{
                                backgroundColor: '#EBF4FF',
                                color: '#1E40AF',
                                border: '1px solid #BFDBFE',
                                borderRadius: '8px',
                                '& .MuiAlert-icon': {
                                    color: '#3B82F6'
                                }
                            }}
                            action={
                                <Button
                                    size="small"
                                    onClick={handleClearDraft}
                                    sx={{
                                        color: '#3B82F6',
                                        fontWeight: 500,
                                        textTransform: 'none',
                                        '&:hover': {
                                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                        }
                                    }}
                                >
                                    Clear Draft
                                </Button>
                            }
                        >
                            Your previous draft has been restored. Continue where you left off.
                        </Alert>
                    )}

                    {/* Auto-save indicator with ARIA live region */}
                    <Box
                        aria-live="polite"
                        aria-atomic="true"
                        sx={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}
                    >
                        {draftSaved ? 'Draft saved automatically' : ''}
                    </Box>

                    {draftSaved && (
                        <Alert
                            severity="success"
                            sx={{
                                backgroundColor: '#F0FDF4',
                                color: '#166534',
                                border: '1px solid #BBF7D0',
                                borderRadius: '8px',
                                position: 'fixed',
                                top: '20px',
                                right: '20px',
                                zIndex: 9999,
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                minWidth: '200px',
                                '& .MuiAlert-icon': {
                                    color: '#16A34A'
                                }
                            }}
                        >
                            Draft saved automatically
                        </Alert>
                    )}

                    {error && (
                        <Alert
                            severity="warning"
                            sx={{
                                backgroundColor: '#FEF3C7',
                                color: '#92400E',
                                border: '1px solid #FCD34D',
                                borderRadius: '8px',
                                mb: 2,
                                '& .MuiAlert-icon': {
                                    color: '#D97706'
                                }
                            }}
                        >
                            {error}
                        </Alert>
                    )}

                    {/* Monthly working days limit warning */}
                    {monthlyLimitWarning && !error && (
                        <Alert
                            severity={monthlyLimitWarning.wouldExceed ? "error" : "warning"}
                            sx={{
                                backgroundColor: monthlyLimitWarning.wouldExceed ? '#FEE2E2' : '#FEF3C7',
                                color: monthlyLimitWarning.wouldExceed ? '#991B1B' : '#92400E',
                                border: `1px solid ${monthlyLimitWarning.wouldExceed ? '#FECACA' : '#FDE68A'}`,
                                borderRadius: '8px',
                                mb: 2,
                                '& .MuiAlert-icon': {
                                    color: monthlyLimitWarning.wouldExceed ? '#DC2626' : '#D97706'
                                }
                            }}
                        >
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Monthly Leave Limit Warning
                            </Typography>
                            <Typography variant="body2">
                                {monthlyLimitWarning.wouldExceed ? (
                                    <>
                                        You have already used <strong>{monthlyLimitWarning.alreadyUsed} working day{monthlyLimitWarning.alreadyUsed !== 1 ? 's' : ''}</strong> of leave this month. 
                                        This request of <strong>{monthlyLimitWarning.requestedDays} working day{monthlyLimitWarning.requestedDays !== 1 ? 's' : ''}</strong> would exceed the monthly limit of 5 working days. 
                                        You can apply for up to <strong>{monthlyLimitWarning.remainingDays} working day{monthlyLimitWarning.remainingDays !== 1 ? 's' : ''}</strong> this month.
                                    </>
                                ) : (
                                    <>
                                        You have already used <strong>{monthlyLimitWarning.alreadyUsed} working day{monthlyLimitWarning.alreadyUsed !== 1 ? 's' : ''}</strong> of leave this month. 
                                        This request will leave you with <strong>{monthlyLimitWarning.remainingDays} working day{monthlyLimitWarning.remainingDays !== 1 ? 's' : ''}</strong> remaining for the month.
                                    </>
                                )}
                            </Typography>
                        </Alert>
                    )}

                    <FormControl
                        fullWidth
                        error={showCategoryError}
                        sx={{
                            '& .MuiInputLabel-root': {
                                color: showCategoryError ? '#d32f2f' : '#374151',
                                fontSize: '13px',
                                fontWeight: 500,
                                '&.Mui-focused': {
                                    color: showCategoryError ? '#d32f2f' : '#2563eb',
                                },
                                '&.Mui-error': { color: '#d32f2f' },
                                '& .MuiFormLabel-asterisk': { color: showCategoryError ? '#d32f2f' : '#6B7280' },
                            },
                            '& .MuiOutlinedInput-root': {
                                height: '48px',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '8px',
                                transition: 'all 200ms ease',
                                borderLeft: '3px solid transparent',
                                '&.Mui-focused': {
                                    borderLeftColor: showCategoryError ? '#d32f2f' : '#2563eb',
                                },
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: showCategoryError ? '#d32f2f' : '#E5E7EB',
                                    borderWidth: '1.5px',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: showCategoryError ? '#d32f2f' : '#D1D5DB',
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: showCategoryError ? '#d32f2f' : '#2563eb',
                                    borderWidth: '1.5px',
                                    boxShadow: showCategoryError ? '0 0 0 3px rgba(211, 47, 47, 0.1)' : '0 0 0 3px rgba(37, 99, 235, 0.1)',
                                },
                                '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#d32f2f' },
                                '& .MuiSelect-select': { display: 'flex', alignItems: 'center', gap: 1, fontWeight: 500 },
                                '& .MuiOutlinedInput-input': { padding: '12px 14px 12px 8px' },
                                '& .MuiSelect-icon': { color: showCategoryError ? '#d32f2f' : '#6B7280', right: '12px' },
                            },
                        }}
                    >
                        <InputLabel id="leave-category-label">
                            Leave Category <span style={{ color: '#6B7280' }} aria-label="required">*</span>
                        </InputLabel>
                        <Select
                            name="requestType"
                            value={formData.requestType || ''}
                            label="Leave Category"
                            onChange={handleChange}
                            displayEmpty
                            renderValue={(value) => {
                                if (!value) {
                                    return (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#9CA3AF' }}>
                                            <CategoryIcon sx={{ fontSize: 20, color: 'inherit' }} />
                                            <span>{LEAVE_CATEGORY_PLACEHOLDER}</span>
                                        </Box>
                                    );
                                }
                                const config = LEAVE_CATEGORY_CONFIG[value];
                                if (!config) return value;
                                const Icon = config.Icon;
                                return (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                        <Icon sx={{ fontSize: 20, color: '#6B7280' }} aria-hidden />
                                        <span style={{ fontWeight: 500 }}>{config.label}</span>
                                    </Box>
                                );
                            }}
                            MenuProps={{
                                PaperProps: {
                                    sx: {
                                        mt: 1.5,
                                        borderRadius: 2,
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                                        '& .MuiMenuItem-root': {
                                            py: 1.25,
                                            '&:hover': { backgroundColor: 'rgba(37, 99, 235, 0.06)' },
                                            '&.Mui-selected': { backgroundColor: 'rgba(37, 99, 235, 0.08)' },
                                            '&.Mui-selected:hover': { backgroundColor: 'rgba(37, 99, 235, 0.12)' },
                                        },
                                        '& .MuiListItemIcon-root': { minWidth: 40, color: '#6B7280' },
                                        '& .MuiMenuItem-root:hover .MuiListItemIcon-root': { color: '#374151' },
                                    },
                                },
                            }}
                            aria-labelledby="leave-category-label"
                            aria-required="true"
                            aria-describedby="leave-category-help"
                            aria-invalid={showCategoryError}
                        >
                            <ListSubheader sx={{ lineHeight: 2, color: '#6B7280', fontWeight: 600, letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                                STANDARD LEAVES
                            </ListSubheader>
                            {STANDARD_LEAVES.filter((v) => allowedLeaveTypes.includes(v)).map((value) => {
                                const { label, description, Icon } = LEAVE_CATEGORY_CONFIG[value];
                                return (
                                    <MenuItem key={value} value={value}>
                                        <ListItemIcon><Icon sx={{ fontSize: 22 }} /></ListItemIcon>
                                        <ListItemText
                                            primary={label}
                                            secondary={description}
                                            primaryTypographyProps={{ fontWeight: 500 }}
                                            secondaryTypographyProps={{ variant: 'caption', sx: { color: '#6B7280', fontSize: '0.75rem', mt: 0.25 } }}
                                        />
                                    </MenuItem>
                                );
                            })}
                            <Divider sx={{ my: 0.5 }} />
                            <ListSubheader sx={{ lineHeight: 2, color: '#6B7280', fontWeight: 600, letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                                SPECIAL CASES
                            </ListSubheader>
                            {SPECIAL_CASES.filter((v) => allowedLeaveTypes.includes(v)).map((value) => {
                                const { label, description, Icon } = LEAVE_CATEGORY_CONFIG[value];
                                return (
                                    <MenuItem key={value} value={value}>
                                        <ListItemIcon><Icon sx={{ fontSize: 22 }} /></ListItemIcon>
                                        <ListItemText
                                            primary={label}
                                            secondary={description}
                                            primaryTypographyProps={{ fontWeight: 500 }}
                                            secondaryTypographyProps={{ variant: 'caption', sx: { color: '#6B7280', fontSize: '0.75rem', mt: 0.25 } }}
                                        />
                                    </MenuItem>
                                );
                            })}
                        </Select>
                    </FormControl>

                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        {formData.requestType === 'Compensatory' ? (
                            <>
                                <DatePicker
                                    label="Leave Date"
                                    value={formData.startDate}
                                    onChange={handleStartDateChange}
                                    shouldDisableDate={(date) => shouldDisableLeaveDateCompOff(date, holidays)}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            required: true,
                                            sx: datePickerTextFieldSx,
                                        },
                                    }}
                                />
                                <DatePicker
                                    label="Worked Date (Saturday / Sunday)"
                                    value={formData.alternateDate}
                                    onChange={handleAlternateDateChange}
                                    shouldDisableDate={(date) => shouldDisableWorkedDateCompOff(date, holidays)}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            required: true,
                                            sx: datePickerTextFieldSx,
                                        },
                                    }}
                                />
                            </>
                        ) : (
                            <>
                                <DatePicker
                                    label="Leave date"
                                    value={formData.startDate}
                                    onChange={handleStartDateChange}
                                    shouldDisableDate={(date) => shouldDisableRegularLeaveDate(date, holidays, formData.requestType, user?.alternateSaturdayPolicy)}
                                    slotProps={{
                                        textField: { fullWidth: true, sx: datePickerTextFieldSx },
                                    }}
                                />
                                <DatePicker
                                    label="End Date (optional)"
                                    value={formData.endDate}
                                    onChange={handleEndDateChange}
                                    minDate={formData.startDate}
                                    disabled={!formData.startDate}
                                    shouldDisableDate={(date) => shouldDisableRegularLeaveDate(date, holidays, formData.requestType, user?.alternateSaturdayPolicy)}
                                    slotProps={{
                                        textField: { fullWidth: true, sx: datePickerTextFieldSx },
                                    }}
                                />
                            </>
                        )}
                    </LocalizationProvider>

                    {formData.requestType !== 'Compensatory' && (
                        <FormControl fullWidth sx={{
                            // Modern form field styling with red accents
                            '& .MuiInputLabel-root': {
                                color: '#374151',
                                fontSize: '13px',
                                fontWeight: 500,
                                '&.Mui-focused': {
                                    color: '#EF4444',
                                },
                            },
                            '& .MuiOutlinedInput-root': {
                                height: '44px',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '8px',
                                transition: 'all 200ms ease',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#E5E7EB',
                                    borderWidth: '1.5px',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#D1D5DB',
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#EF4444',
                                    borderWidth: '1.5px',
                                    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
                                },
                                '& .MuiOutlinedInput-input': {
                                    fontSize: '14px',
                                    padding: '12px 16px',
                                },
                                '& .MuiSelect-icon': {
                                    color: '#EF4444',
                                    right: '12px',
                                },
                            },
                        }}>
                            <InputLabel>Day Type</InputLabel>
                            <Select
                                name="leaveType"
                                value={formData.leaveType}
                                label="Day Type"
                                onChange={handleChange}
                            >
                                <MenuItem value="Full Day">Full Day</MenuItem>
                                <MenuItem value="Half Day - First Half">Half Day - First Half</MenuItem>
                                <MenuItem value="Half Day - Second Half">Half Day - Second Half</MenuItem>
                            </Select>
                        </FormControl>
                    )}


                    {formData.requestType === 'Sick' && (
                        <Box>
                            {/* redesigned form field UI – neutral theme */}
                            <Typography variant="body2" sx={{ mb: 1, color: '#374151', fontWeight: 500 }}>
                                Medical Certificate <span style={{ color: '#9CA3AF', fontSize: '0.875rem' }}>(Optional - Required only if applicable)</span>
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
                                    Medical certificate is optional. It will be required for consecutive sick leave of 2+ days or if requested by admin.
                                </Typography>
                            )}
                        </Box>
                    )}

                    <TextField
                        name="reason"
                        label="Reason"
                        value={formData.reason}
                        onChange={handleChange}
                        multiline
                        rows={4}
                        fullWidth
                        error={formData.reason.trim().length > 0 && formData.reason.trim().length < 100}
                        helperText={
                            formData.reason.trim().length > 0 && formData.reason.trim().length < 100
                                ? `Please write at least ${100 - formData.reason.trim().length} more characters`
                                : formData.reason.trim().length >= 100
                                    ? `${formData.reason.trim().length} characters`
                                    : 'Please provide a detailed reason for your leave request (minimum 100 characters)'
                        }
                        FormHelperTextProps={{
                            sx: {
                                color: formData.reason.trim().length > 450 ? '#EF4444' : '#6B7280',
                                fontWeight: 500,
                                fontSize: '12px',
                                mt: 0.5,
                                textAlign: 'right'
                            }
                        }}
                        inputProps={{
                            style: {
                                color: '#111827',
                                WebkitTextFillColor: '#111827',
                                caretColor: '#111827',
                            },
                        }}
                        sx={{
                            // Modern textarea styling with red accents
                            '& .MuiInputLabel-root': {
                                color: '#374151',
                                fontSize: '13px',
                                fontWeight: 500,
                                '&.Mui-focused': {
                                    color: '#EF4444',
                                },
                                '& .MuiFormLabel-asterisk': {
                                    color: '#EF4444',
                                },
                            },
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: '#FFFFFF',
                                borderRadius: '8px',
                                minHeight: '120px',
                                transition: 'all 200ms ease',
                                resize: 'vertical',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#E5E7EB',
                                    borderWidth: '1.5px',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#D1D5DB',
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#EF4444',
                                    borderWidth: '1.5px',
                                    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
                                },
                                // Error: red border only, no background overlay so typed text stays visible
                                '&.Mui-error .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#DC2626',
                                    backgroundColor: 'transparent',
                                },
                                '& .MuiOutlinedInput-input': {
                                    fontSize: '14px',
                                    padding: '12px 16px',
                                    color: '#111827 !important',
                                    WebkitTextFillColor: '#111827 !important',
                                    caretColor: '#111827',
                                    '&::placeholder': {
                                        color: '#9CA3AF',
                                        opacity: 1,
                                    },
                                },
                                '&.Mui-error .MuiOutlinedInput-input': {
                                    color: '#111827 !important',
                                    WebkitTextFillColor: '#111827 !important',
                                },
                            },
                        }}
                    />
                    </Stack>
                </Box>
            </DialogContent>
            {/* Modern footer with red accent buttons */}
            <DialogActions sx={{
                padding: '24px 32px',
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid #E5E7EB',
                gap: 2,
            }}>
                <Button
                    onClick={handleCancel}
                    variant="outlined"
                    disabled={loading}
                    sx={{
                        // Modern secondary button styling
                        borderColor: '#E5E7EB',
                        borderWidth: '1.5px',
                        color: '#6B7280',
                        fontWeight: 500,
                        borderRadius: '8px',
                        textTransform: 'none',
                        padding: '12px 32px',
                        transition: 'all 200ms ease',
                        '&:hover': {
                            borderColor: '#D1D5DB',
                            backgroundColor: '#F9FAFB',
                            color: '#374151',
                            transform: 'translateY(-1px)',
                        },
                        '&:disabled': {
                            borderColor: '#E5E7EB',
                            color: '#D1D5DB',
                            opacity: 0.5,
                        }
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading}
                    sx={{
                        // Modern red accent primary button
                        backgroundColor: '#EF4444',
                        color: '#FFFFFF',
                        fontWeight: 500,
                        borderRadius: '8px',
                        textTransform: 'none',
                        padding: '12px 32px',
                        transition: 'all 200ms ease',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                        '&:hover': {
                            backgroundColor: '#DC2626',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 6px 16px rgba(239, 68, 68, 0.4)',
                        },
                        '&:active': {
                            transform: 'translateY(0)',
                            transition: 'all 100ms ease',
                        },
                        '&:disabled': {
                            backgroundColor: '#F3F4F6',
                            color: '#9CA3AF',
                            opacity: 0.5,
                            boxShadow: 'none',
                        }
                    }}
                >
                    {loading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid #FFFFFF',
                                borderTop: '2px solid transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                '@keyframes spin': {
                                    '0%': { transform: 'rotate(0deg)' },
                                    '100%': { transform: 'rotate(360deg)' },
                                },
                            }} />
                            Submitting...
                        </Box>
                    ) : (
                        'Submit Request'
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default LeaveRequestForm;