# Policies Feature - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐         ┌──────────────────────┐        │
│  │   ProfilePage.jsx    │         │ AdminPoliciesPage.jsx│        │
│  │  (Employee View)     │         │   (Admin View)       │        │
│  └──────────┬───────────┘         └──────────┬───────────┘        │
│             │                                 │                     │
│             ├─────────────────────────────────┤                     │
│             │                                 │                     │
│  ┌──────────▼──────────┐         ┌───────────▼──────────┐         │
│  │   PolicyList.jsx    │         │ PolicyUploadForm.jsx │         │
│  │  - Display policies │         │  - Upload new policy │         │
│  │  - Click to view    │         │  - Version control   │         │
│  └──────────┬──────────┘         └──────────────────────┘         │
│             │                                                       │
│  ┌──────────▼──────────┐         ┌──────────────────────┐         │
│  │  PolicyViewer.jsx   │         │ AnonymousFeedback    │         │
│  │  - Embedded PDF     │         │  - Submit feedback   │         │
│  │  - Same page view   │         │  - No user ID        │         │
│  └─────────────────────┘         └──────────────────────┘         │
│                                                                     │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          │ HTTP/HTTPS
                          │ API Calls
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                      BACKEND (Node.js/Express)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    API Routes (/api/policies)                │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  GET    /api/policies              → Get all policies       │  │
│  │  GET    /api/policies/active       → Get active policies    │  │
│  │  POST   /api/policies/upload       → Upload new policy      │  │
│  │  POST   /api/policies/:id/replace  → Replace policy         │  │
│  │  DELETE /api/policies/:id          → Delete policy          │  │
│  │  POST   /api/policies/anonymous-feedback → Submit feedback  │  │
│  │  GET    /api/policies/anonymous-feedback → Get feedback     │  │
│  │                                                              │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                           │
│  ┌──────────────────────▼───────────────────────────────────────┐  │
│  │                    Middleware Layer                          │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  • requireAuth      → Authentication check                  │  │
│  │  • multer           → File upload handling                  │  │
│  │  • fileFilter       → PDF validation                        │  │
│  │  • Admin check      → Role-based access                     │  │
│  │                                                              │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                           │
│  ┌──────────────────────▼───────────────────────────────────────┐  │
│  │                   Business Logic                             │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  • Version auto-generation                                  │  │
│  │  • File storage management                                  │  │
│  │  • Policy archiving                                         │  │
│  │  • Anonymous feedback processing                            │  │
│  │                                                              │  │
│  └──────────────────────┬───────────────────────────────────────┘  │
│                         │                                           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                      DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐         ┌──────────────────────┐         │
│  │   MongoDB Database   │         │   File System        │         │
│  ├──────────────────────┤         ├──────────────────────┤         │
│  │                      │         │                      │         │
│  │  policies            │         │  /public/policies/   │         │
│  │  ├─ name             │         │  ├─ policy-xxx.pdf   │         │
│  │  ├─ version          │         │  ├─ policy-yyy.pdf   │         │
│  │  ├─ effectiveFrom    │         │  └─ policy-zzz.pdf   │         │
│  │  ├─ department       │         │                      │         │
│  │  ├─ status           │         │                      │         │
│  │  ├─ fileUrl          │         │                      │         │
│  │  ├─ fileName         │         │                      │         │
│  │  ├─ uploadedBy       │         │                      │         │
│  │  └─ replacedBy       │         │                      │         │
│  │                      │         │                      │         │
│  │  anonymousfeedbacks  │         │                      │         │
│  │  ├─ message          │         │                      │         │
│  │  ├─ submittedAt      │         │                      │         │
│  │  ├─ ipAddress        │         │                      │         │
│  │  └─ userAgent        │         │                      │         │
│  │                      │         │                      │         │
│  └──────────────────────┘         └──────────────────────┘         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Employee Views Policy

