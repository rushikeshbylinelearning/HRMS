# CIF Upload Quick Fix - Do This Now

## The Problem
CIF attachments not uploading.

## Most Likely Causes
1. Backend not restarted after code changes
2. Browser not refreshed after code changes
3. CORS issue (NODE_ENV not set)

## Quick Fix (Do These 3 Things)

### 1. Restart Backend
```bash
pm2 restart all
```

Wait 10 seconds, then verify:
```bash
pm2 logs --lines 20
```

Look for:
- ✅ "MongoDB connection ready"
- ✅ "Server started"

### 2. Hard Refresh Browser
Press: **Ctrl + Shift + R** (Windows) or **Cmd + Shift + R** (Mac)

Or:
1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

### 3. Test Upload

1. Go to CIF page
2. Click on a CIF record (eye icon)
3. Scroll to "Attachments" section
4. Click "Upload Files"
5. Select a small PDF or image file
6. Watch for:
   - ✅ "Uploading..." text appears
   - ✅ File appears in list after upload
   - ❌ Error message appears

## If It Still Doesn't Work

### Check Browser Console (F12)

**Console Tab** - Look for errors:
- "CORS error" → See Fix A below
- "Network Error" → Backend not running
- "401" → Not logged in
- "403" → Not Admin/HR role

**Network Tab** - Try upload and look for:
- Request: `POST /api/admin/cif/.../attachments`
- Status: Should be 200 (success)
- If failed: Click on it and check Response tab

### Fix A: CORS Error

1. Check `backend/.env` file has this line:
```
NODE_ENV=development
```

2. If missing, add it

3. Restart backend:
```bash
pm2 restart all
```

4. Hard refresh browser (Ctrl + Shift + R)

### Fix B: Check Backend Logs

```bash
pm2 logs --lines 50
```

Look for errors when you try to upload.

Common errors:
- "MongoDB not connected yet" → Restart backend
- "No files uploaded" → Check browser Network tab
- "CORS" → Add NODE_ENV=development

## Test with Small File First

Use a small test file:
- PDF under 1MB
- Or small image (JPG/PNG)

Don't test with:
- Very large files (>5MB)
- Unsupported file types
- Multiple files at once (test one first)

## Success Checklist

When upload works, you should see:
- ✅ "Uploading..." text appears
- ✅ Upload button disabled during upload
- ✅ File appears in attachments list
- ✅ Can click to preview (if image/PDF)
- ✅ Can download the file
- ✅ Can delete the file (if Admin/HR)

## Still Not Working?

Open browser DevTools (F12) and:

1. **Console tab** - Screenshot any errors
2. **Network tab** - Try upload, screenshot the failed request
3. **Share:**
   - Console screenshot
   - Network screenshot
   - What file you're trying to upload
   - Your role (Admin/HR/Employee)

---

**90% of the time, this fixes it:**
```bash
pm2 restart all
# Wait 10 seconds
# Then in browser: Ctrl + Shift + R
```
