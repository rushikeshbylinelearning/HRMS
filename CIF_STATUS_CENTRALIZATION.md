# CIF Status Centralization - Summary

## Problem
The CIF status values were hardcoded in multiple places across the frontend and backend, making it difficult to maintain and update status options.

## Solution
Created centralized constants files to manage all CIF-related enums and configurations.

## Changes Made

### 1. Frontend Constants File
**File:** `frontend/src/constants/cifConstants.js`

Created a centralized constants file containing:
- `CIF_STATUSES` - Array of status objects with value and label
- `STATUS_LABELS` - Object mapping status values to labels
- `STATUS_COLORS` - Object mapping status values to colors
- `STATUS_TRANSITIONS` - Object defining allowed status transitions
- `CIF_CATEGORIES` - Array of category options
- `CIF_SEVERITIES` - Array of severity options
- `CONFIDENTIAL_LEVELS` - Array of confidential level options
- `getStatusColor()` - Utility function to get status color

### 2. Backend Constants File
**File:** `backend/modules/cif/cif.constants.js`

Created a centralized constants file containing:
- `CIF_STATUSES` - Array of status values
- `CIF_CATEGORIES` - Array of category values
- `CIF_SEVERITIES` - Array of severity values
- `CONFIDENTIAL_LEVELS` - Array of confidential level values

### 3. Updated Files

#### Frontend Components:
1. **CIFDrawer.jsx** - Now imports constants from `cifConstants.js`
2. **CIFFilterPanel.jsx** - Now imports constants from `cifConstants.js`
3. **StatusChangeModal.jsx** - Now imports `STATUS_TRANSITIONS` and `STATUS_LABELS` from `cifConstants.js`

#### Backend Files:
1. **cif.model.js** - Now imports and uses constants from `cif.constants.js` for enum definitions

## Benefits

1. **Single Source of Truth**: All status values are defined in one place
2. **Easy Maintenance**: To add/modify a status, only update the constants file
3. **Consistency**: Frontend and backend use the same status values
4. **Type Safety**: Reduces risk of typos and inconsistencies
5. **Reusability**: Constants can be imported anywhere they're needed

## How to Add a New Status

### Frontend:
1. Open `frontend/src/constants/cifConstants.js`
2. Add the new status to `CIF_STATUSES` array
3. Add the label to `STATUS_LABELS` object
4. Add the color to `STATUS_COLORS` object
5. Update `STATUS_TRANSITIONS` to define allowed transitions

### Backend:
1. Open `backend/modules/cif/cif.constants.js`
2. Add the new status to `CIF_STATUSES` array

That's it! The new status will automatically be available in all components.

## Example: Adding a "pending_approval" Status

### Frontend (`frontend/src/constants/cifConstants.js`):
```javascript
export const CIF_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' }, // NEW
  { value: 'open', label: 'Open' },
  // ... rest
];

export const STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending Approval', // NEW
  open: 'Open',
  // ... rest
};

export const STATUS_COLORS = {
  draft: '#9CA3AF',
  pending_approval: '#3B82F6', // NEW
  open: '#DC2626',
  // ... rest
};

export const STATUS_TRANSITIONS = {
  draft: ['pending_approval'], // UPDATED
  pending_approval: ['open', 'draft'], // NEW
  open: ['under_review', 'escalated', 'resolved', 'closed'],
  // ... rest
};
```

### Backend (`backend/modules/cif/cif.constants.js`):
```javascript
const CIF_STATUSES = [
  'draft',
  'pending_approval', // NEW
  'open',
  'under_review',
  // ... rest
];
```

## Testing
All files have been validated with no diagnostic errors.
