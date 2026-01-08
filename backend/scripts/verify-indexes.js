/**
 * DATABASE INDEX VERIFICATION SCRIPT
 * 
 * Verifies that all required indexes exist for optimal performance.
 * Only adds missing indexes - does not add speculative ones.
 * 
 * REQUIRED INDEXES:
 * - AttendanceLog: { user: 1, attendanceDate: 1 } (unique)
 * - AttendanceLog: { user: 1, attendanceDate: 1, attendanceStatus: 1 }
 * - LeaveRequest: { employee: 1, leaveDates: 1, status: 1 }
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models to ensure they're registered
const AttendanceLog = require('../models/AttendanceLog');
const LeaveRequest = require('../models/LeaveRequest');

async function verifyAndCreateIndexes() {
    try {
        console.log('🔍 Verifying database indexes...');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get database collections
        const db = mongoose.connection.db;
        const attendanceCollection = db.collection('attendancelogs');
        const leaveCollection = db.collection('leaverequests');
        
        // Verify AttendanceLog indexes
        console.log('\n📋 Checking AttendanceLog indexes...');
        const attendanceIndexes = await attendanceCollection.indexes();
        
        console.log('Current AttendanceLog indexes:');
        attendanceIndexes.forEach(index => {
            console.log(`  - ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''}`);
        });
        
        // Check for required indexes
        const hasUserDateIndex = attendanceIndexes.some(index => 
            index.key.user === 1 && 
            index.key.attendanceDate === 1 && 
            Object.keys(index.key).length === 2 &&
            index.unique
        );
        
        const hasUserDateStatusIndex = attendanceIndexes.some(index =>
            index.key.user === 1 && 
            index.key.attendanceDate === 1 && 
            index.key.attendanceStatus === 1 &&
            Object.keys(index.key).length === 3
        );
        
        // Create missing AttendanceLog indexes
        if (!hasUserDateIndex) {
            console.log('⚠️  Missing unique index on { user: 1, attendanceDate: 1 }');
            try {
                await attendanceCollection.createIndex(
                    { user: 1, attendanceDate: 1 }, 
                    { unique: true, background: true }
                );
                console.log('✅ Created unique index on { user: 1, attendanceDate: 1 }');
            } catch (error) {
                console.error('❌ Failed to create unique index:', error.message);
            }
        } else {
            console.log('✅ Unique index on { user: 1, attendanceDate: 1 } exists');
        }
        
        if (!hasUserDateStatusIndex) {
            console.log('⚠️  Missing index on { user: 1, attendanceDate: 1, attendanceStatus: 1 }');
            try {
                await attendanceCollection.createIndex(
                    { user: 1, attendanceDate: 1, attendanceStatus: 1 }, 
                    { background: true }
                );
                console.log('✅ Created index on { user: 1, attendanceDate: 1, attendanceStatus: 1 }');
            } catch (error) {
                console.error('❌ Failed to create index:', error.message);
            }
        } else {
            console.log('✅ Index on { user: 1, attendanceDate: 1, attendanceStatus: 1 } exists');
        }
        
        // Verify LeaveRequest indexes
        console.log('\n📋 Checking LeaveRequest indexes...');
        const leaveIndexes = await leaveCollection.indexes();
        
        console.log('Current LeaveRequest indexes:');
        leaveIndexes.forEach(index => {
            console.log(`  - ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''}`);
        });
        
        // Check for required leave index
        const hasEmployeeLeaveDatesStatusIndex = leaveIndexes.some(index =>
            index.key.employee === 1 && 
            index.key.leaveDates === 1 && 
            index.key.status === 1 &&
            Object.keys(index.key).length === 3
        );
        
        // Create missing LeaveRequest index
        if (!hasEmployeeLeaveDatesStatusIndex) {
            console.log('⚠️  Missing index on { employee: 1, leaveDates: 1, status: 1 }');
            try {
                await leaveCollection.createIndex(
                    { employee: 1, leaveDates: 1, status: 1 }, 
                    { background: true }
                );
                console.log('✅ Created index on { employee: 1, leaveDates: 1, status: 1 }');
            } catch (error) {
                console.error('❌ Failed to create index:', error.message);
            }
        } else {
            console.log('✅ Index on { employee: 1, leaveDates: 1, status: 1 } exists');
        }
        
        // Get final index stats
        console.log('\n📊 Final index verification...');
        const finalAttendanceIndexes = await attendanceCollection.indexes();
        const finalLeaveIndexes = await leaveCollection.indexes();
        
        console.log(`AttendanceLog collection has ${finalAttendanceIndexes.length} indexes`);
        console.log(`LeaveRequest collection has ${finalLeaveIndexes.length} indexes`);
        
        console.log('\n✅ Index verification completed successfully');
        
    } catch (error) {
        console.error('❌ Error verifying indexes:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the verification
if (require.main === module) {
    verifyAndCreateIndexes()
        .then(() => {
            console.log('🎉 Index verification completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Index verification failed:', error);
            process.exit(1);
        });
}

module.exports = { verifyAndCreateIndexes };