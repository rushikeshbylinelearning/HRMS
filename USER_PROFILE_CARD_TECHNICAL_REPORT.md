# User Profile Card - Technical Data Flow Report

## Executive Summary
This report documents the data sources, API endpoints, and rendering logic for the User Profile Card component in the attendance management system.

---

## 1. Component Identification

### Primary Component
**File Path:** `frontend/src/components/Profile/ProfileSidebar.jsx`

**Component Type:** React Functional Component (Memoized)

**Keywords Found:** 
- Employee Code (e.g., "BYL202505-E71")
- Department
- Join Date
- Work Email
- Full Name with Initials Avatar

### Parent Component
**File Path:** `frontend/src/pages/ProfilePage.jsx`

**Role:** Orchestrates data fetching and passes user data to ProfileSidebar

---

## 2. Data Flow Architecture

### 2.1 Authentication & User Context
**Context Provider:** `frontend/src/context/AuthContext.jsx`

**Key Functions:**
- `initializeAuth()` - Initializes authentication on app load
- `loginWithToken()` - Authenticates user with JWT token
- `refreshUserData()` - Refreshes user data from backend

**State Management:**
- User data stored in React Context (`AuthContext`)
- Accessed via `useAuth()` hook
- Global state shared across all components

### 2.2 API Endpoint

**Primary Endpoint:** `GET /api/auth/me`

**Backend Route:** `backend/routes/auth.js` (Line 203)

**Authentication:** 
- JWT Bearer Token (Header: `Authorization: Bearer <token>`)
- Supports both SSO and local authentication methods

**Response Structure:**
```javascript
{
  id: String,
  name: String,
  fullName: String,
  employeeCode: String,
  email: String,
  role: String,
  employmentStatus: String,
  domain: String,
  designation: String,
  department: String,
  joiningDate: Date,
  alternateSaturdayPolicy: String,
  profileImageUrl: String,
  authMethod: String,
  featurePermissions: Object,
  shift: Object
}
```

### 2.3 Data Model
**Database Model:** `backend/models/User.js`

**Schema Fields Used:**
- `employeeCode` - Unique employee identifier
- `fullName` - Employee's full name
- `email` - Work email address
- `department` - Department name
- `joiningDate` - Date of joining (Date type)
- `profileImageUrl` - Avatar image URL

---

## 3. Component Code Analysis

### 3.1 ProfileSidebar Component

**Location:** `frontend/src/components/Profile/ProfileSidebar.jsx`

**Key Features:**
- Memoized component (prevents unnecessary re-renders)
- Receives `user` object as prop from parent
- Renders single card with avatar, name, badges, and details

**Code Snippet - Data Fetching:**
```jsx
const ProfileSidebar = memo(({ user }) => {
    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        return (parts.length >= 2 
            ? parts[0][0] + parts[parts.length - 1][0] 
            : name.substring(0, 2)
        ).toUpperCase();
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="profile-sidebar">
            <div className="sidebar-card">
                {/* Avatar with initials */}
                <div className="profile-avatar">
                    <div className="avatar-circle">
                        {getInitials(user?.fullName)}
                    </div>
                </div>

                {/* Name & Badges */}
                <div className="profile-header">
                    <h2 className="profile-name">{user?.fullName || 'Test Admin'}</h2>
                    <p className="profile-subtitle">Not specified</p>
                    <div className="profile-badges">
                        <span className="badge badge-id">{user?.employeeCode || 'A200001'}</span>
                        <span className="badge badge-status">Employee</span>
                    </div>
                </div>

                {/* Details Section */}
                <div className="profile-details">
                    <div className="info-row">
                        <span className="info-label">DEPARTMENT</span>
                        <span className="info-value">{user?.department || 'IT'}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">JOIN DATE</span>
                        <span className="info-value">{formatDate(user?.joiningDate)}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">WORK EMAIL</span>
                        <span className="info-value info-value-email">{user?.email || 'sudhirtech@example.com'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
});
```

### 3.2 ProfilePage Component

**Location:** `frontend/src/pages/ProfilePage.jsx`

**Data Loading Strategy:**
```jsx
const ProfilePage = () => {
    const { user, refreshUserData } = useAuth();
    
    // Memoized sidebar prevents re-renders
    const memoizedSidebar = useMemo(() => (
        <ProfileSidebar user={user} />
    ), [user?.fullName, user?.employeeCode, user?.department, user?.joiningDate, user?.email]);

    return (
        <div className="profile-page">
            <div className="profile-container">
                {memoizedSidebar}
                {/* Other components */}
            </div>
        </div>
    );
};
```

---

## 4. Field Mapping Table

