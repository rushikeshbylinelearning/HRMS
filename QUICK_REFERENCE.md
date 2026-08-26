# Dynamic Policy Acknowledgement - Quick Reference

## 🚀 Quick Start

### For Admins
```
1. Admin → Policies → Onboarding Compliance
2. Click "Assign Policy to Employees"
3. Select policy + employees + deadline
4. Click "Assign Policy"
```

### For Employees
```
1. See banner on dashboard
2. Click "Review Now"
3. Read policy (≥60 seconds)
4. Scroll to bottom
5. Check acknowledgement box
6. Click "Accept & Acknowledge"
```

---

## 📡 API Reference

### Assign to Specific Users
```http
POST /api/onboarding/admin/assign-policy-to-users
Authorization: Bearer <token>
Content-Type: application/json

{
  "policyId": "507f1f77bcf86cd799439011",
  "userIds": ["user1", "user2"],
  "deadline": "2026-08-20T23:59:59.000Z"
}
```

### Assign to All Users
```http
POST /api/onboarding/admin/assign-policy-to-all
Authorization: Bearer <token>
Content-Type: application/json

{
  "policyId": "507f1f77bcf86cd799439011",
  "deadline": "2026-08-20T23:59:59.000Z",
  "excludeUserIds": []
}
```

### Get Pending Policies
```http
GET /api/onboarding/pending-policies
Authorization: Bearer <token>
```

### Accept Policy
```http
POST /api/onboarding/policy/standalone-accept
Authorization: Bearer <token>
Content-Type: application/json

{
  "logId": "507f1f77bcf86cd799439014",
  "policyId": "507f1f77bcf86cd799439011",
  "policyVersion": "1.0",
  "checkboxAcknowledged": true,
  "readingDurationSeconds": 120,
  "scrolledToBottom": true
}
```

---

## 🧩 Component Usage

### Admin: PolicyAssignmentModal
```jsx
import PolicyAssignmentModal from '../components/admin/PolicyAssignmentModal';

<PolicyAssignmentModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  onSuccess={(result) => {
    console.log('Assigned to:', result.results.success.length);
  }}
/>
```

### Employee: StandalonePolicyModal
```jsx
import StandalonePolicyModal from '../components/onboarding/StandalonePolicyModal';

// Renders automatically via OnboardingContext
// No manual integration needed
<StandalonePolicyModal />
```

### Employee: PendingPolicyBanner
```jsx
import PendingPolicyBanner from '../components/PendingPolicyBanner';

<PendingPolicyBanner />
// Automatically shows/hides based on pending policies
```

---

## 🎣 Context Hooks

### useOnboarding Hook
```jsx
import { useOnboarding } from '../context/OnboardingContext';

function MyComponent() {
  const {
    // Standalone policy state
    pendingPolicies,              // Array of pending policies
    standalonePolicyModalOpen,    // Modal visibility
    currentStandalonePolicy,      // Current policy being reviewed
    
    // Functions
    loadPendingPolicies,          // Fetch pending policies
    acceptStandalonePolicy,       // Accept a policy
    openStandalonePolicyModal,    // Open modal
    closeStandalonePolicyModal,   // Close modal
    recordStandaloneReadingStart, // Record reading start
  } = useOnboarding();
  
  return (
    <div>
      {pendingPolicies.length > 0 && (
        <button onClick={() => openStandalonePolicyModal()}>
          Review {pendingPolicies.length} Policies
        </button>
      )}
    </div>
  );
}
```

---

## 🗄️ Database Queries

### Find Pending Policies
```javascript
db.policyacceptancelogs.find({
  userId: ObjectId("..."),
  accepted: false
})
```

### Find Accepted Policies
```javascript
db.policyacceptancelogs.find({
  userId: ObjectId("..."),
  accepted: true,
  status: "completed"
})
```

### Find Overdue Policies
```javascript
db.policyacceptancelogs.find({
  accepted: false,
  profileDeadline: { $lt: new Date() }
})
```

### View Audit Trail
```javascript
db.policyacceptancelogs.findOne({
  _id: ObjectId("...")
}).timeline
```

---

## 🔍 Debugging

### Check Pending Policies API
```javascript
// Browser Console
const response = await fetch('/api/onboarding/pending-policies', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
const data = await response.json();
console.log('Pending:', data.pendingPolicies);
```

### Check OnboardingContext State
```javascript
// React DevTools
// 1. Open React DevTools
// 2. Find OnboardingProvider
// 3. View hooks state:
//    - pendingPolicies
//    - standalonePolicyModalOpen
//    - currentStandalonePolicy
```

