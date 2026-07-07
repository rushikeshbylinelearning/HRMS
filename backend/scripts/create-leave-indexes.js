// backend/scripts/create-leave-indexes.js
/**
 * Create optimized indexes for leave management system
 * 
 * PURPOSE: Ensure fast query performance for leave validation
 * TARGET: <150ms validation time for 10k employee dataset
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');

async function createLeaveIndexes() {
    console.log('[CreateIndexes] Starting index creation for leave management...');

    try {
        await connectDB();
        console.log('[CreateIndexes] Connected to database');

        const db = mongoose.connection.db;

        // 1. LeaveRequest indexes
        console.log('[CreateIndexes] Creating LeaveRequest indexes...');
        
        const leaveRequestCollection = db.collection('leaverequests');
        
        await leaveRequestCollection.createIndex(
            { employee: 1, status: 1, requestType: 1 },
            { name: 'employee_status_type', background: true }
        );
        
        await leaveRequestCollection.createIndex(
            { employee: 1, leaveDates: 1 },
            { name: 'employee_dates', background: true }
        );
        
        await leaveRequestCollection.createIndex(
            { employee: 1, status: 1, leaveDates: 1 },
            { name: 'employee_status_dates', background: true }
        );
        
        await leaveRequestCollection.createIndex(
            { status: 1, createdAt: -1 },
            { name: 'status_created', background: true }
        );

        console.log('[CreateIndexes] ✓ LeaveRequest indexes created');

        // 2. User indexes (leave balances)
        console.log('[CreateIndexes] Creating User indexes...');
        
        const userCollection = db.collection('users');
        
        await userCollection.createIndex(
            { isActive: 1, employmentStatus: 1 },
            { name: 'active_employment_status', background: true }
        );
        
        await userCollection.createIndex(
            { employmentStatus: 1, joiningDate: 1 },
            { name: 'employment_joining', background: true }
        );

        console.log('[CreateIndexes] ✓ User indexes created');

        // 3. LeaveLedger indexes
        console.log('[CreateIndexes] Creating LeaveLedger indexes...');
        
        const leaveLedgerCollection = db.collection('leaveledgers');
        
        await leaveLedgerCollection.createIndex(
            { employeeId: 1, month: 1, year: 1 },
            { name: 'employee_month_year', background: true }
        );
        
        await leaveLedgerCollection.createIndex(
            { employeeId: 1, leaveType: 1, createdAt: -1 },
            { name: 'employee_type_created', background: true }
        );
        
        await leaveLedgerCollection.createIndex(
            { transactionType: 1, createdAt: -1 },
            { name: 'transaction_created', background: true }
        );
        
        await leaveLedgerCollection.createIndex(
            { source: 1, createdAt: -1 },
            { name: 'source_created', background: true }
        );

        console.log('[CreateIndexes] ✓ LeaveLedger indexes created');

        // 4. LeaveAccrualLock indexes
        console.log('[CreateIndexes] Creating LeaveAccrualLock indexes...');
        
        const leaveAccrualLockCollection = db.collection('leaveaccruallocks');
        
        await leaveAccrualLockCollection.createIndex(
            { month: 1, year: 1 },
            { name: 'unique_month_year_accrual', unique: true, background: true }
        );
        
        await leaveAccrualLockCollection.createIndex(
            { status: 1, createdAt: -1 },
            { name: 'status_created', background: true }
        );

        console.log('[CreateIndexes] ✓ LeaveAccrualLock indexes created');

        // 5. SystemAuditLog indexes (for override tracking)
        console.log('[CreateIndexes] Creating SystemAuditLog indexes...');
        
        const systemAuditLogCollection = db.collection('systemauditlogs');
        
        await systemAuditLogCollection.createIndex(
            { action: 1, executedAt: -1 },
            { name: 'action_executed', background: true }
        );
        
        await systemAuditLogCollection.createIndex(
            { employeeId: 1, timestamp: -1 },
            { name: 'employee_timestamp', background: true }
        );
        
        await systemAuditLogCollection.createIndex(
            { userId: 1, timestamp: -1 },
            { name: 'user_timestamp', background: true }
        );

        console.log('[CreateIndexes] ✓ SystemAuditLog indexes created');

        // 6. Holiday indexes (for validation caching)
        console.log('[CreateIndexes] Creating Holiday indexes...');
        
        const holidayCollection = db.collection('holidays');
        
        await holidayCollection.createIndex(
            { date: 1 },
            { name: 'date', background: true }
        );
        
        await holidayCollection.createIndex(
            { date: 1, isTentative: 1 },
            { name: 'date_tentative', background: true }
        );

        console.log('[CreateIndexes] ✓ Holiday indexes created');

        // Verify indexes
        console.log('\n[CreateIndexes] Verifying indexes...');
        
        const collections = [
            { name: 'leaverequests', collection: leaveRequestCollection },
            { name: 'users', collection: userCollection },
            { name: 'leaveledgers', collection: leaveLedgerCollection },
            { name: 'leaveaccruallocks', collection: leaveAccrualLockCollection },
            { name: 'systemauditlogs', collection: systemAuditLogCollection },
            { name: 'holidays', collection: holidayCollection }
        ];

        for (const { name, collection } of collections) {
            const indexes = await collection.indexes();
            console.log(`\n${name} indexes (${indexes.length}):`);
            indexes.forEach(idx => {
                console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
            });
        }

        console.log('\n[CreateIndexes] ✓ All indexes created and verified successfully');
        console.log('[CreateIndexes] Performance optimization complete');

        process.exit(0);

    } catch (error) {
        console.error('[CreateIndexes] ✗ Error creating indexes:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    createLeaveIndexes();
}

module.exports = { createLeaveIndexes };
