/**
 * migrate-payrollrun-index.js
 * 
 * Drops the old month_1_year_1 unique index and ensures the new partial index is created.
 * This is required for Phase 1 of Pay Run Feature Parity.
 * 
 * The old index was: { month: 1, year: 1 } unique (applied to ALL runs)
 * The new index is: { month: 1, year: 1 } unique with partialFilterExpression: { payRunType: 'regular' }
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI;

async function migrateIndex() {
  console.log('🔧 PayrollRun Index Migration\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('payrollruns');

    // Get current indexes
    console.log('Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '');
    });
    console.log();

    // Drop the old month_1_year_1 index if it exists
    const oldIndexName = 'month_1_year_1';
    const hasOldIndex = indexes.some(idx => idx.name === oldIndexName);

    if (hasOldIndex) {
      console.log(`Dropping old index: ${oldIndexName}`);
      await collection.dropIndex(oldIndexName);
      console.log('✅ Old index dropped\n');
    } else {
      console.log(`ℹ️  Old index ${oldIndexName} not found (already removed)\n`);
    }

    // Ensure the new partial index exists
    const newIndexName = 'unique_regular_run_per_month';
    const hasNewIndex = indexes.some(idx => idx.name === newIndexName);

    if (!hasNewIndex) {
      console.log(`Creating new partial index: ${newIndexName}`);
      await collection.createIndex(
        { month: 1, year: 1 },
        {
          unique: true,
          partialFilterExpression: { payRunType: 'regular' },
          name: newIndexName,
        }
      );
      console.log('✅ New partial index created\n');
    } else {
      console.log(`ℹ️  New partial index ${newIndexName} already exists\n`);
    }

    // Verify final index state
    console.log('Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '');
      if (idx.partialFilterExpression) {
        console.log(`    partialFilterExpression:`, JSON.stringify(idx.partialFilterExpression));
      }
    });

    console.log('\n✅ Index migration completed successfully');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

migrateIndex()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
