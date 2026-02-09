// Script to identify and fix missing Planned leave balance deductions
// This script checks for approved Planned leaves where balance was not deducted
// and recalculates balances correctly

const mongoose = require('mongoose');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const LeavePolicyService = require('../services/LeavePolicyService');

async function fixMissingPlannedLeaveDeductions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-system');
        console.log('Connected to MongoDB');

        // Find all approved Planned leaves
        const approvedPlannedLeaves = await LeaveRequest.find({
            requestType: 'Planned',
            status: 'Approved'
        }).populate('employee', 'fullName employeeCode leaveBalances leaveEntitlements');

        console.log(`Found ${approvedPlannedLeaves.length} approved Planned leaves`);

        let fixedCount = 0;
        let errorCount = 0;
        const issues = [];

        for (const leave of approvedPlannedLeaves) {
            try {
                const employee = leave.employee;
                if (!employee) {
                    console.log(`⚠️  Leave ${leave._id}: Employee not found`);
                    continue;
                }

                // Calculate expected deduction
                const leaveDuration = leave.leaveDates.length * (leave.leaveType === 'Full Day' ? 1 : 0.5);
                const leaveField = LeavePolicyService.getBalanceField('Planned'); // Should be 'paid'

                if (!leaveField) {
                    console.log(`⚠️  Leave ${leave._id}: Invalid leave field mapping`);
                    continue;
                }

                // Get current balance
                const currentBalance = employee.leaveBalances?.[leaveField] ?? 0;
                
                // Calculate what balance should be (entitlement - all approved planned leaves)
                const allApprovedPlannedLeaves = await LeaveRequest.find({
                    employee: employee._id,
                    requestType: 'Planned',
                    status: 'Approved'
                });

                let totalDeducted = 0;
                for (const l of allApprovedPlannedLeaves) {
                    const duration = l.leaveDates.length * (l.leaveType === 'Full Day' ? 1 : 0.5);
                    totalDeducted += duration;
                }

                const entitlement = employee.leaveEntitlements?.[leaveField] ?? 12;
                const expectedBalance = Math.max(0, entitlement - totalDeducted);

                // Check if balance is incorrect
                if (Math.abs(currentBalance - expectedBalance) > 0.01) {
                    console.log(`\n🔧 Fixing leave ${leave._id} for ${employee.fullName} (${employee.employeeCode})`);
                    console.log(`   Current balance: ${currentBalance}`);
                    console.log(`   Expected balance: ${expectedBalance}`);
                    console.log(`   This leave duration: ${leaveDuration} days`);
                    console.log(`   Total approved Planned leaves: ${totalDeducted} days`);

                    // Update balance atomically
                    const updated = await User.findByIdAndUpdate(
                        employee._id,
                        { $set: { [`leaveBalances.${leaveField}`]: expectedBalance } },
                        { new: true }
                    );

                    if (updated) {
                        console.log(`   ✅ Fixed! New balance: ${updated.leaveBalances[leaveField]}`);
                        fixedCount++;
                        issues.push({
                            leaveId: leave._id,
                            employeeId: employee._id,
                            employeeName: employee.fullName,
                            employeeCode: employee.employeeCode,
                            oldBalance: currentBalance,
                            newBalance: expectedBalance,
                            leaveDuration: leaveDuration,
                            leaveDates: leave.leaveDates
                        });
                    } else {
                        console.log(`   ❌ Failed to update balance`);
                        errorCount++;
                    }
                } else {
                    console.log(`✓ Leave ${leave._id} for ${employee.fullName}: Balance is correct (${currentBalance})`);
                }
            } catch (error) {
                console.error(`❌ Error processing leave ${leave._id}:`, error.message);
                errorCount++;
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Total approved Planned leaves: ${approvedPlannedLeaves.length}`);
        console.log(`   Fixed: ${fixedCount}`);
        console.log(`   Already correct: ${approvedPlannedLeaves.length - fixedCount - errorCount}`);
        console.log(`   Errors: ${errorCount}`);

        if (issues.length > 0) {
            console.log(`\n📋 Fixed Issues:`);
            issues.forEach((issue, index) => {
                console.log(`\n${index + 1}. Leave ID: ${issue.leaveId}`);
                console.log(`   Employee: ${issue.employeeName} (${issue.employeeCode})`);
                console.log(`   Old Balance: ${issue.oldBalance} → New Balance: ${issue.newBalance}`);
                console.log(`   Leave Duration: ${issue.leaveDuration} days`);
                console.log(`   Leave Dates: ${issue.leaveDates.map(d => new Date(d).toISOString().split('T')[0]).join(', ')}`);
            });
        }

        await mongoose.disconnect();
        console.log('\n✅ Script completed');
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    fixMissingPlannedLeaveDeductions();
}

module.exports = { fixMissingPlannedLeaveDeductions };
