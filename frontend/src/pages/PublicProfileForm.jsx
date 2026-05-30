// frontend/src/pages/PublicProfileForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './PublicProfileForm.css';

// Plain axios — no auth interceptors
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || 'https://attendance-test.bylinelms.com');
const publicApi = axios.create({ baseURL: API_BASE_URL, withCredentials: false, headers: { 'Content-Type': 'application/json' } });

// ── Default state (flat field names matching the rest of the app) ──
const DEFAULT_FORM = {
  personalDetails: {
    dateOfBirth: '', gender: '', bloodGroup: '', maritalStatus: '',
    phoneNumber: '', phoneCountryCode: '+91', alternatePhone: '', personalEmail: '',
    addressFlat: '', addressArea: '', addressCity: '', addressState: '', addressPincode: '',
    emergencyContactName: '', emergencyContactNumber: '', emergencyContactCountryCode: '+91',
    emergencyContactRelationship: '', emergencyContactEmail: '',
  },
  identityDetails: {
    aadhaarNumber: '', panCardNumber: '', bankName: '', accountNumber: '', ifscCode: '',
    bankBranch: '', uanNumber: '', pfAccountNumber: '',
  },
};

const mergeWithDefaults = (defaults, server) => {
  if (!server || typeof server !== 'object') return { ...defaults };
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const sv = server[key];
    if (sv !== undefined && sv !== null && sv !== '') {
      result[key] = (typeof defaults[key] === 'object' && !Array.isArray(defaults[key]))
        ? mergeWithDefaults(defaults[key], sv)
        : sv;
    }
  }
  return result;
};

const buildFormFromEmployee = (emp) => ({
  personalDetails: mergeWithDefaults(DEFAULT_FORM.personalDetails, {
    dateOfBirth:                  emp.personalDetails?.dateOfBirth || '',
    gender:                       emp.personalDetails?.gender || '',
    bloodGroup:                   emp.personalDetails?.bloodGroup || '',
    maritalStatus:                emp.personalDetails?.maritalStatus || '',
    phoneNumber:                  emp.personalDetails?.phoneNumber || '',
    phoneCountryCode:             emp.personalDetails?.phoneCountryCode || '+91',
    alternatePhone:               emp.personalDetails?.alternatePhone || '',
    personalEmail:                emp.personalDetails?.personalEmail || '',
    addressFlat:                  emp.personalDetails?.address?.flat || '',
    addressArea:                  emp.personalDetails?.address?.area || '',
    addressCity:                  emp.personalDetails?.address?.city || '',
    addressState:                 emp.personalDetails?.address?.state || '',
    addressPincode:               emp.personalDetails?.address?.pincode || '',
    emergencyContactName:         emp.personalDetails?.emergencyContactName || '',
    emergencyContactNumber:       emp.personalDetails?.emergencyContactNumber || '',
    emergencyContactCountryCode:  emp.personalDetails?.emergencyContactCountryCode || '+91',
    emergencyContactRelationship: emp.personalDetails?.emergencyContactRelationship || '',
    emergencyContactEmail:        emp.personalDetails?.emergencyContactEmail || '',
  }),
  identityDetails: mergeWithDefaults(DEFAULT_FORM.identityDetails, {
    aadhaarNumber:   emp.identityDetails?.aadhaarNumber || '',
    panCardNumber:   emp.identityDetails?.panCardNumber || '',
    bankName:        emp.identityDetails?.bankName || '',
    accountNumber:   emp.identityDetails?.accountNumber || '',
    ifscCode:        emp.identityDetails?.ifscCode || '',
    bankBranch:      emp.identityDetails?.bankBranch || '',
    uanNumber:       emp.identityDetails?.uanNumber || '',
    pfAccountNumber: emp.identityDetails?.pfAccountNumber || '',
  }),
});

