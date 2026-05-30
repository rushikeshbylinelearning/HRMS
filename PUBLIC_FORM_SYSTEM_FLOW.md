# 🔄 Public Form System - Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HR/ADMIN PANEL                              │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Employee Management Page                                      │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  [Generate Profile Link] Button                          │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TOKEN GENERATION SERVICE                         │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  1. Validate Employee ID                                      │ │
│  │  2. Generate JWT Token                                        │ │
│  │  3. Create SHA256 Hash                                        │ │
│  │  4. Store in Database                                         │ │
│  │  5. Return Secure URL                                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SECURE LINK                                 │
│  https://yourdomain.com/public-form?token=abc123...                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EMPLOYEE RECEIVES LINK                         │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Via Email / WhatsApp / SMS                                   │ │
│  │  No Login Required                                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      TOKEN VALIDATION                               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  1. Check Token Exists                                        │ │
│  │  2. Check Not Expired                                         │ │
│  │  3. Check Not Used (if one-time)                              │ │
│  │  4. Fetch Employee Data                                       │ │
│  │  5. Pre-fill Form                                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PUBLIC PROFILE FORM                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Step 1: Personal Details                                     │ │
│  │  ├─ Date of Birth                                             │ │
│  │  ├─ Gender, Blood Group                                       │ │
│  │  ├─ Phone, Email                                              │ │
│  │  └─ Marital Status                                            │ │
│  │                                                                │ │
│  │  Step 2: Address                                              │ │
│  │  ├─ Current Address                                           │ │
│  │  └─ Permanent Address                                         │ │
│  │                                                                │ │
│  │  Step 3: Emergency Contact                                    │ │
│  │  ├─ Name, Relationship                                        │ │
│  │  └─ Phone, Email                                              │ │
│  │                                                                │ │
│  │  Step 4: Identity & Bank                                      │ │
│  │  ├─ Aadhaar, PAN                                              │ │
│  │  ├─ Bank Details                                              │ │
│  │  └─ PF Details                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FORM VALIDATION                                │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ✓ Phone: 10 digits, starts with 6-9                         │ │
│  │  ✓ Aadhaar: 12 digits                                         │ │
│  │  ✓ PAN: ABCDE1234F format                                     │ │
│  │  ✓ IFSC: ABCD0123456 format                                   │ │
│  │  ✓ Email: Valid format                                        │ │
│  │  ✓ Pincode: 6 digits                                          │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA ENCRYPTION                                │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Encrypt Sensitive Fields:                                    │ │
│  │  ├─ Aadhaar Number                                            │ │
│  │  ├─ PAN Number                                                │ │
│  │  └─ Bank Account Number                                       │ │
│  │                                                                │ │
│  │  Algorithm: AES-256-CBC                                       │ │
│  │  Format: iv:encrypted                                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE UPDATE                                │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Update User Collection:                                      │ │
│  │  ├─ personalDetails: { ... }                                  │ │
│  │  └─ identityDetails: { ... }                                  │ │
│  │                                                                │ │
│  │  Mark Token as Used:                                          │ │
│  │  ├─ isUsed: true                                              │ │
│  │  ├─ usedAt: timestamp                                         │ │
│  │  └─ submissionCount++                                         │ │
│  │                                                                │ │
│  │  Create Audit Log:                                            │ │
│  │  ├─ action: PROFILE_SUBMITTED                                 │ │
│  │  ├─ source: PUBLIC_FORM                                       │ │
│  │  ├─ ipAddress: xxx.xxx.xxx.xxx                                │ │
│  │  └─ timestamp: now                                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUCCESS RESPONSE                               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ✓ Profile Submitted Successfully!                            │ │
│  │  ✓ Thank you, [Employee Name]                                 │ │
│  │  ✓ Your data will be reflected shortly                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      INSTANT REFLECTION                             │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Employee Profile Page                                        │ │
│  │  ├─ Shows updated personal details                            │ │
│  │  ├─ Shows updated address                                     │ │
│  │  ├─ Shows updated emergency contact                           │ │
│  │  └─ Shows updated identity details                            │ │
│  │                                                                │ │
│  │  Admin Employees Page                                         │ │
│  │  ├─ Shows "Profile Completed" badge                           │ │
│  │  ├─ Shows updated fields                                      │ │
│  │  └─ Shows submission timestamp                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│   HR     │─────▶│  Token   │─────▶│ Employee │─────▶│   Form   │
│  Admin   │      │Generator │      │ Receives │      │  Opens   │
└──────────┘      └──────────┘      └──────────┘      └──────────┘
                                                              │
                                                              ▼
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ Profile  │◀─────│ Database │◀─────│  Submit  │◀─────│   Fill   │
│ Updated  │      │  Update  │      │   Form   │      │   Form   │
└──────────┘      └──────────┘      └──────────┘      └──────────┘
```

---

## Security Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Token Generation                                     │
│  ├─ JWT Signing                                                │
│  ├─ SHA256 Hashing                                             │
│  └─ Database Storage                                           │
│                                                                 │
│  Layer 2: Token Validation                                     │
│  ├─ Existence Check                                            │
│  ├─ Expiry Check                                               │
│  ├─ Usage Check                                                │
│  └─ Employee Verification                                      │
│                                                                 │
│  Layer 3: Rate Limiting                                        │
│  ├─ 5 requests per 15 minutes                                  │
│  ├─ IP-based tracking                                          │
│  └─ Automatic blocking                                         │
│                                                                 │
│  Layer 4: Input Validation                                     │
│  ├─ Format validation                                          │
│  ├─ Length validation                                          │
│  ├─ Pattern matching                                           │
│  └─ Sanitization                                               │
│                                                                 │
│  Layer 5: Data Encryption                                      │
│  ├─ AES-256-CBC                                                │
│  ├─ Unique IV per field                                        │
│  ├─ Secure key derivation                                      │
│  └─ Encrypted storage                                          │
│                                                                 │
│  Layer 6: Audit Logging                                        │
│  ├─ Action tracking                                            │
│  ├─ IP address logging                                         │
│  ├─ User agent logging                                         │
│  └─ Timestamp recording                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE COLLECTIONS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  users (existing, extended)                                    │
│  ├─ employeeCode: "BYL202508-E80"                              │
│  ├─ fullName: "John Doe"                                       │
│  ├─ email: "john@example.com"                                  │
│  ├─ personalDetails: {                                         │
│  │    dateOfBirth: Date,                                       │
│  │    gender: String,                                          │
│  │    phone: String,                                           │
│  │    address: { current, permanent },                         │
│  │    emergencyContact: { ... }                                │
│  │  }                                                           │
│  └─ identityDetails: {                                         │
│       aadhaar: String (encrypted),                             │
│       pan: String (encrypted),                                 │
│       bankAccountNumber: String (encrypted),                   │
│       ...                                                       │
│     }                                                           │
│                                                                 │
│  employeepublictokens (new)                                    │
│  ├─ employeeId: "BYL202508-E80"                                │
│  ├─ token: "abc123..." (SHA256 hash)                           │
│  ├─ expiresAt: Date                                            │
│  ├─ isUsed: Boolean                                            │
│  ├─ usedAt: Date                                               │
│  ├─ generatedBy: ObjectId                                      │
│  ├─ allowMultipleSubmissions: Boolean                          │
│  └─ submissionCount: Number                                    │
│                                                                 │
│  profilesubmissionaudits (new)                                 │
│  ├─ employeeId: "BYL202508-E80"                                │
│  ├─ userId: ObjectId                                           │
│  ├─ action: "PROFILE_SUBMITTED"                                │
│  ├─ source: "PUBLIC_FORM"                                      │
│  ├─ token: "abc123..."                                         │
│  ├─ ipAddress: "xxx.xxx.xxx.xxx"                               │
│  ├─ userAgent: "Mozilla/5.0..."                                │
│  └─ timestamp: Date                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      API REQUEST FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Generate Token (Admin)                                     │
│     POST /api/admin/public-form/generate-link                  │
│     ├─ Headers: Authorization: Bearer {token}                  │
│     ├─ Body: { employeeId, expiryHours }                       │
│     └─ Response: { token, url, expiresAt }                     │
│                                                                 │
│  2. Validate Token (Public)                                    │
│     GET /api/public/validate?token={token}                     │
│     ├─ No authentication required                              │
│     ├─ Rate limited: 5 req/15min                               │
│     └─ Response: { employee, tokenInfo }                       │
│                                                                 │
│  3. Submit Profile (Public)                                    │
│     POST /api/public/submit                                    │
│     ├─ Body: { token, personalDetails, identityDetails }      │
│     ├─ Validation: All fields                                  │
│     ├─ Encryption: Sensitive fields                            │
│     └─ Response: { success, message }                          │
│                                                                 │
│  4. Check Status (Admin)                                       │
│     GET /api/admin/public-form/status/{employeeId}            │
│     ├─ Headers: Authorization: Bearer {token}                  │
│     └─ Response: { tokens, audits }                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      ERROR SCENARIOS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Invalid Token                                                 │
│  ├─ Check: Token exists in database                            │
│  ├─ Error: "Invalid token"                                     │
│  └─ Action: Show error page with contact info                  │
│                                                                 │
│  Expired Token                                                 │
│  ├─ Check: expiresAt > now                                     │
│  ├─ Error: "Token expired"                                     │
│  └─ Action: Show error with regenerate option                  │
│                                                                 │
│  Already Used Token                                            │
│  ├─ Check: isUsed === false                                    │
│  ├─ Error: "Token already used"                                │
│  └─ Action: Show read-only submitted data                      │
│                                                                 │
│  Validation Errors                                             │
│  ├─ Check: All validation rules                                │
│  ├─ Error: Field-specific messages                             │
│  └─ Action: Highlight fields, show messages                    │
│                                                                 │
│  Rate Limit Exceeded                                           │
│  ├─ Check: Request count per IP                                │
│  ├─ Error: "Too many attempts"                                 │
│  └─ Action: Block for 15 minutes                               │
│                                                                 │
│  Server Error                                                  │
│  ├─ Check: Database connection, etc.                           │
│  ├─ Error: "Internal server error"                             │
│  └─ Action: Log error, show generic message                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Success Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      SUCCESS FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Token Generated                                       │
│  ├─ Admin clicks "Generate Link"                               │
│  ├─ System creates secure token                                │
│  ├─ Token stored in database                                   │
│  └─ URL displayed to admin                                     │
│                                                                 │
│  Step 2: Link Shared                                           │
│  ├─ Admin copies link                                          │
│  ├─ Admin sends via email/WhatsApp                             │
│  └─ Employee receives link                                     │
│                                                                 │
│  Step 3: Form Accessed                                         │
│  ├─ Employee clicks link                                       │
│  ├─ Token validated                                            │
│  ├─ Employee data pre-filled                                   │
│  └─ Form displayed                                             │
│                                                                 │
│  Step 4: Form Filled                                           │
│  ├─ Employee fills 4 steps                                     │
│  ├─ Real-time validation                                       │
│  ├─ Auto-save to localStorage                                  │
│  └─ Progress tracked                                           │
│                                                                 │
│  Step 5: Form Submitted                                        │
│  ├─ Final validation                                           │
│  ├─ Data encrypted                                             │
│  ├─ Database updated                                           │
│  ├─ Token marked as used                                       │
│  └─ Audit log created                                          │
│                                                                 │
│  Step 6: Confirmation                                          │
│  ├─ Success message shown                                      │
│  ├─ Employee can close window                                  │
│  └─ Data instantly available                                   │
│                                                                 │
│  Step 7: Data Available                                        │
│  ├─ Employee profile updated                                   │
│  ├─ Admin panel shows completion                               │
│  └─ Audit trail recorded                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                   COMPONENT ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend Components                                           │
│  ├─ PublicProfileForm.jsx                                      │
│  │  ├─ Token validation                                        │
│  │  ├─ 4-step wizard                                           │
│  │  ├─ Form state management                                   │
│  │  ├─ Auto-save logic                                         │
│  │  └─ Submission handler                                      │
│  │                                                              │
│  └─ PublicFormLinkGenerator.jsx                                │
│     ├─ Token generation UI                                     │
│     ├─ Copy to clipboard                                       │
│     ├─ Email integration                                       │
│     └─ Success/error states                                    │
│                                                                 │
│  Backend Services                                              │
│  ├─ publicFormService.js                                       │
│  │  ├─ generateToken()                                         │
│  │  ├─ validateToken()                                         │
│  │  ├─ submitProfile()                                         │
│  │  ├─ encryptSensitiveData()                                  │
│  │  └─ decryptSensitiveData()                                  │
│  │                                                              │
│  ├─ publicFormController.js                                    │
│  │  ├─ validateToken()                                         │
│  │  ├─ submitProfile()                                         │
│  │  ├─ generateToken()                                         │
│  │  ├─ bulkGenerateTokens()                                    │
│  │  └─ getTokenStatus()                                        │
│  │                                                              │
│  └─ publicFormValidation.js                                    │
│     ├─ profileSubmissionRules                                  │
│     ├─ validate()                                              │
│     ├─ sanitizeProfileData()                                   │
│     └─ rateLimitConfig                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

**This flow diagram provides a visual representation of how the entire system works from start to finish.**
