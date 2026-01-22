// backend/models/ProbationAuditLog.js
// PROBATION AUDIT LOG MODEL
// 
// Tracks all probation calculation events for audit and debugging purposes.
// Provides comprehensive logging of probation calculations, changes, and system events.

const mongoose = require('mongoose');
const { getISTNow } = require('../utils/istTime');

const probationAuditLogSchema = new mongoose.Schema({
    // Employee Information
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    employeeName: {
        type: String,
        required: true
    },
    employeeCode: {
        type: String,
        required: true
    },
    
    // Event Information
    eventType: {
        type: String,
        required: true,
        enum: [
            'PROBATION_CALCULATION',
            'PROBATION_EXTENSION',
            'PROBATION_COMPLETION',
            'SYSTEM_RECALCULATION',
            'MANUAL_OVERRIDE',
            'DATA_MIGRATION',
            'ERROR_EVENT'
        ],
        index: true
    },
    eventDescription: {
        type: String,
        required: true
    },
    
    // Calculation Data (before and after)
    calculationBefore: {
        baseProbationEndDate: String,
        finalProbationEndDate: String,
        leaveExtensionDays: Number,
        absentExtensionDays: Number,
        totalExtensionDays: Number,
        daysLeft: Number
    },
    calculationAfter: {
        baseProbationEndDate: String,
        finalProbationEndDate: String,
        leaveExtensionDays: Number,
        absentExtensionDays: Number,
        totalExtensionDays: Number,
        daysLeft: Number
    },
    
    // Performance Metrics
    performanceMetrics: {
        calculationTimeMs: Number,
        queriesExecuted: Number,
        totalEmployees: Number,
        dataSourceUsed: {
            type: String,
            enum: ['AUTHORITATIVE_SUMMARY', 'RAW_LOGS', 'BULK_OPTIMIZED']
        }
    },
    
    // Change Information
    changeReason: {
        type: String,
        enum: [
            'NEW_LEAVE_APPROVED',
            'LEAVE_CANCELLED',
            'ATTENDANCE_CORRECTION',
            'SYSTEM_MIGRATION',
            'MANUAL_ADJUSTMENT',
            'SCHEDULED_RECALCULATION',
            'DATA_CONSISTENCY_FIX'
        ]
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // System Information
    source: {
        type: String,
        required: true,
        enum: [
            'CRON_SERVICE',
            'API_ENDPOINT',
            'ADMIN_PANEL',
            'SYSTEM_PROCESS',
            'DATA_MIGRATION'
        ]
    },
    ipAddress: String,
    userAgent: String,
    
    // Timestamps
    timestamp: {
        type: Date,
        default: getISTNow,
        index: true
    },
    
    // Additional Context
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'probationauditlogs'
});

// Indexes for efficient querying
probationAuditLogSchema.index({ employeeId: 1, timestamp: -1 });
probationAuditLogSchema.index({ eventType: 1, timestamp: -1 });
probationAuditLogSchema.index({ timestamp: -1 });
probationAuditLogSchema.index({ source: 1, timestamp: -1 });

// Static method to log probation calculation events
probationAuditLogSchema.statics.logProbationCalculation = async function(
    employee, 
    calculationBefore, 
    calculationAfter, 
    eventInfo = {}
) {
    try {
        const auditLog = new this({
            employeeId: employee._id || employee.employeeId,
            employeeName: employee.fullName || employee.employeeName,
            employeeCode: employee.employeeCode,
            eventType: eventInfo.eventType || 'PROBATION_CALCULATION',
            eventDescription: eventInfo.eventDescription || 'Probation calculation performed',
            calculationBefore,
            calculationAfter,
            performanceMetrics: eventInfo.performanceMetrics,
            changeReason: eventInfo.changeReason,
            changedBy: eventInfo.changedBy,
            source: eventInfo.source || 'SYSTEM_PROCESS',
            ipAddress: eventInfo.ipAddress,
            userAgent: eventInfo.userAgent,
            metadata: eventInfo.metadata || {}
        });
        
        await auditLog.save();
        return auditLog;
    } catch (error) {
        console.error('Failed to create probation audit log:', error);
        // Don't throw error to avoid breaking the main process
        return null;
    }
};

// Static method to get audit history for an employee
probationAuditLogSchema.statics.getEmployeeAuditHistory = async function(employeeId, limit = 50) {
    try {
        return await this.find({ employeeId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate('changedBy', 'fullName employeeCode')
            .lean();
    } catch (error) {
        console.error('Failed to fetch employee audit history:', error);
        return [];
    }
};

// Static method to get system audit summary
probationAuditLogSchema.statics.getSystemAuditSummary = async function(startDate, endDate) {
    try {
        const pipeline = [
            {
                $match: {
                    timestamp: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: '$eventType',
                    count: { $sum: 1 },
                    avgCalculationTime: { $avg: '$performanceMetrics.calculationTimeMs' },
                    totalEmployeesProcessed: { $sum: '$performanceMetrics.totalEmployees' }
                }
            },
            {
                $sort: { count: -1 }
            }
        ];
        
        return await this.aggregate(pipeline);
    } catch (error) {
        console.error('Failed to generate system audit summary:', error);
        return [];
    }
};

const ProbationAuditLog = mongoose.model('ProbationAuditLog', probationAuditLogSchema);

module.exports = ProbationAuditLog;