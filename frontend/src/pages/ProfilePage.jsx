import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
    Box,
    Container,
    Typography,
    Avatar,
    Grid,
    Stack,
    TextField,
    Button,
    Snackbar,
    Alert,
    CircularProgress,
    Chip,
    IconButton,
} from '@mui/material';
import { PhotoCamera, Delete } from '@mui/icons-material';
import PageHeroHeader from '../components/PageHeroHeader';
import SoundSettings from '../components/SoundSettings';
import CountryCodeSelector from '../components/CountryCodeSelector';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { getAvatarUrl } from '../utils/avatarUtils';
import '../styles/ProfilePage.css';

const defaultFormState = {
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
    ifscCode: ''
};

const cardBaseSx = {
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

const ProfileSectionCard = ({ title, subtitle, children, sx = {} }) => (
    <Box sx={{ ...cardBaseSx, ...sx }}>
        <Stack spacing={1.5} mb={3}>
            <Typography variant="h6" fontWeight={700} color="#222">
                {title}
            </Typography>
            {subtitle && (
                <Typography variant="body2" color="text.secondary">
                    {subtitle}
                </Typography>
            )}
        </Stack>
        {children}
    </Box>
);

ProfileSectionCard.propTypes = {
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    children: PropTypes.node.isRequired,
    sx: PropTypes.object
};

const ProfilePage = () => {
    const { user, refreshUserData, updateUserContext } = useAuth();
    const [profileOverview, setProfileOverview] = useState(null);
    const [formData, setFormData] = useState(defaultFormState);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success', autoHideDuration: 4000 });
    const [uploading, setUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null); // Store the selected file
    const [imageVersion, setImageVersion] = useState(0); // Track image updates for cache busting
    const fileInputRef = useRef(null);

    const formatDate = useMemo(() => (dateString) => {
        if (!dateString) return 'Not specified';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }, []);

    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    const mapProfileToForm = useCallback((profile) => ({
        bloodGroup: profile?.personalDetails?.bloodGroup || '',
        phoneNumber: profile?.personalDetails?.phoneNumber || '',
        phoneCountryCode: profile?.personalDetails?.phoneCountryCode || '+91',
        emergencyContactName: profile?.personalDetails?.emergencyContactName || '',
        emergencyContactNumber: profile?.personalDetails?.emergencyContactNumber || '',
        emergencyContactCountryCode: profile?.personalDetails?.emergencyContactCountryCode || '+91',
        personalEmail: profile?.personalDetails?.personalEmail || '',
        addressFlat: profile?.personalDetails?.address?.flat || '',
        addressArea: profile?.personalDetails?.address?.area || '',
        addressCity: profile?.personalDetails?.address?.city || '',
        addressState: profile?.personalDetails?.address?.state || '',
        addressPincode: profile?.personalDetails?.address?.pincode || '',
        aadhaarNumber: profile?.identityDetails?.aadhaarNumber || '',
        panCardNumber: profile?.identityDetails?.panCardNumber || '',
        bankName: profile?.identityDetails?.bankName || '',
        accountNumber: profile?.identityDetails?.accountNumber || '',
        ifscCode: profile?.identityDetails?.ifscCode || ''
    }), []);

    const loadProfile = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Use existing user data from AuthContext instead of making a separate API call
            // This avoids calling non-existent endpoints and reduces unnecessary requests
            const profileData = {
                _id: user._id,
                fullName: user.fullName,
                employeeCode: user.employeeCode,
                email: user.email,
                role: user.role,
                designation: user.designation,
                department: user.department,
                joiningDate: user.joiningDate,
                profileImageUrl: user.profileImageUrl,
                personalDetails: user.personalDetails || {},
                identityDetails: user.identityDetails || {},
                reportingPerson: user.reportingPerson || {},
                shiftGroup: user.shiftGroup
            };
            setProfileOverview(profileData);
            setFormData(mapProfileToForm(profileData));
        } catch (error) {
            console.warn('Failed to initialize profile from user data:', error);
            // Fallback: use user data directly if mapping fails
            setProfileOverview(user);
            setFormData(mapProfileToForm(user));
        } finally {
            setLoading(false);
        }
    }, [user, mapProfileToForm]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    // Validation functions
    const validateAadhaar = (value) => {
        // Aadhaar should be exactly 12 digits
        const digitsOnly = value.replace(/\D/g, '');
        return digitsOnly.slice(0, 12);
    };

    const validatePAN = (value) => {
        // PAN format: 5 letters (uppercase), 4 digits, 1 letter (uppercase)
        // Remove spaces and convert to uppercase
        const cleaned = value.replace(/\s/g, '').toUpperCase();
        // Only allow alphanumeric
        const alphanumeric = cleaned.replace(/[^A-Z0-9]/g, '');
        // Limit to 10 characters
        return alphanumeric.slice(0, 10);
    };

    const validatePhoneNumber = (value) => {
        // Phone number should only contain digits
        const digitsOnly = value.replace(/\D/g, '');
        // Limit to 15 digits (international standard)
        return digitsOnly.slice(0, 15);
    };

    const validatePincode = (value) => {
        // Pincode should only contain digits
        const digitsOnly = value.replace(/\D/g, '');
        // Limit to 10 digits (to support international pincodes)
        return digitsOnly.slice(0, 10);
    };

    const handleFieldChange = (event) => {
        const { name, value } = event.target;
        let processedValue = value;

        // Apply validation based on field type
        if (name === 'aadhaarNumber') {
            processedValue = validateAadhaar(value);
        } else if (name === 'panCardNumber') {
            processedValue = validatePAN(value);
        } else if (name === 'phoneNumber' || name === 'emergencyContactNumber') {
            processedValue = validatePhoneNumber(value);
        } else if (name === 'addressPincode') {
            processedValue = validatePincode(value);
        }

        setFormData((prev) => ({ ...prev, [name]: processedValue }));
    };

    const handleCountryCodeChange = (fieldName) => (event) => {
        setFormData((prev) => ({ ...prev, [fieldName]: event.target.value }));
    };

    // File validation constants
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

    // Validate file before upload
    const validateFile = (file) => {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return { valid: false, error: 'File size must be less than 2MB.' };
        }

        // Check file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return { valid: false, error: 'Only JPG, JPEG, PNG, and WEBP images are allowed.' };
        }

        // Check file extension
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
            return { valid: false, error: 'Invalid file extension. Only .jpg, .jpeg, .png, and .webp are allowed.' };
        }

        return { valid: true };
    };

    // Handle file selection
    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            setSelectedFile(null);
            setPreviewImage(null);
            return;
        }

        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
            setSnackbar({ open: true, severity: 'error', message: validation.error });
            // Reset file input and state
            setSelectedFile(null);
            setPreviewImage(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        // Store the file in state
        setSelectedFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewImage(reader.result);
        };
        reader.readAsDataURL(file);
    };

    // Handle image upload
    const handleImageUpload = async () => {
        // Use the stored file from state instead of file input
        const file = selectedFile || fileInputRef.current?.files?.[0];
        
        console.log('Upload attempt - file check:', {
            hasSelectedFile: !!selectedFile,
            hasFileInputFile: !!fileInputRef.current?.files?.[0],
            hasFile: !!file,
            fileInfo: file ? { name: file.name, size: file.size, type: file.type } : null
        });
        
        if (!file) {
            setSnackbar({ open: true, severity: 'error', message: 'Please select an image to upload.' });
            return;
        }

        // Validate file again (client-side)
        const validation = validateFile(file);
        if (!validation.valid) {
            setSnackbar({ open: true, severity: 'error', message: validation.error });
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('profileImage', file);
            
            // Verify FormData contents
            console.log('Uploading file:', {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            });
            
            // Log FormData entries for debugging
            console.log('FormData entries:');
            for (let pair of formData.entries()) {
                console.log(pair[0] + ': ', pair[1]);
            }

            // Don't set Content-Type header - axios will set it automatically with boundary for FormData
            const response = await api.post('/users/upload-avatar', formData, {
                headers: {
                    // Let axios set Content-Type automatically for FormData
                },
                // Ensure FormData is sent correctly
                transformRequest: [(data) => data], // Don't transform FormData
            });

            console.log('Upload response:', response.data);

            if (!response.data) {
                throw new Error('No response data received from server');
            }

            // Store the new image URL from response
            const newImageUrl = response.data?.imageUrl;
            const imageUpdateTimestamp = Date.now(); // Timestamp for cache-busting
            
            // Update local state immediately with the new image URL
            if (newImageUrl) {
                setProfileOverview(prev => ({
                    ...prev,
                    profileImageUrl: newImageUrl,
                    profileImageUpdatedAt: imageUpdateTimestamp
                }));
                // Increment image version to force cache refresh
                setImageVersion(prev => prev + 1);
            }

            // Update AuthContext user state immediately with new image URL and timestamp
            // This ensures all components (Topbar, Dashboard, etc.) update instantly
            if (newImageUrl && user) {
                updateUserContext({
                    ...user,
                    profileImageUrl: newImageUrl,
                    profileImageUpdatedAt: imageUpdateTimestamp
                });
            }

            // Refresh user data in AuthContext to sync with backend
            // This ensures we have the latest data from server, but UI already updated above
            try {
                const updatedUser = await refreshUserData();
                // Merge server data but preserve our timestamp for cache-busting
                if (newImageUrl && updatedUser) {
                    updateUserContext({
                        ...updatedUser,
                        profileImageUrl: newImageUrl,
                        profileImageUpdatedAt: imageUpdateTimestamp
                    });
                    setProfileOverview(prev => ({
                        ...prev,
                        ...updatedUser,
                        profileImageUrl: newImageUrl,
                        profileImageUpdatedAt: imageUpdateTimestamp
                    }));
                }
            } catch (refreshError) {
                // If refresh fails, we still have the image URL and timestamp from upload response
                // UI is already updated, so this is not critical
                console.warn('Profile refresh skipped after upload:', refreshError.message);
            }
            
            // Clear preview, selected file, and file input after successful upload
            setPreviewImage(null);
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            // Show success message
            setSnackbar({ 
                open: true, 
                severity: 'success', 
                message: response.data?.message || 'Profile image uploaded successfully!' 
            });
        } catch (error) {
            console.error('Image upload failed:', error);
            console.error('Full error object:', error);
            console.error('Error response data:', error.response?.data);
            console.error('Error response status:', error.response?.status);
            console.error('Error response headers:', error.response?.headers);
            console.error('Request config:', error.config);
            
            // Don't clear preview on error - let user retry
            // Extract error message from response
            let errorMessage = 'Failed to upload image. Please try again.';
            let errorSeverity = 'error';
            
            if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
                
                // Check if it's a file size error for special handling
                if (error.response.data.code === 'FILE_SIZE_EXCEEDED' || 
                    errorMessage.toLowerCase().includes('file size') || 
                    errorMessage.toLowerCase().includes('too large')) {
                    errorMessage = `⚠️ ${errorMessage}`;
                    // Keep snackbar open longer for file size errors
                }
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            console.error('Final error message to display:', errorMessage);
            
            // Determine auto-hide duration based on error type
            const autoHideDuration = (error.response?.data?.code === 'FILE_SIZE_EXCEEDED' || 
                                     errorMessage.toLowerCase().includes('file size')) 
                ? 6000 // 6 seconds for file size errors
                : 4000; // 4 seconds for other errors
            
            setSnackbar({ 
                open: true, 
                severity: errorSeverity, 
                message: errorMessage,
                autoHideDuration: autoHideDuration
            });
        } finally {
            setUploading(false);
        }
    };

    // Handle remove image
    const handleRemoveImage = () => {
        setPreviewImage(null);
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
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
                }
            };

            const { data } = await api.put('/user/update-profile', payload);
            setProfileOverview(data.user);
            setFormData(mapProfileToForm(data.user));
            await refreshUserData();
            setSnackbar({ open: true, severity: 'success', message: 'Profile updated successfully.' });
        } catch (error) {
            console.error('Profile update failed:', error);
            setSnackbar({
                open: true,
                severity: 'error',
                message: error.response?.data?.error || 'Unable to save profile. Try again.'
            });
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <Box className="profile-page-container">
                <Container maxWidth="sm" className="profile-page-content">
                    <Alert severity="error">Unable to load user profile.</Alert>
                </Container>
            </Box>
        );
    }

    const overview = profileOverview || user;
    const reportingPerson = overview?.reportingPerson || {};
    
    // Debug: Log current image URL state
    useEffect(() => {
        console.log('Current avatar state:', {
            previewImage: !!previewImage,
            overviewImageUrl: overview?.profileImageUrl,
            userImageUrl: user?.profileImageUrl,
            imageVersion: imageVersion,
            profileImageUpdatedAt: overview?.profileImageUpdatedAt || user?.profileImageUpdatedAt
        });
    }, [previewImage, overview?.profileImageUrl, user?.profileImageUrl, imageVersion, overview?.profileImageUpdatedAt, user?.profileImageUpdatedAt]);

    return (
        <Box className="profile-page-container">
            <Container maxWidth="lg" className="profile-page-content">
                <PageHeroHeader
                    eyebrow="Employee Profile"
                    title="Manage Your Personal Data"
                    description="Keep your contact, emergency, and banking information up to date."
                    align="center"
                />

                <Stack spacing={3}>
                    <Box sx={cardBaseSx}>
                        <Grid container spacing={3} alignItems="center">
                            <Grid item xs={12} sm="auto" sx={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center' }}>
                                <Box sx={{ position: 'relative', mb: 2 }}>
                                    <Avatar
                                        src={previewImage || (() => {
                                            const avatarUrl = getAvatarUrl(overview?.profileImageUrl || user?.profileImageUrl);
                                            // Use timestamp from user state for cache-busting, fallback to imageVersion
                                            const cacheBuster = overview?.profileImageUpdatedAt || user?.profileImageUpdatedAt || imageVersion;
                                            return avatarUrl ? `${avatarUrl}?v=${cacheBuster}` : null;
                                        })()}
                                        alt={overview?.fullName || user?.fullName}
                                        key={`avatar-${overview?.profileImageUpdatedAt || user?.profileImageUpdatedAt || imageVersion}-${overview?.profileImageUrl || user?.profileImageUrl || 'no-image'}`}
                                        sx={{
                                            width: 140,
                                            height: 140,
                                            bgcolor: '#E53935',
                                            fontSize: '2.75rem',
                                            fontWeight: 700,
                                            border: '3px solid #fff',
                                            boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                                            objectFit: 'cover'
                                        }}
                                        imgProps={{
                                            onError: (e) => {
                                                console.error('Avatar image failed to load:', e.target.src);
                                                console.error('Image path was:', overview?.profileImageUrl || user?.profileImageUrl);
                                                // Don't hide the avatar - fallback to initials will show
                                            },
                                            onLoad: () => {
                                                console.log('Avatar image loaded successfully');
                                            },
                                            crossOrigin: 'anonymous'
                                        }}
                                    >
                                        {!previewImage && !getAvatarUrl(overview?.profileImageUrl || user?.profileImageUrl) && getInitials(overview?.fullName || user?.fullName || '')}
                                    </Avatar>
                                    {previewImage && (
                                        <IconButton
                                            onClick={handleRemoveImage}
                                            sx={{
                                                position: 'absolute',
                                                top: -8,
                                                right: -8,
                                                bgcolor: '#E53935',
                                                color: 'white',
                                                '&:hover': { bgcolor: '#d32f2f' },
                                                width: 32,
                                                height: 32
                                            }}
                                        >
                                            <Delete fontSize="small" />
                                        </IconButton>
                                    )}
                                </Box>
                                <Stack spacing={1} sx={{ width: '100%', maxWidth: 300 }}>
                                    <input
                                        ref={fileInputRef}
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        style={{ display: 'none' }}
                                        id="profile-image-upload"
                                        type="file"
                                        onChange={handleFileSelect}
                                    />
                                    <label htmlFor="profile-image-upload">
                                        <Button
                                            variant="outlined"
                                            component="span"
                                            startIcon={<PhotoCamera />}
                                            disabled={uploading}
                                            fullWidth
                                            sx={{
                                                borderColor: '#E53935',
                                                color: '#E53935',
                                                '&:hover': {
                                                    borderColor: '#d32f2f',
                                                    backgroundColor: 'rgba(229, 57, 53, 0.04)'
                                                }
                                            }}
                                        >
                                            {previewImage ? 'Change Image' : 'Upload Image'}
                                        </Button>
                                    </label>
                                    {previewImage && (
                                        <Button
                                            variant="contained"
                                            onClick={handleImageUpload}
                                            disabled={uploading}
                                            fullWidth
                                            sx={{
                                                backgroundColor: '#E53935',
                                                '&:hover': { backgroundColor: '#d32f2f' }
                                            }}
                                        >
                                            {uploading ? <CircularProgress size={20} color="inherit" /> : 'Save Image'}
                                        </Button>
                                    )}
                                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mt: 0.5 }}>
                                        Max 2MB • JPG, PNG, WEBP
                                    </Typography>
                                </Stack>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Stack spacing={1} sx={{ textAlign: 'center' }}>
                                    <Typography variant="h5" fontWeight={700}>
                                        {overview?.fullName || '—'}
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary">
                                        {overview?.designation || 'Not specified'}
                                    </Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ justifyContent: 'center' }}>
                                        <Chip label={overview?.employeeCode || 'N/A'} size="small" variant="outlined" />
                                        <Chip label={overview?.role || 'Employee'} size="small" color="error" />
                                    </Stack>
                                </Stack>
                            </Grid>
                            <Grid item xs={12} sm="auto">
                                <Stack spacing={2} sx={{ textAlign: 'center' }}>
                                    <Box>
                                        <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 600, color: '#666', display: 'block', mb: 0.5 }}>Department</Typography>
                                        <Typography variant="subtitle1" fontWeight={600}>{overview?.department || '—'}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 600, color: '#666', display: 'block', mb: 0.5 }}>Join Date</Typography>
                                        <Typography variant="subtitle1" fontWeight={600}>{formatDate(overview?.joiningDate)}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 600, color: '#666', display: 'block', mb: 0.5 }}>Work Email</Typography>
                                        <Typography variant="subtitle1" fontWeight={600}>{overview?.email || '—'}</Typography>
                                    </Box>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Box>

                    <Stack spacing={3}>
                            <ProfileSectionCard
                                title="Team & Reporting"
                                subtitle="Your direct reporting line and manager contact."
                            >
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={4}>
                                        <Typography variant="caption" color="text.secondary">
                                            Reporting Manager
                                        </Typography>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            {reportingPerson.name || '—'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <Typography variant="caption" color="text.secondary">
                                            Manager Email
                                        </Typography>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            {reportingPerson.email || '—'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <Typography variant="caption" color="text.secondary">
                                            Manager Department
                                        </Typography>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            {reportingPerson.department || '—'}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </ProfileSectionCard>

                            <ProfileSectionCard
                                title="Personal Details"
                                subtitle="HR uses this to reach you or your emergency contacts."
                            >
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Blood Group"
                                            name="bloodGroup"
                                            value={formData.bloodGroup}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                            placeholder="e.g., O+"
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Stack direction="row" spacing={1}>
                                            <Box sx={{ minWidth: 180 }}>
                                                <CountryCodeSelector
                                                    value={formData.phoneCountryCode}
                                                    onChange={handleCountryCodeChange('phoneCountryCode')}
                                                    label="Country Code"
                                                />
                                            </Box>
                                            <TextField
                                                label="Phone Number"
                                                name="phoneNumber"
                                                value={formData.phoneNumber}
                                                onChange={handleFieldChange}
                                                fullWidth
                                                sx={textFieldSx}
                                                inputProps={{ maxLength: 15 }}
                                                helperText={`${formData.phoneNumber.length} digits`}
                                                placeholder="Enter phone number"
                                            />
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Emergency Contact Name"
                                            name="emergencyContactName"
                                            value={formData.emergencyContactName}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Stack direction="row" spacing={1}>
                                            <Box sx={{ minWidth: 180 }}>
                                                <CountryCodeSelector
                                                    value={formData.emergencyContactCountryCode}
                                                    onChange={handleCountryCodeChange('emergencyContactCountryCode')}
                                                    label="Country Code"
                                                />
                                            </Box>
                                            <TextField
                                                label="Emergency Contact Number"
                                                name="emergencyContactNumber"
                                                value={formData.emergencyContactNumber}
                                                onChange={handleFieldChange}
                                                fullWidth
                                                sx={textFieldSx}
                                                inputProps={{ maxLength: 15 }}
                                                helperText={`${formData.emergencyContactNumber.length} digits`}
                                                placeholder="Enter contact number"
                                            />
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Personal Email"
                                            name="personalEmail"
                                            value={formData.personalEmail}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Flat / House"
                                            name="addressFlat"
                                            value={formData.addressFlat}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Area / Street"
                                            name="addressArea"
                                            value={formData.addressArea}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="City"
                                            name="addressCity"
                                            value={formData.addressCity}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="State"
                                            name="addressState"
                                            value={formData.addressState}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Pincode"
                                            name="addressPincode"
                                            value={formData.addressPincode}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                            inputProps={{ maxLength: 10 }}
                                            helperText={`${formData.addressPincode.length} digits`}
                                            placeholder="Enter pincode"
                                        />
                                    </Grid>
                                </Grid>
                            </ProfileSectionCard>

                            <ProfileSectionCard
                                title="Identity & Bank Information"
                                subtitle="Only payroll administrators can see these details."
                            >
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Aadhaar Number"
                                            name="aadhaarNumber"
                                            value={formData.aadhaarNumber}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                            inputProps={{ maxLength: 12 }}
                                            helperText={`${formData.aadhaarNumber.length}/12 digits`}
                                            placeholder="Enter 12-digit Aadhaar number"
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="PAN Card Number"
                                            name="panCardNumber"
                                            value={formData.panCardNumber}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                            inputProps={{ maxLength: 10, style: { textTransform: 'uppercase' } }}
                                            helperText={`${formData.panCardNumber.length}/10 characters (e.g., ABCDE1234F)`}
                                            placeholder="ABCDE1234F"
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Bank Name"
                                            name="bankName"
                                            value={formData.bankName}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="Account Number"
                                            name="accountNumber"
                                            value={formData.accountNumber}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            label="IFSC Code"
                                            name="ifscCode"
                                            value={formData.ifscCode}
                                            onChange={handleFieldChange}
                                            fullWidth
                                            sx={textFieldSx}
                                        />
                                    </Grid>
                                </Grid>
                            </ProfileSectionCard>

                            <ProfileSectionCard
                                title="Notification Preferences"
                                subtitle="Pick how you want to be notified."
                            >
                                <SoundSettings />
                            </ProfileSectionCard>

                            <Button
                                variant="contained"
                                size="large"
                                onClick={handleSave}
                                disabled={saving || loading}
                                sx={{
                                    alignSelf: 'flex-start',
                                    backgroundColor: '#E53935',
                                    borderRadius: '12px',
                                    paddingX: 4,
                                    paddingY: 1.2,
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    boxShadow: '0 10px 20px rgba(229,57,53,0.25)',
                                    '&:hover': {
                                        backgroundColor: '#d32f2f'
                                    }
                                }}
                            >
                                {saving ? <CircularProgress color="inherit" size={26} thickness={4} /> : 'Save Details'}
                            </Button>
                        </Stack>
                </Stack>
            </Container>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={snackbar.autoHideDuration || 4000}
                onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
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

            {loading && (
                <Box className="profile-loading-overlay">
                    <CircularProgress />
                </Box>
            )}
        </Box>
    );
};

export default ProfilePage;
