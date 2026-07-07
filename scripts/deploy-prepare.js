#!/usr/bin/env node
/**
 * Deployment Preparation Script
 * Prepares the application for A2 Hosting deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting deployment preparation...\n');

// Check if we're in the right directory
const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);

console.log('📦 Current directory:', process.cwd());

// Step 1: Clean previous builds
console.log('\n🧹 Cleaning previous builds...');
try {
    if (fs.existsSync('frontend/dist')) {
        console.log('   - Removing old frontend/dist');
        fs.rmSync('frontend/dist', { recursive: true, force: true });
    }
    console.log('✅ Cleanup complete');
} catch (error) {
    console.error('⚠️  Warning: Could not clean previous builds:', error.message);
}

// Step 2: Install/update frontend dependencies
console.log('\n📥 Installing frontend dependencies...');
try {
    process.chdir('frontend');
    console.log('   - Running npm install...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Frontend dependencies installed');
} catch (error) {
    console.error('❌ Error installing frontend dependencies:', error.message);
    process.exit(1);
}

// Step 3: Build frontend for production
console.log('\n🏗️  Building frontend for production...');
try {
    console.log('   - Running production build...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Frontend build complete');
} catch (error) {
    console.error('❌ Error building frontend:', error.message);
    process.exit(1);
}

// Return to root directory
process.chdir(rootDir);

// Step 4: Verify dist directory
console.log('\n🔍 Verifying build output...');
const distPath = path.join(rootDir, 'frontend', 'dist');
if (!fs.existsSync(distPath)) {
    console.error('❌ Error: frontend/dist directory not found!');
    process.exit(1);
}

const indexPath = path.join(distPath, 'index.html');
if (!fs.existsSync(indexPath)) {
    console.error('❌ Error: frontend/dist/index.html not found!');
    process.exit(1);
}

console.log('✅ Build output verified');

// Step 5: Check backend dependencies
console.log('\n📥 Checking backend dependencies...');
try {
    process.chdir('backend');
    
    // Check if node_modules exists
    if (!fs.existsSync('node_modules')) {
        console.log('   - Installing backend dependencies...');
        execSync('npm install --production', { stdio: 'inherit' });
    } else {
        console.log('   - Backend dependencies already installed');
    }
    
    console.log('✅ Backend dependencies ready');
} catch (error) {
    console.error('❌ Error with backend dependencies:', error.message);
    process.exit(1);
}

// Return to root
process.chdir(rootDir);

// Step 6: Generate deployment checklist
console.log('\n📋 Generating deployment checklist...');
const checklist = `
DEPLOYMENT CHECKLIST
====================
Generated: ${new Date().toISOString()}

✅ Pre-deployment Steps Completed:
  ✓ Frontend built successfully
  ✓ Backend dependencies verified
  ✓ Build output verified

📦 Next Steps for A2 Hosting Deployment:

1. ENVIRONMENT VARIABLES
   Set these in your A2 hosting control panel (Node.js app settings):
   
   Required:
   - NODE_ENV=production
   - PORT=3011 (or your preferred port)
   - MONGODB_URI=<your-mongodb-connection-string>
   - JWT_SECRET=<your-secure-jwt-secret>
   
   Optional:
   - FRONTEND_URL=<your-production-domain>
   - SESSION_SECRET=<your-session-secret>
   - MAIL_* (for email features)
   - SSO_* (for SSO features)

2. UPLOAD FILES
   - Zip the 'backend' folder
   - Upload and extract to your A2 hosting directory
   - Ensure 'frontend/dist' folder is inside the extracted backend folder

3. INSTALL DEPENDENCIES ON SERVER
   In your A2 hosting SSH terminal:
   $ cd backend
   $ npm install --production
   
4. CREATE REQUIRED DIRECTORIES
   $ mkdir -p uploads/avatars
   $ mkdir -p public/reports
   $ mkdir -p logs

5. SET PERMISSIONS
   $ chmod 755 uploads
   $ chmod 755 public

6. START THE APPLICATION
   Through A2 Hosting Node.js App Manager or via SSH:
   $ cd backend
   $ node server.js
   
   Or use PM2 (recommended):
   $ pm2 start server.js --name "attendance-system"
   $ pm2 save
   $ pm2 startup

7. VERIFY DEPLOYMENT
   - Visit your domain
   - Check health endpoint: https://yourdomain.com/health
   - Test login functionality
   - Verify all features work correctly

📝 Important Notes:
   - DO NOT commit .env files to git
   - Set all environment variables in A2 hosting panel
   - Keep your MongoDB connection string secure
   - Enable HTTPS for production (A2 provides free SSL)
   - Monitor logs regularly: backend/logs/

🔒 Security Reminders:
   - Change default JWT_SECRET
   - Use strong SESSION_SECRET
   - Keep MongoDB credentials secure
   - Enable MongoDB IP whitelist
   - Review CORS settings in backend/config/security.js

📊 Performance Tips:
   - Use PM2 for process management
   - Enable compression (already configured)
   - Monitor memory usage
   - Set up log rotation
   - Consider using Redis for caching (optional)

For more information, see DEPLOYMENT.md
`;

fs.writeFileSync('DEPLOYMENT_CHECKLIST.txt', checklist);
console.log('✅ Deployment checklist created: DEPLOYMENT_CHECKLIST.txt');

// Step 7: Display summary
console.log('\n' + '='.repeat(60));
console.log('✅ DEPLOYMENT PREPARATION COMPLETE!');
console.log('='.repeat(60));
console.log('\n📦 Files ready for deployment:');
console.log('   - backend/ (with node_modules)');
console.log('   - frontend/dist/ (production build)');
console.log('\n📋 Next steps:');
console.log('   1. Read DEPLOYMENT_CHECKLIST.txt');
console.log('   2. Set environment variables in A2 hosting');
console.log('   3. Upload and extract files');
console.log('   4. Run deployment script on server');
console.log('\n🎉 Happy deploying!\n');


