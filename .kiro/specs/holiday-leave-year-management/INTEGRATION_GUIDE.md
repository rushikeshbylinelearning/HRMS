# Holiday & Leave Year Management System - Integration Guide

## Quick Start

This guide will help you integrate the Holiday & Leave Year Management System into your existing application.

## Prerequisites

- Node.js backend with Express and MongoDB
- React frontend with Material-UI v5
- Existing authentication system

## Backend Integration

### Step 1: Install Dependencies

```bash
cd backend
npm install node-cache
```

### Step 2: Register Routes in server.js

Add these imports at the top of your `backend/server.js`:

```javascript
const leaveYearRoutes = require('./routes/leaveYearRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const errorHandler = require('./middleware/errorHandler');
```

Register the routes (before your existing routes or after, depending on your setup):

```javascript
// Leave Year Management Routes
app.use('/api/admin/leave-years', leaveYearRoutes);

// Holiday Routes (handles both admin and employee endpoints)
app.use('/api', holidayRoutes);
```

Add error handler as the LAST middleware (after all routes):

```javascript
// Error handler must be last
app.use(errorHandler);
```

### Step 3: Initialize Services on Startup

Add this code in your server startup section:

```javascript
// Initialize services
const activeYearCache = require('./services/activeYearCache');
const attendanceSync = require('./services/attendanceSync');

// Warm up cache on startup
activeYearCache.warmUp().then(() => {
    console.log('Active year cache warmed up');
}).catch(err => {
    console.error('Failed to warm up cache:', err);
});
```

### Step 4: Run Database Migrations

```bash
cd backend
node migrations/migrate.js up
```

This will:
- Create a default leave year for the current calendar year
- Associate all existing holidays with the default year
- Create necessary indexes

### Step 5: Verify Backend Setup

Test the endpoints:

```bash
# Get active year
curl http://localhost:5000/api/admin/leave-years/active

# List all years
curl http://localhost:5000/api/admin/leave-years

# List holidays
curl http://localhost:5000/api/admin/holidays
```

## Frontend Integration

### Step 1: Wrap App with ActiveYearProvider

Update your `frontend/src/App.jsx`:

```javascript
import { ActiveYearProvider } from './context/ActiveYearContext';

function App() {
    return (
        <AuthProvider>
            <ActiveYearProvider>
                <ThemeProvider theme={theme}>
                    <Router>
                        {/* Your existing routes */}
                    </Router>
                </ThemeProvider>
            </ActiveYearProvider>
        </AuthProvider>
    );
}

export default App;
```

### Step 2: Add Admin Route

Add the holiday management route to your admin routes:

```javascript
import HolidayManagementPage from './pages/admin/HolidayManagementPage';

// In your Routes component
<Route path="/admin/holidays" element={<HolidayManagementPage />} />
```

### Step 3: Add Navigation Link

Add a link to the holiday management page in your admin navigation:

```javascript
<MenuItem component={Link} to="/admin/holidays">
    Holiday Management
</MenuItem>
```

### Step 4: Update Employee Leaves Component (Optional)

If you want employees to see only active year holidays, update your employee leaves component:

```javascript
import { useActiveYear } from '../context/ActiveYearContext';

function EmployeeLeavesSection() {
    const { activeYear, loading, error } = useActiveYear();
    
    // Show active year badge
    return (
        <Box>
            {activeYear && (
                <Chip 
                    label={`Leave Year: ${activeYear.year}`} 
                    size="small" 
                    sx={{ mb: 2 }}
                />
            )}
            {/* Rest of your component */}
        </Box>
    );
}
```

## Configuration

### Axios Configuration

Ensure your axios instance is configured to send authentication tokens:

```javascript
// frontend/src/api/axios.js
import axios from 'axios';

const instance = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
});

// Add auth token to requests
instance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default instance;
```

Make sure to import this configured axios instance in your components:

```javascript
import axios from '../api/axios'; // or wherever your configured instance is
```

### Environment Variables

Backend `.env`:
```
MONGODB_URI=mongodb://localhost:27017/your-database
NODE_ENV=development
```

Frontend `.env`:
```
REACT_APP_API_URL=http://localhost:5000
```

## Testing the Integration

### 1. Test Backend

```bash
# Start backend
cd backend
npm start

# In another terminal, test endpoints
curl http://localhost:5000/api/admin/leave-years/active
```

### 2. Test Frontend

```bash
# Start frontend
cd frontend
npm start

# Navigate to http://localhost:3000/admin/holidays
```

