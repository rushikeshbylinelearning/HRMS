# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Slow Analytics Response Time
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Test with 31 employees (the concrete failing case from bug report)
  - Test that GET /api/analytics/attendance with 31 employees responds in <1000ms (from Fault Condition in design)
  - Measure actual response time and count duplicate database queries
  - Verify serial processing behavior (employees processed one at a time)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS with response time >17000ms (this is correct - it proves the bug exists)
  - Document counterexamples found: slow response time, N+1 queries, serial processing
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Calculation Accuracy and Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for various employee counts and date ranges
  - Write property-based tests capturing observed calculation results from Preservation Requirements
  - Test that attendance calculations produce identical numerical results
  - Test that admin overrides are respected in calculations
  - Test that holiday resolution logic produces same results
  - Test that status precedence rules remain unchanged
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Hoist shared queries in AttendanceSummaryService

  - [x] 3.1 Add optional sharedData parameter to getEmployeeAttendanceSummary()
    - Modify function signature: `async function getEmployeeAttendanceSummary(employeeId, startDate, endDate, sharedData = null)`
    - Add JSDoc comment documenting the sharedData parameter structure
    - _Bug_Condition: isBugCondition(input) where input.endpoint == '/api/analytics/attendance' AND employeeCount >= 10_
    - _Expected_Behavior: Response time <1000ms on first load by eliminating duplicate queries_
    - _Preservation: Calculation logic must produce identical numerical results_
    - _Requirements: 2.1, 2.2, 3.1_

  - [x] 3.2 Extract fetchHolidaysForDateRange() function
    - Create new exported function that fetches holidays for a date range
    - Use same query logic as existing holiday fetching code
    - Handle date string conversion (IST format)
    - Return holidays array sorted by date
    - _Requirements: 2.2, 2.3_

  - [x] 3.3 Use shared data when available, fallback to fetching when not
    - Replace holiday fetching in Promise.all with: `const holidays = sharedData?.holidays || await fetchHolidaysForDateRange(startDate, endDate)`
    - Replace grace period fetching with: `const gracePeriodMinutes = sharedData?.gracePeriodMinutes ?? await getGracePeriodMinutes()`
    - Ensure fallback behavior works when sharedData is null (backward compatibility)
    - _Requirements: 2.2, 2.3, 3.1_

  - [x] 3.4 Export new functions
    - Add fetchHolidaysForDateRange to module.exports
    - Verify getEmployeeAttendanceSummary is still exported
    - _Requirements: 2.2_

- [x] 4. Parallelize employee processing in AnalyticsService

  - [x] 4.1 Import fetchHolidaysForDateRange and getGracePeriodMinutes
    - Add import: `const { fetchHolidaysForDateRange } = require('./AttendanceSummaryService')`
    - Add import: `const { getGracePeriodMinutes } = require('../utils/gracePeriod')`
    - _Requirements: 2.2, 2.3_

  - [x] 4.2 Fetch holidays and grace period once before employee loop
    - After line 107, add shared data fetching with Promise.all
    - Create sharedData object: `{ holidays, gracePeriodMinutes }`
    - Add console log for debugging: `console.log('[AnalyticsService V2] Fetched shared data for ${employees.length} employees')`
    - _Bug_Condition: isBugCondition(input) where duplicate queries cause slow response_
    - _Expected_Behavior: Fetch shared data once, reducing query count from 31×2 to 2_
    - _Preservation: Same data is used, just fetched once instead of per-employee_
    - _Requirements: 2.2, 2.3, 3.1_

  - [x] 4.3 Replace serial for...of loop with Promise.all()
    - Convert for...of loop (lines 118-135) to employees.map() with async function
    - Pass sharedData to getEmployeeAttendanceSummary() call
    - Use Promise.all() to execute all employee promises concurrently
    - _Bug_Condition: isBugCondition(input) where serial processing causes slow response_
    - _Expected_Behavior: Parallel processing reduces total time from sum to max of individual times_
    - _Preservation: Same calculations, just executed concurrently_
    - _Requirements: 2.4, 3.1_

  - [x] 4.4 Handle individual employee failures gracefully
    - Return null from catch block instead of throwing
    - Filter out null results after Promise.all: `const employeeMetrics = results.filter(m => m !== null)`
    - Keep error logging for debugging
    - _Requirements: 2.4, 3.1_

