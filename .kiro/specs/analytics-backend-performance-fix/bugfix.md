# Bugfix Requirements Document

## Introduction

The Analytics Backend Performance Issue causes the GET /api/analytics/attendance endpoint to take 17.42 seconds to respond for 31 employees. This is caused by an N+1 query loop in AnalyticsService.js where each employee triggers 6 separate database operations serially. The fix will hoist shared queries out of the loop, parallelize employee processing, and integrate the existing but unused cache service to achieve sub-second response times.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the GET /api/analytics/attendance endpoint is called with 31 employees THEN the system takes 17.42 seconds to respond

1.2 WHEN processing employee attendance summaries THEN the system fetches holidays 31 times for the same date range (once per employee)

1.3 WHEN processing employee attendance summaries THEN the system fetches grace period settings 31 times (once per employee)

1.4 WHEN processing multiple employees THEN the system processes them serially, waiting for each employee to complete before starting the next

1.5 WHEN the analyticsCacheService exists in the codebase THEN the system never uses it, resulting in repeated expensive queries for identical requests

1.6 WHEN users load the analytics page THEN the system appears frozen for 17+ seconds, causing users to think the app has crashed

### Expected Behavior (Correct)

2.1 WHEN the GET /api/analytics/attendance endpoint is called with 31 employees for the first time THEN the system SHALL respond in less than 1 second

2.2 WHEN processing employee attendance summaries THEN the system SHALL fetch holidays once and share the result across all employees

2.3 WHEN processing employee attendance summaries THEN the system SHALL fetch grace period settings once and share the result across all employees

2.4 WHEN processing multiple employees THEN the system SHALL process them in parallel using Promise.all()

2.5 WHEN the analyticsCacheService exists in the codebase THEN the system SHALL use it to cache query results, returning cached responses in less than 50ms for repeat queries

2.6 WHEN users load the analytics page THEN the system SHALL respond quickly, providing a fast and responsive user experience

### Unchanged Behavior (Regression Prevention)

3.1 WHEN calculating attendance summaries THEN the system SHALL CONTINUE TO produce the same numerical results and calculations as before the fix

3.2 WHEN using AttendanceSummaryService THEN the system SHALL CONTINUE TO call this service rather than rewriting as a single aggregation

3.3 WHEN admin overrides exist for attendance records THEN the system SHALL CONTINUE TO respect these overrides in calculations

3.4 WHEN holiday resolution logic is applied THEN the system SHALL CONTINUE TO apply the same holiday resolution rules

3.5 WHEN route files, model files, AnalyticsService.optimized.js, or analyticsCacheService.js are present THEN the system SHALL CONTINUE TO leave these files unmodified