```
┌─────────┐     GET /api/policies      ┌─────────┐     Query DB     ┌──────────┐
│ Browser │ ────────────────────────> │ Backend │ ───────────────> │ MongoDB  │
│         │                            │         │                  │          │
│         │ <──────────────────────── │         │ <─────────────── │          │
└─────────┘   Return policy list       └─────────┘   Return docs    └──────────┘
     │
     │ Click policy
     │
     ▼
┌─────────┐
│ PDF     │ Load PDF from fileUrl
│ Viewer  │ (iframe src="/policies/policy-xxx.pdf")
└─────────┘
```

### 2. Admin Uploads Policy

```
┌─────────┐   POST /api/policies/upload   ┌─────────┐
│ Browser │ ──────────────────────────────> │ Backend │
│         │   (multipart/form-data)        │         │
└─────────┘                                 └────┬────┘
                                                 │
                                                 │ 1. Validate PDF
                                                 │ 2. Save to filesystem
                                                 │ 3. Generate version
                                                 │ 4. Save to DB
                                                 │
                                    ┌────────────▼────────────┐
                                    │                         │
                              ┌─────▼─────┐           ┌──────▼──────┐
                              │ File      │           │  MongoDB    │
                              │ System    │           │  Database   │
                              │           │           │             │
                              │ Save PDF  │           │ Save Policy │
                              │ to        │           │ Document    │
                              │ /policies │           │             │
                              └───────────┘           └─────────────┘
```

### 3. Admin Replaces Policy

```
┌─────────┐   POST /api/policies/:id/replace   ┌─────────┐
│ Browser │ ────────────────────────────────────> │ Backend │
│         │   (new PDF file)                     │         │
└─────────┘                                       └────┬────┘
                                                       │
                                                       │ 1. Find old policy
                                                       │ 2. Save new PDF
                                                       │ 3. Create new version
                                                       │ 4. Archive old version
                                                       │
                                          ┌────────────▼────────────┐
                                          │                         │
                                    ┌─────▼─────┐           ┌──────▼──────┐
                                    │ MongoDB   │           │  File       │
                                    │           │           │  System     │
                                    │ Old:      │           │             │
                                    │ status =  │           │ Save new    │
                                    │ Archived  │           │ PDF file    │
                                    │           │           │             │
                                    │ New:      │           │             │
                                    │ status =  │           │             │
                                    │ Active    │           │             │
                                    └───────────┘           └─────────────┘
```

### 4. Employee Submits Anonymous Feedback

```
┌─────────┐   POST /api/policies/anonymous-feedback   ┌─────────┐
│ Browser │ ──────────────────────────────────────────> │ Backend │
│         │   { message: "..." }                       │         │
└─────────┘                                             └────┬────┘
                                                             │
                                                             │ 1. Extract message
                                                             │ 2. Get IP address
                                                             │ 3. Get user agent
                                                             │ 4. NO user ID
                                                             │
                                                        ┌────▼────┐
                                                        │ MongoDB │
                                                        │         │
                                                        │ Save    │
                                                        │ feedback│
                                                        │ (no ID) │
                                                        └─────────┘
```

---

## Component Hierarchy

```
App.jsx
│
├─ MainLayout
│  │
│  ├─ Sidebar
│  │  └─ "Policies & CIF" (Admin only)
│  │
│  └─ Routes
│     │
│     ├─ /profile
│     │  └─ ProfilePage
│     │     ├─ Left Column (Profile Info)
│     │     └─ Right Column
│     │        ├─ PolicyList
│     │        │  └─ PolicyViewer (conditional)
│     │        └─ AnonymousFeedbackBox
│     │
│     └─ /admin/policies
│        └─ AdminPoliciesPage
│           ├─ PolicyUploadForm
│           ├─ Policies Table
│           │  ├─ View Action → Dialog with PolicyViewer
│           │  ├─ Replace Action → Dialog with PolicyUploadForm
│           │  └─ Delete Action → Confirmation
│           └─ Snackbar (notifications)
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Security Layers                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Authentication                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ • JWT token validation                                │ │
│  │ • requireAuth middleware                              │ │
│  │ • All routes protected (except anonymous feedback)    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Layer 2: Authorization                                     │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ • Role-based access control                           │ │
│  │ • Admin-only routes: upload, replace, delete          │ │
│  │ • Employee routes: view policies                      │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Layer 3: Input Validation                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ • PDF file type validation                            │ │
│  │ • File size limit (10MB)                              │ │
│  │ • Required field validation                           │ │
│  │ • Sanitize user inputs                                │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Layer 4: Data Privacy                                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ • Anonymous feedback: no user ID                      │ │
│  │ • IP address for abuse prevention only                │ │
│  │ • Secure file storage                                 │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## File Upload Flow

```
1. User selects PDF file
   │
   ▼
