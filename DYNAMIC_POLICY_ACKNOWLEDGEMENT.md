# Dynamic Policy Acknowledgement Feature

## Overview

The dynamic policy acknowledgement feature allows administrators and HR personnel to assign policies to existing employees for acknowledgement, independent of the onboarding flow. This enables policy compliance tracking across the entire organization, not just new hires.

## Key Features

### 1. **Flexible Policy Assignment**
- Assign policies to specific employees
- Assign policies to all active employees at once
- Set custom acknowledgement deadlines
- Track assignment history and compliance

### 2. **Employee Experience**
- Automatic notification when a policy is assigned
- Dashboard banner showing pending policies
- Modal view for policy review and acknowledgement
- Minimum reading time enforcement (60 seconds)
- Scroll-to-bottom validation

### 3. **Admin Controls**
- Assign policies from the Admin Policies page
- View all pending and completed acknowledgements
- Export compliance reports
- Track reading time and acceptance details

## Architecture

### Backend Components

#### New API Endpoints

**Employee Endpoints:**
- `GET /api/onboarding/pending-policies` - Get all pending policy acknowledgements for current user
- `POST /api/onboarding/policy/standalone-start-reading` - Record when user starts reading a policy
- `POST /api/onboarding/policy/standalone-accept` - Accept a standalone policy assignment

**Admin Endpoints:**
- `POST /api/onboarding/admin/assign-policy-to-users` - Assign policy to specific users
- `POST /api/onboarding/admin/assign-policy-to-all` - Assign policy to all active employees

#### Controller Functions

Located in `backend/controllers/onboardingController.js`:

- `assignPolicyToUsers()` - Handles policy assignment to specific users
- `assignPolicyToAll()` - Bulk assigns policy to all employees
- `getPendingPolicies()` - Returns pending policies for current user
- `standaloneAcceptPolicy()` - Processes policy acceptance
- `standaloneStartReading()` - Records reading start time

#### Models

Uses existing `PolicyAcceptanceLog` model with enhanced fields:
- `accepted` - Boolean flag for acceptance status
- `status` - 'pending', 'in_progress', 'completed'
- `profileDeadline` - Acknowledgement deadline
- `timeline` - Audit trail of all events

### Frontend Components

#### New Components

1. **PolicyAssignmentModal** (`frontend/src/components/admin/PolicyAssignmentModal.jsx`)
   - Admin interface for assigning policies
   - Select policy, employees, and deadline
   - Bulk assignment options
   - Success/failure reporting

2. **StandalonePolicyModal** (`frontend/src/components/onboarding/StandalonePolicyModal.jsx`)
   - Employee-facing policy review modal
   - PDF viewer integration
   - Reading time tracking
   - Acknowledgement checkbox

3. **PendingPolicyBanner** (`frontend/src/components/PendingPolicyBanner.jsx`)
   - Dashboard alert for pending policies
   - Shows count and deadlines
   - Quick access to review

#### Context Updates

Enhanced `OnboardingContext` (`frontend/src/context/OnboardingContext.jsx`):
- `pendingPolicies` - Array of pending policy assignments
- `loadPendingPolicies()` - Fetches pending policies
- `acceptStandalonePolicy()` - Accepts a policy
- `openStandalonePolicyModal()` - Opens review modal
- `closeStandalonePolicyModal()` - Closes review modal

#### Integration Points

- **App.jsx** - StandalonePolicyModal rendered globally
- **EmployeeDashboardPage.jsx** - PendingPolicyBanner displayed
- **AdminPoliciesPage.jsx** - "Assign Policy" button in Compliance tab

## Usage Guide

### For Administrators

#### Assigning a Policy to Specific Employees:

1. Navigate to **Admin → Policies → Onboarding Compliance** tab
2. Click **"Assign Policy to Employees"** button
3. Select the policy from the dropdown
4. Choose specific employees using the autocomplete field
5. Set the acknowledgement deadline
6. Click **"Assign Policy"**

#### Assigning a Policy to All Employees:

1. Follow steps 1-2 above
2. Toggle **"Assign to All Active Employees"** switch
3. Set the acknowledgement deadline
4. Click **"Assign Policy"**

#### Monitoring Compliance:

1. Navigate to **Admin → Policies → Onboarding Compliance** tab
2. View the compliance dashboard with:
   - Pending acknowledgements
   - Overdue items
   - Completed acknowledgements
   - Reading time statistics

### For Employees

#### Acknowledging a Policy:

1. When a policy is assigned, a banner appears on the dashboard
2. Click **"Review Now"** or access via notification
3. Read the policy document (minimum 60 seconds)
4. Scroll to the bottom of the document
5. Check the acknowledgement checkbox
6. Click **"Accept & Acknowledge"**

#### Viewing Pending Policies:

- Dashboard banner shows count and list of pending policies
- Red alert if any are overdue
- Click to review immediately or defer to later

## Data Flow

### Policy Assignment Flow

```
Admin Action → Backend Controller → Create PolicyAcceptanceLog
    ↓
Notification Service → Email/Push Notification
    ↓
Employee Dashboard → Banner Display
    ↓
Employee Opens Modal → Policy Viewer
    ↓
Employee Accepts → Backend Validation → Update Log
    ↓
Confirmation Notification → Dashboard Refresh
```

### Status Lifecycle

1. **Pending** - Policy assigned, not yet opened
2. **In Progress** - Employee has opened the policy
3. **Completed** - Employee has acknowledged the policy

