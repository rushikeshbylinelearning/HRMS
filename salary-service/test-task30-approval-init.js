/**
 * test-task30-approval-init.js
 * 
 * Task 30 Verification — Approval Workflow Field Initialization
 * 
 * This script verifies that createPayrollRun properly initializes
 * approval workflow fields with the correct initial values:
 * - approvalStatus: 'none'
 * - submittedBy, submittedAt, approvedBy, approvedAt: null
 */

const mongoose = require('mongoose');
require('dotenv').config();

const PayrollRun = require('./models/PayrollRun');
const User = require('./models/User');
const { createPayrollRun } = require('./services/payrollRunService');

const MONGO_URI = process.env.MONGODB_URI;

async function testApprovalWorkflowInit() {
  console.log('🧪 Task 30: Testing Approval Workflow Field Initialization...\n');

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find or create a test user
    let testUser = await User.findOne({ role: 'Admin' });
    if (!testUser) {
      console.log('⚠️  No Admin user found. Creating test admin...');
      testUser = await User.create({
        name: 'Test Admin',
        email: 'admin@test.com',
        role: 'Admin',
        password: 'test123',
      });
      console.log('✅ Test admin created\n');
    }

    // Test: Create a new payroll run and verify initial approval workflow fields
    console.log('Test 1: Creating new off-cycle payroll run...');
    const testMonth = new Date().getMonth() + 1;
    const testYear = new Date().getFullYear();
    
    const newRun = await createPayrollRun({
      month: testMonth,
      year: testYear,
      notes: 'Task 30 verification test - approval workflow initialization',
      actorId: testUser._id.toString(),
      actorEmail: testUser.email,
      source: 'manual',
    });

    console.log(`  ✅ Run created: ${newRun._id}\n`);

    // Verify approval workflow fields are initialized correctly
    console.log('Verification: Checking approval workflow field initialization...');
    
    const checks = [
      {
        field: 'approvalStatus',
        expected: 'none',
        actual: newRun.approvalStatus,
        pass: newRun.approvalStatus === 'none',
      },
      {
        field: 'submittedBy',
        expected: null,
        actual: newRun.submittedBy,
        pass: newRun.submittedBy === null || newRun.submittedBy === undefined,
      },
      {
        field: 'submittedAt',
        expected: null,
        actual: newRun.submittedAt,
        pass: newRun.submittedAt === null || newRun.submittedAt === undefined,
      },
      {
        field: 'approvedBy',
        expected: null,
        actual: newRun.approvedBy,
        pass: newRun.approvedBy === null || newRun.approvedBy === undefined,
      },
      {
        field: 'approvedAt',
        expected: null,
        actual: newRun.approvedAt,
        pass: newRun.approvedAt === null || newRun.approvedAt === undefined,
      },
    ];

    let allPass = true;
    checks.forEach(check => {
      const status = check.pass ? '✅' : '❌';
      console.log(`  ${status} ${check.field}: expected ${check.expected}, got ${check.actual}`);
      if (!check.pass) allPass = false;
    });

    console.log();

    // Verify that these fields remain unchanged after document retrieval
    console.log('Test 2: Retrieving run from database and re-verifying...');
    const retrievedRun = await PayrollRun.findById(newRun._id);
    
    const retrievalChecks = [
      {
        field: 'approvalStatus',
        expected: 'none',
        actual: retrievedRun.approvalStatus,
        pass: retrievedRun.approvalStatus === 'none',
      },
      {
        field: 'submittedBy',
        expected: null,
        actual: retrievedRun.submittedBy,
        pass: !retrievedRun.submittedBy,
      },
      {
        field: 'submittedAt',
        expected: null,
        actual: retrievedRun.submittedAt,
        pass: !retrievedRun.submittedAt,
      },
      {
        field: 'approvedBy',
        expected: null,
        actual: retrievedRun.approvedBy,
        pass: !retrievedRun.approvedBy,
      },
      {
        field: 'approvedAt',
        expected: null,
        actual: retrievedRun.approvedAt,
        pass: !retrievedRun.approvedAt,
      },
    ];

    retrievalChecks.forEach(check => {
      const status = check.pass ? '✅' : '❌';
      console.log(`  ${status} ${check.field}: ${check.actual ?? 'null/undefined'}`);
      if (!check.pass) allPass = false;
    });

    console.log();

    // Clean up test data
    console.log('Cleanup: Removing test run...');
    await PayrollRun.findByIdAndDelete(newRun._id);
    console.log('  ✅ Test run deleted\n');

    if (!allPass) {
      throw new Error('One or more approval workflow field checks failed');
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TASK 30 VERIFICATION PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nVerified:');
    console.log('  ✓ approvalStatus initialized to "none"');
    console.log('  ✓ submittedBy initialized to null');
    console.log('  ✓ submittedAt initialized to null');
    console.log('  ✓ approvedBy initialized to null');
    console.log('  ✓ approvedAt initialized to null');
    console.log('  ✓ Fields persist correctly in database');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the test
testApprovalWorkflowInit()
  .then(() => {
    console.log('\n🎉 Task 30 verification passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Task 30 verification failed:', error.message);
    process.exit(1);
  });
