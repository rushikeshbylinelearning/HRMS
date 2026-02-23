# Fix 404 Error - Browser Cache Issue

## Problem
The browser is showing a 404 error for:
```
PUT http://localhost:5173/api/admin/holidays/.../move 404
```

But the actual code in `HolidayManagementPage.jsx` line 146 is:
```javascript
await api.put(`/holidays/admin/${holidayToMove._id}/move`, { targetYearId });
```

This creates the correct path: `/api/holidays/admin/:id/move`

## Root Cause
The browser has cached the old JavaScript bundle that had the incorrect path `/api/admin/holidays/` instead of `/api/holidays/admin/`.

## Solution

### Step 1: Hard Refresh the Browser
1. Open the browser DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload" (Chrome) or "Hard Refresh" (Firefox)
4. Or use keyboard shortcut: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

### Step 2: Clear Vite Cache (if hard refresh doesn't work)
```bash
cd frontend
rm -rf node_modules/.vite
npm run dev
```

### Step 3: Verify the Fix
1. Open browser DevTools → Network tab
2. Try to move a holiday
3. Verify the request URL is: `PUT /api/holidays/admin/:id/move`
4. Should return 200 OK (or appropriate error if validation fails)

## Verification
The backend route is correctly configured:
- `server.js`: `app.use('/api/holidays', holidayRoutes);`
- `holidayRoutes.js`: `router.put('/admin/:id/move', ...)`
- Final path: `/api/holidays/admin/:id/move` ✓

The frontend code is correct:
- `HolidayManagementPage.jsx` line 146: `api.put('/holidays/admin/${id}/move')` ✓
- With baseURL `/api`, this becomes: `/api/holidays/admin/:id/move` ✓

## Status
✅ Code is correct
⚠️ Browser cache needs to be cleared
