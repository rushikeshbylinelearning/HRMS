# KYC Upload Fix Summary

**Date:** 2026-07-30 (Updated after production testing)
**Issue:** Intermittent "Network error during upload" when uploading KYC documents via public onboarding form

---

## Root Causes Identified

1. **ContentLength + ContentType in Signed Headers** (PRIMARY ROOT CAUSE)
   - `ContentLength` and `ContentType` in `PutObjectCommand` → both added to `X-Amz-SignedHeaders`
   - Browser XHR cannot set `Content-Length` (forbidden header per spec)
   - Setting `Content-Type` to non-plain-text MIME (e.g. `application/pdf`, `image/jpeg`) triggers **CORS preflight**
   - B2's simple CORS UI only allows origin config — does NOT set `AllowedHeaders`
   - Preflight OPTIONS request rejected by B2 → CORS error → `xhr.onerror` fires ("Network error")
   - Safari/WebKit also turns 403 `SignatureDoesNotMatch` into `onerror` when CORS headers missing

2. **Rate Limiter Too Restrictive** (SECONDARY)
   - 50 requests/15min shared across all KYC operations
   - Multiple retries + 8 required docs × 2 requests = 48+ requests
   - Shared mobile carrier NAT IPs compound the issue
   - Error response format didn't match frontend expectations

3. **AWS SDK Sub-Dependency Version Skew** (CONTRIBUTING)
   - `@aws-sdk/middleware-flexible-checksums@3.735.0` vs `client-s3@3.741.0`
   - Could cause intermittent checksum parameter injection despite `WHEN_REQUIRED` config

---

## Changes Made

### 1. Backend: Remove ContentType AND ContentLength from PutObjectCommand ✅

**File:** `backend/controllers/kycController.js`

**Changed:**
- Removed **both** `ContentType` and `ContentLength` from `PutObjectCommand` in:
  - `requestUpload` (authenticated route)
  - `publicRequestUpload` (public token route)
- Added detailed comments explaining the CORS preflight issue
- `X-Amz-SignedHeaders` will now only contain `host` — minimal signature, no forbidden/CORS-triggering headers

**Impact:** 
- No CORS preflight fired (PUT with no custom headers is a "simple request")
- No signature mismatch from `Content-Length`
- **B2's simple CORS UI (origin-only config) is now sufficient**
- Files will be stored without explicit `Content-Type` metadata in B2, but the MIME type is validated and stored in MongoDB

**Why this is safe:**
- MIME type is validated on both `request-upload` and `confirm-upload` endpoints
- MIME type is stored in MongoDB `EmployeeKycDocument.mimeType`
- When generating presigned GET URLs for download (future feature), the app can add `response-content-type` query param to override

---

### 2. Backend: Add File Size Verification ✅

**File:** `backend/controllers/kycController.js`

**Changed:**
- Enhanced `HeadObjectCommand` check in both `confirmUpload` and `publicConfirmUpload`
- Now verifies `headResult.ContentLength === parsedSize`
- Returns 400 with clear error message if size mismatch detected

**Impact:**
- Guards against partial uploads or corrupted transfers
- Provides clear error message to user

---

### 3. Backend: Increase Rate Limiter & Fix Error Format ✅

**File:** `backend/middleware/publicFormValidation.js`

**Changed:**
- Increased `kycUploadLimiterConfig.max` from 50 to 100 requests per 15 minutes
- Added custom `handler` that returns `{ error: "...", retryAfter: ... }` format
- Frontend error handler now recognizes both `.error` and `.message` fields

**Impact:**
- Accommodates retries and shared mobile IPs
- Provides clear "retry in X minutes" message to users

---

### 4. Frontend: Remove Content-Type Header from XHR ✅

**File:** `frontend/src/pages/PublicProfileForm.jsx`

**Changed:**
- Removed `xhr.setRequestHeader('Content-Type', mimeType)` call
- Added 5-minute XHR timeout (matches presigned URL expiry)
- Added `ontimeout` handler with user-friendly message
- Enhanced `onload` handler to parse B2 XML error responses
- Better error message extraction (checks both `.error` and `.message` fields)
- Shows retry countdown when rate-limited
- Added detailed comment explaining why NO headers are set

**Impact:**
- **XHR PUT with no custom headers = "simple request" in CORS spec**
- No OPTIONS preflight fired
- Works with B2's simple CORS UI (no `AllowedHeaders` config needed)
- Clearer error messages (e.g., "SignatureDoesNotMatch" vs generic "HTTP 403")
- Timeout prevents hung uploads on slow connections
- Rate limit errors show countdown timer

---

### 5. Backend: Enhanced R2 Config Documentation ✅

**File:** `backend/config/r2.js`

**Changed:**
- Added detailed comments linking checksum config to package pinning
- Clarified why `requestChecksumCalculation: 'WHEN_REQUIRED'` is critical for B2

