# CORS Fix - Quick Reference Card

## What Was Fixed
✅ Changed API base URL from `attendance.legatolxp.online` → `attendance.bylinelms.com`
✅ Changed cookie domain from `.legatolxp.online` → `.bylinelms.com`
✅ Removed unnecessary cross-domain CORS entry
✅ Fixed CSP frame-ancestors typo
✅ Bumped service worker cache version

## Files Changed
1. `frontend/.env` - API base URL
2. `backend/.env` - Verified correct URLs
3. `backend/routes/auth.js` - Cookie domain
4. `backend/config/security.js` - CORS origins
5. `backend/server.js` - CSP frame-ancestors
6. `frontend/public/sw.js` - Cache version

## Quick Deploy Commands

### Backend:
```bash
cd backend
git pull
pm2 restart attendance-backend
pm2 logs attendance-backend --lines 20
```

### Frontend:
```bash
cd frontend
git pull
npm run build
# Deploy dist/ to web server
```

### Verify:
```bash
# Test backend
curl https://attendance.bylinelms.com/api/health

# Check for old domain references (should be 0)
grep -r "legatolxp.online" backend/config/ backend/routes/auth.js | grep -v "sso.legatolxp.online" | wc -l
```

## Quick Test in Browser
1. Open incognito: `https://attendance.bylinelms.com`
2. Open DevTools (F12) → Network tab
3. Login
4. Check:
   - ✅ No CORS errors
   - ✅ All API calls to `attendance.bylinelms.com/api/*`
   - ✅ Cookies have `Domain=.bylinelms.com`

## Rollback (if needed)
```bash
cd backend && git checkout HEAD~1 && pm2 restart attendance-backend
cd frontend && git checkout HEAD~1 && npm run build
```

## Expected API Calls
```
✅ https://attendance.bylinelms.com/api/auth/me
✅ https://attendance.bylinelms.com/api/auth/login
✅ https://attendance.bylinelms.com/api/attendance/dashboard
❌ https://attendance.legatolxp.online/api/* (OLD - should not appear)
```

## Common Issues & Solutions

### Issue: Still seeing CORS errors
**Solution:** Clear browser cache, hard reload (Ctrl+Shift+R)

### Issue: Cookies not set
**Solution:** Check backend logs, verify cookie domain in auth.js

### Issue: API calls still going to old domain
**Solution:** Rebuild frontend, clear CDN cache

### Issue: SSO login broken
**Solution:** Verify SSO domains still in CORS config (sso.legatolxp.online, sso.bylinelms.com)

## Support Checklist
- [ ] Backend logs: `pm2 logs attendance-backend`
- [ ] Nginx logs: `tail -f /var/log/nginx/error.log`
- [ ] Browser console errors
- [ ] Network tab showing API calls
- [ ] Cookie domain in DevTools
- [ ] Environment variables correct

## Success Indicators
✅ Zero CORS errors
✅ Login works
✅ All API calls same-origin
✅ Cookies set correctly
✅ SSO still works

## Documentation
- Full details: `CORS_FIX_COMPLETE_SUMMARY.md`
- Deployment: `DEPLOYMENT_STEPS.md`
- Technical: `CORS_API_URL_FIX.md`
- Verify script: `verify-cors-fix.sh`
