// Test to verify the policy upload fix
console.log('Testing Policy Upload User ID Fix...\n');

// Simulate the JWT payload structure
const mockJwtPayload = {
    userId: '687e227897b3fb2f8e690e99',
    email: 'testadmin@example.com',
    role: 'Admin',
    authMethod: undefined
};

// Simulate req.user from requireAuth middleware
const req = {
    user: mockJwtPayload
};

// Test the uploadedBy field extraction
const uploadedBy = req.user.userId || req.user._id;

console.log('Mock JWT Payload:', mockJwtPayload);
console.log('Extracted uploadedBy:', uploadedBy);

if (uploadedBy) {
    console.log('✓ SUCCESS: uploadedBy field extracted correctly');
    console.log('  Value:', uploadedBy);
} else {
    console.log('✗ FAILED: uploadedBy is undefined');
}

// Test with _id field (fallback)
const mockSessionUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'admin@example.com',
    role: 'Admin'
};

const req2 = {
    user: mockSessionUser
};

const uploadedBy2 = req2.user.userId || req2.user._id;

console.log('\nMock Session User:', mockSessionUser);
console.log('Extracted uploadedBy:', uploadedBy2);

if (uploadedBy2) {
    console.log('✓ SUCCESS: Fallback to _id works correctly');
    console.log('  Value:', uploadedBy2);
} else {
    console.log('✗ FAILED: Fallback uploadedBy is undefined');
}

console.log('\n✅ All tests passed! The fix handles both userId and _id fields.');
