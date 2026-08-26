# salary-service

Standalone payroll & salary slip microservice for Byline LMS.  
Separate deployable — own database, own auth, own B2 bucket.

## Why separate from AMS

Payroll/bank data is the most sensitive data class in the system. Isolating it here means:
- A compromise of AMS does not automatically expose salary or banking data
- The AMS encryption-key bug (F-HIGH-002) structurally cannot recur here — process exits on missing key
- Independent deployment, scaling, and audit surface

## Architecture

```
AMS backend  ──(SERVICE_TOKEN)──►  salary-service  ──(B2 API)──►  Backblaze B2
                                        │                           (isolated bucket)
                                        │
                                   /share/:token  (public, unauthenticated, for CAs etc.)
```

## Quick start

```bash
cd salary-service
cp env.example .env
# Fill in all required values — see env.example comments
npm install
node server.js
```

The service **refuses to start** if any required env var is missing. There are no fallback secrets anywhere in this codebase.

## Environment variables

See `env.example` for the full list with descriptions.  
All vars marked "required" will cause an immediate `process.exit(1)` if absent.

Key vars:
| Variable | Purpose |
|---|---|
| `JWT_SECRET` | HS256 signing key — generate with `crypto.randomBytes(64).toString('hex')` |
| `ENCRYPTION_KEY` | AES-256-GCM key for sensitive fields — `crypto.randomBytes(32).toString('hex')` |
| `SERVICE_TOKEN` | Shared secret with AMS internal feed — same value in both `.env` files |
| `MONGODB_URI` | Must point to a **different** database from AMS |
| `B2_*` | Backblaze B2 credentials scoped to the payroll bucket **only** |

## PM2 deployment

```bash
# Always use --env production — never the default block (runs NODE_ENV=development)
pm2 start ecosystem.config.js --only salary-service --env production
```

## API overview

### Auth (own identity system — no AMS tokens accepted)
| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/login` | Public (rate-limited: 5/15min) |
| POST | `/api/auth/refresh` | Cookie (rate-limited) |
| POST | `/api/auth/logout` | Optional |
| GET | `/api/auth/me` | Bearer token |

### User management (Admin only)
| Method | Path |
|---|---|
| GET/POST | `/api/users` |
| PATCH | `/api/users/:id` |
| POST | `/api/users/:id/reset-password` |

### Financial profiles (encrypted at rest)
| Method | Path | Roles |
|---|---|---|
| GET | `/api/financial-profiles` | Admin, PayrollOfficer |
| POST/PUT | `/api/financial-profiles` | Admin, PayrollOfficer |

### Payroll runs
| Method | Path | Roles |
|---|---|---|
| GET | `/api/payroll-runs` | Admin, PayrollOfficer |
| POST | `/api/payroll-runs` | Admin |
| POST | `/api/payroll-runs/:id/generate` | Admin |
| POST | `/api/payroll-runs/:id/finalize` | Admin |
| POST | `/api/payroll-runs/:id/mark-paid` | Admin |

### Salary slips
`GET /api/salary-slips` — list/filter  
`GET /api/salary-slips/:id/view` — inline presigned URL  
`GET /api/salary-slips/:id/download` — download presigned URL

### Timed external sharing links
`POST /api/links` — create link (expiry, permission, recipient label)  
`POST /api/links/:id/revoke` — kill link early  
`GET /share/:token` — **public** redemption endpoint (for CAs, auditors)

**Important:** `view` permission is a UX convention, not DRM. PDFs are watermarked with recipient identity as the practical deterrent.

### B2 folder panel
`GET /api/folders?prefix=` — browse  
`POST /api/folders` — create folder (zero-byte marker)  
`DELETE /api/folders` — recursive delete (irreversible — confirm in UI)  
`POST /api/folders/upload` — upload PDF into folder  
`POST /api/folders/rename` — move file (copy + delete)

### Audit logs (Admin only)
`GET /api/audit-logs` — paginated, filterable by action/subject/date range

## AMS integration

AMS exposes a read-only internal feed that salary-service calls at payroll-run time:

```
GET /internal/payroll-feed/:employeeId?month=M&year=YYYY
Header: X-Service-Token: <SERVICE_TOKEN>
```

Returns present days, leave days, LOP days, overtime hours — nothing else.  
This route is in `backend/routes/internal/payrollFeed.js`.  
Restrict it at the nginx/Apache level to salary-service's server IP.

## Security guardrails

- No `|| 'fallback'` pattern for any crypto key — process exits on missing key (envValidator.js)
- Route audit at startup: exits if any route lacks auth middleware (routeAudit.js)
- Refresh token rotation is atomic (`findOneAndUpdate` with `revoked: false` filter)
- Sensitive fields (bank account, PAN, IFSC, UAN) encrypted with AES-256-GCM
- B2 application key scoped to payroll bucket/prefix only
- Login rate-limited: 5 attempts / 15 min per IP+email
- All share link redemptions logged with IP + user agent
