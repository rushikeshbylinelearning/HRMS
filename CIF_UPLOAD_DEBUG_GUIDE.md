# CIF Attachment Upload - Complete Debug Guide

## Current Status
- ✅ Backend code is correct (GridFS middleware)
- ✅ Frontend code is correct (FormData upload)
- ✅ Routes are configured correctly
- ❌ Upload not working - need to debug

## Step-by-Step Debugging

### Step 1: Verify Server is Running
```bash
pm2 status
```

Expected output:
```
│ server │ online │ 0 │
```

If not running:
```bash
pm2 restart all
```

### Step 2: Check if NODE_ENV is Set
```bash
# Windows CMD
type backend\.env | findstr NODE_ENV

# Windows PowerShell
Get-Content backend\.env | Select-String NODE_ENV
```

Expected output:
```
NODE_ENV=development
```

If missing, add it to `backend/.env`:
```
NODE_ENV=development
```

Then restart:
```bash
pm2 restart all
```

### Step 3: Test Upload with Browser DevTools

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Try uploading a file
4. Look for the request: `POST /api/admin/cif/:cifId/attachments`

#### Check Request:
- **Status Code:**
  - 200 = Success ✅
  - 400 = Bad request (check response)
  - 401 = Not authenticated
  - 403 = Not authorized (not Admin/HR)
  - 500 = Server error (check backend logs)
  - Failed/CORS = CORS issue

- **Request Headers:**
  - Should have: `Authorization: Bearer ...`
  - Should have: `Content-Type: multipart/form-data`

- **Request Payload:**
  - Should show: `attachments: (binary)`

#### Check Response:
- If 400: Read error message
- If 500: Check backend logs
- If CORS: NODE_ENV not set

### Step 4: Check Browser Console

Open DevTools (F12) → **Console** tab

Look for errors:
- ❌ "CORS error" → NODE_ENV issue
- ❌ "Network Error" → Backend not running
- ❌ "401 Unauthorized" → Token expired
- ❌ "403 Forbidden" → Not Admin/HR role

### Step 5: Check Backend Logs

```bash
# Real-time logs
pm2 logs

# Last 100 lines
pm2 logs --lines 100

# Filter for upload attempts
pm2 logs --lines 100 | findstr /i "upload attachment cif"
```

Look for:
- ✅ "Upload attachments request" → Request reached backend
- ✅ "Attachments created" → Upload successful
- ❌ "MongoDB not connected yet" → GridFS issue
- ❌ "No files uploaded" → Middleware issue
- ❌ "CORS" → CORS issue

### Step 6: Test with cURL

```bash
# Replace YOUR_TOKEN and YOUR_CIF_ID
curl -X POST http://localhost:3001/api/admin/cif/YOUR_CIF_ID/attachments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "attachments=@test.pdf"
```

Expected response:
```json
[
  {
    "_id": "...",
    "originalName": "test.pdf",
    "fileSize": 12345,
    ...
  }
]
```

## Common Issues & Fixes

### Issue 1: CORS Error
**Symptoms:**
- Browser console shows CORS error
- Network tab shows "CORS" or "Failed"

**Fix:**
1. Check `backend/.env` has `NODE_ENV=development`
2. Restart backend: `pm2 restart all`
3. Hard refresh browser: `Ctrl + Shift + R`

### Issue 2: "MongoDB not connected yet"
**Symptoms:**
- Backend logs show this error
- Upload fails with 500 error

**Fix:**
1. Check MongoDB connection in logs
2. Verify `MONGODB_URI` in `.env`
3. Restart backend: `pm2 restart all`

### Issue 3: "No files uploaded"
**Symptoms:**
- Upload button works but nothing happens
- Backend logs show "No files uploaded"

**Possible Causes:**
- Middleware not processing files
- FormData not being sent correctly

**Fix:**
1. Check browser Network tab → Request payload
2. Verify `Content-Type: multipart/form-data`
3. Check if files are in the payload

### Issue 4: 401 Unauthorized
**Symptoms:**
- Upload fails with 401 error
- Console shows "Authentication required"

**Fix:**
1. Check if logged in
2. Check token in localStorage
3. Try logging out and back in

### Issue 5: 403 Forbidden
**Symptoms:**
- Upload fails with 403 error
- Console shows "Access denied"

