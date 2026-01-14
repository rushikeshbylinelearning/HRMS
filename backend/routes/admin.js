// backend/routes/admin.js

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// --- Middleware ---
const authenticateToken = require('../middleware/authenticateToken');

// --- Models ---
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const AttendanceSession = require('../models/AttendanceSession');
const LeaveRequest = require('../models/LeaveRequest');
const LeavePolicyService = require('../services/LeavePolicyService');
const ExtraBreakRequest = require('../models/ExtraBreakRequest');
const BreakLog = require('../models/BreakLog');
const Holiday = require('../models/Holiday');
const Setting = require('../models/Setting');
const NewNotificationService = require('../services/NewNotificationService');
const { getUserDailyStatus, recalculateLateStatus, getUsersDailyStatusBatch } = require('../services/dailyStatusService');
const { syncAttendanceOnLeaveApproval, syncAttendanceOnLeaveRejection } = require('../services/leaveAttendanceSyncService');
const { invalidateUserLeaves } = require('../services/leaveCache');
const { invalidateStatus, invalidateUserStatus } = require('../services/statusCache');
const { getISTDateString, startOfISTDay } = require('../utils/istTime');

// Middleware to check for Admin/HR role
const isAdminOrHr = async (req, res, next) => {
    // CRITICAL FIX: Check if req.user exists before accessing role
    // This prevents 403 errors when authentication fails or user object is missing
    if (!req.user) {
        console.error('[isAdminOrHr] req.user is missing - authentication may have failed');
        return res.status(401).json({ error: 'Authentication required. Please log in again.' });
    }

    // Check role with better error logging
    let userRole = req.user.role;

    // If role is missing from token, fetch from database as fallback
    if (!userRole && req.user.userId) {
        try {
            const dbUser = await User.findById(req.user.userId).select('role').lean();
            if (dbUser && dbUser.role) {
                userRole = dbUser.role;
                // Update req.user.role for consistency
                req.user.role = userRole;
                console.log('[isAdminOrHr] Fetched role from database:', userRole);
            }
        } catch (error) {
            console.error('[isAdminOrHr] Error fetching user role from database:', error);
        }
    }

    if (!userRole) {
        console.error('[isAdminOrHr] req.user.role is missing for user:', req.user.userId || req.user.email);
        return res.status(403).json({ error: 'User role not found. Please contact administrator.' });
    }

    // Normalize role (trim whitespace, handle case sensitivity)
    const normalizedRole = String(userRole).trim();
    if (!['Admin', 'HR'].includes(normalizedRole)) {
        console.warn('[isAdminOrHr] Access denied - User role:', normalizedRole, 'User ID:', req.user.userId || req.user.email);
        return res.status(403).json({
            error: 'Access forbidden: Requires Admin or HR role.'
        });
    }

    next();
};

// --- LEAVE MANAGEMENT ROUTES ---

// GET /api/admin/leaves/all
router.get('/leaves/all', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { role } = req.query; // Optional: 'Employee' or 'Intern' to filter by role

        // Exclude YEAR_END requests from normal leave requests
        const baseQuery = { requestType: { $ne: 'YEAR_END' } };

        // If role filter is provided, use aggregation to filter by employee role
        if (role && (role === 'Employee' || role === 'Intern')) {
            // Use aggregation to filter by employee role at database level
            const matchStage = { ...baseQuery };

            const pipeline = [
                { $match: matchStage },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'employee',
                        foreignField: '_id',
                        as: 'employeeData'
                    }
                },
                { $unwind: '$employeeData' },
                { $match: { 'employeeData.role': role } },
                {
                    $project: {
                        employee: {
                            _id: '$employeeData._id',
                            fullName: '$employeeData.fullName',
                            employeeCode: '$employeeData.employeeCode'
                        },
                        requestType: 1,
                        leaveType: 1,
                        leaveDates: 1,
                        alternateDate: 1,
                        reason: 1,
                        status: 1,
                        isBackdated: 1,
                        approvedBy: 1,
                        approvedAt: 1,
                        rejectionNotes: 1,
                        medicalCertificate: 1,
                        appliedAfterReturn: 1,
                        halfYearPeriod: 1,
                        createdAt: 1,
                        updatedAt: 1
                    }
                },
                { $sort: { createdAt: -1 } },
                {
                    $facet: {
                        data: [{ $skip: skip }, { $limit: limit }],
                        totalCount: [{ $count: 'count' }]
                    }
                }
            ];

            const result = await LeaveRequest.aggregate(pipeline);
            const requests = result[0]?.data || [];
            const totalCount = result[0]?.totalCount[0]?.count || 0;

            return res.json({
                requests,
                totalCount,
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit)
            });
        } else {
            // No role filter - return all requests (original behavior)
            const totalCount = await LeaveRequest.countDocuments(baseQuery);
            const allRequests = await LeaveRequest.find(baseQuery)
                .populate('employee', 'fullName employeeCode')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            return res.json({
                requests: allRequests,
                totalCount,
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit)
            });
        }
    } catch (error) {
        console.error('Error fetching all leave requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests.' });
    }
});

// POST /api/admin/leaves
router.post('/leaves', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const newRequest = new LeaveRequest(req.body);
        await newRequest.save();
        res.status(201).json({ message: 'Leave request created successfully.', request: newRequest });
    } catch (error) {
        console.error('Error creating leave request by admin:', error);
        res.status(500).json({ error: 'Failed to create leave request.' });
    }
});

// PUT /leaves/:id
router.put('/leaves/:id', [authenticateToken, isAdminOrHr], async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Get the original leave request to compare changes
        const originalRequest = await LeaveRequest.findById(req.params.id).session(session);
        if (!originalRequest) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Request not found.' });
        }

        // Helper function to normalize dates to YYYY-MM-DD (local date, not UTC)
        const normalizeDate = (date) => {
            let dateObj;
            if (date instanceof Date) {
                dateObj = date;
            } else if (typeof date === 'string') {
                if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                    dateObj = new Date(date + 'T00:00:00');
                } else {
                    dateObj = new Date(date);
                }
            } else {
                dateObj = new Date(date);
            }
            // Use local date components to avoid timezone issues
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // Check if leave dates or status changed
        const datesChanged = req.body.leaveDates &&
            JSON.stringify((req.body.leaveDates || []).map(normalizeDate).sort()) !==
            JSON.stringify((originalRequest.leaveDates || []).map(normalizeDate).sort());

        const statusChanged = req.body.status && req.body.status !== originalRequest.status;
        const wasApproved = originalRequest.status === 'Approved';
        const willBeApproved = req.body.status === 'Approved' || (!req.body.status && wasApproved);

        // Update the leave request
        const updatedRequest = await LeaveRequest.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, session }
        );

        if (!updatedRequest) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Request not found.' });
        }

        // If leave was approved and dates changed, or status changed to Approved, sync attendance
        if (wasApproved && datesChanged) {
            // Dates changed for an approved leave - need to sync attendance
            try {
                // Calculate which dates were removed and which were added using normalized dates
                const oldDates = (originalRequest.leaveDates || []).map(normalizeDate).sort();
                const newDates = (updatedRequest.leaveDates || []).map(normalizeDate).sort();
                const removedDates = oldDates.filter(d => !newDates.includes(d));
                const addedDates = newDates.filter(d => !oldDates.includes(d));

                console.log(`[LEAVE_UPDATE] Dates changed - Removed: ${removedDates.join(', ')}, Added: ${addedDates.join(', ')}`);
                console.log(`[LEAVE_UPDATE] Original dates: ${oldDates.join(', ')}, New dates: ${newDates.join(', ')}`);

                // Revert attendance for removed dates
                if (removedDates.length > 0) {
                    // Create a temporary leave request with only removed dates for reverting
                    // Convert normalized dates back to Date objects for the leave request
                    const tempLeaveForRevert = {
                        ...originalRequest.toObject(),
                        leaveDates: removedDates.map(d => {
                            const [year, month, day] = d.split('-').map(Number);
                            return new Date(year, month - 1, day, 0, 0, 0, 0); // Local date
                        })
                    };
                    console.log(`[LEAVE_UPDATE] Reverting attendance for dates: ${removedDates.join(', ')}`);
                    await syncAttendanceOnLeaveRejection(tempLeaveForRevert, session);
                }

                // Sync attendance for new dates (if still approved)
                if (willBeApproved && addedDates.length > 0) {
                    // Create a temporary leave request with only new dates for syncing
                    // Convert normalized dates back to Date objects for the leave request
                    const tempLeaveForSync = {
                        ...updatedRequest.toObject(),
                        leaveDates: addedDates.map(d => {
                            const [year, month, day] = d.split('-').map(Number);
                            return new Date(year, month - 1, day, 0, 0, 0, 0); // Local date
                        })
                    };
                    console.log(`[LEAVE_UPDATE] Syncing attendance for dates: ${addedDates.join(', ')}`);
                    await syncAttendanceOnLeaveApproval(tempLeaveForSync, session);
                }
            } catch (syncError) {
                await session.abortTransaction();
                console.error('Error syncing attendance after leave date change:', syncError);
                throw new Error(`Failed to sync attendance records: ${syncError.message}`);
            }
        } else if (statusChanged) {
            // Status changed - sync attendance based on new status
            try {
                if (willBeApproved && !wasApproved) {
                    // Newly approved
                    await syncAttendanceOnLeaveApproval(updatedRequest, session);
                } else if (!willBeApproved && wasApproved) {
                    // Rejected/cancelled after approval
                    await syncAttendanceOnLeaveRejection(updatedRequest, session);
                }
            } catch (syncError) {
                await session.abortTransaction();
                console.error('Error syncing attendance after leave status change:', syncError);
                throw new Error(`Failed to sync attendance records: ${syncError.message}`);
            }
        } else if (willBeApproved && datesChanged) {
            // Leave is being approved with new dates
            try {
                await syncAttendanceOnLeaveApproval(updatedRequest, session);
            } catch (syncError) {
                await session.abortTransaction();
                console.error('Error syncing attendance for newly approved leave:', syncError);
                throw new Error(`Failed to sync attendance records: ${syncError.message}`);
            }
        }

        await session.commitTransaction();

        // Emit Socket.IO event to notify all clients about the leave update
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                io.emit('leave_request_updated', {
                    leaveId: updatedRequest._id,
                    employeeId: updatedRequest.employee,
                    leaveDates: updatedRequest.leaveDates,
                    status: updatedRequest.status,
                    requestType: updatedRequest.requestType,
                    datesChanged: datesChanged,
                    statusChanged: statusChanged,
                    updatedBy: req.user.userId,
                    timestamp: new Date().toISOString(),
                    message: `Leave request updated${datesChanged ? ' (dates changed)' : ''}${statusChanged ? ` (status: ${updatedRequest.status})` : ''}`
                });
                console.log(`📡 Emitted leave_request_updated event for leave ${updatedRequest._id}`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        res.json({
            message: 'Request updated successfully.',
            request: updatedRequest,
            attendanceSynced: (wasApproved && datesChanged) || statusChanged || (willBeApproved && datesChanged)
        });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error updating leave request by admin:', error);
        res.status(500).json({ error: error.message || 'Failed to update request.' });
    } finally {
        session.endSession();
    }
});

// DELETE /leaves/:id
router.delete('/leaves/:id', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const deletedRequest = await LeaveRequest.findByIdAndDelete(req.params.id);
        if (!deletedRequest) {
            return res.status(404).json({ error: 'Request not found.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting leave request by admin:', error);
        res.status(500).json({ error: 'Failed to delete request.' });
    }
});

// GET /leaves/pending
router.get('/leaves/pending', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        // Exclude YEAR_END requests from normal pending requests
        const pendingRequests = await LeaveRequest.find({
            status: 'Pending',
            requestType: { $ne: 'YEAR_END' }
        })
            .populate('employee', 'fullName employeeCode')
            .sort({ createdAt: 1 });
        res.json(pendingRequests);
    } catch (error) {
        console.error('Error fetching pending leave requests:', error);
        res.status(500).json({ error: 'Failed to fetch pending requests.' });
    }
});

// GET /leaves/employee/:id - Get leave requests for specific employee
router.get('/leaves/employee/:id', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const { id } = req.params;
        const { year } = req.query;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid employee ID.' });
        }

        // Build query
        const query = { employee: id };

        // Add year filter if provided
        if (year) {
            const startDate = new Date(year, 0, 1); // January 1st
            const endDate = new Date(year, 11, 31); // December 31st
            query.createdAt = { $gte: startDate, $lte: endDate };
        }

        const leaveRequests = await LeaveRequest.find(query)
            .populate('employee', 'fullName employeeCode')
            .sort({ createdAt: -1 });

        res.json(leaveRequests);
    } catch (error) {
        console.error('Error fetching employee leave requests:', error);
        res.status(500).json({ error: 'Failed to fetch employee leave requests.' });
    }
});

