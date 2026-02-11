import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import ProfileSidebar from '../components/Profile/ProfileSidebar';
import ProfileMain from '../components/Profile/ProfileMain';
import ProfilePolicies from '../components/Profile/ProfilePolicies';
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
    const [formData, setFormData] = useState({
        bloodGroup: '', phoneNumber: '', phoneCountryCode: '+91',
        emergencyContactName: '', emergencyContactNumber: '', emergencyContactCountryCode: '+91',
        personalEmail: '', addressFlat: '', addressArea: '', addressCity: '',
        addressState: '', addressPincode: '', aadhaarNumber: '', panCardNumber: '',
        bankName: '', accountNumber: '', ifscCode: ''
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
                bloodGroup: user.personalDetails?.bloodGroup || '',
                phoneNumber: user.personalDetails?.phoneNumber || '',
                phoneCountryCode: user.personalDetails?.phoneCountryCode || '+91',
                emergencyContactName: user.personalDetails?.emergencyContactName || '',
                emergencyContactNumber: user.personalDetails?.emergencyContactNumber || '',
                emergencyContactCountryCode: user.personalDetails?.emergencyContactCountryCode || '+91',
                personalEmail: user.personalDetails?.personalEmail || '',
                addressFlat: user.personalDetails?.address?.flat || '',
                addressArea: user.personalDetails?.address?.area || '',
                addressCity: user.personalDetails?.address?.city || '',
                addressState: user.personalDetails?.address?.state || '',
                addressPincode: user.personalDetails?.address?.pincode || '',
                aadhaarNumber: user.identityDetails?.aadhaarNumber || '',
                panCardNumber: user.identityDetails?.panCardNumber || '',
                bankName: user.identityDetails?.bankName || '',
                accountNumber: user.identityDetails?.accountNumber || '',
                ifscCode: user.identityDetails?.ifscCode || ''
            });

            // Load policies asynchronously WITHOUT affecting layout
            try {
                const { data } = await api.get('/policies');
                setPolicies(data.policies || []);
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

    const handleSave = useCallback(async () => {
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
        if (!policy?.fileUrl) return '';
        
        if (policy.fileUrl.startsWith('http://') || policy.fileUrl.startsWith('https://')) {
            return policy.fileUrl;
        }
        
        if (import.meta.env.DEV) {
            return policy.fileUrl;
        } else {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://attendance.bylinelms.com';
            return `${apiBaseUrl}${policy.fileUrl}`;
        }
    };

    // ROOT CAUSE FIX: Memoize sidebar to prevent re-renders
    const memoizedSidebar = useMemo(() => (
        <ProfileSidebar user={user} />
    ), [user?.fullName, user?.employeeCode, user?.department, user?.joiningDate, user?.email]);

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