**Impact:**
- Future developers understand why this config exists
- Prevents accidental removal during refactoring

---

## Testing Checklist

Before deploying to production:

- [ ] **CRITICAL:** Restart backend server after changes
- [ ] Test upload on desktop Chrome/Firefox (dev console → Network tab → verify presigned URL has `X-Amz-SignedHeaders=host` ONLY)
- [ ] Test upload on Safari (macOS + iOS) — this was the primary failing case
- [ ] Test upload on mobile Chrome with network throttling (Slow 3G)
- [ ] Test upload with 5MB file on throttled connection (ensure completes within 5 min)
- [ ] Test rapid retry (3-4 attempts) to verify rate limiter doesn't block legitimate use
- [ ] Test multiple concurrent users from same IP (simulate carrier-grade NAT)
- [ ] Verify all 8 required documents can be uploaded in one session
- [ ] Test upload → manually check B2 bucket → confirm file appears with correct size
- [ ] Test confirm-upload size mismatch: upload file, manually delete from B2, try to confirm → should reject with "File not found"
- [ ] **DevTools verification:** Network tab should show:
  - No OPTIONS preflight before PUT
  - PUT request has NO `Content-Type` header in Request Headers section
  - Presigned URL query string: `X-Amz-SignedHeaders=host` (NOT `content-type;host` or `content-length;host`)
  - No `x-amz-checksum-*` params in URL
- [ ] Backend logs: check for "Size mismatch" errors (should be none in normal operation)

---

## Rollback Plan

If issues persist after deployment:

1. **Immediate rollback:** Revert `kycController.js` changes
2. **Alternative fix:** Keep `ContentLength` removed, but also:
   - Add `Access-Control-Expose-Headers: *` to B2 CORS config
   - Add `Access-Control-Allow-Headers: content-length` to B2 CORS config

---

## B2 CORS Configuration — SIMPLE UI IS SUFFICIENT ✅

**IMPORTANT:** With the code changes above, B2's **simple CORS UI is now sufficient**. You do NOT need custom CORS rules via the B2 CLI/API.

**Your current config (from screenshot) is correct:**
- Origin: `http://localhost:5173` (for development)
- APIs: **Both** (B2 Native + S3 Compatible)

**For production, add the production origin:**
1. Go to Backblaze dashboard → byline-hr-docs bucket → Bucket Settings
2. CORS Rules → Edit
3. Change origin to: `https://attendance.bylinelms.com`
4. Or use wildcard during testing: `*` (NOT recommended for production)
5. Keep "Both" selected for APIs
6. Click "Update CORS Rules"

**You do NOT need to set `AllowedHeaders`** — the simple UI omits that field, and that's now fine because the XHR no longer sends custom headers that require preflight approval.

---

## Alternative: Custom CORS via B2 CLI (OPTIONAL — only if simple UI fails)

If you need more control or the simple UI doesn't work, use the B2 CLI:

```bash
# Install B2 CLI
pip install b2

# Authorize
b2 authorize-account <applicationKeyId> <applicationKey>

# Create custom CORS rules JSON
cat > b2-cors-rules.json << 'EOF'
{
  "corsRules": [
    {
      "corsRuleName": "allow-public-form",
      "allowedOrigins": [
        "http://localhost:5173",
        "https://attendance.bylinelms.com"
      ],
      "allowedHeaders": ["*"],
      "allowedOperations": [
        "s3_put",
        "s3_get",
        "s3_head"
      ],
      "exposeHeaders": ["etag", "x-amz-request-id"],
      "maxAgeSeconds": 3600
    }
  ]
}
EOF

# Apply CORS rules
b2 update-bucket --cors-rules "$(cat b2-cors-rules.json)" byline-hr-docs allPrivate
```

---

## Files Changed

1. `backend/controllers/kycController.js` - Core upload logic
2. `backend/middleware/publicFormValidation.js` - Rate limiter config
3. `backend/config/r2.js` - Documentation enhancement
4. `frontend/src/pages/PublicProfileForm.jsx` - Error handling
5. `backend/package.json` - Dependency documentation (no version changes needed)

---

## Additional Notes

- No database migrations required
- No environment variable changes required
- Changes are backward compatible with existing uploaded documents
- Frontend bundle needs rebuild: `cd frontend && npm run build`
- Backend restart required: `pm2 restart backend` or equivalent
- No npm package reinstall needed (dependencies unchanged)

---

## Monitoring Post-Deployment

Monitor these metrics for 48 hours after deployment:

- [ ] KYC upload success rate (should increase to >98%)
- [ ] 429 rate limit errors (should remain <1% of upload attempts)
- [ ] Browser error logs for "Network error during upload" (should eliminate)
- [ ] Backend logs for "HeadObject failed" or "Size mismatch" errors
- [ ] Average upload time per document (baseline for future comparison)

---

**Status:** ✅ All fixes applied and ready for testing
**Next Step:** Deploy to staging environment and run test checklist
