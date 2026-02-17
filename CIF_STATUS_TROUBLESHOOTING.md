# CIF Status Change Troubleshooting

## Issue
Status change from "open" to "closed" not working - status stays as "OPEN" in the table.

## Checklist

### 1. Backend Server Restart ⚠️
The backend code has been updated but needs to be restarted to load the changes.

```bash
pm2 restart all
```

**Verify restart:**
```bash
pm2 logs --lines 20
```

Look for:
- ✅ "MongoDB connection ready"
- ✅ "Server started"
- ❌ No errors about "MongoDB not connected"

### 2. Frontend Refresh ⚠️
The frontend code has been updated but the browser needs to reload it.

**Option A: Hard Refresh (Recommended)**
- Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**Option B: Clear Cache**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Option C: Rebuild (if using production build)**
```bash
cd frontend
npm run build
```

### 3. Test Status Change

1. Open a CIF record (click the eye icon)
2. Click "Change Status" button
3. Check the dropdown - you should see:
   - ✅ Under Review
   - ✅ Escalated
   - ✅ Resolved
   - ✅ Closed (NEW!)
4. Select "Closed"
5. Enter a reason (required)
6. Click "Confirm"

### 4. Check Browser Console

Open DevTools (F12) → Console tab

**Look for errors:**
- ❌ CORS errors → Backend not restarted with NODE_ENV=development
- ❌ 404 errors → Wrong API endpoint
- ❌ 400/500 errors → Backend validation failing

**Expected successful request:**
```
PATCH /api/admin/cif/:id/status
Status: 200 OK
```

### 5. Check Network Tab

Open DevTools (F12) → Network tab

1. Try changing status
2. Look for request: `PATCH /api/admin/cif/.../status`
3. Check response:
   - ✅ Status 200 → Success
   - ❌ Status 400 → Validation error (check response body)
   - ❌ Status 500 → Server error (check backend logs)

## Common Issues

### Issue: "Closed" option not showing in dropdown
**Cause:** Frontend not refreshed
**Fix:** Hard refresh browser (Ctrl + Shift + R)

### Issue: "Invalid status transition" error
**Cause:** Backend not restarted
**Fix:** `pm2 restart all`

### Issue: "Resolution notes required" error
**Cause:** Old validation still active
**Fix:** 
1. Backend restarted? `pm2 restart all`
2. Provide a reason when closing (new requirement)

### Issue: Status changes but table doesn't update
**Cause:** Frontend not calling refresh after status change
**Fix:** This should work automatically. If not, manually refresh the page.

### Issue: CORS error
**Cause:** NODE_ENV not set to development
**Fix:** 
1. Check `backend/.env` has `NODE_ENV=development`
2. Restart backend: `pm2 restart all`

## Verification Steps

### Step 1: Verify Backend Changes
```bash
# Check if backend file has new transitions
grep -A 5 "STATUS_TRANSITIONS" backend/modules/cif/cif.service.js
```

Should show:
```javascript
open: ['under_review', 'escalated', 'resolved', 'closed'],
```

### Step 2: Verify Frontend Changes
```bash
# Check if frontend file has new transitions
grep -A 5 "STATUS_TRANSITIONS" frontend/src/components/CIF/StatusChangeModal.jsx
```

Should show:
```javascript
open: ['under_review', 'escalated', 'resolved', 'closed'],
```

### Step 3: Verify Server Running
```bash
pm2 status
```

Should show:
```
│ server │ online │
```

### Step 4: Test API Directly
```bash
# Get CIF details
curl http://localhost:3001/api/admin/cif/YOUR_CIF_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Change status
curl -X PATCH http://localhost:3001/api/admin/cif/YOUR_CIF_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"closed","reason":"Test closure"}'
```

## Still Not Working?

### Check Backend Logs
```bash
# Real-time logs
pm2 logs

# Last 100 lines
pm2 logs --lines 100

# Error logs only
pm2 logs --err
```

### Check Frontend Console
1. Open DevTools (F12)
2. Console tab
3. Try changing status
4. Look for errors

### Check Network Requests
1. Open DevTools (F12)
2. Network tab
3. Try changing status
4. Click on the PATCH request
5. Check:
   - Request payload
   - Response status
   - Response body

## Quick Fix Commands

```bash
# Full restart sequence
pm2 restart all
# Wait 5 seconds
# Then hard refresh browser (Ctrl + Shift + R)
```

## Success Indicators

✅ Backend logs show no errors
✅ Frontend console shows no errors
✅ Network tab shows 200 OK for PATCH request
✅ Status dropdown shows "Closed" option
✅ Status changes and table updates
✅ CIF detail modal shows new status

## Files Changed (For Reference)

**Backend:**
1. `backend/modules/cif/cif.service.js` - Line 23
2. `backend/modules/cif/cif.controller.js` - Line 380
3. `backend/.env` - Added NODE_ENV=development

**Frontend:**
1. `frontend/src/components/CIF/StatusChangeModal.jsx` - Line 19

---

**If still not working after all steps, please provide:**
1. Backend logs: `pm2 logs --lines 50`
2. Browser console errors (screenshot)
3. Network tab screenshot of the PATCH request
