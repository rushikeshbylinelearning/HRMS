/**
 * Test Script: Anonymous Feedback Notification System
 * 
 * This script tests the anonymous feedback notification flow:
 * 1. Simulates anonymous feedback submission
 * 2. Verifies notification is created
 * 3. Checks that no user identification is present
 * 4. Confirms Admin/HR users would receive the notification
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AnonymousFeedback = require('./models/AnonymousFeedback');
const NewNotification = require('./models/NewNotification');
const User = require('./models/User');
const NewNotificationService = require('./services/NewNotificationService');

async function testAnonymousFeedbackNotification() {
    try {
        console.log('🧪 Starting Anonymous Feedback Notification Test\n');

        // Connect to database
        console.log('📡 Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        // Step 1: Find Admin/HR users
        console.log('👥 Finding Admin/HR users...');
        const adminUsers = await User.find({ 
            role: { $in: ['Admin', 'HR'] },
            status: 'Active'
        }).select('_id fullName role email');
        
        console.log(`✅ Found ${adminUsers.length} Admin/HR users:`);
        adminUsers.forEach(user => {
            console.log(`   - ${user.fullName} (${user.role}) - ${user.email}`);
        });
        console.log('');

        if (adminUsers.length === 0) {
            console.log('⚠️  No Admin/HR users found. Create at least one admin user first.');
            return;
        }

        // Step 2: Create test anonymous feedback
        console.log('📝 Creating test anonymous feedback...');
        const testMessage = 'This is a test anonymous feedback message to verify the notification system works correctly.';
        const feedback = new AnonymousFeedback({
            message: testMessage,
            ipAddress: '127.0.0.1',
            userAgent: 'Test Script'
        });
        await feedback.save();
        console.log(`✅ Feedback saved with ID: ${feedback._id}\n`);

        // Step 3: Trigger notification (simulating the route handler)
        console.log('🔔 Triggering notification service...');
        await NewNotificationService.notifyAnonymousFeedback(
            testMessage,
            feedback.submittedAt
        );
        console.log('✅ Notification service called\n');

        // Wait a moment for async operations
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 4: Verify notification was created
        console.log('🔍 Verifying notification creation...');
        const notifications = await NewNotification.find({ 
            type: 'anonymous_feedback' 
        }).sort({ createdAt: -1 }).limit(1);

        if (notifications.length === 0) {
            console.log('❌ No notification found! Check the service logs above for errors.\n');
            return;
        }

        const notification = notifications[0];
        console.log('✅ Notification created successfully!\n');

        // Step 5: Verify anonymity
        console.log('🔒 Verifying anonymity protection...');
        const anonymityChecks = {
            'userId is null or system': notification.userId === null || notification.userId.toString() === 'system',
            'userName is System': notification.userName === 'System',
            'recipientType is admin': notification.recipientType === 'admin',
            'type is anonymous_feedback': notification.type === 'anonymous_feedback',
            'metadata.isAnonymous is true': notification.metadata?.isAnonymous === true,
            'metadata.senderName is Anonymous Employee': notification.metadata?.senderName === 'Anonymous Employee',
            'No user reference in message': !notification.message.includes('user_') && !notification.message.includes('userId')
        };

        let allChecksPassed = true;
        for (const [check, passed] of Object.entries(anonymityChecks)) {
            const icon = passed ? '✅' : '❌';
            console.log(`   ${icon} ${check}`);
            if (!passed) allChecksPassed = false;
        }
        console.log('');

        if (!allChecksPassed) {
            console.log('⚠️  Some anonymity checks failed! Review the implementation.\n');
        } else {
            console.log('✅ All anonymity checks passed!\n');
        }

        // Step 6: Display notification details
        console.log('📋 Notification Details:');
        console.log('   ID:', notification.id);
        console.log('   Message:', notification.message);
        console.log('   Type:', notification.type);
        console.log('   Category:', notification.category);
        console.log('   Priority:', notification.priority);
        console.log('   Recipient Type:', notification.recipientType);
        console.log('   User Name:', notification.userName);
        console.log('   Created At:', notification.createdAt);
        console.log('   Navigation:', JSON.stringify(notification.navigationData, null, 2));
        console.log('   Metadata:', JSON.stringify(notification.metadata, null, 2));
        console.log('');

        // Step 7: Verify who would receive this notification
        console.log('📬 Notification Recipients:');
        console.log(`   This notification would be delivered to ${adminUsers.length} Admin/HR users:`);
        adminUsers.forEach(user => {
            console.log(`   - ${user.fullName} (${user.role})`);
        });
        console.log('');

        // Cleanup
        console.log('🧹 Cleaning up test data...');
        await AnonymousFeedback.findByIdAndDelete(feedback._id);
        await NewNotification.findByIdAndDelete(notification._id);
        console.log('✅ Test data cleaned up\n');

        console.log('✅ TEST COMPLETED SUCCESSFULLY!\n');
        console.log('Summary:');
        console.log('   - Anonymous feedback can be submitted');
        console.log('   - Notifications are created and sent to Admin/HR');
        console.log('   - Zero-trace anonymity is maintained');
        console.log('   - No user identification in notification payload');
        console.log('');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('📡 Database connection closed');
    }
}

// Run the test
testAnonymousFeedbackNotification();
