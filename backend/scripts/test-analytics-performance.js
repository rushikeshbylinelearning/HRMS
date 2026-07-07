/**
 * ANALYTICS PERFORMANCE TEST
 * 
 * Tests the optimized analytics endpoint performance
 * Compares old vs new implementation
 * 
 * Run: node backend/scripts/test-analytics-performance.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const AnalyticsServiceOld = require('../services/AnalyticsService');
const AnalyticsServiceNew = require('../services/AnalyticsService.optimized');
const User = require('../models/User');

async function testAnalyticsPerformance() {
    try {
        console.log('🧪 Analytics Performance Test\n');
        console.log('=' .repeat(60));
        
        // Connect to MongoDB
        console.log('\n🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected\n');
        
        // Get employee count
        const employeeCount = await User.countDocuments({ isActive: true, role: { $ne: 'Admin' } });
        console.log(`📊 Active employees: ${employeeCount}\n`);
        
        // Test scenarios
        const scenarios = [
            {
                name: 'Last 7 days',
                days: 7
            },
            {
                name: 'Last 30 days',
                days: 30
            },
            {
                name: 'Last 90 days',
                days: 90
            },
            {
                name: 'Last 365 days (1 year)',
                days: 365
            }
        ];
        
        for (const scenario of scenarios) {
            console.log('=' .repeat(60));
            console.log(`\n📅 Scenario: ${scenario.name}`);
            console.log('-' .repeat(60));
            
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - scenario.days);
            
            const filters = {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                page: 1,
                limit: 50
            };
            
            console.log(`Date range: ${filters.startDate} to ${filters.endDate}`);
            console.log(`Expected records: ~${employeeCount * scenario.days} attendance logs\n`);
            
            // Test OLD implementation
            console.log('🐌 Testing OLD implementation...');
            const oldStartTime = Date.now();
            let oldResult;
            try {
                oldResult = await AnalyticsServiceOld.calculateAttendanceMetrics(filters);
                const oldTime = Date.now() - oldStartTime;
                console.log(`   ⏱️  Execution time: ${oldTime}ms`);
                console.log(`   📊 Employees: ${oldResult.pagination.totalRecords}`);
                console.log(`   ✅ Status: ${oldTime < 1000 ? 'PASS' : 'FAIL'} (target: <1000ms)`);
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
            
            // Test NEW implementation
            console.log('\n🚀 Testing NEW optimized implementation...');
            const newStartTime = Date.now();
            let newResult;
            try {
                newResult = await AnalyticsServiceNew.calculateAttendanceMetrics(filters);
                const newTime = Date.now() - newStartTime;
                console.log(`   ⏱️  Execution time: ${newTime}ms`);
                console.log(`   📊 Employees: ${newResult.pagination.totalRecords}`);
                console.log(`   ✅ Status: ${newTime < 1000 ? 'PASS ✓' : 'FAIL ✗'} (target: <1000ms)`);
                
                // Calculate improvement
                if (oldResult) {
                    const oldTime = Date.now() - oldStartTime + (newStartTime - oldStartTime);
                    const improvement = ((oldTime - newTime) / oldTime * 100).toFixed(1);
                    const speedup = (oldTime / newTime).toFixed(1);
                    console.log(`\n   📈 Improvement: ${improvement}% faster (${speedup}x speedup)`);
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
            
            // Verify data consistency
            if (oldResult && newResult) {
                console.log('\n🔍 Verifying data consistency...');
                const summaryMatch = compareSummaries(oldResult.summary, newResult.summary);
                if (summaryMatch) {
                    console.log('   ✅ Summary metrics match');
                } else {
                    console.log('   ⚠️  Summary metrics differ (check implementation)');
                }
            }
            
            console.log('');
        }
        
        console.log('=' .repeat(60));
        console.log('\n✅ Performance test completed!\n');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Disconnected from MongoDB\n');
        process.exit(0);
    }
}

function compareSummaries(old, newSummary) {
    const tolerance = 0.1; // Allow 0.1 difference for rounding
    
    const fields = [
        'totalEmployees',
        'presentDays',
        'leaveDays',
        'absentDays',
        'totalNetHours'
    ];
    
    for (const field of fields) {
        const diff = Math.abs((old[field] || 0) - (newSummary[field] || 0));
        if (diff > tolerance) {
            console.log(`   ⚠️  ${field}: ${old[field]} vs ${newSummary[field]} (diff: ${diff})`);
            return false;
        }
    }
    
    return true;
}

testAnalyticsPerformance();
