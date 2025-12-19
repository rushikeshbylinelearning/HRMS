// backend/routes/leaves.js

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken');
const LeaveRequest = require('../models/LeaveRequest');
const Holiday = require('../models/Holiday');
const { sendEmail } = require('../services/mailService');
const Setting = require('../models/Setting');
const User = require('../models/User');
const NewNotificationService = require('../services/NewNotificationService');
const LeaveValidationService = require('../services/leaveValidationService');
const uploadMedicalCertificate = require('../middleware/uploadMedicalCertificate');

const formatLeaveDateRangeForEmail = (leaveDates) => {
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!leaveDates || leaveDates.length === 0) return 'N/A';
    const startDate = formatDate(leaveDates[0]);
    if (leaveDates.length === 1) return startDate;
    const endDate = formatDate(leaveDates[leaveDates.length - 1]);
    return `${startDate} to ${endDate}`;
};

const sendLeaveNotificationEmails = async (request, employee) => {
    try {
        let recipients = [];
        const hrEmailSetting = await Setting.findOne({ key: 'hrNotificationEmails' });

        if (hrEmailSetting && Array.isArray(hrEmailSetting.value) && hrEmailSetting.value.length > 0) {
            recipients = hrEmailSetting.value;
        } else if (process.env.HR_EMAILS) {
            recipients = process.env.HR_EMAILS.split(',').map(email => email.trim());
        }

        const dateRange = formatLeaveDateRangeForEmail(request.leaveDates);
        const reasonText = request.reason.replace(/\n/g, '<br>');

        if (recipients.length > 0) {
            const hrSubject = `Leave Request: ${employee.fullName} (${request.requestType}) for ${dateRange}`;
            const hrHtml = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #D32F2F; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px;">New Leave Request</h1>
                    </div>
                    <div style="padding: 20px;">
                        <p>A new leave request has been submitted by an employee. Please review it in the admin portal.</p>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                            <tr style="background-color: #f9f9f9;"><td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Employee:</td><td style="padding: 10px; border: 1px solid #eee;">${employee.fullName} (${employee.employeeCode})</td></tr>
                            <tr><td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Request Type:</td><td style="padding: 10px; border: 1px solid #eee;">${request.requestType}</td></tr>
                            <tr style="background-color: #f9f9f9;"><td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Date(s):</td><td style="padding: 10px; border: 1px solid #eee;">${dateRange}</td></tr>
                        </table>
                        <div style="margin-top: 20px;">
                            <strong style="color: #333;">Reason Provided:</strong>
                            <p style="padding: 15px; background-color: #f9f9f9; border-left: 4px solid #D32F2F; margin: 10px 0 0 0;">${reasonText}</p>
                        </div>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${process.env.FRONTEND_URL || 'https://attendance.bylinelms.com'}/admin/leaves" style="background-color: #D32F2F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review Request</a>
                        </div>
                    </div>
                    <div style="background-color: #f2f2f2; padding: 10px; text-align: center; font-size: 12px; color: #777;">
                        This is an automated notification from the AMS Portal.
                    </div>
                </div>`;
            await sendEmail({ to: recipients.join(','), subject: hrSubject, html: hrHtml, isHREmail: true });
        }

        const userSubject = `Your Leave Request for ${dateRange} has been submitted`;
        const userHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">Request Received</h1>
                </div>
                <div style="padding: 20px;">
                    <p>Hello ${employee.fullName},</p>
                    <p>This is a confirmation that your leave request has been successfully submitted and is now pending approval. You will receive another notification once it has been reviewed.</p>
                    <h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 25px;">Your Request Summary:</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <tr style="background-color: #f9f9f9;"><td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Request Type:</td><td style="padding: 10px; border: 1px solid #eee;">${request.requestType}</td></tr>
                        <tr><td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Date(s):</td><td style="padding: 10px; border: 1px solid #eee;">${dateRange}</td></tr>
                        <tr style="background-color: #f9f9f9;"><td style="padding: 10px; border: 1px solid #eee; font-weight: bold;">Status:</td><td style="padding: 10px; border: 1px solid #eee;">Pending</td></tr>
                    </table>
                </div>
                <div style="background-color: #f2f2f2; padding: 10px; text-align: center; font-size: 12px; color: #777;">
                    This is an automated notification. Please do not reply to this email.
                </div>
            </div>`;
        await sendEmail({ to: employee.email, subject: userSubject, html: userHtml });
    } catch (error) {
        console.error(`[Email Service] Failed to send emails for leave request ${request._id}:`, error);
    }
};

// GET /api/leaves/my-leave-balances
router.get('/my-leave-balances', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('leaveBalances');
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(user.leaveBalances);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch leave balances.' });
    }
});

