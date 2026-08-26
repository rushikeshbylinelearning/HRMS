# salary-service — Deployment & Operations Runbook

## Prerequisites

- Node.js ≥ 18 on the server
- PM2 installed globally (`npm install -g pm2`)
- MongoDB Atlas cluster (same cluster as AMS is fine, **different database**)
- Backblaze B2 account with a dedicated payroll bucket
- `payroll.bylinelms.com` subdomain pointed at the server

---

## 1. First-time server setup

### 1a. Create the deploy directory

```bash
mkdir -p /home/bylinelm/payroll.bylinelms.com/salary-service
```

### 1b. Generate secrets (run locally, never on the server)

```bash
node salary-service/scripts/generateSecrets.js
```

Copy the three output values. You will paste them into `.env` in the next step.

### 1c. Create `.env` on the server (via SSH or cPanel file manager)

```bash
nano /home/bylinelm/payroll.bylinelms.com/salary-service/.env
```

Paste and fill in **every** value from `env.example`. The required fields are:

| Variable | How to get it |
|---|---|
| `JWT_SECRET` | Output of `generateSecrets.js` |
| `ENCRYPTION_KEY` | Output of `generateSecrets.js` |
| `SERVICE_TOKEN` | Output of `generateSecrets.js` — **paste the same value into AMS `.env` as `SERVICE_TOKEN`** |
| `MONGODB_URI` | Atlas → Connect → point to `salary-service-db` (different database name from AMS) |
| `B2_KEY_ID` / `B2_APPLICATION_KEY` | Backblaze → App Keys → create key scoped to payroll bucket only |
| `B2_BUCKET_NAME` | e.g. `byline-payroll-docs` |
| `B2_ENDPOINT` | e.g. `s3.us-east-005.backblazeb2.com` |
| `AMS_INTERNAL_BASE_URL` | Internal URL of AMS (e.g. `http://127.0.0.1:3011`) |
| `ALLOWED_ORIGINS` | `https://payroll.bylinelms.com` |

The process **will refuse to start** if any of these are missing. There are no fallback values.

### 1d. Update AMS `.env`

Add the `SERVICE_TOKEN` from step 1b to AMS's `.env`:

```
SERVICE_TOKEN=<same 96-char hex value you set in salary-service .env>
```

Then restart AMS so it picks up the new variable:

```bash
pm2 restart attendance-backend --update-env
```

---

## 2. B2 bucket setup

1. Create a **new** bucket in Backblaze: `byline-payroll-docs` — set to **Private**
2. Create a new Application Key:
   - Allowed bucket: `byline-payroll-docs` only
   - Allowed path prefix: `payroll/` (optional but recommended)
   - Capabilities: `readFiles`, `writeFiles`, `deleteFiles`, `listFiles`, `listBuckets`
3. Store `keyID` → `B2_KEY_ID`, `applicationKey` → `B2_APPLICATION_KEY`

> **Why a separate key?** A leaked payroll credential cannot reach KYC or HR documents stored in AMS's separate bucket.

---

## 3. Initial deploy (manual, first time)

```bash
# On your local machine — deploy salary-service code
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'logs/' \
  salary-service/ \
  user@server:/home/bylinelm/payroll.bylinelms.com/salary-service/

# On the server
cd /home/bylinelm/payroll.bylinelms.com/salary-service
npm ci --omit=dev

# Start with --env production — NEVER omit this flag
pm2 start ecosystem.config.js --only salary-service --env production
pm2 save
```

> **Why `--env production` matters:** The default `env` block sets `NODE_ENV=development`.
> This is the same issue found in the AMS audit. The `env_production` block sets
> `NODE_ENV=production`. Always use `--env production` on the server.

---

## 4. Create the first Admin user

```bash
cd /home/bylinelm/payroll.bylinelms.com/salary-service
node scripts/createAdminUser.js --email admin@bylinelms.com --password "YourStr0ngP@ss"
```

This creates one `Admin`-role user in salary-service's own database.
This account is **completely separate** from AMS — an AMS admin gets no access here
unless you explicitly create them an account with this command.

---

## 5. Reverse proxy config

### nginx (recommended)

