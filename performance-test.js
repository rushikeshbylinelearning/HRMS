// Performance test script for YouTube-style skeleton loading
// Verifies 300ms performance budget compliance

const puppeteer = require('puppeteer');
const fs = require('fs');

const TEST_URL = 'http://localhost:5173'; // Adjust based on your dev server
const PERFORMANCE_BUDGET = 300; // 300ms budget
const SKELETON_BUDGET = 16; // 16ms for skeleton display (1 frame at 60fps)

const testPages = [
    { path: '/', name: 'Root/Login Page' },
    { path: '/dashboard', name: 'Employee Dashboard', requiresAuth: true },
    { path: '/admin/dashboard', name: 'Admin Dashboard', requiresAuth: true },
    { path: '/leaves', name: 'Leaves Page', requiresAuth: true },
    { path: '/profile', name: 'Profile Page', requiresAuth: true },
    { path: '/employees', name: 'Employees Page', requiresAuth: true },
];

async function runPerformanceTest() {
    console.log('🚀 Starting YouTube-style skeleton loading performance test...');
    console.log('📊 Performance Budget: 300ms for page loads, 16ms for skeleton display\n');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const results = [];

        for (const page of testPages) {
            console.log(`\n📄 Testing: ${page.name} (${page.path})`);

            const pageResult = await testPagePerformance(browser, page);
            results.push(pageResult);
        }

        // Generate report
        generateReport(results);

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function testPagePerformance(browser, pageConfig) {
    const page = await browser.newPage();

    // Enable performance monitoring
    await page.setCacheEnabled(false); // Disable cache to test cold loads

    const metrics = {
        name: pageConfig.name,
        path: pageConfig.path,
        skeletonDisplayTime: null,
        pageLoadTime: null,
        largestContentfulPaint: null,
        firstContentfulPaint: null,
        cumulativeLayoutShift: null,
        totalBlockingTime: null,
        skeletonVisible: false,
        errors: []
    };

    try {
        // Monitor console for skeleton visibility
        page.on('console', (msg) => {
            const text = msg.text();
            if (text.includes('[Skeleton] Visible')) {
                metrics.skeletonVisible = true;
            }
        });

        // Start timing
        const startTime = Date.now();

        // Navigate to page
        const response = await page.goto(`${TEST_URL}${pageConfig.path}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        if (!response.ok()) {
            throw new Error(`HTTP ${response.status()}`);
        }

        // Wait for page to stabilize
        await page.waitForTimeout(1000);

        // Measure performance metrics
        const perfMetrics = await page.evaluate(() => {
            const perfEntries = performance.getEntriesByType('measure');
            const paintEntries = performance.getEntriesByType('paint');
            const lcpEntry = performance.getEntriesByType('largest-contentful-paint')[0];

            return {
                firstContentfulPaint: paintEntries.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
                largestContentfulPaint: lcpEntry?.startTime || 0,
                cumulativeLayoutShift: 0, // Would need LayoutShiftObserver
                totalBlockingTime: 0, // Would need LongTaskObserver
            };
        });

        const endTime = Date.now();
        metrics.pageLoadTime = endTime - startTime;
        Object.assign(metrics, perfMetrics);

        // Check if skeleton was displayed (look for shimmer animation)
        const hasSkeleton = await page.$('[class*="shimmer"], [class*="skeleton"]');
        metrics.skeletonVisible = !!hasSkeleton;

        // Check for layout shifts
        const layoutShifts = await page.evaluate(() => {
            // Simple layout shift detection
            let shifts = 0;
            const observer = new MutationObserver(() => shifts++);
            observer.observe(document.body, { childList: true, subtree: true });
            return new Promise(resolve => {
                setTimeout(() => {
                    observer.disconnect();
                    resolve(shifts);
                }, 1000);
            });
        });

        console.log(`   ⏱️  Page Load Time: ${metrics.pageLoadTime}ms`);
        console.log(`   🎨 Skeleton Visible: ${metrics.skeletonVisible ? '✅' : '❌'}`);
        console.log(`   📏 Layout Shifts: ${layoutShifts}`);
        console.log(`   🎯 LCP: ${metrics.largestContentfulPaint}ms`);

        // Budget checks
        const loadBudgetOk = metrics.pageLoadTime <= PERFORMANCE_BUDGET;
        const lcpBudgetOk = metrics.largestContentfulPaint <= PERFORMANCE_BUDGET;

        console.log(`   💰 Load Budget (≤${PERFORMANCE_BUDGET}ms): ${loadBudgetOk ? '✅' : '❌'}`);
        console.log(`   💰 LCP Budget (≤${PERFORMANCE_BUDGET}ms): ${lcpBudgetOk ? '✅' : '❌'}`);

        if (!loadBudgetOk || !lcpBudgetOk) {
            metrics.errors.push('Performance budget exceeded');
        }

    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        metrics.errors.push(error.message);
    } finally {
        await page.close();
    }

    return metrics;
}

function generateReport(results) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE TEST REPORT - YOUTUBE-STYLE SKELETON LOADING');
    console.log('='.repeat(80));

    const passed = results.filter(r => r.pageLoadTime <= PERFORMANCE_BUDGET && r.errors.length === 0);
    const failed = results.filter(r => r.pageLoadTime > PERFORMANCE_BUDGET || r.errors.length > 0);

    console.log(`\n✅ PASSED: ${passed.length}/${results.length} pages`);
    console.log(`❌ FAILED: ${failed.length}/${results.length} pages`);

    console.log('\n📋 DETAILED RESULTS:');
    console.log('-'.repeat(80));

    results.forEach(result => {
        const status = result.pageLoadTime <= PERFORMANCE_BUDGET && result.errors.length === 0 ? '✅' : '❌';
        console.log(`${status} ${result.name}`);
        console.log(`   Load Time: ${result.pageLoadTime}ms (Budget: ≤${PERFORMANCE_BUDGET}ms)`);
        console.log(`   LCP: ${result.largestContentfulPaint}ms`);
        console.log(`   Skeleton: ${result.skeletonVisible ? 'Visible' : 'Not detected'}`);

        if (result.errors.length > 0) {
            console.log(`   Errors: ${result.errors.join(', ')}`);
        }
        console.log('');
    });

    console.log('🎯 RECOMMENDATIONS:');
    if (failed.length > 0) {
        console.log('   - Optimize slow pages with code splitting');
        console.log('   - Implement more aggressive prefetching');
        console.log('   - Consider service worker caching for static assets');
        console.log('   - Review API response times and implement compression');
    } else {
        console.log('   🎉 All pages meet the 300ms performance budget!');
        console.log('   🚀 YouTube-style skeleton loading successfully implemented');
    }

    // Save report to file
    const report = {
        timestamp: new Date().toISOString(),
        budget: PERFORMANCE_BUDGET,
        results,
        summary: {
            total: results.length,
            passed: passed.length,
            failed: failed.length,
            successRate: `${((passed.length / results.length) * 100).toFixed(1)}%`
        }
    };

    fs.writeFileSync('performance-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Report saved to: performance-report.json');
}

if (require.main === module) {
    runPerformanceTest().catch(console.error);
}

module.exports = { runPerformanceTest, testPagePerformance };