# Fix: 401 Unauthorized Error

## Issue
API requests to `/api/admin/leave-years` were returning 401 Unauthorized errors.

## Root Cause
The Holiday Management components were using `axios` directly instead of the configured `api` instance from `../api/axios`. 

The configured `api` instance includes:
- Authentication token headers
- Request/response interceptors
- Proper base URL configuration
- Token refresh logic

Using `axios` directly bypasses all of this, resulting in unauthenticated requests.

## Files Fixed

### 1. `frontend/src/pages/admin/HolidayManagementPage.jsx`
**Changed:**
```jsx
// Before:
import axios from 'axios';
await axios.get('/api/admin/leave-years');

// After:
import api from '../../api/axios';
await api.get('/admin/leave-years');
```

**All API calls updated:**
- `api.get('/admin/leave-years')` - Fetch all years
- `api.get('/admin/holidays?yearId=${yearId}')` - Fetch holidays
- `api.post('/admin/leave-years', payload)` - Create year
- `api.post('/admin/leave-years/${yearId}/lock')` - Toggle lock
- `api.delete('/admin/holidays/${holidayId}')` - Delete holiday
- `api.put('/admin/holidays/${holidayId}/move', {...})` - Move holiday

### 2. `frontend/src/components/admin/HolidayFormPanel.jsx`
**Changed:**
```jsx
// Before:
import axios from 'axios';
await axios.put(`/api/admin/holidays/${holiday._id}`, payload);
await axios.post('/api/admin/holidays', payload);

// After:
import api from '../../api/axios';
await api.put(`/admin/holidays/${holiday._id}`, payload);
await api.post('/admin/holidays', payload);
```

### 3. `frontend/src/context/ActiveYearContext.jsx`
**Changed:**
```jsx
// Before:
import axios from 'axios';
const response = await axios.get('/api/admin/leave-years/active');

// After:
import api from '../api/axios';
const response = await api.get('/admin/leave-years/active');
```

## Key Changes

1. **Import Change:** `import axios from 'axios'` → `import api from '../../api/axios'`
2. **Instance Change:** `axios.get()` → `api.get()`
3. **URL Change:** `/api/admin/...` → `/admin/...` (base URL already includes `/api`)

## Why This Matters

The `api` instance from `../api/axios`:
- ✅ Automatically includes `Authorization: Bearer <token>` header
- ✅ Uses Vite proxy in development (`/api` → `http://localhost:3011`)
- ✅ Handles token refresh on 401 errors
- ✅ Includes request/response interceptors
- ✅ Properly configured for both dev and production

Using `axios` directly:
- ❌ No authentication headers
- ❌ No token management
- ❌ No proxy configuration
- ❌ Results in 401 Unauthorized errors

## Testing

After these changes:
1. ✅ API requests include authentication token
2. ✅ Requests go through Vite proxy to backend
3. ✅ 401 errors are handled with token refresh
4. ✅ Holiday Management page loads successfully

## Prevention

**Always use the configured `api` instance for API calls:**
```jsx
// ✅ CORRECT
import api from '../api/axios';
await api.get('/endpoint');

// ❌ WRONG
import axios from 'axios';
await axios.get('/api/endpoint');
```

---

**Fixed on:** ${new Date().toISOString()}
