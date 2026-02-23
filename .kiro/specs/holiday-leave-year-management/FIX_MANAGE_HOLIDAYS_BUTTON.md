# Fix: Manage Holidays Button Navigation

## Issue
When clicking the "Manage Holidays" button in the Admin Leaves page, an old modal popup was opening instead of navigating to the new Holiday Management page.

## Root Cause
The "Manage Holidays" button in `AdminLeavesPage.jsx` was still configured to open the legacy `HolidayManagerModal` component instead of navigating to the new `/admin/holidays` route.

## Changes Made

### File: `frontend/src/pages/AdminLeavesPage.jsx`

1. **Added `useNavigate` import:**
   ```jsx
   import { useSearchParams, useNavigate } from 'react-router-dom';
   ```

2. **Added `navigate` hook in component:**
   ```jsx
   const AdminLeavesPage = () => {
       const { user } = useAuth();
       const navigate = useNavigate();
       // ...
   ```

3. **Updated button onClick handler:**
   ```jsx
   // Before:
   onClick={() => setIsHolidayModalOpen(true)}
   
   // After:
   onClick={() => navigate('/admin/holidays')}
   ```

4. **Removed unused state:**
   ```jsx
   // Removed:
   const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
   ```

5. **Removed modal component usage:**
   ```jsx
   // Removed:
   <HolidayManagerModal open={isHolidayModalOpen} onClose={() => setIsHolidayModalOpen(false)} />
   ```

## Result
✅ Clicking "Manage Holidays" now navigates to `/admin/holidays` (the new Holiday Management page)
✅ No more legacy modal popup
✅ Clean navigation experience

## Note
The old `HolidayManagerModal` component definition is still present in the file but is no longer used. It can be safely removed in a future cleanup if desired, but it won't cause any issues being there unused.

## Testing
1. Navigate to Admin Leaves page
2. Click "Manage Holidays" button
3. Verify you're redirected to `/admin/holidays`
4. Verify the new Holiday Management page loads correctly

---

**Fixed on:** ${new Date().toISOString()}
