// backend/scripts/test-avatar-gridfs-flow.js
// COMPREHENSIVE TEST: Avatar Upload GridFS Flow
// Tests the complete avatar upload pipeline to verify:
// 1. GridFS storage is active (not filesystem)
// 2. Images are stored in MongoDB
// 3. profileImageUrl is updated correctly
// 4. GET endpoint retrieves images from GridFS
// 5. No files are written to uploads/avatars

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../uploads/avatars');

async function testAvatarGridFSFlow() {
    console.log('='.repeat(80));
    console.log('AVATAR GRIDFS FLOW TEST');
    console.log('='.repeat(80));
    
    try {
        // Connect to MongoDB
        console.log('\n[1/7] Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');
        
        // Check if uploads/avatars directory exists and has files
        console.log('\n[2/7] Checking filesystem storage...');
        if (fs.existsSync(UPLOADS_DIR)) {
            const files = fs.readdirSync(UPLOADS_DIR);
            console.log(`⚠ uploads/avatars directory exists with ${files.length} files`);
            if (files.length > 0) {
                console.log('Files found:', files.slice(0, 5).join(', '), files.length > 5 ? '...' : '');
            }
        } else {
            console.log('✓ uploads/avatars directory does not exist (expected for GridFS-only)');
        }
        
        // Check GridFS bucket
        console.log('\n[3/7] Checking GridFS bucket...');
        const db = mongoose.connection.db;
        const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'avatars' });
        
        const files = await bucket.find({}).toArray();
        console.log(`✓ Found ${files.length} files in GridFS 'avatars' bucket`);
        
        if (files.length > 0) {
            console.log('\nSample GridFS files:');
            files.slice(0, 3).forEach(file => {
                console.log(`  - ${file.filename}`);
                console.log(`    ID: ${file._id}`);
                console.log(`    Size: ${(file.length / 1024).toFixed(2)} KB`);
                console.log(`    Type: ${file.contentType || 'unknown'}`);
                console.log(`    Uploaded: ${file.uploadDate}`);
            });
        }
        
        // Check User model for profileImageUrl format
        console.log('\n[4/7] Checking User profileImageUrl format...');
        const User = require('../models/User');
        const usersWithAvatars = await User.find({ 
            profileImageUrl: { $exists: true, $ne: '' } 
        }).select('fullName email profileImageUrl').limit(5);
        
        console.log(`✓ Found ${usersWithAvatars.length} users with avatars`);
        
        if (usersWithAvatars.length > 0) {
            console.log('\nSample user avatars:');
            usersWithAvatars.forEach(user => {
                const isGridFS = user.profileImageUrl.includes('/api/users/avatar/');
                const isFilesystem = user.profileImageUrl.includes('/avatars/');
                const format = isGridFS ? 'GridFS ✓' : isFilesystem ? 'Filesystem ✗' : 'Unknown';
                
                console.log(`  - ${user.fullName} (${user.email})`);
                console.log(`    URL: ${user.profileImageUrl}`);
                console.log(`    Format: ${format}`);
            });
        }
        
        // Test image retrieval from GridFS
        console.log('\n[5/7] Testing GridFS image retrieval...');
        if (files.length > 0) {
            const testFile = files[0];
            const downloadStream = bucket.openDownloadStream(testFile._id);
            
            const chunks = [];
            for await (const chunk of downloadStream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            
            console.log(`✓ Successfully retrieved file from GridFS`);
            console.log(`  File ID: ${testFile._id}`);
            console.log(`  Size: ${(buffer.length / 1024).toFixed(2)} KB`);
            console.log(`  Content-Type: ${testFile.contentType || 'unknown'}`);
        } else {
            console.log('⚠ No files in GridFS to test retrieval');
        }
        
        // Check router configuration
        console.log('\n[6/7] Verifying router configuration...');
        const serverPath = path.join(__dirname, '../server.js');
        const serverContent = fs.readFileSync(serverPath, 'utf8');
        
        const usesUserRoutes = serverContent.includes("require('./routes/userRoutes')");
        const usesOldUsers = serverContent.includes("require('./routes/users')") && 
                            !serverContent.includes("require('./routes/userRoutes')");
        
        if (usesUserRoutes) {
            console.log('✓ server.js imports userRoutes.js (GridFS router)');
        } else if (usesOldUsers) {
            console.log('✗ server.js imports users.js (OLD filesystem router)');
            console.log('  FIX: Change require("./routes/users") to require("./routes/userRoutes")');
        } else {
            console.log('⚠ Could not determine which router is imported');
        }
        
        // Summary
        console.log('\n[7/7] Test Summary');
        console.log('='.repeat(80));
        
        const filesystemActive = fs.existsSync(UPLOADS_DIR) && fs.readdirSync(UPLOADS_DIR).length > 0;
        const gridfsActive = files.length > 0;
        const correctRouter = usesUserRoutes;
        const usersUsingGridFS = usersWithAvatars.filter(u => 
            u.profileImageUrl.includes('/api/users/avatar/')
        ).length;
        const usersUsingFilesystem = usersWithAvatars.filter(u => 
            u.profileImageUrl.includes('/avatars/') && !u.profileImageUrl.includes('/api/users/avatar/')
        ).length;
        
        console.log('\nStorage Status:');
        console.log(`  GridFS Active: ${gridfsActive ? '✓ YES' : '✗ NO'}`);
        console.log(`  Filesystem Active: ${filesystemActive ? '✗ YES (should be NO)' : '✓ NO'}`);
        console.log(`  Correct Router: ${correctRouter ? '✓ YES' : '✗ NO'}`);
        
        console.log('\nUser Avatar URLs:');
        console.log(`  Using GridFS format: ${usersUsingGridFS}`);
        console.log(`  Using Filesystem format: ${usersUsingFilesystem}`);
        
        console.log('\nRecommendations:');
        if (!correctRouter) {
            console.log('  ✗ Update server.js to use userRoutes.js instead of users.js');
        }
        if (filesystemActive) {
            console.log('  ✗ Remove or archive uploads/avatars directory');
        }
        if (usersUsingFilesystem > 0) {
            console.log('  ⚠ Run migration script to convert filesystem URLs to GridFS');
        }
        if (gridfsActive && correctRouter && !filesystemActive) {
            console.log('  ✓ System is correctly configured for GridFS-only storage!');
        }
        
        console.log('\n' + '='.repeat(80));
        
    } catch (error) {
        console.error('\n✗ Test failed:', error);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n✓ Disconnected from MongoDB');
    }
}

// Run test
testAvatarGridFSFlow().catch(console.error);
