// Test script for CIF attachment upload
// Run with: node test-cif-attachment-upload.js

require('dotenv').config();
const mongoose = require('mongoose');

async function testAttachmentUpload() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Load models
    const CIF = require('./modules/cif/cif.model');
    const CIFAttachment = require('./modules/cif/cifAttachment.model');
    const User = require('./models/User');

    // Find a test CIF
    const testCIF = await CIF.findOne({ isArchived: false }).lean();
    if (!testCIF) {
      console.error('❌ No CIF records found. Create a CIF first.');
      process.exit(1);
    }
    console.log('✅ Found test CIF:', testCIF._id);

    // Find a test user
    const testUser = await User.findOne({ role: { $in: ['Admin', 'HR'] } }).lean();
    if (!testUser) {
      console.error('❌ No Admin/HR user found.');
      process.exit(1);
    }
    console.log('✅ Found test user:', testUser.fullName);

    // Test creating an attachment record
    console.log('\nTesting attachment creation...');
    const testAttachment = {
      cifId: testCIF._id,
      fileName: 'test-file-' + Date.now() + '.pdf',
      originalName: 'test-document.pdf',
      fileType: 'application/pdf',
      fileSize: 12345,
      filePath: '/uploads/cif-attachments/test-file.pdf',
      uploadedBy: testUser._id
    };

    console.log('Creating attachment with data:', testAttachment);
    const attachment = await CIFAttachment.create(testAttachment);
    console.log('✅ Attachment created successfully:', attachment._id);

    // Test populating
    const populated = await CIFAttachment.findById(attachment._id)
      .populate('uploadedBy', 'fullName email')
      .lean();
    console.log('✅ Populated attachment:', {
      id: populated._id,
      fileName: populated.fileName,
      uploader: populated.uploadedBy?.fullName
    });

    // Clean up
    await CIFAttachment.deleteOne({ _id: attachment._id });
    console.log('✅ Test attachment deleted');

    console.log('\n✅ All tests passed!');
    console.log('\nIf this works, the issue is likely with:');
    console.log('1. The upload middleware not setting req.files correctly');
    console.log('2. The authentication middleware not setting req.user correctly');
    console.log('3. File upload permissions on the uploads directory');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAttachmentUpload();
