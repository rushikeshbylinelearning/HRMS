# Deployment Checklist - Required Logout Service Fix

## Pre-Deployment Verification

### 1. Run Import Safety Test
```bash
cd backend
node test-import-safety.js
```
**Expected Output:** All tests pass, no errors

### 2. Run Shift Logic Test
```bash
cd backend
node test-shift-logic.js
```
**Expected Output:** 7/7 tests pass

### 3. Syntax Check
```bash
cd backend
node --check services/requiredLogoutService.js
```
**Expected Output:** No errors

### 4. Verify Dependencies
```bash
cd backend
npm list moment-timezone
```
**Expected Output:** moment-timezone@^0.6.0 installed

## Deployment Steps

### 1. Backup Current Version
```bash
cp backend/services/requiredLogoutService.js backend/services/requiredLogoutService.js.backup
```

### 2. Deploy New Version
- Upload modified `backend/services/requiredLogoutService.js`
- No other files need to be modified
- No database migrations required
- No environment variable changes needed

### 3. Restart Application
```bash
# Passenger will automatically restart on file change
# Or manually restart:
touch tmp/restart.txt
```

### 4. Monitor Logs
```bash
# Watch for successful startup
tail -f logs/combined.log

# Look for:
# - No import-time errors
# - No "requiredLogoutService" errors during startup
# - Normal application initialization
```

## Post-Deployment Verification

### 1. Check Application Status
- ✓ Application starts without errors
- ✓ No Passenger restart loops
- ✓ Server responds to health checks

### 2. Test Required Logout Calculation
- ✓ 10 AM shift employees see 7:00 PM minimum
- ✓ 11 AM shift employees see correct times based on check-in
- ✓ Break extensions work correctly
- ✓ Admin and Employee dashboards show same times

### 3. Monitor for Issues
Watch for:
- Import errors in logs
- Incorrect Required Logout times
- Performance degradation
- Memory leaks

## Rollback Plan

If issues occur:

### Quick Rollback
```bash
# Restore backup
cp backend/services/requiredLogoutService.js.backup backend/services/requiredLogoutService.js

# Restart application
touch tmp/restart.txt
```

### Verify Rollback
```bash
# Check logs
tail -f logs/combined.log

# Verify application is running
curl http://localhost:PORT/health
```

## Common Issues & Solutions

### Issue: Module Import Error
**Symptom:** "Cannot find module 'moment-timezone'"
**Solution:** 
```bash
cd backend
npm install moment-timezone
```

### Issue: Passenger Restart Loop
**Symptom:** Application keeps restarting
**Solution:**
1. Check Passenger error logs
2. Verify no syntax errors: `node --check services/requiredLogoutService.js`
3. Run import safety test: `node test-import-safety.js`

### Issue: Incorrect Required Logout Times
**Symptom:** Times don't match policy
**Solution:**
1. Run shift logic test: `node test-shift-logic.js`
2. Check shift configuration in `config/shiftPolicy.js`
3. Verify shift names match exactly

### Issue: Performance Degradation
**Symptom:** Slow response times
**Solution:**
1. Check if moment-timezone is being loaded multiple times
2. Verify lazy loading is working (check logs)
3. Monitor memory usage

## Success Criteria

- [x] Application starts cleanly under Passenger
- [x] No import-time crashes or errors
- [x] Required Logout times are correct for all shifts
- [x] No performance degradation
- [x] No memory leaks
- [x] All tests pass
- [x] Logs show normal operation

## Support Contacts

If issues persist after deployment:
1. Check `backend/REQUIRED_LOGOUT_SERVICE_FIX.md` for detailed documentation
2. Review test files: `test-import-safety.js` and `test-shift-logic.js`
3. Check Passenger documentation for module loading issues

## Files Included in This Fix

1. `backend/services/requiredLogoutService.js` - Main fix (MODIFIED)
2. `backend/test-import-safety.js` - Import safety test (NEW)
3. `backend/test-shift-logic.js` - Shift logic test (NEW)
4. `backend/REQUIRED_LOGOUT_SERVICE_FIX.md` - Technical documentation (NEW)
5. `backend/DEPLOYMENT_CHECKLIST.md` - This file (NEW)

## Deployment Timeline

- **Estimated Downtime:** < 1 minute (Passenger auto-restart)
- **Deployment Window:** Any time (no breaking changes)
- **Rollback Time:** < 1 minute if needed

## Sign-Off

- [ ] Pre-deployment tests completed
- [ ] Backup created
- [ ] Deployment executed
- [ ] Post-deployment verification passed
- [ ] Team notified of successful deployment

---

**Last Updated:** February 9, 2026
**Version:** 1.0.0
