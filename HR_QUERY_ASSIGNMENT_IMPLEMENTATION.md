# HR Query Assignment Feature Implementation

## Overview
This implementation makes the HR Query feature assignable to any user, similar to how the Live Board page works in the Manage Section. Admin users can now delegate HR query management access to specific employees.

## Changes Made

### Backend Changes

#### 1. Updated Models

##### `backend/models/HRQuery.js`
- Added `assignedToName` field to store the name of the assigned user
- This helps display assignment information without additional lookups

##### `backend/models/User.js`
- Added `canManageHRQueries: { type: Boolean, default: false }` to `featurePermissions`
- This permission allows non-Admin/HR users to manage HR queries when enabled

#### 2. New Middleware

##### `backend/middleware/requireHRQueryAccess.js`
- Created new middleware to check HR query management access
- Admin and HR users always have access
- Other users need `featurePermissions.canManageHRQueries = true`
- Similar pattern to `requireLiveAttendanceAccess.js`

#### 3. Updated Routes

##### `backend/routes/hrQueries.js`
- Added import for `requireHRQueryAccess` middleware
- Applied middleware to all admin/HR routes:
  - `GET /api/hr-queries/admin/all` - Get all queries
  - `POST /api/hr-queries/admin/:queryId/respond` - Respond to query
  - `PATCH /api/hr-queries/admin/:queryId` - Update query details
  - `GET /api/hr-queries/admin/stats/overview` - Get statistics
  - `PATCH /api/hr-queries/admin/resource-request/:requestId/status` - Update resource request
- Added new route `GET /api/hr-queries/admin/assignable-users` to get list of users who can be assigned queries
- Updated assignment logic to also store `assignedToName` when assigning queries

### Frontend Changes

#### 1. Updated Components

##### `frontend/src/components/MainLayout.jsx`
- Imported `usePermissions` hook
- Updated HRQueryFloatingChat visibility logic to include users with `canManageHRQueries` permission
- Changed from: `(user?.role === 'Admin' || user?.role === 'HR')`
- Changed to: `(user?.role === 'Admin' || user?.role === 'HR' || canAccess?.manageHRQueries?.())`
- Now delegated users can see the HR Query FAB button

##### `frontend/src/pages/ManageSectionPage.jsx`
- Added `canManageHRQueries: false` to default feature permissions (2 locations)
- Added `hrQueryEnabledCount` useMemo to count users with HR query access
- Added "HR Queries" card to overview statistics with SupportAgentIcon
- Added "Can Manage HR Queries" toggle switch in individual user edit section
- Added "Can Manage HR Queries" toggle in bulk settings section
- Imported `SupportAgent as SupportAgentIcon` from MUI icons

##### `frontend/src/hooks/usePermissions.jsx`
- Added `canManageHRQueries: false` to default permissions
- Added `manageHRQueries()` function to check if user can manage HR queries
- Returns true for Admin/HR roles
- Returns true for users with `permissions.canManageHRQueries === true`

#### 2. Permission Check Logic
The permission check follows this pattern:
```javascript
manageHRQueries: () => {
  if (['Admin', 'HR'].includes(user?.role)) {
    return true;
  }
  return permissions.canManageHRQueries === true;
}
```

## How It Works

### Assignment Flow
1. Admin goes to Manage Section page
2. Selects an employee to edit
3. Toggles "Can Manage HR Queries" switch ON
4. Employee now has access to HR Query management features
5. The employee appears in the "HR Queries" count in the overview dashboard

### Bulk Assignment
1. Admin can use "Bulk Update Settings" in Manage Section
2. Select multiple employees
3. Enable "Can Manage HR Queries" toggle
4. Apply to all selected employees at once

### Access Control
1. When delegated user accesses HR query routes, `requireHRQueryAccess` middleware checks:
   - Is user Admin or HR? → Allow
   - Is user active? → Continue
   - Does user have `featurePermissions.canManageHRQueries = true`? → Allow
   - Otherwise → Deny (403)

## Database Schema

### User.featurePermissions
```javascript
{
  // ... other permissions
  canManageHRQueries: { type: Boolean, default: false }
}
```

### HRQuery
```javascript
{
  assignedTo: { type: ObjectId, ref: 'User' },
  assignedToName: { type: String },
  // ... other fields
}
```

## API Endpoints Updated

| Method | Endpoint | Access Control | Description |
|--------|----------|----------------|-------------|
| GET | `/api/hr-queries/admin/all` | requireHRQueryAccess | Get all queries |
| POST | `/api/hr-queries/admin/:queryId/respond` | requireHRQueryAccess | Respond to query |
| PATCH | `/api/hr-queries/admin/:queryId` | requireHRQueryAccess | Update query details |
| GET | `/api/hr-queries/admin/stats/overview` | requireHRQueryAccess | Get statistics |
| GET | `/api/hr-queries/admin/assignable-users` | requireHRQueryAccess | Get assignable users |
| PATCH | `/api/hr-queries/admin/resource-request/:requestId/status` | requireHRQueryAccess | Update resource request |

## UI Components Updated

### ManageSectionPage
- Overview statistics card showing count of users with HR query access
- Individual user edit panel with HR query toggle
- Bulk settings panel with HR query toggle

### Permission Labels
- **Label**: "Can Manage HR Queries"
- **Description**: "View, respond to, and manage employee HR queries and resource requests"
- **Icon**: SupportAgentIcon (person with headset)
- **Color**: Follows theme (purple/indigo for active)

## Testing Checklist

- [ ] Admin can toggle HR query access for individual users
- [ ] Admin can bulk toggle HR query access for multiple users
- [ ] User with `canManageHRQueries = true` can access `/api/hr-queries/admin/*` endpoints
- [ ] User without permission gets 403 error
- [ ] Admin and HR can always access HR queries
- [ ] HR query count displays correctly in overview dashboard
- [ ] Assignment dropdown shows only eligible users
- [ ] Permission persists after logout/login
- [ ] Bulk update correctly applies to all selected users

## Future Enhancements

1. **Assignment Notifications**: Notify users when they're assigned an HR query
2. **Assignment History**: Track who assigned what and when
3. **Permission Audit Log**: Log when HR query permissions are granted/revoked
4. **Auto-Assignment Rules**: Automatically assign queries based on category or priority
5. **Workload Balancing**: Show query counts per assigned user to balance workload

## Related Files

### Backend
- `backend/models/HRQuery.js`
- `backend/models/User.js`
- `backend/middleware/requireHRQueryAccess.js`
- `backend/routes/hrQueries.js`

### Frontend
- `frontend/src/pages/ManageSectionPage.jsx`
- `frontend/src/hooks/usePermissions.jsx`
- `frontend/src/components/admin/HRQueryManagement.jsx` (existing, no changes)

## Notes

- This implementation follows the exact same pattern as Live Attendance access
- The middleware is role-aware and allows Admin/HR by default
- Regular employees need explicit permission grant
- Permission can be revoked at any time by toggling off the switch
- The feature integrates seamlessly with existing HR query management UI
