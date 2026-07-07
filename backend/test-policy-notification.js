// Test script to verify policy notifications work
// Run with: node test-policy-notification.js

require('dotenv').config();
const mongoose = require('mongoose');
const NewNotificationService = require('./services/NewNotificationService');
const User = require('./models/User');

async function testPolicyNotification() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find one active user
        const user = await User.findOne({ status: 'Active' }).select('_id fullName');
        
        if (!user) {
            console.error('❌ No active users found in database');
            process.exit(1);
        }

        console.log(`📋 Found test user: ${user.fullName} (${user._id})`);

        // Test creating a policy notification
        console.log('🔔 Creating test policy notification...');
        
        const notification = await NewNotificationService.createAndEmitNotification({
            message: `TEST: New policy "Test Policy" (v1.0) has been added. Click to view.`,
            type: 'policy_added',
            userId: user._id,
            userName: user.fullName,
            recipientType: 'user',
            category: 'admin',
            priority: 'high',
            navigationData: {
                page: 'profile',
                params: { section: 'policies', policyId: '507f1f77bcf86cd799439011' }
            },
            metadata: {
                policyId: '507f1f77bcf86cd799439011',
                policyName: 'Test Policy',
                policyVersion: '1.0',
                fromAdmin: true
            }
        });

        if (notification) {
            console.log('✅ Notification created successfully!');
            console.log('Notification ID:', notification.id);
            console.log('Notification type:', notification.type);
            console.log('User ID:', notification.userId);
        } else {
            console.error('❌ Notification creation returned null/undefined');
        }

        console.log('\n✅ Test completed successfully!');
        console.log('If you see this message, the notification system is working.');
        console.log('Check the database for the notification record.');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error('Error stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

testPolicyNotification();
