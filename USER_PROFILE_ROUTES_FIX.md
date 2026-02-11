# User Profile Routes 404 Fix

## Issue
When saving profile details, the frontend was getting a 404 error:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
api/user/update-profile
```

## Root Cause
There were TWO user route files in the backend:
1. `backend/routes/users.js` - Only had upload-avatar route
2. `backend/routes/userRoutes.js` - Had profile and update-profile routes

The `server.js` was importing `./routes/users` (users.js), but the profile routes were defined in `userRoutes.js`, which was not being used.

## Solution

### Updated `backend/routes/users.js`
Added the missing routes from `userRoutes.js`:

1. **GET /api/users/profile** - Get current user's profile
   - Fetches user data with populated shiftGroup
   - Manually populates reportingPerson (handles invalid ObjectIds)
   - Returns complete user profile including personalDetails, identityDetails, reportingPerson

2. **PUT /api/user/update-profile** - Update current user's profile
   - Updates personalDetails and identityDetails
   - Returns updated user data with populated fields

3. Added mongoose import for ObjectId validation

## Files Modified

1. **backend/routes/users.js**
   - Added mongoose import
   - Added GET /api/users/profile route
   - Added PUT /api/user/update-profile route
   - Both routes include manual population for reportingPerson

## Route Registration in server.js

```javascript
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);  // For /api/users/profile
app.use('/api/user', userRoutes);   // For /api/user/update-profile
```

## Expected Behavior

### Profile Page Load
1. User navigates to Profile page
2. Frontend calls GET /api/users/profile
3. Backend returns complete user data including:
   - Basic info (name, email, department, etc.)
   - personalDetails (blood group, phone, address, etc.)
   - identityDetails (aadhaar, PAN, bank details, etc.)
   - reportingPerson (populated with manager details)
4. Profile page displays all information

### Profile Save
1. User edits profile details (personal info, identity info)
2. User clicks "Save Details"
3. Frontend calls PUT /api/user/update-profile with payload
4. Backend updates personalDetails and identityDetails
5. Backend returns updated user data
6. Frontend shows success message
7. Profile page displays updated information

## Testing Checklist

- [x] Profile page loads without errors
- [x] Profile data displays correctly
- [x] Reporting person details show up
- [x] User can edit personal details
- [x] User can edit identity details
- [x] Save button works without 404 error
- [x] Success message shows after save
- [x] Updated data persists after page refresh

## Related Files

- `backend/routes/users.js` - Main user routes file (fixed)
- `backend/routes/userRoutes.js` - Duplicate file (not used, can be removed)
- `backend/server.js` - Route registration
- `frontend/src/pages/ProfilePage.jsx` - Profile page component
- `frontend/src/components/Profile/ProfileMain.jsx` - Profile form component

## Notes

- The `userRoutes.js` file is not being used and can be safely removed
- Both `/api/users` and `/api/user` prefixes are registered to support different route patterns
- Manual population for reportingPerson ensures graceful handling of invalid ObjectIds
- The routes now match the frontend API calls exactly
