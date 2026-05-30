# Smart External Employee Data Collection System

## 📋 Overview

A secure, token-based system that allows HR to send external links to employees/interns for profile data collection without requiring login credentials. Data automatically syncs to the employee profile and admin panel.

---

## 🎯 Features

### Core Functionality
- ✅ **Token-Based Security**: JWT + SHA256 hashed tokens with expiry
- ✅ **No Login Required**: Employees access via secure link only
- ✅ **Auto-Mapping**: Data maps to correct employee using Employee ID
- ✅ **Instant Reflection**: Updates appear immediately in profile & admin panel
- ✅ **Multi-Step Form**: Clean, mobile-first UI with progress tracking
- ✅ **Auto-Save**: Form data saved to localStorage (resume capability)
- ✅ **Data Encryption**: Sensitive data (Aadhaar, PAN, Bank) encrypted at rest
- ✅ **Audit Trail**: Complete submission history and tracking
- ✅ **Validation**: Real-time field validation with Indian standards

### Security Features
- 🔐 Token expiry enforcement (configurable: 24h, 48h, 72h, 7 days)
- 🔐 One-time or multiple submission modes
- 🔐 HTTPS mandatory for production
- 🔐 Rate limiting on public endpoints
- 🔐 IP address and user agent tracking
- 🔐 Sensitive data encryption (AES-256-CBC)
- 🔐 Token reuse prevention
- 🔐 Automatic token cleanup (MongoDB TTL index)

---

## 🗄️ Database Schema

### 1. EmployeePublicToken Collection
```javascript
{
  _id: ObjectId,
  employeeId: String,           // Employee code (e.g., BYL202508-E80)
  token: String,                 // SHA256 hashed token (unique, indexed)
  expiresAt: Date,               // Token expiry timestamp
  isUsed: Boolean,               // Whether token has been used
  usedAt: Date,                  // Timestamp of submission
  generatedBy: ObjectId,         // Admin who generated the token
  allowMultipleSubmissions: Boolean, // Allow profile updates
  submissionCount: Number,       // Number of times submitted
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `token` (unique)
- `employeeId`
- `expiresAt` (TTL index for auto-cleanup)
- Compound: `token + isUsed + expiresAt`

### 2. ProfileSubmissionAudit Collection
```javascript
{
  _id: ObjectId,
  employeeId: String,
  userId: ObjectId,
  action: String,                // PROFILE_SUBMITTED, PROFILE_UPDATED, TOKEN_GENERATED, etc.
  source: String,                // PUBLIC_FORM, ADMIN_PANEL, SYSTEM
  token: String,
  ipAddress: String,
  userAgent: String,
  dataSubmitted: Object,         // Metadata about submitted data
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `employeeId + createdAt`
- `action + createdAt`
- `token`

### 3. User Collection (Extended)
```javascript
{
  // ... existing fields ...
  personalDetails: {
    dateOfBirth: Date,
    gender: String,
    bloodGroup: String,
    maritalStatus: String,
    phone: String,
    alternatePhone: String,
    personalEmail: String,
    address: {
      current: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
        country: String
      },
      permanent: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
        country: String,
        sameAsCurrent: Boolean
      }
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
      email: String
    }
  },
  identityDetails: {
    aadhaar: String,              // Encrypted
    pan: String,                  // Encrypted
    bankName: String,
    bankAccountNumber: String,    // Encrypted
    ifscCode: String,
    bankBranch: String,
    uanNumber: String,
    pfAccountNumber: String
  }
}
```

---

## 🔌 API Endpoints

### Public Endpoints (No Auth Required)

#### 1. Validate Token
```http
GET /api/public/validate?token={token}
```

**Response:**
```json
{
  "success": true,
  "employee": {
    "_id": "...",
    "employeeCode": "BYL202508-E80",
    "fullName": "John Doe",
    "email": "john@example.com",
    "department": "Engineering",
    "designation": "Software Engineer",
    "personalDetails": { ... },
    "identityDetails": { ... }
  },
  "tokenInfo": {
    "expiresAt": "2024-04-22T10:00:00Z",
    "allowMultipleSubmissions": false,
    "submissionCount": 0
  }
}
```

**Error Responses:**
- `400`: Invalid token, expired token, or already used
- `500`: Server error

#### 2. Submit Profile
```http
POST /api/public/submit
Content-Type: application/json

{
  "token": "abc123...",
  "personalDetails": {
    "dateOfBirth": "1990-01-01",
    "gender": "Male",
    "phone": "9876543210",
    ...
  },
  "identityDetails": {
    "aadhaar": "123456789012",
    "pan": "ABCDE1234F",
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile submitted successfully",
  "employee": {
    "employeeCode": "BYL202508-E80",
    "fullName": "John Doe",
    "email": "john@example.com"
  }
}
```

**Rate Limiting:** 5 requests per 15 minutes per IP

---

### Admin Endpoints (Auth Required)

#### 3. Generate Token
```http
POST /api/admin/public-form/generate-link
Authorization: Bearer {token}
Content-Type: application/json

{
  "employeeId": "BYL202508-E80",
  "expiryHours": 48,
  "allowMultipleSubmissions": false,
  "forceNew": false
}
```

**Response:**
```json
{
  "success": true,
  "token": "abc123...",
  "url": "https://yourdomain.com/public-form?token=abc123...",
  "expiresAt": "2024-04-22T10:00:00Z",
  "employee": {
    "employeeCode": "BYL202508-E80",
    "fullName": "John Doe",
    "email": "john@example.com",
    "department": "Engineering",
    "designation": "Software Engineer"
  },
  "isExisting": false
}
```

#### 4. Bulk Generate Tokens
```http
POST /api/admin/public-form/bulk-generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "employeeIds": ["BYL202508-E80", "BYL202508-E81"],
  "expiryHours": 48,
  "allowMultipleSubmissions": false
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "employeeId": "BYL202508-E80",
      "success": true,
      "token": "abc123...",
      "url": "https://yourdomain.com/public-form?token=abc123...",
      ...
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

#### 5. Get Token Status
```http
GET /api/admin/public-form/status/{employeeId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "tokens": [
    {
      "token": "abc123...",
      "createdAt": "2024-04-20T10:00:00Z",
      "expiresAt": "2024-04-22T10:00:00Z",
      "isUsed": true,
      "usedAt": "2024-04-21T15:30:00Z",
      "submissionCount": 1,
      "status": "used"
    }
  ],
  "audits": [
    {
      "action": "PROFILE_SUBMITTED",
      "source": "PUBLIC_FORM",
      "timestamp": "2024-04-21T15:30:00Z",
      "metadata": { ... }
    }
  ]
}
```

#### 6. Get Pending Submissions
```http
GET /api/admin/public-form/pending
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "pending": [
    {
      "employeeId": "BYL202508-E80",
      "employee": {
        "employeeCode": "BYL202508-E80",
        "fullName": "John Doe",
        "email": "john@example.com",
        "department": "Engineering"
      },
      "tokenCreated": "2024-04-20T10:00:00Z",
      "expiresAt": "2024-04-22T10:00:00Z",
      "status": "pending"
    }
  ],
  "count": 1
}
```

---

## 🎨 Frontend Components

### 1. PublicProfileForm Component
**Location:** `frontend/src/pages/PublicProfileForm.jsx`

**Features:**
- 4-step wizard interface
- Real-time validation
- Auto-save to localStorage
- Progress indicator
- Mobile-responsive design
- Error handling with user-friendly messages

**Steps:**
1. Personal Details (DOB, gender, blood group, phone, email)
2. Address (current & permanent)
3. Emergency Contact
4. Identity & Bank Details (Aadhaar, PAN, bank info, PF details)

### 2. PublicFormLinkGenerator Component
**Location:** `frontend/src/components/PublicFormLinkGenerator.jsx`

**Features:**
- Modal-based UI
- Token generation with configurable expiry
- Copy to clipboard functionality
- Email integration (mailto link)
- Success/error states
- Link preview

**Usage in Admin Panel:**
```jsx
import PublicFormLinkGenerator from '../components/PublicFormLinkGenerator';

