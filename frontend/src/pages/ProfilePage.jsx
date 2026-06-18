import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import socket from '../socket';
import ProfileMain from '../components/Profile/ProfileMain';
import ProfilePolicies from '../components/Profile/ProfilePolicies';
import ProfileSidebar from '../components/Profile/ProfileSidebar';
import CustomPdfViewer from '../components/CustomPdfViewer';
import '../styles/ProfilePage.css';

/**
 * ROOT CAUSE FIX #1: Prevent re-renders from causing layout mutations
 * - Memoize child components
 * - Use refs to track layout lock state
 * - Separate data loading from layout rendering
 */

const ProfilePage = () => {
    const { user, refreshUserData } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [formData, setFormData] = useState({
        // Personal
        dateOfBirth: '', gender: '', bloodGroup: '', maritalStatus: '',
        // Contact
        phoneNumber: '', phoneCountryCode: '+91',
        alternatePhone: '', personalEmail: '',
        // Address
        addressFlat: '', addressArea: '', addressCity: '', addressState: '', addressPincode: '',
        // Emergency contact
        emergencyContactName: '', emergencyContactNumber: '', emergencyContactCountryCode: '+91',
        emergencyContactRelationship: '', emergencyContactEmail: '',
        // Identity & Bank
        aadhaarNumber: '', panCardNumber: '',
        bankName: '', accountNumber: '', ifscCode: '', bankBranch: '',
        uanNumber: '', pfAccountNumber: '',
    });
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [policies, setPolicies] = useState([]);
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [policyModalOpen, setPolicyModalOpen] = useState(false);
    
    // ROOT CAUSE FIX: Track if initial layout has been rendered
    const layoutLocked = useRef(false);
    const initialLoadComplete = useRef(false);

    // ROOT CAUSE FIX: Load data ONCE on mount, not on every user change
    useEffect(() => {
        if (initialLoadComplete.current) return;
        
        const loadInitialData = async () => {
            if (!user) return;
            
            // Set form data synchronously to prevent layout shift
            setFormData({
                // Personal
                dateOfBirth:   user.personalDetails?.dateOfBirth   || '',
                gender:        user.personalDetails?.gender        || '',
                bloodGroup:    user.personalDetails?.bloodGroup    || '',
                maritalStatus: user.personalDetails?.maritalStatus || '',
                // Contact
                phoneNumber:      user.personalDetails?.phoneNumber      || '',
                phoneCountryCode: user.personalDetails?.phoneCountryCode || '+91',
                alternatePhone:   user.personalDetails?.alternatePhone   || '',
                personalEmail:    user.personalDetails?.personalEmail    || '',
                // Address
                addressFlat:    user.personalDetails?.address?.flat    || '',
                addressArea:    user.personalDetails?.address?.area    || '',
                addressCity:    user.personalDetails?.address?.city    || '',
                addressState:   user.personalDetails?.address?.state   || '',
                addressPincode: user.personalDetails?.address?.pincode || '',
                // Emergency contact
                emergencyContactName:         user.personalDetails?.emergencyContactName         || '',
                emergencyContactNumber:       user.personalDetails?.emergencyContactNumber       || '',
                emergencyContactCountryCode:  user.personalDetails?.emergencyContactCountryCode  || '+91',
                emergencyContactRelationship: user.personalDetails?.emergencyContactRelationship || '',
                emergencyContactEmail:        user.personalDetails?.emergencyContactEmail        || '',
                // Identity & Bank
                aadhaarNumber:   user.identityDetails?.aadhaarNumber   || '',
                panCardNumber:   user.identityDetails?.panCardNumber   || '',
                bankName:        user.identityDetails?.bankName        || '',
                accountNumber:   user.identityDetails?.accountNumber   || '',
                ifscCode:        user.identityDetails?.ifscCode        || '',
                bankBranch:      user.identityDetails?.bankBranch      || '',
                uanNumber:       user.identityDetails?.uanNumber       || '',
                pfAccountNumber: user.identityDetails?.pfAccountNumber || '',
            });

            // Load policies asynchronously WITHOUT affecting layout
            try {
                const { data } = await api.get('/policies-gridfs');
                setPolicies(data.policies || []);
                
                // Check if we need to open a specific policy from URL params
                const section = searchParams.get('section');
                const policyId = searchParams.get('policyId');
                
                if (section === 'policies' && policyId && data.policies) {
                    const policy = data.policies.find(p => p._id === policyId);
                    if (policy) {
                        setSelectedPolicy(policy);
                        setPolicyModalOpen(true);
                        // Clear the URL params after opening
                        setSearchParams({});
                    }
                } else if (section === 'policies') {
                    // Just scroll to policies section if no specific policy
                    setTimeout(() => {
                        const policiesSection = document.querySelector('.profile-policies');
                        if (policiesSection) {
                            policiesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 300);
                    setSearchParams({});
                }
            } catch (e) {
                console.error('Failed to load policies:', e);
            }
            
            initialLoadComplete.current = true;
            
            // Lock layout after first render
            setTimeout(() => {
                layoutLocked.current = true;
            }, 100);
        };
        
        loadInitialData();
    }, []); // Only run once on mount

    // Listen for profile updates via Socket.IO
    useEffect(() => {
        if (!user) return;

        const handleProfileUpdate = (data) => {
            // Check if the update is for the current user
            if (data.userId === user.id || data.userId === user._id) {
                console.log('[ProfilePage] Received profile update event:', data);
                // Refresh user data from server
                refreshUserData().then(() => {
                    console.log('[ProfilePage] User data refreshed after profile update');
                    // Show notification if reporting person changed
                    if (data.field === 'reportingPerson') {
                        setSnackbar({ 
                            open: true, 
                            severity: 'info', 
                            message: 'Your reporting person has been updated by admin' 
                        });
                    }
                }).catch(err => {
                    console.error('[ProfilePage] Failed to refresh user data:', err);
                });
            }
        };

        // Listen for user profile updates
        socket.on('user_profile_updated', handleProfileUpdate);

        // Cleanup listener on unmount
        return () => {
            socket.off('user_profile_updated', handleProfileUpdate);
        };
    }, [user, refreshUserData]);

    // Update form data when user data changes (e.g., after socket update)
    useEffect(() => {
        if (!user || !initialLoadComplete.current) return;
        
        // Update form data with latest user data
        setFormData({
            dateOfBirth:   user.personalDetails?.dateOfBirth   || '',
            gender:        user.personalDetails?.gender        || '',
            bloodGroup:    user.personalDetails?.bloodGroup    || '',
            maritalStatus: user.personalDetails?.maritalStatus || '',
            phoneNumber:      user.personalDetails?.phoneNumber      || '',
            phoneCountryCode: user.personalDetails?.phoneCountryCode || '+91',
            alternatePhone:   user.personalDetails?.alternatePhone   || '',
            personalEmail:    user.personalDetails?.personalEmail    || '',
            addressFlat:    user.personalDetails?.address?.flat    || '',
            addressArea:    user.personalDetails?.address?.area    || '',
            addressCity:    user.personalDetails?.address?.city    || '',
            addressState:   user.personalDetails?.address?.state   || '',
            addressPincode: user.personalDetails?.address?.pincode || '',
            emergencyContactName:         user.personalDetails?.emergencyContactName         || '',
            emergencyContactNumber:       user.personalDetails?.emergencyContactNumber       || '',
            emergencyContactCountryCode:  user.personalDetails?.emergencyContactCountryCode  || '+91',
            emergencyContactRelationship: user.personalDetails?.emergencyContactRelationship || '',
            emergencyContactEmail:        user.personalDetails?.emergencyContactEmail        || '',
            aadhaarNumber:   user.identityDetails?.aadhaarNumber   || '',
            panCardNumber:   user.identityDetails?.panCardNumber   || '',
            bankName:        user.identityDetails?.bankName        || '',
            accountNumber:   user.identityDetails?.accountNumber   || '',
            ifscCode:        user.identityDetails?.ifscCode        || '',
            bankBranch:      user.identityDetails?.bankBranch      || '',
            uanNumber:       user.identityDetails?.uanNumber       || '',
            pfAccountNumber: user.identityDetails?.pfAccountNumber || '',
        });
    }, [user?.personalDetails, user?.identityDetails, user?.reportingPerson]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const payload = {
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
            };
            
            await api.put('/user/update-profile', payload);
            await refreshUserData();
            setSnackbar({ open: true, severity: 'success', message: 'Profile updated successfully!' });
        } catch (e) {
            setSnackbar({ open: true, severity: 'error', message: 'Failed to save profile.' });
        }
        setSaving(false);
    }, [formData, refreshUserData]);

    const handleFieldChange = useCallback((field, value) => {
        // ROOT CAUSE FIX: Prevent layout mutations during form updates
        if (layoutLocked.current) {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    }, []);

    const handlePolicyClick = useCallback((policy) => {
        setSelectedPolicy(policy);
        setPolicyModalOpen(true);
    }, []);

    const handleClosePolicyModal = useCallback(() => {
        setPolicyModalOpen(false);
        setSelectedPolicy(null);
    }, []);

    const getPdfUrl = (policy) => {
        if (!policy?._id) return '';
        
        // NEW: Use GridFS endpoint with policy ID
        // This endpoint requires JWT authentication via Authorization header
        if (import.meta.env.DEV) {
            return `/api/policies-gridfs/${policy._id}/file`;
        } else {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://attendance.bylinelms.com';
            const baseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
            return `${baseUrl}/api/policies-gridfs/${policy._id}/file`;
        }
    };

    // ROOT CAUSE FIX: Memoize sidebar to prevent re-renders
    const memoizedSidebar = useMemo(() => (
        <ProfileSidebar user={user} />
    ), [user?.fullName, user?.employeeCode, user?.department, user?.joiningDate, user?.email, user?.profileImageUrl]);

    // ROOT CAUSE FIX: Memoize policies to prevent re-renders
    const memoizedPolicies = useMemo(() => (
        <ProfilePolicies policies={policies} onPolicyClick={handlePolicyClick} />
    ), [policies, handlePolicyClick]);

    return (
        <div className="profile-page">
            <div className="profile-container">
                {memoizedSidebar}
                <ProfileMain 
                    user={user}
                    formData={formData}
                    onFieldChange={handleFieldChange}
                    onSave={handleSave}
                    saving={saving}
                />
                {memoizedPolicies}
            </div>

            {snackbar.open && (
                <div className={`profile-snackbar profile-snackbar-${snackbar.severity}`}>
                    {snackbar.message}
                    <button onClick={() => setSnackbar({ ...snackbar, open: false })}>×</button>
                </div>
            )}

            {/* FIX: PDF Viewer now handles its own modal - removed redundant wrapper */}
            {policyModalOpen && selectedPolicy && (
                <CustomPdfViewer
                    pdfUrl={getPdfUrl(selectedPolicy)}
                    title={selectedPolicy.title || 'Leave Policies'}
                    version={selectedPolicy.version || '1.3'}
                    effectiveDate={selectedPolicy.effectiveDate}
                    onClose={handleClosePolicyModal}
                />
            )}
        </div>
    );
};

export default ProfilePage;