```nginx
# payroll.bylinelms.com → salary-service
server {
    listen 443 ssl http2;
    server_name payroll.bylinelms.com;

    # SSL config (certbot/Let's Encrypt)
    ssl_certificate     /etc/letsencrypt/live/payroll.bylinelms.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/payroll.bylinelms.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3012;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# AMS internal feed: restrict /internal/ to salary-service's own IP only
# This is the belt-and-suspenders layer on top of the SERVICE_TOKEN check.
# Add this block to the AMS server block (workflow.bylinelms.com):
#
# location /internal/ {
#     # Allow only the salary-service process (same server = loopback, or specific IP)
#     allow 127.0.0.1;
#     # If salary-service is on a separate server, replace with its IP:
#     # allow <salary-service-server-ip>;
#     deny all;
#     proxy_pass http://127.0.0.1:3011;
#     proxy_set_header X-Real-IP $remote_addr;
# }
```

### Apache / .htaccess (A2 Hosting)

If using A2's cPanel with Apache, add to the AMS `.htaccess`:

```apache
# Block /internal/ from public internet — only allow loopback / salary-service IP
<LocationMatch "^/internal/">
    Order Deny,Allow
    Deny from all
    Allow from 127.0.0.1
    # Allow from <salary-service-server-ip>
</LocationMatch>
```

---

## 6. Ongoing deployments (CI/CD)

The GitHub Actions workflow (`.github/workflows/testing.yml`) handles this automatically on push to `master`:

1. Rsyncs salary-service code (excluding `.env` and `node_modules`)
2. Runs `npm ci --omit=dev` on the server
3. Runs `pm2 restart salary-service --update-env`

The `.env` file on the server is **never touched by CI** — it stays in place between deploys.

---

## 7. PM2 management

```bash
# Status
pm2 list

# Logs
pm2 logs salary-service --lines 100

# Restart
pm2 restart salary-service --update-env

# Start fresh (if not already in PM2)
pm2 start ecosystem.config.js --only salary-service --env production

# Stop
pm2 stop salary-service

# Save process list so it survives server reboot
pm2 save
pm2 startup   # follow the printed instructions once
```

---

## 8. Rotating secrets

### JWT_SECRET
1. Generate new: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. Update `.env` on the server
3. `pm2 restart salary-service --update-env`
4. All active sessions will be invalidated — users must log in again. This is expected.

### ENCRYPTION_KEY
⚠️ **Critical** — rotating this key requires re-encrypting all existing `EmployeeFinancialProfile` sensitive fields first. Do not rotate without a migration script. Steps:
1. Write a one-off script that reads all profiles, decrypts with the old key, re-encrypts with the new key
2. Update `.env` with the new key
3. Run the migration script before restarting
4. Restart `pm2 restart salary-service --update-env`

### SERVICE_TOKEN
1. Generate new: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
2. Update `SERVICE_TOKEN` in **both** AMS `.env` and salary-service `.env`
3. Restart both services:
   ```bash
   pm2 restart attendance-backend --update-env
   pm2 restart salary-service --update-env
   ```

---

## 9. MongoDB indexes

Indexes are defined in each model schema and created automatically by Mongoose on first connection. No manual `createIndex` commands required.

TTL indexes (auto-delete expired records):
- `RefreshToken.expiresAt` — removes expired refresh tokens automatically
- `LinkShare.expiresAt` — removes expired share links automatically

---

## 10. Health check

```bash
curl https://payroll.bylinelms.com/health
# Expected: {"status":"ok"}
# If DB is down: {"status":"unhealthy"} with HTTP 503
```

Add this to your uptime monitoring (UptimeRobot, Better Uptime, etc.).

---

## 11. Security checklist before go-live

- [ ] All required `.env` vars set — `node scripts/generateSecrets.js` values used
- [ ] `B2_APPLICATION_KEY` scoped to payroll bucket only in Backblaze dashboard
- [ ] `SERVICE_TOKEN` set identically in both AMS and salary-service `.env`
- [ ] `/internal/` route blocked at nginx/Apache level to loopback/salary-service IP only
- [ ] PM2 started with `--env production` (not default `env` block)
- [ ] `MONGODB_URI` points to a **different** database name than AMS
- [ ] SSL certificate installed for `payroll.bylinelms.com`
- [ ] First Admin user created via `createAdminUser.js`, script invocation removed
- [ ] `npm audit` shows 0 vulnerabilities (run `npm audit --audit-level=moderate` in salary-service/)
- [ ] Uptime monitor configured on `/health`
- [ ] B2 bucket set to **Private** (no public access)