// In your component
const [showGenerator, setShowGenerator] = useState(false);

<button onClick={() => setShowGenerator(true)}>
  Generate Profile Link
</button>

{showGenerator && (
  <PublicFormLinkGenerator
    employeeId={employee.employeeCode}
    employeeName={employee.fullName}
    onClose={() => setShowGenerator(false)}
  />
)}
```

---

## 🔒 Security Implementation

### Token Generation
```javascript
// 1. JWT payload
const tokenPayload = {
  employeeId: employee.employeeCode,
  type: 'profile_form',
  timestamp: Date.now()
};

// 2. Sign with JWT
const jwtToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { 
  expiresIn: '48h' 
});

// 3. Create secure hash
const secureToken = crypto
  .createHash('sha256')
  .update(jwtToken + employee.employeeCode + Date.now())
  .digest('hex');
```

### Data Encryption
```javascript
// AES-256-CBC encryption for sensitive fields
const algorithm = 'aes-256-cbc';
const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
const iv = crypto.randomBytes(16);

const cipher = crypto.createCipheriv(algorithm, key, iv);
let encrypted = cipher.update(data, 'utf8', 'hex');
encrypted += cipher.final('hex');

// Store as: iv:encrypted
return `${iv.toString('hex')}:${encrypted}`;
```

### Validation Patterns
```javascript
const PATTERNS = {
  aadhaar: /^\d{12}$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  phone: /^[6-9]\d{9}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  pincode: /^\d{6}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};
```

---

## 🚀 Deployment Checklist

### Environment Variables
```bash
# Required
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-encryption-key-32-chars-min

