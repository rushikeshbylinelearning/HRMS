# Policies Feature - Quick Reference Card

## 🚀 Quick Start

### Employee Access
```
URL: /profile
Location: Right sidebar
Actions: View policies, Submit feedback
```

### Admin Access
```
URL: /admin/policies
Menu: Sidebar → "Policies & CIF"
Actions: Upload, Replace, Delete policies
```

---

## 📡 API Endpoints

### GET /api/policies
**Auth**: Required  
**Role**: All  
**Returns**: List of all policies

### POST /api/policies/upload
**Auth**: Required  
**Role**: Admin only  
**Body**: FormData (file, name, version, effectiveFrom, department, status)  
**Returns**: Created policy

### POST /api/policies/:id/replace
**Auth**: Required  
**Role**: Admin only  
**Body**: FormData (file, name, version, effectiveFrom, department, status)  
**Returns**: New policy (old archived)

### DELETE /api/policies/:id
**Auth**: Required  
**Role**: Admin only  
**Returns**: Success message

### POST /api/policies/anonymous-feedback
**Auth**: Not required  
**Body**: { message: string }  
**Returns**: Success message

---

## 🗂️ File Locations

### Frontend Components
```
frontend/src/components/
├── PolicyList.jsx
├── PolicyViewer.jsx
├── AnonymousFeedbackBox.jsx
└── PolicyUploadForm.jsx
```

### Frontend Pages
```
frontend/src/pages/
├── ProfilePage.jsx (updated)
└── AdminPoliciesPage.jsx (new)
```

### Backend
```
backend/
├── models/
│   ├── Policy.js
│   └── AnonymousFeedback.js
├── routes/
│   └── policies.js
└── public/
    └── policies/ (PDF storage)
```

---

## 🔧 Configuration

### Backend Dependencies
```json
{
  "multer": "^1.4.5-lts.1"
}
```

### Routes Registration
```javascript
// backend/server.js
const policiesRoutes = require('./routes/policies');
app.use('/api/policies', policiesRoutes);
```

### Sidebar Menu
```javascript
// frontend/src/components/Sidebar.jsx
{ 
  text: 'Policies & CIF', 
  icon: <PolicyIcon />, 
  path: '/admin/policies', 
  roles: ['Admin'] 
}
```

---

## 🐛 Troubleshooting

### Issue: Upload fails with 500 error
**Fix**: Ensure `req.user.userId || req.user._id` is used

### Issue: PDF not displaying
**Check**: File URL, browser console, CORS settings

### Issue: Anonymous feedback not submitting
**Check**: Message not empty, backend running, network

---

## 🔐 Security Checklist

- [x] Admin-only routes protected
- [x] PDF validation (file type)
- [x] File size limit (10MB)
- [x] Anonymous feedback (no user ID)
- [x] Authentication required
- [x] Role-based access control

---

## 📊 Database Schema

### Policy
```javascript
{
  name: String,
  version: String,
  effectiveFrom: Date,
  department: String,
  status: 'Active' | 'Archived',
  fileUrl: String,
  fileName: String,
  uploadedBy: ObjectId,
  replacedBy: ObjectId,
  timestamps: true
}
```

### AnonymousFeedback
```javascript
{
  message: String,
  submittedAt: Date,
  ipAddress: String,
  userAgent: String,
  timestamps: true
}
```

---

## 🧪 Testing Commands

```bash
# Test backend configuration
cd backend
node test-policies-routes.js

# Test user ID fix
node test-policy-upload-fix.js

# Start backend
npm start

# Start frontend
cd frontend
npm run dev
```

---

## 📝 Common Tasks

### Upload a Policy (Admin)
1. Go to `/admin/policies`
2. Click "Select PDF File"
3. Fill in name, version, date
4. Click "Upload Policy"

### Replace a Policy (Admin)
1. Go to `/admin/policies`
2. Find policy in table
3. Click replace icon (🔄)
4. Upload new PDF
5. Submit

### View a Policy (Employee)
1. Go to `/profile`
2. Look at right sidebar
3. Click policy name
4. PDF opens in viewer

### Submit Feedback (Employee)
1. Go to `/profile`
2. Scroll to "Anonymous Message"
3. Type feedback
4. Click "Submit Anonymously"

---

## 🎯 Key Features

### Version Control
- Auto-generate: v1.0 → v1.1 → v1.2
- Manual: Specify any version
- Replace: Old archived, new active

### File Validation
- Type: PDF only
- Size: Max 10MB
- Storage: `/public/policies/`

### Access Control
- Employees: Read-only
- Admins: Full CRUD
- Anonymous: Feedback only

---

## 📞 Quick Links

- [Full Documentation](./POLICIES_FEATURE_README.md)
- [User Guide](./POLICIES_FEATURE_GUIDE.md)
- [Architecture](./POLICIES_ARCHITECTURE.md)
- [Deployment Checklist](./POLICIES_DEPLOYMENT_CHECKLIST.md)
- [Fix Documentation](./POLICY_UPLOAD_FIX.md)
- [Final Status](./POLICIES_FINAL_STATUS.md)

---

**Version**: 1.0  
**Last Updated**: February 10, 2026  
**Status**: Production Ready ✅
