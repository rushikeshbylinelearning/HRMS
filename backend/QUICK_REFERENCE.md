# Required Logout Service - Quick Reference

## What Changed?
Implemented lazy loading in `requiredLogoutService.js` to prevent Passenger crashes.

## Why?
Passenger was crashing because moment-timezone was loading at import time. Now it loads only when the function is called.

## What Stayed the Same?
- All shift logic (10 AM hard floor, 11 AM flexible)
- Function signature and API
- Break calculations
- Return values

## Quick Tests

### Before Deployment
```bash
cd backend
node test-import-safety.js    # Should pass
node test-shift-logic.js       # Should show 7/7 passed
```

### After Deployment
```bash
# Check logs for errors
tail -f logs/combined.log

# Verify app is running
curl http://localhost:PORT/health
```

## Shift Rules Quick Reference

### 10 AM Shift (General Shift 1)
- Always logout at 7:00 PM minimum
- Early check-in? Still 7:00 PM
- Extra breaks? 7:00 PM + excess minutes

### 11 AM Shift (General Shift 2)
- Check-in before 10 AM? → 7:00 PM minimum
- Check-in at/after 10 AM? → Clock-in + 9 hours
- Extra breaks? Add to logout time

## Troubleshooting

### App won't start
```bash
# Check syntax
node --check services/requiredLogoutService.js

# Test import
node test-import-safety.js
```

### Wrong logout times
```bash
# Test shift logic
node test-shift-logic.js

# Check shift names in database match config
```

### Rollback
```bash
cp services/requiredLogoutService.js.backup services/requiredLogoutService.js
touch tmp/restart.txt
```

## Files to Deploy
- `backend/services/requiredLogoutService.js` (REQUIRED)
- Test files (optional, for verification)

## Support
See `REQUIRED_LOGOUT_SERVICE_FIX.md` for detailed documentation.
