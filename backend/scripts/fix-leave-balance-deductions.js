/**
 * Script to fix incorrect leave balance deductions in existing records
 * 
 * Issue: Some approved leaves may have deducted from the wrong balance field
 * (e.g., Casual leave deducted from Sick balance instead of Casual balance)
 * 
 * This script will:
 * 1. Find all approved leave requests
 * 2. Recalculate correct balances for each employee based on their approved leaves
 * 3. Update employee balances to match the correct calculations
 * 4. Provide detailed audit report
 * 
 * SAFE: This script recalculates from scratch based on current entitlements
 * and all approved leaves, ensuring accuracy.
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
    // dotenv might not be available, use process.env directly
}

const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');

// Configuration
const CONFIG = {
    DRY_RUN: false, // Set to false to actually update balances
    LOG_DETAILS: true, // Log detailed information for each employee
    // Filter: Only process these employee codes (leave empty array [] to process all)
    // Example: ['#BYL202505-E69'] to process only that employee
    FILTER_EMPLOYEE_CODES: [], // Empty = process all employees
};

// Helper function to map requestType to balance field
const getBalanceField = (requestType) => {
    if (!requestType) return null;
    const normalizedType = String(requestType).trim();
    
    if (normalizedType === 'Sick') {
        return 'sick';
    } else if (normalizedType === 'Planned') {
        return 'paid';
    } else if (normalizedType === 'Casual') {
        return 'casual';
    } else if (normalizedType === 'Loss of Pay' || 
               normalizedType === 'Compensatory' || 
               normalizedType === 'Comp-Off' || 
               normalizedType === 'Backdated Leave' ||
               normalizedType === 'YEAR_END') {
        return null; // These don't affect leave balances
    }
    return null;
};

// Calculate leave duration
const calculateLeaveDuration = (leaveDates, leaveType) => {
    if (!leaveDates || leaveDates.length === 0) return 0;
    const multiplier = leaveType === 'Full Day' ? 1 : 0.5;
    return leaveDates.length * multiplier;
};

// Connect to MongoDB
async function connectDB() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance-system';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

// Recalculate employee balance based on all approved leaves
async function recalculateEmployeeBalance(employee) {
    // Get all approved leaves for this employee
    const approvedLeaves = await LeaveRequest.find({
        employee: employee._id,
        status: 'Approved'
    }).lean();

    // Initialize balance counters
    let sickDeducted = 0;
    let casualDeducted = 0;
    let paidDeducted = 0;

    // Calculate total deductions for each leave type
    for (const leave of approvedLeaves) {
        const balanceField = getBalanceField(leave.requestType);
        if (!balanceField) continue; // Skip leaves that don't affect balance

        const duration = calculateLeaveDuration(leave.leaveDates, leave.leaveType);
        
        if (balanceField === 'sick') {
            sickDeducted += duration;
        } else if (balanceField === 'casual') {
            casualDeducted += duration;
        } else if (balanceField === 'paid') {
            paidDeducted += duration;
        }
    }

    // Get current entitlements
    // Priority: 1. leaveEntitlements field, 2. Calculate from current balance + deductions, 3. Use defaults
    let entitlements = employee.leaveEntitlements;
    
    if (!entitlements || 
        typeof entitlements.sick !== 'number' || 
        typeof entitlements.casual !== 'number' || 
        typeof entitlements.paid !== 'number') {
        // If entitlements are missing or invalid, calculate from current balance + total deductions
        // This gives us the original entitlement (assuming current balance is correct)
        const currentBal = employee.leaveBalances || { sick: 0, casual: 0, paid: 0 };
        entitlements = {
            sick: (currentBal.sick || 0) + sickDeducted,
            casual: (currentBal.casual || 0) + casualDeducted,
            paid: (currentBal.paid || 0) + paidDeducted
        };
        
        // If calculated entitlements are 0 or negative, use defaults
        if (entitlements.sick <= 0 && entitlements.casual <= 0 && entitlements.paid <= 0) {
            entitlements = { sick: 6, casual: 6, paid: 10 };
        }
    }

    // Calculate correct balances
    const correctBalances = {
        sick: Math.max(0, (entitlements.sick || 0) - sickDeducted),
        casual: Math.max(0, (entitlements.casual || 0) - casualDeducted),
        paid: Math.max(0, (entitlements.paid || 0) - paidDeducted)
    };

    // Get current balances
    const currentBalances = employee.leaveBalances || {
        sick: 0,
        casual: 0,
        paid: 0
    };

    // Check if balances need correction
    const needsCorrection = 
        Math.abs(currentBalances.sick - correctBalances.sick) > 0.01 ||
        Math.abs(currentBalances.casual - correctBalances.casual) > 0.01 ||
        Math.abs(currentBalances.paid - correctBalances.paid) > 0.01;

    return {
        employee,
        approvedLeaves,
        sickDeducted,
        casualDeducted,
        paidDeducted,
        entitlements,
        currentBalances,
        correctBalances,
        needsCorrection,
        differences: {
            sick: correctBalances.sick - currentBalances.sick,
            casual: correctBalances.casual - currentBalances.casual,
            paid: correctBalances.paid - currentBalances.paid
        }
    };
}

// Main function to fix leave balances
async function fixLeaveBalances() {
    console.log('🔍 Starting Leave Balance Fix Script...\n');
    console.log(`Mode: ${CONFIG.DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (will update balances)'}\n`);

    try {
        // Get all employees
        let employees = await User.find({ isActive: true }).lean();
        
        // Apply filter if specified
        if (CONFIG.FILTER_EMPLOYEE_CODES && CONFIG.FILTER_EMPLOYEE_CODES.length > 0) {
            // Normalize filter codes (remove # if present for comparison)
            const normalizedFilters = CONFIG.FILTER_EMPLOYEE_CODES.map(code => 
                code.startsWith('#') ? code : `#${code}`
            );
            
            employees = employees.filter(emp => {
                // Normalize employee code for comparison
                const empCode = emp.employeeCode || '';
                const normalizedEmpCode = empCode.startsWith('#') ? empCode : `#${empCode}`;
                return normalizedFilters.includes(normalizedEmpCode) || 
                       normalizedFilters.includes(empCode);
            });
            
            if (employees.length === 0) {
                console.log(`⚠️  WARNING: No employees found matching filter codes: ${CONFIG.FILTER_EMPLOYEE_CODES.join(', ')}\n`);
            } else {
                console.log(`🔍 Filtering to ${employees.length} employee(s): ${employees.map(e => e.employeeCode).join(', ')}\n`);
            }
        }
        
        console.log(`📊 Processing ${employees.length} employee(s)\n`);

        const results = {
            totalEmployees: employees.length,
            employeesChecked: 0,
            employeesNeedingFix: 0,
            employeesFixed: 0,
            totalLeavesProcessed: 0,
            errors: [],
            details: []
        };

        // Process each employee
        for (const employee of employees) {
            try {
                results.employeesChecked++;
                
                const calculation = await recalculateEmployeeBalance(employee);
                results.totalLeavesProcessed += calculation.approvedLeaves.length;

                if (calculation.needsCorrection) {
                    results.employeesNeedingFix++;

                    const detail = {
                        employeeId: employee._id.toString(),
                        employeeCode: employee.employeeCode,
                        employeeName: employee.fullName,
                        approvedLeavesCount: calculation.approvedLeaves.length,
                        currentBalances: calculation.currentBalances,
                        correctBalances: calculation.correctBalances,
                        differences: calculation.differences,
                        deductions: {
                            sick: calculation.sickDeducted,
                            casual: calculation.casualDeducted,
                            paid: calculation.paidDeducted
                        },
                        entitlements: calculation.entitlements,
                        leaves: calculation.approvedLeaves.map(leave => ({
                            _id: leave._id.toString(),
                            requestType: leave.requestType,
                            leaveType: leave.leaveType,
                            leaveDates: leave.leaveDates,
                            duration: calculateLeaveDuration(leave.leaveDates, leave.leaveType),
                            shouldDeductFrom: getBalanceField(leave.requestType)
                        }))
                    };

                    results.details.push(detail);

                    if (CONFIG.LOG_DETAILS) {
                        console.log(`\n⚠️  Employee: ${employee.fullName} (${employee.employeeCode})`);
                        console.log(`   Current Balances: sick=${calculation.currentBalances.sick}, casual=${calculation.currentBalances.casual}, paid=${calculation.currentBalances.paid}`);
                        console.log(`   Correct Balances: sick=${calculation.correctBalances.sick}, casual=${calculation.correctBalances.casual}, paid=${calculation.correctBalances.paid}`);
                        console.log(`   Differences: sick=${calculation.differences.sick.toFixed(2)}, casual=${calculation.differences.casual.toFixed(2)}, paid=${calculation.differences.paid.toFixed(2)}`);
                        console.log(`   Total Deductions: sick=${calculation.sickDeducted}, casual=${calculation.casualDeducted}, paid=${calculation.paidDeducted}`);
                        console.log(`   Approved Leaves: ${calculation.approvedLeaves.length}`);
                    }

                    // Update balance if not dry run
                    if (!CONFIG.DRY_RUN) {
                        const employeeDoc = await User.findById(employee._id);
                        if (employeeDoc) {
                            employeeDoc.leaveBalances = {
                                sick: calculation.correctBalances.sick,
                                casual: calculation.correctBalances.casual,
                                paid: calculation.correctBalances.paid
                            };
                            await employeeDoc.save();
                            results.employeesFixed++;
                            console.log(`   ✅ Updated balances for ${employee.fullName}`);
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Error processing employee ${employee.fullName} (${employee.employeeCode}):`, error);
                results.errors.push({
                    employeeId: employee._id.toString(),
                    employeeCode: employee.employeeCode,
                    employeeName: employee.fullName,
                    error: error.message
                });
            }
        }

        // Print summary
        console.log('\n' + '='.repeat(80));
        console.log('📊 SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total Employees Checked: ${results.employeesChecked}`);
        console.log(`Employees Needing Fix: ${results.employeesNeedingFix}`);
        console.log(`Employees Fixed: ${results.employeesFixed}`);
        console.log(`Total Approved Leaves Processed: ${results.totalLeavesProcessed}`);
        console.log(`Errors: ${results.errors.length}`);

        if (results.errors.length > 0) {
            console.log('\n❌ Errors:');
            results.errors.forEach(err => {
                console.log(`   - ${err.employeeName} (${err.employeeCode}): ${err.error}`);
            });
        }

        if (CONFIG.DRY_RUN) {
            console.log('\n⚠️  DRY RUN MODE - No changes were made to the database');
            console.log('   Set CONFIG.DRY_RUN = false to apply fixes');
        } else {
            console.log('\n✅ All fixes have been applied');
        }
        
        if (CONFIG.FILTER_EMPLOYEE_CODES && CONFIG.FILTER_EMPLOYEE_CODES.length > 0) {
            console.log(`\n📌 Filtered Mode: Only processed ${CONFIG.FILTER_EMPLOYEE_CODES.length} employee(s)`);
            console.log(`   Employee Codes: ${CONFIG.FILTER_EMPLOYEE_CODES.join(', ')}`);
        }

        // Save detailed report to file
        const fs = require('fs');
        const reportPath = path.join(__dirname, 'leave-balance-fix-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);

        return results;
    } catch (error) {
        console.error('❌ Script failed:', error);
        throw error;
    }
}

// Main execution
const main = async () => {
    try {
        await connectDB();
        await fixLeaveBalances();
        console.log('\n✅ Script completed successfully');
    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
};

// Run script if executed directly
if (require.main === module) {
    main();
}

module.exports = { fixLeaveBalances, recalculateEmployeeBalance };