// GET /api/leaves/holidays
router.get('/holidays', authenticateToken, async (req, res) => {
    try {
        const holidays = await Holiday.find().sort({ date: 'asc' });
        res.json(holidays);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch holidays.' });
    }
});

// POST /api/leaves/check-eligibility
// Check leave eligibility before applying (for frontend validation)
router.post('/check-eligibility', authenticateToken, async (req, res) => {
    const { requestType, leaveType, leaveDates, medicalCertificate } = req.body;
    const { userId } = req.user;

    if (!requestType || !leaveDates || leaveDates.length === 0 || !leaveType) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }

    try {
        const employee = await User.findById(userId);
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        // Convert string dates to Date objects
        const leaveDatesArray = leaveDates.map(date => new Date(date));

        const validation = await LeaveValidationService.validateLeaveRequest(
            employee,
            requestType,
            leaveDatesArray,
            leaveType,
            medicalCertificate
        );

        res.json({
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings,
            ...(validation.halfYearPeriod && { halfYearPeriod: validation.halfYearPeriod }),
            ...(validation.availableDays !== undefined && { availableDays: validation.availableDays }),
            ...(validation.usedDays !== undefined && { usedDays: validation.usedDays })
        });
    } catch (error) {
        console.error('Error checking leave eligibility:', error);
        res.status(500).json({ error: 'Internal server error while checking eligibility.' });
    }
});

