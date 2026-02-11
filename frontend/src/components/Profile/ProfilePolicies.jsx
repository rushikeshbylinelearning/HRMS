import { memo } from 'react';
import AnonymousFeedback from './AnonymousFeedback';

/**
 * ROOT CAUSE FIX: Memoize ProfilePolicies to prevent unnecessary re-renders
 * This component should ONLY re-render when policies array changes
 */
const ProfilePolicies = memo(({ policies, onPolicyClick }) => {
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="profile-policies">
            <h3 className="policies-title">Policies & Anonymous Feedback</h3>

            {/* Company Policies */}
            <div className="policies-section">
                <h4 className="policies-section-title">COMPANY POLICIES</h4>
                <div className="policies-list">
                    {policies.length === 0 ? (
                        <p className="policies-empty">No policies available</p>
                    ) : (
                        policies.map((policy) => (
                            <div 
                                key={policy._id} 
                                className="policy-item"
                                onClick={() => onPolicyClick(policy)}
                            >
                                <div className="policy-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#E53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M14 2V8H20" stroke="#E53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                                <div className="policy-content">
                                    <div className="policy-header">
                                        <span className="policy-name">{policy.name}</span>
                                        <span className={`policy-status ${policy.status === 'Active' ? 'status-active' : 'status-archived'}`}>
                                            {policy.status}
                                        </span>
                                    </div>
                                    <div className="policy-meta">
                                        <span className="policy-version">Version {policy.version}</span>
                                        <span className="policy-divider">•</span>
                                        <span className="policy-date">Effective {formatDate(policy.effectiveFrom)}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Anonymous Message */}
            <div className="policies-section">
                <h4 className="policies-section-title-bold">ANONYMOUS MESSAGE</h4>
                <AnonymousFeedback />
            </div>
        </div>
    );
});

export default ProfilePolicies;