### Timeline Events

Each policy acceptance log maintains a detailed timeline:
- `policy_assigned` - Initial assignment
- `policy_reassigned` - Deadline updated
- `reading_started` - Employee opened document
- `reading_completed` - Employee finished reading
- `policy_accepted` - Employee acknowledged

## Validation Rules

### Backend Validations

1. **Reading Time**: Minimum 60 seconds
2. **Scroll Validation**: Must scroll to bottom
3. **Checkbox**: Must explicitly acknowledge
4. **Policy Version**: Must match current version
5. **Policy Status**: Must be active

### Frontend Validations

1. Real-time reading timer
2. Scroll position tracking
3. Checkbox state validation
4. Error messaging for incomplete requirements

## Notifications

### Email Notifications

Sent via `NewNotificationService`:

1. **Assignment Notification**
   - Type: `policy_assignment`
   - Priority: `high`
   - Contains policy name and deadline

2. **Acceptance Confirmation**
   - Type: `policy_accepted`
   - Priority: `medium`
   - Confirms successful acknowledgement

### In-App Notifications

- Dashboard banner (persistent until acknowledged)
- Notification drawer item
- Badge count on relevant pages

## Security Considerations

1. **Authentication**: All endpoints require valid JWT
2. **Authorization**: 
   - Admin/HR roles for assignment
   - User can only access their own pending policies
3. **Audit Trail**: Complete timeline in PolicyAcceptanceLog
4. **IP Tracking**: Records IP address on acceptance
5. **User Agent**: Stores browser/device information

## Performance Optimizations

1. **Lazy Loading**: Policy documents loaded on-demand
2. **Caching**: Pending policies cached in context
3. **Bulk Operations**: Efficient batch processing for mass assignments
4. **Index Optimization**: Database indexes on userId, policyId, accepted status

## Troubleshooting

### Common Issues

**Issue: Employee doesn't see pending policy**
- Check PolicyAcceptanceLog exists for user
- Verify policy status is 'Active'
- Ensure `accepted` is false in log

**Issue: Assignment fails for some users**
- Check user role (must be Employee or Intern)
- Verify user isActive = true
- Check error logs for specific failures

**Issue: Acknowledgement fails**
- Ensure reading time >= 60 seconds
- Verify scrolledToBottom = true
- Check policy version matches

## Future Enhancements

Potential improvements:
1. Department-specific policy assignment
2. Multi-policy acknowledgement flow
3. Policy expiration and re-acknowledgement
4. Signature capture for critical policies
5. Quiz/assessment integration
6. Automated reminders for pending policies

## Migration Notes

### From Hardcoded to Dynamic

The original system only supported onboarding acknowledgement for new employees created after a specific date (`ONBOARDING_FEATURE_START_DATE`). 

This feature extends the system to:
- Allow acknowledgement for any employee, regardless of join date
- Separate policy acknowledgement from full onboarding flow
- Enable ongoing policy updates and compliance tracking

### Backward Compatibility

- Existing onboarding flow remains unchanged
- New employees still follow the original onboarding → policy → tour → profile flow
- Existing employees use the new standalone acknowledgement flow
- Both systems use the same PolicyAcceptanceLog model

## Testing

### Manual Testing Checklist

**Admin Functions:**
- [ ] Assign policy to single employee
- [ ] Assign policy to multiple employees
- [ ] Assign policy to all employees
- [ ] View compliance dashboard
- [ ] Export compliance report

**Employee Functions:**
- [ ] View pending policy banner
- [ ] Open policy modal from banner
- [ ] Read policy (verify timer)
- [ ] Attempt to accept without scrolling (should fail)
- [ ] Scroll to bottom and accept
- [ ] Verify banner disappears after acceptance

**Edge Cases:**
- [ ] Assign same policy twice to same user
- [ ] Assign policy to inactive user
- [ ] Accept policy with insufficient reading time
- [ ] Close modal without accepting (should remain pending)

## API Reference

### Request Examples

**Assign to specific users:**
```javascript
POST /api/onboarding/admin/assign-policy-to-users
{
  "policyId": "507f1f77bcf86cd799439011",
  "userIds": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"],
  "deadline": "2026-08-20T23:59:59.000Z"
}
```

**Accept policy:**
```javascript
POST /api/onboarding/policy/standalone-accept
{
  "logId": "507f1f77bcf86cd799439014",
  "policyId": "507f1f77bcf86cd799439011",
  "policyVersion": "1.0",
  "checkboxAcknowledged": true,
  "readingDurationSeconds": 120,
  "scrolledToBottom": true
}
```

### Response Examples

**Assignment success:**
```json
{
  "message": "Policy assignment completed.",
  "results": {
    "success": [
      { "userId": "...", "userName": "John Doe", "status": "assigned" }
    ],
    "alreadyAccepted": [],
    "failed": []
  }
}
```

**Pending policies:**
```json
{
  "pendingPolicies": [
    {
      "logId": "507f1f77bcf86cd799439014",
      "policyId": "507f1f77bcf86cd799439011",
      "policyName": "Code of Conduct",
      "policyVersion": "2.0",
      "deadline": "2026-08-20T23:59:59.000Z",
      "assignedAt": "2026-08-13T10:00:00.000Z"
    }
  ]
}
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend logs in `backend/logs/`
3. Check browser console for frontend errors
4. Verify database PolicyAcceptanceLog collection

---

**Last Updated**: August 13, 2026
**Version**: 1.0.0