// POST /api/leaves/request
router.post('/request', authenticateToken, async (req, res) => {
    const { requestType, leaveType, leaveDates, alternateDate, reason, medicalCertificate } = req.body;
    const { userId } = req.user;

    if (!requestType || !leaveDates || leaveDates.length === 0 || !reason || !leaveType) {
        return res.status(400).json({ error: 'Missing required fields for the request.' });
    }
    if (requestType === 'Compensatory' && !alternateDate) {
        return res.status(400).json({ error: 'Alternate date is required for a compensatory request.' });
    }

    try {
        const employee = await User.findById(userId);
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        // Restrict certain leave types for employees on probation
        // Probation employees may apply only for Unpaid or Compensatory leaves
        const isProbation = employee.employmentStatus === 'Probation';
        const restrictedForProbation = ['Planned', 'Sick', 'Casual'];
        if (isProbation && restrictedForProbation.includes(requestType)) {
            return res.status(403).json({ 
                error: 'You are currently on probation. Only Unpaid or Compensatory leave is allowed.' 
            });
        }

        // Convert string dates to Date objects
        const leaveDatesArray = leaveDates.map(date => new Date(date));

        // Validate leave request based on company policy
        const validation = await LeaveValidationService.validateLeaveRequest(
            employee,
            requestType,
            leaveDatesArray,
            leaveType,
            medicalCertificate
        );

        if (!validation.valid) {
            return res.status(400).json({ 
                error: validation.errors.join(' '),
                errors: validation.errors,
                warnings: validation.warnings
            });
        }

        // Show warnings but allow submission
        if (validation.warnings && validation.warnings.length > 0) {
            console.log(`Leave request warnings for user ${userId}:`, validation.warnings);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const firstLeaveDate = new Date(leaveDatesArray[0]);
        firstLeaveDate.setHours(0, 0, 0, 0);
        const isBackdated = firstLeaveDate < today;
        const finalRequestType = requestType === 'Backdate' ? 'Backdated Leave' : requestType;

        // Prepare leave request data
        const leaveRequestData = {
            employee: userId,
            requestType: finalRequestType,
            leaveType,
            leaveDates: leaveDatesArray,
            alternateDate: alternateDate ? new Date(alternateDate) : null,
            reason,
            isBackdated,
        };

        // Add medical certificate for sick leave
        if (requestType === 'Sick' && medicalCertificate) {
            leaveRequestData.medicalCertificate = medicalCertificate;
            leaveRequestData.appliedAfterReturn = validation.appliedAfterReturn || false;
        }

        // Add half-year period for planned leave
        if (requestType === 'Planned' && validation.halfYearPeriod) {
            leaveRequestData.halfYearPeriod = validation.halfYearPeriod;
        }

        const newRequest = await LeaveRequest.create(leaveRequestData);
        
        // --- NOTIFICATIONS ---
        // Asynchronously send emails
        sendLeaveNotificationEmails(newRequest, employee)
            .catch(err => console.error('Error in sendLeaveNotificationEmails:', err));
        
        // Send real-time notifications via socket
        const startDate = new Date(leaveDatesArray[0]).toLocaleDateString();
        const endDate = new Date(leaveDatesArray[leaveDatesArray.length - 1]).toLocaleDateString();
        NewNotificationService.notifyLeaveRequest(userId, employee.fullName, requestType, startDate, endDate)
            .catch(err => console.error('Error sending real-time leave request notification:', err));

        res.status(201).json({ 
            message: 'Request submitted successfully!', 
            request: newRequest,
            warnings: validation.warnings || []
        });
    } catch (error) {
        console.error('Error submitting leave request:', error);
        res.status(500).json({ error: 'Internal server error while submitting request.' });
    }
});

// POST /api/leaves/upload-medical-certificate
// Upload medical certificate for sick leave
router.post('/upload-medical-certificate', authenticateToken, uploadMedicalCertificate.single('medicalCertificate'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Medical certificate file is required.' });
        }

        const baseUrl = process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
        const fileUrl = `${baseUrl}/medical-certificates/${req.file.filename}`;

        res.json({
            message: 'Medical certificate uploaded successfully.',
            fileUrl: fileUrl
        });
    } catch (error) {
        console.error('Medical certificate upload error:', error);
        res.status(500).json({ error: 'Failed to upload medical certificate.' });
    }
});

