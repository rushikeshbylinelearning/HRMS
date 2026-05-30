import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Grid, Stack, Avatar, Chip, TextField, Button, Snackbar, Alert, IconButton, MenuItem, Autocomplete } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import BusinessIcon from '@mui/icons-material/Business';
import CakeIcon from '@mui/icons-material/Cake';
import WcIcon from '@mui/icons-material/Wc';
import BloodtypeIcon from '@mui/icons-material/Bloodtype';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import CountryCodeSelector from './CountryCodeSelector';
import CIFSummaryCard from './CIF/CIFSummaryCard';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

import { SkeletonBox } from '../components/SkeletonLoaders';
const roles = ['Admin', 'HR', 'Employee', 'Intern'];
const statusOptions = ['Active', 'Inactive'];

// ── Design tokens ──────────────────────────────────────────────
const RED = '#E53935';
const RED_DARK = '#C62828';
const RED_BG = '#FDECEC';
const BLACK = '#1A1A1A';
const GREY = '#6B7280';
const BORDER = '#E5E7EB';

const cardSx = {
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    border: `1px solid ${BORDER}`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    '&:hover': {
        boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
        transform: 'translateY(-1px)'
    }
};

const sectionTitleSx = {
    fontWeight: 700,
    color: BLACK,
    fontSize: '15px',
    mb: 0.5,
    display: 'flex',
    alignItems: 'center',
    gap: 1
};

const redAccentLineSx = {
    width: 36,
    height: 3,
    borderRadius: 2,
    background: RED,
    mb: 2.5,
    mt: 0.5
};

const textFieldSx = {
    '& .MuiOutlinedInput-root': {
        borderRadius: '12px',
        backgroundColor: '#fff'
    },
    '& .MuiInputLabel-root': {
        color: '#666'
    }
};

const defaultFormState = {
    fullName: '',
    employeeCode: '',
    designation: '',
    department: '',
    email: '',
    role: 'Employee',
    status: 'Active',
    joiningDate: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    maritalStatus: '',
    phoneNumber: '',
    phoneCountryCode: '+91',
    alternatePhone: '',
    personalEmail: '',
    addressFlat: '',
    addressArea: '',
    addressCity: '',
    addressState: '',
    addressPincode: '',
    emergencyContactName: '',
    emergencyContactNumber: '',
    emergencyContactCountryCode: '+91',
    emergencyContactRelationship: '',
    emergencyContactEmail: '',
    aadhaarNumber: '',
    panCardNumber: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    bankBranch: '',
    uanNumber: '',
    pfAccountNumber: '',
    reportingPersonId: '',
};

