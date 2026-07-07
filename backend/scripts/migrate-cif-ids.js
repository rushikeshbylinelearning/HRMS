/**
 * Migration Script: Add CIF IDs to existing CIF records
 * 
 * This script:
 * 1. Finds all CIF records without cifId
 * 2. Generates sequential CIF IDs (BYL_CIF_01, BYL_CIF_02, etc.)
 * 3. Updates records with new IDs
 * 4. Creates/updates counter for future records
 */

require('dotenv').config();
const mongoose = require('mongoose');
const CIF = require('../modules/cif/cif.model');
const Counter = require('../models/Counter');

const migrateCIFIds = async () => {
  try {
    console.log('🚀 Starting CIF ID migration...\n');

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables. Check .env file.');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');

    // Find all CIF records without cifId
    const cifsWithoutId = await CIF.find({
      $or: [
        { cifId: { $exists: false } },
        { cifId: null },
        { cifNumber: { $exists: false } },
        { cifNumber: null }
      ]
    }).sort({ createdAt: 1 });

    console.log(`📊 Found ${cifsWithoutId.length} CIF records without IDs\n`);

    if (cifsWithoutId.length === 0) {
      console.log('✅ All CIF records already have IDs. No migration needed.');
      process.exit(0);
    }

    // Get current counter value or start from 0
    let counter = await Counter.findOne({ name: 'cif' });
    let currentValue = counter ? counter.value : 0;

    console.log(`📈 Starting from counter value: ${currentValue}\n`);

    // Update each CIF record
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
      console.log(`✅ Updated CIF ${cif._id} → ${cifId}`);
    }

    // Update counter
    await Counter.findOneAndUpdate(
      { name: 'cif' },
      { $set: { value: currentValue } },
      { upsert: true }
    );

    console.log(`\n✅ Migration complete!`);
    console.log(`📊 Updated ${updated} CIF records`);
    console.log(`📈 Counter set to: ${currentValue}`);
    console.log(`🎯 Next CIF ID will be: BYL_CIF_${String(currentValue + 1).padStart(2, '0')}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateCIFIds();