### 3. Test Full Flow

1. Login as admin
2. Navigate to Holiday Management page
3. Create a new leave year
4. Add some holidays
5. Activate the new year
6. Verify employee views show new year holidays

## Troubleshooting

### Backend Issues

**Error: "Cannot find module 'node-cache'"**
```bash
cd backend
npm install node-cache
```

**Error: "No active leave year found"**
```bash
# Run migrations
node migrations/migrate.js up
```

**Error: "Route not found"**
- Check that routes are registered in server.js
- Verify route paths match the controller endpoints

### Frontend Issues

**Error: "useActiveYear must be used within ActiveYearProvider"**
- Ensure ActiveYearProvider wraps your App component
- Check that the provider is above the component using the hook

**Error: "Network Error" or "401 Unauthorized"**
- Verify backend is running
- Check axios configuration includes auth token
- Verify user has admin/HR role

**Components not rendering**
- Check browser console for errors
- Verify all Material-UI dependencies are installed
- Check that routes are properly configured

### Database Issues

**Error: "Duplicate key error"**
- This might occur if you run migrations twice
- Check if leave year already exists
- Run rollback: `node migrations/migrate.js down`

**Error: "Index already exists"**
- This is usually safe to ignore
- Migrations handle existing indexes gracefully

## Rollback

If you need to rollback the changes:

### Backend Rollback

```bash
cd backend
node migrations/migrate.js down
```

This will:
- Remove leaveYearId from holidays
- Delete the default leave year
- Drop created indexes

### Frontend Rollback

1. Remove ActiveYearProvider from App.jsx
2. Remove the holiday management route
3. Remove navigation link

## Performance Optimization

### Backend

1. **Enable caching**: The activeYearCache is already implemented
2. **Add indexes**: Migrations create necessary indexes
3. **Use lean()**: Controllers already use lean() for read operations

### Frontend

1. **Lazy load the page**:
```javascript
const HolidayManagementPage = lazy(() => import('./pages/admin/HolidayManagementPage'));
```

2. **Memoize components**:
```javascript
const YearSelector = React.memo(YearSelectorComponent);
```

3. **Debounce search** (if you add search):
```javascript
const debouncedSearch = useMemo(
    () => debounce((value) => setSearchTerm(value), 300),
    []
);
```

## Security Considerations

1. **Authorization**: All admin endpoints check for admin/HR role
2. **Validation**: All inputs are validated on backend
3. **SQL Injection**: Using Mongoose ORM prevents SQL injection
4. **XSS**: React escapes output by default
5. **CSRF**: Ensure CSRF tokens are implemented if needed

## Monitoring

### Backend Logs

The system logs important events:
- Year activation/deactivation
- Cache hits/misses
- Event emissions
- Errors

Check logs for:
```
[ActiveYearCache] Cache HIT/MISS
[YearEventEmitter] Emitting activeYearChanged
[AttendanceSync] Synchronization completed
```

### Frontend Monitoring

Monitor browser console for:
- API errors
- Component errors
- Network issues

## Next Steps

After integration:

1. **Test thoroughly**: Go through all user flows
2. **Train users**: Show admins how to use the system
3. **Monitor**: Watch logs for any issues
4. **Optimize**: Add indexes if queries are slow
5. **Extend**: Add bulk operations, export features, etc.

## Support

For issues:
- Check the design document: `design.md`
- Review requirements: `requirements.md`
- See implementation status: `IMPLEMENTATION_STATUS.md`
- Frontend README: `frontend/src/pages/admin/README_HOLIDAY_MANAGEMENT.md`

## Checklist

### Backend
- [ ] Installed node-cache
- [ ] Registered routes in server.js
- [ ] Added error handler middleware
- [ ] Initialized services on startup
- [ ] Ran migrations
- [ ] Tested endpoints

### Frontend
- [ ] Wrapped App with ActiveYearProvider
- [ ] Added admin route
- [ ] Added navigation link
- [ ] Configured axios
- [ ] Tested page loads
- [ ] Tested CRUD operations

### Testing
- [ ] Created a leave year
- [ ] Added holidays
- [ ] Activated a year
- [ ] Locked/unlocked a year
- [ ] Moved a holiday
- [ ] Deleted a holiday
- [ ] Verified employee views

### Production
- [ ] Backed up database
- [ ] Tested on staging
- [ ] Updated documentation
- [ ] Trained users
- [ ] Deployed to production
- [ ] Monitored for issues
