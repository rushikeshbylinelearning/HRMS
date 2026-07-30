# KYC Upload Fix — Deployment Steps

## Quick Summary
**Problem:** "Network error during upload" caused by CORS preflight rejection when `Content-Type: application/pdf` header triggered OPTIONS request that B2's simple CORS UI couldn't satisfy.

**Solution:** Remove `ContentType` and `ContentLength` from `PutObjectCommand` so XHR sends a "simple request" with no custom headers → no preflight → no CORS issue.

---

## 1. Verify the Fix (BEFORE deploying)

**Run the test script:**
```bash
cd backend
node scripts/test-presigned-url-shape.js
```

**Expected output:**
```
✅ PASS: X-Amz-SignedHeaders = "host" (minimal, no CORS preflight triggers)
✅ PASS: No checksum params in URL
✅ PASS: No content-type in query params
✅ ALL CHECKS PASSED
```

If any check fails, **do not deploy** — review `backend/controllers/kycController.js` lines ~155 and ~472.

---

## 2. Deploy Backend

### Development/Testing:
```bash
cd backend
# No npm install needed — no dependency changes
pm2 restart backend
# OR: node server.js
```

### Production:
```bash
cd backend
# Pull latest code
git pull origin main

# Restart backend
pm2 restart backend

# Verify backend is running
pm2 logs backend --lines 20
```

---

## 3. Deploy Frontend

Frontend changes require a rebuild:

```bash
cd frontend
npm run build

# Deploy the dist/ folder to your hosting (Nginx/Apache/CDN)
# OR if using PM2 to serve:
pm2 restart frontend
```

---

## 4. B2 CORS Configuration

**Your current B2 CORS config (from screenshot) is CORRECT ✅**

**No changes needed** — the simple CORS UI with just `http://localhost:5173` as the origin is now sufficient.

**For production:**
1. Go to: https://secure.backblaze.com/b2_buckets.htm
2. Click on `byline-hr-docs` bucket
3. Bucket Settings → CORS Rules → Edit
4. Change origin from `http://localhost:5173` to `https://attendance.bylinelms.com`
5. Keep "Both" selected for APIs (B2 Native + S3 Compatible)
6. Click "Update CORS Rules"

**Changes take effect in ~1 minute**

---

## 5. Test the Upload Flow

### On Desktop (Chrome DevTools):
1. Open form: `http://localhost:5173/public-form?token=...`
2. Navigate to Step 5 (Documents)
3. Open DevTools → Network tab → filter by "PUT"
4. Upload a KYC document (e.g. Aadhaar PDF)
5. **Verify in Network tab:**
   - **No OPTIONS request before the PUT** ✅
   - PUT request URL has `X-Amz-SignedHeaders=host` in query string
   - Request Headers section has **NO `Content-Type` header**
   - Status: `200 OK`
6. Verify the file appears in B2 bucket

### On Safari/iOS (the original failing case):
1. Open the form on iPhone Safari
2. Upload a document
3. **Should complete successfully** (no "Network error during upload")

### On Mobile with Slow Connection:
1. DevTools → Network → Throttling → Slow 3G
2. Upload a 4-5 MB PDF
3. Should complete within 5 minutes (progress bar updates)

---

## 6. Monitor for Issues

After deployment, watch for:

**Backend logs:**
```bash
pm2 logs backend --lines 100
```

**Look for:**
- `[KYC] HeadObject failed` — means file didn't reach B2 (still failing)
- `[KYC] Size mismatch` — means partial upload or corruption
- `Failed to generate upload URL` — backend error before presigned URL

**Expected logs (normal operation):**
- `[KYC] publicRequestUpload` → generates presigned URL
- `[KYC] publicConfirmUpload` → verifies file in B2, creates DB record

**Frontend:**
- User reports "Network error" → check if CORS origin is correct in B2
- User reports "Upload timed out" → file too large or connection too slow
- User reports "Too many upload attempts" → rate limiter hit (429)

---

## 7. Rollback Plan

If uploads still fail after deployment:

### Quick Rollback (restore previous version):
```bash
cd backend
git log --oneline -5  # find commit hash before the fix
git checkout <previous-commit-hash> controllers/kycController.js
pm2 restart backend
```

### Alternative Fix (if CORS still an issue):
Set custom B2 CORS rules via CLI (see `KYC_UPLOAD_FIX_SUMMARY.md` section "Alternative: Custom CORS via B2 CLI")

---

## 8. Success Criteria

**Upload flow working correctly when:**
- ✅ Users can upload all 8 required KYC documents in one session
- ✅ Upload success rate >95% (some failures expected on poor connections)
- ✅ No "Network error during upload" on Safari/iOS
- ✅ Rate limiter doesn't block legitimate users (<1% 429 errors)
- ✅ DevTools shows no OPTIONS preflight before PUT
- ✅ Files appear in B2 bucket with correct size
- ✅ Backend logs show `HeadObject` success + DB record creation

---

## 9. Files Changed

| File | Change | Breaking? |
|------|--------|-----------|
| `backend/controllers/kycController.js` | Removed `ContentType` and `ContentLength` from `PutObjectCommand` | No — backward compatible |
| `backend/middleware/publicFormValidation.js` | Rate limiter 50→100, error format fix | No — only affects new requests |
| `frontend/src/pages/PublicProfileForm.jsx` | Removed `xhr.setRequestHeader('Content-Type', ...)`, added timeout | No — only affects KYC upload component |
| `backend/config/r2.js` | Comment updates only | No |
| `backend/scripts/test-presigned-url-shape.js` | New test script (not used in production) | No |

**No database migrations, no environment variable changes, no breaking changes to other features.**

---

## 10. Emergency Contacts

If issues persist, escalate to:
- **Backend team:** Check `getR2Client()` config, B2 credentials in `.env`
- **B2 support:** Check CORS config, bucket permissions, API limits
- **DevOps:** Check Nginx/proxy CORS headers (if behind proxy), SSL cert for B2 endpoint

---

**Deployment Date:** _________________  
**Deployed By:** _________________  
**Verification Checklist Completed:** ☐ Yes ☐ No  
**Production Upload Test Successful:** ☐ Yes ☐ No