- [x] 5. Wire up cache in analyticsController

  - [x] 5.1 Import analyticsCacheService
    - Add import after line 10: `const analyticsCacheService = require('../services/analyticsCacheService')`
    - _Requirements: 2.5_

  - [x] 5.2 Add cache check before service call in getAttendanceAnalytics()
    - Build filters object from request parameters
    - Call `analyticsCacheService.getCachedAnalytics(filters)`
    - If cached result exists, return immediately with cached: true flag
    - Add console log: `console.log('[analyticsController] ✅ Returning cached analytics')`
    - _Bug_Condition: isBugCondition(input) where repeat requests re-execute expensive queries_
    - _Expected_Behavior: Cached requests return in <50ms_
    - _Preservation: Cached data is identical to freshly computed data_
    - _Requirements: 2.5, 2.6, 3.1_

  - [x] 5.3 Store results in cache after computation (TTL: 300s)
    - After AnalyticsService.calculateAttendanceMetrics() call, store result in cache
    - Call `analyticsCacheService.setCachedAnalytics(filters, result, 300)`
    - Add cached: false flag to response
    - _Requirements: 2.5, 2.6_

  - [x] 5.4 Update clearAnalyticsCache() to use real service
    - Replace placeholder implementation (line 175) with `await analyticsCacheService.clearAnalyticsCache()`
    - Keep error handling and response structure
    - _Requirements: 2.6_

  - [x] 5.5 Update getCacheStats() to use real service
    - Replace placeholder implementation (line 192) with `await analyticsCacheService.getCacheStats()`
    - Keep error handling and response structure
    - _Requirements: 2.6_

- [x] 6. Wire up cache in employeeAnalyticsController

  - [x] 6.1 Import analyticsCacheService
    - Add import at top of file: `const analyticsCacheService = require('../services/analyticsCacheService')`
    - _Requirements: 2.5_

  - [x] 6.2 Apply same caching pattern as analyticsController
    - Add cache check before calling AnalyticsService
    - Store results in cache after computation with TTL of 300 seconds
    - Add cached flag to response (true for cache hit, false for cache miss)
    - Use same error handling pattern
    - _Requirements: 2.5, 2.6_

- [x] 7. Verify MongoDB indexes

  - [x] 7.1 Run create-analytics-indexes.js script
    - Execute: `node backend/scripts/create-analytics-indexes.js`
    - Verify script completes without errors
    - _Requirements: 2.3_

  - [x] 7.2 Verify compound index exists
    - Check that AttendanceLog collection has index: `{ user: 1, attendanceDate: 1 }`
    - Verify index is being used in queries (check MongoDB query plans)
    - _Requirements: 2.3_

- [ ] 8. Verify bug condition exploration test now passes

  - [ ] 8.1 Re-run bug condition exploration test from task 1
    - **Property 1: Expected Behavior** - Fast Analytics Response Time
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES with response time <1000ms (confirms bug is fixed)
    - Verify response time is <1000ms on first load
    - Verify response time is <50ms on cached load
    - Verify duplicate queries are eliminated
    - Verify parallel processing is working
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 9. Verify preservation tests still pass

  - [ ] 9.1 Re-run preservation property tests from task 2
    - **Property 2: Preservation** - Calculation Accuracy and Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify calculation results are identical before/after fix
    - Verify admin overrides still work
    - Verify holiday resolution unchanged
    - Verify status precedence unchanged
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 10. Manual verification

  - [ ] 10.1 Restart backend server
    - Stop the backend server
    - Clear any cached data (Redis/memory)
    - Start the backend server: `npm start` (run manually in terminal)
    - Verify server starts without errors
    - _Requirements: 2.1, 2.5_

  - [ ] 10.2 Load analytics page and verify timing
    - Open browser DevTools Network tab
    - Navigate to analytics page
    - Verify GET /api/analytics/attendance responds in <1000ms
    - Reload page and verify response time <50ms (cache hit)
    - Check server logs for cache hit messages
    - _Requirements: 2.1, 2.5_

  - [ ] 10.3 Test cache behavior
    - Call POST /api/analytics/cache/clear
    - Verify next analytics request is slower (cache miss)
    - Verify subsequent request is fast (cache hit)
    - Call GET /api/analytics/cache/stats and verify cache size increases
    - _Requirements: 2.5, 2.6_

  - [ ] 10.4 Verify numerical results match
    - Compare attendance calculations with original implementation
    - Test admin overrides still work correctly
    - Test holiday resolution produces same results
    - Test status precedence rules are unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 11. Checkpoint - Ensure all tests pass
  - Run all automated tests (unit, property-based, integration)
  - Verify all manual verification steps completed successfully
  - Confirm response times meet requirements (<1000ms first load, <50ms cached)
  - Confirm numerical results are identical to original implementation
  - Ask the user if questions arise