| UI Label | Data Key | Source | Status | Notes |
|----------|----------|--------|--------|-------|
| **Avatar Initials** | `user.fullName` | `GET /api/auth/me` → `fullName` | Live | Computed from first and last name initials |
| **Full Name** | `user.fullName` | `GET /api/auth/me` → `fullName` | Live | Direct mapping from User model |
| **Employee Code** | `user.employeeCode` | `GET /api/auth/me` → `employeeCode` | Live | Unique identifier (e.g., "BYL202505-E71") |
| **Status Badge** | Hardcoded | N/A | Hardcoded | Always displays "Employee" |
| **DEPARTMENT** | `user.department` | `GET /api/auth/me` → `department` | Live | Department name from User model |
| **JOIN DATE** | `user.joiningDate` | `GET /api/auth/me` → `joiningDate` | Live | Formatted as "MMM DD, YYYY" |
| **WORK EMAIL** | `user.email` | `GET /api/auth/me` → `email` | Live | Primary work email from User model |
| **Subtitle** | Hardcoded | N/A | Hardcoded | Always displays "Not specified" |

---

## 5. Data Fetching Flow

### 5.1 Initial Load Sequence

```
1. App Initialization
   └─> AuthContext.initializeAuth()
       └─> Check for token in sessionStorage/localStorage
           └─> If token exists:
               └─> api.get('/auth/me')
                   └─> Backend verifies JWT token
                       └─> Returns user data
                           └─> setUser(userData)
                               └─> User data available in context

2. ProfilePage Component Mount
   └─> useAuth() hook retrieves user from context
       └─> Pass user to ProfileSidebar
           └─> Render profile card with user data
```

### 5.2 Data Refresh Triggers

**Automatic Refresh:**
- Socket.io event: `permissions_updated`
- Socket.io event: `employment_status_updated`
- Socket.io event: `user_profile_updated`

**Manual Refresh:**
- User saves profile changes
- Page reload/refresh

**Refresh Function:**
```javascript
const refreshUserData = async () => {
    const response = await api.get('/auth/me');
    setUser(response.data);
    return response.data;
};
```

---

## 6. API Service Layer

### 6.1 Axios Configuration
**File:** `frontend/src/api/axios.js`

**Base Configuration:**
- Base URL: `VITE_API_BASE_URL` environment variable
- Authorization: JWT Bearer token in header
- Interceptors: Handle 401 errors and token refresh

### 6.2 Backend Route Handler
**File:** `backend/routes/auth.js`

**Endpoint:** `GET /auth/me`

**Key Logic:**
1. Extract JWT token from Authorization header
2. Verify token (supports both SSO and local tokens)
3. Fetch user from database by userId
4. Populate shift group data
5. Check cache for performance
6. Return formatted user response

