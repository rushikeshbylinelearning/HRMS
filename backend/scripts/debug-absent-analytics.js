/**
 * DEBUG SCRIPT: Absent Days Analytics Investigation
 * 
 * This script investigates why Absent Days are showing 0 in analytics
 * by examining the actual data and aggregation logic.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function debugAbsentAnalytics() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // First, check what dates exist in the database
        console.log('=== Checking Available Dates ===');
        const dateRange = await AttendanceLog.aggregate([
            {
                $group: {
                    _id: null,
                    minDate: { $min: '$attendanceDate' },
                    maxDate: { $max: '$attendanceDate' },
                    totalRecords: { $sum: 1 }
                }
            }
        ]);
        console.log('Database date range:', dateRange);
        
        // Test date range (adjust as needed)
        const startDate = '2025-06-09';
        const endDate = '2026-03-10';
        
        console.log(`\n📅 Using Date Range: ${startDate} to ${endDate}\n`);
        
        // Step 1: Check if we have any Absent records at all
        console.log('=== STEP 1: Check for Absent Records ===');
        const absentRecords = await AttendanceLog.find({
            attendanceDate: { $gte: startDate, $lte: endDate },
            attendanceStatus: 'Absent'
        }).populate('user', 'fullName employeeCode').lean();
        
        console.log(`Found ${absentRecords.length} Absent records`);
        if (absentRecords.length > 0) {
            console.log('\nSample Absent Records:');
            absentRecords.slice(0, 5).forEach(record => {
                console.log({
                    employee: record.user?.fullName,
                    employeeCode: record.user?.employeeCode,
                    date: record.attendanceDate,
                    status: record.attendanceStatus,
                    isHalfDay: record.isHalfDay,
                    clockInTime: record.clockInTime,
                    clockOutTime: record.clockOutTime
                });
            });
        }
        console.log('\n');
        
        // Step 2: Check all unique status values
        console.log('=== STEP 2: All Unique Status Values ===');
        const allStatuses = await AttendanceLog.distinct('attendanceStatus', {
            attendanceDate: { $gte: startDate, $lte: endDate }
        });
        console.log('Unique statuses:', allStatuses);
        console.log('\n');
        
        // Step 3: Count by status
        console.log('=== STEP 3: Count by Status ===');
        const statusCounts = await AttendanceLog.aggregate([
            {
                $match: {
                    attendanceDate: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$attendanceStatus',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);
        console.log('Status counts:');
        statusCounts.forEach(s => {
            console.log(`  ${s._id}: ${s.count}`);
        });
        console.log('\n');
        
        // Step 4: Test the aggregation logic for a specific employee with Absent days
        if (absentRecords.length > 0) {
            const testEmployee = absentRecords[0].user;
            console.log(`=== STEP 4: Test Aggregation for ${testEmployee.fullName} ===`);
            
            // Get all records for this employee
            const employeeRecords = await AttendanceLog.find({
                user: testEmployee._id,
                attendanceDate: { $gte: startDate, $lte: endDate }
            }).lean();
            
            console.log(`Total records: ${employeeRecords.length}`);
            console.log('\nStatus breakdown:');
            const statusBreakdown = {};
            employeeRecords.forEach(record => {
                const status = record.attendanceStatus;
                statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
            });
            console.log(statusBreakdown);
            
            // Test the aggregation pipeline logic
            console.log('\n=== Testing Aggregation Logic ===');
            const pipeline = [
                {
                    $match: {
                        user: testEmployee._id,
                        attendanceDate: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $addFields: {
                        isAbsentDay: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$attendanceStatus', 'Absent'] },
                                        { $ne: ['$attendanceStatus', 'Holiday'] },
                                        { $ne: ['$attendanceStatus', 'Weekend'] }
                                    ]
                                },
                                true,
                                false
                            ]
                        },
                        dayCount: {
                            $cond: [
                                { $eq: ['$isHalfDay', true] },
                                0.5,
                                1
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: '$user',
                        absentDays: {
                            $sum: {
                                $cond: ['$isAbsentDay', '$dayCount', 0]
                            }
                        },
                        totalRecords: { $sum: 1 },
                        absentRecords: {
                            $sum: {
                                $cond: ['$isAbsentDay', 1, 0]
                            }
                        }
                    }
                }
            ];
            
            const result = await AttendanceLog.aggregate(pipeline);
            console.log('Aggregation result:', result);
            
            // Manual calculation
            console.log('\n=== Manual Calculation ===');
            let manualAbsentCount = 0;
            employeeRecords.forEach(record => {
                if (record.attendanceStatus === 'Absent') {
                    const dayValue = record.isHalfDay ? 0.5 : 1;
                    manualAbsentCount += dayValue;
                    console.log(`  ${record.attendanceDate}: Absent (${dayValue} day)`);
                }
            });
            console.log(`Manual absent count: ${manualAbsentCount}`);
        }
        
        console.log('\n✅ Debug complete');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

debugAbsentAnalytics();
