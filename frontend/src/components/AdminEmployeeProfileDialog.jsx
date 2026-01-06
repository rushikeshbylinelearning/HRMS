import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    Grid,
    Stack,
    Avatar,
    Chip,
    TextField,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    IconButton,
    MenuItem,
    Autocomplete
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CountryCodeSelector from './CountryCodeSelector';
import api from '../api/axios';

const roles = ['Admin', 'HR', 'Employee', 'Intern'];
const statusOptions = ['Active', 'Inactive'];

const cardSx = {
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
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
    bloodGroup: '',
    phoneNumber: '',
    phoneCountryCode: '+91',
    emergencyContactName: '',
    emergencyContactNumber: '',
    emergencyContactCountryCode: '+91',
    personalEmail: '',
    addressFlat: '',
    addressArea: '',
    addressCity: '',
    addressState: '',
    addressPincode: '',
    aadhaarNumber: '',
    panCardNumber: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    reportingPersonName: '',
    reportingPersonEmail: '',
    reportingPersonDepartment: ''
};

const AdminEmployeeProfileDialog = ({
    open,
    mode = 'view',
    employee = null,
    onClose,
    onSaved,
    onOpenAdvancedEditor
}) => {
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
        bloodGroup: data?.personalDetails?.bloodGroup || '',
        phoneNumber: data?.personalDetails?.phoneNumber || '',
        phoneCountryCode: data?.personalDetails?.phoneCountryCode || '+91',
        emergencyContactName: data?.personalDetails?.emergencyContactName || '',
        emergencyContactNumber: data?.personalDetails?.emergencyContactNumber || '',
        emergencyContactCountryCode: data?.personalDetails?.emergencyContactCountryCode || '+91',
        personalEmail: data?.personalDetails?.personalEmail || '',
        addressFlat: data?.personalDetails?.address?.flat || '',
        addressArea: data?.personalDetails?.address?.area || '',
        addressCity: data?.personalDetails?.address?.city || '',
        addressState: data?.personalDetails?.address?.state || '',
        addressPincode: data?.personalDetails?.address?.pincode || '',
        aadhaarNumber: data?.identityDetails?.aadhaarNumber || '',
        panCardNumber: data?.identityDetails?.panCardNumber || '',
        bankName: data?.identityDetails?.bankName || '',
        accountNumber: data?.identityDetails?.accountNumber || '',
        ifscCode: data?.identityDetails?.ifscCode || '',
        reportingPersonName: data?.reportingPerson?.name || '',
        reportingPersonEmail: data?.reportingPerson?.email || '',
        reportingPersonDepartment: data?.reportingPerson?.department || ''
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
        const match =
            reportingOptions.find(opt => employee.reportingPerson?.email && opt.email === employee.reportingPerson.email) ||
            reportingOptions.find(opt => employee.reportingPerson?.name && opt.fullName === employee.reportingPerson.name);
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
                reportingPersonName: newValue.fullName || '',
                reportingPersonEmail: newValue.email || '',
                reportingPersonDepartment: newValue.department || ''
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
                bloodGroup: formData.bloodGroup,
                phoneNumber: formData.phoneNumber,
                phoneCountryCode: formData.phoneCountryCode,
                emergencyContactName: formData.emergencyContactName,
                emergencyContactNumber: formData.emergencyContactNumber,
                emergencyContactCountryCode: formData.emergencyContactCountryCode,
                personalEmail: formData.personalEmail,
                address: {
                    flat: formData.addressFlat,
                    area: formData.addressArea,
                    city: formData.addressCity,
                    state: formData.addressState,
                    pincode: formData.addressPincode
                }
            },
            identityDetails: {
                aadhaarNumber: formData.aadhaarNumber,
                panCardNumber: formData.panCardNumber,
                bankName: formData.bankName,
                accountNumber: formData.accountNumber,
                ifscCode: formData.ifscCode
            },
            reportingPerson: {
                name: formData.reportingPersonName,
                email: formData.reportingPersonEmail,
                department: formData.reportingPersonDepartment
            }
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

    const renderValue = (label, value) => (
        <Box>
            <Typography variant="caption" sx={{ color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>
                {label}
            </Typography>
            <Typography variant="body1" sx={{ color: '#222', fontWeight: 600, mt: 0.5 }}>
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
            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: '24px' } }}>
                <DialogTitle sx={{ px: 4, pt: 3, pb: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                            <Typography variant="overline" sx={{ color: '#E53935', letterSpacing: 1 }}>
                                Employee Profile
                            </Typography>
                            <Typography variant="h6" fontWeight={700}>
                                {isEditing ? 'Edit Details' : 'View Details'}
                            </Typography>
                        </Box>
                        <IconButton onClick={handleClose} size="large">
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>
                <DialogContent dividers sx={{ backgroundColor: '#f9fafb', px: 4, py: 4 }}>
                    <Stack spacing={3}>
                        <Box sx={{ ...cardSx, padding: '24px 28px' }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
                                <Avatar
                                    src={employee?.profileImageUrl}
                                    alt={employee?.fullName}
                                    sx={{
                                        width: 96,
                                        height: 96,
                                        bgcolor: '#E53935',
                                        fontSize: '1.75rem',
                                        fontWeight: 700
                                    }}
                                >
                                    {(employee?.fullName || 'U').charAt(0)}
                                </Avatar>
                                <Box>
                                    <Typography variant="h5" fontWeight={700} color="#222">
                                        {employee?.fullName}
                                    </Typography>
                                    <Stack direction="row" spacing={1.5} mt={1.5} flexWrap="wrap">
                                        <Chip label={employee?.employeeCode || 'N/A'} color="primary" variant="outlined" />
                                        <Chip label={employee?.role || 'Employee'} sx={{ background: '#FDEAEA', color: '#E53935' }} />
                                        <Chip
                                            label={employee?.isActive === false ? 'Inactive' : 'Active'}
                                            color={employee?.isActive === false ? 'error' : 'success'}
                                            variant="outlined"
                                        />
                                    </Stack>
                                </Box>
                            </Stack>
                        </Box>

                        <Box sx={cardSx}>
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                Reporting Person
                            </Typography>
                            <Stack spacing={2} mb={isEditing ? 2 : 0}>
                                {isEditing && (
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
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (
                                                        <>
                                                            {reportingOptionsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    )
                                                }}
                                            />
                                        )}
                                    />
                                )}
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={4}>{renderField({ label: 'Reporting Person Name', name: 'reportingPersonName' })}</Grid>
                                    <Grid item xs={12} md={4}>{renderField({ label: 'Reporting Person Email', name: 'reportingPersonEmail', type: 'email' })}</Grid>
                                    <Grid item xs={12} md={4}>{renderField({ label: 'Reporting Person Department', name: 'reportingPersonDepartment' })}</Grid>
                                </Grid>
                            </Stack>
                        </Box>

                        <Box sx={cardSx}>
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                Section 1 — Basic Info
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Full Name', name: 'fullName' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Employee ID', name: 'employeeCode' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Designation', name: 'designation' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Department', name: 'department' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Email', name: 'email', type: 'email' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Role', name: 'role', select: true, options: roles })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Status', name: 'status', select: true, options: statusOptions })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Joining Date', name: 'joiningDate', type: 'date' })}</Grid>
                            </Grid>
                        </Box>

                        <Box sx={cardSx}>
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                Section 2 — Personal Details
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Blood Group', name: 'bloodGroup' })}</Grid>
                                <Grid item xs={12} md={6}>{renderPhoneField({ label: 'Phone Number', name: 'phoneNumber', countryCodeName: 'phoneCountryCode' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Emergency Contact Name', name: 'emergencyContactName' })}</Grid>
                                <Grid item xs={12} md={6}>{renderPhoneField({ label: 'Emergency Contact Number', name: 'emergencyContactNumber', countryCodeName: 'emergencyContactCountryCode' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Personal Email', name: 'personalEmail', type: 'email' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Flat / House', name: 'addressFlat' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Area / Street', name: 'addressArea' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'City', name: 'addressCity' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'State', name: 'addressState' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Pincode', name: 'addressPincode' })}</Grid>
                            </Grid>
                        </Box>

                        <Box sx={cardSx}>
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                Section 3 — Identity & Bank Details
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Aadhaar Number', name: 'aadhaarNumber' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'PAN Card Number', name: 'panCardNumber' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Bank Name', name: 'bankName' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'Account Number', name: 'accountNumber' })}</Grid>
                                <Grid item xs={12} md={6}>{renderField({ label: 'IFSC Code', name: 'ifscCode' })}</Grid>
                            </Grid>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 4, py: 3, gap: 1.5 }}>
                    {onOpenAdvancedEditor && (
                        <Button variant="text" onClick={onOpenAdvancedEditor} disabled={saving} sx={{ mr: 'auto' }}>
                            Advanced Editor
                        </Button>
                    )}
                    {isEditing ? (
                        <>
                            <Button
                                variant="outlined"
                                onClick={handleReset}
                                disabled={saving}
                                sx={{ borderRadius: '12px' }}
                            >
                                Reset
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSave}
                                disabled={saving}
                                sx={{
                                    backgroundColor: '#E53935',
                                    borderRadius: '12px',
                                    minWidth: 140,
                                    '&:hover': { backgroundColor: '#d32f2f' }
                                }}
                            >
                                {saving ? <CircularProgress size={22} color="inherit" /> : 'Save'}
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="contained"
                            onClick={() => setIsEditing(true)}
                            sx={{
                                backgroundColor: '#E53935',
                                borderRadius: '12px',
                                minWidth: 140,
                                '&:hover': { backgroundColor: '#d32f2f' }
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
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default AdminEmployeeProfileDialog;

