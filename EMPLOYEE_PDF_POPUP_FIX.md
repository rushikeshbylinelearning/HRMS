# Employee PDF Viewer Popup Fix

## Problem

On the employee side (Profile page), when clicking a policy, the PDF viewer was replacing the policies list in the same card instead of opening as a popup/dialog.

### Before (Incorrect Behavior)

```
User clicks policy
  ↓
PolicyViewer replaces PolicyList in the same card
  ↓
Anonymous Feedback section disappears
  ↓
User has to close viewer to see list again ❌
```

### After (Correct Behavior)

```
User clicks policy
  ↓
Dialog opens with PDF viewer
  ↓
Policies list remains visible in background
  ↓
Anonymous Feedback section remains visible
  ↓
User can close dialog to return to list ✅
```

## Solution

Updated the ProfilePage component to use a Material-UI Dialog for the PDF viewer instead of inline replacement.

### Changes Made

**File**: `frontend/src/pages/ProfilePage.jsx`

#### 1. Added Dialog Import

```javascript
import { 
  Box, Container, Typography, Avatar, Grid, Stack, 
  TextField, Button, Snackbar, Alert, Chip, IconButton, 
  Dialog, DialogContent  // ← Added Dialog and DialogContent
} from '@mui/material';
```

#### 2. Added Dialog State

```javascript
const [viewerDialogOpen, setViewerDialogOpen] = useState(false);
```

#### 3. Updated Click Handler

```javascript
const handlePolicyClick = (policy) => {
    setSelectedPolicy(policy);
    setViewerDialogOpen(true);  // ← Open dialog
};

const handleClosePolicyViewer = () => {
    setSelectedPolicy(null);
    setViewerDialogOpen(false);  // ← Close dialog
};
```

#### 4. Changed UI Structure

**Before:**
```jsx
{selectedPolicy ? (
    <PolicyViewer policy={selectedPolicy} onClose={handleClosePolicyViewer} />
) : (
    <PolicyList policies={policies} onPolicyClick={handlePolicyClick} />
)}
```

**After:**
```jsx
{/* Always show PolicyList */}
<PolicyList policies={policies} onPolicyClick={handlePolicyClick} />

{/* Separate Dialog for PolicyViewer */}
<Dialog open={viewerDialogOpen} onClose={handleClosePolicyViewer}>
    <DialogContent>
        <PolicyViewer policy={selectedPolicy} onClose={handleClosePolicyViewer} />
    </DialogContent>
</Dialog>
```

## UI Improvements

### Dialog Configuration

```javascript
<Dialog
    open={viewerDialogOpen}
    onClose={handleClosePolicyViewer}
    maxWidth="lg"              // Large dialog
    fullWidth                  // Full width within max
    PaperProps={{
        sx: { 
            height: '85vh',    // 85% of viewport height
            maxHeight: '85vh'  // Maximum height
        }
    }}
>
```

### Benefits

1. **Better UX**: Policies list always visible
2. **Larger View**: Dialog provides more space for PDF
3. **Clear Context**: User knows they're viewing a policy
4. **Easy Close**: Click outside or X button to close
5. **Consistent**: Matches admin side behavior

## Visual Comparison

### Before (Inline Viewer)

```
┌─────────────────────────────────┐
│ Policies & Anonymous Feedback  │
├─────────────────────────────────┤
│                                 │
│ [PDF Viewer Takes Over]         │
│                                 │
│ [Close Button]                  │
│                                 │
│ (List and Feedback Hidden)      │
│                                 │
└─────────────────────────────────┘
```

### After (Dialog Popup)

```
Background (Still Visible):
┌─────────────────────────────────┐
│ Policies & Anonymous Feedback  │
├─────────────────────────────────┤
│ Company Policies                │
│ ┌─────────────────────────────┐ │
│ │ 📄 Policy 1                 │ │
│ │ 📄 Policy 2                 │ │
│ └─────────────────────────────┘ │
│                                 │
│ Anonymous Message               │
│ [Textarea]                      │
└─────────────────────────────────┘

Foreground (Dialog):
┌───────────────────────────────────────┐
│ Leave Policies v1.1          [X]      │
├───────────────────────────────────────┤
│                                       │
│     [PDF Content Displayed Here]      │
│                                       │
│                                       │
└───────────────────────────────────────┘
```

## Testing

### Test Steps

1. **Navigate to Profile Page**
   ```
   http://localhost:5173/profile
   ```

2. **Click on a Policy**
   - Click any policy in the "Company Policies" list
   - **Expected**: Dialog opens with PDF viewer

3. **Verify Dialog Behavior**
   - PDF displays in dialog
   - Policies list still visible in background (dimmed)
   - Anonymous feedback section still visible
   - Close button (X) works
   - Clicking outside dialog closes it

4. **Test Multiple Policies**
   - Close dialog
   - Click different policy
   - **Expected**: Dialog opens with new PDF

### Success Criteria

✅ Dialog opens when clicking policy  
✅ PDF displays correctly in dialog  
✅ Policies list remains visible in background  
✅ Anonymous feedback section remains visible  
✅ Close button works  
✅ Click outside closes dialog  
✅ Can open different policies  

## Comparison with Admin Side

Both admin and employee sides now use the same Dialog approach:

### Admin Side (AdminPoliciesPage.jsx)
```jsx
<Dialog open={viewerOpen} onClose={() => setViewerOpen(false)}>
    <DialogContent>
        <PolicyViewer policy={selectedPolicy} onClose={...} />
    </DialogContent>
</Dialog>
```

### Employee Side (ProfilePage.jsx)
```jsx
<Dialog open={viewerDialogOpen} onClose={handleClosePolicyViewer}>
    <DialogContent>
        <PolicyViewer policy={selectedPolicy} onClose={...} />
    </DialogContent>
</Dialog>
```

**Result**: Consistent behavior across both views! ✅

## Files Changed

1. **frontend/src/pages/ProfilePage.jsx**
   - Added Dialog and DialogContent imports
   - Added viewerDialogOpen state
   - Updated handlePolicyClick to open dialog
   - Updated handleClosePolicyViewer to close dialog
   - Changed UI to always show list + separate dialog
   - Removed conditional rendering of PolicyViewer inline

## No Changes Needed

- ✅ PolicyViewer component (works as-is)
- ✅ PolicyList component (works as-is)
- ✅ AnonymousFeedbackBox component (works as-is)
- ✅ Backend routes (no changes)
- ✅ CSS styles (no changes)

## Benefits

1. **Better User Experience**
   - Policies list always accessible
   - Larger viewing area for PDFs
   - Clear visual separation

2. **Consistent Design**
   - Matches admin side behavior
   - Follows Material-UI patterns
   - Professional appearance

3. **Improved Usability**
   - Easy to close (multiple methods)
   - Can quickly switch between policies
   - No loss of context

## Status

🟢 **RESOLVED** - PDF viewer now opens as a popup dialog on the employee side.

---

**Fixed By**: AI Assistant  
**Date**: February 10, 2026  
**Issue**: PDF viewer replacing list instead of opening as popup  
**Solution**: Use Material-UI Dialog component for PDF viewer
