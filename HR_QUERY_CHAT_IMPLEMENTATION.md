# HR Query Chat System - Implementation Guide

## Overview
Implemented a comprehensive chat-based interface for employees to ask questions about company policies, HR-related topics, and receive responses from HR/Admin staff. This replaces the simple anonymous feedback system with a full conversation thread system.

## Features Implemented

### 1. Employee Interface (Profile Page)
- **Chat Interface**: Replaced the "ANONYMOUS MESSAGE" section with an "ASK HR" chat interface
- **Query Creation**: Employees can create new queries with:
  - Subject line
  - Category selection (Policy, Leave, Attendance, Payroll, Benefits, Compliance, General, Other)
  - Initial message
- **Conversation View**: Full chat interface showing:
  - Message history with timestamps
  - Sender identification (Employee, HR, Admin)
  - Real-time conversation threading
  - Unread message badges
- **Query List**: View all their queries with status indicators
- **Status Management**: Employees can close their own queries
- **Real-time Updates**: Automatic read receipts when viewing messages

### 2. Admin/HR Interface (Policies Management Page)
- **New Tab**: Added "HR Queries" tab in Admin Policies page
- **Dashboard View**: Statistics showing:
  - Total queries
  - Open queries
  - In-progress queries
  - Resolved queries
  - Unread messages count
- **Query Management**:
  - Filter by status (Open, In Progress, Resolved, Closed)
  - Filter by category
  - Tab-based navigation for quick access
  - Two-panel layout (query list + conversation detail)
- **Conversation Interface**:
  - Full message history
  - Real-time messaging
  - Status management (Open, In Progress, Resolved, Closed)
  - Priority management (Low, Medium, High, Urgent)
  - Employee information display
- **Privacy Feature**: Queries marked as "anonymousToHR" hide employee details from HR/Admin

## Technical Implementation

### Backend

#### 1. New Model: `HRQuery.js`
```
Location: backend/models/HRQuery.js
```

**Schema Features**:
- Employee identification (trackable for thread continuity)
- Subject, category, status, priority
- Message array with sender tracking
- Read/unread status for each message
- Timestamps and metadata
- Support for file attachments (prepared for future)
- Anonymous mode toggle

**Methods**:
- `addMessage()`: Add new message to conversation
- `markMessagesAsRead()`: Update read status
- Virtuals for unread counts

#### 2. API Routes: `hrQueries.js`
```
Location: backend/routes/hrQueries.js
```

**Employee Endpoints**:
- `GET /api/hr-queries/my-queries` - Get all employee's queries
- `POST /api/hr-queries/create` - Create new query
- `POST /api/hr-queries/:queryId/message` - Add message to query
- `GET /api/hr-queries/:queryId` - Get specific query with messages
- `PATCH /api/hr-queries/:queryId/status` - Update query status (employee can close)

**Admin/HR Endpoints**:
- `GET /api/hr-queries/admin/all` - Get all queries with filters
- `POST /api/hr-queries/admin/:queryId/respond` - HR/Admin respond to query
- `PATCH /api/hr-queries/admin/:queryId` - Update query details (status, priority, assignment)
- `GET /api/hr-queries/admin/stats/overview` - Get statistics

**Security**:
- All routes require authentication
- Employee routes verify ownership
- Admin/HR routes verify role permissions
- Read receipts automatically marked when viewing

### Frontend

#### 1. Employee Component: `HRQueryChat.jsx`
```
Location: frontend/src/components/HRQueryChat.jsx
```

**Features**:
- Two-view system: Query list and chat view
- Create query dialog with form validation
- Real-time message display with sender identification
- Auto-scroll to latest message
- Status indicators with color coding
- Unread message badges
- Responsive design for sidebar

#### 2. Admin Component: `HRQueryManagement.jsx`
```
Location: frontend/src/components/admin/HRQueryManagement.jsx
```

**Features**:
- Statistics dashboard with cards
- Tab-based filtering (All, Open, In Progress, Resolved)
- Category filtering
- Two-panel layout (list + detail)
- Status and priority management
- Real-time conversation interface
- Employee information display
- Responsive grid layout

#### 3. Integration Updates
- Updated `ProfilePolicies.jsx` to use `HRQueryChat` instead of `AnonymousFeedback`
- Updated `AdminPoliciesPage.jsx` to add new "HR Queries" tab
- Added route to `server.js` for HR query endpoints

## Database Indexes

The HRQuery model includes optimized indexes for:
- Employee ID + Status
- Status + Last Message Date
- Assigned To + Status
- Last Message Date (descending)
- Category + Status

## Usage Guide

### For Employees:
1. Navigate to Profile page
2. Scroll to "ASK HR" section
3. Click "New Query" button
4. Fill in subject, category, and question
5. Submit and receive responses from HR/Admin
6. Continue conversation as needed
7. Close query when resolved

### For HR/Admin:
1. Navigate to Admin → Policies page
2. Click "HR Queries" tab
3. View statistics dashboard
4. Filter queries by status/category
5. Click a query to view details
6. Respond to employee messages
7. Update status and priority as needed
8. Mark queries as resolved when complete

## Benefits Over Previous System

### Previous System (Anonymous Feedback):
- ❌ One-way communication only
- ❌ No follow-up possible
- ❌ No tracking or categorization
- ❌ No status management
- ❌ Anonymous with no thread continuity

### New System (HR Query Chat):
- ✅ Two-way conversation
- ✅ Thread continuity
- ✅ Categorization and filtering
- ✅ Status tracking (Open → In Progress → Resolved)
- ✅ Priority management
- ✅ Read receipts
- ✅ Statistics and analytics
- ✅ Employee identity maintained (with optional anonymity)
- ✅ Better for policy questions and HR support

## Future Enhancements (Prepared For):

1. **File Attachments**: Schema supports attachments array
2. **Assignment System**: Queries can be assigned to specific HR staff
3. **Email Notifications**: Notify parties when new messages arrive
4. **Search Functionality**: Search through queries by keywords
5. **Export Feature**: Export conversation history
6. **SLA Tracking**: Track response times and resolution times
7. **Tags/Labels**: Add custom tags for better organization
8. **Canned Responses**: Quick reply templates for common questions

## Testing Checklist

- [ ] Employee can create new queries
- [ ] Employee can view all their queries
- [ ] Employee can send messages in a query
- [ ] Employee can close their own queries
- [ ] HR/Admin can view all queries
- [ ] HR/Admin can respond to queries
- [ ] HR/Admin can update status and priority
- [ ] Unread badges work correctly
- [ ] Read receipts mark messages as read
- [ ] Filtering by status works
- [ ] Filtering by category works
- [ ] Statistics update correctly
- [ ] Real-time updates work in both interfaces

## Notes

- The system maintains employee identity for thread continuity but has a privacy toggle
- Messages are stored in chronological order
- Auto-scroll keeps the latest message visible
- Color coding helps distinguish message senders
- Status automatically updates to "open" if employee sends message to closed query
- Responsive design works on mobile and desktop
