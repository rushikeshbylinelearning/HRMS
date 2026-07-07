/**
 * Fix Script: Complete CIF ID Setup
 * 
 * This script:
 * 1. Verifies Counter model is working
 * 2. Migrates existing CIF records
 * 3. Tests new CIF creation
 */

require('dotenv').config();
const mongoose = require('mongoose');
const CIF = require('../modules/cif/cif.model');
const Counter = require('../models/Counter');

const fixCIFIds = async () => {
  try {
    console.log('🔧 Starting CIF ID Fix...\n');

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables. Check .env file.');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');

    // Step 1: Check Counter model
    console.log('📊 Step 1: Checking Counter model...');
    let counter = await Counter.findOne({ name: 'cif' });
    if (!counter) {
      console.log('   Creating new counter...');
      counter = await Counter.create({ name: 'cif', value: 0 });
    }
    console.log(`   Current counter value: ${counter.value}\n`);

    // Step 2: Find CIFs without IDs
    console.log('📊 Step 2: Finding CIFs without IDs...');
    const cifsWithoutId = await CIF.find({
      $or: [
        { cifId: { $exists: false } },
        { cifId: null },
        { cifId: '' }
      ]
    }).sort({ createdAt: 1 });

    console.log(`   Found ${cifsWithoutId.length} CIF records without IDs\n`);

    if (cifsWithoutId.length === 0) {
      console.log('✅ All CIF records already have IDs!\n');
      
      // Show sample CIFs
      const sampleCIFs = await CIF.find({ cifId: { $exists: true } })
        .limit(5)
        .select('cifId cifNumber title')
        .lean();
      
      console.log('📋 Sample CIF IDs:');
      sampleCIFs.forEach(cif => {
        console.log(`   ${cif.cifId} - ${cif.title}`);
      });
      
      process.exit(0);
    }

    // Step 3: Migrate CIFs
    console.log('📊 Step 3: Migrating CIF records...');
    let currentValue = counter.value;
    let updated = 0;

    for (const cif of cifsWithoutId) {
      currentValue++;
      const paddedNumber = String(currentValue).padStart(2, '0');
      const cifId = `BYL_CIF_${paddedNumber}`;

      await CIF.updateOne(
        { _id: cif._id },
        {
          $set: {
            cifNumber: currentValue,
            cifId: cifId
          }
        }
      );

      updated++;
      console.log(`   ✅ ${cif._id} → ${cifId}`);
    }

    // Step 4: Update counter
    console.log('\n📊 Step 4: Updating counter...');
    await Counter.findOneAndUpdate(
      { name: 'cif' },
      { $set: { value: currentValue } }
    );
    console.log(`   Counter updated to: ${currentValue}\n`);

    // Step 5: Verify
    console.log('📊 Step 5: Verifying migration...');
    const totalCIFs = await CIF.countDocuments();
    const cifsWithIds = await CIF.countDocuments({ cifId: { $exists: true, $ne: null } });
    
    console.log(`   Total CIFs: ${totalCIFs}`);
    console.log(`   CIFs with IDs: ${cifsWithIds}`);
    
    if (totalCIFs === cifsWithIds) {
      console.log('   ✅ All CIFs have IDs!\n');
    } else {
      console.log(`   ⚠️  ${totalCIFs - cifsWithIds} CIFs still missing IDs\n`);
    }

    // Show sample
    console.log('📋 Sample migrated CIFs:');
    const samples = await CIF.find({ cifId: { $exists: true } })
      .sort({ cifNumber: 1 })
      .limit(5)
      .select('cifId cifNumber title')
      .lean();
    
    samples.forEach(cif => {
      console.log(`   ${cif.cifId} (${cif.cifNumber}) - ${cif.title}`);
    });

    console.log('\n✅ Migration complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Updated ${updated} CIF records`);
    console.log(`   - Counter value: ${currentValue}`);
    console.log(`   - Next CIF ID: BYL_CIF_${String(currentValue + 1).padStart(2, '0')}`);
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Restart backend server: pm2 restart backend');
    console.log('   2. Clear browser cache');
    console.log('   3. Create a new CIF to test');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
};

// Run migration
fixCIFIds();
