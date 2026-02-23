# Fix: 403 Forbidden Error

## Issue
API requests to `/api/admin/leave-years` were returning 403 Forbidden errors even for Admin/HR users.

## Root Cause
The authorization middleware in `leaveYearRoutes.js` and `holidayRoutes.js` was checking for `req.user.isAdmin` and `req.user.isHR` boolean flags, but the `authenticateToken` middleware sets `req.user.role` as a string ('Admin', 'HR', 'Employee').

This mismatch caused all users to be rejected, even those with Admin or HR roles.

## Files Fixed

### 1. `backend/routes/leaveYearRoutes.js`

**Before:**
```javascript
const isAdminOrHr = (req, res, next) => {
    if (!req.user || (!req.user.isAdmin && !req.user.isHR)) {
        return res.status(403).json({ 
            error: 'Forbidden',
            message: 'Only administrators and HR can manage leave years'
        });
    }
    next();
};
```

**After:**
```javascript
const isAdminOrHr = (req, res, next) => {
    if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'HR')) {
        return res.status(403).json({ 
            error: 'Forbidden',
            message: 'Only administrators and HR can manage leave years',
            userRole: req.user?.role || 'unknown'
        });
    }
    next();
};
```

### 2. `backend/routes/holidayRoutes.js`

**Before:**
```javascript
const isAdminOrHr = (req, res, next) => {
    if (!req.user || (!req.user.isAdmin && !req.user.isHR)) {
        return res.status(403).json({ 
            error: 'Forbidden',
            message: 'Only administrators and HR can manage holidays'
        });
    }
    next();
};
```

**After:**
```javascript
const isAdminOrHr = (req, res, next) => {
    if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'HR')) {
        return res.status(403).json({ 
            error: 'Forbidden',
            message: 'Only administrators and HR can manage holidays',
            userRole: req.user?.role || 'unknown'
        });
    }
    next();
};
```

## Key Changes

1. **Changed from boolean flags to role string comparison:**
   - `!req.user.isAdmin && !req.user.isHR` → `req.user.role !== 'Admin' && req.user.role !== 'HR'`

2. **Added debug information:**
   - Added `userRole` to error response for easier debugging

## How authenticateToken Sets User Data

From `backend/middleware/authenticateToken.js`:
```javascript
user = {
    userId: decoded.userId || decoded.id,
    email: decoded.email,
    role: decoded.role,  // ← String: 'Admin', 'HR', or 'Employee'
    authMethod: decoded.authMethod || 'local'
};
req.user = user;
```

## User Role Values

The `role` field in the database and JWT token uses these string values:
- `'Admin'` - Administrator with full access
- `'HR'` - HR personnel with management access
- `'Employee'` - Regular employee with limited access

## Testing

After these changes:
1. ✅ Admin users can access `/api/admin/leave-years`
2. ✅ HR users can access `/api/admin/leave-years`
3. ✅ Employee users receive 403 Forbidden (as expected)
4. ✅ Error response includes `userRole` for debugging

## Prevention

When creating authorization middleware, always check the actual structure of `req.user`:

```javascript
// ✅ CORRECT - Check role string
if (req.user.role !== 'Admin' && req.user.role !== 'HR') {
    return res.status(403).json({ error: 'Forbidden' });
}

// ❌ WRONG - Check non-existent boolean flags
if (!req.user.isAdmin && !req.user.isHR) {
    return res.status(403).json({ error: 'Forbidden' });
}
```

## Related Files

- `backend/middleware/authenticateToken.js` - Sets `req.user.role`
- `backend/models/User.js` - Defines role field as enum: ['Admin', 'HR', 'Employee']
- All route files should use consistent role checking

---

**Fixed on:** ${new Date().toISOString()}