// PATCH /leaves/:id/status
router.patch('/leaves/:id/status', [authenticateToken, isAdminOrHr], async (req, res) => {
    const { id } = req.params;
    const { status: newStatus, rejectionNotes, overrideReason } = req.body;

    if (!['Approved', 'Rejected'].includes(newStatus)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const request = await LeaveRequest.findById(id).session(session);
        if (!request) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Request not found.' });
        }

        // Block YEAR_END requests from being processed through normal leave status endpoint
        if (request.requestType === 'YEAR_END') {
            await session.abortTransaction();
            return res.status(400).json({ error: 'Year-End requests must be processed through the Year-End specific endpoint.' });
        }

        const oldStatus = request.status;
        const employee = await User.findById(request.employee).session(session);
        if (!employee) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Employee not found.' });
        }

        const newStatus = req.body.status;
        // oldStatus is already declared above

        // PHASE 7: ADMIN OVERRIDE POLICY ENFORCEMENT
        if (newStatus === 'Approved') {
            // Validate against Central Policy Engine
            // Admin can override with mandatory reason
            const policyCheck = await LeavePolicyService.validateRequest(
                request.employee,
                request.leaveDates,
                request.requestType,
                request.leaveType,
                overrideReason // Admin override reason
            );

            if (!policyCheck.allowed && !overrideReason) {
                await session.abortTransaction();
                return res.status(400).json({
                    error: `Policy Violation: ${policyCheck.reason}. Admin override reason required.`,
                    rule: policyCheck.rule,
                    requiresOverride: true
                });
            }

            // If admin provided override reason, log it and allow
            if (!policyCheck.allowed && overrideReason) {
                request.adminOverride = true;
                request.overrideReason = overrideReason;
                request.overriddenBy = req.user.userId;
                request.overriddenAt = new Date();
            }
        }

        // PHASE 6: Check for clock-in conflicts when approving leave
        let clockInConflicts = [];
        if (newStatus === 'Approved' && oldStatus !== 'Approved') {
            for (const leaveDate of request.leaveDates) {
                const dateStr = new Date(leaveDate).toISOString().slice(0, 10);
                const existingLog = await AttendanceLog.findOne({
                    user: request.employee,
                    attendanceDate: dateStr
                }).session(session);

                if (existingLog && existingLog.clockInTime) {
                    clockInConflicts.push(dateStr);
                }
            }
        }

        const leaveDuration = request.leaveDates.length * (request.leaveType === 'Full Day' ? 1 : 0.5);

        if (newStatus !== oldStatus) {
            // Correctly handle different leave types based on company policy
            // Planned -> paid, Casual -> casual, Sick -> sick
            let leaveField;
            switch (request.requestType) {
                case 'Sick':
                    leaveField = 'sick';
                    break;
                case 'Planned':
                    leaveField = 'paid'; // Planned leaves use paid leave balance
                    break;
                case 'Casual':
                    leaveField = 'casual'; // Casual leaves use casual leave balance
                    break;
                case 'Loss of Pay':
                case 'Compensatory':
                case 'Backdated Leave':
                    // These don't affect leave balances
                    leaveField = null;
                    break;
                default:
                    leaveField = null;
            }

            if (leaveField) {
                // Ensure balance doesn't go negative (admin can override, but we track it)
                if (newStatus === 'Approved' && oldStatus !== 'Approved') {
                    employee.leaveBalances[leaveField] = Math.max(0, employee.leaveBalances[leaveField] - leaveDuration);
                } else if (newStatus !== 'Approved' && oldStatus === 'Approved') {
                    // Revert the deduction if an approved leave is later rejected/cancelled
                    employee.leaveBalances[leaveField] += leaveDuration;
                }
            }
        }

        request.status = newStatus;
        request.approvedBy = req.user.userId;
        request.approvedAt = new Date();

        if (newStatus === 'Rejected' && rejectionNotes) {
            request.rejectionNotes = rejectionNotes;
        } else if (newStatus === 'Approved') {
            request.rejectionNotes = undefined;

            // Handle admin override for blocked leaves
            if (request.validationBlocked && overrideReason) {
                request.adminOverride = true;
                request.overrideReason = overrideReason;
                request.overriddenBy = req.user.userId;
                request.overriddenAt = new Date();

                // Log the override action
                const { logAction } = require('../services/auditLogger');
                await logAction({
                    action: 'LEAVE_OVERRIDE_ANTI_EXPLOITATION',
                    userId: req.user.userId.toString(),
                    details: {
                        leaveRequestId: id,
                        employeeId: request.employee.toString(),
                        blockedRules: request.blockedRules || [],
                        overrideReason: overrideReason,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }

        await employee.save({ session });
        await request.save({ session });

        // PHASE 2: Sync attendance records with leave status change
        // This ensures Attendance is the single source of truth
        try {
            if (newStatus === 'Approved' && oldStatus !== 'Approved') {
                // Leave approved - create/update attendance records
                await syncAttendanceOnLeaveApproval(request, session);
            } else if (newStatus !== 'Approved' && oldStatus === 'Approved') {
                // Leave rejected/cancelled after approval - revert attendance records
                await syncAttendanceOnLeaveRejection(request, session);
            }
        } catch (syncError) {
            // If attendance sync fails, rollback entire transaction
            await session.abortTransaction();
            console.error('Error syncing attendance with leave status:', syncError);
            throw new Error(`Failed to sync attendance records: ${syncError.message}`);
        }

        await session.commitTransaction();

        // PERFORMANCE OPTIMIZATION: Invalidate caches after leave status change
        invalidateUserLeaves(request.employee.toString());
        invalidateUserStatus(request.employee.toString());

        NewNotificationService.notifyLeaveResponse(request.employee, employee.fullName, newStatus, request.requestType, request.rejectionNotes)
            .catch(err => console.error('Error sending leave response notification:', err));

        // FIXED: Emit Socket.IO event with updated balance for real-time sync
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                // Fetch updated employee with latest balances
                const updatedEmployee = await User.findById(request.employee)
                    .select('leaveBalances leaveEntitlements fullName employeeCode');
                
                io.emit('leave_request_updated', {
                    leaveId: request._id,
                    employeeId: request.employee,
                    leaveDates: request.leaveDates,
                    status: request.status,
                    requestType: request.requestType,
                    statusChanged: true,
                    oldStatus: oldStatus,
                    newStatus: newStatus,
                    updatedBy: req.user.userId,
                    timestamp: new Date().toISOString(),
                    message: `Leave request ${newStatus.toLowerCase()}`,
                    // FIXED: Include updated balances for real-time sync
                    updatedBalances: updatedEmployee?.leaveBalances || null,
                    adminOverride: request.adminOverride || false,
                    overrideReason: request.overrideReason || null
                });
                console.log(`📡 Emitted leave_request_updated event for leave ${request._id} with balance update`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        // PHASE 6: Include warning if clock-in conflicts exist
        const response = {
            message: `Request has been ${newStatus.toLowerCase()}.`,
            request
        };

        if (clockInConflicts.length > 0) {
            response.warning = `Leave approved, but employee already clocked in on ${clockInConflicts.length} day(s): ${clockInConflicts.join(', ')}. Attendance records updated to Leave status.`;
        }

        res.json(response);
    } catch (error) {
        await session.abortTransaction();
        console.error(`Error updating request status for ID ${id}:`, error);
        res.status(500).json({ error: 'Failed to update request status.' });
    } finally {
        session.endSession();
    }
});

// @route   POST /api/admin/leaves/allocate
// @desc    Allocate leave balances to an employee for a year
// @access  Private (Admin/HR)
router.post('/leaves/allocate', [authenticateToken, isAdminOrHr], async (req, res) => {
    const {
        employeeId,
        year,
        sickLeaveEntitlement,
        casualLeaveEntitlement,
        paidLeaveEntitlement,
    } = req.body;

    if (!employeeId) {
        return res.status(400).json({ error: 'Employee ID is required.' });
    }

    try {
        const user = await User.findById(employeeId);
        if (!user) {
            return res.status(404).json({ error: 'Employee not found.' });
        }

        // --- START OF FIX: Set balances and entitlements separately and correctly ---
        const sick = sickLeaveEntitlement || 0;
        const casual = casualLeaveEntitlement || 0;
        const paid = paidLeaveEntitlement || 0;

        // Entitlements represent the total for the year
        user.leaveEntitlements = {
            sick: sick,
            casual: casual,
            paid: paid,
        };

        // Balances represent the currently available leaves
        user.leaveBalances = {
            sick: sick,
            casual: casual,
            paid: paid,
        };
        // --- END OF FIX ---

        await user.save();

        res.status(200).json({
            message: 'Leave balances and entitlements allocated successfully.',
            user: {
                _id: user._id,
                fullName: user.fullName,
                leaveBalances: user.leaveBalances,
                leaveEntitlements: user.leaveEntitlements,
            }
        });
    } catch (error) {
        console.error('Error allocating leaves:', error);
        res.status(500).json({ error: 'Failed to allocate leaves.' });
    }
});

// @route   POST /api/admin/leaves/bulk-allocate
// @desc    Bulk allocate leave balances to multiple employees for a year
// @access  Private (Admin/HR)
router.post('/leaves/bulk-allocate', [authenticateToken, isAdminOrHr], async (req, res) => {
    const {
        employeeIds,
        year,
        sickLeaveEntitlement,
        casualLeaveEntitlement,
        paidLeaveEntitlement,
    } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({ error: 'Employee IDs array is required and must not be empty.' });
    }

    const results = {
        successful: [],
        failed: []
    };

    try {
        const sick = sickLeaveEntitlement || 0;
        const casual = casualLeaveEntitlement || 0;
        const paid = paidLeaveEntitlement || 0;

        // Process each employee
        for (const employeeId of employeeIds) {
            try {
                if (!mongoose.Types.ObjectId.isValid(employeeId)) {
                    results.failed.push({
                        employeeId,
                        error: 'Invalid employee ID format.'
                    });
                    continue;
                }

                const user = await User.findById(employeeId);
                if (!user) {
                    results.failed.push({
                        employeeId,
                        error: 'Employee not found.'
                    });
                    continue;
                }

                // Set entitlements and balances
                user.leaveEntitlements = {
                    sick: sick,
                    casual: casual,
                    paid: paid,
                };

                user.leaveBalances = {
                    sick: sick,
                    casual: casual,
                    paid: paid,
                };

                await user.save();

                results.successful.push({
                    employeeId: user._id,
                    fullName: user.fullName,
                    employeeCode: user.employeeCode
                });
            } catch (error) {
                console.error(`Error allocating leaves for employee ${employeeId}:`, error);
                results.failed.push({
                    employeeId,
                    error: error.message || 'Failed to allocate leaves for this employee.'
                });
            }
        }

        res.status(200).json({
            message: `Bulk allocation completed: ${results.successful.length} successful, ${results.failed.length} failed.`,
            results
        });
    } catch (error) {
        console.error('Error in bulk allocating leaves:', error);
        res.status(500).json({ error: 'Failed to bulk allocate leaves.' });
    }
});


// --- EXTRA BREAK & HOLIDAY ROUTES ---

router.patch('/breaks/extra/:requestId/status', [authenticateToken, isAdminOrHr], async (req, res) => {
    const { requestId } = req.params;
    const { status } = req.body;
    const adminUserId = req.user.userId;

    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ error: 'Invalid request ID.' });
    }

    try {
        const request = await ExtraBreakRequest.findById(requestId);
        if (!request) return res.status(404).json({ error: 'Extra break request not found.' });
        if (request.status !== 'Pending') return res.status(400).json({ error: 'This request has already been actioned.' });

        request.status = status;
        request.reviewedBy = adminUserId;
        request.reviewedAt = new Date();
        await request.save();

        // Invalidate dashboard cache to update recent activity
        const cacheService = require('../services/cacheService');
        const today = getISTDateString();
        cacheService.invalidateDashboard(today);

        const user = await User.findById(request.user);
        if (user) {
            const message = status === 'Approved'
                ? 'Your request for an extra break has been approved. You can now start it from the break menu.'
                : `Your request for an extra break for reason "${request.reason}" has been rejected.`;

            const actionData = status === 'Approved' ? {
                actionType: 'start_break',
                requiresAction: true,
                actionParams: { breakType: 'extra', reason: request.reason }
            } : {
                actionType: 'none',
                requiresAction: false
            };

            NewNotificationService.createAndEmitNotification({
                message: message,
                type: status === 'Approved' ? 'extra_break_approval' : 'extra_break_rejection',
                userId: request.user,
                userName: user.fullName,
                recipientType: 'user',
                category: 'break',
                priority: 'high',
                actionData,
                navigationData: { page: 'attendance' }
            }).catch(err => console.error('Error sending extra break response notification:', err));
        }

        res.json({ message: `Break request has been ${status.toLowerCase()}.` });

    } catch (error) {
        console.error('Error actioning extra break request:', error);
        res.status(500).json({ error: 'Failed to update request.' });
    }
});