**Fix:**
- Only Admin and HR can upload CIF attachments
- Check your role in the system

### Issue 6: File Type Not Allowed
**Symptoms:**
- Upload fails with "Invalid file type" error

**Allowed Types:**
- Images: JPEG, JPG, PNG, GIF, WebP
- Documents: PDF, DOC, DOCX

**Fix:**
- Use allowed file types only
- Check file extension

### Issue 7: File Too Large
**Symptoms:**
- Upload fails with "File size exceeds limit" error

**Limits:**
- Max per file: 10MB
- Frontend validates before upload

**Fix:**
- Compress large files
- Split into multiple smaller files

## Detailed Flow Check

### Frontend Flow:
1. User clicks "Upload Files" button
2. File input opens
3. User selects file(s)
4. `handleFileSelect` function runs
5. Validates file types and sizes
6. Creates FormData
7. Appends files to FormData
8. Sends POST request to `/api/admin/cif/:cifId/attachments`

**Check Points:**
- [ ] File input opens?
- [ ] Files selected?
- [ ] Validation passes?
- [ ] FormData created?
- [ ] Request sent?

### Backend Flow:
1. Request hits `/api/admin/cif/:cifId/attachments`
2. `authenticateToken` middleware runs
3. `checkCIFAccess` middleware runs (Admin/HR only)
4. `uploadCIFAttachmentGridFS` middleware runs
   - Parses multipart data
   - Validates files
   - Uploads to GridFS
   - Sets `req.files`
5. `cifController.uploadAttachments` runs
   - Verifies CIF exists
   - Creates attachment records
   - Returns response

**Check Points:**
- [ ] Request reaches backend?
- [ ] Authentication passes?
- [ ] Authorization passes?
- [ ] Middleware processes files?
- [ ] GridFS upload succeeds?
- [ ] Database records created?
- [ ] Response sent?

## Testing Checklist

- [ ] Backend server running (`pm2 status`)
- [ ] NODE_ENV=development in `.env`
- [ ] Backend restarted after changes
- [ ] Browser hard refreshed
- [ ] Logged in as Admin or HR
- [ ] CIF record exists
- [ ] File type is allowed
- [ ] File size under 10MB
- [ ] No CORS errors in console
- [ ] No network errors in console
- [ ] Request appears in Network tab
- [ ] Request reaches backend (check logs)

## Success Indicators

✅ File input opens when clicking "Upload Files"
✅ Files can be selected
✅ No validation errors
✅ "Uploading..." text appears
✅ Network tab shows POST request
✅ Request status is 200 OK
✅ Backend logs show "Upload attachments request"
✅ Backend logs show "Attachments created"
✅ File appears in attachments list
✅ Can download the file
✅ Can preview the file (if image/PDF)

## If Still Not Working

### Collect Debug Information:

1. **Backend Logs:**
```bash
pm2 logs --lines 100 > backend-logs.txt
```

2. **Browser Console:**
- Screenshot of Console tab errors

3. **Network Tab:**
- Screenshot of failed request
- Request headers
- Request payload
- Response

4. **Environment:**
```bash
# Check .env file
type backend\.env

# Check server status
pm2 status

# Check Node version
node --version
```

5. **File Info:**
- What file are you trying to upload?
- File type?
- File size?

### Share This Information:
- Backend logs
- Browser console screenshot
- Network tab screenshot
- Environment info
- File info

## Quick Test Script

Create `test-cif-upload.js`:
```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const token = 'YOUR_TOKEN_HERE';
const cifId = 'YOUR_CIF_ID_HERE';
const filePath = './test.pdf';

const formData = new FormData();
formData.append('attachments', fs.createReadStream(filePath));

axios.post(`http://localhost:3001/api/admin/cif/${cifId}/attachments`, formData, {
  headers: {
    ...formData.getHeaders(),
    'Authorization': `Bearer ${token}`
  }
})
.then(response => {
  console.log('✅ Upload successful!');
  console.log(response.data);
})
.catch(error => {
  console.error('❌ Upload failed!');
  console.error(error.response?.data || error.message);
});
```

Run:
```bash
node test-cif-upload.js
```

---

**Most Common Fix:** Restart backend + hard refresh browser
```bash
pm2 restart all
# Then in browser: Ctrl + Shift + R
```
