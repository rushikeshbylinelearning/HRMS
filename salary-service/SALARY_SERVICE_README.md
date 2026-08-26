# Salary Service — Complete Technical Reference

**salary-service** is a standalone payroll and salary slip microservice for the Byline LMS platform.
It runs as a completely separate Node.js process on its own subdomain (payroll.bylinelms.com, port 3012),
with its own MongoDB database, its own JWT secret, and its own Backblaze B2 storage bucket — fully isolated
from the main Attendance Management System (AMS) at workflow.bylinelms.com (port 3011).

---

## Table of Contents

1. [Why a Separate Service](#1-why-a-separate-service)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture and System Topology](#4-architecture-and-system-topology)
5. [AMS Integration — The Internal Feed](#5-ams-integration--the-internal-feed)
6. [Authentication and Authorization](#6-authentication-and-authorization)
7. [Data Models](#7-data-models)
8. [Payroll Run Lifecycle](#8-payroll-run-lifecycle)
9. [Salary Computation Engine](#9-salary-computation-engine)
10. [PDF Generation and Watermarking](#10-pdf-generation-and-watermarking)
11. [Backblaze B2 Storage](#11-backblaze-b2-storage)
12. [External Link Sharing](#12-external-link-sharing)
13. [Encryption at Rest](#13-encryption-at-rest)
14. [API Reference](#14-api-reference)
15. [Security Architecture](#15-security-architecture)
16. [Environment Variables](#16-environment-variables)
17. [Boot Sequence and Startup Guards](#17-boot-sequence-and-startup-guards)
18. [Audit Logging](#18-audit-logging)
19. [Deployment and PM2](#19-deployment-and-pm2)
20. [Frontend Integration](#20-frontend-integration)
21. [Local Development](#21-local-development)
22. [Secret Rotation](#22-secret-rotation)

---

## 1. Why a Separate Service

Payroll and banking data is the most sensitive data class in the system. Isolating it here provides:

- **Blast-radius containment** — A compromise of AMS cannot automatically reach salary or banking data.
  They live in a different database behind a separate service with a completely separate auth stack.
- **Independent encryption key** — The ENCRYPTION_KEY that protects bank account numbers, PAN, IFSC,
  and UAN is unknown to AMS. Even full AMS MongoDB read access yields only AES-256-GCM ciphertext.
- **No fallback secrets** — Built to refuse startup if any cryptographic env var is missing.
  AMS audit finding F-HIGH-002 (hardcoded fallback JWT secrets) cannot recur here by design.
- **Route audit at boot** — routeAudit.js walks the entire Express router stack at startup and exits
  the process if any non-exempt route is missing auth middleware (fixes AMS F-HIGH-003 structurally).
- **Independent deployment and scaling** — Payroll can be updated or restarted without touching AMS.
- **Separate audit surface** — Every sensitive action (slip generation, link sharing, profile changes)
  is recorded in a dedicated AuditLog collection in the salary-service database.

---

## 2. Tech Stack

| Concern | Technology |
|---------|-----------|
| Runtime | Node.js >= 18 |
| Web framework | Express 4.22 |
| Database | MongoDB via Mongoose 8.24 |
| Auth | JWT HS256 — own JWT_SECRET, own refresh token rotation in MongoDB |
| Encryption | AES-256-GCM via Node.js built-in crypto module |
| PDF generation | pdf-lib 1.17 (pure JS, zero binary dependencies) |
| File storage | Backblaze B2 via AWS SDK v3 S3-compatible API |
| Security headers | helmet 7 |
| Rate limiting | express-rate-limit 7 |
| Logging | winston 3 |
| Process manager | PM2 (shared ecosystem.config.js with AMS) |
---

## 3. Project Structure

`
salary-service/
├── server.js                        # Entry point — boot, middleware, route mounting
├── db.js                            # MongoDB connection singleton
├── package.json
├── env.example                      # Template for all required env vars
├── DEPLOYMENT.md                    # Full operations runbook
├── ecosystem.config.js              # PM2 config (shared root with AMS)
│
├── config/
│   └── b2.js                        # Backblaze B2 S3 client factory
│
├── controllers/
│   ├── authController.js            # Login, refresh token, logout, /me
│   ├── financialProfileController.js # CRUD + encrypt/decrypt for bank/PAN fields
│   ├── folderController.js          # B2 folder browse, create, delete, rename, upload
│   ├── linkShareController.js       # Create/list/revoke share links + public redemption
│   ├── payrollRunController.js      # Run lifecycle: create → generate → finalize → paid
│   ├── payrollSettingsController.js # Singleton payroll computation settings
│   ├── salarySlipController.js      # List/view/download salary slips via presigned URLs
│   └── userController.js            # Admin user management (Admin/PayrollOfficer roles)
│
├── middleware/
│   ├── authenticateToken.js         # HS256 JWT verification — salary-service sessions only
│   ├── errorHandler.js              # Central Express error handler with structured logging
│   ├── requireAdmin.js              # Role gate: Admin only
│   ├── requirePayrollAccess.js      # Role gate: Admin or PayrollOfficer
│   ├── serviceTokenAuth.js          # X-Service-Token header verification (AMS feed auth)
│   └── uploadPayrollDoc.js          # Busboy-based PDF upload with size + MIME enforcement
│
├── models/
│   ├── AuditLog.js                  # Audit trail (28 action types, indexed by action/actor/subject)
│   ├── EmployeeFinancialProfile.js  # Salary structure + AES-encrypted bank/PAN/IFSC/UAN
│   ├── LinkShare.js                 # Share links (token stored as SHA-256 hash, TTL index)
│   ├── PayrollRun.js                # One payroll cycle per month/year (draft→finalized→paid)
│   ├── PayrollSettings.js           # Global payroll settings singleton
│   ├── RefreshToken.js              # Refresh token rotation records (TTL auto-delete)
│   ├── SalarySlip.js                # One computed slip per employee per run
│   └── User.js                      # salary-service internal users (completely separate from AMS)
│
├── routes/
│   ├── auth.js                      # /api/auth/* with rate limiters applied
│   ├── auditLogs.js                 # /api/audit-logs
│   ├── financialProfiles.js         # /api/financial-profiles
│   ├── folders.js                   # /api/folders
│   ├── links.js                     # /api/links
│   ├── payrollRuns.js               # /api/payroll-runs
│   ├── payrollSettings.js           # /api/payroll-settings
│   ├── salarySlips.js               # /api/salary-slips
│   ├── share.js                     # /share/:token — public, unauthenticated, rate-limited
│   └── users.js                     # /api/users
│
├── services/
│   ├── amsFeedClient.js             # HTTP client for AMS internal payroll + employee feeds
│   ├── auditLogger.js               # Write-and-forget audit event recorder
│   ├── b2Storage.js                 # Upload, presign, list, delete, rename on B2
│   ├── payrollCompute.js            # Pure salary math — no DB calls, fully testable
│   └── pdfGenerator.js              # Generates A4 salary slip PDFs with watermarking
│
├── utils/
│   ├── encryption.js                # AES-256-GCM encrypt/decrypt (iv:tag:ct format)
│   ├── envValidator.js              # Boot guard — process.exit(1) on missing env vars
│   ├── jwtUtils.js                  # HS256 sign/verify using JWT_SECRET
│   ├── logger.js                    # Winston logger + Express request logger middleware
│   ├── refreshTokenUtils.js         # Issue, rotate, and revoke refresh tokens atomically
│   ├── routeAudit.js                # Startup route auth self-check
│   └── storageKey.js                # Sanitised, deterministic B2 object key builder
│
└── scripts/
    ├── createAdminUser.js           # One-shot: create first Admin user on first deploy
    └── generateSecrets.js           # Prints fresh JWT_SECRET, ENCRYPTION_KEY, SERVICE_TOKEN
`

---
## 4. Architecture and System Topology

`
                         ┌─────────────────────────────────────────────────────┐
                         │              Byline LMS Platform                    │
                         │                                                      │
  Browser                │  ┌─────────────────────┐   ┌──────────────────────┐│
  (AMS frontend)  ──────►│  │   AMS Backend        │   │  salary-service      ││
  :5173 / :443           │  │   workflow.byline... │   │  payroll.byline...   ││
                         │  │   Port 3011          │   │  Port 3012           ││
  Browser                │  │                      │   │                      ││
  (Payroll SPA)   ──────►│  │  MongoDB: ams-db     │   │  MongoDB: salary-db  ││
  :5174 / payroll.       │  │  (users, attendance, │   │  (users, profiles,   ││
                         │  │   leaves, breaks...) │   │   payroll runs,      ││
                         │  │                      │   │   slips, links...)   ││
                         │  └──────────┬───────────┘   └─────────┬────────────┘│
                         │             │ X-Service-Token           │             │
                         │             │ /internal/payroll-feed   │             │
                         │             │ /internal/employees      │             │
                         │             └──────────────────────────►             │
                         │                                                      │
                         │  ┌──────────────────────────────────────────────┐   │
                         │  │            Backblaze B2                       │   │
                         │  │  AMS bucket: kyc/, cif/, policies/           │   │
                         │  │  Payroll bucket: payroll/ (separate key)     │   │
                         │  └──────────────────────────────────────────────┘   │
                         │                                                      │
                         │  CA / Auditor ────► /share/:token (public, no auth) │
                         └─────────────────────────────────────────────────────┘
`

Key isolation properties:

- The two MongoDB databases are on the **same Atlas cluster** but are completely separate databases.
  A credential that can read ams-db cannot read salary-service-db and vice versa.
- The two B2 buckets use **different application keys** each scoped to their own bucket/prefix.
  A leaked payroll key cannot reach KYC or HR documents, and vice versa.
- The only cross-service communication is a **one-direction read-only HTTP call** from salary-service
  to AMS. AMS never calls salary-service. salary-service never writes to AMS.
- salary-service users (Admin, PayrollOfficer) are **entirely separate** from AMS users.
  An AMS Admin account has zero access to salary-service unless explicitly created there.

---
## 5. AMS Integration — The Internal Feed

salary-service NEVER connects directly to AMS MongoDB. All attendance and leave data
is fetched through two read-only HTTP endpoints that AMS exposes exclusively for this service.

### 5.1 Authentication — SERVICE_TOKEN

Both services share a single long random hex string (SERVICE_TOKEN) stored in their respective .env files.
Every request from salary-service to AMS carries this in the X-Service-Token header.
AMS verifies it with a constant-time comparison (crypto.timingSafeEqual) to prevent timing attacks.

The TOKEN is intentionally separate from the JWT system. A bug in either JWT path cannot accidentally
expose the internal API, and a leaked SERVICE_TOKEN cannot be used to generate user sessions.

At the network level, the /internal/ route group on AMS should be restricted to the salary-service
server IP using nginx or Apache — this is documented in DEPLOYMENT.md as a belt-and-suspenders layer.

### 5.2 Endpoint: Payroll Feed

`
GET /internal/payroll-feed/:employeeId?month=M&year=YYYY
Header: X-Service-Token: <SERVICE_TOKEN>
Source: backend/routes/internal/payrollFeed.js
`

**What it returns:**

| Field | Description |
|-------|-------------|
| presentDays | Days the employee was present (On-time or Late, non-half-day) |
| halfDays | Days recorded as Half-day or present with isHalfDay flag |
| paidLeaveDays | Approved leave days where the leave type is paid (Planned, Sick, Casual, Comp-Off) |
| unpaidLeaveDays | Approved leave days without pay (LOP) |
| lopDays | Explicitly Loss-of-Pay leave days (subset of unpaid) |
| overtimeHours | totalWorkHours minus (presentDays x 8), floored at 0 |
| workingDays | Count of Mon-Sat days in the given month |
| totalWorkHours | Raw sum of all working hours (for salary-service overtime calculation) |

**What it does NOT return:** bank details, PAN, passwords, JWT secrets, session tokens, or any PII
beyond employeeId and employeeName.

**AMS-side logic:**
1. Resolves the employee by ObjectId or by employeeCode string.
2. Queries AttendanceLog for the month date range, counting present and half-day records.
3. Queries LeaveRequest (status: Approved) for dates overlapping the month.
4. For each leave request, splits dates by LOP vs paid using dayTypeAllocations when present.
5. Counts working days in the month (Mon–Sat, no holiday deduction — salary-service handles that).

### 5.3 Endpoint: Employee List Feed

`
GET /internal/employees
Header: X-Service-Token: <SERVICE_TOKEN>
Source: backend/routes/internal/employeeFeed.js
`

Returns all non-Admin AMS employees with: employeeId, ullName, email, department,
designation, isActive, employmentStatus, joiningDate.

salary-service calls this when a PayrollOfficer opens the financial profile creation form,
so they can pick an AMS employee from a dropdown rather than typing an ID manually.
The response is enriched with a hasProfile flag indicating whether a financial profile already exists.

### 5.4 Timeout and Fault Handling

Both feed calls use a 15-second timeout. If AMS is unreachable or returns HTTP 404 for an employee,
msFeedClient.js returns a zeroed-out attendance data object rather than hard-failing the payroll run.
This means a slip can still be generated for an employee not found in AMS — the slip will show
zero attendance figures, which the admin can then review and correct.

---
## 6. Authentication and Authorization

salary-service has a completely independent auth stack from AMS.
It does not accept AMS JWT tokens, AMS SSO tokens, or RS256-signed tokens of any kind.

### 6.1 Login Flow

```
POST /api/auth/login  { email, password }
  Rate limited: 5 attempts / 15 min per IP+email combo
  Account lockout check: locked after 5 consecutive failures for 15 minutes
  Password verified against bcrypt hash (cost factor 12)
  On success:
    a. Signs HS256 access token (15 min TTL) with userId, email, role
    b. Issues refresh token (random 64-byte hex), stores SHA-256 hash in RefreshToken collection
    c. Access token returned in response body; refresh token in httpOnly cookie
    d. Cookie: path=/api/auth, SameSite=strict (prod), Secure=true (prod)
  On failure: increments failedLoginCount, 15-min lockout after 5 failures
  Audit: LOGIN_SUCCESS or LOGIN_FAILED
```

### 6.2 Token Refresh Flow

```
POST /api/auth/refresh  (cookie: refreshToken sent automatically)
  Rate limited: 20 attempts / 5 min per IP+cookie-hash
  rotateRefreshToken():
    1. Hashes the incoming raw token (SHA-256)
    2. findOneAndUpdate with revoked:false filter (atomic)
    3. If already used: RefreshTokenReuseError
       -> all tokens for that user revoked, REFRESH_TOKEN_REUSE_DETECTED audit event
  Issues new access token + new refresh token
  Audit: REFRESH_TOKEN_ROTATED
```

### 6.3 Roles

| Role | Access |
|------|--------|
| Admin | Full access: user mgmt, payroll run mutations, folder delete, settings |
| PayrollOfficer | Read access to runs/slips/profiles; can create profiles and upload; cannot finalize or delete |

Role is enforced per-route via requireAdmin or requirePayrollAccess middleware.

### 6.4 What is NOT Supported

- No SSO, no AMS token passthrough, no federation.
- No email-based password reset.
- No employee self-service. Employees are data subjects, not service users.

---

## 7. Data Models

### 7.1 User (salary-service-db, users collection)

Completely separate from AMS users. An AMS Admin has zero access unless explicitly created here.

| Field | Type | Notes |
|-------|------|-------|
| email | String | Unique, lowercase |
| passwordHash | String | bcrypt cost 12, select:false (never returned in queries) |
| role | String | Admin or PayrollOfficer |
| isActive | Boolean | Inactive users cannot log in |
| failedLoginCount | Number | Reset to 0 on successful login |
| lockedUntil | Date | Set to now+15min after 5 consecutive failures |

### 7.2 EmployeeFinancialProfile

One document per AMS employee. employeeId is a plain string (AMS employee code), NOT a cross-DB ObjectId FK.

| Field | Encrypted | Notes |
|-------|-----------|-------|
| employeeId | No | AMS identifier, unique index |
| employeeName | No | Cached from AMS for display only, not authoritative |
| bankAccountNumber | YES AES-256-GCM | Stored as iv:tag:ct |
| ifscCode | YES AES-256-GCM | Stored as iv:tag:ct |
| panNumber | YES AES-256-GCM | Stored as iv:tag:ct |
| uan | YES AES-256-GCM | PF/UAN number, stored as iv:tag:ct |
| ctc | No | Annual CTC (used in percentage mode) |
| basicSalary | No | Monthly basic (used in fixed mode) |
| hra | No | Monthly HRA (used in fixed mode) |
| allowances | No | Monthly allowances (used in fixed mode) |
| useFixedSalary | No | true = use fixed fields; false = derive from CTC percentages |
| isActive | No | Inactive profiles skipped in payroll runs |

### 7.3 PayrollSettings (singleton)

| Field | Default | Description |
|-------|---------|-------------|
| basicPercentage | 40% | % of annual CTC for monthly basic |
| hraPercentage | 20% | % of annual CTC for monthly HRA |
| allowancesPercentage | 15% | % of annual CTC for monthly allowances |
| pfPercentage | 12% | % of post-LOP effective basic for PF deduction |
| esiPercentage | 0.75% | % of gross pay for ESI deduction |
| professionalTax | 200 | Flat amount per month |
| tdsPercentage | 5% | % of gross pay for TDS deduction |
| lopDailyRate | 0 | If 0, computed as monthlyGross / standardWorkingDays |
| overtimeHourlyRate | 0 | Per-hour rate for overtime pay |
| standardWorkingDays | 26 | Denominator for LOP daily rate calculation |

### 7.4 PayrollRun

One document per month/year. Unique compound index (month, year) prevents duplicates.

| Status | Description |
|--------|-------------|
| draft | Slips can be generated or regenerated; all fields mutable |
| finalized | Slips locked; totals final; only mark-paid transition allowed |
| paid | Terminal state; no further mutations |

### 7.5 SalarySlip

One document per employee per payroll run. Unique compound index on (payrollRunId, employeeId).
Generation is idempotent — regenerating a draft run upserts the existing slip.
Contains: earnings (basic, HRA, allowances, OT, bonus), deductions (PF, ESI, PT, TDS, LOP),
grossPay, totalDeductions, netPay, raw attendanceData snapshot from AMS, and B2 storageKey.

### 7.6 LinkShare

External sharing link. Raw token returned once at creation, never stored. Only SHA-256 hash stored.
TTL index on expiresAt: MongoDB auto-deletes expired records.

| Field | Notes |
|-------|-------|
| tokenHash | SHA-256 of raw token |
| resourceType | salarySlip or folder |
| permission | view or download (UX convention, not cryptographic DRM) |
| maxUses / useCount | Supports single-use and multi-use links |
| revoked | Admin can revoke before expiry |
| accessLog | [{ip, userAgent, accessedAt}] — every redemption recorded |

### 7.7 AuditLog

28 action types covering auth, users, profiles, payroll runs, slips, link sharing, and storage.
Indexed on action, performedBy, subject, and timestamp. Write-and-forget pattern.

---

## 8. Payroll Run Lifecycle

A payroll run processes all active employees for a given month and year.
The workflow has four stages:

```
Stage 1 — Create Draft
  POST /api/payroll-runs  { month, year, notes }
  Creates a PayrollRun document with status: draft
  Unique constraint prevents duplicate runs for the same month/year
  Audit: PAYROLL_RUN_CREATED

Stage 2 — Generate Slips
  POST /api/payroll-runs/:id/generate
  For each active EmployeeFinancialProfile (processed in sequence):
    1. Call amsFeedClient.fetchEmployeeAttendance(employeeId, month, year)
       -> GET /internal/payroll-feed/:employeeId?month=M&year=Y on AMS
       -> Returns presentDays, halfDays, paidLeaveDays, unpaidLeaveDays,
          lopDays, overtimeHours, workingDays
    2. Decrypt sensitive fields (bank, PAN) from EmployeeFinancialProfile
       using AES-256-GCM (ENCRYPTION_KEY) — for PDF only, never returned to API
    3. Call payrollCompute.computeSalarySlip(profile, settings, attendanceData)
       -> Pure function, no DB calls, fully deterministic
       -> Returns: basicSalary, hra, allowances, overtimePay, bonus,
          grossPay, deductions{pf, esi, pt, tds, lop}, totalDeductions, netPay
    4. Upsert SalarySlip document (idempotent — regeneration safe)
    5. Call pdfGenerator.generateSalarySlipPDF(slip, profile, companyName)
       -> Generates A4 PDF using pdf-lib
       -> Layout: header, employee details, earnings/deductions table, net pay banner,
          attendance summary, footer, diagonal watermark
    6. Upload PDF to B2: storageKey = payroll/Employees/{empId}/{year}/{month}/payslip.pdf
    7. Store storageKey on SalarySlip document
    8. Audit: SALARY_SLIP_GENERATED per employee
  Failures for individual employees are collected; the run continues for others
  Response: { success: [empIds], failed: [{empId, error}] }
  Updates PayrollRun with employeeCount, totalGross, totalNet

Stage 3 — Finalize
  POST /api/payroll-runs/:id/finalize
  Status: draft -> finalized
  Stores finalizedBy and finalizedAt
  Audit: PAYROLL_RUN_FINALIZED
  After this point, slips cannot be regenerated

Stage 4 — Mark Paid
  POST /api/payroll-runs/:id/mark-paid
  Status: finalized -> paid
  Stores paidBy and paidAt
  Audit: PAYROLL_RUN_MARKED_PAID
  Terminal state — no further mutations
```

---

## 9. Salary Computation Engine

All computation logic lives in services/payrollCompute.js.
It is a pure function: no database calls, no side effects, fully unit-testable.

### Step-by-step Calculation

**Step 1 — Monthly salary components**

Fixed salary mode (useFixedSalary = true):
  basicMonthly = profile.basicSalary
  hraMonthly   = profile.hra
  allowances   = profile.allowances

CTC percentage mode (useFixedSalary = false):
  basicMonthly = (annualCTC * basicPercentage%) / 12
  hraMonthly   = (annualCTC * hraPercentage%) / 12
  allowances   = (annualCTC * allowancesPercentage%) / 12

**Step 2 — LOP (Loss of Pay) deduction**

  lopDays = attendanceData.lopDays + attendanceData.unpaidLeaveDays
  lopDailyRate = settings.lopDailyRate > 0
    ? settings.lopDailyRate
    : (basicMonthly + hraMonthly + allowances) / standardWorkingDays
  lopDeduction = lopDays * lopDailyRate

**Step 3 — Half-day adjustment**

  halfDayDeduction = halfDays * 0.5 * lopDailyRate

**Step 4 — Overtime earnings**

  overtimePay = overtimeHours * overtimeHourlyRate

**Step 5 — Gross pay**

  grossPay = grossBeforeLOP - lopDeduction - halfDayDeduction + overtimePay + bonus

**Step 6 — Statutory deductions (on post-LOP gross)**

  effectiveBasic = basicMonthly - proportional_lop_on_basic
  PF  = effectiveBasic * pfPercentage%
  ESI = grossPay * esiPercentage%
  TDS = grossPay * tdsPercentage%
  PT  = professionalTax (flat)

  totalDeductions = PF + ESI + TDS + PT + lopDeduction + halfDayDeduction

**Step 7 — Net pay**

  netPay = grossPay - PF - ESI - TDS - PT

All monetary values are rounded to 2 decimal places using the EPSILON rounding trick.

---

## 10. PDF Generation and Watermarking

services/pdfGenerator.js uses pdf-lib to generate an A4 (595x842 pt) salary slip PDF.
No external binaries, no Puppeteer, no headless browser — pure JavaScript PDF construction.

**PDF layout:**

| Section | Content |
|---------|---------|
| Header | Company name, SALARY SLIP label, pay period (month/year) |
| Employee Details | Employee ID, name, pay period, generation date |
| Earnings column | Basic, HRA, Allowances, Overtime Pay, Bonus |
| Deductions column | PF, ESI, Professional Tax, TDS, LOP Deduction, Other |
| Totals row | Gross Pay vs Total Deductions |
| Net Pay banner | Blue banner with net pay in white text |
| Attendance Summary | Present days, paid leave, unpaid leave, half days, LOP, OT hours |
| Footer | Computer-generated disclaimer + ISO timestamp |
| Watermark | Diagonal, semi-transparent text (if watermark param provided) |

**Watermarking:**
When a salary slip is accessed through a share link (external CA/auditor access),
the PDF is watermarked with the recipientLabel and date:
  "Shared with: CA Sharma & Co  |  12/07/2026"

This is a practical deterrent against casual redistribution, not DRM.
It identifies the source if a document leaks. A determined actor with a screenshot
tool can bypass it — this limitation is documented explicitly in the code and README.

---

## 11. Backblaze B2 Storage

All payroll PDFs and documents are stored in a dedicated private B2 bucket,
separate from the AMS bucket used for KYC, CIF, and HR policy documents.

### B2 Object Key Schema

All keys are built through utils/storageKey.js which sanitises every path segment
(strips /, \, null bytes, control chars, leading dots) before constructing the key.
User input can never escape the configured B2_PREFIX namespace.

| Key Pattern | Used For |
|-------------|----------|
| payroll/Employees/{empId}/{year}/{month}/payslip.pdf | Generated salary slip PDFs |
| payroll/Employees/{empId}/{year}/{month}/attachments/{file} | Attachments per slip |
| payroll/Shared/{folderName}/ | Admin-created ad-hoc shared folders |
| payroll/Shared/{folderName}/{file} | Files inside shared folders |

### Presigned URLs

Files are never proxied through salary-service. Access is always via short-lived presigned GET URLs:
- Default TTL: 10 minutes (600 seconds)
- Content-Disposition: inline (view) or attachment (download), set at presign time
- The presigned URL is returned in the API response; the client fetches directly from B2

### B2 Operations in b2Storage.js

| Function | Description |
|----------|-------------|
| uploadObject | PutObjectCommand — uploads Buffer with ContentType and Metadata |
| createFolderMarker | Uploads zero-byte object with trailing / as folder marker |
| presignedGetUrl | GetObjectCommand with expiry and disposition — returns signed URL |
| listObjects | ListObjectsV2Command with Delimiter for folder-style listing |
| deleteObject | DeleteObjectCommand for a single key |
| deleteFolderRecursive | Lists all objects under prefix, batch-deletes (1000/batch) — IRREVERSIBLE |
| renameObject | CopyObjectCommand + deleteObject (S3 has no native rename) |
| objectExists | HeadObjectCommand — returns true/false without fetching body |

---

## 12. External Link Sharing

Salary slips and B2 folders can be shared with external parties (CAs, auditors, banks)
via timed, token-gated links — no salary-service account required to redeem.

### Creation (authenticated)

POST /api/links  { resourceType, resourceKey, permission, recipientLabel, expiryPreset, maxUses }

| Parameter | Values | Notes |
|-----------|--------|-------|
| resourceType | salarySlip, folder | Determines how B2 key is treated |
| resourceKey | B2 object key or prefix | Must be a valid B2 key in the payroll bucket |
| permission | view, download | Controls Content-Disposition on presigned URL |
| recipientLabel | free text (max 100 chars) | Used in watermark and audit trail |
| expiryPreset | 24h, 7d, 30d | Or customExpiryMs (capped at 90 days) |
| maxUses | integer >= 1 | Default 1 (single-use link) |

A 32-byte random hex token (64 chars) is generated with crypto.randomBytes(32).
Only the SHA-256 hash is stored. The raw token is returned once in the response.
The shareUrl (/share/<rawToken>) is sent to the recipient.

### Redemption (public, unauthenticated)

GET /share/:token
  Rate limited: 30 requests / 15 min per IP
  1. Hashes the 64-char token with SHA-256
  2. Looks up LinkShare by tokenHash
  3. Checks: not revoked, not expired, useCount < maxUses
  4. Increments useCount, appends {ip, userAgent, accessedAt} to accessLog
  5. Generates a 10-minute presigned GET URL from B2
  6. Returns: { permission, presignedUrl, resourceLabel, viewNote }
  7. Audit: LINK_REDEEMED (with recipient label, resource type, IP)

The recipient uses the presignedUrl to fetch the PDF directly from B2.
salary-service never proxies the file bytes.

### Security Properties

- Token space: 32 bytes = 2^256 effective space, brute force computationally infeasible
- Raw token never stored: database breach reveals only SHA-256 hash, not the usable token
- TTL index: expired links auto-deleted by MongoDB, no stale records accumulate
- Presigned URL TTL: 10 minutes, short-lived window to minimise forwarding risk
- Watermark: PDFs carry recipient identity — practical deterrent against casual redistribution
- Every redemption logged with IP + User-Agent for forensic audit

---

## 13. Encryption at Rest

Four fields in EmployeeFinancialProfile are encrypted before saving to MongoDB:
bankAccountNumber, ifscCode, panNumber, uan.

### Algorithm: AES-256-GCM

- 256-bit key derived from ENCRYPTION_KEY env var (32 bytes as 64-char hex)
- 96-bit random IV generated per encryption operation (crypto.randomBytes(12))
- 128-bit authentication tag produced by GCM mode
- Storage format: "iv:authTag:ciphertext" (all hex-encoded, colon-delimited)
- Authenticated encryption: any tampering with ciphertext or tag causes decryption to fail

### Encrypt/Decrypt Flow

On write (create or update financial profile):
  1. Controller calls encrypt(plaintext) for each sensitive field
  2. encrypt() generates fresh 12-byte IV
  3. createCipheriv(aes-256-gcm, key, iv)
  4. Encrypts plaintext, gets auth tag
  5. Stores "ivHex:tagHex:ciphertextHex" string in MongoDB

On read (list/get financial profile, generate slip):
  1. Controller calls decrypt(stored) for each sensitive field
  2. Splits on ":" to extract iv, tag, ciphertext
  3. createDecipheriv + setAuthTag + update + final
  4. Returns plaintext string
  5. On decryption failure: field returned as "***DECRYPTION_ERROR***" (never crashes caller)

### Key Management

- ENCRYPTION_KEY is validated at boot by envValidator.js — process exits if missing or < 64 chars
- Key is lazy-loaded once into a module-level Buffer; no repeated env var reads
- Rotating the key requires a migration script that re-encrypts all profiles
  (see Secret Rotation section for the procedure)
- The key is never logged, never returned in any API response, never passed to AMS

---

## 14. API Reference

Base URL: https://payroll.bylinelms.com
All protected routes require:  Authorization: Bearer <accessToken>

### Auth

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | /api/auth/login | Public | 5/15min per IP+email | Email + password login |
| POST | /api/auth/refresh | Cookie | 20/5min per IP | Rotate refresh token, get new access token |
| POST | /api/auth/logout | Optional | None | Revoke refresh token, clear cookie |
| GET | /api/auth/me | Bearer | None | Get current user profile |

### Users (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/users | List all users |
| POST | /api/users | Create a new user (Admin or PayrollOfficer) |
| PATCH | /api/users/:id | Update user (name, role, isActive) |
| POST | /api/users/:id/reset-password | Reset a user password |

### Financial Profiles

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/financial-profiles | Admin, PayrollOfficer | List all active profiles (sensitive fields decrypted) |
| GET | /api/financial-profiles/:employeeId | Admin, PayrollOfficer | Get one profile |
| POST | /api/financial-profiles | Admin, PayrollOfficer | Create profile (sensitive fields encrypted on save) |
| PUT | /api/financial-profiles/:employeeId | Admin, PayrollOfficer | Update profile |
| GET | /api/financial-profiles/sync/employees | Admin, PayrollOfficer | Fetch employee list from AMS with hasProfile flag |

### Payroll Settings

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/payroll-settings | Admin, PayrollOfficer | Get current settings |
| PUT | /api/payroll-settings | Admin only | Update settings |

### Payroll Runs

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/payroll-runs | Admin, PayrollOfficer | List all runs (last 24, sorted by year/month desc) |
| GET | /api/payroll-runs/:id | Admin, PayrollOfficer | Get run + all its salary slips |
| POST | /api/payroll-runs | Admin only | Create a draft run for a month/year |
| POST | /api/payroll-runs/:id/generate | Admin only | Generate/regenerate all slips (pulls AMS data) |
| POST | /api/payroll-runs/:id/finalize | Admin only | Lock run (draft -> finalized) |
| POST | /api/payroll-runs/:id/mark-paid | Admin only | Mark as paid (finalized -> paid) |

### Salary Slips

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/salary-slips | Admin, PayrollOfficer | List/filter slips (by employee, month, year, run) |
| GET | /api/salary-slips/:id | Admin, PayrollOfficer | Get single slip record |
| GET | /api/salary-slips/:id/view | Admin, PayrollOfficer | Presigned inline URL (10 min) for viewing |
| GET | /api/salary-slips/:id/download | Admin, PayrollOfficer | Presigned attachment URL (10 min) for download |

### Share Links

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/links | Bearer | List active, non-expired, non-revoked links |
| POST | /api/links | Bearer | Create a new share link |
| GET | /api/links/:id/access-log | Bearer | Get full access log for a link |
| POST | /api/links/:id/revoke | Bearer | Revoke a link immediately |
| GET | /share/:token | Public | Redeem a share link (rate-limited 30/15min) |

### B2 Folder Panel

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/folders?prefix= | Admin, PayrollOfficer | List files/folders under prefix |
| GET | /api/folders/view?key= | Admin, PayrollOfficer | Presigned inline URL for a file |
| POST | /api/folders | Admin only | Create a folder (zero-byte marker) |
| DELETE | /api/folders?prefix= | Admin only | Recursive folder delete (IRREVERSIBLE) |
| DELETE | /api/folders/file?key= | Admin only | Delete a single file |
| POST | /api/folders/upload | Admin, PayrollOfficer | Upload a PDF into a folder |
| POST | /api/folders/rename | Admin only | Rename/move a file (copy + delete) |

### Audit Logs (Admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/audit-logs | Paginated audit log — filterable by action, subject, date range |

### Health Check

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | Public | Returns {status: "ok"} if DB connected, 503 if not |

---

## 15. Security Architecture

### 15.1 Layered Defense Model

| Layer | Mechanism |
|-------|-----------|
| Network | nginx/Apache restricts /internal/* to salary-service IP only |
| Service token | X-Service-Token on all /internal/ routes, constant-time comparison |
| JWT auth | HS256, 15-min access token, httpOnly refresh cookie, rotation on every use |
| Role gates | requireAdmin and requirePayrollAccess middleware on every protected route |
| Route audit | routeAudit.js exits the process at boot if any route lacks auth middleware |
| Env validation | envValidator.js exits the process at boot if any crypto var is missing |
| Encryption | AES-256-GCM for all sensitive fields; key never leaves server memory |
| Rate limiting | Login: 5/15min per IP+email; Refresh: 20/5min; Share: 30/15min |
| Account lockout | 15-min lockout after 5 consecutive failed logins per account |
| B2 isolation | Separate bucket and application key scoped to payroll prefix only |
| Audit trail | All sensitive actions logged with actor, IP, user-agent, and subject |
| Token hashing | Refresh tokens and share tokens stored as SHA-256 hashes only |
| Token rotation | Refresh token reuse detection: all tokens revoked on replay attempt |
| Storage keys | storageKey.js sanitises all user input before building B2 object paths |
| CSP headers | helmet with frameAncestors: none (slips cannot be iframed externally) |

### 15.2 Known Limitations (Documented)

- **View vs Download is a UX nudge, not DRM.** Once PDF bytes reach a browser they can
  be saved regardless of Content-Disposition. Watermarking is the practical deterrent.
  This limitation is explicitly acknowledged in linkShareController.js and the README.

- **Presigned URL forwarding.** A 10-minute presigned URL can be forwarded to another
  party within its TTL. Short TTL and IP logging of share redemption reduce the window
  but cannot eliminate the risk entirely.

- **AMS feed availability.** If AMS is down during slip generation, the affected employee
  gets a slip with zero attendance. Partial failures are returned in the generate response.

### 15.3 What AMS Cannot Do to salary-service

- Cannot read salary-service MongoDB (different database, different Atlas credentials)
- Cannot decrypt financial profiles (ENCRYPTION_KEY not shared with AMS)
- Cannot issue salary-service JWT tokens (JWT_SECRET not shared with AMS)
- Cannot access the payroll B2 bucket (B2 application key not shared with AMS)
- Can only provide read-only attendance data via the /internal/ feed endpoints

---

## 16. Environment Variables

All variables validated at boot by utils/envValidator.js.
Process refuses to start if any required variable is missing or below minimum length.
There are NO fallback values anywhere in this codebase.

### Required Variables

| Variable | Min Length | Purpose |
|----------|-----------|---------|
| JWT_SECRET | 64 chars | HS256 signing key for access tokens |
| ENCRYPTION_KEY | 64 chars | AES-256-GCM key for sensitive fields (32 bytes as hex) |
| MONGODB_URI | 20 chars | MongoDB connection — must point to salary-service-db, NOT ams-db |
| SERVICE_TOKEN | 32 chars | Shared secret with AMS /internal/ routes |
| B2_KEY_ID | 1+ chars | Backblaze application key ID (payroll bucket only) |
| B2_APPLICATION_KEY | 1+ chars | Backblaze application key secret |
| B2_BUCKET_NAME | 1+ chars | e.g. byline-payroll-docs |
| B2_ENDPOINT | 1+ chars | e.g. s3.us-east-005.backblazeb2.com |

Generate all three crypto secrets at once:

```bash
node salary-service/scripts/generateSecrets.js
# Outputs: JWT_SECRET, ENCRYPTION_KEY, SERVICE_TOKEN
# Paste each into salary-service/.env
# Paste SERVICE_TOKEN into backend/.env as SERVICE_TOKEN as well
```

### Optional Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| PORT | 3012 | HTTP listen port |
| NODE_ENV | development | production enables Secure cookie, strict SameSite, domain cookie |
| TZ | Asia/Kolkata | Timezone for date formatting in PDFs |
| JWT_EXPIRES_IN | 15m | Access token TTL |
| REFRESH_TOKEN_TTL_MS | 604800000 | Refresh token TTL in ms (default 7 days) |
| AMS_INTERNAL_BASE_URL | http://localhost:3011 | AMS base URL for internal feed calls |
| B2_PREFIX | payroll/ | Prefix namespace for all B2 object keys |
| B2_REGION | us-east-005 | B2 S3-compatible region identifier |
| ALLOWED_ORIGINS | (none) | Comma-separated CORS allowed origins |
| LOG_LEVEL | info | Winston log level (error/warn/info/debug) |
| COMPANY_NAME | Company | Used in the PDF salary slip header |
| FRONTEND_DIST_PATH | ./public | Path to built frontend assets for SPA serving |
| SKIP_ROUTE_AUDIT | false | Set true to skip route auth audit at boot (dev only) |

---

## 17. Boot Sequence and Startup Guards

server.js enforces a strict boot order with two hard exits before the server listens:

```
1. Set TZ (process.env.TZ || Asia/Kolkata)
2. Load .env via dotenv.config()
3. validateAndExit()  <-- exits if JWT_SECRET, ENCRYPTION_KEY, MONGODB_URI,
                           SERVICE_TOKEN, or any B2 var is missing or too short
4. Connect to MongoDB (connectDB) with 30s server selection timeout
5. Register Express middleware:
   helmet (CSP + security headers)
   compression (gzip level 6, threshold 1KB)
   cors (ALLOWED_ORIGINS whitelist, credentials: true)
   cookieParser
   express.json (2MB limit)
   requestLogger (Winston, every request logged)
6. Mount /health and /api/auth and /share (public routes)
7. Mount all protected /api/* routes
8. Serve built SPA from ./public if index.html exists
9. auditRoutes(app, exitOnFailure=true)  <-- walks entire Express router stack,
   exits if any route outside EXEMPT_ROUTES lacks KNOWN_AUTH_MIDDLEWARE
10. app.listen() on 0.0.0.0:PORT (production) or 127.0.0.1:PORT (development)
```

If steps 3 or 9 fail, the process calls process.exit(1) with a detailed error message
listing every missing variable or every unprotected route. This means a misconfigured
deploy fails loudly and immediately rather than running in a broken state.

### Route Audit (routeAudit.js)

The audit walks the Express _router.stack recursively, collecting all route+method combos.
It cross-references each against EXEMPT_ROUTES (POST /api/auth/login, POST /api/auth/refresh,
POST /api/auth/logout, GET /health, OPTIONS *, /share/*) and checks that every non-exempt
route has at least one of: authenticateToken, requireAdmin, requirePayrollAccess, serviceTokenAuth
in its middleware chain.

This structurally prevents the pattern that caused AMS audit finding F-HIGH-003.

---

## 18. Audit Logging

Every security-sensitive action writes to the AuditLog collection via services/auditLogger.js.

### Write-and-Forget Pattern

auditLogger.audit() wraps the database write in try/catch. A failure to write an audit
event logs a console error but NEVER propagates to the calling request handler.
This ensures audit logging never causes request failures or data loss.

### Action Types (28 total)

| Category | Actions |
|----------|---------|
| Auth | LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, REFRESH_TOKEN_ROTATED, REFRESH_TOKEN_REUSE_DETECTED |
| User management | USER_CREATED, USER_UPDATED, USER_DEACTIVATED |
| Financial profiles | FINANCIAL_PROFILE_CREATED, FINANCIAL_PROFILE_UPDATED |
| Payroll runs | PAYROLL_RUN_CREATED, PAYROLL_RUN_FINALIZED, PAYROLL_RUN_MARKED_PAID |
| Salary slips | SALARY_SLIP_GENERATED, SALARY_SLIP_UPLOADED |
| Link sharing | LINK_CREATED, LINK_REDEEMED, LINK_REVOKED, LINK_EXPIRED_ACCESS_ATTEMPT |
| Storage | FOLDER_CREATED, FOLDER_DELETED, FILE_UPLOADED, FILE_DELETED |

### AuditLog Schema

Each document stores: action, performedBy (ObjectId), performedByEmail, subject
(employee ID / token hash prefix / etc.), ipAddress, userAgent, details (Mixed),
success, errorMessage, timestamp.

Indexes: (action, timestamp), (performedBy, timestamp), (subject, timestamp).

### Querying Audit Logs

GET /api/audit-logs?action=LOGIN_FAILED&subject=EMP042&from=2026-07-01&to=2026-07-31&page=1&limit=50

Admin-only. Paginated. Filterable by action, subject, actor, success/failure, date range.

---

## 19. Deployment and PM2

### PM2 Configuration

salary-service shares the root ecosystem.config.js with AMS:

```javascript
{
  name: "salary-service",
  cwd: "/home/bylinelm/payroll.bylinelms.com/salary-service",
  script: "server.js",
  instances: 1,
  exec_mode: "fork",
  env: { NODE_ENV: "development", PORT: 3012 },
  env_production: { NODE_ENV: "production", PORT: 3012 },
  max_memory_restart: "384M"
}
```

Always start with --env production on the server:

```bash
pm2 start ecosystem.config.js --only salary-service --env production
pm2 save
```

Never omit --env production. Without it, NODE_ENV=development, which silently
enables insecure cookie settings and localhost CORS origins. Same issue found in AMS audit.

### First Deploy Checklist

```bash
# 1. Generate secrets (run locally, never on server)
node salary-service/scripts/generateSecrets.js

# 2. Create .env on server with all required values from env.example
# 3. Add SERVICE_TOKEN to backend/.env as well, then restart AMS:
pm2 restart attendance-backend --update-env

# 4. Deploy code (rsync, excluding .env and node_modules)
rsync -avz --exclude node_modules --exclude .env salary-service/ user@server:/path/salary-service/

# 5. Install dependencies
npm ci --omit=dev

# 6. Start the service
pm2 start ecosystem.config.js --only salary-service --env production

# 7. Create first Admin user
node scripts/createAdminUser.js --email admin@bylinelms.com --password "StrongPass123"

# 8. Verify health
curl https://payroll.bylinelms.com/health
# Expected: {"status":"ok"}
```

### nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name payroll.bylinelms.com;

    location / {
        proxy_pass         http://127.0.0.1:3012;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

# In the AMS server block — restrict /internal/ to loopback only
location /internal/ {
    allow 127.0.0.1;
    deny all;
    proxy_pass http://127.0.0.1:3011;
}
```

### Ongoing Deployments (CI/CD)

The GitHub Actions workflow (.github/workflows/testing.yml) handles deployments on push to master:
1. Rsyncs salary-service code (excludes .env and node_modules)
2. Runs npm ci --omit=dev on the server
3. Runs pm2 restart salary-service --update-env

The .env file on the server is never touched by CI — it persists between deploys.

### PM2 Operations

```bash
pm2 list                                    # Check status
pm2 logs salary-service --lines 100         # Tail logs
pm2 restart salary-service --update-env     # Restart after .env change
pm2 stop salary-service                     # Stop
```

---

## 20. Frontend Integration

salary-service has its own dedicated React SPA (salary-service-frontend), separate from
the main AMS frontend. It runs on port 5174 in development and is served from ./public
in production via the SPA fallback in server.js.

### How the Payroll SPA Connects

```
Browser (payroll.bylinelms.com)
  |
  | HTTPS
  |
salary-service Express (port 3012)
  |
  |-- POST /api/auth/login  -> access token in response body
  |                            refresh token in httpOnly cookie
  |
  |-- Payroll SPA stores access token IN MEMORY ONLY
  |   (same pattern as AMS frontend — never localStorage)
  |
  |-- Every API call: Authorization: Bearer <accessToken>
  |
  |-- Token expiry (15 min): axios interceptor catches 401,
  |   calls POST /api/auth/refresh (cookie sent automatically),
  |   gets new access token, retries original request
  |
  |-- Salary slip view/download:
  |   GET /api/salary-slips/:id/view -> { presignedUrl }
  |   Browser opens presignedUrl directly -> PDF served by B2
  |
  +-- Share link creation:
      POST /api/links -> { token, shareUrl }
      Admin copies shareUrl to send to CA/auditor
      CA opens /share/<token> -> presignedUrl -> PDF from B2
```

### AMS Frontend Connection (Payroll module in AMS)

The AMS frontend at workflow.bylinelms.com has a /payroll route that renders
PayrollManagementPage. This page uses the AMS backend /api/payroll/* routes,
which are SEPARATE from salary-service. The /api/payroll routes in AMS are a
legacy/placeholder implementation; salary-service is the authoritative payroll system.

The AMS /payroll page may eventually redirect to payroll.bylinelms.com or embed
a link to it, but the two auth systems remain separate — no token sharing.

### Key Frontend Behaviour Notes

- No Socket.IO in salary-service (unlike AMS). All updates require page refresh or polling.
- PDF viewing uses presigned URLs. The frontend opens them in a new tab or iframe.
- Share link tokens are returned ONCE at creation. Frontend must present them
  immediately (e.g. copy-to-clipboard dialog) since they cannot be retrieved again.

---

## 21. Local Development

### Prerequisites

- Node.js >= 18
- MongoDB instance (local or Atlas free tier)
- AMS backend on port 3011 (for the internal feed — optional for isolated dev)
- Backblaze B2 credentials, or a local MinIO instance for fully offline development

### Setup Steps

1. Install dependencies

   cd salary-service && npm install

2. Generate crypto secrets and populate .env

   cp env.example .env
   node scripts/generateSecrets.js
   # Copy the three output lines (JWT_SECRET, ENCRYPTION_KEY, SERVICE_TOKEN) into .env
   # Then fill in MONGODB_URI, B2_*, AMS_INTERNAL_BASE_URL, ALLOWED_ORIGINS

3. Create the first Admin user

   node scripts/createAdminUser.js --email admin@example.com --password StrongPass1

4. Start with file watcher

   node --watch server.js
   # Listens on 127.0.0.1:3012 in development

### Dev vs Production Differences

| Setting | Development | Production |
|---------|-------------|------------|
| Cookie Secure | false | true |
| Cookie SameSite | lax | strict |
| Cookie domain | not set | .bylinelms.com |
| CORS | localhost 5173/5174/3000 auto-added | ALLOWED_ORIGINS only |
| Server bind | 127.0.0.1 | 0.0.0.0 |
| Static asset cache | no-cache | 1 year immutable |

### Running Alongside AMS Locally

Run each in a separate terminal:

  AMS backend:          cd backend            && node server.js       (port 3011)
  AMS frontend:         cd frontend           && npx vite              (port 5173)
  salary-service:       cd salary-service     && node --watch server.js (port 3012)
  payroll frontend:     cd salary-service-frontend && npx vite         (port 5174)

SERVICE_TOKEN must be identical in salary-service/.env and backend/.env.
AMS_INTERNAL_BASE_URL in salary-service/.env should be http://localhost:3011.

### Skipping the Route Audit in Dev

If you are mid-way through adding a new route without auth middleware yet:

  SKIP_ROUTE_AUDIT=true node --watch server.js
  # NEVER use SKIP_ROUTE_AUDIT in production

---

## 22. Secret Rotation

### JWT_SECRET

Impact: All existing sessions are immediately invalidated. All users must log in again.

Procedure:
1. Generate a new 128-char hex string (64 random bytes)
   Use: node scripts/generateSecrets.js  (JWT_SECRET line)
2. Replace JWT_SECRET in salary-service/.env
3. pm2 restart salary-service --update-env

### ENCRYPTION_KEY

WARNING — most sensitive rotation in this service.
Changing ENCRYPTION_KEY without migrating existing data makes every
EmployeeFinancialProfile with encrypted fields permanently unreadable.

Procedure:
1. Write a migration script that:
   a. Reads the current .env (OLD key)
   b. Loads all EmployeeFinancialProfile documents
   c. Decrypts bankAccountNumber, ifscCode, panNumber, uan with the OLD key
   d. Re-encrypts each field with the NEW key
   e. Saves all updated documents back to MongoDB
2. Test the migration against a staging database copy
3. Generate new 64-char hex key:  node scripts/generateSecrets.js  (ENCRYPTION_KEY line)
4. Run the migration script while OLD key is still in .env
5. Replace ENCRYPTION_KEY in .env with the new value
6. pm2 restart salary-service --update-env
7. Read back at least one profile to confirm decryption succeeds

### SERVICE_TOKEN

Impact: In-flight AMS feed calls fail during the restart window.
Schedule during off-peak hours.

Procedure:
1. Generate new 96-char hex token: node scripts/generateSecrets.js  (SERVICE_TOKEN line)
2. Update SERVICE_TOKEN in salary-service/.env
3. Update SERVICE_TOKEN in backend/.env — must be the SAME value in both files
4. pm2 restart attendance-backend --update-env
5. pm2 restart salary-service --update-env

### B2 Application Key

No data loss — the key is a credential, not data. All stored objects are unaffected.

Procedure:
1. Create a new Application Key in Backblaze dashboard
   (same bucket scope: byline-payroll-docs, same prefix: payroll/)
2. Update B2_KEY_ID and B2_APPLICATION_KEY in salary-service/.env
3. pm2 restart salary-service --update-env
4. Confirm the service can list and upload to B2 (check /health and try a folder list)
5. Delete the old key in Backblaze dashboard

---

## Summary

salary-service is a purpose-built, security-first microservice that manages the most
sensitive data in the Byline LMS platform: employee salary structures, bank details,
PAN/IFSC/UAN numbers, and monthly payroll runs. Its design directly addresses known
security findings from the AMS audit and enforces defence-in-depth at every layer.

| Design Decision | Rationale |
|-----------------|-----------|
| Separate process and database | AMS compromise cannot reach payroll data |
| Own HS256 JWT secret | No shared auth material with AMS |
| AES-256-GCM field-level encryption | Bank/PAN data safe if MongoDB is breached |
| No fallback secrets anywhere | Fixes AMS audit finding F-HIGH-002 structurally |
| Route audit at boot | Fixes AMS audit finding F-HIGH-003 structurally |
| Separate B2 bucket and credential | Leaked payroll key cannot reach HR/KYC docs |
| Read-only one-way AMS feed | No write path back to AMS, minimal attack surface |
| Token stored as SHA-256 hash only | Share tokens and refresh tokens safe under DB read |
| 10-minute presigned URL TTL | Short window limits forwarding exposure |
| PDF watermarking | Recipient identity embedded, deters casual redistribution |
| 28-action audit log | Full forensic trail for all sensitive operations |
| Process exit on missing env vars | Misconfigured deploy fails loudly, not silently |

For deployment procedures see DEPLOYMENT.md.
For environment variable reference see env.example.

---

_Last updated: August 2026 — generated from salary-service source code_
