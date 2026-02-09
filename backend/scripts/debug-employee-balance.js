// Debug script to check a specific employee's leave balance and approved leaves
// Usage: node backend/scripts/debug-employee-balance.js <employeeCode>

const mongoose = require('mongoose');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const LeavePolicyService = require('../services/LeavePolicyService');

async function debugEmployeeBalance(employeeCode) {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-system');
        console.log('Connected to MongoDB\n');

        // Find employee
        const employee = await User.findOne({ employeeCode }).lean();
        if (!employee) {
            console.log(`❌ Employee not found: ${employeeCode}`);
            process.exit(1);
        }

        console.log(`📋 Employee: ${employee.fullName} (${employee.employeeCode})`);
        console.log(`   Employment Status: ${employee.employmentStatus}`);
        console.log(`   Department: ${employee.department || 'N/A'}\n`);

        // Check leave balances
        console.log('💰 Leave Balances (from database):');
        console.log(`   Sick: ${employee.leaveBalances?.sick ?? 'undefined/null'}`);
        console.log(`   Casual: ${employee.leaveBalances?.casual ?? 'undefined/null'}`);
        console.log(`   Paid/Planned: ${employee.leaveBalances?.paid ?? 'undefined/null'}\n`);

        // Check leave entitlements
        console.log('📊 Leave Entitlements:');
        console.log(`   Sick: ${employee.leaveEntitlements?.sick ?? 'undefined/null'}`);
        console.log(`   Casual: ${employee.leaveEntitlements?.casual ?? 'undefined/null'}`);
        console.log(`   Paid/Planned: ${employee.leaveEntitlements?.paid ?? 'undefined/null'}\n`);

        // Get all approved leaves
        const approvedLeaves = await LeaveRequest.find({
            employee: employee._id,
            status: 'Approved'
        }).sort({ createdAt: -1 }).lean();

        console.log(`📝 Approved Leaves (${approvedLeaves.length} total):\n`);

        let plannedLeaves = [];
        let sickLeaves = [];
        let casualLeaves = [];
        let otherLeaves = [];

        approvedLeaves.forEach((leave, index) => {
            const duration = leave.leaveDates.length * (leave.leaveType === 'Full Day' ? 1 : 0.5);
            const leaveField = LeavePolicyService.getBalanceField(leave.requestType);
            
            const leaveInfo = {
                id: leave._id,
                type: leave.requestType,
                leaveType: leave.leaveType,
                dates: leave.leaveDates.map(d => new Date(d).toISOString().split('T')[0]),
                duration: duration,
                balanceField: leaveField || 'N/A (no balance deduction)',
                createdAt: new Date(leave.createdAt).toISOString(),
                approvedAt: leave.approvedAt ? new Date(leave.approvedAt).toISOString() : 'N/A'
            };

            if (leave.requestType === 'Planned') {
                plannedLeaves.push(leaveInfo);
            } else if (leave.requestType === 'Sick') {
                sickLeaves.push(leaveInfo);
            } else if (leave.requestType === 'Casual') {
                casualLeaves.push(leaveInfo);
            } else {
                otherLeaves.push(leaveInfo);
            }
        });

        // Calculate expected deductions
        let totalPlannedDeducted = plannedLeaves.reduce((sum, l) => sum + l.duration, 0);
        let totalSickDeducted = sickLeaves.reduce((sum, l) => sum + l.duration, 0);
        let totalCasualDeducted = casualLeaves.reduce((sum, l) => sum + l.duration, 0);

        console.log(`🔵 Planned Leaves (${plannedLeaves.length}):`);
        plannedLeaves.forEach((leave, i) => {
            console.log(`   ${i + 1}. ${leave.duration} day(s) - ${leave.dates.join(', ')} (${leave.leaveType})`);
            console.log(`      Balance Field: ${leave.balanceField}`);
            console.log(`      Created: ${leave.createdAt}`);
            console.log(`      Approved: ${leave.approvedAt}`);
        });
        console.log(`   Total Planned Days Deducted: ${totalPlannedDeducted}\n`);

        console.log(`🟢 Sick Leaves (${sickLeaves.length}):`);
        sickLeaves.forEach((leave, i) => {
            console.log(`   ${i + 1}. ${leave.duration} day(s) - ${leave.dates.join(', ')} (${leave.leaveType})`);
        });
        console.log(`   Total Sick Days Deducted: ${totalSickDeducted}\n`);

        console.log(`🟡 Casual Leaves (${casualLeaves.length}):`);
        casualLeaves.forEach((leave, i) => {
            console.log(`   ${i + 1}. ${leave.duration} day(s) - ${leave.dates.join(', ')} (${leave.leaveType})`);
        });
        console.log(`   Total Casual Days Deducted: ${totalCasualDeducted}\n`);

        if (otherLeaves.length > 0) {
            console.log(`⚪ Other Leaves (${otherLeaves.length}):`);
            otherLeaves.forEach((leave, i) => {
                console.log(`   ${i + 1}. ${leave.type} - ${leave.duration} day(s) - ${leave.dates.join(', ')}`);
            });
            console.log();
        }

        // Calculate expected balances
        const paidEntitlement = employee.leaveEntitlements?.paid ?? 0;
        const sickEntitlement = employee.leaveEntitlements?.sick ?? 0;
        const casualEntitlement = employee.leaveEntitlements?.casual ?? 0;

        const expectedPaidBalance = Math.max(0, paidEntitlement - totalPlannedDeducted);
        const expectedSickBalance = Math.max(0, sickEntitlement - totalSickDeducted);
        const expectedCasualBalance = Math.max(0, casualEntitlement - totalCasualDeducted);

        const actualPaidBalance = employee.leaveBalances?.paid ?? 0;
        const actualSickBalance = employee.leaveBalances?.sick ?? 0;
        const actualCasualBalance = employee.leaveBalances?.casual ?? 0;

        console.log('🔍 Balance Analysis:\n');
        console.log('Planned/Paid Leave:');
        console.log(`   Entitlement: ${paidEntitlement}`);
        console.log(`   Total Deducted: ${totalPlannedDeducted}`);
        console.log(`   Expected Balance: ${expectedPaidBalance}`);
        console.log(`   Actual Balance: ${actualPaidBalance}`);
        console.log(`   Match: ${expectedPaidBalance === actualPaidBalance ? '✅' : '❌ MISMATCH!'}`);
        if (expectedPaidBalance !== actualPaidBalance) {
            console.log(`   Difference: ${actualPaidBalance - expectedPaidBalance} days`);
        }
        console.log();

        console.log('Sick Leave:');
        console.log(`   Entitlement: ${sickEntitlement}`);
        console.log(`   Total Deducted: ${totalSickDeducted}`);
        console.log(`   Expected Balance: ${expectedSickBalance}`);
        console.log(`   Actual Balance: ${actualSickBalance}`);
        console.log(`   Match: ${expectedSickBalance === actualSickBalance ? '✅' : '❌ MISMATCH!'}`);
        if (expectedSickBalance !== actualSickBalance) {
            console.log(`   Difference: ${actualSickBalance - expectedSickBalance} days`);
        }
        console.log();

        console.log('Casual Leave:');
        console.log(`   Entitlement: ${casualEntitlement}`);
        console.log(`   Total Deducted: ${totalCasualDeducted}`);
        console.log(`   Expected Balance: ${expectedCasualBalance}`);
        console.log(`   Actual Balance: ${actualCasualBalance}`);
        console.log(`   Match: ${expectedCasualBalance === actualCasualBalance ? '✅' : '❌ MISMATCH!'}`);
        if (expectedCasualBalance !== actualCasualBalance) {
            console.log(`   Difference: ${actualCasualBalance - expectedCasualBalance} days`);
        }
        console.log();

        await mongoose.disconnect();
        console.log('✅ Debug complete');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Get employee code from command line
const employeeCode = process.argv[2];
if (!employeeCode) {
    console.log('Usage: node backend/scripts/debug-employee-balance.js <employeeCode>');
    console.log('Example: node backend/scripts/debug-employee-balance.js BYL202502-E46');
    process.exit(1);
}

debugEmployeeBalance(employeeCode);