### Check PolicyAcceptanceLog
```javascript
// MongoDB Shell
db.policyacceptancelogs.find({ 
  userId: ObjectId("...") 
}).pretty()
```

---

## ⚠️ Common Issues

### Banner Not Showing
```
✓ Check: PolicyAcceptanceLog exists with accepted=false
✓ Check: Employee role is not Admin/HR
✓ Check: OnboardingContext.loadPendingPolicies() called
✓ Check: Console for API errors
```

### Modal Won't Open
```
✓ Check: StandalonePolicyModal imported in App.jsx
✓ Check: currentStandalonePolicy is set
✓ Check: standalonePolicyModalOpen is true
✓ Check: No CSS z-index conflicts
```

### Accept Button Disabled
```
✓ Check: scrolledToBottom = true
✓ Check: acknowledged = true  
✓ Check: Reading time >= 60 seconds
✓ Check: All validation states met
```

### Assignment Fails
```
✓ Check: Policy status = "Active"
✓ Check: User isActive = true
✓ Check: User role = Employee or Intern
✓ Check: Admin/HR authentication
```

---

## 🧪 Quick Test

### Test Assignment
```bash
# 1. Start servers
cd backend && npm start
cd frontend && npm start

# 2. Login as Admin
# 3. Navigate to Policies → Compliance
# 4. Assign test policy to yourself
# 5. Logout, login as that employee
# 6. See banner on dashboard
```

### Test Acknowledgement
```bash
# 1. Click "Review Now"
# 2. Modal opens
# 3. Wait 60+ seconds
# 4. Scroll to bottom
# 5. Check box
# 6. Click "Accept & Acknowledge"
# 7. Banner should disappear
```

---

## 📊 Status Values

### PolicyAcceptanceLog.status
- `pending` - Assigned but not opened
- `in_progress` - Employee opened but not acknowledged
- `completed` - Successfully acknowledged

### Timeline Events
- `policy_assigned` - Initial assignment
- `policy_reassigned` - Deadline updated
- `reading_started` - Employee opened document
- `reading_completed` - Employee finished reading
- `policy_accepted` - Employee acknowledged

---

## 🔐 Permissions

### Admin/HR Only
- Assign policies
- View all compliance data
- Export reports

### All Employees
- View their pending policies
- Acknowledge assigned policies
- View their own acceptance history

---

## 📏 Validation Rules

### Reading Time
- Minimum: 60 seconds
- Tracked: Real-time timer
- Enforced: Backend validation

### Scroll Position
- Requirement: Must reach bottom
- Tracked: Scroll event listener
- Enforced: Frontend + backend

### Acknowledgement
- Requirement: Checkbox must be checked
- Tracked: Checkbox state
- Enforced: Frontend validation

---

## 🎨 Styling Classes

### Banner
```css
.MuiAlert-root {
  severity: "warning" | "error"
  borderRadius: 2
  mb: 3
}
```

### Modal
```css
.MuiDialog-paper {
  maxWidth: "md" (900px)
  height: "90vh"
  borderRadius: 2
}
```

---

## 📦 File Locations

### Backend
- Controller: `backend/controllers/onboardingController.js`
- Routes: `backend/routes/onboarding.js`
- Model: `backend/models/PolicyAcceptanceLog.js` (existing)

### Frontend
- Context: `frontend/src/context/OnboardingContext.jsx`
- Admin Modal: `frontend/src/components/admin/PolicyAssignmentModal.jsx`
- Employee Modal: `frontend/src/components/onboarding/StandalonePolicyModal.jsx`
- Banner: `frontend/src/components/PendingPolicyBanner.jsx`

### Documentation
- Main docs: `DYNAMIC_POLICY_ACKNOWLEDGEMENT.md`
- Implementation: `IMPLEMENTATION_SUMMARY.md`
- Testing: `TESTING_GUIDE.md`
- UI guide: `FEATURE_SCREENSHOTS_GUIDE.md`
- Changelog: `CHANGELOG_DYNAMIC_POLICY.md`
- This file: `QUICK_REFERENCE.md`

---

## 🔗 Related Features

- **Onboarding Flow** - For new employees
- **Policy Management** - Upload and manage policies
- **Compliance Dashboard** - Track acknowledgements
- **Notifications** - Alert system for assignments

---

## 📞 Need Help?

1. Check `TESTING_GUIDE.md` → Troubleshooting section
2. Review `DYNAMIC_POLICY_ACKNOWLEDGEMENT.md` → Complete docs
3. Search `IMPLEMENTATION_SUMMARY.md` → Technical details
4. Contact: Development team

---

**Version**: 1.0.0  
**Last Updated**: August 13, 2026  
**Status**: ✅ Production Ready
