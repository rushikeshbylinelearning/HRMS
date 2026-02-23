# Analytics Search Functionality - Debug Guide

## What Was Implemented

A search bar has been added to the Analytics page header that allows users to search for employees by:
- Employee name (case-insensitive)
- Employee code (case-insensitive)

## Changes Made

### Frontend Changes

1. **AttendanceDashboard.jsx**
   - Added search state: `searchQuery` and `searchDebounceRef`
   - Added `search` field to filters state
   - Implemented `handleSearchChange` with 500ms debounce
   - Implemented `handleClearSearch` to reset search
   - Added TextField with search icon and clear button in header
   - Added console logging for debugging

2. **analyticsService.js**
   - Added `search` parameter to API call
   - Added console logging to track filter parameters

### Backend Changes

1. **analyticsController.js**
   - Added `search` parameter extraction from query
   - Added `search` to filters object
   - Added console logging for debugging
   - Updated JSDoc documentation

2. **AnalyticsService.js**
   - Updated `buildUserFilterQuery` to support search
   - Uses MongoDB regex for case-insensitive matching
   - Searches both `fullName` and `employeeCode` fields
   - Added console logging for debugging

## How to Test

### 1. Check Browser Console

Open the browser console (F12) and look for these logs when typing in the search bar:

```
[AttendanceDashboard] Search query: <your search term>
[analyticsService] Fetching with filters: { ..., search: "<your search term>", ... }
```

### 2. Check Backend Logs

In your backend terminal, you should see:

```
[analyticsController] Received query params: { ..., search: '<your search term>', ... }
[AnalyticsService] Search filter applied: <your search term>
[AnalyticsService] Built user query: {...}
```

### 3. Test the Backend Directly

Run the test script to verify the search query works:

```bash
node backend/scripts/test-analytics-search.js
```

Edit the `searchTerm` variable in the script to test different searches.

### 4. Test via API

Use curl or Postman to test the API directly:

```bash
curl "http://localhost:5000/api/analytics/attendance?startDate=2026-02-01&endDate=2026-02-23&search=john"
```

## Common Issues and Solutions

### Issue 1: Search Not Triggering

**Symptoms:** Typing in search bar doesn't trigger any API calls

**Check:**
- Browser console for errors
- Network tab in DevTools for API calls
- Console logs from AttendanceDashboard

**Solution:**
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Check if JavaScript errors are blocking execution

### Issue 2: Search Parameter Not Sent

**Symptoms:** API call happens but search parameter is missing

**Check:**
- Browser console for `[analyticsService]` log
- Network tab to inspect actual request URL

**Solution:**
- Verify the search value is in filters state
- Check if debounce is working (wait 500ms after typing)

### Issue 3: Backend Not Receiving Search

**Symptoms:** Frontend sends search but backend doesn't receive it

**Check:**
- Backend console for `[analyticsController]` log
- Network response in browser DevTools

**Solution:**
- Restart backend server
- Check if route is correctly configured
- Verify no middleware is stripping parameters

### Issue 4: No Results Found

**Symptoms:** Search executes but returns no employees

**Check:**
- Backend console for `[AnalyticsService]` logs
- Run test script to verify database has matching employees
- Check if search term matches any employee names/codes

**Solution:**
- Try searching for a known employee name
- Check database for actual employee data
- Verify regex is working correctly

### Issue 5: Cache Issues

**Symptoms:** Search returns old results

**Solution:**
- Clear analytics cache via API:
  ```bash
  curl -X POST http://localhost:5000/api/analytics/cache/clear
  ```
- Clear browser cache
- The cache key includes search parameter, so different searches should not share cache

## Testing Checklist

- [ ] Search bar appears in analytics page header
- [ ] Typing in search bar shows console logs
- [ ] After 500ms, API call is triggered
- [ ] Network tab shows search parameter in URL
- [ ] Backend logs show received search parameter
- [ ] Backend logs show built query with $or condition
- [ ] Results are filtered correctly
- [ ] Clear button (X) appears when typing
- [ ] Clear button resets search and shows all employees
- [ ] Pagination resets to page 1 when searching

## Expected Behavior

1. User types in search bar
2. After 500ms of no typing, search is triggered
3. API call includes search parameter
4. Backend filters employees by name or code
5. Results update to show only matching employees
6. Summary metrics update to reflect filtered employees
7. Pagination resets to page 1

## MongoDB Query Example

When searching for "john", the backend builds this query:

```javascript
{
  role: { $ne: 'Admin' },
  isActive: true,
  $or: [
    { fullName: /john/i },
    { employeeCode: /john/i }
  ]
}
```

This matches any employee whose name or code contains "john" (case-insensitive).

## Files Modified

### Frontend
- `frontend/src/components/Analytics/AttendanceDashboard.jsx`
- `frontend/src/services/analyticsService.js`

### Backend
- `backend/controllers/analyticsController.js`
- `backend/services/AnalyticsService.js`

### Test Scripts
- `backend/scripts/test-analytics-search.js` (new)

## Next Steps if Still Not Working

1. Share the console logs from both frontend and backend
2. Share the Network tab request/response
3. Run the test script and share output
4. Check if there are any JavaScript errors in console
5. Verify MongoDB connection and employee data exists
