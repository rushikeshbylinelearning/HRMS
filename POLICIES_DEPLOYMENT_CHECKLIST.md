# Policies Feature - Deployment Checklist

## ✅ Pre-Deployment Verification

### Backend Files
- [x] `backend/models/Policy.js` - Created
- [x] `backend/models/AnonymousFeedback.js` - Created
- [x] `backend/routes/policies.js` - Created
- [x] `backend/server.js` - Updated (routes registered)
- [x] `backend/package.json` - Updated (multer added)
- [x] `backend/public/policies/` - Directory created
- [x] Multer package installed

### Frontend Files
- [x] `frontend/src/components/PolicyList.jsx` - Created
- [x] `frontend/src/components/PolicyViewer.jsx` - Created
- [x] `frontend/src/components/AnonymousFeedbackBox.jsx` - Created
- [x] `frontend/src/components/PolicyUploadForm.jsx` - Created
- [x] `frontend/src/pages/AdminPoliciesPage.jsx` - Created
- [x] `frontend/src/pages/ProfilePage.jsx` - Updated
- [x] `frontend/src/App.jsx` - Updated (route added)
- [x] `frontend/src/components/Sidebar.jsx` - Updated (menu item added)
- [x] `frontend/src/styles/ProfilePage.css` - Updated

### Code Quality
- [x] No TypeScript/ESLint errors
- [x] All components compile successfully
- [x] Backend models load correctly
- [x] Routes registered properly

---

## 🚀 Deployment Steps

### Step 1: Backend Deployment

```bash
# Navigate to backend directory
cd backend

# Install dependencies (if not already done)
npm install

# Verify multer is installed
npm list multer

# Create policies directory (if not exists)
mkdir -p public/policies

# Test backend configuration
node test-policies-routes.js

# Start backend server
npm start
```

**Expected Output:**
```
✓ Policy model loaded successfully
✓ AnonymousFeedback model loaded successfully
✓ Policies routes loaded successfully
✓ Policies directory exists
✓ Multer package is installed
```

### Step 2: Frontend Deployment

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if needed)
npm install

# Build for production
npm run build

# Or start development server
npm run dev
```

### Step 3: Database Setup

**MongoDB Collections:**
- `policies` - Will be created automatically on first policy upload
- `anonymousfeedbacks` - Will be created automatically on first feedback submission

**No manual database setup required** - Mongoose will create collections automatically.

### Step 4: File Permissions

Ensure the backend has write permissions to:
```bash
backend/public/policies/
```

**Linux/Mac:**
```bash
chmod 755 backend/public/policies
```

**Windows:**
- Right-click folder → Properties → Security
- Ensure "Write" permission is enabled

---

## 🧪 Testing Checklist

### Employee Side Testing

1. **Access Profile Page**
   - [ ] Navigate to `/profile`
   - [ ] Verify policies section appears on right side
   - [ ] Check responsive layout on mobile

2. **View Policies**
   - [ ] Click on a policy
   - [ ] Verify PDF opens in embedded viewer
   - [ ] Check close button works
   - [ ] Verify no download/edit/delete options

3. **Anonymous Feedback**
   - [ ] Type message in textarea
   - [ ] Click "Submit Anonymously"
   - [ ] Verify success message appears
   - [ ] Check form clears after submission

### Admin Side Testing

1. **Access Admin Panel**
   - [ ] Verify "Policies & CIF" appears in sidebar (Admin only)
   - [ ] Navigate to `/admin/policies`
   - [ ] Check page loads correctly

2. **Upload Policy**
   - [ ] Select PDF file
   - [ ] Fill all required fields
   - [ ] Test auto-version generation
   - [ ] Verify upload success
   - [ ] Check policy appears in table

3. **View Policy**
   - [ ] Click view icon
   - [ ] Verify PDF opens in dialog
   - [ ] Check close button works

4. **Replace Policy**
   - [ ] Click replace icon
   - [ ] Upload new PDF
   - [ ] Verify new version created
   - [ ] Check old version archived

5. **Delete Policy**
   - [ ] Click delete icon
   - [ ] Confirm deletion
   - [ ] Verify policy removed from table
   - [ ] Check file deleted from filesystem

### API Testing

Test endpoints using Postman or curl:

```bash
# Get all policies (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/policies

# Submit anonymous feedback
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"Test feedback"}' \
  http://localhost:5000/api/policies/anonymous-feedback

# Upload policy (Admin only)
curl -X POST \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -F "file=@policy.pdf" \
  -F "name=Test Policy" \
  -F "version=1.0" \
  -F "effectiveFrom=2026-02-10" \
  http://localhost:5000/api/policies/upload
```

---

## 🔍 Verification Points

### Backend Verification
- [ ] Server starts without errors
- [ ] Policies routes registered at `/api/policies`
- [ ] Multer middleware configured correctly
- [ ] File uploads work
- [ ] Database models created

### Frontend Verification
- [ ] No console errors
- [ ] Components render correctly
- [ ] Routing works
- [ ] API calls successful
- [ ] UI matches design requirements

### Security Verification
- [ ] Admin-only routes protected
- [ ] PDF validation working
- [ ] File size limit enforced
- [ ] Anonymous feedback has no user ID
- [ ] Authentication required for all endpoints

---

## 🐛 Common Issues & Solutions

### Issue: "Multer is not installed"
**Solution:**
```bash
cd backend
npm install multer
```

### Issue: "Policies directory does not exist"
**Solution:**
```bash
mkdir -p backend/public/policies
```

### Issue: "Cannot upload PDF"
**Solution:**
- Check file size (max 10MB)
- Verify file is valid PDF
- Check backend logs for errors
- Ensure write permissions on policies directory

### Issue: "Route not found"
**Solution:**
- Verify routes registered in `server.js`
- Check route path matches frontend API calls
- Restart backend server

### Issue: "PDF not displaying"
**Solution:**
- Check browser console for errors
- Verify PDF file URL is correct
- Test PDF file opens directly in browser
- Check CORS settings if needed

---

## 📊 Monitoring

### Logs to Monitor
- Backend server logs for upload errors
- Database connection status
- File system write errors
- API endpoint response times

### Metrics to Track
- Number of policies uploaded
- Anonymous feedback submissions
- Policy view counts (future enhancement)
- File storage usage

---

## 🔄 Rollback Plan

If issues occur after deployment:

1. **Backend Rollback**
   ```bash
   # Remove policies route from server.js
   # Comment out: app.use('/api/policies', policiesRoutes);
   
   # Restart server
   npm start
   ```

2. **Frontend Rollback**
   ```bash
   # Remove route from App.jsx
   # Remove sidebar menu item from Sidebar.jsx
   # Revert ProfilePage.jsx changes
   
   # Rebuild
   npm run build
   ```

3. **Database Cleanup** (if needed)
   ```javascript
   // In MongoDB shell
   db.policies.drop()
   db.anonymousfeedbacks.drop()
   ```

---

## ✅ Post-Deployment Tasks

- [ ] Notify admins about new feature
- [ ] Create initial policies (Employee Handbook, etc.)
- [ ] Train admins on policy management
- [ ] Monitor for first 24 hours
- [ ] Collect user feedback
- [ ] Document any issues

---

## 📝 Documentation Links

- [Feature README](./POLICIES_FEATURE_README.md)
- [Implementation Summary](./POLICIES_IMPLEMENTATION_SUMMARY.md)
- [User Guide](./POLICIES_FEATURE_GUIDE.md)

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Verified By**: _____________
**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Completed | ⬜ Rolled Back
