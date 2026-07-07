/**
 * TEST SCRIPT: Test Vishakh's analytics specifically
 * 
 * From the screenshot, Vishakh shows:
 * Present = 11, Leave = 0, Absent = 2, Non-Working = 0.00 (WRONG - should be 2)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');

async function testVishakhAnalytics() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Find Vishakh
        const vishakh = await User.findOne({ fullName: /Vishakh/i }).lean();
        if (!vishakh) {
            console.log('❌ Vishakh not found');
            return;
        }
        
        console.log('Found employee:', vishakh.fullName, vishakh.employeeCode);
        console.log('\n');
        
        // Get all attendance records
        const allRecords = await AttendanceLog.find({
            user: vishakh._id
        }).sort({ attendanceDate: 1 }).lean();
        
        console.log(`Total records: ${allRecords.length}`);
        console.log('\n');
        
        // Group by month
        const byMonth = {};
        allRecords.forEach(record => {
            const month = record.attendanceDate.substring(0, 7); // YYYY-MM
            if (!byMonth[month]) {
                byMonth[month] = {
                    present: 0,
                    leave: 0,
                    absent: 0,
                    halfDay: 0,
                    late: 0,
                    onTime: 0,
                    records: []
                };
            }
            
            const status = record.attendanceStatus;
            if (status === 'On-time') byMonth[month].onTime++;
            else if (status === 'Late') byMonth[month].late++;
            else if (status === 'Half-day') byMonth[month].halfDay++;
            else if (status === 'Leave') byMonth[month].leave++;
            else if (status === 'Absent') byMonth[month].absent++;
            
            if (['On-time', 'Late'].includes(status)) {
                byMonth[month].present += record.isHalfDay ? 0.5 : 1;
            }
            
            byMonth[month].records.push(record);
        });
        
        console.log('=== MONTHLY BREAKDOWN ===');
        Object.keys(byMonth).sort().forEach(month => {
            const data = byMonth[month];
            const nonWorking = data.leave + data.absent;
            console.log(`\n${month}:`);
            console.log(`  Present: ${data.present}`);
            console.log(`  Leave: ${data.leave}`);
            console.log(`  Absent: ${data.absent}`);
            console.log(`  Non-Working (calculated): ${nonWorking}`);
            console.log(`  Status breakdown: On-time=${data.onTime}, Late=${data.late}, Half-day=${data.halfDay}`);
            
            // Show absent records
            if (data.absent > 0) {
                console.log(`  Absent dates:`);
                data.records.filter(r => r.attendanceStatus === 'Absent').forEach(r => {
                    console.log(`    - ${r.attendanceDate}: ${r.attendanceStatus}, isHalfDay=${r.isHalfDay}`);
                });
            }
        });
        
        // Now test the aggregation pipeline for a specific month
        console.log('\n\n=== TESTING AGGREGATION PIPELINE ===');
        
        // Find a month with absent days
        const monthWithAbsent = Object.keys(byMonth).find(m => byMonth[m].absent > 0);
        if (monthWithAbsent) {
            const startDate = `${monthWithAbsent}-01`;
            const endDate = `${monthWithAbsent}-31`;
            
            console.log(`Testing month: ${monthWithAbsent}`);
            console.log(`Date range: ${startDate} to ${endDate}\n`);
            
            const pipeline = [
                {
                    $match: {
                        user: vishakh._id,
                        attendanceDate: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $addFields: {
                        isPresent: {
                            $cond: [
                                {
                                    $and: [
                                        { $in: ['$attendanceStatus', ['On-time', 'Late']] },
                                        { $ne: ['$attendanceStatus', 'Holiday'] },
                                        { $ne: ['$attendanceStatus', 'Weekend'] }
                                    ]
                                },
                                true,
                                false
                            ]
                        },
                        isLeaveDay: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$attendanceStatus', 'Leave'] },
                                        { $ne: [{ $ifNull: ['$leaveRequest', null] }, null] }
                                    ]
                                },
                                true,
                                false
                            ]
                        },
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
                        presentDays: {
                            $sum: {
                                $cond: ['$isPresent', '$dayCount', 0]
                            }
                        },
                        leaveDays: {
                            $sum: {
                                $cond: ['$isLeaveDay', '$dayCount', 0]
                            }
                        },
                        absentDays: {
                            $sum: {
                                $cond: ['$isAbsentDay', '$dayCount', 0]
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        nonWorkingDays: {
                            $add: ['$leaveDays', '$absentDays']
                        }
                    }
                }
            ];
            
            const result = await AttendanceLog.aggregate(pipeline);
            console.log('Aggregation result:', JSON.stringify(result, null, 2));
        }
        
        console.log('\n✅ Test complete');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

testVishakhAnalytics();