router.get('/holidays', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const holidays = await Holiday.find();
        // Sort: valid dates first (ASC), then tentative holidays at bottom (alphabetically)
        const sortedHolidays = holidays.sort((a, b) => {
            const aIsTentative = !a.date || a.isTentative;
            const bIsTentative = !b.date || b.isTentative;

            if (aIsTentative && bIsTentative) {
                return a.name.localeCompare(b.name);
            }
            if (aIsTentative) return 1;
            if (bIsTentative) return -1;
            return new Date(a.date) - new Date(b.date);
        });
        res.json(sortedHolidays);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch holidays.' });
    }
});
router.post('/holidays', [authenticateToken, isAdminOrHr], async (req, res) => {
    const { name, date } = req.body;
    if (!name || !date) {
        return res.status(400).json({ error: 'Holiday name and date are required.' });
    }
    try {
        const newHoliday = new Holiday({ name, date });
        await newHoliday.save();
        res.status(201).json(newHoliday);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'A holiday on this date already exists.' });
        }
        res.status(500).json({ error: 'Failed to add holiday.' });
    }
});
router.delete('/holidays/:id', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const holiday = await Holiday.findByIdAndDelete(req.params.id);
        if (!holiday) {
            return res.status(404).json({ error: 'Holiday not found.' });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete holiday.' });
    }
});

// POST /api/admin/holidays/bulk-upload
// Bulk upload holidays from Excel file
router.post('/holidays/bulk-upload', [authenticateToken, isAdminOrHr], async (req, res) => {
    const { holidays } = req.body;

    if (!holidays || !Array.isArray(holidays) || holidays.length === 0) {
        return res.status(400).json({ error: 'Holidays array is required and must not be empty.' });
    }

    const session = await require('mongoose').startSession();
    session.startTransaction();

    try {
        const results = {
            successCount: 0,
            failureCount: 0,
            errors: []
        };

        // Helper function to parse flexible date (same logic as frontend)
        const parseFlexibleDate = (dateStr, currentYear = new Date().getFullYear()) => {
            if (!dateStr) return null;

            const normalized = String(dateStr).trim();

            // Check for "Not Yet decided" (case-insensitive)
            if (/not\s+yet\s+decided/i.test(normalized)) {
                return { date: null, isTentative: true };
            }

            // Try Excel serial date first
            if (!isNaN(normalized) && parseFloat(normalized) > 25569) {
                const excelEpoch = new Date(1900, 0, 1);
                const days = parseFloat(normalized) - 2;
                const parsedDate = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
                if (!isNaN(parsedDate.getTime())) {
                    return { date: parsedDate, isTentative: false };
                }
            }

            // Try parsing as full date
            let parsedDate = new Date(normalized);
            if (!isNaN(parsedDate.getTime())) {
                return { date: parsedDate, isTentative: false };
            }

            // Try parsing as "DD-MMM" format (e.g., "26-Jan", "3-Mar")
            const dayMonthMatch = normalized.match(/^(\d{1,2})[-/](\w{3,})$/i);
            if (dayMonthMatch) {
                const day = parseInt(dayMonthMatch[1]);
                const monthStr = dayMonthMatch[2].toLowerCase();
                const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                const monthIndex = monthNames.findIndex(m => monthStr.startsWith(m));

                if (monthIndex !== -1 && day >= 1 && day <= 31) {
                    const date = new Date(currentYear, monthIndex, day);
                    if (date.getDate() === day && date.getMonth() === monthIndex) {
                        return { date: date, isTentative: false };
                    }
                }
            }

            return null; // Invalid format
        };

        // Get existing holidays to check for duplicates
        const existingHolidays = await Holiday.find({}, 'date name isTentative').session(session);
        const existingDates = new Set(
            existingHolidays
                .filter(h => h.date && !h.isTentative)
                .map(h => {
                    const d = new Date(h.date);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })
        );
        const existingTentativeHolidays = new Set(
            existingHolidays
                .filter(h => h.isTentative)
                .map(h => h.name.toLowerCase().trim())
        );

        // Validate and process each holiday
        const holidaysToInsert = [];
        const seenDatesInBatch = new Set();
        const seenTentativeInBatch = new Set();
        const currentYear = new Date().getFullYear();

        for (let i = 0; i < holidays.length; i++) {
            const holiday = holidays[i];
            const rowNum = i + 1;
            const errors = [];

            // Validate holiday name
            const holidayName = String(holiday.name || '').trim();
            if (holidayName.length === 0) {
                errors.push('Holiday name is required');
            } else if (holidayName.length > 100) {
                errors.push('Holiday name exceeds 100 characters');
            }

            // Parse date (can be null for tentative)
            const isTentative = holiday.isTentative || false;
            let dateResult = null;
            let formattedDate = null;
            let parsedDate = null;

            if (holiday.date) {
                dateResult = parseFlexibleDate(holiday.date, currentYear);
                if (!dateResult) {
                    errors.push('Invalid date format');
                } else if (dateResult.isTentative) {
                    // "Not Yet decided" - date is null
                    formattedDate = null;
                    parsedDate = null;
                } else {
                    parsedDate = dateResult.date;
                    const year = parsedDate.getFullYear();
                    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                    const day = String(parsedDate.getDate()).padStart(2, '0');
                    formattedDate = `${year}-${month}-${day}`;
                }
            } else if (!isTentative) {
                errors.push('Date is required for non-tentative holidays');
            }

            if (errors.length > 0) {
                results.failureCount++;
                results.errors.push({
                    row: rowNum,
                    errors: errors
                });
                continue;
            }

            // Handle tentative holidays
            if (isTentative || !formattedDate) {
                const nameKey = holidayName.toLowerCase();

                // Check for duplicate tentative in batch
                if (seenTentativeInBatch.has(nameKey)) {
                    results.failureCount++;
                    results.errors.push({
                        row: rowNum,
                        errors: [`Duplicate tentative holiday in upload: ${holidayName}`]
                    });
                    continue;
                }

                // Check for duplicate tentative in database
                if (existingTentativeHolidays.has(nameKey)) {
                    results.failureCount++;
                    results.errors.push({
                        row: rowNum,
                        errors: [`Tentative holiday already exists: ${holidayName}`]
                    });
                    continue;
                }

                seenTentativeInBatch.add(nameKey);
                holidaysToInsert.push({
                    name: holidayName,
                    date: null,
                    isTentative: true,
                    day: holiday.day ? String(holiday.day).trim() : null
                });
                continue;
            }

            // Handle regular holidays with dates
            // Check for duplicates in batch
            if (seenDatesInBatch.has(formattedDate)) {
                results.failureCount++;
                results.errors.push({
                    row: rowNum,
                    errors: [`Duplicate date in upload: ${formattedDate}`]
                });
                continue;
            }

            // Check for duplicates in database
            if (existingDates.has(formattedDate)) {
                results.failureCount++;
                results.errors.push({
                    row: rowNum,
                    errors: [`Holiday already exists for date: ${formattedDate}`]
                });
                continue;
            }

            // Day validation (optional, allow multiple days)
            // Don't strictly validate day for flexibility

            // Add to insert batch
            seenDatesInBatch.add(formattedDate);
            holidaysToInsert.push({
                name: holidayName,
                date: parsedDate,
                isTentative: false,
                day: holiday.day ? String(holiday.day).trim() : null
            });
        }

        // If there are any errors, reject the entire batch
        if (results.errors.length > 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                error: 'Validation failed. Please fix all errors before uploading.',
                successCount: 0,
                failureCount: results.failureCount,
                errors: results.errors
            });
        }

        // Insert all holidays in a transaction
        if (holidaysToInsert.length > 0) {
            try {
                await Holiday.insertMany(holidaysToInsert, { session });
                results.successCount = holidaysToInsert.length;
            } catch (insertError) {
                // Handle unique constraint violations
                if (insertError.code === 11000) {
                    const duplicateField = Object.keys(insertError.keyPattern || {})[0];
                    throw new Error(`Duplicate holiday detected: ${duplicateField}`);
                }
                throw insertError;
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            message: `Successfully uploaded ${results.successCount} holiday(s).`,
            successCount: results.successCount,
            failureCount: results.failureCount,
            errors: results.errors
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error('Error in bulk upload holidays:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                error: 'One or more holidays already exist in the database.',
                successCount: 0,
                failureCount: holidays.length,
                errors: []
            });
        }

        res.status(500).json({
            error: 'Failed to upload holidays.',
            successCount: 0,
            failureCount: holidays.length,
            errors: []
        });
    }
});

// --- ATTENDANCE MANAGEMENT ROUTES ---

// PATCH /api/admin/attendance/toggle-status
// Toggle attendance status (late/half-day) for an employee on a specific date
router.patch('/attendance/toggle-status', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const { employeeId, attendanceDate, statusType, newStatus } = req.body;

        console.log('Toggle attendance status request:', { employeeId, attendanceDate, statusType, newStatus });

        // Validate required fields
        if (!employeeId || !attendanceDate || !statusType || !newStatus) {
            return res.status(400).json({ error: 'Employee ID, attendance date, status type, and new status are required.' });
        }

        // Validate status type
        if (!['late', 'halfday'].includes(statusType)) {
            return res.status(400).json({ error: 'Status type must be either "late" or "halfday".' });
        }

        // Validate new status
        if (!['On-time', 'Late', 'Half-day'].includes(newStatus)) {
            return res.status(400).json({ error: 'New status must be "On-time", "Late", or "Half-day".' });
        }

        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return res.status(400).json({ error: 'Invalid employee ID format.' });
        }

        // Check if employee exists
        const employee = await User.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found.' });
        }

        // Find or create attendance log for the date
        let attendanceLog = await AttendanceLog.findOne({
            user: employeeId,
            attendanceDate: attendanceDate
        });

        if (!attendanceLog) {
            // If no attendance log exists, create one
            const defaultClockInTime = new Date(`${attendanceDate}T09:00:00`);
            attendanceLog = new AttendanceLog({
                user: employeeId,
                attendanceDate: attendanceDate,
                clockInTime: defaultClockInTime,
                shiftDurationMinutes: 480, // Default 8 hours
                penaltyMinutes: 0,
                paidBreakMinutesTaken: 0,
                unpaidBreakMinutesTaken: 0,
                isLate: newStatus === 'Late',
                isHalfDay: newStatus === 'Half-day',
                lateMinutes: newStatus === 'Late' ? 15 : (newStatus === 'Half-day' ? 60 : 0), // Default late minutes
                lateCount: 0,
                attendanceStatus: newStatus
            });
            await attendanceLog.save();
        } else {
            // Update existing attendance log based on new status
            attendanceLog.attendanceStatus = newStatus;

            if (statusType === 'late') {
                // Toggle late status
                attendanceLog.isLate = newStatus === 'Late';
                attendanceLog.isHalfDay = false; // Remove half-day if marking as late
                attendanceLog.lateMinutes = newStatus === 'Late' ? Math.max(attendanceLog.lateMinutes || 0, 15) : 0;
            } else if (statusType === 'halfday') {
                // Toggle half-day status
                attendanceLog.isHalfDay = newStatus === 'Half-day';
                attendanceLog.isLate = false; // Remove late if marking as half-day
                attendanceLog.lateMinutes = newStatus === 'Half-day' ? Math.max(attendanceLog.lateMinutes || 0, 60) : 0;
            }

            await attendanceLog.save();
        }

        // Log the admin action
        try {
            const auditLogger = require('../services/auditLogger');
            await auditLogger.logAction({
                userId: req.user.userId,
                action: 'toggle_attendance_status',
                details: {
                    targetEmployeeId: employeeId,
                    targetEmployeeName: employee.fullName,
                    attendanceDate: attendanceDate,
                    statusType: statusType,
                    newStatus: newStatus,
                    previousStatus: attendanceLog.attendanceStatus
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });
        } catch (auditError) {
            console.error('Failed to log audit action:', auditError);
            // Don't fail the request if audit logging fails
        }

        // Emit Socket.IO event to notify all clients about the attendance log update
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                // Emit to all connected clients
                io.emit('attendance_log_updated', {
                    logId: attendanceLog._id,
                    userId: attendanceLog.user,
                    attendanceDate: attendanceLog.attendanceDate,
                    attendanceStatus: attendanceLog.attendanceStatus,
                    isHalfDay: attendanceLog.isHalfDay,
                    isLate: attendanceLog.isLate,
                    lateMinutes: attendanceLog.lateMinutes,
                    clockInTime: attendanceLog.clockInTime,
                    clockOutTime: attendanceLog.clockOutTime,
                    updatedBy: req.user.userId,
                    timestamp: new Date().toISOString(),
                    message: `Attendance status updated to "${newStatus}" for ${employee.fullName} on ${attendanceDate}`
                });
                console.log(`📡 Emitted attendance_log_updated event for log ${attendanceLog._id}`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        res.json({
            message: `Attendance status updated to "${newStatus}" successfully.`,
            attendanceLog: {
                id: attendanceLog._id,
                attendanceDate: attendanceLog.attendanceDate,
                isLate: attendanceLog.isLate,
                isHalfDay: attendanceLog.isHalfDay,
                attendanceStatus: attendanceLog.attendanceStatus,
                lateMinutes: attendanceLog.lateMinutes,
                employeeName: employee.fullName
            }
        });

    } catch (error) {
        console.error('Error toggling attendance status:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({
            error: 'Failed to toggle attendance status.',
            details: error.message
        });
    }
});

