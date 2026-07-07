// backend/scripts/initialize-leave-accrual-system.js
/**
 * Initialize Leave Accrual System
 * 
 * This script performs initial setup for the leave accrual system:
 * 1. Creates database indexes
 * 2. Verifies models are registered
 * 3. Optionally runs initial accrual for current month
 * 4. Generates system health report
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const { createLeaveIndexes } = require('./create-leave-indexes');
const LeaveAccrualService = require('../services/LeaveAccrualService');
const User = require('../models/User');
const LeaveLedger = require('../models/LeaveLedger');
const LeaveAccrualLock = require('../models/LeaveAccrualLock');
const { getISTNow, getISTDateParts } = require('../utils/istTime');

async function initializeLeaveAccrualSystem(options = {}) {
    const { runInitialAccrual = false, dryRun = true } = options;
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     Leave Accrual System Initialization                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
        // Step 1: Connect to database
        console.log('[Step 1/6] Connecting to database...');
        await connectDB();
        console.log('✓ Database connected\n');

        // Step 2: Verify models registered
        console.log('[Step 2/6] Verifying models...');
        const models = ['User', 'LeaveLedger', 'LeaveAccrualLock', 'LeaveRequest'];
        for (const modelName of models) {
            try {
                mongoose.model(modelName);
                console.log(`  ✓ ${modelName} model registered`);
            } catch (error) {
                console.error(`  ✗ ${modelName} model NOT registered`);
                throw new Error(`Model ${modelName} not found`);
            }
        }
        console.log('✓ All models verified\n');

        // Step 3: Create indexes
        console.log('[Step 3/6] Creating database indexes...');
        await createLeaveIndexes();
        console.log('✓ Indexes created\n');

        // Step 4: Check system status
        console.log('[Step 4/6] Checking system status...');
        const now = getISTNow();
        const { month, year } = getISTDateParts(now);
        
        const permanentEmployees = await User.countDocuments({
            isActive: true,
            employmentStatus: 'Permanent'
        });
        
        const currentMonthLock = await LeaveAccrualLock.findOne({ month, year });
        const totalLedgerEntries = await LeaveLedger.countDocuments();
        
        console.log(`  Current Month: ${month}/${year}`);
        console.log(`  Permanent Employees: ${permanentEmployees}`);
        console.log(`  Current Month Processed: ${currentMonthLock ? 'Yes' : 'No'}`);
        console.log(`  Total Ledger Entries: ${totalLedgerEntries}`);
        console.log('✓ System status checked\n');

        // Step 5: Run initial accrual (optional)
        if (runInitialAccrual) {
            console.log(`[Step 5/6] Running initial accrual (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
            
            if (currentMonthLock && !dryRun) {
                console.log('  ⚠ Current month already processed. Skipping accrual.');
                console.log('  Use dryRun=true to test without creating lock.\n');
            } else {
                const result = await LeaveAccrualService.processMonthlyAccrual(
                    month,
                    year,
                    { dryRun }
                );
                
                if (result.success) {
                    console.log(`  ✓ Accrual completed successfully`);
                    console.log(`    - Employees Processed: ${result.employeesProcessed}`);
                    console.log(`    - Employees Failed: ${result.employeesFailed}`);
                    console.log(`    - Duration: ${result.endTime - result.startTime}ms`);
                    
                    if (dryRun) {
                        console.log(`    - Mode: DRY RUN (no changes made)`);
                    }
                } else {
                    console.log(`  ⚠ Accrual skipped: ${result.reason}`);
                }
                console.log('');
            }
        } else {
            console.log('[Step 5/6] Skipping initial accrual (use --run-accrual to enable)\n');
        }

        // Step 6: Generate health report
        console.log('[Step 6/6] Generating system health report...');
        
        const healthReport = {
            timestamp: now.toISOString(),
            database: {
                connected: mongoose.connection.readyState === 1,
                name: mongoose.connection.name
            },
            models: {
                registered: models.length,
                verified: true
            },
            indexes: {
                created: true
            },
            employees: {
                permanent: permanentEmployees,
                total: await User.countDocuments({ isActive: true })
            },
            accrual: {
                currentMonth: { month, year },
                processed: !!currentMonthLock,
                totalLedgerEntries
            },
            status: 'HEALTHY'
        };
        
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    SYSTEM HEALTH REPORT                   ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        console.log(JSON.stringify(healthReport, null, 2));
        console.log('\n');

        // Step 7: Next steps
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                       NEXT STEPS                           ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        if (!runInitialAccrual) {
            console.log('1. Run initial accrual:');
            console.log('   npm run accrual:dry-run  (test mode)');
            console.log('   npm run accrual:run      (live mode)\n');
        }
        
        console.log('2. Verify system status:');
        console.log('   curl -X GET http://localhost:5000/api/admin/leave-accrual/status\n');
        
        console.log('3. Monitor cron job:');
        console.log('   tail -f backend/logs/combined.log | grep LeaveAccrual\n');
        
        console.log('4. Review documentation:');
        console.log('   - backend/docs/LEAVE_ACCRUAL_QUICK_START.md');
        console.log('   - backend/docs/LEAVE_MANAGEMENT_REFACTOR_REPORT.md\n');

        console.log('✅ Initialization complete!\n');
        
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Initialization failed:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    runInitialAccrual: args.includes('--run-accrual'),
    dryRun: !args.includes('--live')
};

// Run if executed directly
if (require.main === module) {
    console.log('\nOptions:');
    console.log('  --run-accrual  : Run initial accrual for current month');
    console.log('  --live         : Run in live mode (default: dry run)');
    console.log('  --help         : Show this help message\n');
    
    if (args.includes('--help')) {
        console.log('Usage:');
        console.log('  node initialize-leave-accrual-system.js');
        console.log('  node initialize-leave-accrual-system.js --run-accrual');
        console.log('  node initialize-leave-accrual-system.js --run-accrual --live\n');
        process.exit(0);
    }
    
    initializeLeaveAccrualSystem(options);
}

module.exports = { initializeLeaveAccrualSystem };
