import CountryCodeSelect from './CountryCodeSelect';

const ProfileMain = ({ user, formData, onFieldChange, onSave, saving }) => {
    return (
        <div className="profile-main">
            {/* Team & Reporting Section */}
            <div className="profile-section">
                <h3 className="section-title">Team & Reporting</h3>
                <p className="section-subtitle">Your direct reporting line and manager contact.</p>
                
                <div className="info-grid info-grid-3">
                    <div className="info-item">
                        <span className="info-item-label">Reporting Manager</span>
                        <span className="info-item-value">{user?.reportingPerson?.fullName || '—'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-item-label">Manager Email</span>
                        <span className="info-item-value">{user?.reportingPerson?.email || '—'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-item-label">Manager Department</span>
                        <span className="info-item-value">{user?.reportingPerson?.department || '—'}</span>
                    </div>
                </div>
            </div>

            {/* Personal Details Section */}
            <div className="profile-section">
                <h3 className="section-title">Personal Details</h3>
                <p className="section-subtitle">HR uses this to reach you or your emergency contacts.</p>
                
                <div className="form-grid">
                    {/* Row 1 */}
                    <div className="form-field form-field-small">
                        <label>Blood Group</label>
                        <input
                            type="text"
                            value={formData.bloodGroup}
                            onChange={(e) => onFieldChange('bloodGroup', e.target.value)}
                            placeholder="e.g. A+"
                        />
                    </div>
                    <div className="form-field form-field-tiny">
                        <label>Country Code</label>
                        <CountryCodeSelect
                            value={formData.phoneCountryCode}
                            onChange={(e) => onFieldChange('phoneCountryCode', e.target.value)}
                        />
                    </div>
                    <div className="form-field form-field-small">
                        <label>Phone Number</label>
                        <input
                            type="text"
                            value={formData.phoneNumber}
                            onChange={(e) => onFieldChange('phoneNumber', e.target.value)}
                            placeholder="9 digits"
                        />
                    </div>
                    <div className="form-field form-field-medium">
                        <label>Emergency Contact Name</label>
                        <input
                            type="text"
                            value={formData.emergencyContactName}
                            onChange={(e) => onFieldChange('emergencyContactName', e.target.value)}
                            placeholder="9 digits"
                        />
                    </div>

                    {/* Row 2 */}
                    <div className="form-field form-field-tiny">
                        <label>Country Code</label>
                        <CountryCodeSelect
                            value={formData.emergencyContactCountryCode}
                            onChange={(e) => onFieldChange('emergencyContactCountryCode', e.target.value)}
                        />
                    </div>
                    <div className="form-field form-field-small">
                        <label>Emergency Contact Number</label>
                        <input
                            type="text"
                            value={formData.emergencyContactNumber}
                            onChange={(e) => onFieldChange('emergencyContactNumber', e.target.value)}
                            placeholder="9 digits"
                        />
                    </div>
                    <div className="form-field form-field-medium">
                        <label>Personal Email</label>
                        <input
                            type="email"
                            value={formData.personalEmail}
                            onChange={(e) => onFieldChange('personalEmail', e.target.value)}
                        />
                    </div>
                    <div className="form-field form-field-medium">
                        <label>Flat / House</label>
                        <input
                            type="text"
                            value={formData.addressFlat}
                            onChange={(e) => onFieldChange('addressFlat', e.target.value)}
                        />
                    </div>

                    {/* Row 3 */}
                    <div className="form-field form-field-medium">
                        <label>Area / Street</label>
                        <input
                            type="text"
                            value={formData.addressArea}
                            onChange={(e) => onFieldChange('addressArea', e.target.value)}
                        />
                    </div>
                    <div className="form-field form-field-medium">
                        <label>City</label>
                        <input
                            type="text"
                            value={formData.addressCity}
                            onChange={(e) => onFieldChange('addressCity', e.target.value)}
                        />
                    </div>
                    <div className="form-field form-field-medium">
                        <label>State</label>
                        <input
                            type="text"
                            value={formData.addressState}
                            onChange={(e) => onFieldChange('addressState', e.target.value)}
                        />
                    </div>
                    <div className="form-field form-field-small">
                        <label>Pincode</label>
                        <input
                            type="text"
                            value={formData.addressPincode}
                            onChange={(e) => onFieldChange('addressPincode', e.target.value)}
                            placeholder="6 digits"
                        />
                    </div>
                </div>
            </div>

            {/* Identity & Bank Information Section */}
            <div className="profile-section">
                <h3 className="section-title">Identity & Bank Information</h3>
                <p className="section-subtitle">Only payroll administrators can see these details.</p>
                
                <div className="form-grid">
                    <div className="form-field form-field-medium">
                        <label>Aadhaar Number</label>
                        <input
                            type="text"
                            value={formData.aadhaarNumber}
                            onChange={(e) => onFieldChange('aadhaarNumber', e.target.value)}
                            placeholder="12-15 digits"
                        />
                    </div>
                    <div className="form-field form-field-medium">
                        <label>PAN Card Number</label>
                        <input
                            type="text"
                            value={formData.panCardNumber}
                            onChange={(e) => onFieldChange('panCardNumber', e.target.value)}
                            placeholder="10-15 characters (e.g. ABCDE1234F)"
                        />
                    </div>
                    <div className="form-field form-field-medium">
                        <label>Bank Name</label>
                        <input
                            type="text"
                            value={formData.bankName}
                            onChange={(e) => onFieldChange('bankName', e.target.value)}
                        />
                    </div>
                    <div className="form-field form-field-large">
                        <label>Account Number</label>
                        <input
                            type="text"
                            value={formData.accountNumber}
                            onChange={(e) => onFieldChange('accountNumber', e.target.value)}
                        />
                    </div>
                    <div className="form-field form-field-large">
                        <label>IFSC Code</label>
                        <input
                            type="text"
                            value={formData.ifscCode}
                            onChange={(e) => onFieldChange('ifscCode', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="profile-actions">
                <button 
                    className="btn-save" 
                    onClick={onSave}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save Details'}
                </button>
            </div>
        </div>
    );
};

export default ProfileMain;