// GET /api/admin/attendance/employee/:employeeId
// Get attendance data for a specific employee for attendance resolution
router.get('/attendance/employee/:employeeId', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { startDate, endDate } = req.query;

        if (!employeeId) {
            return res.status(400).json({ error: 'Employee ID is required.' });
        }

        // Check if employee exists
        const employee = await User.findById(employeeId).select('fullName employeeCode');
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found.' });
        }

        // Build query
        const query = { user: employeeId };

        console.log('Querying attendance logs for employee:', employeeId);

        if (startDate && endDate) {
            query.attendanceDate = {
                $gte: startDate,
                $lte: endDate
            };
            console.log('Date range filter applied:', { startDate, endDate });
        }

        console.log('Final query:', query);

        // Get attendance logs with recent dates first
        const attendanceLogs = await AttendanceLog.find(query)
            .select('attendanceDate clockInTime clockOutTime isLate isHalfDay attendanceStatus lateMinutes')
            .sort({ attendanceDate: -1 })
            .limit(50) // Limit to recent 50 records for performance
            .lean();

        console.log(`Found ${attendanceLogs.length} attendance logs for employee ${employeeId}`);

        // Get grace period setting for correct status calculation
        let GRACE_PERIOD_MINUTES = 30;
        try {
            const graceSetting = await Setting.findOne({ key: 'lateGraceMinutes' });
            if (graceSetting) {
                // FIX: Explicitly convert to integer to ensure type consistency
                const graceValue = parseInt(Number(graceSetting.value), 10);
                if (!isNaN(graceValue) && graceValue >= 0) {
                    GRACE_PERIOD_MINUTES = graceValue;
                } else {
                    console.warn(`[Grace Period] Invalid value in database: ${graceSetting.value}, using default 30`);
                }
            }
        } catch (err) {
            console.error('Failed to fetch late grace setting, using default 30 minutes', err);
        }

        console.log(`Using grace period: ${GRACE_PERIOD_MINUTES} minutes`);

        // Calculate correct status for each log based on grace period
        const logsWithCalculatedStatus = attendanceLogs.map(log => {
            const lateMinutes = log.lateMinutes || 0;
            let calculatedStatus = 'On-time';
            let calculatedIsLate = false;
            let calculatedIsHalfDay = false;

            // Check if there's a manual override (stored status differs from calculated)
            const hasManualOverride = log.attendanceStatus &&
                (log.attendanceStatus === 'Late' ||
                    (log.attendanceStatus === 'Half-day' && lateMinutes <= GRACE_PERIOD_MINUTES) ||
                    (log.attendanceStatus === 'On-time' && lateMinutes > GRACE_PERIOD_MINUTES));

            if (hasManualOverride) {
                // Use the manually set status
                calculatedStatus = log.attendanceStatus;
                calculatedIsLate = log.attendanceStatus === 'Late';
                calculatedIsHalfDay = log.attendanceStatus === 'Half-day';
            } else {
                // Apply grace period logic
                if (lateMinutes <= GRACE_PERIOD_MINUTES) {
                    // Within grace period = On-time
                    calculatedStatus = 'On-time';
                    calculatedIsLate = false;
                    calculatedIsHalfDay = false;
                } else if (lateMinutes > GRACE_PERIOD_MINUTES) {
                    // Beyond grace period = Half-day AND Late (for tracking/notifications)
                    calculatedStatus = 'Half-day';
                    calculatedIsHalfDay = true;
                    calculatedIsLate = true; // FIX: Set isLate=true for tracking and notifications
                }
            }

            return {
                ...log,
                // Override with calculated values
                calculatedStatus,
                calculatedIsLate,
                calculatedIsHalfDay,
                gracePeriodMinutes: GRACE_PERIOD_MINUTES,
                hasManualOverride
            };
        });

        if (attendanceLogs.length > 0) {
            console.log('Sample attendance log with calculated status:', logsWithCalculatedStatus[0]);
        }

        res.json({
            employee: employee,
            attendanceLogs: logsWithCalculatedStatus,
            gracePeriodMinutes: GRACE_PERIOD_MINUTES
        });

    } catch (error) {
        console.error('Error fetching employee attendance:', error);
        res.status(500).json({ error: 'Failed to fetch employee attendance data.' });
    }
});


// --- DASHBOARD & LOGS ROUTES ---

