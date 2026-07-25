# Attendance Management System (AMS)

A full-stack employee attendance management platform built with Node.js/Express (backend) and React/Vite (frontend), using MongoDB as the database.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Material UI, React Router v6 |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose ODM) |
| Auth | JWT (RS256), httpOnly refresh cookies, SSO (JWKS) |
| Real-time | Socket.IO |
| File Storage | MongoDB GridFS |
| Caching | In-memory (NodeCache + custom cacheService) |
| Scheduling | node-cron (cronService) |

---

## Project Structure

```
attendance-system/
├── backend/                  # Express API server
│   ├── config/               # Security, shift policy, production config
│   ├── controllers/          # Analytics, export, CIF, holiday controllers
│   ├── cron/                 # Leave accrual cron jobs
│   ├── jobs/                 # Tea break enforcer job
│   ├── keys/                 # RSA private/public keys for JWT
│   ├── middleware/           # Auth, validation, upload, geofencing
│   ├── models/               # Mongoose schemas
│   ├── modules/cif/          # CIF (Confidential Info Form) module
│   ├── routes/               # All Express route files
│   ├── services/             # Business logic services
│   ├── utils/                # Helpers (JWT, IST time, cache, etc.)
│   └── server.js             # App entry point
└── frontend/                 # React SPA
    └── src/
        ├── api/              # Axios instance + interceptors
        ├── components/       # Shared UI components
        ├── context/          # React contexts (Auth, Break, TeaBreak, etc.)
        ├── hooks/            # Custom hooks
        ├── pages/            # Page-level components
        ├── services/         # Frontend service helpers
        ├── utils/            # Prefetch, resource preloader, SSO consumer
        └── App.jsx           # Router + context providers
```

---

## Architecture Overview

```
Browser (React SPA)
       |
       | HTTPS  +  WebSocket (Socket.IO)
       |
Express Server (Node.js)
       |
       |-- JWT Auth (RS256) via httpOnly refresh cookie + in-memory access token
       |-- Middleware: helmet, CORS, compression, session, sanitize, logger
       |-- REST API routes (/api/*)
       |-- Static file serving (frontend/dist -> SPA fallback)
       |
MongoDB (Mongoose)
       |-- Collections: users, attendancelogs, attendancesessions, breaklogs,
           leaverequests, shifts, holidays, leaveyears, notifications, ...
       |-- GridFS buckets: avatars, medicalCertificates, policies
```

---

## Authentication Flow

### Local Login
1. `POST /api/auth/login` — email + password + geolocation (required for non-admin)
2. Server validates credentials, checks geofence, issues:
   - **Access token** (15 min, RS256 JWT) returned in response body
   - **Refresh token** (7 days, httpOnly cookie, stored hashed in MongoDB)
3. Frontend stores access token **in memory only** (AuthContext state + axios header)
4. Every 13 minutes a proactive refresh fires: `POST /api/auth/refresh`
5. On 401, axios interceptor silently refreshes and retries the original request
6. Logout: `POST /api/auth/logout` revokes refresh token server-side, clears cookie

### SSO Login
1. User arrives from SSO portal with `?sso_token=...` or `?ams_token=...`
2. `POST /api/auth/sso-consume` validates SSO JWT via JWKS endpoint
3. Server finds or creates the AMS user, issues an AMS access + refresh token
4. Frontend proceeds identically to local login from step 3

### Session Restore (page refresh)
1. AuthContext fires `POST /api/auth/refresh` on load (httpOnly cookie sent automatically)
2. On success: `GET /api/auth/me` hydrates the user object
3. On failure: user is redirected to `/login`

---

## Backend API Routes

### Public (no auth required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Local email/password login |
| POST | `/api/auth/sso-consume` | Consume SSO token, issue AMS token |
| GET | `/api/auth/me` | Get current user (JWT or SSO session) |
| POST | `/api/auth/refresh` | Rotate refresh token, issue new access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET/POST | `/api/public/*` | Public profile form (no auth) |
| GET | `/api/sso/*` | SSO portal integration routes |
| GET | `/health` | Server + DB + SSO health check |

### Attendance
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/attendance/status?date=` | Daily attendance status for current user |
| POST | `/api/attendance/clock-in` | Clock in (geofence validated) |
| POST | `/api/attendance/clock-out` | Clock out (early exit requires approval) |
| GET | `/api/attendance/live-overview` | Real-time attendance board (permission-gated) |

### Breaks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/breaks/start` | Start a break (Paid / Unpaid / Extra) |
| POST | `/api/breaks/end` | End current break |
| POST | `/api/breaks/request-extra` | Request an extra break |