const AdminEmployeeProfileDialog = ({
    open,
    mode = 'view',
    employee = null,
    onClose,
    onSaved,
    onOpenAdvancedEditor
}) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState(defaultFormState);
    const [isEditing, setIsEditing] = useState(mode === 'edit');
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [reportingOptions, setReportingOptions] = useState([]);
    const [reportingOptionsLoading, setReportingOptionsLoading] = useState(false);
    const [selectedReportingOption, setSelectedReportingOption] = useState(null);

    const buildFormState = useMemo(() => (data) => ({
        fullName: data?.fullName || '',
        employeeCode: data?.employeeCode || '',
        designation: data?.designation || '',
        department: data?.department || '',
        email: data?.email || '',
        role: data?.role || 'Employee',
        status: data?.isActive === false ? 'Inactive' : 'Active',
        joiningDate: data?.joiningDate ? new Date(data.joiningDate).toISOString().slice(0, 10) : '',
        // Personal
        dateOfBirth:   data?.personalDetails?.dateOfBirth   || '',
        gender:        data?.personalDetails?.gender        || '',
        bloodGroup:    data?.personalDetails?.bloodGroup    || '',
        maritalStatus: data?.personalDetails?.maritalStatus || '',
        // Contact
        phoneNumber:      data?.personalDetails?.phoneNumber      || '',
        phoneCountryCode: data?.personalDetails?.phoneCountryCode || '+91',
        alternatePhone:   data?.personalDetails?.alternatePhone   || '',
        personalEmail:    data?.personalDetails?.personalEmail    || '',
        // Address
        addressFlat:    data?.personalDetails?.address?.flat    || '',
        addressArea:    data?.personalDetails?.address?.area    || '',
        addressCity:    data?.personalDetails?.address?.city    || '',
        addressState:   data?.personalDetails?.address?.state   || '',
        addressPincode: data?.personalDetails?.address?.pincode || '',
        // Emergency contact
        emergencyContactName:         data?.personalDetails?.emergencyContactName         || '',
        emergencyContactNumber:       data?.personalDetails?.emergencyContactNumber       || '',
        emergencyContactCountryCode:  data?.personalDetails?.emergencyContactCountryCode  || '+91',
        emergencyContactRelationship: data?.personalDetails?.emergencyContactRelationship || '',
        emergencyContactEmail:        data?.personalDetails?.emergencyContactEmail        || '',
        // Identity & Bank
        aadhaarNumber:   data?.identityDetails?.aadhaarNumber   || '',
        panCardNumber:   data?.identityDetails?.panCardNumber   || '',
        bankName:        data?.identityDetails?.bankName        || '',
        accountNumber:   data?.identityDetails?.accountNumber   || '',
        ifscCode:        data?.identityDetails?.ifscCode        || '',
        bankBranch:      data?.identityDetails?.bankBranch      || '',
        uanNumber:       data?.identityDetails?.uanNumber       || '',
        pfAccountNumber: data?.identityDetails?.pfAccountNumber || '',
        reportingPersonId: data?.reportingPerson?._id || '',
    }), []);

    useEffect(() => {
        if (employee) {
            setFormData(buildFormState(employee));
        } else {
            setFormData(defaultFormState);
        }
        setIsEditing(mode === 'edit');
    }, [employee, mode, buildFormState, open]);

    useEffect(() => {
        if (!open) return;
        let isActive = true;
        setReportingOptionsLoading(true);
        api.get('/admin/employees?all=true')
            .then(({ data }) => {
                if (!isActive) return;
                const list = Array.isArray(data) ? data : data.employees || [];
                setReportingOptions(list);
            })
            .catch((error) => {
                console.error('Failed to load reporting person options:', error);
            })
            .finally(() => {
                if (isActive) {
                    setReportingOptionsLoading(false);
                }
            });
        return () => {
            isActive = false;
        };
    }, [open]);

    useEffect(() => {
        if (!employee || !reportingOptions.length) {
            setSelectedReportingOption(null);
            return;
        }
        const match = reportingOptions.find(opt => employee.reportingPerson?._id && opt._id === employee.reportingPerson._id);
        setSelectedReportingOption(match || null);
    }, [employee, reportingOptions]);

    const validatePhoneNumber = (value) => {
        const digitsOnly = value.replace(/\D/g, '');
        return digitsOnly.slice(0, 15);
    };

    const validatePincode = (value) => {
        const digitsOnly = value.replace(/\D/g, '');
        return digitsOnly.slice(0, 10);
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        let processedValue = value;

        // Apply validation
        if (name === 'phoneNumber' || name === 'emergencyContactNumber') {
            processedValue = validatePhoneNumber(value);
        } else if (name === 'addressPincode') {
            processedValue = validatePincode(value);
        }

        setFormData((prev) => ({ ...prev, [name]: processedValue }));
    };

    const handleCountryCodeChange = (fieldName) => (event) => {
        setFormData((prev) => ({ ...prev, [fieldName]: event.target.value }));
    };

    const handleReportingSelection = (event, newValue) => {
        setSelectedReportingOption(newValue || null);
        if (newValue) {
            setFormData(prev => ({
                ...prev,
                reportingPersonId: newValue._id || ''
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                reportingPersonId: ''
            }));
        }
    };

    const handleReset = () => {
        if (employee) {
            setFormData(buildFormState(employee));
        }
    };

    const handleClose = () => {
        if (!saving) {
            onClose?.();
        }
    };

    const buildPayload = () => {
        const payload = {
            fullName: formData.fullName,
            employeeCode: formData.employeeCode,
            designation: formData.designation,
            department: formData.department,
            email: formData.email,
            role: formData.role,
            isActive: formData.status === 'Active',
            joiningDate: formData.joiningDate,
            personalDetails: {
                dateOfBirth:   formData.dateOfBirth,
                gender:        formData.gender,
                bloodGroup:    formData.bloodGroup,
                maritalStatus: formData.maritalStatus,
                phoneNumber:      formData.phoneNumber,
                phoneCountryCode: formData.phoneCountryCode,
                alternatePhone:   formData.alternatePhone,
                personalEmail:    formData.personalEmail,
                address: {
                    flat:    formData.addressFlat,
                    area:    formData.addressArea,
                    city:    formData.addressCity,
                    state:   formData.addressState,
                    pincode: formData.addressPincode,
                },
                emergencyContactName:         formData.emergencyContactName,
                emergencyContactNumber:       formData.emergencyContactNumber,
                emergencyContactCountryCode:  formData.emergencyContactCountryCode,
                emergencyContactRelationship: formData.emergencyContactRelationship,
                emergencyContactEmail:        formData.emergencyContactEmail,
            },
            identityDetails: {
                aadhaarNumber:   formData.aadhaarNumber,
                panCardNumber:   formData.panCardNumber,
                bankName:        formData.bankName,
                accountNumber:   formData.accountNumber,
                ifscCode:        formData.ifscCode,
                bankBranch:      formData.bankBranch,
                uanNumber:       formData.uanNumber,
                pfAccountNumber: formData.pfAccountNumber,
            },
            reportingPerson: formData.reportingPersonId || null
        };

        if (!payload.joiningDate) {
            delete payload.joiningDate;
        }
        return payload;
    };

    const handleSave = async () => {
        if (!employee?._id) return;
        setSaving(true);
        try {
            await api.put(`/admin/employees/${employee._id}`, buildPayload());
            setSnackbar({ open: true, severity: 'success', message: 'Employee details updated successfully.' });
            setIsEditing(false);
            onSaved?.();
        } catch (error) {
            console.error('Failed to update employee profile:', error);
            setSnackbar({
                open: true,
                severity: 'error',
                message: error.response?.data?.error || 'Unable to save changes. Please try again.'
            });
        } finally {
            setSaving(false);
        }
    };

    const renderValue = (label, value, icon = null) => (
        <Box>
            <Typography 
                variant="caption" 
                sx={{ 
                    color: GREY, 
                    fontWeight: 600, 
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    marginBottom: '8px'
                }}
            >
                {icon && <Box sx={{ fontSize: '14px', color: GREY }}>{icon}</Box>}
                {label}
            </Typography>
            <Typography 
                variant="body1" 
                sx={{ 
                    color: value ? BLACK : '#CBD5E0', 
                    fontWeight: 500,
                    fontSize: '14px',
                    lineHeight: 1.6,
                    fontStyle: value ? 'normal' : 'italic'
                }}
            >
                {value || '—'}
            </Typography>
        </Box>
    );

    const renderField = ({ label, name, type = 'text', select = false, options = [] }) => (
        isEditing ? (
            <TextField
                label={label}
                name={name}
                value={formData[name]}
                onChange={handleChange}
                fullWidth
                sx={textFieldSx}
                type={type}
                select={select}
                InputLabelProps={type === 'date' ? { shrink: true } : undefined}
                inputProps={name === 'phoneNumber' || name === 'emergencyContactNumber' ? { maxLength: 15 } : name === 'addressPincode' ? { maxLength: 10 } : undefined}
                helperText={name === 'phoneNumber' || name === 'emergencyContactNumber' ? `${formData[name].length} digits` : name === 'addressPincode' ? `${formData[name].length} digits` : undefined}
            >
                {select && options.map((option) => (
                    <MenuItem key={option} value={option}>
                        {option}
                    </MenuItem>
                ))}
            </TextField>
        ) : renderValue(label, formData[name])
    );

    const renderPhoneField = ({ label, name, countryCodeName }) => (
        isEditing ? (
            <Stack direction="row" spacing={1}>
                <Box sx={{ minWidth: 180 }}>
                    <CountryCodeSelector
                        value={formData[countryCodeName]}
                        onChange={handleCountryCodeChange(countryCodeName)}
                        label="Country Code"
                    />
                </Box>
                <TextField
                    label={label}
                    name={name}
                    value={formData[name]}
                    onChange={handleChange}
                    fullWidth
                    sx={textFieldSx}
                    inputProps={{ maxLength: 15 }}
                    helperText={`${formData[name].length} digits`}
                />
            </Stack>
        ) : renderValue(label, formData[countryCodeName] ? `${formData[countryCodeName]} ${formData[name]}` : formData[name] || '—')
    );

    return (

        <>
            {/* ── Dialog Shell ── */}
            <Dialog
                open={open}
                onClose={handleClose}
                fullWidth
                maxWidth="md"
                PaperProps={{
                    sx: {
                        borderRadius: '20px',
                        overflow: 'hidden',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.14)'
                    }
                }}
            >
                {/* ── Sticky Header ── */}
                <DialogTitle
                    sx={{
                        px: 4,
                        pt: 3,
                        pb: 2,
                        background: '#fff',
                        borderBottom: `1px solid ${BORDER}`,
                        position: 'sticky',
                        top: 0,
                        zIndex: 10
                    }}
                >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                            <Typography
                                sx={{
                                    color: RED,
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    letterSpacing: '0.12em',
                                    textTransform: 'uppercase',
                                    mb: 0.5
                                }}
                            >
                                Employee Profile
                            </Typography>
                            <Typography variant="h6" fontWeight={800} color={BLACK} lineHeight={1.2}>
                                {isEditing ? 'Edit Details' : 'View Details'}
                            </Typography>
                        </Box>
                        <IconButton
                            onClick={handleClose}
                            size="medium"
                            sx={{
                                color: GREY,
                                transition: 'color 0.2s ease, background 0.2s ease',
                                '&:hover': { color: RED, background: RED_BG }
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>

                <DialogContent sx={{ backgroundColor: '#F8F9FB', px: 4, py: 4 }}>
                    <Stack spacing={3}>

                        {/* ── Profile Hero Card ── */}
                        <Box
                            sx={{
                                ...cardSx,
                                background: 'linear-gradient(135deg, #fff 70%, #FFF5F5 100%)',
                                padding: '28px 32px',
                                borderLeft: `4px solid ${RED}`
                            }}
                        >
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'center', sm: 'flex-start' }}>
                                {/* Avatar */}
                                <Avatar
                                    sx={{
                                        width: 88,
                                        height: 88,
                                        background: `linear-gradient(135deg, ${RED} 0%, ${RED_DARK} 100%)`,
                                        fontSize: '2rem',
                                        fontWeight: 800,
                                        boxShadow: `0 8px 24px rgba(229,57,53,0.35)`,
                                        flexShrink: 0,
                                        border: '3px solid #fff'
                                    }}
                                >
                                    {(employee?.fullName || 'U').charAt(0).toUpperCase()}
                                </Avatar>

                                {/* Info */}
                                <Box flex={1}>
                                    <Typography variant="h5" fontWeight={800} color={BLACK} lineHeight={1.2} mb={0.5}>
                                        {employee?.fullName || '—'}
                                    </Typography>
                                    {employee?.designation && (
                                        <Typography variant="body2" color={GREY} mb={1.5}>
                                            {employee.designation}
                                        </Typography>
                                    )}
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {/* Employee ID badge */}
                                        <Chip
                                            label={employee?.employeeCode || 'N/A'}
                                            size="small"
                                            sx={{
                                                background: '#F1F5F9',
                                                color: '#475569',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                border: `1px solid ${BORDER}`,
                                                borderRadius: '8px'
                                            }}
                                        />
                                        {/* Role badge */}
                                        <Chip
                                            label={employee?.role || 'Employee'}
                                            size="small"
                                            sx={{
                                                background: RED_BG,
                                                color: RED,
                                                fontWeight: 700,
                                                fontSize: '12px',
                                                border: `1px solid #FBBCBC`,
                                                borderRadius: '8px',
                                                transition: 'transform 0.15s ease',
                                                '&:hover': { transform: 'scale(1.04)' }
                                            }}
                                        />
                                        {/* Status badge */}
                                        <Chip
                                            label={employee?.isActive === false ? 'Inactive' : 'Active'}
                                            size="small"
                                            sx={{
                                                background: employee?.isActive === false ? '#FEF2F2' : '#F0FDF4',
                                                color: employee?.isActive === false ? '#DC2626' : '#16A34A',
                                                fontWeight: 700,
                                                fontSize: '12px',
                                                border: `1px solid ${employee?.isActive === false ? '#FECACA' : '#BBF7D0'}`,
                                                borderRadius: '8px',
                                                transition: 'transform 0.15s ease',
                                                '&:hover': { transform: 'scale(1.04)' }
                                            }}
                                        />
                                    </Stack>
                                </Box>
                            </Stack>
                        </Box>

                        {/* ── CIF Summary Card - Admin/HR Only ── */}
                        {(user?.role === 'Admin' || user?.role === 'HR') && employee?._id && (
                            <CIFSummaryCard employeeId={employee._id} />
                        )}

                        {/* ── Reporting Person ── */}
                        <Box sx={cardSx}>
                            <Typography sx={sectionTitleSx}>
                                <PersonIcon sx={{ fontSize: 18, color: RED }} />
                                Reporting Person
                            </Typography>
                            <Box sx={redAccentLineSx} />

                            {isEditing && (
                                <Box mb={2.5}>
                                    <Autocomplete
                                        options={reportingOptions}
                                        loading={reportingOptionsLoading}
                                        value={selectedReportingOption}
                                        onChange={handleReportingSelection}
                                        getOptionLabel={(option) => option?.fullName ? `${option.fullName}${option.employeeCode ? ` (${option.employeeCode})` : ''}` : ''}
                                        isOptionEqualToValue={(option, value) => option?._id === value?._id}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Select Existing Employee"
                                                placeholder="Search by name"
                                                sx={textFieldSx}
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (
                                                        <>
                                                            {reportingOptionsLoading ? <SkeletonBox width="20px" height="20px" borderRadius="50%" /> : null}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    )
                                                }}
                                            />
                                        )}
                                    />
                                </Box>
                            )}

                            {!isEditing && !employee?.reportingPerson?.fullName ? (
                                <Box
                                    sx={{
                                        textAlign: 'center',
                                        py: 3,
                                        color: GREY,
                                        fontStyle: 'italic',
                                        fontSize: '14px'
                                    }}
                                >
                                    No Reporting Manager Assigned
                                </Box>
                            ) : (
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={4}>
                                        {isEditing
                                            ? renderField({ label: 'Reporting Person Name', name: 'reportingPersonName' })
                                            : renderValue('Name', employee?.reportingPerson?.fullName, <PersonIcon sx={{ fontSize: 13 }} />)
                                        }
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        {isEditing
                                            ? renderField({ label: 'Reporting Person Email', name: 'reportingPersonEmail', type: 'email' })
                                            : renderValue('Email', employee?.reportingPerson?.email, <EmailIcon sx={{ fontSize: 13 }} />)
                                        }
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        {isEditing
                                            ? renderField({ label: 'Reporting Person Department', name: 'reportingPersonDepartment' })
                                            : renderValue('Department', employee?.reportingPerson?.department, <BusinessIcon sx={{ fontSize: 13 }} />)
                                        }
                                    </Grid>
                                </Grid>
                            )}
                        </Box>

                        {/* ── Section 1: Basic Info ── */}
                        <Box sx={cardSx}>
                            <Typography sx={sectionTitleSx}>
                                <PersonIcon sx={{ fontSize: 18, color: RED }} />
                                Basic Info
                            </Typography>
                            <Box sx={redAccentLineSx} />
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Full Name', name: 'fullName' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Employee ID', name: 'employeeCode' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Designation', name: 'designation' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Department', name: 'department' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Email', name: 'email', type: 'email' })}</Grid>
                                <Grid item xs={12} md={6}>
                                    {isEditing
                                        ? renderField({ label: 'Role', name: 'role', select: true, options: roles })
                                        : (
                                            <Box>
                                                <Typography sx={{ color: GREY, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '10px', mb: 1 }}>Role</Typography>
                                                <Chip
                                                    label={formData.role || '—'}
                                                    size="small"
                                                    sx={{ background: RED_BG, color: RED, fontWeight: 700, border: `1px solid #FBBCBC`, borderRadius: '8px' }}
                                                />
                                            </Box>
                                        )
                                    }
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    {isEditing
                                        ? renderField({ label: 'Status', name: 'status', select: true, options: statusOptions })
                                        : (
                                            <Box>
                                                <Typography sx={{ color: GREY, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '10px', mb: 1 }}>Status</Typography>
                                                <Chip
                                                    label={formData.status || '—'}
                                                    size="small"
                                                    sx={{
                                                        background: formData.status === 'Active' ? '#F0FDF4' : '#FEF2F2',
                                                        color: formData.status === 'Active' ? '#16A34A' : '#DC2626',
                                                        fontWeight: 700,
                                                        border: `1px solid ${formData.status === 'Active' ? '#BBF7D0' : '#FECACA'}`,
                                                        borderRadius: '8px'
                                                    }}
                                                />
                                            </Box>
                                        )
                                    }
                                </Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Joining Date', name: 'joiningDate', type: 'date' })}</Grid>
                            </Grid>
                        </Box>

                        {/* ── Section 2: Personal Details ── */}
                        <Box sx={cardSx}>
                            <Typography sx={sectionTitleSx}>
                                <WcIcon sx={{ fontSize: 18, color: RED }} />
                                Personal Details
                            </Typography>
                            <Box sx={redAccentLineSx} />
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Date of Birth', name: 'dateOfBirth', type: 'date' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Gender', name: 'gender', select: true, options: ['Male', 'Female', 'Other'] })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Blood Group', name: 'bloodGroup' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Marital Status', name: 'maritalStatus', select: true, options: ['Single', 'Married', 'Divorced', 'Widowed'] })}</Grid>
                                <Grid item xs={12} md={6}>{renderPhoneField({ label: 'Phone Number', name: 'phoneNumber', countryCodeName: 'phoneCountryCode' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Alternate Phone', name: 'alternatePhone' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Personal Email', name: 'personalEmail', type: 'email' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Emergency Contact Name', name: 'emergencyContactName' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Relationship', name: 'emergencyContactRelationship' })}</Grid>
                                <Grid item xs={12} md={6}>{renderPhoneField({ label: 'Emergency Contact Number', name: 'emergencyContactNumber', countryCodeName: 'emergencyContactCountryCode' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Emergency Contact Email', name: 'emergencyContactEmail', type: 'email' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Flat / House', name: 'addressFlat' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Area / Street', name: 'addressArea' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'City', name: 'addressCity' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'State', name: 'addressState' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Pincode', name: 'addressPincode' })}</Grid>
                            </Grid>
                        </Box>

                        {/* ── Section 3: Identity & Bank Details ── */}
                        <Box sx={cardSx}>
                            <Typography sx={sectionTitleSx}>
                                <BusinessIcon sx={{ fontSize: 18, color: RED }} />
                                Identity &amp; Bank Details
                            </Typography>
                            <Box sx={redAccentLineSx} />
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Aadhaar Number', name: 'aadhaarNumber' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'PAN Card Number', name: 'panCardNumber' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Bank Name', name: 'bankName' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Account Number', name: 'accountNumber' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'IFSC Code', name: 'ifscCode' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Branch Name', name: 'bankBranch' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'UAN Number', name: 'uanNumber' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'PF Account Number', name: 'pfAccountNumber' })}</Grid>
                            </Grid>
                        </Box>

                    </Stack>
                </DialogContent>

                {/* ── Footer Actions ── */}
                <DialogActions
                    sx={{
                        px: 4,
                        py: 2.5,
                        background: '#fff',
                        borderTop: `1px solid ${BORDER}`,
                        gap: 1.5
                    }}
                >
                    {onOpenAdvancedEditor && (
                        <Button
                            variant="text"
                            onClick={onOpenAdvancedEditor}
                            disabled={saving}
                            sx={{
                                mr: 'auto',
                                color: GREY,
                                fontWeight: 600,
                                fontSize: '14px',
                                textTransform: 'none',
                                transition: 'color 0.2s ease',
                                '&:hover': { color: RED, background: 'transparent' }
                            }}
                        >
                            Advanced Editor
                        </Button>
                    )}
                    {isEditing ? (
                        <>
                            <Button
                                variant="outlined"
                                onClick={handleReset}
                                disabled={saving}
                                sx={{
                                    borderRadius: '50px',
                                    borderColor: BORDER,
                                    color: GREY,
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    px: 3,
                                    '&:hover': { borderColor: RED, color: RED, background: RED_BG }
                                }}
                            >
                                Reset
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSave}
                                disabled={saving}
                                sx={{
                                    background: `linear-gradient(135deg, ${RED} 0%, ${RED_DARK} 100%)`,
                                    borderRadius: '50px',
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    px: 4,
                                    minWidth: 130,
                                    boxShadow: `0 4px 14px rgba(229,57,53,0.4)`,
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        background: `linear-gradient(135deg, ${RED_DARK} 0%, #B71C1C 100%)`,
                                        boxShadow: `0 6px 20px rgba(229,57,53,0.5)`,
                                        transform: 'translateY(-1px)'
                                    }
                                }}
                            >
                                {saving ? <SkeletonBox width="22px" height="22px" borderRadius="50%" /> : 'Save Changes'}
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="contained"
                            onClick={() => setIsEditing(true)}
                            sx={{
                                background: `linear-gradient(135deg, ${RED} 0%, ${RED_DARK} 100%)`,
                                borderRadius: '50px',
                                fontWeight: 700,
                                textTransform: 'none',
                                px: 4,
                                minWidth: 130,
                                boxShadow: `0 4px 14px rgba(229,57,53,0.4)`,
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    background: `linear-gradient(135deg, ${RED_DARK} 0%, #B71C1C 100%)`,
                                    boxShadow: `0 6px 20px rgba(229,57,53,0.5)`,
                                    transform: 'translateY(-1px)'
                                }
                            }}
                        >
                            Edit Details
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%', borderRadius: '12px' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default AdminEmployeeProfileDialog;
