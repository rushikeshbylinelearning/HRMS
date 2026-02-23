/**
 * MIGRATE TO OPTIMIZED ANALYTICS
 * 
 * This script:
 * 1. Creates required database indexes
 * 2. Backs up current analytics service
 * 3. Switches to optimized version
 * 4. Tests the new implementation
 * 
 * Run: node backend/scripts/migrate-to-optimized-analytics.js
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function migrateToOptimizedAnalytics() {
    try {
        console.log('🚀 Starting migration to optimized analytics...\n');
        
        // Step 1: Connect to MongoDB
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Step 2: Create indexes
        console.log('📊 Creating database indexes...');
        await createIndexes();
        console.log('✅ Indexes created\n');
        
        // Step 3: Backup current files
        console.log('💾 Backing up current files...');
        backupFiles();
        console.log('✅ Files backed up\n');
        
        // Step 4: Replace files
        console.log('🔄 Replacing with optimized versions...');
        replaceFiles();
        console.log('✅ Files replaced\n');
        
        // Step 5: Test the new implementation
        console.log('🧪 Testing optimized analytics...');
        await testOptimizedAnalytics();
        console.log('✅ Tests passed\n');
        
        console.log('🎉 Migration completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('1. Restart your server: npm restart');
        console.log('2. Test the analytics endpoint');
        console.log('3. Monitor performance logs');
        console.log('4. If issues occur, restore from backups in backend/backups/');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.log('\n⚠️  To rollback:');
        console.log('1. Restore files from backend/backups/');
        console.log('2. Restart your server');
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

async function createIndexes() {
    // AttendanceLog indexes
    await AttendanceLog.collection.createIndex(
        { user: 1, attendanceDate: 1 },
        { name: 'user_attendanceDate_compound', background: true }
    );
    console.log('  ✓ Created: AttendanceLog { user: 1, attendanceDate: 1 }');
    
    await AttendanceLog.collection.createIndex(
        { attendanceDate: 1 },
        { name: 'attendanceDate_index', background: true }
    );
    console.log('  ✓ Created: AttendanceLog { attendanceDate: 1 }');
    
    await AttendanceLog.collection.createIndex(
        { attendanceDate: 1, attendanceStatus: 1 },
        { name: 'attendanceDate_status_compound', background: true }
    );
    console.log('  ✓ Created: AttendanceLog { attendanceDate: 1, attendanceStatus: 1 }');
    
    // User indexes
    await User.collection.createIndex(
        { isActive: 1 },
        { name: 'isActive_index', background: true }
    );
    console.log('  ✓ Created: User { isActive: 1 }');
    
    await User.collection.createIndex(
        { department: 1, isActive: 1 },
        { name: 'department_isActive_compound', background: true }
    );
    console.log('  ✓ Created: User { department: 1, isActive: 1 }');
    
    await User.collection.createIndex(
        { role: 1, isActive: 1 },
        { name: 'role_isActive_compound', background: true }
    );
    console.log('  ✓ Created: User { role: 1, isActive: 1 }');
}

function backupFiles() {
    const backupDir = path.join(__dirname, '../backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Create backup directory
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Backup files
    const filesToBackup = [
        '../services/AnalyticsService.js',
        '../controllers/analyticsController.js'
    ];
    
    filesToBackup.forEach(file => {
        const sourcePath = path.join(__dirname, file);
        const fileName = path.basename(file);
        const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);
        
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, backupPath);
            console.log(`  ✓ Backed up: ${fileName}`);
        }
    });
}

function replaceFiles() {
    // Replace AnalyticsService
    const analyticsServiceSource = path.join(__dirname, '../services/AnalyticsService.optimized.js');
    const analyticsServiceDest = path.join(__dirname, '../services/AnalyticsService.js');
    
    if (fs.existsSync(analyticsServiceSource)) {
        fs.copyFileSync(analyticsServiceSource, analyticsServiceDest);
        console.log('  ✓ Replaced: AnalyticsService.js');
    }
    
    // Replace analyticsController
    const controllerSource = path.join(__dirname, '../controllers/analyticsController.optimized.js');
    const controllerDest = path.join(__dirname, '../controllers/analyticsController.js');
    
    if (fs.existsSync(controllerSource)) {
        fs.copyFileSync(controllerSource, controllerDest);
        console.log('  ✓ Replaced: analyticsController.js');
    }
}

async function testOptimizedAnalytics() {
    const AnalyticsService = require('../services/AnalyticsService.optimized');
    
    // Test with small date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days
    
    const filters = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        page: 1,
        limit: 10
    };
    
    console.log(`  Testing with date range: ${filters.startDate} to ${filters.endDate}`);
    
    const startTime = Date.now();
    const result = await AnalyticsService.calculateAttendanceMetrics(filters);
    const executionTime = Date.now() - startTime;
    
    console.log(`  ✓ Query executed in ${executionTime}ms`);
    console.log(`  ✓ Found ${result.pagination.totalRecords} employees`);
    console.log(`  ✓ Summary: ${result.summary.totalEmployees} total employees`);
    
    if (executionTime > 1000) {
        console.warn(`  ⚠️  Warning: Query took ${executionTime}ms (target: <1000ms)`);
        console.warn('     Consider adding more indexes or reducing date range');
    }
}

migrateToOptimizedAnalytics();
