# Admin Leave Advance Notice Bypass Fix

## Issue
When admins tried to create or update leave requests via the admin panel, the system was enforcing advance notice requirements (e.g., 1 month notice for 3-day planned leaves, 4 days for casual leaves). This prevented admins from managing leaves retroactively or with short notice.

## Error Message
```
Planned leave of 3 working days requires at least 1 month advance notice. 
Please apply earlier or contact Admin if this is an emergency.
```

## Root Cause
The leave policy validation system (`LeavePolicyService.validateLeaveTypeSpecific`) was checking advance notice requirements for all leave requests, including those created or updated by admins. Admin operations should bypass these time-based restrictions.

## Solution
Added an `isAdminUpdate` flag that flows through the validation chain:

1. **backend/routes/admin.js** - Both POST and PUT endpoints now pass `isAdminUpdate: true`
2. **backend/services/LeavePolicyService.js** - Updated three functions:
   - `validateAdminUpdate()` - Accepts and passes the flag
   - `validateRequest()` - Accepts and passes the flag
   - `validateLeaveTypeSpecific()` - Checks the flag and skips advance notice validation for admin operations

## Changes Made

### 1. Admin Routes (backend/routes/admin.js)

#### POST /api/admin/leaves
```javascript
const validation = await LeavePolicyService.validateRequest(
    employee,
    leaveDatesArray,
    requestTypeNorm,
    leaveType,
    adminOverrideReason || `Admin-applied leave by user ID: ${req.user.userId}`,
    alternateDate ? parseISTDate(alternateDate) : null,
    { isAdminUpdate: true } // NEW: Bypass advance notice checks
);
```

#### PUT /api/admin/leaves/:id
```javascript
const policyResult = await LeavePolicyService.validateAdminUpdate(
    originalRequest,
    adminPayload,
    employee,
    { 
        adminOverrideReason: bodyToApply.overrideReason || bodyToApply.adminOverrideReason || 'Admin update',
        isAdminUpdate: true // NEW: Flag to bypass advance notice checks
    }
);
```

### 2. Leave Policy Service (backend/services/LeavePolicyService.js)

#### validateAdminUpdate()
```javascript
static async validateAdminUpdate(oldRequest, newRequest, employee, context = {}) {
    const { adminOverrideReason, isAdminUpdate } = context; // NEW: Extract flag
    // ...
    const policyCheck = await this.validateRequest(
        employee._id,
        newDates,
        newRequestType,
        newLeaveType,
        adminOverrideReason || `Admin update by admin`,
        newRequest.alternateDate ?? oldRequest.alternateDate,
        { 
            excludeRequestId: oldRequest._id, 
            appliedDate,
            isAdminUpdate // NEW: Pass flag down
        }
    );
}
```

#### validateRequest()
```javascript
static async validateRequest(employeeId, leaveDates, requestType, leaveType = 'Full Day', adminOverrideReason = null, alternateDate = null, options = {}) {
    const { excludeRequestId, appliedDate, isAdminUpdate } = options; // NEW: Extract flag
    // ...
    const typeSpecificCheck = await this.validateLeaveTypeSpecific(
        employee, leaveDates, requestType, leaveType, alternateDate, appliedDate, isAdminUpdate // NEW: Pass flag
    );
}
```

#### validateLeaveTypeSpecific()
```javascript
static async validateLeaveTypeSpecific(employee, leaveDates, requestType, leaveType, alternateDate = null, appliedDate = null, isAdminUpdate = false) {
    // ...
    switch (requestType) {
        case 'Casual':
            // ... employment status checks ...
            
            // NEW: Skip advance notice check for admin updates
            if (isAdminUpdate) {
                return { allowed: true };
            }
            
            // Base rule: Casual leave requires at least 4 days prior notice
            if (daysDiff < 4) {
                return { allowed: false, reason: '...' };
            }
            return { allowed: true };
            
        case 'Planned':
            // ... employment status checks ...
            
            // NEW: Skip advance notice check for admin updates
            if (isAdminUpdate) {
                return { allowed: true };
            }
            
            // INTELLIGENT PLANNED LEAVE HANDLING: Calculate working days...
            // ... advance notice validation ...
    }
}
```

## What Still Gets Validated
Even with `isAdminUpdate: true`, the following validations still apply:
- Employment status checks (Permanent vs Probation/Intern)
- Leave balance sufficiency
- Overlapping leave detection
- Monthly leave caps
- Compensatory leave alternate date requirements
- Saturday clubbing rules

## Testing
After restarting the backend server, admins should be able to:
1. Create new leave requests with any dates (past, present, or future)
2. Update existing leave requests without advance notice restrictions
3. Change leave types and dates retroactively

## Deployment
1. Restart the backend server to apply changes
2. Test admin leave creation/update functionality
3. Verify that employee leave applications still enforce advance notice rules
