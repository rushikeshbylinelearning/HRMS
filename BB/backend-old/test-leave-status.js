// Test script to identify the leave status update error
const mongoose = require('mongoose');
require('dotenv').config();

async function testLeaveStatusUpdate() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database');

        // Load models
        const LeaveRequest = require('./models/LeaveRequest');
        const User = require('./models/User');
        const LeavePolicyService = require('./services/LeavePolicyService');

        const leaveId = '6953970044a72dcbc91dbf49';
        
        // Check if leave request exists
        const request = await LeaveRequest.findById(leaveId);
        if (!request) {
            console.error('❌ Leave request not found');
            process.exit(1);
        }
        
        console.log('✅ Leave request found:', {
            id: request._id,
            employee: request.employee,
            requestType: request.requestType,
            status: request.status,
            leaveDates: request.leaveDates,
            leaveType: request.leaveType
        });

        // Check if employee exists
        const employee = await User.findById(request.employee);
        if (!employee) {
            console.error('❌ Employee not found');
            process.exit(1);
        }
        
        console.log('✅ Employee found:', {
            id: employee._id,
            name: employee.fullName,
            role: employee.role
        });

        // Test policy validation
        console.log('\n🔍 Testing policy validation...');
        const policyCheck = await LeavePolicyService.validateRequest(
            request.employee,
            request.leaveDates,
            request.requestType,
            request.leaveType,
            null // No override reason
        );
        
        console.log('Policy check result:', policyCheck);

        console.log('\n✅ All checks passed! The route should work.');
        
    } catch (error) {
        console.error('❌ Error during test:', error);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

testLeaveStatusUpdate();
