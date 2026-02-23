# Bugfix: Employee Analytics Cache Key Collision

**Date**: February 20, 2026  
**Issue**: Clicking on any employee in analytics always opens "Manish" instead of the correct employee  
**Severity**: CRITICAL - Data integrity issue  
**Status**: ✅ FIXED

---

## Problem Description

After implementing the analytics cache in `employeeAnalyticsController.js`, all employee detail pages were showing the same employee's data (Manish) regardless of which employee was clicked.

### User Report
> "I am opening the analytics of any Employee only Manish opens this is bug not of that particularly employee"

---

## Root Cause Analysis

The bug was in `backend/services/analyticsCacheService.js` in the `generateCacheKey()` function.

### The Issue

The `generateCacheKey()` function was hardcoded to only recognize these fields:
- startDate
- endDate
- page
- limit
- department
- location
- shiftType
- employmentStatus

When `employeeAnalyticsController.js` called the cache with:
```javascript
const cacheFilters = { 
    employeeId,           // ❌ NOT recognized by generateCacheKey
    month: monthNum,      // ❌ NOT recognized by generateCacheKey
    year: yearNum,        // ❌ NOT recognized by generateCacheKey
    type: 'employee-detail' // ❌ NOT recognized by generateCacheKey
};
```

The cache key generator **ignored all these fields** and generated the same cache key for all employee requests!

### Why "Manish" Appeared for Everyone

1. First employee clicked (e.g., Manish) → Cache miss → Fetch data → Store in cache with key `analytics:undefined:undefined:abc123`
2. Second employee clicked (e.g., John) → Same cache key generated → Cache hit → Returns Manish's data ❌
3. Third employee clicked (e.g., Sarah) → Same cache key generated → Cache hit → Returns Manish's data ❌

All employees shared the same cache entry because the cache key didn't include `employeeId`.

---

## The Fix

Updated `generateCacheKey()` in `backend/services/analyticsCacheService.js` to handle two types of analytics:

### 1. Employee-Specific Analytics (NEW)
```javascript
if (filters.type === 'employee-detail') {
    const keyData = {
        type: 'employee-detail',
        employeeId: filters.employeeId,  // ✅ Now included
        month: filters.month,            // ✅ Now included
        year: filters.year               // ✅ Now included
    };
    
    return `analytics:employee:${filters.employeeId}:${filters.year}-${filters.month}:${hash}`;
}
```

### 2. General Analytics (EXISTING)
```javascript
// Original logic for general analytics
const keyData = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    page: filters.page || 1,
    limit: filters.limit || 50,
    department: filters.department || '',
    location: filters.location || '',
    shiftType: filters.shiftType || '',
    employmentStatus: filters.employmentStatus || ''
};

return `analytics:${filters.startDate}:${filters.endDate}:${hash}`;
```

---

## Cache Key Examples

### Before Fix (BROKEN)
- Employee 1 (Manish): `analytics:undefined:undefined:abc123`
- Employee 2 (John): `analytics:undefined:undefined:abc123` ❌ SAME KEY!
- Employee 3 (Sarah): `analytics:undefined:undefined:abc123` ❌ SAME KEY!

### After Fix (CORRECT)
- Employee 1 (Manish, ID: 507f1f77bcf86cd799439011): `analytics:employee:507f1f77bcf86cd799439011:2026-02:a1b2c3`
- Employee 2 (John, ID: 507f191e810c19729de860ea): `analytics:employee:507f191e810c19729de860ea:2026-02:d4e5f6`
- Employee 3 (Sarah, ID: 507f1f77bcf86cd799439012): `analytics:employee:507f1f77bcf86cd799439012:2026-02:g7h8i9`

Each employee now has a unique cache key! ✅

---

## Impact Assessment

### Before Fix
- ❌ All employees showed the same data (first cached employee)
- ❌ Data integrity compromised
- ❌ User confusion and loss of trust
- ✅ Performance was good (cache working, just wrong data)

### After Fix
- ✅ Each employee shows their own correct data
- ✅ Data integrity restored
- ✅ Cache still provides performance benefits
- ✅ Unique cache keys per employee

---

## Testing Verification

### Manual Test Steps
1. Clear cache: `POST /api/analytics/cache/clear`
2. Open Employee 1 analytics (e.g., Manish) → Should show Manish's data
3. Open Employee 2 analytics (e.g., John) → Should show John's data (NOT Manish)
4. Open Employee 3 analytics (e.g., Sarah) → Should show Sarah's data (NOT Manish)
5. Reopen Employee 1 → Should still show Manish's data (cache hit)

### Expected Cache Behavior
```
[AnalyticsCacheService] ❌ Cache MISS: analytics:employee:507f1f77bcf86cd799439011:2026-02:a1b2c3
[AnalyticsCacheService] ✅ Stored in memory: analytics:employee:507f1f77bcf86cd799439011:2026-02:a1b2c3
[AnalyticsCacheService] ❌ Cache MISS: analytics:employee:507f191e810c19729de860ea:2026-02:d4e5f6
[AnalyticsCacheService] ✅ Stored in memory: analytics:employee:507f191e810c19729de860ea:2026-02:d4e5f6
[AnalyticsCacheService] ✅ Memory cache HIT: analytics:employee:507f1f77bcf86cd799439011:2026-02:a1b2c3
```

---

## Files Modified

1. **backend/services/analyticsCacheService.js**
   - Updated `generateCacheKey()` function to handle employee-specific cache keys
   - Added conditional logic to detect `type: 'employee-detail'`
   - Generate unique keys using `employeeId`, `month`, and `year`

---

## Lessons Learned

### What Went Wrong
1. **Assumption**: Cache service would automatically handle any filter structure
2. **Reality**: Cache key generator was hardcoded for specific fields only
3. **Testing Gap**: Employee analytics caching wasn't tested with multiple employees

### Prevention for Future
1. ✅ Cache key generation should be flexible or documented
2. ✅ Test cache with multiple distinct entities (not just one employee)
3. ✅ Add logging to show actual cache keys being generated
4. ✅ Consider using a more generic cache key approach (hash all fields)

---

## Related Issues

This bug was introduced in the Analytics Backend Performance Fix when we added caching to `employeeAnalyticsController.js`. The general analytics caching in `analyticsController.js` was not affected because it uses the fields that `generateCacheKey()` was originally designed for.

---

**Fix Verified**: February 20, 2026  
**Status**: ✅ RESOLVED  
**Deployment**: Ready for immediate deployment
