// backend/scripts/create-public-form-indexes.js
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');

async function createPublicFormIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await connectDB();
    
    const db = mongoose.connection.db;
    
    console.log('\n📊 Creating indexes for EmployeePublicToken collection...');
    
    // EmployeePublicToken indexes
    await db.collection('employeepublictokens').createIndex(
      { token: 1 }, 
      { unique: true, background: true }
    );
    console.log('✅ Created unique index on token');
    
    await db.collection('employeepublictokens').createIndex(
      { employeeId: 1 }, 
      { background: true }
    );
    console.log('✅ Created index on employeeId');
    
    await db.collection('employeepublictokens').createIndex(
      { expiresAt: 1 }, 
      { expireAfterSeconds: 0, background: true }
    );
    console.log('✅ Created TTL index on expiresAt (auto-cleanup)');
    
    await db.collection('employeepublictokens').createIndex(
      { token: 1, isUsed: 1, expiresAt: 1 }, 
      { background: true }
    );
    console.log('✅ Created compound index on token + isUsed + expiresAt');
    
    console.log('\n📊 Creating indexes for ProfileSubmissionAudit collection...');
    
    // ProfileSubmissionAudit indexes
    await db.collection('profilesubmissionaudits').createIndex(
      { employeeId: 1, createdAt: -1 }, 
      { background: true }
    );
    console.log('✅ Created compound index on employeeId + createdAt');
    
    await db.collection('profilesubmissionaudits').createIndex(
      { action: 1, createdAt: -1 }, 
      { background: true }
    );
    console.log('✅ Created compound index on action + createdAt');
    
    await db.collection('profilesubmissionaudits').createIndex(
      { token: 1 }, 
      { background: true }
    );
    console.log('✅ Created index on token');
    
    console.log('\n✅ All indexes created successfully!');
    
    // List all indexes
    console.log('\n📋 Current indexes:');
    console.log('\nEmployeePublicToken:');
    const tokenIndexes = await db.collection('employeepublictokens').indexes();
    tokenIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    console.log('\nProfileSubmissionAudit:');
    const auditIndexes = await db.collection('profilesubmissionaudits').indexes();
    auditIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
}

createPublicFormIndexes();
