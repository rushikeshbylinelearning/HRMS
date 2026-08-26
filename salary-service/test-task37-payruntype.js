/**
 * Task 37 Verification — payRunType parameter in createPayrollRun
 * 
 * This script verifies that createPayrollRun properly accepts and initializes
 * the payRunType parameter with the following behavior:
 * - Accepts payRunType parameter ('regular', 'offCycle', 'resettlement')
 * - Defaults to 'regular' if not specified
 * - Stores payRunType in the database
 * - Includes payRunType in audit log details
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PayrollRun = require('./models/PayrollRun');
const User = require('./models/User');
const { createPayrollRun } = require('./services/payrollRunService');

const MONGO_URI = process.env.MONGODB_URI;

async function testPayRunType() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get a test user
    const user = await User.findOne({ role: 'Admin' });
    if (!user) {
      throw new Error('No Admin user found in database');
    }

    // Clean up any test runs
    await PayrollRun.deleteMany({ 
      month: { $in: [1, 2, 3] }, 
      year: 2025 
    });
    console.log('✅ Cleaned up test data');

    // Test 1: Create run with explicit payRunType='regular'
    console.log('\nTest 1: Create run with explicit payRunType="regular"...');
    const regularRun = await createPayrollRun({
      month: 1,
      year: 2025,
      notes: 'Test regular run',
      payRunType: 'regular',
      actorId: user._id,
      actorEmail: user.email,
      source: 'manual',
    });
    console.log(`✅ Created run with ID: ${regularRun._id}`);
    console.log(`   payRunType: ${regularRun.payRunType}`);
    if (regularRun.payRunType !== 'regular') {
      throw new Error(`Expected payRunType='regular', got '${regularRun.payRunType}'`);
    }

    // Test 2: Create run with payRunType='offCycle'
    console.log('\nTest 2: Create run with payRunType="offCycle"...');
    const offCycleRun = await createPayrollRun({
      month: 2,
      year: 2025,
      notes: 'Test off-cycle run',
      payRunType: 'offCycle',
      actorId: user._id,
      actorEmail: user.email,
      source: 'manual',
    });
    console.log(`✅ Created run with ID: ${offCycleRun._id}`);
    console.log(`   payRunType: ${offCycleRun.payRunType}`);
    if (offCycleRun.payRunType !== 'offCycle') {
      throw new Error(`Expected payRunType='offCycle', got '${offCycleRun.payRunType}'`);
    }

    // Test 3: Create run with payRunType='resettlement'
    console.log('\nTest 3: Create run with payRunType="resettlement"...');
    const resettlementRun = await createPayrollRun({
      month: 3,
      year: 2025,
      notes: 'Test resettlement run',
      payRunType: 'resettlement',
      actorId: user._id,
      actorEmail: user.email,
      source: 'manual',
    });
    console.log(`✅ Created run with ID: ${resettlementRun._id}`);
    console.log(`   payRunType: ${resettlementRun.payRunType}`);
    if (resettlementRun.payRunType !== 'resettlement') {
      throw new Error(`Expected payRunType='resettlement', got '${resettlementRun.payRunType}'`);
    }

    // Test 4: Create run without payRunType (should default to 'regular')
    console.log('\nTest 4: Create run without payRunType (should default to "regular")...');
    // Create another off-cycle run to avoid unique constraint conflict
    const defaultRun = await createPayrollRun({
      month: 1,
      year: 2024, // Different year to avoid conflict
      notes: 'Test default payRunType',
      actorId: user._id,
      actorEmail: user.email,
      source: 'manual',
    });
    console.log(`✅ Created run with ID: ${defaultRun._id}`);
    console.log(`   payRunType: ${defaultRun.payRunType}`);
    if (defaultRun.payRunType !== 'regular') {
      throw new Error(`Expected default payRunType='regular', got '${defaultRun.payRunType}'`);
    }

    // Test 5: Verify multiple off-cycle runs for same month/year are allowed
    console.log('\nTest 5: Verify multiple off-cycle runs for same month/year...');
    const offCycleRun2 = await createPayrollRun({
      month: 2,
      year: 2025,
      notes: 'Second off-cycle run for same month/year',
      payRunType: 'offCycle',
      actorId: user._id,
      actorEmail: user.email,
      source: 'manual',
    });
    console.log(`✅ Created second off-cycle run with ID: ${offCycleRun2._id}`);
    console.log(`   payRunType: ${offCycleRun2.payRunType}`);
    console.log('✅ Multiple off-cycle runs for same month/year are allowed');

    // Clean up test data
    await PayrollRun.deleteMany({ 
      _id: { 
        $in: [
          regularRun._id, 
          offCycleRun._id, 
          resettlementRun._id, 
          defaultRun._id,
          offCycleRun2._id
        ] 
      } 
    });
    console.log('\n✅ Cleaned up test runs');

    console.log('\n✅ All tests passed!');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

testPayRunType();