**Code Snippet:**
```javascript
router.get('/me', async (req, res) => {
    try {
        // Token verification logic
        const token = req.headers['authorization']?.split(' ')[1];
        const decoded = jwtUtils.verify(token);
        const userId = decoded.userId;

        // Check cache first
        const cachedUser = cacheService.getUser(userId);
        if (cachedUser) {
            return res.json(cachedUser);
        }

        // Fetch from database
        const user = await User.findById(userId)
            .populate('shiftGroup', 'shiftName startTime endTime durationHours paidBreakMinutes')
            .select('-passwordHash -__v')
            .lean();

        // Format response
        const userResponse = {
            id: user._id,
            fullName: user.fullName,
            employeeCode: user.employeeCode,
            email: user.email,
            department: user.department,
            joiningDate: user.joiningDate,
            // ... other fields
        };

        // Cache and return
        cacheService.setUser(userId, userResponse);
        res.json(userResponse);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

---

## 7. Additional Profile Data

### 7.1 Extended Profile Information

**Endpoint:** `GET /api/users/profile`

**File:** `backend/routes/userRoutes.js`

**Additional Fields:**
- `personalDetails` - Personal contact information (phone, emergency contacts, address)
- `identityDetails` - Identity documents (Aadhaar, PAN, bank details)
- `reportingPerson` - Manager information (populated from User reference)

**Note:** These fields are NOT defined in the User model schema but are stored as flexible objects in MongoDB (Mongoose allows undefined fields by default).

### 7.2 Profile Update Endpoint

**Endpoint:** `PUT /api/user/update-profile`

**Payload Structure:**
```javascript
{
  personalDetails: {
    bloodGroup: String,
    phoneNumber: String,
    phoneCountryCode: String,
    emergencyContactName: String,
    emergencyContactNumber: String,
    emergencyContactCountryCode: String,
    personalEmail: String,
    address: {
      flat: String,
      area: String,
      city: String,
      state: String,
      pincode: String
    }
  },
  identityDetails: {
    aadhaarNumber: String,
    panCardNumber: String,
    bankName: String,
    accountNumber: String,
    ifscCode: String
  }
}
```

---

## 8. Performance Optimizations

### 8.1 Frontend Optimizations
- **Memoization:** ProfileSidebar wrapped in `React.memo()`
- **Dependency Tracking:** useMemo with specific dependencies
- **Layout Lock:** Prevents mutations after initial render
- **Ref Guards:** Prevents unnecessary re-renders

### 8.2 Backend Optimizations
- **Caching:** User data cached in memory (cacheService)
- **Lean Queries:** `.lean()` for faster MongoDB queries
- **Field Selection:** `.select()` excludes sensitive fields
- **Population:** Only populates required fields from references

---

## 9. Security Considerations

### 9.1 Authentication
- JWT token required for all user data endpoints
- Token stored in both sessionStorage (tab-specific) and localStorage (persistence)
- Token verification on every request
- Support for both SSO and local authentication

### 9.2 Data Protection
- Password hash excluded from responses (`.select('-passwordHash')`)
- Sensitive fields (identity details) only visible to authorized users
- CORS and security headers configured
- Token expiration and refresh mechanisms

---

## 10. Known Issues & Limitations

### 10.1 Schema Inconsistencies
- `personalDetails`, `identityDetails`, and `reportingPerson` are used in code but NOT defined in User model schema
- These fields rely on Mongoose's flexible schema behavior
- **Recommendation:** Add explicit schema definitions for better type safety

### 10.2 Hardcoded Values
- Status badge always shows "Employee" (should be dynamic based on `user.role`)
- Subtitle always shows "Not specified" (could show designation or employment status)
- Default fallback values in UI (e.g., "IT", "A200001")

### 10.3 Missing Fields
- `reportingPerson` is referenced but not populated in `/auth/me` endpoint
- Only available in `/users/profile` endpoint
- Profile card doesn't display manager information

---

## 11. Recommendations

### 11.1 Schema Updates
```javascript
// Add to User model (backend/models/User.js)
personalDetails: {
  bloodGroup: String,
  phoneNumber: String,
  phoneCountryCode: { type: String, default: '+91' },
  emergencyContactName: String,
  emergencyContactNumber: String,
  emergencyContactCountryCode: { type: String, default: '+91' },
  personalEmail: String,
  address: {
    flat: String,
    area: String,
    city: String,
    state: String,
    pincode: String
  }
},
identityDetails: {
  aadhaarNumber: String,
  panCardNumber: String,
  bankName: String,
  accountNumber: String,
  ifscCode: String
},
reportingPerson: { 
  type: mongoose.Schema.Types.ObjectId, 
  ref: 'User' 
}
```

### 11.2 UI Improvements
- Make status badge dynamic based on `user.role` or `user.employmentStatus`
- Display designation in subtitle instead of "Not specified"
- Add manager information if available
- Show profile image if `profileImageUrl` exists

### 11.3 API Consolidation
- Include `reportingPerson` in `/auth/me` response
- Reduce need for multiple API calls
- Improve initial load performance

---

## 12. Testing Checklist

- [ ] Verify user data loads on profile page
- [ ] Check avatar initials generation for various name formats
- [ ] Test date formatting for different locales
- [ ] Verify fallback values when data is missing
- [ ] Test with SSO and local authentication
- [ ] Verify cache invalidation on data updates
- [ ] Test socket.io real-time updates
- [ ] Check responsive design on mobile devices

---

## Appendix A: Related Files

### Frontend Files
- `frontend/src/pages/ProfilePage.jsx` - Main profile page
- `frontend/src/components/Profile/ProfileSidebar.jsx` - Profile card component
- `frontend/src/components/Profile/ProfileMain.jsx` - Editable profile form
- `frontend/src/context/AuthContext.jsx` - Authentication context
- `frontend/src/api/axios.js` - API client configuration
- `frontend/src/styles/ProfilePage.css` - Profile page styles

### Backend Files
- `backend/routes/auth.js` - Authentication routes
- `backend/routes/userRoutes.js` - User profile routes
- `backend/models/User.js` - User data model
- `backend/middleware/authenticateToken.js` - JWT authentication middleware
- `backend/services/cacheService.js` - User data caching

---

## Appendix B: Environment Variables

### Frontend
- `VITE_API_BASE_URL` - Backend API base URL
- `VITE_SSO_PORTAL_URL` - SSO portal URL for authentication

### Backend
- `JWT_SECRET` - Secret key for JWT signing
- `FRONTEND_URL` - Frontend URL for CORS and redirects
- `BACKEND_PUBLIC_URL` - Public URL for avatar images
- `NODE_ENV` - Environment (development/production)

---

**Report Generated:** February 10, 2026  
**System Version:** Auto Model  
**Analysis Scope:** User Profile Card Component