const PATTERNS = {
  phone:   /^[6-9]\d{9}$/,
  aadhaar: /^\d{12}$/,
  pan:     /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  ifsc:    /^[A-Z]{4}0[A-Z0-9]{6}$/,
  pincode: /^\d{6}$/,
  email:   /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

const STEPS = ['Personal', 'Address', 'Emergency', 'Identity'];

// ── Sub-components defined OUTSIDE the main component to prevent remounting ──

const Field = ({ label, children, error: fieldErr, optional }) => (
  <div className="pf-field">
    <label className="pf-label">
      {label}
      {optional && <span className="pf-label-optional">Optional</span>}
    </label>
    {children}
    {fieldErr && <span className="pf-error-text">⚠ {[].concat(fieldErr).join(', ')}</span>}
  </div>
);

const Input = ({ value, onChange, type = 'text', placeholder = '', maxLength, upper = false, hasError = false, ...rest }) => (
  <input
    className={`pf-input ${hasError ? 'has-error' : ''}`}
    type={type}
    value={value}
    onChange={e => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
    placeholder={placeholder}
    maxLength={maxLength}
    {...rest}
  />
);

const Select = ({ value, onChange, options }) => (
  <select className="pf-select" value={value} onChange={e => onChange(e.target.value)}>
    <option value="">Select</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

// ── Component ─────────────────────────────────────────────────────────────────
const PublicProfileForm = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(false);
  const [employee, setEmployee]     = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState({});
  const [formData, setFormData]     = useState(DEFAULT_FORM);

  useEffect(() => {
    if (!token) { setError('Invalid or missing link.'); setLoading(false); return; }
    publicApi.get('/api/public/validate', { params: { token } })
      .then(({ data }) => {
        if (data.success) {
          setEmployee(data.employee);
          setFormData(buildFormFromEmployee(data.employee));
        }
      })
      .catch((err) => {
        const d = err.response?.data || {};
        if (d.expired) setError('This link has expired. Please contact HR for a new link.');
        else if (d.alreadyUsed) setError('This form has already been submitted. Contact HR to update.');
        else setError(d.error || 'Invalid link.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !employee) return;
    const id = setTimeout(() => localStorage.setItem(`pf_${token}`, JSON.stringify(formData)), 800);
    return () => clearTimeout(id);
  }, [formData, token, employee]);

  useEffect(() => {
    if (!token || !employee) return;
    try {
      const saved = localStorage.getItem(`pf_${token}`);
      if (saved) {
        const p = JSON.parse(saved);
        setFormData({
          personalDetails: mergeWithDefaults(DEFAULT_FORM.personalDetails, p.personalDetails),
          identityDetails: mergeWithDefaults(DEFAULT_FORM.identityDetails, p.identityDetails),
        });
      }
    } catch (_) {}
  }, [token, employee]);

  const setPD = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, personalDetails: { ...prev.personalDetails, [field]: value } }));
    setValidationErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);
  const setID = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, identityDetails: { ...prev.identityDetails, [field]: value } }));
    setValidationErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  const validateStep = (step) => {
    const errs = {};
    const pd = formData.personalDetails;
    const id = formData.identityDetails;

    if (step === 1) {
      if (pd.phoneNumber && !PATTERNS.phone.test(pd.phoneNumber))
        errs.phoneNumber = 'Must be a valid 10-digit Indian mobile number';
      if (pd.alternatePhone && !PATTERNS.phone.test(pd.alternatePhone))
        errs.alternatePhone = 'Must be a valid 10-digit Indian mobile number';
      if (pd.personalEmail && !PATTERNS.email.test(pd.personalEmail))
        errs.personalEmail = 'Invalid email format';
    }
    if (step === 2) {
      if (pd.addressPincode && !PATTERNS.pincode.test(pd.addressPincode))
        errs.addressPincode = 'Must be a 6-digit pincode';
    }
    if (step === 3) {
      if (pd.emergencyContactNumber && !PATTERNS.phone.test(pd.emergencyContactNumber))
        errs.emergencyContactNumber = 'Must be a valid 10-digit Indian mobile number';
    }
    if (step === 4) {
      if (id.aadhaarNumber && !PATTERNS.aadhaar.test(id.aadhaarNumber))
        errs.aadhaarNumber = 'Must be exactly 12 digits';
      if (id.panCardNumber && !PATTERNS.pan.test(id.panCardNumber))
        errs.panCardNumber = 'Format: ABCDE1234F (5 letters, 4 digits, 1 letter)';
      if (id.ifscCode && !PATTERNS.ifsc.test(id.ifscCode))
        errs.ifscCode = 'Format: ABCD0123456';
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => { if (validateStep(currentStep)) setCurrentStep(s => Math.min(s + 1, 4)); };
  const handlePrev = () => setCurrentStep(s => Math.max(s - 1, 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(4)) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await publicApi.post('/api/public/submit', {
        token,
        personalDetails: formData.personalDetails,
        identityDetails: formData.identityDetails,
      });
      if (data.success) {
        setSuccess(true);
        localStorage.removeItem(`pf_${token}`);
      }
    } catch (err) {
      const d = err.response?.data || {};
      if (d.errors) {
        setValidationErrors(d.errors);
        setError(Object.values(d.errors).flat().join(' • '));
      } else {
        setError(d.error || 'Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) return (
    <div className="pf-state-page">
      <div className="pf-state-card">
        <div className="pf-loading-icon" />
        <h2 className="pf-state-title">Validating your link…</h2>
        <p className="pf-state-body">Please wait while we verify your access.</p>
      </div>
    </div>
  );

  // ── Error state ────────────────────────────────────────────────────────────
  if (error && !employee) return (
    <div className="pf-state-page">
      <div className="pf-state-card">
        <div className="pf-error-icon">⚠️</div>
        <h2 className="pf-state-title">Unable to Load Form</h2>
        <p className="pf-state-body">{error}</p>
        <p className="pf-state-hint">Please contact your HR department for assistance.</p>
      </div>
    </div>
  );

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) return (
    <div className="pf-state-page">
      <div className="pf-state-card">
        <div className="pf-success-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="pf-state-title">Profile Submitted Successfully!</h2>
        <p className="pf-state-body">Thank you, <strong>{employee.fullName}</strong></p>
        <p className="pf-state-body">Your information has been saved and will reflect in the system shortly.</p>
        <p className="pf-state-hint">You can now close this window.</p>
      </div>
    </div>
  );

  const progress = (currentStep / 4) * 100;
  const pd = formData.personalDetails;
  const id = formData.identityDetails;

  return (
    <div className="public-form-root">
      <div className="pf-card">
        {/* ── Header ── */}
        <div className="pf-header">
          <div className="pf-header-top">
            <div className="pf-logo-mark">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="pf-header-text">
              <h1>Employee Profile Form</h1>
              <p>Complete your profile information</p>
            </div>
          </div>

          <div className="pf-employee-strip">
            <div className="pf-employee-avatar">{employee.fullName.charAt(0)}</div>
            <div className="pf-employee-info">
              <div className="pf-employee-name">{employee.fullName}</div>
              <div className="pf-employee-meta">
                <span className="pf-badge pf-badge--code">{employee.employeeCode}</span>
                {employee.department && <span className="pf-badge pf-badge--dept">{employee.department}</span>}
              </div>
            </div>
          </div>

          <div className="pf-progress-wrap">
            <div className="pf-progress-track">
              <div className="pf-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="pf-steps">
              {STEPS.map((label, i) => (
                <div key={label} className={`pf-step ${currentStep >= i + 1 ? 'active' : ''} ${currentStep > i + 1 ? 'done' : ''}`}>
                  <div className="pf-step-num">{i + 1}</div>
                  <div className="pf-step-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <form onSubmit={handleSubmit}>
          <div className="pf-body">
            {error && <div className="pf-alert pf-alert--error">{error}</div>}

            {/* ── Step 1: Personal ── */}
            {currentStep === 1 && (
              <div className="pf-step-content">
                <h3 className="pf-section-title">Personal Details</h3>
                <p className="pf-section-desc">Basic information about you</p>
                <div className="pf-grid">
                  <Field label="Date of Birth" optional><Input value={pd.dateOfBirth} onChange={v => setPD('dateOfBirth', v)} type="date" /></Field>
                  <Field label="Gender" optional><Select value={pd.gender} onChange={v => setPD('gender', v)} options={['Male', 'Female', 'Other']} /></Field>
                  <Field label="Blood Group" optional><Select value={pd.bloodGroup} onChange={v => setPD('bloodGroup', v)} options={['A+','A-','B+','B-','AB+','AB-','O+','O-']} /></Field>
                  <Field label="Marital Status" optional><Select value={pd.maritalStatus} onChange={v => setPD('maritalStatus', v)} options={['Single','Married','Divorced','Widowed']} /></Field>
                </div>
                <div className="pf-sub-label">Contact Information</div>
                <div className="pf-grid">
                  <Field label="Phone Number" error={validationErrors.phoneNumber}>
                    <div className="pf-phone-row">
                      <div className="pf-phone-code">
                        <select className="pf-select" value={pd.phoneCountryCode} onChange={e => setPD('phoneCountryCode', e.target.value)}>
                          <option value="+91">🇮🇳 +91</option>
                          <option value="+1">🇺🇸 +1</option>
                          <option value="+44">🇬🇧 +44</option>
                          <option value="+971">🇦🇪 +971</option>
                          <option value="+65">🇸🇬 +65</option>
                        </select>
                      </div>
                      <div className="pf-phone-input"><Input value={pd.phoneNumber} onChange={v => setPD('phoneNumber', v)} type="tel" placeholder="10-digit number" maxLength={10} hasError={!!validationErrors.phoneNumber} /></div>
                    </div>
                  </Field>
                  <Field label="Alternate Phone" error={validationErrors.alternatePhone} optional>
                    <Input value={pd.alternatePhone} onChange={v => setPD('alternatePhone', v)} type="tel" placeholder="10-digit number" maxLength={10} hasError={!!validationErrors.alternatePhone} />
                  </Field>
                  <Field label="Personal Email" error={validationErrors.personalEmail} optional>
                    <Input value={pd.personalEmail} onChange={v => setPD('personalEmail', v)} type="email" placeholder="personal@email.com" hasError={!!validationErrors.personalEmail} />
                  </Field>
                </div>
              </div>
            )}

            {/* ── Step 2: Address ── */}
            {currentStep === 2 && (
              <div className="pf-step-content">
                <h3 className="pf-section-title">Home Address</h3>
                <p className="pf-section-desc">Your current residential address</p>
                <div className="pf-grid">
                  <Field label="Flat / House No." optional><Input value={pd.addressFlat} onChange={v => setPD('addressFlat', v)} placeholder="Apt / Floor / Unit" /></Field>
                  <Field label="Area / Street" optional><Input value={pd.addressArea} onChange={v => setPD('addressArea', v)} placeholder="Street name or locality" /></Field>
                  <Field label="City" optional><Input value={pd.addressCity} onChange={v => setPD('addressCity', v)} placeholder="City" /></Field>
                  <Field label="State" optional><Input value={pd.addressState} onChange={v => setPD('addressState', v)} placeholder="State" /></Field>
                  <Field label="Pincode" error={validationErrors.addressPincode} optional>
                    <Input value={pd.addressPincode} onChange={v => setPD('addressPincode', v)} placeholder="6-digit pincode" maxLength={6} hasError={!!validationErrors.addressPincode} />
                  </Field>
                </div>
              </div>
            )}

            {/* ── Step 3: Emergency ── */}
            {currentStep === 3 && (
              <div className="pf-step-content">
                <h3 className="pf-section-title">Emergency Contact</h3>
                <p className="pf-section-desc">Person to contact in case of emergency</p>
                <div className="pf-grid">
                  <Field label="Contact Name" optional><Input value={pd.emergencyContactName} onChange={v => setPD('emergencyContactName', v)} placeholder="Full name" /></Field>
                  <Field label="Relationship" optional><Input value={pd.emergencyContactRelationship} onChange={v => setPD('emergencyContactRelationship', v)} placeholder="e.g. Father, Spouse" /></Field>
                  <Field label="Contact Number" error={validationErrors.emergencyContactNumber} optional>
                    <div className="pf-phone-row">
                      <div className="pf-phone-code">
                        <select className="pf-select" value={pd.emergencyContactCountryCode} onChange={e => setPD('emergencyContactCountryCode', e.target.value)}>
                          <option value="+91">🇮🇳 +91</option>
                          <option value="+1">🇺🇸 +1</option>
                          <option value="+44">🇬🇧 +44</option>
                          <option value="+971">🇦🇪 +971</option>
                          <option value="+65">🇸🇬 +65</option>
                        </select>
                      </div>
                      <div className="pf-phone-input"><Input value={pd.emergencyContactNumber} onChange={v => setPD('emergencyContactNumber', v)} type="tel" placeholder="10-digit number" maxLength={10} hasError={!!validationErrors.emergencyContactNumber} /></div>
                    </div>
                  </Field>
                  <Field label="Contact Email" optional><Input value={pd.emergencyContactEmail} onChange={v => setPD('emergencyContactEmail', v)} type="email" placeholder="email@example.com" /></Field>
                </div>
              </div>
            )}

            {/* ── Step 4: Identity & Bank ── */}
            {currentStep === 4 && (
              <div className="pf-step-content">
                <h3 className="pf-section-title">Identity & Bank Details</h3>
                <p className="pf-section-desc">Secure information for payroll and compliance</p>
                <div className="pf-security-banner">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Encrypted and securely stored. Visible only to payroll admins.</span>
                </div>
                <div className="pf-grid">
                  <Field label="Aadhaar Number" error={validationErrors.aadhaarNumber} optional>
                    <Input value={id.aadhaarNumber} onChange={v => setID('aadhaarNumber', v)} placeholder="12-digit Aadhaar" maxLength={12} hasError={!!validationErrors.aadhaarNumber} />
                  </Field>
                  <Field label="PAN Number" error={validationErrors.panCardNumber} optional>
                    <Input value={id.panCardNumber} onChange={v => setID('panCardNumber', v)} placeholder="ABCDE1234F" maxLength={10} upper hasError={!!validationErrors.panCardNumber} />
                  </Field>
                </div>
                <div className="pf-sub-label">Bank Details</div>
                <div className="pf-grid">
                  <Field label="Bank Name" optional><Input value={id.bankName} onChange={v => setID('bankName', v)} placeholder="e.g. State Bank of India" /></Field>
                  <Field label="Account Number" error={validationErrors.accountNumber} optional>
                    <Input value={id.accountNumber} onChange={v => setID('accountNumber', v)} placeholder="Bank account number" hasError={!!validationErrors.accountNumber} />
                  </Field>
                  <Field label="IFSC Code" error={validationErrors.ifscCode} optional>
                    <Input value={id.ifscCode} onChange={v => setID('ifscCode', v)} placeholder="SBIN0001234" maxLength={11} upper hasError={!!validationErrors.ifscCode} />
                  </Field>
                  <Field label="Branch Name" optional><Input value={id.bankBranch} onChange={v => setID('bankBranch', v)} placeholder="Branch name" /></Field>
                </div>
                <div className="pf-sub-label">PF Details</div>
                <div className="pf-grid">
                  <Field label="UAN Number" error={validationErrors.uanNumber} optional>
                    <Input value={id.uanNumber} onChange={v => setID('uanNumber', v)} placeholder="9–12 digit UAN" maxLength={12} hasError={!!validationErrors.uanNumber} />
                  </Field>
                  <Field label="PF Account Number" optional>
                    <Input value={id.pfAccountNumber} onChange={v => setID('pfAccountNumber', v)} placeholder="PF account number" />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer / Actions ── */}
          <div className="pf-footer">
            <div className="pf-footer-meta">
              <div className="pf-autosave">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Progress is automatically saved
              </div>
              <div className="pf-secure">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Your data is encrypted and secure
              </div>
            </div>
            <div className="pf-actions">
              {currentStep > 1 && (
                <button type="button" onClick={handlePrev} className="pf-btn pf-btn--secondary" disabled={submitting}>
                  Previous
                </button>
              )}
              {currentStep < 4 ? (
                <button type="button" onClick={handleNext} className="pf-btn pf-btn--primary">
                  Next
                </button>
              ) : (
                <button type="submit" className="pf-btn pf-btn--primary" disabled={submitting}>
                  {submitting && <div className="pf-btn-spinner" />}
                  {submitting ? 'Submitting…' : 'Submit Profile'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PublicProfileForm;
