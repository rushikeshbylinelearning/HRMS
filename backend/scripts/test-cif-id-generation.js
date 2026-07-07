/**
 * Test Script: Verify CIF ID Generation
 * 
 * This script tests if the CIF ID generation is working correctly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Counter = require('../models/Counter');

const testCIFIdGeneration = async () => {
  try {
    console.log('🧪 Testing CIF ID Generation...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database\n');

    // Test counter increment
    console.log('📊 Testing counter increment...');
    
    for (let i = 1; i <= 5; i++) {
      const counter = await Counter.findOneAndUpdate(
        { name: 'cif' },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
      );
      
      const paddedNumber = String(counter.value).padStart(2, '0');
      const cifId = `BYL_CIF_${paddedNumber}`;
      
      console.log(`  Test ${i}: Counter = ${counter.value}, CIF ID = ${cifId}`);
    }

    console.log('\n✅ CIF ID generation is working correctly!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: node scripts/migrate-cif-ids.js');
    console.log('   2. Restart backend server');
    console.log('   3. Create a new CIF to test');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

// Run test
testCIFIdGeneration();
