'use strict';
// server.js — salary-service entry point
//
// Boot order:
//   1. Set TZ
//   2. Load .env
//   3. Validate required env vars (throws + exits if any missing — no fallbacks)
//   4. Connect to MongoDB
//   5. Register Express middleware
//   6. Mount routes
//   7. Run route audit (exits if any route lacks auth middleware)
//   8. Listen

process.env.TZ = process.env.TZ || 'Asia/Kolkata';

require('dotenv').config();

const { validateAndExit } = require('./utils/envValidator');
validateAndExit(); // ← exits immediately if JWT_SECRET, ENCRYPTION_KEY, etc. are missing

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const cookieParser = require('cookie-parser');
const mongoose     = require('mongoose');

const connectDB        = require('./db');
const { requestLogger } = require('./utils/logger');
const errorHandler     = require('./middleware/errorHandler');
const { auditRoutes }  = require('./utils/routeAudit');

// ─── Route imports ─────────────────────────────────────────────────────────────
const authRoutes             = require('./routes/auth');
const userRoutes             = require('./routes/users');
const financialProfileRoutes = require('./routes/financialProfiles');
const payrollSettingsRoutes  = require('./routes/payrollSettings');
const payrollRunRoutes       = require('./routes/payrollRuns');
const salarySlipRoutes       = require('./routes/salarySlips');
const linkRoutes             = require('./routes/links');
const shareRoutes            = require('./routes/share');
const folderRoutes           = require('./routes/folders');
const auditLogRoutes         = require('./routes/auditLogs');

// ─── Pre-load models ───────────────────────────────────────────────────────────
require('./models/User');
require('./models/RefreshToken');
require('./models/EmployeeFinancialProfile');
require('./models/PayrollSettings');
require('./models/PayrollRun');
require('./models/SalarySlip');
require('./models/LinkShare');
require('./models/AuditLog');

// ─── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

// In development allow localhost origins automatically
if (process.env.NODE_ENV !== 'production') {
    ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'].forEach(o => {
        if (!ALLOWED_ORIGINS.includes(o)) ALLOWED_ORIGINS.push(o);
    });
}

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        // Return 403, not a thrown Error that becomes a 500
        const err = new Error(`CORS: origin ${origin} not allowed`);
        err.status = 403;
        callback(err);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Token'],
};

// ─── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1); // needed for req.ip behind nginx/A2 reverse proxy

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'"],
            styleSrc:    ["'self'", "'unsafe-inline'"],
            imgSrc:      ["'self'", 'data:'],
            connectSrc:  ["'self'"],
            frameAncestors: ["'none'"], // salary slips must not be iframed by arbitrary sites
        },
    },
}));

app.use(compression({ level: 6, threshold: 1024 }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // pre-flight
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(requestLogger);

// ─── Health check ──────────────────────────────────────────────────────────────
// Minimal — no DB internals, no version info exposed
app.get('/health', (req, res) => {
    const dbOk = mongoose.connection.readyState === 1;
    res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ok' : 'unhealthy' });
});

// ─── Public routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/share',     shareRoutes); // unauthenticated — token is the credential

// ─── Protected API routes ──────────────────────────────────────────────────────
app.use('/api/users',               userRoutes);
app.use('/api/financial-profiles',  financialProfileRoutes);
app.use('/api/payroll-settings',    payrollSettingsRoutes);
app.use('/api/payroll-runs',        payrollRunRoutes);
app.use('/api/salary-slips',        salarySlipRoutes);
app.use('/api/links',               linkRoutes);
app.use('/api/folders',             folderRoutes);
app.use('/api/audit-logs',          auditLogRoutes);

// ─── Serve built salary-service frontend ──────────────────────────────────────
// In production, salary-service serves its own React app from public/
// (built from salary-service-frontend/ by CI and rsynced here).
// In development the Vite dev server runs separately on port 5174.
const fs = require('fs');
const FRONTEND_DIR = process.env.FRONTEND_DIST_PATH
  ? require('path').resolve(__dirname, process.env.FRONTEND_DIST_PATH)
  : require('path').join(__dirname, 'public');

if (fs.existsSync(require('path').join(FRONTEND_DIR, 'index.html'))) {
  app.use(express.static(FRONTEND_DIR, {
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : 0,
    etag:   true,
    setHeaders: (res, filepath) => {
      if (filepath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));

  // SPA fallback — all non-API routes serve index.html
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/share')) return next();
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(require('path').join(FRONTEND_DIR, 'index.html'), err => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Frontend unavailable' });
    });
  });
}

// ─── 404 for unmatched /api routes ────────────────────────────────────────────
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found', path: req.path });
});

// ─── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Boot ──────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3012', 10);

async function start() {
    try {
        await connectDB();

        // ── Month-end auto-generation scheduler ─────────────────────────────────
        // Must run after DB connect so the job can write to MongoDB.
        // Never fires before the DB is ready.
        const { startMonthEndScheduler } = require('./services/monthEndScheduler');
        startMonthEndScheduler();

        // Route audit — exits process if any route lacks auth middleware
        // In test environments you may pass exitOnFailure: false
        auditRoutes(app, process.env.SKIP_ROUTE_AUDIT !== 'true');

        const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
        app.listen(PORT, HOST, () => {
            console.log(`🚀 salary-service running on ${HOST}:${PORT} (${process.env.NODE_ENV || 'development'})`);
        });
    } catch (err) {
        console.error('❌ salary-service startup failed:', err.message);
        console.error(err.stack);
        setTimeout(() => process.exit(1), 500);
    }
}

start();
