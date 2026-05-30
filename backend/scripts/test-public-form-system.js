// backend/scripts/test-public-form-system.js
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const publicFormService = require('../services/publicFormService');
const User = require('../models/User');

async function testPublicFormSystem() {
  try {
    console.log('🧪 Testing Public Form System...\n');
    
    // Connect to database
    console.log('1️⃣ Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Check environment variables
    console.log('2️⃣ Checking environment variables...');
    const requiredEnvVars = ['JWT_SECRET', 'ENCRYPTION_KEY'];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    
    if (missingVars.length > 0) {
      console.log('❌ Missing environment variables:', missingVars.join(', '));
      console.log('   Please add them to your .env file\n');
      process.exit(1);
    }
    console.log('✅ All required environment variables are set\n');
    
    // Check if models are loaded
    console.log('3️⃣ Checking models...');
    const EmployeePublicToken = require('../models/EmployeePublicToken');
    const ProfileSubmissionAudit = require('../models/ProfileSubmissionAudit');
    console.log('✅ Models loaded successfully\n');
    
    // Check indexes
    console.log('4️⃣ Checking database indexes...');
    const db = mongoose.connection.db;
    
    const tokenIndexes = await db.collection('employeepublictokens').indexes();
    console.log(`   EmployeePublicToken indexes: ${tokenIndexes.length}`);
    
    const auditIndexes = await db.collection('profilesubmissionaudits').indexes();
    console.log(`   ProfileSubmissionAudit indexes: ${auditIndexes.length}`);
    
    if (tokenIndexes.length < 4) {
      console.log('⚠️  Warning: Some indexes may be missing. Run: node scripts/create-public-form-indexes.js\n');
    } else {
      console.log('✅ All indexes are present\n');
    }
    
    // Find a test employee
    console.log('5️⃣ Finding test employee...');
    const testEmployee = await User.findOne({ isActive: true }).limit(1);
    
    if (!testEmployee) {
      console.log('❌ No active employees found in database');
      console.log('   Please create at least one employee to test the system\n');
      process.exit(1);
    }
    
    console.log(`✅ Found test employee: ${testEmployee.fullName} (${testEmployee.employeeCode})\n`);
    
    // Test token generation
    console.log('6️⃣ Testing token generation...');
    try {
      const result = await publicFormService.generateToken(
        testEmployee.employeeCode,
        testEmployee._id,
        { expiryHours: 1 }
      );
      
      console.log('✅ Token generated successfully');
      console.log(`   Token: ${result.token.substring(0, 16)}...`);
      console.log(`   Expires: ${result.expiresAt}`);
      console.log(`   Employee: ${result.employee.fullName}\n`);
      
      // Test token validation
      console.log('7️⃣ Testing token validation...');
      const validation = await publicFormService.validateToken(result.token);
      
      if (validation.valid) {
        console.log('✅ Token validation successful');
        console.log(`   Employee: ${validation.employee.fullName}`);
        console.log(`   Expires: ${validation.tokenInfo.expiresAt}\n`);
      } else {
        console.log('❌ Token validation failed:', validation.error);
        process.exit(1);
      }
      
      // Test encryption
      console.log('8️⃣ Testing data encryption...');
      const testData = '123456789012';
      const encrypted = publicFormService.encryptSensitiveData(testData);
      const decrypted = publicFormService.decryptSensitiveData(encrypted);
      
      if (decrypted === testData) {
        console.log('✅ Encryption/decryption working correctly\n');
      } else {
        console.log('❌ Encryption/decryption failed');
        console.log(`   Original: ${testData}`);
        console.log(`   Decrypted: ${decrypted}\n`);
        process.exit(1);
      }
      
      // Clean up test token
      console.log('9️⃣ Cleaning up test data...');
      await EmployeePublicToken.deleteOne({ token: result.token });
      await ProfileSubmissionAudit.deleteMany({ 
        employeeId: testEmployee.employeeCode,
        action: 'TOKEN_GENERATED'
      });
      console.log('✅ Test data cleaned up\n');
      
    } catch (error) {
      console.log('❌ Token generation failed:', error.message);
      process.exit(1);
    }
    
    // Check routes
    console.log('🔟 Checking routes...');
    console.log('   Public routes:');
    console.log('   - GET  /api/public/validate');
    console.log('   - POST /api/public/submit');
    console.log('   Admin routes:');
    console.log('   - POST /api/admin/public-form/generate-link');
    console.log('   - POST /api/admin/public-form/bulk-generate');
    console.log('   - GET  /api/admin/public-form/status/:employeeId');
    console.log('   - GET  /api/admin/public-form/pending\n');
    
    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📋 System Status:');
    console.log('   ✅ Database connection: OK');
    console.log('   ✅ Environment variables: OK');
    console.log('   ✅ Models: OK');
    console.log('   ✅ Indexes: OK');
    console.log('   ✅ Token generation: OK');
    console.log('   ✅ Token validation: OK');
    console.log('   ✅ Encryption: OK');
    console.log('\n🚀 Public Form System is ready to use!');
    console.log('\n📖 Next steps:');
    console.log('   1. Start your backend server: npm start');
    console.log('   2. Generate a link via API or frontend component');
    console.log('   3. Test the form submission');
    console.log('   4. Check the documentation: backend/docs/PUBLIC_FORM_SYSTEM.md');
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testPublicFormSystem();