2. Frontend validates file type
   │
   ▼
3. Create FormData with file + metadata
   │
   ▼
4. POST to /api/policies/upload
   │
   ▼
5. Backend: requireAuth middleware
   │
   ▼
6. Backend: Check admin role
   │
   ▼
7. Backend: Multer processes upload
   │
   ├─ Validate file type (PDF only)
   │
   ├─ Check file size (max 10MB)
   │
   └─ Save to /public/policies/
      │
      ▼
8. Generate version (if auto)
   │
   ▼
9. Create Policy document in MongoDB
   │
   ▼
10. Return success response
    │
    ▼
11. Frontend updates UI
```

---

## Version Control Logic

```
Scenario 1: First Upload
─────────────────────────
Input: version = "auto"
Output: version = "1.0"

Scenario 2: Subsequent Upload
──────────────────────────────
Existing: v2.1
Input: version = "auto"
Output: version = "2.2"

Scenario 3: Manual Version
──────────────────────────
Input: version = "3.0"
Output: version = "3.0"

Scenario 4: Replace Policy
──────────────────────────
Old Policy: v2.1 (Active)
Action: Replace
New Policy: v2.2 (Active)
Old Policy: v2.1 (Archived)
```

---

## Database Schema Relationships

```
┌─────────────────┐
│     User        │
│  ─────────────  │
│  _id            │◄──────────┐
│  fullName       │           │
│  role           │           │
│  ...            │           │
└─────────────────┘           │
                              │
                              │ uploadedBy
                              │
                    ┌─────────┴─────────┐
                    │     Policy        │
                    │  ───────────────  │
                    │  _id              │
                    │  name             │
                    │  version          │
                    │  effectiveFrom    │
                    │  department       │
                    │  status           │
                    │  fileUrl          │
                    │  fileName         │
                    │  uploadedBy       │───┐
                    │  replacedBy       │◄──┘ (self-reference)
                    │  createdAt        │
                    │  updatedAt        │
                    └───────────────────┘

┌─────────────────────────┐
│  AnonymousFeedback      │
│  ─────────────────────  │
│  _id                    │
│  message                │
│  submittedAt            │
│  ipAddress              │ (for abuse prevention)
│  userAgent              │ (for abuse prevention)
│  createdAt              │
│  updatedAt              │
└─────────────────────────┘
(No user reference - truly anonymous)
```

---

## API Response Formats

### Success Response
```json
{
  "message": "Policy uploaded successfully",
  "policy": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Employee Handbook",
    "version": "2.1",
    "effectiveFrom": "2026-01-15T00:00:00.000Z",
    "department": "HR",
    "status": "Active",
    "fileUrl": "/policies/policy-1234567890-123456789.pdf",
    "fileName": "handbook.pdf",
    "uploadedBy": "507f1f77bcf86cd799439012",
    "createdAt": "2026-02-10T10:30:00.000Z",
    "updatedAt": "2026-02-10T10:30:00.000Z"
  }
}
```

### Error Response
```json
{
  "error": "Only PDF files are allowed"
}
```

---

**Last Updated**: February 10, 2026
**Version**: 1.0
