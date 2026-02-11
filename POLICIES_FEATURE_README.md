# Policies & Anonymous Feedback Feature

## Overview
This feature allows employees to view company policies and submit anonymous feedback, while admins can manage policies with versioning support.

## Employee Features

### Profile Page - Policies Section
- **Location**: Right side of the Profile page (`/profile`)
- **Features**:
  - View list of company policies
  - Click to view PDF in embedded viewer (same page)
  - See policy name, version, and effective date
  - Read-only access (no download, edit, or delete)

### Anonymous Feedback
- **Location**: Below policies list on Profile page
- **Features**:
  - Submit anonymous messages
  - No user identification attached
  - Simple textarea with submit button

## Admin Features

### Policies Management Page
- **Location**: `/admin/policies`
- **Sidebar**: "Policies & CIF" menu item (Admin only)

### Upload Policy
- **File Type**: PDF only (hard validation)
- **Required Fields**:
  - Policy Name
  - Version (manual or auto-generated)
  - Effective From Date
- **Optional Fields**:
  - Department
  - Status (Active/Archived)

### Manage Policies
- **View**: Table with all policies
- **Columns**: Name, Version, Effective From, Department, Status, Actions
- **Actions**:
  - View: Preview PDF in dialog
  - Replace: Upload new version (auto-archives old version)
  - Delete: Remove policy permanently

### Replace Policy Logic
- Upload new PDF for existing policy
- New version is created automatically
- Old version is marked as "Archived"
- New version becomes "Active"

## Backend API Endpoints

### Public/Employee Endpoints
- `GET /api/policies` - Get all policies
- `GET /api/policies/active` - Get active policies only
- `POST /api/policies/anonymous-feedback` - Submit anonymous feedback

### Admin Endpoints
- `POST /api/policies/upload` - Upload new policy
- `POST /api/policies/:id/replace` - Replace existing policy
- `DELETE /api/policies/:id` - Delete policy
- `GET /api/policies/anonymous-feedback` - View all feedback (Admin only)

## Database Models

### Policy Model
```javascript
{
  name: String,
  version: String,
  effectiveFrom: Date,
  department: String,
  status: 'Active' | 'Archived',
  fileUrl: String,
  fileName: String,
  uploadedBy: ObjectId (User),
  replacedBy: ObjectId (Policy),
  timestamps: true
}
```

### AnonymousFeedback Model
```javascript
{
  message: String,
  submittedAt: Date,
  ipAddress: String,
  userAgent: String,
  timestamps: true
}
```

## File Storage
- **Location**: `backend/public/policies/`
- **Format**: `policy-{timestamp}-{random}.pdf`
- **Access**: Served as static files via Express

## Security
- Admin-only access for upload/replace/delete
- PDF file type validation
- 10MB file size limit
- Anonymous feedback has no user identification

## UI Components

### Frontend Components
1. `PolicyList.jsx` - Display policies in list format
2. `PolicyViewer.jsx` - Embedded PDF viewer
3. `AnonymousFeedbackBox.jsx` - Feedback submission form
4. `PolicyUploadForm.jsx` - Admin upload form

### Pages
1. `ProfilePage.jsx` - Employee view (updated)
2. `AdminPoliciesPage.jsx` - Admin management page

## Installation

### Backend
```bash
cd backend
npm install multer
```

### Frontend
No additional packages needed (uses existing MUI components)

## Usage

### For Employees
1. Navigate to Profile page
2. View policies in the right sidebar
3. Click any policy to view PDF
4. Submit anonymous feedback below policies list

### For Admins
1. Navigate to "Policies & CIF" in sidebar
2. Upload new policies using the form
3. Manage existing policies in the table
4. Replace policies to create new versions
5. View anonymous feedback (future enhancement)

## Future Enhancements
- Admin page to view anonymous feedback
- Policy categories/tags
- Search and filter policies
- Download policy as PDF
- Email notifications on new policy uploads
- Policy acknowledgment tracking
