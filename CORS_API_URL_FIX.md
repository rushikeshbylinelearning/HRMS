# CORS and API Base URL Fix - Complete Audit

## Problem Summary
Frontend at `https://attendance.bylinelms.com` is making cross-domain API calls to `https://attendance.legatolxp.online`, causing CORS failures.

## Root Causes Identified

### 1. Wrong API Base URL in Frontend `.env`
**File:** `frontend/.env`
```
VITE_API_BASE_URL=https://attendance.legatolxp.online  ❌ WRONG
```
Should be:
```
VITE_API_BASE_URL=https://attendance.bylinelms.com  ✅ CORRECT
```

### 2. Backend Cookie Domain Mismatch
**File:** `backend/routes/auth.js` (line 158)
```javascript
cookieOptions.domain = '.legatolxp.online';  ❌ WRONG
```
Should be:
```javascript
cookieOptions.domain = '.bylinelms.com';  ✅ CORRECT
```

### 3. Unnecessary Cross-Domain CORS Entry
**File:** `backend/config/security.js` (line 14)
```javascript
'https://attendance.legatolxp.online', // Production AMS backend domain (for API calls)  ❌ UNNECESSARY
```
This should be removed since frontend and backend are on the same domain.

### 4. SSO Domain References
**Files:** `backend/config/security.js`, `backend/server.js`
- Multiple references to `https://sso.legatolxp.online` should remain (SSO is separate service)
- Frame-ancestors CSP should keep SSO domains for iframe embedding

## Solution

### Architecture Decision
Both frontend and backend are hosted on `attendance.bylinelms.com`:
- Frontend: `https://attendance.bylinelms.com` (static files)
- Backend API: `https://attendance.bylinelms.com/api` (proxied via Nginx)

This means:
1. **No cross-domain requests** - frontend uses relative paths `/api/*`
2. **No CORS needed** for frontend-to-backend (same origin)
3. **CORS only needed** for SSO portal integration

### Changes Required

#### 1. Frontend Environment Variable
```bash
# frontend/.env
VITE_API_BASE_URL=https://attendance.bylinelms.com
```

#### 2. Backend Cookie Domain
```javascript
// backend/routes/auth.js
if (process.env.NODE_ENV === 'production') {
    cookieOptions.domain = '.bylinelms.com'; // Changed from .legatolxp.online
}
```

#### 3. Backend CORS Configuration
```javascript
// backend/config/security.js
const allowedOrigins = [
  'https://attendance.bylinelms.com', // Production AMS frontend domain
  // REMOVED: 'https://attendance.legatolxp.online', // Not needed - same domain
  'https://sso.legatolxp.online', // Production SSO domain (keep for SSO integration)
  'https://sso.bylinelms.com', // Production SSO portal (keep for SSO integration)
  process.env.FRONTEND_URL,
  // ... development origins
];
```

#### 4. Backend Environment Variable
```bash
# backend/.env
FRONTEND_URL=https://attendance.bylinelms.com
BACKEND_PUBLIC_URL=https://attendance.bylinelms.com
```

## Nginx Configuration (Verify)
Ensure Nginx is configured to proxy `/api` to backend:

```nginx
location /api/ {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Testing Checklist

### After Deployment:
1. ✅ Clear browser cache and cookies
2. ✅ Hard reload (Ctrl+Shift+R)
3. ✅ Test login at `https://attendance.bylinelms.com`
4. ✅ Verify `/api/auth/me` returns 200 (not CORS error)
5. ✅ Check browser DevTools Network tab - all API calls should be to same domain
6. ✅ Verify cookies are set with correct domain (`.bylinelms.com`)
7. ✅ Test SSO login flow (should still work with SSO portal)

### Expected Results:
- No CORS errors in console
- All API calls to `https://attendance.bylinelms.com/api/*`
- Cookies set with `Domain=.bylinelms.com`
- SSO integration still functional

## Files to Update
1. `frontend/.env` - Change VITE_API_BASE_URL
2. `backend/.env` - Verify FRONTEND_URL and BACKEND_PUBLIC_URL
3. `backend/routes/auth.js` - Change cookie domain
4. `backend/config/security.js` - Remove unnecessary CORS origin
5. Service worker cache - Will auto-update with new version

## Deployment Steps
1. Update all files listed above
2. Restart backend: `pm2 restart backend` or equivalent
3. Rebuild frontend: `npm run build`
4. Deploy frontend build to server
5. Clear CDN cache if using one
6. Test thoroughly before announcing to users