// GET /api/leaves/my-requests
router.get('/my-requests', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const totalCount = await LeaveRequest.countDocuments({ employee: req.user.userId });
        const requests = await LeaveRequest.find({ employee: req.user.userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        res.json({
            requests,
            totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch your requests.' });
    }
});

// POST /api/leaves/year-end-request
// Employee submits Year-End leave request (Carry Forward or Encash)
router.post('/year-end-request', authenticateToken, async (req, res) => {
    const { leaveType, subType, days } = req.body;
    const { userId } = req.user;

    if (!leaveType || !subType || !days || days <= 0) {
        return res.status(400).json({ error: 'Missing required fields: leaveType, subType, and days.' });
    }

    if (!['CARRY_FORWARD', 'ENCASH'].includes(subType)) {
        return res.status(400).json({ error: 'Invalid subType. Must be CARRY_FORWARD or ENCASH.' });
    }

    if (!['Sick', 'Casual', 'Planned'].includes(leaveType)) {
        return res.status(400).json({ error: 'Invalid leaveType. Must be Sick, Casual, or Planned.' });
    }

    try {
        // CRITICAL YEAR-END REQUEST YEAR DETECTION:
        // Year-End requests are for the CLOSING year (the year that's ending)
        // If we're in December 2025, the request is for 2025 (closing year)
        // If we're in January 2026, we might still process 2025 year-end requests (late submissions)
        // Rule: Use current year if in December, otherwise use previous year if in January
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth(); // 0-11 (0 = January, 11 = December)
        
        // Determine the closing year for the year-end request
        // If we're in December, use current year (closing year)
        // If we're in January, use previous year (still processing last year's year-end)
        // Otherwise, use current year (assume we're processing current year's year-end)
        const closingYear = (currentMonth === 0) ? (currentYear - 1) : currentYear;
        
        // CRITICAL: Check for duplicate requests FIRST, before any other logic
        // This prevents duplicate submissions even if API is called manually
        const existingRequest = await LeaveRequest.findOne({
            employee: userId,
            requestType: 'YEAR_END',
            yearEndLeaveType: leaveType,
            yearEndYear: closingYear,
            status: { $in: ['Pending', 'Approved'] }
        });

        if (existingRequest) {
            return res.status(409).json({ 
                error: `Year-End request already submitted for ${leaveType} leave for ${closingYear}.`,
                existingRequest: {
                    _id: existingRequest._id,
                    status: existingRequest.status,
                    yearEndSubType: existingRequest.yearEndSubType,
                    yearEndDays: existingRequest.yearEndDays,
                    yearEndYear: existingRequest.yearEndYear
                }
            });
        }

        const employee = await User.findById(userId);
        if (!employee) return res.status(404).json({ error: 'Employee not found.' });

        // Check if Year-End feature is enabled
        const Setting = require('../models/Setting');
        const yearEndSetting = await Setting.findOne({ key: 'yearEndFeature' });
        if (!yearEndSetting || !yearEndSetting.value) {
            return res.status(403).json({ error: 'Year-End leave actions are currently disabled by Admin.' });
        }

        // Map leaveType to balance field
        const balanceField = leaveType === 'Sick' ? 'sick' : leaveType === 'Casual' ? 'casual' : 'paid';
        const remainingBalance = employee.leaveBalances[balanceField] || 0;

        if (remainingBalance <= 0) {
            return res.status(400).json({ error: `No remaining ${leaveType} leave balance available.` });
        }

        if (days > remainingBalance) {
            return res.status(400).json({ error: `Requested days (${days}) exceed remaining balance (${remainingBalance}).` });
        }

        // Create Year-End leave request
        // Store the closing year (e.g., 2025) - this is the year that's ending
        // The target year (e.g., 2026) will be calculated during approval
        const leaveRequestData = {
            employee: userId,
            requestType: 'YEAR_END',
            leaveType: 'Full Day', // Default for Year-End
            leaveDates: [], // Year-End doesn't use specific dates
            reason: `Year-End ${subType === 'CARRY_FORWARD' ? 'Carry Forward' : 'Encash'} request for ${leaveType} leave (${closingYear} → ${closingYear + 1})`,
            yearEndSubType: subType,
            yearEndLeaveType: leaveType,
            yearEndDays: days,
            yearEndYear: closingYear, // Store the closing year (e.g., 2025)
            status: 'Pending',
            isProcessed: false
        };

        const newRequest = await LeaveRequest.create(leaveRequestData);

        // Send notification to admins
        await NewNotificationService.broadcastToAdmins({
            message: `${employee.fullName} submitted a Year-End ${subType === 'CARRY_FORWARD' ? 'Carry Forward' : 'Encash'} request for ${days} day(s) of ${leaveType} leave.`,
            type: 'leave_request',
            category: 'leave',
            priority: 'high',
            navigationData: { 
                page: '/admin/leaves',
                params: { 
                    requestId: newRequest._id.toString(),
                    tab: 'year-end',
                    actionId: newRequest._id.toString()
                }
            },
            metadata: {
                type: 'YEAR_END_LEAVE',
                requestId: newRequest._id.toString(),
                targetTab: 'year-end'
            }
        }, userId);

        res.status(201).json({ 
            message: 'Year-End leave request submitted successfully!', 
            request: newRequest
        });
    } catch (error) {
        console.error('Error submitting Year-End leave request:', error);
        res.status(500).json({ error: 'Internal server error while submitting Year-End request.' });
    }
});

// GET /api/leaves/year-end-feature-status
// Check if Year-End feature is enabled
router.get('/year-end-feature-status', authenticateToken, async (req, res) => {
    try {
        const Setting = require('../models/Setting');
        const yearEndSetting = await Setting.findOne({ key: 'yearEndFeature' });
        res.json({ enabled: yearEndSetting ? yearEndSetting.value : false });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Year-End feature status.' });
    }
});

module.exports = router;