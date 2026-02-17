# CIF Drawer Status Update Fix

## Problem
The status field in the CIF Drawer component was not editable, preventing users from updating the status when editing a CIF record.

## Solution
Updated the CIFDrawer component to:
1. Make the status field editable in edit mode
2. Implement proper status transition validation
3. Show only allowed status transitions based on current status
4. Add validation for required fields based on status

## Changes Made

### 1. Import STATUS_TRANSITIONS
Added `STATUS_TRANSITIONS` to the imports from `cifConstants.js`:
```javascript
import { CIF_CATEGORIES, CIF_SEVERITIES, CIF_STATUSES, STATUS_TRANSITIONS } from '../../constants/cifConstants';
```

### 2. Added availableStatuses Logic
Created a memoized function to determine which statuses should be shown in the dropdown:

```javascript
const availableStatuses = useMemo(() => {
  if (mode === 'create') {
    // For new records, allow draft and open
    return STATUSES.filter(s => ['draft', 'open'].includes(s.value));
  }
  
  if (isEdit && record?.status) {
    // For editing, show current status + allowed transitions
    const currentStatus = record.status;
    const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
    
    return STATUSES.filter(s => 
      s.value === currentStatus || allowedTransitions.includes(s.value)
    );
  }
  
  // Default: show all statuses
  return STATUSES;
}, [mode, isEdit, record?.status]);
```

### 3. Enhanced Validation
Updated the `validate` function to:
- Validate status transitions are allowed
- Require resolution notes when closing a case

```javascript
// Validate status transitions
if (isEdit && record?.status) {
  const currentStatus = record.status;
  const newStatus = formData.status;
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  
  if (newStatus !== currentStatus && !allowedTransitions.includes(newStatus)) {
    newErrors.status = `Cannot transition from ${currentStatus} to ${newStatus}`;
  }
}

// Require resolution notes when closing
if (formData.status === 'closed' && !formData.resolutionNotes?.trim()) {
  newErrors.resolutionNotes = 'Resolution notes are required before closing the case';
}
```

### 4. Updated Status Field
- Status field is now editable (not disabled in edit mode)
- Shows only allowed status transitions
- Displays helpful text showing current status
- Shows validation errors

```javascript
<TextField
  select
  label="Status"
  fullWidth
  value={formData.status}
  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
  disabled={isReadOnly}
  error={!!errors.status}
  helperText={
    errors.status ||
    (isEdit && record?.status 
      ? `Current: ${STATUSES.find(s => s.value === record.status)?.label || record.status}` 
      : 'Select initial status')
  }
>
  {availableStatuses.map((status) => (
    <MenuItem key={status.value} value={status.value}>
      {status.label}
    </MenuItem>
  ))}
</TextField>
```

### 5. Updated Resolution Notes Field
- Made required when status is 'closed'
- Shows dynamic helper text based on status
- Displays validation errors

```javascript
<TextField
  label="Resolution Notes"
  fullWidth
  multiline
  rows={3}
  value={formData.resolutionNotes}
  onChange={(e) => setFormData({ ...formData, resolutionNotes: e.target.value })}
  disabled={isReadOnly}
  required={formData.status === 'closed'}
  error={!!errors.resolutionNotes}
  helperText={
    errors.resolutionNotes || 
    (formData.status === 'closed' 
      ? 'Required before closing the case' 
      : 'Optional - Add notes about resolution or actions taken')
  }
/>
```

## Behavior

### Creating a New CIF Record
- Status dropdown shows: "Draft" and "Open"
- Default status is "Open"

### Editing an Existing CIF Record
- Status dropdown shows: Current status + allowed transitions
- Example: If current status is "Open", dropdown shows:
  - Open (current)
  - Under Review
  - Escalated
  - Resolved
  - Closed

### Status Transition Rules
Based on `STATUS_TRANSITIONS` in `cifConstants.js`:
- **Draft** → Open
- **Open** → Under Review, Escalated, Resolved, Closed
- **Under Review** → Open, Escalated, Resolved, Closed
- **Escalated** → Under Review, Resolved, Closed
- **Resolved** → Under Review, Closed
- **Closed** → Under Review (reopening)
- **Archived** → No transitions allowed

### Validation Rules
1. Status transitions must follow allowed paths
2. Resolution notes are required when status is "Closed"
3. Cannot transition to a status not in the allowed list

## Benefits

1. **User-Friendly**: Users can now update status directly from the drawer
2. **Controlled Transitions**: Only valid status transitions are allowed
3. **Data Integrity**: Validation ensures required fields are filled
4. **Clear Feedback**: Helper text and error messages guide users
5. **Consistent**: Uses centralized constants for status management

## Testing
- All diagnostics passed with no errors
- Status field is editable in edit mode
- Only allowed transitions are shown
- Validation works correctly
