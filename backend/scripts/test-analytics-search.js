/**
 * Test script to verify analytics search functionality
 * 
 * Usage: node backend/scripts/test-analytics-search.js
 */

require('dotenv').config({ path: './backend/.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

async function testSearchQuery() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Test search query
        const searchTerm = 'test'; // Change this to test different searches
        const searchRegex = new RegExp(searchTerm, 'i');
        
        const query = {
            role: { $ne: 'Admin' },
            isActive: true,
            $or: [
                { fullName: searchRegex },
                { employeeCode: searchRegex }
            ]
        };
        
        console.log('\n🔍 Testing search query:', JSON.stringify(query, null, 2));
        
        const results = await User.find(query)
            .select('fullName employeeCode department')
            .limit(10)
            .lean();
        
        console.log(`\n✅ Found ${results.length} employees matching "${searchTerm}":`);
        results.forEach(emp => {
            console.log(`  - ${emp.fullName} (${emp.employeeCode}) - ${emp.department}`);
        });
        
        // Test without search
        const allQuery = {
            role: { $ne: 'Admin' },
            isActive: true
        };
        
        const allCount = await User.countDocuments(allQuery);
        console.log(`\n📊 Total active employees (excluding admins): ${allCount}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

testSearchQuery();
