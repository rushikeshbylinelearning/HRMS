# Cache Fix Testing Guide - Quick Reference

## Problem Fixed
Calendar was showing "Half Day - First Half" badge even after auto-conversion to "Full Day - Loss of Pay" because the API was returning cached data.

## Solution Applied
Added cache invalidation to `halfDayAutoConversionService.js` after conversion and revert operations.

---

## Quick Test (5 Minutes)

### Setup
1. Create a test employee with Half-Day Leave approved for tomorrow
2. Ensure employee has NO clock-in record for that date

### Test Auto-Conversion
```bash
# Manually trigger conversion (don't wait for midnight cron)
POST http://localhost:5000/api/admin/leaves/run-halfday-validation
Headers: { "Authorization": "Bearer <admin_token>" }
Body: { "targetDate": "2026-02-15" }
```

### Verify Fix
1. Open calendar page
2. Look at the converted date
3. **PASS**: Badge shows "Full Day - Loss of Pay" ✅
4. **FAIL**: Badge shows "Half Day - First Half" ❌

### Verify Modal
1. Click on the converted date
2. Check modal header and chip
3. **PASS**: Shows "Full Day Leave" chip ✅
4. **FAIL**: Shows "Half Day - First Half" chip ❌

---

## Detailed Test Scenarios

### Scenario 1: Fresh Conversion
**Steps**:
1. Create Half-Day Leave (First Half) for 2026-02-16
2. Approve the leave
3. On 2026-02-16: Do NOT clock in
4. At 12:30 AM IST on 2026-02-17: Cron runs automatically
5. OR manually trigger: `POST /api/admin/leaves/run-halfday-validation`

**Expected Result**:
- Calendar shows "Full Day - Loss of Pay" badge
- Modal shows "Full Day Leave" chip
- Leave reason includes "[AUTO-CONVERTED TO FULL DAY LOP: No check-in detected]"

### Scenario 2: Revert Conversion
**Steps**:
1. After conversion, get the leave ID
2. Call revert endpoint:
   ```bash
   POST /api/admin/leaves/revert-auto-conversion/:leaveId
   ```
3. Refresh calendar

**Expected Result**:
- Badge reverts to "Half Day - First Half"
- Modal shows "Half Day - First Half" chip
- Auto-conversion flags removed

### Scenario 3: Multiple Employees
**Steps**:
1. Create Half-Day Leaves for 3 employees on same date
2. None of them clock in
3. Run conversion for that date
4. Check all 3 employee calendars

**Expected Result**:
- All 3 show "Full Day - Loss of Pay"
- Each employee's cache invalidated independently
- No cross-contamination

### Scenario 4: Cache Verification (Technical)
**Steps**:
1. Before conversion:
   ```javascript
   // Check cache exists (in backend console or logs)
   const cache = require('./utils/cache');
   console.log(cache.get('status:userId:2026-02-15')); // Should have data
   ```

2. Run conversion

3. After conversion:
   ```javascript
   console.log(cache.get('status:userId:2026-02-15')); // Should be null
   ```

4. Make API call to `/api/attendance/summary`

5. Check cache again:
   ```javascript
   console.log(cache.get('status:userId:2026-02-15')); // Should have FRESH data
   ```

**Expected Result**:
- Cache cleared immediately after conversion
- Fresh data fetched from DB on next request
- New cache entry created with updated data

---

## What to Check

### ✅ Calendar View
- [ ] Badge color correct (primary for Full Day, secondary for Half Day)
- [ ] Badge text shows "Full Day - Loss of Pay"
- [ ] No "Half Day" text visible

### ✅ Modal View
- [ ] Header shows "Leave: Loss of Pay"
- [ ] Chip shows "Full Day Leave"
- [ ] Reason includes auto-conversion message
- [ ] No "Half Day - First Half" text visible

### ✅ Timeline View
- [ ] Status shows "Leave"
- [ ] Leave type shows "Full Day - Loss of Pay"
- [ ] No half-day indicators

### ✅ Admin Dashboard
- [ ] Leave count updated (if tracking full-day vs half-day separately)
- [ ] LOP count incremented
- [ ] Half-day count decremented

---

## Common Issues & Solutions

### Issue: Still showing "Half Day" after conversion
**Cause**: Browser cache or React state not refreshing  
**Solution**: Hard refresh (Ctrl+Shift+R) or clear browser cache

### Issue: Conversion runs but no cache invalidation logs
**Cause**: Cache service not loaded or error in cache invalidation  
**Solution**: Check backend logs for cache errors

### Issue: Cache invalidation fails silently
**Cause**: Cache service unavailable  
**Solution**: Check if `cacheService.js` and `cache.js` are properly loaded

### Issue: Different users see different data
**Cause**: User-specific cache not cleared  
**Solution**: Verify `status:${userId}:${date}` pattern is being cleared

---

## Verification Checklist

Before marking as complete:

- [ ] Auto-conversion updates LeaveRequest in DB
- [ ] Sync service updates AttendanceLog
- [ ] Cache invalidation runs without errors
- [ ] Calendar shows "Full Day - Loss of Pay" immediately
- [ ] Modal shows correct chip and labels
- [ ] Timeline shows correct status
- [ ] Revert functionality works
- [ ] Multiple employees handled correctly
- [ ] No console errors in frontend
- [ ] No errors in backend logs

---

## Rollback Plan

If issues occur in production:

1. **Immediate**: Disable auto-conversion cron job
   ```javascript
   // In cronService.js, comment out:
   // schedule.scheduleJob('30 0 * * *', async () => { ... });
   ```

2. **Revert Changes**: Restore previous version of `halfDayAutoConversionService.js`

3. **Manual Cache Clear**: Clear all caches manually
   ```javascript
   cache.deletePattern('*');
   cacheService.invalidateDashboard('*');
   ```

4. **Investigate**: Check logs for cache-related errors

---

## Performance Monitoring

### Metrics to Watch

1. **Cache Hit Rate**: Should remain high (> 90%)
2. **API Response Time**: Should not increase significantly
3. **Cache Invalidation Time**: Should be < 5ms per operation
4. **DB Query Time**: First request after invalidation may be slower (50-100ms)

### Expected Behavior

- **Before Conversion**: Cache hit, fast response (< 10ms)
- **During Conversion**: Cache invalidated (< 5ms)
- **After Conversion**: Cache miss, DB query (50-100ms), then cache hit again

---

## Success Criteria

✅ **Fix is successful if**:
1. Calendar shows "Full Day - Loss of Pay" immediately after conversion
2. No hard refresh required
3. All views (calendar, modal, timeline) show correct data
4. Cache invalidation logs appear in backend
5. No errors in frontend or backend
6. Performance remains acceptable (< 100ms for first request)

---

**Last Updated**: February 14, 2026  
**Status**: Ready for Testing  
**Estimated Test Time**: 5-10 minutes
