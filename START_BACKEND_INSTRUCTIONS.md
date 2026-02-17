# Backend Server Not Running - Quick Fix

## Issue
The `/api/auth/me` endpoint is returning 500 Internal Server Error because the backend server is not running or encountered an error.

## Quick Start Backend

### Option 1: Development Mode (with auto-reload)
```bash
cd backend
npm run dev
```

### Option 2: Production Mode
```bash
cd backend
npm start
```

### Option 3: Check if already running
```powershell
# Windows PowerShell
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# Or check port 3001
netstat -ano | findstr :3001
```

## Common Startup Issues

### Issue 1: MongoDB Connection Error
**Symptom:** Server crashes on startup with MongoDB connection error

**Solution:** Check `backend/.env` has correct MongoDB URI:
```
MONGODB_URI=mongodb+srv://...
```

### Issue 2: Port Already in Use
**Symptom:** Error: `EADDRINUSE: address already in use :::3001`

**Solution:** Kill the process using port 3001:
```powershell
# Find process ID
netstat -ano | findstr :3001

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Issue 3: Missing Dependencies
**Symptom:** Error: `Cannot find module '...'`

**Solution:** Install dependencies:
```bash
cd backend
npm install
```

### Issue 4: Environment Variables Missing
**Symptom:** Server starts but crashes when handling requests

**Solution:** Verify all required env vars in `backend/.env`:
```bash
# Required variables:
MONGODB_URI=...
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
FRONTEND_URL=https://attendance.bylinelms.com
BACKEND_PUBLIC_URL=https://attendance.bylinelms.com
PORT=3001
```

## Verify Backend is Running

After starting, test:
```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Should return: {"status":"ok"}
```

## Check Logs

If server crashes, check logs:
```bash
# Error logs
cat backend/logs/error.log

# Combined logs
cat backend/logs/combined6.log
```

## Production Deployment

For production with PM2:
```bash
cd backend
pm2 start server.js --name attendance-backend
pm2 logs attendance-backend
pm2 save
```

## Next Steps After Starting Backend

1. ✅ Start backend server
2. ✅ Verify health endpoint works
3. ✅ Test `/api/auth/me` endpoint
4. ✅ Try login from frontend
5. ✅ Check for CORS errors (should be none now)