### Leaves
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leaves/my-requests` | Employee's own leave requests |
| GET | `/api/leaves/my-leave-balances` | Current leave balances |
| GET | `/api/leaves/allowed-types` | Allowed leave types by employment status |
| GET | `/api/leaves/holidays` | Public holidays list |
| POST | `/api/leaves/check-eligibility` | Validate leave before submitting |
| POST | `/api/leaves/request` | Submit a leave request |
| PUT | `/api/leaves/request/:id/correct` | Resubmit a returned leave |
| POST | `/api/leaves/upload-medical-certificate` | Upload medical cert (GridFS) |
| POST | `/api/leaves/year-end-request` | Submit carry-forward / encash request |

### User / Profile
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/profile` | Get own profile |
| PUT | `/api/user/update-profile` | Update personal and identity details |
| POST | `/api/users/upload-avatar` | Upload avatar (GridFS, WebP) |
| DELETE | `/api/users/remove-avatar` | Remove avatar |
| GET | `/api/users/avatar/:id` | Serve avatar image from GridFS |

### Admin — Employees
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/employees` | List employees (paginated + search) |
| POST | `/api/admin/employees` | Create employee |
| PUT | `/api/admin/employees/:id` | Update employee |
| DELETE | `/api/admin/employees/:id` | Delete employee |
| PATCH | `/api/admin/employees/:id/shift` | Update shift assignment |
| PATCH | `/api/admin/employees/:id/saturday-policy` | Update Saturday policy |
| POST | `/api/admin/employees/:id/probation-settings` | Set probation config |

### Admin — Leaves
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/leaves/all` | All leave requests (paginated, filterable) |
| POST | `/api/admin/leaves` | Admin-create a leave |
| PATCH | `/api/admin/leaves/:id` | Approve / reject / return a leave |
| GET | `/api/admin/leaves/analytics/counts` | Leave count analytics |

### Admin — Reports
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/reports/attendance` | Generate attendance report |
| POST | `/api/admin/reports/leaves` | Generate leave + absent report |
| POST | `/api/admin/reports/notes` | Generate notes report |

### Admin — Shifts and Locations
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/api/admin/shifts` | CRUD shifts |
| GET/POST/PUT/DELETE | `/api/admin/office-locations` | CRUD office locations (geofence) |
| GET/POST | `/api/admin/settings` | System settings |
| GET/POST | `/api/admin/manage` | Break approvals, early checkout approvals |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/attendance` | Attendance analytics (Admin/HR) |
| GET | `/api/analytics/employee/:id` | Per-employee detailed analytics |
| GET | `/api/analytics/export/employee/:id` | Export analytics (xlsx/csv/pdf) |

### Other Modules
| Prefix | Description |
|--------|-------------|
| `/api/probation` | Probation tracker — calculates extensions from leave/absent history |
| `/api/payroll` | Payroll management (settings, calculate, generate, approve) |
| `/api/holidays` | Holiday CRUD + clone between leave years |
| `/api/admin/leave-years` | Leave year management |
| `/api/admin/leave-accrual` | Leave accrual rules and manual triggers |
| `/api/announcements` | Chat-style announcements + polls |
| `/api/tea-break` | Tea break timer (active, end, stop) |
| `/api/new-notifications` | In-app notification feed |
| `/api/resource-requests` | Employee resource requests |
| `/api/admin/cif` | Confidential Information Form management |
| `/api/policies` | Company policy documents (GridFS) |

---

## Frontend Routes

All routes except `/login`, `/sso-login`, `/auth/sso-callback`, and `/public-form` require authentication.
Unauthenticated access redirects to `/login`.

| Path | Page | Access |
|------|------|--------|
| `/login` | LoginPage | Public |
| `/sso-login` | SSOLoginPage | Public |
| `/auth/sso-callback` | SSOCallbackPage | Public |
| `/public-form` | PublicProfileForm | Public |
| `/` | Redirect to `/dashboard` or `/login` | — |
| `/dashboard` | Admin or Employee Dashboard (by role) | Auth |
| `/attendance-summary` | AttendanceSummaryPage | Auth |
| `/leaves` | LeavesPage | Auth + `leaves` permission |
| `/requests` | RequestsPage | Auth |
| `/profile` | ProfilePage | Auth |
| `/activity-log` | NewActivityLogPage | Auth |
| `/employees` | EmployeesPage | Auth |
| `/employees/deactivated` | DeactivatedEmployeesPage | Auth |
| `/admin/leaves` | AdminLeavesPage | Auth |
| `/admin/leaves/more-options/leaves-tracker` | LeavesTrackerPage | Auth |
| `/admin/attendance-summary` | AdminAttendanceSummaryPage | Auth |
| `/admin/holidays` | HolidayManagementPage | Auth |
| `/admin/policies` | AdminPoliciesPage | Auth |
| `/admin/cif` | CIFManagementPage | Auth |
| `/admin/cif/employee/:employeeId` | EmployeeCIFDetailsPage | Auth |
| `/scheduling-management` | SchedulingManagementPage | Auth |
| `/manage-section` | ManageSectionPage | Auth |
| `/probation` | ProbationPage | Auth |
| `/employee-muster-roll` | EmployeeMusterRollPage | Auth |
| `/reports` | ReportsPage | Auth + `viewReports` permission |
| `/analytics/attendance` | AnalyticsPage | Auth |
| `/analytics/employee/:employeeId` | EmployeeDetailedAnalyticsPage | Auth |
| `/live-attendance` | LiveAttendancePage | Auth + `viewLiveAttendance` permission |
| `/resource-requests/manage` | AdminRequestsPage | Auth + `manageResourceRequests` permission |
| `/payroll` | PayrollManagementPage | Auth |

---

## Key Data Flows

### Clock-In
```
Employee clicks Clock In
  -> POST /api/attendance/clock-in
  -> Geofencing middleware validates GPS coordinates
  -> Creates AttendanceLog + AttendanceSession in MongoDB
  -> Calculates late/on-time vs shift start time (+grace period)
  -> Sends notification to admins + confirmation to employee
  -> Emits attendance_log_updated via Socket.IO
  -> Invalidates status cache for that date
