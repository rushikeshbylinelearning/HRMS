# CORS Fix Deployment Steps

## Pre-Deployment Checklist

### Files Changed:
1. ✅ `frontend/.env` - Changed API base URL from legatolxp.online to bylinelms.com
2. ✅ `backend/.env` - Verified FRONTEND_URL and BACKEND_PUBLIC_URL
3. ✅ `backend/routes/auth.js` - Changed cookie domain from .legatolxp.online to .bylinelms.com
4. ✅ `backend/config/security.js` - Removed unnecessary cross-domain CORS entry
5. ✅ `backend/server.js` - Fixed CSP frame-ancestors (removed typo domain)
6. ✅ `frontend/public/sw.js` - Bumped cache version to force refresh

### What Changed:
- **API Base URL**: Now points to same domain (bylinelms.com) instead of cross-domain (legatolxp.online)
- **Cookie Domain**: Changed to .bylinelms.com for proper subdomain sharing
- **CORS Config**: Removed unnecessary backend domain from allowed origins (same-origin doesn't need CORS)
- **Service Worker**: Version bumped to clear old cached API calls

## Deployment Steps

### 1. Backend Deployment

```bash
# Navigate to backend directory
cd backend

# Pull latest changes
git pull origin main

# Verify .env file has correct values
cat .env | grep -E "(FRONTEND_URL|BACKEND_PUBLIC_URL)"
# Should show:
# FRONTEND_URL=https://attendance.bylinelms.com
# BACKEND_PUBLIC_URL=https://attendance.bylinelms.com

# Restart backend server
pm2 restart attendance-backend
# OR if using different process manager:
# systemctl restart attendance-backend
# OR
# npm run start

# Check logs for any errors
pm2 logs attendance-backend --lines 50
```

### 2. Frontend Deployment

```bash
# Navigate to frontend directory
cd frontend

# Pull latest changes
git pull origin main

# Verify .env file
cat .env | grep VITE_API_BASE_URL
# Should show:
# VITE_API_BASE_URL=https://attendance.bylinelms.com

# Install dependencies (if needed)
npm install

# Build production bundle
npm run build

# Deploy build to web server
# (Copy dist/ folder to your web server location)
# Example:
# rsync -avz dist/ /var/www/attendance/
# OR
# cp -r dist/* /var/www/attendance/
```

### 3. Nginx Configuration Verification

Ensure Nginx is properly configured to proxy API requests:

```bash
# Check Nginx config
sudo nginx -t

# Verify proxy configuration exists
sudo cat /etc/nginx/sites-available/attendance.bylinelms.com | grep -A 10 "location /api"
```

Expected Nginx config:
```nginx
location /api/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

If config changed, reload Nginx:
```bash
sudo nginx -s reload
# OR
sudo systemctl reload nginx
```

### 4. Clear CDN Cache (if applicable)

If using Cloudflare or other CDN:
```bash
# Cloudflare: Purge cache via dashboard or API
# Or use Cloudflare CLI:
# cf-cli purge-cache --zone attendance.bylinelms.com
```

### 5. Post-Deployment Testing

#### A. Backend Health Check
```bash
# Test backend is running
curl https://attendance.bylinelms.com/api/health

# Test CORS headers (should NOT have CORS errors for same-origin)
curl -I https://attendance.bylinelms.com/api/auth/me
```

#### B. Frontend Testing
1. Open browser in incognito/private mode
2. Navigate to `https://attendance.bylinelms.com`
3. Open DevTools (F12) → Network tab
4. Try to login
5. Verify:
   - ✅ No CORS errors in console
   - ✅ All API calls go to `https://attendance.bylinelms.com/api/*`
   - ✅ Cookies are set with `Domain=.bylinelms.com`
   - ✅ `/api/auth/me` returns 200 OK
   - ✅ Service worker updates to new version (v1.0.1)

#### C. Cookie Verification
In DevTools → Application → Cookies → `https://attendance.bylinelms.com`:
- Check `token` cookie has:
  - Domain: `.bylinelms.com` ✅
  - Secure: true ✅
  - HttpOnly: true ✅
  - SameSite: None ✅

#### D. SSO Integration Test
1. Navigate to SSO portal
2. Login via SSO
3. Click on Attendance app
4. Verify:
   - ✅ SSO login works
   - ✅ User is redirected to attendance app
   - ✅ User is automatically logged in
   - ✅ No CORS errors

### 6. Rollback Plan (if issues occur)

If deployment causes issues:

```bash
# Backend rollback
cd backend
git checkout HEAD~1  # Go back one commit
pm2 restart attendance-backend

# Frontend rollback
cd frontend
git checkout HEAD~1
npm run build
# Deploy old build
```

Or restore from backup:
```bash
# Restore backend .env
cp backend/.env.backup backend/.env

# Restore frontend .env
cp frontend/.env.backup frontend/.env

# Restart services
pm2 restart attendance-backend
```

## Monitoring

After deployment, monitor for:
- Backend error logs: `pm2 logs attendance-backend`
- Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- User reports of login issues
- CORS errors in browser console

## Success Criteria

✅ Users can login without CORS errors
✅ All API calls are same-origin (no cross-domain)
✅ Cookies are set correctly with .bylinelms.com domain
✅ SSO integration still works
✅ No "Failed to fetch" errors
✅ Service worker cache is cleared and updated

## Timeline

- **Estimated downtime**: < 2 minutes (backend restart)
- **Best deployment time**: Off-peak hours (evening or weekend)
- **Rollback time**: < 5 minutes if needed

## Support

If issues occur:
1. Check backend logs: `pm2 logs attendance-backend`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Check browser console for errors
4. Verify environment variables are correct
5. Test API endpoints directly with curl
6. If all else fails, rollback to previous version
