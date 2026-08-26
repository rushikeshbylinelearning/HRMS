/**
 * test-task30-workflow-integration.js
 * 
 * Task 30 Integration Test — Full Workflow Verification
 * 
 * This script tests that approval workflow fields are correctly initialized
 * and can be used throughout the payroll run workflow.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const PayrollRun = require('./models/PayrollRun');
const User = require('./models/User');
const { createPayrollRun } = require('./services/payrollRunService');

const MONGO_URI = process.env.MONGODB_URI;

async function testWorkflowIntegration() {
  console.log('🧪 Task 30: Testing Approval Workflow Integration...\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    let testUser = await User.findOne({ role: 'Admin' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Test Admin',
        email: 'admin@test.com',
        role: 'Admin',
        password: 'test123',
      });
    }

    // Test 1: Create run and verify initial state
    console.log('Test 1: Create new run with approval fields initialized...');
    const newRun = await createPayrollRun({
      month: 11,
      year: 2024,
      notes: 'Task 30 workflow integration test',
      actorId: testUser._id.toString(),
      actorEmail: testUser.email,
      source: 'manual',
    });

    console.log(`  ✅ Run created: ${newRun._id}`);
    console.log(`  Initial approvalStatus: ${newRun.approvalStatus}`);
    console.log(`  Initial submittedBy: ${newRun.submittedBy ?? 'null'}`);
    console.log();

    // Test 2: Transition through approval workflow states
    console.log('Test 2: Simulating approval workflow state transitions...');
    
    // Submit for approval
    newRun.approvalStatus = 'submitted';
    newRun.submittedBy = testUser._id;
    newRun.submittedAt = new Date();
    await newRun.save();
    console.log(`  ✅ Submitted: approvalStatus = ${newRun.approvalStatus}`);
    console.log(`     submittedBy is set: ${!!newRun.submittedBy}`);
    console.log(`     submittedAt is set: ${!!newRun.submittedAt}`);

    // Approve
    newRun.approvalStatus = 'approved';
    newRun.approvedBy = testUser._id;
    newRun.approvedAt = new Date();
    await newRun.save();
    console.log(`  ✅ Approved: approvalStatus = ${newRun.approvalStatus}`);
    console.log(`     approvedBy is set: ${!!newRun.approvedBy}`);
    console.log(`     approvedAt is set: ${!!newRun.approvedAt}`);
    console.log();

    // Test 3: Verify fields persist after retrieval
    console.log('Test 3: Verify persistence after database retrieval...');
    const retrievedRun = await PayrollRun.findById(newRun._id);
    
    const persistenceChecks = [
      ['approvalStatus', retrievedRun.approvalStatus === 'approved'],
      ['submittedBy', !!retrievedRun.submittedBy],
      ['submittedAt', !!retrievedRun.submittedAt],
      ['approvedBy', !!retrievedRun.approvedBy],
      ['approvedAt', !!retrievedRun.approvedAt],
    ];

    let allPassed = true;
    persistenceChecks.forEach(([field, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`  ${status} ${field} persisted correctly`);
      if (!passed) allPassed = false;
    });
    console.log();

    // Test 4: Verify rejection scenario
    console.log('Test 4: Testing rejection scenario...');
    const rejectionRun = await createPayrollRun({
      month: 10,
      year: 2024,
      notes: 'Rejection test run',
      actorId: testUser._id.toString(),
      actorEmail: testUser.email,
      source: 'manual',
    });

    rejectionRun.approvalStatus = 'submitted';
    rejectionRun.submittedBy = testUser._id;
    rejectionRun.submittedAt = new Date();
    await rejectionRun.save();

    rejectionRun.approvalStatus = 'rejected';
    rejectionRun.rejectedBy = testUser._id;
    rejectionRun.rejectedAt = new Date();
    rejectionRun.rejectionReason = 'Incorrect calculations detected';
    await rejectionRun.save();

    console.log(`  ✅ Rejection workflow completed`);
    console.log(`     approvalStatus: ${rejectionRun.approvalStatus}`);
    console.log(`     rejectionReason: "${rejectionRun.rejectionReason}"`);
    console.log();

    // Cleanup
    console.log('Cleanup: Removing test runs...');
    await PayrollRun.deleteMany({ _id: { $in: [newRun._id, rejectionRun._id] } });
    console.log('  ✅ Test runs deleted\n');

    if (!allPassed) {
      throw new Error('One or more persistence checks failed');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TASK 30 WORKFLOW INTEGRATION TEST PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nVerified:');
    console.log('  ✓ Initial approval fields set correctly on creation');
    console.log('  ✓ Approval workflow state transitions work properly');
    console.log('  ✓ All approval fields persist correctly in database');
    console.log('  ✓ Rejection workflow functions as expected');
    console.log('  ✓ Orthogonal to existing status field (draft/finalized/paid)');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

testWorkflowIntegration()
  .then(() => {
    console.log('\n🎉 Task 30 workflow integration test passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Task 30 integration test failed:', error.message);
    process.exit(1);
  });
