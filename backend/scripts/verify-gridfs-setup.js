// backend/scripts/verify-gridfs-setup.js
// Verification script for GridFS policy system setup
// Checks: Database connection, GridFS bucket, Policy model, Routes

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const { getPolicyBucket } = require('../db');
const Policy = require('../models/Policy');
const fs = require('fs');
const path = require('path');

async function verifySetup() {
    console.log('🔍 GridFS Policy System Setup Verification');
    console.log('==========================================\n');
    
    const checks = {
        database: false,
        gridfs: false,
        model: false,
        middleware: false,
        routes: false
    };
    
    try {
        // 1. Check Database Connection
        console.log('1️⃣  Checking MongoDB connection...');
        await connectDB();
        checks.database = true;
        console.log('   ✅ MongoDB connected');
        console.log('   Database:', mongoose.connection.name);
        console.log('   Host:', mongoose.connection.host);
        
        // 2. Check GridFS Bucket
        console.log('\n2️⃣  Checking GridFS bucket...');
        try {
            const bucket = getPolicyBucket();
            checks.gridfs = true;
            console.log('   ✅ Policy bucket initialized');
            console.log('   Bucket name:', bucket.bucketName);
            
            // Check if collections exist
            const collections = await mongoose.connection.db.listCollections().toArray();
            const hasFilesCollection = collections.some(c => c.name === 'policyFiles.files');
            const hasChunksCollection = collections.some(c => c.name === 'policyFiles.chunks');
            
            if (hasFilesCollection || hasChunksCollection) {
                console.log('   ✅ GridFS collections exist');
                
                // Count files
                const fileCount = await mongoose.connection.db
                    .collection('policyFiles.files')
                    .countDocuments();
                console.log('   Files in GridFS:', fileCount);
            } else {
                console.log('   ℹ️  GridFS collections will be created on first upload');
            }
        } catch (error) {
            console.log('   ❌ Policy bucket error:', error.message);
        }
        
        // 3. Check Policy Model
        console.log('\n3️⃣  Checking Policy model...');
        try {
            const schema = Policy.schema;
            const hasFileId = schema.path('fileId') !== undefined;
            const hasFileName = schema.path('fileName') !== undefined;
            const hasFileSize = schema.path('fileSize') !== undefined;
            
            if (hasFileId && hasFileName) {
                checks.model = true;
                console.log('   ✅ Policy model has required fields');
                console.log('   Fields: fileId ✓, fileName ✓, fileSize', hasFileSize ? '✓' : '✗');
            } else {
                console.log('   ❌ Policy model missing required fields');
                console.log('   fileId:', hasFileId ? '✓' : '✗');
                console.log('   fileName:', hasFileName ? '✓' : '✗');
            }
            
            // Check existing policies
            const policyCount = await Policy.countDocuments();
            console.log('   Policies in database:', policyCount);
            
            if (policyCount > 0) {
                const withFileId = await Policy.countDocuments({ fileId: { $exists: true } });
                const withFileUrl = await Policy.countDocuments({ fileUrl: { $exists: true } });
                console.log('   - With fileId (GridFS):', withFileId);
                console.log('   - With fileUrl (filesystem):', withFileUrl);
                
                if (withFileUrl > withFileId) {
                    console.log('   ⚠️  Some policies need migration to GridFS');
                    console.log('   Run: node scripts/migrate-policies-to-gridfs.js');
                }
            }
        } catch (error) {
            console.log('   ❌ Policy model error:', error.message);
        }
        
        // 4. Check Middleware
        console.log('\n4️⃣  Checking middleware files...');
        const middlewarePath = path.join(__dirname, '../middleware/uploadPolicyGridFS.js');
        if (fs.existsSync(middlewarePath)) {
            checks.middleware = true;
            console.log('   ✅ uploadPolicyGridFS.js exists');
            
            // Check if it exports a function
            try {
                const middleware = require(middlewarePath);
                if (typeof middleware === 'function') {
                    console.log('   ✅ Middleware exports function');
                } else {
                    console.log('   ⚠️  Middleware does not export function');
                }
            } catch (error) {
                console.log('   ❌ Middleware load error:', error.message);
            }
        } else {
            console.log('   ❌ uploadPolicyGridFS.js not found');
        }
        
        // 5. Check Routes
        console.log('\n5️⃣  Checking route files...');
        const routesPath = path.join(__dirname, '../routes/policiesGridFS.js');
        if (fs.existsSync(routesPath)) {
            checks.routes = true;
            console.log('   ✅ policiesGridFS.js exists');
            
            // Check if server.js registers the routes
            const serverPath = path.join(__dirname, '../server.js');
            const serverContent = fs.readFileSync(serverPath, 'utf8');
            
            if (serverContent.includes('policies-gridfs')) {
                console.log('   ✅ Routes registered in server.js');
            } else {
                console.log('   ⚠️  Routes not registered in server.js');
                console.log('   Add: app.use(\'/api/policies-gridfs\', require(\'./routes/policiesGridFS\'));');
            }
        } else {
            console.log('   ❌ policiesGridFS.js not found');
        }
        
        // Summary
        console.log('\n📊 Verification Summary');
        console.log('======================');
        console.log('Database Connection:', checks.database ? '✅ PASS' : '❌ FAIL');
        console.log('GridFS Bucket:', checks.gridfs ? '✅ PASS' : '❌ FAIL');
        console.log('Policy Model:', checks.model ? '✅ PASS' : '❌ FAIL');
        console.log('Middleware:', checks.middleware ? '✅ PASS' : '❌ FAIL');
        console.log('Routes:', checks.routes ? '✅ PASS' : '❌ FAIL');
        
        const allPassed = Object.values(checks).every(c => c === true);
        
        if (allPassed) {
            console.log('\n🎉 All checks passed! System is ready.');
            console.log('\n📝 Next Steps:');
            console.log('1. Start server: npm start');
            console.log('2. Run tests: node scripts/test-gridfs-policy-system.js');
            console.log('3. Migrate existing policies: node scripts/migrate-policies-to-gridfs.js');
        } else {
            console.log('\n⚠️  Some checks failed. Review errors above.');
        }
        
        process.exit(allPassed ? 0 : 1);
        
    } catch (error) {
        console.error('\n❌ Verification failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run verification
verifySetup();