```

### Clock-Out
```
Employee clicks Clock Out
  -> POST /api/attendance/clock-out
  -> Checks for active breaks (must end break first)
  -> Checks early checkout policy (requires approved EarlyCheckoutRequest)
  -> Calculates elapsed shift time (clock-out minus clock-in)
  -> Status: Absent (<5h elapsed), Half-day (5-9h), Full day (>=9h)
  -> Updates AttendanceLog, emits Socket.IO event, invalidates cache
```

### Leave Request
```
Employee submits leave
  -> POST /api/leaves/request
  -> LeaveValidationService checks balance, advance notice, duplicates
  -> Saturday clubbing applied for Planned leave with >=30 days notice
  -> LeaveRequest created (status: Pending)
  -> Email to HR + confirmation to employee via Socket.IO

Admin approves
  -> PATCH /api/admin/leaves/:id { status: Approved }
  -> Leave balance atomically deducted from User.leaveBalances
  -> AttendanceLog records for leave dates updated to Leave status
  -> Notification emitted to employee
```

### Break
```
POST /api/breaks/start  -> BreakLog created
POST /api/breaks/end    -> BreakLog closed, duration calculated
                           Paid break excess -> penaltyMinutes on AttendanceLog
                           Unpaid/Extra -> unpaidBreakMinutesTaken incremented
                           Required logout time shifts accordingly
```

---

## Real-time (Socket.IO)

- **Auth**: JWT passed in `socket.handshake.auth.token`, verified on connect
- **Rooms**: `user_{id}` (personal), `admin_room`, `announcements`
- **Server emits**: `attendance_log_updated`, `leave_request_updated`,
  `permissions_updated`, `employment_status_updated`, `user_profile_updated`,
  `receiveAnnouncement`, `poll_updated`, `tea_break_started`, `tea_break_ended`

---

## Role and Permission Model

| Role | Access |
|------|--------|
| Admin | Full access to all routes and admin panels |
| HR | Same as Admin for most features |
| Employee | Own attendance, leaves, breaks, profile, announcements |
| Intern | Same as Employee, restricted to LOP + Compensatory leave only |

Feature permissions are stored per user in `User.featurePermissions` and control:
live attendance view, analytics, reports, bulk actions, extra breaks, resource requests.

---

## Background Jobs

Managed by `cronService` (node-cron):

- **Auto-logout** — closes open sessions when required shift time is elapsed
- **Leave accrual** — monthly accrual of balances for permanent employees
- **Half-day conversion** — converts insufficient-hours attendance to half-day
- **Tea break enforcement** — auto-ends tea breaks after 10 minutes
- **Absent-to-leave conversion** — converts absences to leave deductions per policy

---

## Environment Variables

Key variables in `backend/.env`:

```
NODE_ENV=production
PORT=3011
MONGO_URI=mongodb://...
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
SESSION_SECRET=...
SSO_JWKS_URL=https://sso.example.com/.well-known/jwks.json
SSO_ISSUER=sso-portal
SSO_AUDIENCE=sso-apps
FRONTEND_URL=https://attendance.example.com
HR_EMAILS=hr@example.com
SMTP_HOST=...
```

---

## Running Locally

```bash
# Backend
cd backend
npm install
node generate-rsa-keys.js   # generate RSA key pair (once)
npm start                   # runs on port 3011

# Frontend
cd frontend
npm install
npm run dev                 # runs on port 5173, proxies /api to :3011
```

The Vite dev proxy rewrites cookies so the httpOnly refresh cookie works across ports.