# CORS Error Fix Summary

## Issue
Frontend at `https://attendance.bylinelms.com` was unable to access backend API at `https://attendance.legatolxp.online` due to CORS policy blocking.

Error message:
```
Access to XMLHttpRequest at 'https://attendance.legatolxp.online/api/auth/me' from origin 'https://attendance.bylinelms.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Causes

### 1. Missing Backend Domain in Allowed Origins
The backend domain `https://attendance.legatolxp.online` was not in the CORS allowed origins list.

### 2. Incorrect FRONTEND_URL in .env
The `.env` file had `FRONTEND_URL=http://localhost:5173` (development URL) instead of the production URL.

### 3. Typo in SSO Domain
There was a typo: `https://sso.leagatolxp.online` (with 'a') instead of `https://sso.legatolxp.online`.

## Fixes Applied

### Fix 1: Updated CORS Allowed Origins
**File:** `backend/config/security.js`

**Before:**
```javascript
const allowedOrigins = [
  'https://attendance.bylinelms.com',
  'https://attendance.bylinelms.com', // Duplicate
  'https://sso.leagatolxp.online', // Typo
  'https://sso.bylinelms.com',
  process.env.FRONTEND_URL,
```

**After:**
```javascript
const allowedOrigins = [
  'https://attendance.bylinelms.com', // Production AMS frontend domain
  'https://attendance.legatolxp.online', // Production AMS backend domain (for API calls)
  'https://sso.legatolxp.online', // Production SSO domain (fixed typo)
  'https://sso.bylinelms.com', // Production SSO portal
  process.env.FRONTEND_URL,
```

### Fix 2: Updated FRONTEND_URL
**File:** `backend/.env`

**Before:**
```env
FRONTEND_URL=http://localhost:5173
```

**After:**
```env
FRONTEND_URL=https://attendance.bylinelms.com
```

## Deployment Steps

### 1. Restart the Backend Server
The backend server needs to be restarted for the changes to take effect:

```bash
# If using PM2
pm2 restart attendance-backend

# If using systemd
sudo systemctl restart attendance-backend

# If running manually
# Stop the current process and restart
node backend/server.js
```

### 2. Clear Browser Cache
Users should clear their browser cache or do a hard refresh:
- Chrome/Edge: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- Firefox: `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)

### 3. Verify the Fix
1. Open the browser console (F12)
2. Navigate to `https://attendance.bylinelms.com`
3. Check that there are no CORS errors
4. Verify that API calls to `https://attendance.legatolxp.online` are successful

## Testing Checklist

- [ ] Backend server restarted
- [ ] Frontend loads without CORS errors
- [ ] Login works correctly
- [ ] API calls to `/api/auth/me` succeed
- [ ] Dashboard loads with data
- [ ] Socket.IO connection establishes successfully
- [ ] No console errors related to CORS

## Additional Notes

### CORS Configuration Details
The CORS middleware now allows:
- **Origins:** 
  - `https://attendance.bylinelms.com` (frontend)
  - `https://attendance.legatolxp.online` (backend)
  - `https://sso.legatolxp.online` (SSO)
  - `https://sso.bylinelms.com` (SSO portal)
  - Development origins (localhost) when `NODE_ENV=development`

- **Methods:** GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Credentials:** Enabled (cookies and auth headers)
- **Headers:** Content-Type, Authorization, X-Requested-With, WebSocket headers

### Security Considerations
- HTTPS is enforced in production
- Credentials (cookies) are allowed for authenticated requests
- Only explicitly allowed origins can access the API
- Preflight OPTIONS requests are handled correctly

## Troubleshooting

If CORS errors persist after deployment:

1. **Check server logs** for CORS-related warnings:
   ```bash
   tail -f backend/logs/combined.log | grep CORS
   ```

2. **Verify environment variables** are loaded:
   ```bash
   # In the backend directory
   node -e "require('dotenv').config(); console.log('FRONTEND_URL:', process.env.FRONTEND_URL)"
   ```

3. **Test CORS directly** using curl:
   ```bash
   curl -H "Origin: https://attendance.bylinelms.com" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://attendance.legatolxp.online/api/auth/me -v
   ```

   Expected response should include:
   ```
   Access-Control-Allow-Origin: https://attendance.bylinelms.com
   Access-Control-Allow-Credentials: true
   ```

4. **Check reverse proxy configuration** (if using nginx/Apache):
   - Ensure proxy is not stripping CORS headers
   - Verify proxy is forwarding the Origin header correctly

## Files Modified
- `backend/config/security.js` - Updated CORS allowed origins
- `backend/.env` - Updated FRONTEND_URL to production URL
