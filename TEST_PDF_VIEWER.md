# PDF Viewer Testing Guide

## Quick Test Steps

### 1. Restart Servers

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### 2. Upload a Test Policy

1. Navigate to: `http://localhost:5173/admin/policies`
2. Click "Select PDF File"
3. Choose any PDF file
4. Fill in:
   - Policy Name: "Test Policy"
   - Version: "1.0" (or enable auto-generate)
   - Effective From: Today's date
5. Click "Upload Policy"
6. Verify success message appears

### 3. Test Admin View

1. In the policies table, find your uploaded policy
2. Click the eye icon (👁️)
3. **Expected Result**: PDF displays in dialog
4. **If Failed**: See troubleshooting below

### 4. Test Employee View

1. Navigate to: `http://localhost:5173/profile`
2. Look at the right sidebar
3. Click on the policy you just uploaded
4. **Expected Result**: PDF displays in embedded viewer
5. **If Failed**: See troubleshooting below

## What to Look For

### ✅ Success Indicators

- PDF content is visible in iframe
- No error messages in browser console
- No "web application" showing in iframe
- PDF toolbar may appear (browser-dependent)

### ❌ Failure Indicators

- Iframe shows the web application
- Blank iframe
- Console errors about CORS
- 404 Not Found errors
- "Backend server is not available" message

## Troubleshooting

### Issue: Iframe Shows Web Application

**Cause**: Vite proxy not working or backend not serving files

**Fix**:
1. Restart both servers
2. Check backend logs for errors
3. Verify file exists:
   ```bash
   ls -la backend/public/policies/
   ```

### Issue: 404 Not Found

**Cause**: File path incorrect or static route not registered

**Fix**:
1. Check database entry:
   ```javascript
   // In MongoDB shell
   db.policies.findOne()
   // Check fileUrl field
   ```
2. Verify backend static route in server.js
3. Restart backend server

### Issue: Blank Iframe

**Cause**: PDF file corrupted or browser can't display PDF

**Fix**:
1. Try opening PDF URL directly in browser:
   ```
   http://localhost:3001/policies/policy-xxx.pdf
   ```
2. If it downloads instead of displaying, browser doesn't support inline PDF
3. Try different browser (Chrome, Firefox, Edge)

### Issue: CORS Error

**Cause**: Proxy configuration issue

**Fix**:
1. Check Vite config has `changeOrigin: true`
2. Restart frontend dev server
3. Clear browser cache

## Browser Console Checks

### Expected Console Output

```
[Vite] connected.
[Axios] Token auto-restored from sessionStorage
```

### No Errors Should Appear

If you see errors like:
- `Failed to load resource: net::ERR_CONNECTION_REFUSED`
- `Cross-Origin Request Blocked`
- `404 Not Found`

Then the fix is not working correctly.

## Network Tab Checks

1. Open browser DevTools (F12)
2. Go to Network tab
3. Click on a policy to view
4. Look for request to `/policies/policy-xxx.pdf`

### Expected Network Request

```
Request URL: http://localhost:5173/policies/policy-xxx.pdf
Status: 200 OK
Type: application/pdf
```

### If Status is 404

- File doesn't exist or path is wrong
- Check backend logs
- Verify file in filesystem

### If Status is 503

- Backend server is not running
- Start backend server

## Direct URL Test

Test if backend serves PDFs directly:

1. Upload a policy
2. Note the filename from success message or database
3. Open in browser:
   ```
   http://localhost:3001/policies/policy-1234567890-123456789.pdf
   ```
4. PDF should display or download

If this works but iframe doesn't, the issue is with the proxy.

## Production Testing

After deploying to production:

1. Navigate to policies page
2. Click eye icon
3. Check Network tab for:
   ```
   Request URL: https://attendance.bylinelms.com/policies/policy-xxx.pdf
   Status: 200 OK
   ```

## Verification Checklist

- [ ] Backend server running on port 3001
- [ ] Frontend dev server running on port 5173
- [ ] Policy uploaded successfully
- [ ] File exists in `backend/public/policies/`
- [ ] Admin view displays PDF
- [ ] Employee view displays PDF
- [ ] No console errors
- [ ] Network request returns 200 OK
- [ ] Direct URL test works

## Success Criteria

✅ **All tests pass when:**
- PDF displays correctly in iframe
- No errors in console
- Works in both admin and employee views
- Works in different browsers

---

**Last Updated**: February 10, 2026  
**Status**: Ready for Testing
