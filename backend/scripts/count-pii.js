// Temporary script: count encrypted PII records — spec-a Fix 4 verification
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('users');
  const count = await col.countDocuments({
    $or: [
      { 'identityDetails.aadhaarNumber': { $exists: true, $ne: null, $ne: '' } },
      { 'identityDetails.panCardNumber': { $exists: true, $ne: null, $ne: '' } },
      { 'identityDetails.accountNumber': { $exists: true, $ne: null, $ne: '' } }
    ]
  });
  console.log('ENCRYPTED_PII_COUNT:', count);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
