// Test script to verify policies routes are properly configured
const express = require('express');
const path = require('path');

console.log('Testing Policies Routes Configuration...\n');

// Test 1: Check if Policy model exists
try {
    const Policy = require('./models/Policy');
    console.log('✓ Policy model loaded successfully');
    console.log('  Schema fields:', Object.keys(Policy.schema.paths).join(', '));
} catch (error) {
    console.error('✗ Failed to load Policy model:', error.message);
}

// Test 2: Check if AnonymousFeedback model exists
try {
    const AnonymousFeedback = require('./models/AnonymousFeedback');
    console.log('✓ AnonymousFeedback model loaded successfully');
    console.log('  Schema fields:', Object.keys(AnonymousFeedback.schema.paths).join(', '));
} catch (error) {
    console.error('✗ Failed to load AnonymousFeedback model:', error.message);
}

// Test 3: Check if policies routes file exists
try {
    const policiesRoutes = require('./routes/policies');
    console.log('✓ Policies routes loaded successfully');
    console.log('  Route type:', typeof policiesRoutes);
} catch (error) {
    console.error('✗ Failed to load policies routes:', error.message);
}

// Test 4: Check if policies directory exists
const fs = require('fs');
const policiesDir = path.join(__dirname, 'public', 'policies');
if (fs.existsSync(policiesDir)) {
    console.log('✓ Policies directory exists:', policiesDir);
} else {
    console.log('✗ Policies directory does not exist:', policiesDir);
}

// Test 5: Check if multer is installed
try {
    const multer = require('multer');
    console.log('✓ Multer package is installed');
} catch (error) {
    console.error('✗ Multer package is not installed:', error.message);
}

console.log('\nAll tests completed!');