router.get('/dashboard-summary', [authenticateToken, isAdminOrHr], async (req, res) => {
    // ADMIN DASHBOARD ONLY: IST-normalized business date (single source of truth)
    const today = getISTDateString();
    const { includePendingLeaves, pendingPage, pendingLimit } = req.query;
    const shouldIncludePendingLeaves = includePendingLeaves === 'true' || includePendingLeaves === true;
    const page = Math.max(1, parseInt(pendingPage, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(pendingLimit, 10) || 20)); // bounded
    const skip = (page - 1) * limit;

    try {
        const cacheService = require('../services/cacheService');
        const cachedSummary = cacheService.getDashboardSummary(today);

        // Core summary is always cacheable regardless of includePendingLeaves
        // If cached exists, reuse it and (optionally) fetch pending leaves separately.
        let summary = cachedSummary || null;

        if (!summary) {
            const totalEmployeesPromise = User.countDocuments({ isActive: true }).lean();
            const todayLogsPromise = AttendanceLog.find({ attendanceDate: today })
                // CRITICAL: lateMinutes is used below for counts
                .select('clockInTime lateMinutes attendanceDate')
                .lean();

            const whosInListPromise = AttendanceSession.aggregate([
                { $match: { endTime: null } },
                {
                    $lookup: {
                        from: 'attendancelogs',
                        localField: 'attendanceLog',
                        foreignField: '_id',
                        as: 'attendanceLogInfo',
                        pipeline: [
                            { $match: { attendanceDate: today } },
                            { $project: { user: 1, attendanceDate: 1 } }
                        ]
                    }
                },
                { $unwind: '$attendanceLogInfo' },
                { $sort: { startTime: 1 } },
                {
                    $group: {
                        _id: '$attendanceLogInfo.user',
                        startTime: { $first: '$startTime' }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'user',
                        pipeline: [
                            { $project: { fullName: 1, designation: 1, profileImageUrl: 1 } }
                        ]
                    }
                },
                { $unwind: '$user' },
                {
                    $project: {
                        _id: '$user._id',
                        fullName: '$user.fullName',
                        designation: '$user.designation',
                        startTime: '$startTime',
                        profileImageUrl: '$user.profileImageUrl'
                    }
                },
                { $sort: { startTime: 1 } }
            ]);

            const recentNotesPromise = AttendanceLog.find({
                attendanceDate: today,
                // Correct query: exclude null/empty notes
                notes: { $nin: [null, ''] }
            })
                .populate('user', 'fullName employeeCode')
                .select('notes updatedAt user')
                .sort({ updatedAt: -1 })
                .limit(5)
                .lean();

            const pendingBreaksPromise = ExtraBreakRequest.find({ status: 'Pending' })
                .populate('user', 'fullName employeeCode')
                .select('reason createdAt user')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();

            const backdatedLeavesPromise = LeaveRequest.find({
                isBackdated: true,
                status: 'Pending'
            })
                .populate('employee', 'fullName employeeCode')
                .select('reason createdAt employee')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();

            const [totalEmployees, todayLogs, whosInListRaw, recentNotes, pendingBreaks, backdatedLeaves] = await Promise.all([
                totalEmployeesPromise,
                todayLogsPromise,
                whosInListPromise,
                recentNotesPromise,
                pendingBreaksPromise,
                backdatedLeavesPromise
            ]);

            // Enrich whosInList with calculated logout time and active break information (BATCHED - no N+1)
            const whoIds = Array.isArray(whosInListRaw) ? whosInListRaw.map(e => e._id).filter(Boolean) : [];
            const statusMap = await getUsersDailyStatusBatch(whoIds, today);
            const whosInList = (whosInListRaw || []).map(employee => {
                const s = statusMap.get(employee._id.toString());
                return {
                    ...employee,
                    calculatedLogoutTime: s?.calculatedLogoutTime ?? null,
                    logoutBreakdown: s?.logoutBreakdown ?? null,
                    activeBreak: s?.activeBreak ?? null
                };
            });

            // Calculate status counts for Admin Dashboard cards:
            // - Present = ALL employees who clocked in today (regardless of grace/late/half-day)
            // - Late Comers = employees beyond grace period (subset of Present)
            let presentCount = 0;
            let lateCount = 0;

            // Get grace period setting
            let GRACE_PERIOD_MINUTES = 30;
            try {
                const graceSetting = await Setting.findOne({ key: 'lateGraceMinutes' });
                if (graceSetting) {
                    const graceValue = parseInt(Number(graceSetting.value), 10);
                    if (!isNaN(graceValue) && graceValue >= 0) {
                        GRACE_PERIOD_MINUTES = graceValue;
                    } else {
                        console.warn(`[Grace Period] Invalid value in database: ${graceSetting.value}, using default 30`);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch late grace setting for dashboard, using default 30 minutes', err);
            }

            todayLogs.forEach(log => {
                if (!log.clockInTime) return;

                // Present count includes all clock-ins
                presentCount++;

                // Late count is tracked separately for "Late Comers"
                const lateMinutes = log.lateMinutes || 0;
                if (lateMinutes > GRACE_PERIOD_MINUTES) {
                    lateCount++;
                }
            });

            // If no attendance logs found, try to count from active attendance sessions
            if (todayLogs.length === 0) {
                const activeSessionsCount = await AttendanceSession.countDocuments({
                    endTime: null,
                    attendanceLog: {
                        $in: await AttendanceLog.find({ attendanceDate: today }).select('_id').lean()
                    }
                });
                presentCount = activeSessionsCount;
            }

            // Also check for any employees who have clocked in today (regardless of status)
            // (fallback safety if lateMinutes fields are missing or logs query returned empty)
            if (presentCount === 0) {
                const allClockedInCount = await AttendanceLog.countDocuments({
                    attendanceDate: today,
                    clockInTime: { $exists: true, $ne: null }
                });
                presentCount = allClockedInCount;
            }

            // Calculate on-leave count from approved leave requests (IST boundaries)
            const startOfDay = startOfISTDay(today);
            const endOfDay = new Date(startOfDay);
            endOfDay.setDate(endOfDay.getDate() + 1);

            /**
             * @deprecated
             * Direct LeaveRequest access for on-leave counts has been extracted to
             * backend/services/leaveSummaryCoreService.js.
             */
            const { countApprovedLeavesOnDate } = require('../services/leaveSummaryCoreService');
            const onLeaveCount = await countApprovedLeavesOnDate({ date: today });

            const statusCounts = {
                'Present': presentCount,
                'Late': lateCount,
                'On Leave': onLeaveCount
            };

            const mappedNotes = recentNotes.map(n => ({
                _id: n._id, type: 'Note', user: n.user, content: n.notes, timestamp: n.updatedAt
            }));
            const mappedBreakRequests = pendingBreaks.map(b => ({
                _id: b._id, type: 'ExtraBreakRequest', user: b.user, content: b.reason, timestamp: b.createdAt
            }));
            const mappedLeaveRequests = backdatedLeaves.map(l => ({
                _id: l._id, type: 'BackdatedLeaveRequest', user: l.employee, content: l.reason, timestamp: l.createdAt
            }));

            const recentActivity = [...mappedNotes, ...mappedBreakRequests, ...mappedLeaveRequests]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            summary = {
                totalEmployees,
                presentCount: statusCounts['Present'],
                lateCount: statusCounts['Late'],
                onLeaveCount: statusCounts['On Leave'],
                whosInList: whosInList || [],
                recentActivity: recentActivity || []
            };

            cacheService.setDashboardSummary(today, summary);
        }

        if (shouldIncludePendingLeaves) {
            try {
                // Short-TTL cached, paginated pending leave requests (Admin Dashboard only)
                const pendingCacheKey = `dashboard_pending_leaves_${today}_${page}_${limit}`;
                const cachedPending = cacheService.get('dashboard', pendingCacheKey);

                if (cachedPending && Array.isArray(cachedPending.items) && typeof cachedPending.total === 'number') {
                    return res.json({
                        summary,
                        pendingLeaveRequests: cachedPending.items,
                        pendingLeaveRequestsMeta: {
                            page,
                            limit,
                            total: cachedPending.total,
                            hasMore: skip + cachedPending.items.length < cachedPending.total
                        }
                    });
                }

                // Exclude YEAR_END requests from normal pending requests
                const [items, total] = await Promise.all([
                    LeaveRequest.find({
                        status: 'Pending',
                        requestType: { $ne: 'YEAR_END' }
                    })
                        .populate('employee', 'fullName employeeCode')
                        .select('employee requestType leaveType leaveDates alternateDate reason status approvedAt createdAt rejectionNotes medicalCertificate isBackdated appliedAfterReturn')
                        .sort({ createdAt: 1 })
                        .skip(skip)
                        .limit(limit)
                        .lean(),
                    LeaveRequest.countDocuments({
                        status: 'Pending',
                        requestType: { $ne: 'YEAR_END' }
                    })
                ]);

                // Cache pending page briefly (30s)
                cacheService.set('dashboard', pendingCacheKey, { items, total }, 30);

                return res.json({
                    summary,
                    pendingLeaveRequests: Array.isArray(items) ? items : [],
                    pendingLeaveRequestsMeta: {
                        page,
                        limit,
                        total: total || 0,
                        hasMore: skip + (Array.isArray(items) ? items.length : 0) < (total || 0)
                    }
                });
            } catch (leaveError) {
                console.error('Error fetching pending leave requests for dashboard:', leaveError);
                // Return summary without pending leaves if fetch fails
                return res.json({
                    summary,
                    pendingLeaveRequests: []
                });
            }
        }

        return res.json(summary);
    } catch (error) {
        console.error("Error fetching dashboard summary:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

// New endpoint to get detailed employee lists for dashboard cards
router.get('/dashboard-employees/:type', [authenticateToken, isAdminOrHr], async (req, res) => {
    const { type } = req.params;
    // ADMIN DASHBOARD ONLY: IST-normalized business date (single source of truth)
    const today = getISTDateString();
    const wantsPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    try {
        let employees = [];
        let total = null;

        switch (type) {
            case 'present':
                // Admin Dashboard definition:
                // Present = ALL employees who clocked in today (regardless of grace/late/half-day)
                const presentQuery = {
                    attendanceDate: today,
                    clockInTime: { $exists: true, $ne: null }
                };

                const presentLogsQuery = AttendanceLog.find(presentQuery)
                    .populate('user', 'fullName employeeCode designation department profileImageUrl')
                    .lean();
                if (wantsPagination) presentLogsQuery.skip(skip).limit(limit);
                const presentLogs = await presentLogsQuery;

                // If no present logs found, try to find employees with active attendance sessions
                if (presentLogs.length === 0) {
                    const AttendanceSession = require('../models/AttendanceSession');

                    const pipeline = [
                        { $match: { endTime: null } },
                        {
                            $lookup: {
                                from: 'attendancelogs',
                                localField: 'attendanceLog',
                                foreignField: '_id',
                                as: 'attendanceLogInfo',
                                pipeline: [
                                    { $match: { attendanceDate: today } },
                                    { $project: { user: 1, attendanceDate: 1 } }
                                ]
                            }
                        },
                        { $unwind: '$attendanceLogInfo' },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'attendanceLogInfo.user',
                                foreignField: '_id',
                                as: 'user',
                                pipeline: [
                                    { $project: { fullName: 1, employeeCode: 1, designation: 1, department: 1, profileImageUrl: 1 } }
                                ]
                            }
                        },
                        { $unwind: '$user' },
                        {
                            $project: {
                                _id: '$user._id',
                                fullName: '$user.fullName',
                                employeeCode: '$user.employeeCode',
                                designation: '$user.designation',
                                department: '$user.department',
                                profileImageUrl: '$user.profileImageUrl',
                                clockInTime: '$startTime',
                                status: 'Present'
                            }
                        },
                        { $sort: { clockInTime: 1 } }
                    ];
                    if (wantsPagination) {
                        pipeline.push({ $skip: skip }, { $limit: limit });
                    }

                    const activeSessions = await AttendanceSession.aggregate(pipeline);


                    employees = activeSessions;
                } else {

                    employees = presentLogs.map(log => ({
                        _id: log.user._id,
                        fullName: log.user.fullName,
                        employeeCode: log.user.employeeCode,
                        designation: log.user.designation,
                        department: log.user.department,
                        profileImageUrl: log.user.profileImageUrl,
                        clockInTime: log.clockInTime,
                        status: 'Present',
                        notes: log.notes
                    }));
                }
                break;

            case 'late':
                // Find employees who are late
                const lateLogsQuery = AttendanceLog.find({
                    attendanceDate: today,
                    clockInTime: { $exists: true, $ne: null },
                    isLate: true
                }).populate('user', 'fullName employeeCode designation department profileImageUrl').lean();
                if (wantsPagination) lateLogsQuery.skip(skip).limit(limit);
                const lateLogs = await lateLogsQuery;


                employees = lateLogs.map(log => ({
                    _id: log.user._id,
                    fullName: log.user.fullName,
                    employeeCode: log.user.employeeCode,
                    designation: log.user.designation,
                    department: log.user.department,
                    profileImageUrl: log.user.profileImageUrl,
                    clockInTime: log.clockInTime,
                    status: 'Late',
                    notes: log.notes
                }));
                break;

            case 'on-leave':
                // Find employees who are on approved leave for today
                const startOfDay = startOfISTDay(today);
                const endOfDay = new Date(startOfDay);
                endOfDay.setDate(endOfDay.getDate() + 1);

                const approvedLeavesQuery = LeaveRequest.find({
                    status: 'Approved',
                    leaveDates: {
                        $elemMatch: {
                            $gte: startOfDay,
                            $lt: endOfDay
                        }
                    }
                }).populate('employee', 'fullName employeeCode designation department profileImageUrl').lean();
                if (wantsPagination) approvedLeavesQuery.skip(skip).limit(limit);
                const approvedLeaves = await approvedLeavesQuery;


                employees = approvedLeaves.map(leave => ({
                    _id: leave.employee._id,
                    fullName: leave.employee.fullName,
                    employeeCode: leave.employee.employeeCode,
                    designation: leave.employee.designation,
                    department: leave.employee.department,
                    profileImageUrl: leave.employee.profileImageUrl,
                    status: 'On Leave',
                    leaveType: leave.requestType,
                    leaveReason: leave.reason
                }));
                break;

            case 'total':
                if (wantsPagination) {
                    const [items, count] = await Promise.all([
                        User.find({ isActive: true })
                            .select('fullName employeeCode designation department profileImageUrl role employmentStatus joiningDate')
                            .sort({ fullName: 1 })
                            .skip(skip)
                            .limit(limit)
                            .lean(),
                        User.countDocuments({ isActive: true })
                    ]);
                    total = count;
                    employees = items.map(emp => ({
                        _id: emp._id,
                        fullName: emp.fullName,
                        employeeCode: emp.employeeCode,
                        designation: emp.designation,
                        department: emp.department,
                        profileImageUrl: emp.profileImageUrl,
                        role: emp.role,
                        employmentStatus: emp.employmentStatus,
                        joiningDate: emp.joiningDate
                    }));
                    break;
                }

                const allEmployees = await User.find({ isActive: true })
                    .select('fullName employeeCode designation department profileImageUrl role employmentStatus joiningDate')
                    .sort({ fullName: 1 })
                    .lean();


                employees = allEmployees.map(emp => ({
                    _id: emp._id,
                    fullName: emp.fullName,
                    employeeCode: emp.employeeCode,
                    designation: emp.designation,
                    department: emp.department,
                    profileImageUrl: emp.profileImageUrl,
                    role: emp.role,
                    employmentStatus: emp.employmentStatus,
                    joiningDate: emp.joiningDate
                }));
                break;

            default:
                return res.status(400).json({ error: 'Invalid employee type' });
        }

        if (wantsPagination) {
            // Backward-compatible: only return object when pagination params are provided
            return res.json({
                items: employees,
                page,
                limit,
                total: typeof total === 'number' ? total : undefined,
                hasMore: typeof total === 'number' ? (skip + employees.length < total) : (employees.length === limit)
            });
        }

        return res.json(employees);
    } catch (error) {
        console.error(`Error fetching ${type} employees:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/attendance/user/:userId', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate } = req.query;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid employee ID format.' });
        }
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date query parameters are required.' });
        }

        const logs = await AttendanceLog.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId), attendanceDate: { $gte: startDate, $lte: endDate } } },
            { $lookup: { from: 'attendancesessions', localField: '_id', foreignField: 'attendanceLog', as: 'sessions' } },
            { $lookup: { from: 'breaklogs', localField: '_id', foreignField: 'attendanceLog', as: 'breaks' } },
            { $project: { _id: 1, attendanceDate: 1, status: 1, clockInTime: 1, clockOutTime: 1, notes: 1, logoutType: 1, autoLogoutReason: 1, sessions: { $map: { input: "$sessions", as: "s", in: { startTime: "$$s.startTime", endTime: "$$s.endTime", logoutType: "$$s.logoutType", autoLogoutReason: "$$s.autoLogoutReason" } } }, breaks: { $map: { input: "$breaks", as: "b", in: { _id: "$$b._id", startTime: "$$b.startTime", endTime: "$$b.endTime", durationMinutes: "$$b.durationMinutes", breakType: "$$b.breakType" } } } } },
            { $sort: { attendanceDate: 1 } }
        ]);

        res.json(logs);

    } catch (error) {
        console.error('Error fetching user attendance summary:', error);
        res.status(500).json({ error: 'Server error while fetching attendance summary.' });
    }
});

/**
 * PUT /api/admin/attendance/log/:logId
 * Update an attendance log with new sessions and breaks
 * 
 * Expected payload structure:
 * {
 *   sessions: Array<{ 
 *     startTime: string (ISO 8601 date string, required),
 *     endTime: string (ISO 8601 date string, optional, must be after startTime if provided)
 *   }>,
 *   breaks: Array<{
 *     startTime: string (ISO 8601 date string, required),
 *     endTime: string (ISO 8601 date string, required, must be after startTime),
 *     breakType: 'Paid' | 'Unpaid' | 'Extra' (required)
 *   }>,
 *   notes: string (optional, defaults to empty string)
 * }
 * 
 * Validation rules:
 * - All time values must be valid ISO 8601 date strings
 * - endTime must be after startTime for both sessions and breaks
 * - Session duration cannot exceed 24 hours (increased from 16 hours for admin flexibility)
 * - Break duration cannot exceed 24 hours (increased from 16 hours for admin flexibility)
 * - breakType must be one of: 'Paid', 'Unpaid', 'Extra'
 * - Admins can edit auto-logged-out attendance logs (restriction removed)
 */
router.put('/attendance/log/:logId', [authenticateToken, isAdminOrHr], async (req, res) => {
    const { logId } = req.params;
    let { sessions, breaks, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(logId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid log ID.',
            error: 'Invalid log ID.'
        });
    }

    // Log received data for debugging (remove in production if needed)
    console.log('PUT /admin/attendance/log/:logId - Received data:', {
        logId,
        sessionsType: typeof sessions,
        sessionsIsArray: Array.isArray(sessions),
        sessionsLength: Array.isArray(sessions) ? sessions.length : 'N/A',
        breaksType: typeof breaks,
        breaksIsArray: Array.isArray(breaks),
        breaksLength: Array.isArray(breaks) ? breaks.length : 'N/A',
        hasNotes: notes !== undefined
    });

    // First, check if the attendance log exists and if it was auto-logged out
    const log = await AttendanceLog.findById(logId);
    if (!log) {
        return res.status(404).json({
            success: false,
            message: 'Attendance log not found.',
            error: 'Attendance log not found.'
        });
    }

    // PHASE 6: Warn if this date has an approved leave
    let leaveWarning = null;
    if (log.leaveRequest) {
        const leaveRequest = await LeaveRequest.findById(log.leaveRequest);
        if (leaveRequest && leaveRequest.status === 'Approved') {
            leaveWarning = `Warning: This date has an approved leave (${leaveRequest.requestType}). Editing attendance may conflict with leave status.`;
        }
    }

    // CRITICAL FIX: Allow admins to edit auto-logged-out sessions
    // Admins should be able to override auto-logout restrictions for corrections
    // Only show warning, but allow the edit to proceed
    if (log.logoutType === 'AUTO' && log.autoLogoutReason) {
        // Log warning but allow admin to proceed with edit
        console.warn('[Admin Edit] Editing auto-logged-out attendance log:', {
            logId: log._id,
            userId: log.user,
            autoLogoutReason: log.autoLogoutReason,
            adminUserId: req.user.userId,
            adminRole: req.user.role
        });

        // Clear auto-logout status when admin edits (mark as manually corrected)
        if (sessions !== undefined || breaks !== undefined) {
            log.logoutType = 'MANUAL';
            log.autoLogoutReason = null;
            console.log('[Admin Edit] Auto-logout status cleared by admin edit');
        }
        // Continue with normal edit flow below
    }

    // Validate and default required fields
    if (sessions === undefined || sessions === null) {
        sessions = [];
    }
    if (!Array.isArray(sessions)) {
        console.error('Validation error: sessions is not an array:', sessions);
        return res.status(400).json({
            success: false,
            message: 'Sessions must be an array.',
            error: 'Sessions must be an array.'
        });
    }

    if (breaks === undefined || breaks === null) {
        breaks = [];
    }
    if (!Array.isArray(breaks)) {
        console.error('Validation error: breaks is not an array:', breaks);
        return res.status(400).json({
            success: false,
            message: 'Breaks must be an array.',
            error: 'Breaks must be an array.'
        });
    }

    // Validate sessions with time ordering checks
    for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        if (!s || typeof s !== 'object') {
            return res.status(400).json({
                success: false,
                message: `Session #${i + 1} is invalid. Expected an object.`,
                error: `Session #${i + 1} is invalid. Expected an object.`
            });
        }
        if (!s.startTime) {
            return res.status(400).json({
                success: false,
                message: `Session #${i + 1} is missing startTime.`,
                error: `Session #${i + 1} is missing startTime.`
            });
        }
        const startTime = new Date(s.startTime);
        if (isNaN(startTime.getTime())) {
            return res.status(400).json({
                success: false,
                message: `Session #${i + 1} has an invalid startTime: ${s.startTime}`,
                error: `Session #${i + 1} has an invalid startTime: ${s.startTime}`
            });
        }
        if (s.endTime) {
            const endTime = new Date(s.endTime);
            if (isNaN(endTime.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: `Session #${i + 1} has an invalid endTime: ${s.endTime}`,
                    error: `Session #${i + 1} has an invalid endTime: ${s.endTime}`
                });
            }
            // Validate time ordering: endTime must be after startTime
            if (endTime <= startTime) {
                return res.status(400).json({
                    success: false,
                    message: `Session #${i + 1} end time must be after start time.`,
                    error: `Session #${i + 1} end time must be after start time.`
                });
            }
            // Validate reasonable duration (max 24 hours for admin edits - increased from 16 hours)
            // This allows for legitimate cases like night shifts, corrections, etc.
            const durationHours = (endTime - startTime) / (1000 * 60 * 60);
            if (durationHours > 24) {
                return res.status(400).json({
                    success: false,
                    message: `Session #${i + 1} duration cannot exceed 24 hours.`,
                    error: `Session #${i + 1} duration cannot exceed 24 hours.`
                });
            }
        }
    }

    // Validate breaks with time ordering and breakType checks
    for (let i = 0; i < breaks.length; i++) {
        const b = breaks[i];
        if (!b || typeof b !== 'object') {
            return res.status(400).json({
                success: false,
                message: `Break #${i + 1} is invalid. Expected an object.`,
                error: `Break #${i + 1} is invalid. Expected an object.`
            });
        }
        if (!b.startTime) {
            return res.status(400).json({
                success: false,
                message: `Break #${i + 1} is missing startTime.`,
                error: `Break #${i + 1} is missing startTime.`
            });
        }
        if (!b.endTime) {
            return res.status(400).json({
                success: false,
                message: `Break #${i + 1} is missing endTime.`,
                error: `Break #${i + 1} is missing endTime.`
            });
        }
        const startTime = new Date(b.startTime);
        const endTime = new Date(b.endTime);
        if (isNaN(startTime.getTime())) {
            return res.status(400).json({
                success: false,
                message: `Break #${i + 1} has an invalid startTime: ${b.startTime}`,
                error: `Break #${i + 1} has an invalid startTime: ${b.startTime}`
            });
        }
        if (isNaN(endTime.getTime())) {
            return res.status(400).json({
                success: false,
                message: `Break #${i + 1} has an invalid endTime: ${b.endTime}`,
                error: `Break #${i + 1} has an invalid endTime: ${b.endTime}`
            });
        }
        // Validate time ordering: endTime must be after startTime
        if (endTime <= startTime) {
            return res.status(400).json({
                success: false,
                message: `Break #${i + 1} end time must be after start time.`,
                error: `Break #${i + 1} end time must be after start time.`
            });
        }
        // Validate reasonable duration (max 24 hours for admin edits - increased from 16 hours)
        // This allows for legitimate cases like corrections, extended breaks, etc.
        const durationHours = (endTime - startTime) / (1000 * 60 * 60);
        if (durationHours > 24) {
            return res.status(400).json({
                success: false,
                message: `Break #${i + 1} duration cannot exceed 24 hours.`,
                error: `Break #${i + 1} duration cannot exceed 24 hours.`
            });
        }
        // Handle both breakType and type for backward compatibility
        const breakType = (b.breakType || b.type || '').toString().trim();
        if (!breakType) {
            return res.status(400).json({
                success: false,
                message: `Break #${i + 1} is missing breakType.`,
                error: `Break #${i + 1} is missing breakType.`
            });
        }
        if (!['Paid', 'Unpaid', 'Extra'].includes(breakType)) {
            return res.status(400).json({
                success: false,
                message: `Break #${i + 1} has an invalid breakType: ${breakType}. Must be 'Paid', 'Unpaid', or 'Extra'.`,
                error: `Break #${i + 1} has an invalid breakType: ${breakType}. Must be 'Paid', 'Unpaid', or 'Extra'.`
            });
        }
    }

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
        // Reload log within transaction to ensure consistency
        const logInTransaction = await AttendanceLog.findById(logId).session(dbSession);
        if (!logInTransaction) {
            await dbSession.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Attendance log not found.',
                error: 'Attendance log not found.'
            });
        }

        // Ensure logoutType check still applies (double-check within transaction)
        if (logInTransaction.logoutType === 'AUTO' && logInTransaction.autoLogoutReason) {
            // CRITICAL FIX: Allow admins to edit auto-logged-out sessions
            // Clear auto-logout status when admin edits (mark as manually corrected)
            console.warn('[Admin Edit] Editing auto-logged-out attendance log in transaction:', {
                logId: logInTransaction._id,
                userId: logInTransaction.user,
                autoLogoutReason: logInTransaction.autoLogoutReason,
                adminUserId: req.user.userId,
                adminRole: req.user.role
            });

            // Clear auto-logout status
            logInTransaction.logoutType = 'MANUAL';
            logInTransaction.autoLogoutReason = null;
            console.log('[Admin Edit] Auto-logout status cleared by admin edit in transaction');
        }

        const log = logInTransaction;

        await AttendanceSession.deleteMany({ attendanceLog: log._id }).session(dbSession);
        await BreakLog.deleteMany({ attendanceLog: log._id }).session(dbSession);

        const newSessions = sessions.map(s => ({
            startTime: new Date(s.startTime),
            endTime: s.endTime ? new Date(s.endTime) : null,
            attendanceLog: log._id,
        }));
        if (newSessions.length > 0) {
            await AttendanceSession.insertMany(newSessions, { session: dbSession });
        }

        let totalPaidBreak = 0;
        let totalUnpaidBreak = 0;

        const newBreaks = breaks.map(b => {
            const startTime = new Date(b.startTime);
            const endTime = new Date(b.endTime);
            const durationMinutes = (endTime - startTime) / 60000;

            // Handle both breakType and type for backward compatibility
            const breakType = b.breakType || b.type || 'Unpaid';

            if (breakType === 'Paid') {
                totalPaidBreak += durationMinutes;
            } else {
                totalUnpaidBreak += durationMinutes;
            }

            return {
                type: breakType,
                breakType: breakType,
                startTime,
                endTime,
                durationMinutes,
                attendanceLog: log._id,
                userId: log.user
            };
        });

        if (newBreaks.length > 0) {
            await BreakLog.insertMany(newBreaks, { session: dbSession });
        }

        // Preserve existing clockInTime and clockOutTime if not updating from sessions
        // This ensures required fields remain valid during partial updates
        // CRITICAL: clockInTime is required in schema, so we must preserve it if not updating
        const sortedSessions = [...newSessions].sort((a, b) => a.startTime - b.startTime);

        // Track if clockInTime changed so we can recalculate derived fields
        const previousClockInTime = log.clockInTime ? new Date(log.clockInTime).getTime() : null;
        let clockInTimeChanged = false;

        // Only update clockInTime if we have valid sessions (preserve existing if not)
        // This prevents Mongoose validation errors: "Path `clockInTime` is required"
        if (sortedSessions.length > 0 && sortedSessions[0].startTime) {
            const newClockInTime = sortedSessions[0].startTime;
            const newClockInTimeMs = new Date(newClockInTime).getTime();
            // Check if clockInTime actually changed
            if (previousClockInTime !== newClockInTimeMs) {
                clockInTimeChanged = true;
                log.clockInTime = newClockInTime;
            }
        }
        // If no sessions or empty sessions array, preserve existing clockInTime
        // (no assignment needed - log.clockInTime already has the existing value)

        // Update clockOutTime if we have valid sessions (clockOutTime is optional, so null is OK)
        const lastSession = sortedSessions[sortedSessions.length - 1];
        if (sortedSessions.length > 0) {
            // We have sessions - update clockOutTime based on last session
            log.clockOutTime = lastSession?.endTime || null;
            // If admin is editing and setting clockOutTime, preserve logoutType appropriately
            // Only set to MANUAL if clockOutTime is being set and logoutType was not AUTO
            if (lastSession?.endTime && log.logoutType !== 'AUTO') {
                log.logoutType = 'MANUAL'; // Admin edits are considered manual
                log.autoLogoutReason = null; // Clear auto-logout reason if admin edits
            }
        }
        // If no sessions, preserve existing clockOutTime and logoutType (no assignment needed)

        log.paidBreakMinutesTaken = totalPaidBreak;
        log.unpaidBreakMinutesTaken = totalUnpaidBreak;
        log.notes = notes !== undefined ? notes : log.notes; // Only update if provided
        log.penaltyMinutes = 0;

        // CRITICAL: If clockInTime changed, recalculate derived fields (isLate, isHalfDay, etc.)
        // This ensures admin edits immediately update the status
        if (clockInTimeChanged && log.clockInTime) {
            try {
                const user = await User.findById(log.user).populate('shiftGroup').lean();
                if (user && user.shiftGroup && user.shiftGroup.startTime) {
                    const recalculatedStatus = await recalculateLateStatus(
                        log.clockInTime,
                        user.shiftGroup
                    );
                    // Update derived fields with recalculated values
                    log.isLate = recalculatedStatus.isLate;
                    log.isHalfDay = recalculatedStatus.isHalfDay;
                    log.lateMinutes = recalculatedStatus.lateMinutes;
                    log.attendanceStatus = recalculatedStatus.attendanceStatus;
                    console.log(`✅ Recalculated attendance status after clockInTime update: ${recalculatedStatus.attendanceStatus} (lateMinutes: ${recalculatedStatus.lateMinutes})`);
                }
            } catch (recalcError) {
                console.error('Error recalculating late status after clockInTime update:', recalcError);
                // Don't fail the request, but log the error
            }
        }

        // Recalculate total working hours based on updated sessions and breaks
        if (log.clockInTime && log.clockOutTime) {
            const workingMinutes = (new Date(log.clockOutTime) - new Date(log.clockInTime)) / (1000 * 60);
            const totalBreakMinutes = totalPaidBreak + totalUnpaidBreak;
            const netWorkingMinutes = Math.max(0, workingMinutes - totalBreakMinutes);
            log.totalWorkingHours = netWorkingMinutes / 60;
        } else {
            log.totalWorkingHours = 0;
        }

        // Save the log with validation - catch any Mongoose validation errors
        try {
            await log.save({ session: dbSession });
        } catch (saveError) {
            await dbSession.abortTransaction();

            // Handle Mongoose validation errors specifically
            if (saveError.name === 'ValidationError') {
                const validationMessages = Object.values(saveError.errors).map(err => err.message);
                console.error('Mongoose validation error:', validationMessages);
                return res.status(400).json({
                    success: false,
                    message: `Validation failed: ${validationMessages.join(', ')}`,
                    error: `Validation failed: ${validationMessages.join(', ')}`
                });
            }

            // Re-throw other errors to be handled by outer catch block
            throw saveError;
        }

        await dbSession.commitTransaction();

        // Emit Socket.IO event to notify all clients about the attendance log update
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                // PERFORMANCE OPTIMIZATION: Minimal payload for real-time updates
                io.emit('attendance_log_updated', {
                    logId: log._id,
                    userId: log.user,
                    attendanceDate: log.attendanceDate,
                    attendanceStatus: log.attendanceStatus,
                    isHalfDay: log.isHalfDay,
                    halfDayReasonText: log.halfDayReasonText,
                    timestamp: new Date().toISOString(),
                    message: `Attendance log updated by admin`
                });
                console.log(`📡 Emitted attendance_log_updated event for log ${log._id}`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        // PHASE 4 OPTIMIZATION: Cache invalidation on mutation
        // Invalidate status cache for this user and date
        const cache = require('../utils/cache');
        const cacheKey = `status:${log.user}:${log.attendanceDate}`;
        cache.delete(cacheKey);
        // Also invalidate dashboard summary cache
        cache.deletePattern(`dashboard-summary:*`);
        // Also invalidate existing cacheService
        const cacheService = require('../services/cacheService');
        cacheService.invalidateAttendance(log.user, log.attendanceDate);
        cacheService.invalidateDashboard(log.attendanceDate);
        // PERFORMANCE OPTIMIZATION: Invalidate status cache
        invalidateStatus(log.user.toString(), log.attendanceDate);

        const response = {
            success: true,
            message: 'Log updated successfully.'
        };

        // PHASE 6: Include warning if leave exists
        if (leaveWarning) {
            response.warning = leaveWarning;
        }

        res.json(response);

    } catch (error) {
        await dbSession.abortTransaction();

        // Handle different error types with structured responses
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: `Validation failed: ${messages.join(', ')}`,
                error: `Validation failed: ${messages.join(', ')}`
            });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid data format for field: ${error.path}. Please check your inputs.`,
                error: `Invalid data format for field: ${error.path}. Please check your inputs.`
            });
        }

        // Log error for debugging but don't expose internal details to client
        console.error('Error updating attendance log:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while updating log. Please try again.',
            error: 'Server error while updating log.'
        });
    } finally {
        dbSession.endSession();
    }
});

// DELETE /api/admin/attendance/log/:logId
// Delete an attendance log and all associated sessions and breaks
router.delete('/attendance/log/:logId', [authenticateToken, isAdminOrHr], async (req, res) => {
    const { logId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(logId)) {
        return res.status(400).json({ error: 'Invalid log ID.' });
    }

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
        // Find the log and populate user info for audit logging
        const log = await AttendanceLog.findById(logId)
            .populate('user', 'fullName employeeCode')
            .session(dbSession);

        if (!log) {
            await dbSession.abortTransaction();
            return res.status(404).json({ error: 'Attendance log not found.' });
        }

        // Store log data for audit logging before deletion
        const logData = {
            logId: log._id,
            userId: log.user._id,
            userName: log.user.fullName,
            employeeCode: log.user.employeeCode,
            attendanceDate: log.attendanceDate,
            clockInTime: log.clockInTime,
            clockOutTime: log.clockOutTime,
            attendanceStatus: log.attendanceStatus,
            totalWorkingHours: log.totalWorkingHours
        };

        // Delete all associated sessions
        await AttendanceSession.deleteMany({ attendanceLog: log._id }).session(dbSession);

        // Delete all associated breaks
        await BreakLog.deleteMany({ attendanceLog: log._id }).session(dbSession);

        // Delete the attendance log
        await AttendanceLog.findByIdAndDelete(logId).session(dbSession);

        await dbSession.commitTransaction();

        // Log the admin action
        try {
            const auditLogger = require('../services/auditLogger');
            await auditLogger.logAction({
                userId: req.user.userId,
                action: 'delete_attendance_log',
                details: {
                    deletedLogId: logData.logId,
                    targetEmployeeId: logData.userId,
                    targetEmployeeName: logData.userName,
                    targetEmployeeCode: logData.employeeCode,
                    attendanceDate: logData.attendanceDate,
                    deletedClockInTime: logData.clockInTime,
                    deletedClockOutTime: logData.clockOutTime,
                    deletedAttendanceStatus: logData.attendanceStatus,
                    deletedTotalWorkingHours: logData.totalWorkingHours
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });
        } catch (auditError) {
            console.error('Failed to log audit action:', auditError);
            // Don't fail the request if audit logging fails
        }

        // Emit Socket.IO event to notify all clients about the attendance log deletion
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                io.emit('attendance_log_deleted', {
                    logId: logData.logId,
                    userId: logData.userId,
                    attendanceDate: logData.attendanceDate,
                    deletedBy: req.user.userId,
                    timestamp: new Date().toISOString(),
                    message: `Attendance log deleted by admin for ${logData.userName} on ${logData.attendanceDate}`
                });
                console.log(`📡 Emitted attendance_log_deleted event for log ${logData.logId}`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        res.json({
            message: 'Attendance log deleted successfully.',
            deletedLog: {
                logId: logData.logId,
                attendanceDate: logData.attendanceDate,
                employeeName: logData.userName
            }
        });

    } catch (error) {
        await dbSession.abortTransaction();
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ error: `Validation failed: ${messages.join(', ')}` });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({ error: `Invalid data format: ${error.message}` });
        }
        console.error('Error deleting attendance log:', error);
        res.status(500).json({ error: 'Server error while deleting log.' });
    } finally {
        dbSession.endSession();
    }
});

// --- YEAR-END LEAVE MANAGEMENT ROUTES ---

// GET /api/admin/leaves/year-end-requests
// Get all Year-End leave requests
router.get('/leaves/year-end-requests', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { employeeId, year } = req.query; // FIXED: Add employee and year filters

        const query = { requestType: 'YEAR_END' };

        // FIXED: Filter by employee if provided
        if (employeeId) {
            query.employee = employeeId;
        }

        // Filter by status if provided
        if (req.query.status) {
            query.status = req.query.status;
        }

        // Filter by year if provided
        if (year) {
            query.yearEndYear = parseInt(year);
        }

        const totalCount = await LeaveRequest.countDocuments(query);
        const requests = await LeaveRequest.find(query)
            .populate('employee', 'fullName employeeCode department designation')
            .populate('approvedBy', 'fullName')
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
        console.error('Error fetching Year-End leave requests:', error);
        res.status(500).json({ error: 'Failed to fetch Year-End requests.' });
    }
});

// PATCH /api/admin/leaves/year-end/:id/status
// Approve or reject Year-End leave request
router.patch('/leaves/year-end/:id/status', [authenticateToken, isAdminOrHr], async (req, res) => {
    const { id } = req.params;
    const { status: newStatus, rejectionNotes } = req.body;

    if (!['Approved', 'Rejected'].includes(newStatus)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const request = await LeaveRequest.findById(id).session(session);
        if (!request) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Year-End request not found.' });
        }

        if (request.requestType !== 'YEAR_END') {
            await session.abortTransaction();
            return res.status(400).json({ error: 'This is not a Year-End leave request.' });
        }

        if (request.status !== 'Pending') {
            await session.abortTransaction();
            return res.status(400).json({ error: 'This request has already been processed.' });
        }

        // CRITICAL: Prevent double processing
        if (request.isProcessed === true) {
            await session.abortTransaction();
            return res.status(409).json({ error: 'This request has already been processed and cannot be modified.' });
        }

        const employee = await User.findById(request.employee).session(session);
        if (!employee) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Employee not found.' });
        }

        const oldStatus = request.status;
        const leaveType = request.yearEndLeaveType;
        const days = request.yearEndDays;
        const subType = request.yearEndSubType;

        // Map leaveType to balance field
        const balanceField = leaveType === 'Sick' ? 'sick' : leaveType === 'Casual' ? 'casual' : 'paid';

        if (newStatus === 'Approved') {
            // Only process if not already processed
            if (!request.isProcessed) {
                // CRITICAL YEAR-END ROLLOVER LOGIC:
                // Year-End request is for the CLOSING year (e.g., 2025)
                // The result MUST be applied to the NEXT year (e.g., 2026)
                const closingYear = request.yearEndYear; // e.g., 2025
                const targetYear = closingYear + 1; // e.g., 2026
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth(); // 0-11 (0 = January, 11 = December)

                // Determine if we're in the target year or later
                // If we're in December of closing year or January+ of target year, apply to target year
                const isInTargetYearOrLater = currentYear >= targetYear;
                const isInDecemberOfClosingYear = currentYear === closingYear && currentMonth === 11;

                if (subType === 'CARRY_FORWARD') {
                    // CARRY FORWARD: Add remaining days to NEXT year's opening balance
                    // Opening balance for target year = default entitlement for target year + carried forward days
                    const defaultEntitlementForTargetYear = employee.leaveEntitlements[balanceField] || 0;
                    const carriedForwardDays = days;

                    // Calculate the target year's opening balance
                    // This is what the employee will have from January 1st of target year
                    const targetYearOpeningBalance = defaultEntitlementForTargetYear + carriedForwardDays;

                    // Apply the carry forward to the balance
                    // If we're in the target year or later, set the balance to the target year opening balance
                    // If we're in December of closing year, prepare the balance for next year
                    if (isInTargetYearOrLater || isInDecemberOfClosingYear) {
                        // Set balance to target year opening balance (entitlement + carry forward)
                        employee.leaveBalances[balanceField] = targetYearOpeningBalance;
                    } else {
                        // If we're still earlier in the closing year, add carry forward to current balance
                        // This will be the balance when the new year starts
                        employee.leaveBalances[balanceField] = (employee.leaveBalances[balanceField] || 0) + carriedForwardDays;
                    }
                } else if (subType === 'ENCASH') {
                    // ENCASH: No balance change - leaves are encashed (paid out)
                    // The balance was already reduced when leaves were used during the closing year
                    // Encashment means the remaining balance is paid out, not carried forward
                    // The employee gets the monetary value, but no leave days are added to next year
                    // No balance update needed - the days are already deducted from closing year balance
                    // The encashment is tracked in the request record for audit purposes
                }
                // Mark as processed to prevent double credit
                request.isProcessed = true;
            }
        }
        // If rejected, no balance changes and no processing flag

        request.status = newStatus;
        request.approvedBy = req.user.userId;
        request.approvedAt = new Date();

        if (newStatus === 'Rejected' && rejectionNotes) {
            request.rejectionNotes = rejectionNotes;
        } else if (newStatus === 'Approved') {
            request.rejectionNotes = undefined;
        }

        await employee.save({ session });
        await request.save({ session });

        // PHASE 2: Year-End requests don't have specific leave dates, so no attendance sync needed
        // Year-End is about balance management, not daily attendance
        // However, if in the future Year-End requests include dates, sync logic would go here

        await session.commitTransaction();

        // Send notification to employee
        const NewNotificationService = require('../services/NewNotificationService');
        await NewNotificationService.notifyYearEndLeaveResponse(
            request.employee,
            employee.fullName,
            newStatus,
            leaveType,
            days,
            subType
        ).catch(err => console.error('Error sending Year-End response notification:', err));

        // Include year-to-year mapping information in response
        const closingYear = request.yearEndYear;
        const targetYear = closingYear + 1;

        res.json({
            message: `Year-End request has been ${newStatus.toLowerCase()}.`,
            request,
            yearMapping: {
                closingYear: closingYear,
                targetYear: targetYear,
                action: subType === 'CARRY_FORWARD'
                    ? `${days} ${leaveType} leaves carried forward from ${closingYear} → ${targetYear}`
                    : `${days} ${leaveType} leaves encashed for ${closingYear}`,
                affectedYear: targetYear
            }
        });
    } catch (error) {
        await session.abortTransaction();
        console.error(`Error updating Year-End request status for ID ${id}:`, error);
        res.status(500).json({ error: 'Failed to update Year-End request status.' });
    } finally {
        session.endSession();
    }
});

// DELETE /api/admin/leaves/year-end/:id
// Delete Year-End request (Pending or Approved with rollback)
router.delete('/leaves/year-end/:id', [authenticateToken, isAdminOrHr], async (req, res) => {
    const { id } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const request = await LeaveRequest.findById(id).session(session);
        if (!request) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Year-End request not found.' });
        }

        if (request.requestType !== 'YEAR_END') {
            await session.abortTransaction();
            return res.status(400).json({ error: 'This is not a Year-End leave request.' });
        }

        // Block deletion of Rejected requests (they don't affect balances anyway)
        if (request.status === 'Rejected') {
            await session.abortTransaction();
            return res.status(403).json({
                error: 'Cannot delete a Rejected Year-End request.'
            });
        }

        const employee = await User.findById(request.employee).session(session);
        if (!employee) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Employee not found.' });
        }

        // Handle APPROVED requests with rollback
        if (request.status === 'Approved') {
            const leaveType = request.yearEndLeaveType;
            const days = request.yearEndDays;
            const subType = request.yearEndSubType;

            if (!leaveType || !days || !subType) {
                await session.abortTransaction();
                return res.status(400).json({
                    error: 'Invalid Year-End request data. Cannot perform rollback.'
                });
            }

            // Map leaveType to balance field
            const balanceField = leaveType === 'Sick' ? 'sick' : leaveType === 'Casual' ? 'casual' : 'paid';

            // Perform rollback based on action type
            // CRITICAL: Rollback must reverse the year-end action correctly
            // For CARRY_FORWARD: Balance was set to (defaultEntitlement + days)
            // Rollback: Set back to defaultEntitlement (remove carried forward days)
            // For ENCASH: No balance change was made (leaves were already used)
            // Rollback: No change needed (encashment doesn't affect balance)
            const defaultEntitlement = employee.leaveEntitlements[balanceField] || 0;

            if (subType === 'CARRY_FORWARD') {
                // Rollback: Remove the carried-forward days
                // The balance was set to: defaultEntitlement + days
                // Rollback to: defaultEntitlement (remove the carry forward)
                employee.leaveBalances[balanceField] = defaultEntitlement;
            } else if (subType === 'ENCASH') {
                // Rollback: No balance change needed for encashment
                // Encashment doesn't add to balance - it just pays out the remaining days
                // The balance was already reduced when leaves were used during the closing year
                // No rollback needed
            }

            await employee.save({ session });
        }
        // For PENDING requests, no balance changes needed

        // Store request data for notification before deletion
        const requestData = {
            employeeId: request.employee,
            employeeName: employee.fullName,
            leaveType: request.yearEndLeaveType,
            year: request.yearEndYear || new Date().getFullYear(),
            status: request.status
        };

        // Delete the request
        await LeaveRequest.findByIdAndDelete(id).session(session);

        await session.commitTransaction();

        // Send notification to employee (only for APPROVED requests that were rolled back)
        if (requestData.status === 'Approved') {
            const NewNotificationService = require('../services/NewNotificationService');
            await NewNotificationService.createAndEmitNotification({
                message: `Your Year-End leave request for ${requestData.leaveType} (${requestData.year}) has been deleted by Admin. Leave balance changes have been reverted.`,
                userId: requestData.employeeId,
                userName: requestData.employeeName,
                type: 'leave_rejection',
                recipientType: 'user',
                category: 'leave',
                priority: 'high',
                navigationData: { page: '/leaves' },
                metadata: {
                    type: 'YEAR_END_LEAVE_DELETED',
                    leaveType: requestData.leaveType,
                    year: requestData.year
                }
            });
        }

        res.json({
            message: requestData.status === 'Approved'
                ? 'Year-End request deleted successfully. Leave balance changes have been reverted.'
                : 'Year-End request deleted successfully.',
            deletedRequest: {
                _id: id,
                employee: requestData.employeeId,
                yearEndLeaveType: requestData.leaveType,
                yearEndYear: requestData.year,
                status: requestData.status,
                rolledBack: requestData.status === 'Approved'
            }
        });
    } catch (error) {
        await session.abortTransaction();
        console.error(`Error deleting Year-End request for ID ${id}:`, error);
        res.status(500).json({ error: 'Failed to delete Year-End request.' });
    } finally {
        session.endSession();
    }
});

// POST /api/admin/attendance/override-half-day - Override half-day marking for an attendance log
// NEW: Accepts overrideReason in request body
router.post('/attendance/override-half-day', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const { attendanceLogId } = req.body;

        // Validate required fields
        if (!attendanceLogId) {
            return res.status(400).json({
                success: false,
                error: 'attendanceLogId is required.'
            });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(attendanceLogId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid attendanceLogId format.'
            });
        }

        // Find the attendance log with user and shiftGroup populated
        const log = await AttendanceLog.findById(attendanceLogId)
            .populate({
                path: 'user',
                select: 'fullName employeeCode shiftGroup',
                populate: {
                    path: 'shiftGroup',
                    select: 'startTime endTime durationHours shiftType name'
                }
            });
        if (!log) {
            return res.status(404).json({
                success: false,
                error: 'Attendance log not found.'
            });
        }

        // Get override reason from request body (required for audit trail)
        const { overrideReason, newStatus } = req.body;

        // Validate override reason if provided (should be mandatory for proper audit trail)
        if (!overrideReason || typeof overrideReason !== 'string' || overrideReason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'overrideReason is required when overriding half-day status.'
            });
        }

        // Store original values for audit logging
        const originalStatus = log.attendanceStatus;
        const originalIsHalfDay = log.isHalfDay;
        const originalAdminOverride = log.adminOverride;
        const originalHalfDayReason = log.halfDayReasonText;

        // Override half-day: Set adminOverride flag and recompute status
        log.adminOverride = 'Override Half Day';
        log.isHalfDay = false;

        // Clear half-day reason fields (overriding removes half-day status)
        log.halfDayReasonCode = null;
        log.halfDayReasonText = '';
        log.halfDaySource = null;

        // Set override tracking fields
        log.overriddenByAdmin = true;
        log.overriddenAt = new Date();
        log.overriddenBy = req.user.userId;
        log.overrideReason = overrideReason.trim();

        // CRITICAL: Recompute late/half-day status from CURRENT clockInTime
        // This ensures derived state is always correct after override
        if (log.clockInTime && log.user && log.user.shiftGroup && log.user.shiftGroup.startTime) {
            const recalculatedStatus = await recalculateLateStatus(
                log.clockInTime,
                log.user.shiftGroup
            );

            // Since we're overriding half-day, we need to determine the correct status
            // If the employee was actually late (beyond grace period), mark as Late
            // Otherwise, mark as On-time
            if (recalculatedStatus.lateMinutes > 0) {
                // Employee was late - check if within grace period
                let GRACE_PERIOD_MINUTES = 30;
                try {
                    const graceSetting = await Setting.findOne({ key: 'lateGraceMinutes' });
                    if (graceSetting) {
                        // FIX: Explicitly convert to integer to ensure type consistency
                        const graceValue = parseInt(Number(graceSetting.value), 10);
                        if (!isNaN(graceValue) && graceValue >= 0) {
                            GRACE_PERIOD_MINUTES = graceValue;
                        } else {
                            console.warn(`[Grace Period] Invalid value in database: ${graceSetting.value}, using default 30`);
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch late grace setting, using default 30 minutes', err);
                }

                if (recalculatedStatus.lateMinutes <= GRACE_PERIOD_MINUTES) {
                    // Within grace period - On-time
                    log.attendanceStatus = 'On-time';
                    log.isLate = false;
                    log.lateMinutes = recalculatedStatus.lateMinutes;
                } else {
                    // Beyond grace period - Late (but not half-day due to override)
                    log.attendanceStatus = 'Late';
                    log.isLate = true;
                    log.lateMinutes = recalculatedStatus.lateMinutes;
                }
            } else {
                // Not late - On-time
                log.attendanceStatus = 'On-time';
                log.isLate = false;
                log.lateMinutes = 0;
            }
        } else {
            // No clock-in time or shift info - default to On-time
            log.attendanceStatus = 'On-time';
            log.isLate = false;
            log.lateMinutes = 0;
        }

        // CRITICAL: Ensure log has required fields before saving
        // If log doesn't have clockInTime, we need to set a default to prevent deletion
        if (!log.clockInTime) {
            // Set a default clock-in time based on attendance date
            log.clockInTime = new Date(`${log.attendanceDate}T09:00:00`);
        }

        // Ensure log has attendanceDate
        if (!log.attendanceDate) {
            // This shouldn't happen, but add safety check
            console.error('[Override Half-Day] Log missing attendanceDate:', log._id);
            return res.status(400).json({
                success: false,
                error: 'Attendance log is missing required fields.'
            });
        }

        // Save the updated log (DO NOT DELETE - just update status)
        await log.save();

        // Emit Socket.IO event to notify all clients about the attendance log update
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                io.emit('attendance_log_updated', {
                    logId: log._id,
                    userId: log.user._id || log.user,
                    attendanceDate: log.attendanceDate,
                    attendanceStatus: log.attendanceStatus,
                    isHalfDay: log.isHalfDay,
                    isLate: log.isLate,
                    totalWorkingHours: log.totalWorkingHours,
                    clockInTime: log.clockInTime,
                    clockOutTime: log.clockOutTime,
                    adminOverride: log.adminOverride,
                    previousStatus: originalStatus,
                    updatedBy: req.user.userId,
                    timestamp: new Date().toISOString(),
                    message: `Half-day override applied: ${originalStatus} → ${log.attendanceStatus}`
                });
                console.log(`📡 Emitted attendance_log_updated event for override on log ${log._id}`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        // Log the admin action for audit trail
        try {
            const logAction = require('../services/logAction');
            await logAction(
                req.user.userId,
                'OVERRIDE_HALF_DAY',
                {
                    attendanceLogId: log._id,
                    attendanceDate: log.attendanceDate,
                    employeeId: log.user._id || log.user,
                    employeeName: log.user.fullName || 'Unknown',
                    previousStatus: originalStatus,
                    previousIsHalfDay: originalIsHalfDay,
                    newStatus: log.attendanceStatus,
                    newIsHalfDay: log.isHalfDay,
                    adminOverride: log.adminOverride,
                    details: `Admin override: Half-day marking removed for ${log.attendanceDate}. Status changed from "${originalStatus}" to "${log.attendanceStatus}". Override reason: "${overrideReason}". Previous half-day reason: "${originalHalfDayReason || 'None'}"`
                }
            );
        } catch (logError) {
            console.error('Failed to log override action:', logError);
            // Don't fail the main request if logging fails
        }

        res.status(200).json({
            success: true,
            message: 'Half day overridden successfully.',
            log: {
                _id: log._id,
                attendanceDate: log.attendanceDate,
                attendanceStatus: log.attendanceStatus,
                isHalfDay: log.isHalfDay,
                isLate: log.isLate,
                lateMinutes: log.lateMinutes,
                adminOverride: log.adminOverride,
                overrideReason: log.overrideReason,
                overriddenByAdmin: log.overriddenByAdmin,
                overriddenAt: log.overriddenAt,
                previousStatus: originalStatus,
                previousHalfDayReason: originalHalfDayReason
            }
        });

    } catch (error) {
        console.error('Error overriding half-day status:', error);
        console.error('Error stack:', error.stack);
        console.error('Request details:', {
            attendanceLogId: req.body.attendanceLogId,
            userId: req.user?.userId
        });
        res.status(500).json({
            success: false,
            error: 'Server error while overriding half-day status.',
            details: error.message
        });
    }
});

// PUT /api/admin/attendance/half-day/:logId - Toggle half-day status for an attendance log
router.put('/attendance/half-day/:logId', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const { logId } = req.params;
        const { isHalfDay } = req.body;

        if (!mongoose.Types.ObjectId.isValid(logId)) {
            return res.status(400).json({ error: 'Invalid log ID.' });
        }

        if (typeof isHalfDay !== 'boolean') {
            return res.status(400).json({ error: 'isHalfDay must be a boolean value.' });
        }

        const log = await AttendanceLog.findById(logId);
        if (!log) {
            return res.status(404).json({ error: 'Attendance log not found.' });
        }

        // Store the original status for logging
        const originalStatus = log.attendanceStatus;
        const wasHalfDay = log.isHalfDay;

        // Update the half-day status
        log.isHalfDay = isHalfDay;

        // Enhanced status transition logic
        if (isHalfDay && !wasHalfDay) {
            // Marking as half-day - set status to Half-day regardless of current status
            log.attendanceStatus = 'Half-day';
        } else if (!isHalfDay && wasHalfDay) {
            // Unmarking half-day - recalculate status based on existing data
            if (!log.clockInTime) {
                // No clock-in time = Absent
                log.attendanceStatus = 'Absent';
            } else if (log.isLate) {
                // Has clock-in but was late = Late
                log.attendanceStatus = 'Late';
            } else {
                // Has clock-in and wasn't late = On-time
                log.attendanceStatus = 'On-time';
            }
        } else if (isHalfDay && wasHalfDay && log.attendanceStatus !== 'Half-day') {
            // Already marked as half-day but status got changed elsewhere - restore to Half-day
            log.attendanceStatus = 'Half-day';
        }

        await log.save();

        // Emit Socket.IO event to notify all clients about the attendance log update
        try {
            const { getIO } = require('../socketManager');
            const io = getIO();
            if (io) {
                // Emit to all connected clients
                io.emit('attendance_log_updated', {
                    logId: log._id,
                    userId: log.user,
                    attendanceDate: log.attendanceDate,
                    attendanceStatus: log.attendanceStatus,
                    isHalfDay: log.isHalfDay,
                    isLate: log.isLate,
                    totalWorkingHours: log.totalWorkingHours,
                    clockInTime: log.clockInTime,
                    clockOutTime: log.clockOutTime,
                    previousStatus: originalStatus,
                    updatedBy: req.user.userId,
                    timestamp: new Date().toISOString(),
                    message: `Attendance log updated: ${originalStatus} → ${log.attendanceStatus} - Working hours: ${log.totalWorkingHours.toFixed(2)}h`
                });
                console.log(`📡 Emitted attendance_log_updated event for log ${log._id}`);
            }
        } catch (socketError) {
            console.error('Failed to emit Socket.IO event:', socketError);
            // Don't fail the main request if Socket.IO fails
        }

        // Log the action with status transition details (with error handling)
        try {
            const logAction = require('../services/logAction');
            await logAction(
                req.user.userId,
                isHalfDay ? 'MARK_HALF_DAY' : 'UNMARK_HALF_DAY',
                {
                    attendanceLogId: log._id,
                    attendanceDate: log.attendanceDate,
                    previousStatus: originalStatus,
                    newStatus: log.attendanceStatus,
                    isHalfDay: log.isHalfDay,
                    details: `${isHalfDay ? 'Marked' : 'Unmarked'} half-day for attendance log on ${log.attendanceDate}. Status changed from "${originalStatus}" to "${log.attendanceStatus}"`
                }
            );
        } catch (logError) {
            console.error('Failed to log half-day action:', logError);
            // Don't fail the main request if logging fails
        }

        res.json({
            message: `Half-day status ${isHalfDay ? 'enabled' : 'disabled'} successfully. Status changed from "${originalStatus}" to "${log.attendanceStatus}".`,
            log: {
                _id: log._id,
                attendanceDate: log.attendanceDate,
                isHalfDay: log.isHalfDay,
                attendanceStatus: log.attendanceStatus,
                previousStatus: originalStatus
            }
        });

    } catch (error) {
        console.error('Error updating half-day status:', error);
        console.error('Error stack:', error.stack);
        console.error('Request details:', {
            logId: req.params.logId,
            isHalfDay: req.body.isHalfDay,
            userId: req.user?.userId
        });
        res.status(500).json({
            error: 'Server error while updating half-day status.',
            details: error.message
        });
    }
});

/**
 * POST /api/admin/attendance/recalculate
 * Recalculate attendance records for a date range to sync with leave requests.
 * Admin-only endpoint for fixing historical data.
 */
router.post('/attendance/recalculate', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const { startDate, endDate, userId } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'Start date and end date are required (format: YYYY-MM-DD).'
            });
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({
                error: 'Invalid date format. Use YYYY-MM-DD.'
            });
        }

        const { recalculateAttendanceForDateRange, cleanupOrphanedLeaveReferences } = require('../services/attendanceRecalculationService');

        // Recalculate attendance for date range
        const recalculationResults = await recalculateAttendanceForDateRange(
            userId || null,
            startDate,
            endDate
        );

        // Clean up orphaned leave references
        const cleanupResults = await cleanupOrphanedLeaveReferences(
            userId || null,
            startDate,
            endDate
        );

        res.json({
            success: true,
            message: 'Recalculation completed.',
            recalculation: recalculationResults,
            cleanup: cleanupResults
        });
    } catch (error) {
        console.error('Error recalculating attendance:', error);
        res.status(500).json({
            error: 'Failed to recalculate attendance.',
            details: error.message
        });
    }
});

module.exports = router;