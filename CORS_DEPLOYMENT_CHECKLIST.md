# CORS Fix Deployment Checklist

## Pre-Deployment Verification
- [x] Updated `backend/config/security.js` with correct allowed origins
- [x] Updated `backend/.env` with production FRONTEND_URL
- [x] Verified no syntax errors in modified files
- [x] Documented all changes

## Deployment Steps

### Step 1: Backup Current Configuration
```bash
# Backup the current .env file
cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)

# Backup the security config
cp backend/config/security.js backend/config/security.js.backup.$(date +%Y%m%d_%H%M%S)
```

### Step 2: Deploy Changes
```bash
# Pull the latest changes (if using git)
git pull origin main

# Or manually copy the modified files to the server
# - backend/config/security.js
# - backend/.env
```

### Step 3: Restart Backend Server
```bash
# Option 1: Using PM2
pm2 restart attendance-backend
pm2 logs attendance-backend --lines 50

# Option 2: Using systemd
sudo systemctl restart attendance-backend
sudo journalctl -u attendance-backend -f

# Option 3: Manual restart
# Stop the current process (Ctrl+C or kill)
# Then start again:
cd backend
node server.js
```

### Step 4: Verify Server Started Successfully
```bash
# Check if server is running
curl https://attendance.legatolxp.online/api/health

# Check server logs for CORS configuration
tail -f backend/logs/combined.log | grep -i cors
```

### Step 5: Test CORS from Browser
1. Open browser console (F12)
2. Navigate to: `https://attendance.bylinelms.com`
3. Check console for errors
4. Verify API calls succeed

### Step 6: Test Specific Endpoints
```bash
# Test OPTIONS preflight request
curl -H "Origin: https://attendance.bylinelms.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     -X OPTIONS \
     https://attendance.legatolxp.online/api/auth/me -v

# Expected response headers:
# Access-Control-Allow-Origin: https://attendance.bylinelms.com
# Access-Control-Allow-Credentials: true
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

## Post-Deployment Verification

### Functional Tests
- [ ] Login page loads without errors
- [ ] User can log in successfully
- [ ] Dashboard loads with data
- [ ] API calls to `/api/auth/me` succeed
- [ ] Socket.IO connection establishes
- [ ] No CORS errors in browser console
- [ ] Attendance check-in/check-out works
- [ ] Admin dashboard loads correctly

### Browser Tests
Test on multiple browsers:
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (if applicable)

### Network Tests
- [ ] Test from different networks (office, home, mobile)
- [ ] Verify HTTPS certificate is valid
- [ ] Check response times are acceptable

## Rollback Plan (If Issues Occur)

### Quick Rollback
```bash
# Restore backup files
cp backend/.env.backup.YYYYMMDD_HHMMSS backend/.env
cp backend/config/security.js.backup.YYYYMMDD_HHMMSS backend/config/security.js

# Restart server
pm2 restart attendance-backend
# OR
sudo systemctl restart attendance-backend
```

### Verify Rollback
```bash
# Check server is running
curl https://attendance.legatolxp.online/api/health

# Check logs
tail -f backend/logs/combined.log
```

## Common Issues and Solutions

### Issue 1: Server Won't Start
**Symptoms:** Server crashes on startup
**Solution:**
1. Check syntax errors: `node -c backend/config/security.js`
2. Check .env file is valid
3. Review server logs: `tail -f backend/logs/error.log`

### Issue 2: CORS Errors Still Occur
**Symptoms:** Browser shows CORS errors
**Solution:**
1. Verify server restarted: `pm2 list` or `systemctl status attendance-backend`
2. Clear browser cache: Ctrl+Shift+R
3. Check FRONTEND_URL is set correctly: `grep FRONTEND_URL backend/.env`
4. Verify allowed origins in logs

### Issue 3: 502 Bad Gateway
**Symptoms:** Nginx/proxy returns 502
**Solution:**
1. Check backend server is running: `curl http://localhost:3001/api/health`
2. Check nginx/proxy configuration
3. Restart proxy: `sudo systemctl restart nginx`

## Success Criteria
✅ All checklist items completed
✅ No CORS errors in browser console
✅ All functional tests pass
✅ Users can access the application normally
✅ No errors in server logs

## Contact Information
If issues persist:
- Check server logs: `backend/logs/combined.log`
- Review error logs: `backend/logs/error.log`
- Test CORS manually using curl commands above
