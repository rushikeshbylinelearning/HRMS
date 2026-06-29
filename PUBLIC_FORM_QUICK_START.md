# 🚀 Public Profile Form - Quick Start Guide

## Overview
This system allows HR to send secure links to employees for profile data collection without requiring login credentials.

---

## ⚡ Quick Setup (5 Minutes)

### 1. Environment Variables
Add to your `.env` file:
```bash
# Required for token generation and encryption
JWT_SECRET=your-jwt-secret-key-here
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Optional - defaults to localhost in development
FRONTEND_URL=https://yourdomain.com
```

### 2. Create Database Indexes
```bash
cd backend
node scripts/create-public-form-indexes.js
```

### 3. Restart Server
```bash
# Backend
cd backend
npm start

# Frontend (if needed)
cd frontend
npm run dev
```

---

## 📝 How to Use

### For HR/Admin

#### Generate Link for Single Employee

1. **Via API:**
```bash
curl -X POST http://localhost:3011/api/admin/public-form/generate-link \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "BYL202508-E80",
    "expiryHours": 48,
    "allowMultipleSubmissions": false
  }'
```

2. **Via Frontend Component:**
```jsx
import PublicFormLinkGenerator from './components/PublicFormLinkGenerator';

// In your employee management page
<PublicFormLinkGenerator
  employeeId="BYL202508-E80"
  employeeName="John Doe"
  onClose={() => setShowModal(false)}
/>
```

#### Generate Links for Multiple Employees
```bash
curl -X POST http://localhost:3011/api/admin/public-form/bulk-generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeIds": ["BYL202508-E80", "BYL202508-E81"],
    "expiryHours": 48
  }'
```

#### Check Submission Status
```bash
curl http://localhost:3011/api/admin/public-form/status/BYL202508-E80 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### View Pending Submissions
```bash
curl http://localhost:3011/api/admin/public-form/pending \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### For Employees

1. **Receive Link:** HR sends you a link like:
   ```
   https://yourdomain.com/public-form?token=abc123...
   ```

2. **Open Link:** Click the link (no login required)

3. **Fill Form:** Complete the 4-step form:
   - Step 1: Personal Details
   - Step 2: Address
   - Step 3: Emergency Contact
   - Step 4: Identity & Bank Details

4. **Submit:** Click "Submit Profile"

5. **Done!** Your data is now in the system

---

## 🎯 Integration with Existing Pages

### Add to Employee Management Page

```jsx
// In your EmployeesPage.jsx or similar
import { useState } from 'react';
import PublicFormLinkGenerator from '../components/PublicFormLinkGenerator';

function EmployeesPage() {
  const [showLinkGenerator, setShowLinkGenerator] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const handleGenerateLink = (employee) => {
    setSelectedEmployee(employee);
    setShowLinkGenerator(true);
  };

  return (
    <div>
      {/* Your employee table */}
      <Table>
        {employees.map(emp => (
          <TableRow key={emp._id}>
            <TableCell>{emp.fullName}</TableCell>
            <TableCell>
              <Button onClick={() => handleGenerateLink(emp)}>
                Generate Profile Link
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </Table>

      {/* Link Generator Modal */}
      {showLinkGenerator && (
        <PublicFormLinkGenerator
          employeeId={selectedEmployee.employeeCode}
          employeeName={selectedEmployee.fullName}
          onClose={() => setShowLinkGenerator(false)}
        />
      )}
    </div>
  );
}
```

### Display Profile Data

The submitted data is stored in the User model under:
- `personalDetails` object
- `identityDetails` object

Access it in your profile page:
```jsx
// In ProfilePage.jsx
const { user } = useAuth();

<div>
  <h3>Personal Information</h3>
  <p>Phone: {user.personalDetails?.phone}</p>
  <p>Email: {user.personalDetails?.personalEmail}</p>
  <p>Blood Group: {user.personalDetails?.bloodGroup}</p>
  
  <h3>Address</h3>
  <p>{user.personalDetails?.address?.current?.line1}</p>
  <p>{user.personalDetails?.address?.current?.city}, {user.personalDetails?.address?.current?.state}</p>
  
  <h3>Emergency Contact</h3>
  <p>Name: {user.personalDetails?.emergencyContact?.name}</p>
  <p>Phone: {user.personalDetails?.emergencyContact?.phone}</p>
  
  <h3>Bank Details</h3>
  <p>Bank: {user.identityDetails?.bankName}</p>
  <p>IFSC: {user.identityDetails?.ifscCode}</p>
</div>
```

---

## 🔒 Security Best Practices

### Token Expiry
- **24 hours**: For urgent submissions
- **48 hours**: Recommended default
- **72 hours**: For weekend submissions
- **7 days**: For bulk onboarding

### Multiple Submissions
- **Disabled (default)**: One-time submission only
- **Enabled**: Allow employees to update their profile

### Rate Limiting
Public endpoints are rate-limited to 5 requests per 15 minutes per IP.

---

## 🧪 Testing

### Test Token Generation
```bash
# Generate a test token
curl -X POST http://localhost:3011/api/admin/public-form/generate-link \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "TEST001", "expiryHours": 1}'
```

### Test Form Access
1. Copy the generated URL
2. Open in incognito/private browser window
3. Verify form loads with employee details
4. Fill and submit the form
5. Check employee profile for updated data

### Test Validation
Try submitting with:
- Invalid phone number (should fail)
- Invalid Aadhaar (should fail)
- Invalid PAN (should fail)
- Invalid IFSC (should fail)

---

## 📊 Monitoring

### Check Token Status
```javascript
// In MongoDB
db.employeepublictokens.find({
  expiresAt: { $gt: new Date() },
  isUsed: false
}).count()
// Returns count of active, unused tokens
```

### View Recent Submissions
```javascript
db.profilesubmissionaudits.find({
  action: 'PROFILE_SUBMITTED'
}).sort({ createdAt: -1 }).limit(10)
```

### Check Expired Tokens
```javascript
db.employeepublictokens.find({
  expiresAt: { $lt: new Date() }
}).count()
// These will be auto-deleted by MongoDB TTL index
```

---

## 🐛 Common Issues

### Issue: "Invalid token" error
**Solution:** 
- Check if token has expired
- Verify JWT_SECRET is set correctly
- Ensure employee exists and is active

### Issue: Form doesn't load
**Solution:**
- Check browser console for errors
- Verify backend is running
- Check CORS settings

### Issue: Data not appearing in profile
**Solution:**
- Refresh the profile page
- Check MongoDB for the update
- Verify profile page reads from `personalDetails` and `identityDetails`

### Issue: Encryption errors
**Solution:**
- Verify ENCRYPTION_KEY is set
- Ensure key is at least 32 characters
- Don't change the key after data is encrypted

---

## 📞 Support

For detailed documentation, see: `backend/docs/PUBLIC_FORM_SYSTEM.md`

For API reference, see the API Endpoints section in the full documentation.

---

## ✅ Checklist

Before going to production:

- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Set strong ENCRYPTION_KEY (32+ characters)
- [ ] Create database indexes
- [ ] Enable HTTPS
- [ ] Test token generation
- [ ] Test form submission
- [ ] Test data reflection in profile
- [ ] Test rate limiting
- [ ] Test token expiry
- [ ] Configure email notifications (optional)
- [ ] Set up monitoring/logging
- [ ] Train HR staff on usage

---

**Ready to use!** 🎉

Generate your first link and test the system.