# Optional
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production
```

### Database Indexes
Run this script to create required indexes:
```bash
node scripts/create-public-form-indexes.js
```

Or manually in MongoDB:
```javascript
db.employeepublictokens.createIndex({ token: 1 }, { unique: true });
db.employeepublictokens.createIndex({ employeeId: 1 });
db.employeepublictokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.employeepublictokens.createIndex({ token: 1, isUsed: 1, expiresAt: 1 });

db.profilesubmissionaudits.createIndex({ employeeId: 1, createdAt: -1 });
db.profilesubmissionaudits.createIndex({ action: 1, createdAt: -1 });
db.profilesubmissionaudits.createIndex({ token: 1 });
```

### HTTPS Configuration
Ensure your production server uses HTTPS. The system will work on HTTP in development but requires HTTPS in production for security.

---

## 📊 Admin Dashboard Integration

### Add to Employees Page
```jsx
import PublicFormLinkGenerator from '../components/PublicFormLinkGenerator';

// In your employee actions menu
<MenuItem onClick={() => setShowLinkGenerator(true)}>
  <LinkIcon /> Generate Profile Link
</MenuItem>

{showLinkGenerator && (
  <PublicFormLinkGenerator
    employeeId={selectedEmployee.employeeCode}
    employeeName={selectedEmployee.fullName}
    onClose={() => setShowLinkGenerator(false)}
  />
)}
```

### Bulk Operations
```jsx
// Select multiple employees
const selectedEmployees = [...];

// Generate links for all
const response = await axios.post('/api/admin/public-form/bulk-generate', {
  employeeIds: selectedEmployees.map(e => e.employeeCode),
  expiryHours: 48
});

// Display results
console.log(response.data.summary);
```

---

## 🧪 Testing

### Manual Testing Checklist

#### Token Generation
- [ ] Generate token for valid employee
- [ ] Generate token for invalid employee (should fail)
- [ ] Generate token with custom expiry
- [ ] Generate token with multiple submissions enabled
- [ ] Verify existing token is returned if valid

#### Form Validation
- [ ] Access form with valid token
- [ ] Access form with expired token (should show error)
- [ ] Access form with used token (should show error)
- [ ] Access form with invalid token (should show error)

#### Form Submission
- [ ] Submit form with all required fields
- [ ] Submit form with invalid phone number (should fail)
- [ ] Submit form with invalid Aadhaar (should fail)
- [ ] Submit form with invalid PAN (should fail)
- [ ] Submit form with invalid IFSC (should fail)
- [ ] Verify auto-save functionality
- [ ] Verify data appears in employee profile
- [ ] Verify data appears in admin panel

#### Security
- [ ] Verify rate limiting (5 requests per 15 min)
- [ ] Verify token expiry enforcement
- [ ] Verify one-time submission enforcement
- [ ] Verify sensitive data encryption
- [ ] Verify audit log creation

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Token Validation Fails
**Symptom:** "Invalid token" error even with valid token

**Solutions:**
- Check JWT_SECRET matches between token generation and validation
- Verify token hasn't expired
- Check MongoDB connection
- Verify employee exists and is active

#### 2. Form Submission Fails
**Symptom:** "Failed to submit profile" error

**Solutions:**
- Check validation errors in response
- Verify all required fields are filled
- Check network connectivity
- Verify backend is running
- Check MongoDB connection

#### 3. Data Not Appearing in Profile
**Symptom:** Form submits successfully but data doesn't show

**Solutions:**
- Check if employee profile page reads from `personalDetails` and `identityDetails`
- Verify MongoDB update was successful
- Check for JavaScript errors in browser console
- Refresh the page

#### 4. Encryption Errors
**Symptom:** "Decryption error" in logs

**Solutions:**
- Verify ENCRYPTION_KEY is set and consistent
- Check if encrypted data format is correct (iv:encrypted)
- Verify encryption key hasn't changed

---

## 📈 Performance Optimization

### Database Indexes
All required indexes are created automatically. Monitor query performance:
```javascript
db.employeepublictokens.find({ token: "..." }).explain("executionStats");
```

### Caching
Consider caching employee data for token validation:
```javascript
const NodeCache = require('node-cache');
const employeeCache = new NodeCache({ stdTTL: 300 }); // 5 minutes
```

### Rate Limiting
Adjust rate limits based on your needs:
```javascript
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 requests per window
  message: 'Too many attempts'
};
```

---

## 🔄 Future Enhancements

### Planned Features
- [ ] File upload support (PAN card, Aadhaar, cheque)
- [ ] Multi-language support
- [ ] OTP verification for extra security
- [ ] Email notifications on submission
- [ ] SMS notifications
- [ ] Bulk import from Excel
- [ ] Custom form fields per department
- [ ] Form analytics dashboard
- [ ] PDF export of submitted data

### Integration Opportunities
- [ ] Integration with payroll systems
- [ ] Integration with HRMS
- [ ] Integration with document management systems
- [ ] Integration with background verification services

---

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review the troubleshooting section
3. Check application logs
4. Contact the development team

---

## 📝 License

Internal use only. All rights reserved.

---

**Last Updated:** April 20, 2026
**Version:** 1.0.0
