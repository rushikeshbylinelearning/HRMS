/**
 * CREATE ANALYTICS INDEXES
 * 
 * Creates required indexes for optimal analytics query performance
 * 
 * Run: node backend/scripts/create-analytics-indexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function createAnalyticsIndexes() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        console.log('📊 Creating indexes for analytics optimization...\n');
        
        // AttendanceLog indexes
        console.log('Creating AttendanceLog indexes...');
        
        // Index 1: Compound index for date range queries by employee
        try {
            await AttendanceLog.collection.createIndex(
                { user: 1, attendanceDate: 1 },
                { 
                    name: 'user_attendanceDate_compound',
                    background: true 
                }
            );
            console.log('✅ Created: { user: 1, attendanceDate: 1 }');
        } catch (error) {
            if (error.code === 85) {
                console.log('ℹ️  Index { user: 1, attendanceDate: 1 } already exists');
            } else {
                throw error;
            }
        }
        
        // Index 2: Date range queries (for all employees)
        try {
            await AttendanceLog.collection.createIndex(
                { attendanceDate: 1 },
                { 
                    name: 'attendanceDate_index',
                    background: true 
                }
            );
            console.log('✅ Created: { attendanceDate: 1 }');
        } catch (error) {
            if (error.code === 85) {
                console.log('ℹ️  Index { attendanceDate: 1 } already exists');
            } else {
                throw error;
            }
        }
        
        // Index 3: Status filtering with date
        try {
            await AttendanceLog.collection.createIndex(
                { attendanceDate: 1, attendanceStatus: 1 },
                { 
                    name: 'attendanceDate_status_compound',
                    background: true 
                }
            );
            console.log('✅ Created: { attendanceDate: 1, attendanceStatus: 1 }');
        } catch (error) {
            if (error.code === 85) {
                console.log('ℹ️  Index { attendanceDate: 1, attendanceStatus: 1 } already exists');
            } else {
                throw error;
            }
        }
        
        // User indexes
        console.log('\nCreating User indexes...');
        
        // Index 4: Active users filter
        try {
            await User.collection.createIndex(
                { isActive: 1 },
                { 
                    name: 'isActive_index',
                    background: true 
                }
            );
            console.log('✅ Created: { isActive: 1 }');
        } catch (error) {
            if (error.code === 85) {
                console.log('ℹ️  Index { isActive: 1 } already exists');
            } else {
                throw error;
            }
        }
        
        // Index 5: Department filtering
        try {
            await User.collection.createIndex(
                { department: 1, isActive: 1 },
                { 
                    name: 'department_isActive_compound',
                    background: true 
                }
            );
            console.log('✅ Created: { department: 1, isActive: 1 }');
        } catch (error) {
            if (error.code === 85) {
                console.log('ℹ️  Index { department: 1, isActive: 1 } already exists');
            } else {
                throw error;
            }
        }
        
        // Index 6: Role filtering (exclude Admin)
        try {
            await User.collection.createIndex(
                { role: 1, isActive: 1 },
                { 
                    name: 'role_isActive_compound',
                    background: true 
                }
            );
            console.log('✅ Created: { role: 1, isActive: 1 }');
        } catch (error) {
            if (error.code === 85) {
                console.log('ℹ️  Index { role: 1, isActive: 1 } already exists');
            } else {
                throw error;
            }
        }
        
        // List all indexes
        console.log('\n📋 Current AttendanceLog indexes:');
        const attendanceIndexes = await AttendanceLog.collection.indexes();
        attendanceIndexes.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
        
        console.log('\n📋 Current User indexes:');
        const userIndexes = await User.collection.indexes();
        userIndexes.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
        
        console.log('\n✅ All indexes created successfully!');
        console.log('\n💡 Analytics queries should now be significantly faster.');
        
    } catch (error) {
        console.error('❌ Error creating indexes:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

createAnalyticsIndexes();
