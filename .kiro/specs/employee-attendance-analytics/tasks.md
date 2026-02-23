# Implementation Plan: Employee Attendance Analytics Dashboard

## Overview

This implementation plan breaks down the Employee Attendance Analytics Dashboard feature into discrete, incremental coding tasks. The approach follows a bottom-up strategy: build core backend services first, then API endpoints, then frontend components, with testing integrated throughout.

The implementation leverages existing infrastructure (AttendanceLog model, AttendanceSummaryService, IST utilities) and adds new analytics-specific services and components. Each task builds on previous work, ensuring no orphaned code.

## Tasks

- [x] 1. Set up analytics service foundation
  - Create `backend/services/AnalyticsService.js` with module structure
  - Import required dependencies (mongoose, User, AttendanceLog, Shift models)
  - Import existing utilities (istTime, attendanceStatusResolver)
  - Set up basic service exports
  - _Requirements: 1.1, 1.4, 1.5_

- [ ] 2. Implement core metric calculation functions
  - [x] 2.1 Create MongoDB aggregation pipeline builder
    - Write `buildEmployeeMetricsPipeline()` function
    - Implement date range filtering using IST
    - Implement status-based grouping (Present, Leave, Absent)
    - Add user lookup and shift lookup stages
    - Calculate per-employee metrics (presentDays, leaveDays, absentDays, totalNetHours)
    - _Requirements: 3.1, 4.1, 5.1, 7.1, 14.1, 14.2_

  - [ ]* 2.2 Write property test for Present Days calculation
    - **Property 2: Present Days Status Filter**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 2.3 Write property test for Leave Days calculation
    - **Property 3: Leave Days Status Filter**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 2.4 Write property test for Absent Days calculation
    - **Property 4: Absent Days Status Filter**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 2.5 Implement Average Working Hours calculation
    - Add logic to divide totalNetHours by presentDays
    - Handle zero present days case (return 0)
    - Round to 2 decimal places
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 2.6 Write property test for Average Working Hours
    - **Property 7: Average Working Hours Calculation**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 18.3**

  - [ ]* 2.7 Write property test for Average Hours zero case
    - **Property 8: Average Working Hours Zero Case**
    - **Validates: Requirements 8.6**

  - [ ]* 2.8 Write property test for Leave Days independence
    - **Property 9: Leave Days Independence**
    - **Validates: Requirements 8.7**

  - [x] 2.9 Implement Attendance Percentage calculation
    - Add logic to calculate Present / (Present + Leave + Absent) × 100
    - Handle zero denominator case (return 0)
    - Ensure result is between 0 and 100
    - Round to 2 decimal places
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 2.10 Write property test for Attendance Percentage
    - **Property 10: Attendance Percentage Calculation**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5**

  - [ ]* 2.11 Write property test for Attendance Percentage zero case
    - **Property 11: Attendance Percentage Zero Case**
    - **Validates: Requirements 9.4**

- [ ] 3. Implement overtime and late login calculations
  - [x] 3.1 Add overtime calculation logic
    - Calculate daily overtime as max(0, netHours - shiftDuration)
    - Sum overtime only for Present days
    - Handle null shift duration (skip overtime calculation)
    - Round to 2 decimal places
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 3.2 Write property test for daily overtime calculation
    - **Property 12: Daily Overtime Calculation**
    - **Validates: Requirements 10.1, 10.2, 10.3**

  - [ ]* 3.3 Write property test for total overtime calculation
    - **Property 13: Total Overtime Calculation**
    - **Validates: Requirements 10.4, 10.5**

  - [x] 3.4 Add late login counting logic
    - Compare clockInTime to shift startTime
    - Count as late only if clockInTime > startTime
    - Count only for Present days
    - Handle null clockInTime (skip late count)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 3.5 Write property test for late login determination
    - **Property 14: Late Login Determination**
    - **Validates: Requirements 11.1, 11.2, 11.3**

  - [ ]* 3.6 Write property test for late count calculation
    - **Property 15: Late Count Calculation**
    - **Validates: Requirements 11.4, 11.5**

- [ ] 4. Checkpoint - Ensure calculation functions work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Non-Working Days invariant and validation
  - [x] 5.1 Add Non-Working Days calculation
    - Calculate as leaveDays + absentDays
    - Add to both employee and summary metrics
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 5.2 Write property test for Non-Working Days invariant
    - **Property 1: Non-Working Days Invariant**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 12.12, 15.3**

  - [x] 5.3 Implement data validation function
    - Create `validateMetrics()` function
    - Check: nonWorkingDays === leaveDays + absentDays
    - Check: avgWorkingHours > 0 implies presentDays > 0
    - Check: presentDays + leaveDays + absentDays equals total considered days
    - Log errors with employee details if validation fails
    - _Requirements: 6.4, 6.5, 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ]* 5.4 Write property test for total days validation
    - **Property 18: Total Days Validation**
    - **Validates: Requirements 15.1**

  - [ ]* 5.5 Write property test for average hours validation
    - **Property 19: Average Hours Validation**
    - **Validates: Requirements 15.2**

- [ ] 6. Implement summary metrics aggregation
  - [x] 6.1 Create `calculateSummaryMetrics()` function
    - Aggregate employee metrics into organization-wide totals
    - Sum all presentDays, leaveDays, absentDays across employees
    - Sum totalNetHours and overtimeHours
    - Sum lateCount
    - Calculate organization-wide averageWorkingHours
    - Calculate organization-wide attendancePercentage
    - Count totalEmployees
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 6.2 Write property test for aggregation consistency
    - **Property 5: Aggregation Consistency**
    - **Validates: Requirements 3.5, 4.5, 5.5**

  - [ ]* 6.3 Write unit tests for summary metrics
    - Test with multiple employees
    - Test with single employee
    - Test with no employees
    - _Requirements: 2.1-2.10_

- [ ] 7. Implement filter logic
  - [x] 7.1 Create user filter builder function
    - Build MongoDB query for department filter
    - Build MongoDB query for location filter
    - Build MongoDB query for shift type filter
    - Build MongoDB query for employment status filter
    - Combine filters with AND logic
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 7.2 Write property test for employee attribute filters
    - **Property 17: Employee Attribute Filters**
    - **Validates: Requirements 13.2, 13.3, 13.4, 13.5, 13.6**

  - [x] 7.3 Add date range filtering to aggregation pipeline
    - Filter attendanceDate >= startDate
    - Filter attendanceDate <= endDate
    - Use IST timezone for date boundaries
    - _Requirements: 13.1, 14.1, 14.2, 14.3_

  - [ ]* 7.4 Write property test for date range filter
    - **Property 16: Date Range Filter**
    - **Validates: Requirements 13.1**

- [ ] 8. Implement join/exit date handling
  - [x] 8.1 Add join date boundary logic
    - Filter out attendance records before employee joiningDate
    - Ensure days before join are not counted as Absent
    - _Requirements: 17.1, 17.3_

  - [ ]* 8.2 Write property test for join date boundary
    - **Property 21: Join Date Boundary**
    - **Validates: Requirements 17.1, 17.3**

  - [x] 8.3 Add exit date boundary logic
    - Filter out attendance records after employee exit date (if inactive)
    - Ensure days after exit are not counted as Absent
    - _Requirements: 17.2, 17.4_

  - [ ]* 8.4 Write property test for exit date boundary
    - **Property 22: Exit Date Boundary**
    - **Validates: Requirements 17.2, 17.4**

- [ ] 9. Implement main analytics service function
  - [x] 9.1 Create `calculateAttendanceMetrics()` function
    - Accept filters object as parameter
    - Validate date format (YYYY-MM-DD)
    - Build user filter criteria
    - Get filtered employee IDs
    - Execute aggregation pipeline
    - Calculate summary metrics
    - Validate metrics integrity
    - Apply pagination to employee results
    - Format and return result
    - _Requirements: 1.1, 1.5, 13.1-13.7, 19.1, 19.2, 19.3_

  - [ ]* 9.2 Write unit tests for calculateAttendanceMetrics
    - Test with various filter combinations
    - Test with empty result set
    - Test pagination
    - Test error cases
    - _Requirements: 13.1-13.7_

- [ ] 10. Checkpoint - Ensure analytics service is complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Create analytics controller
  - [x] 11.1 Create `backend/controllers/analyticsController.js`
    - Implement `getAttendanceAnalytics()` function
    - Extract and validate query parameters (startDate, endDate, filters)
    - Validate date format using regex
    - Validate date range (startDate <= endDate)
    - Check for required parameters
    - Validate filter enum values
    - Validate pagination parameters (page >= 1, limit 1-1000)
    - _Requirements: 16.1, 16.2_

  - [x] 11.2 Add error handling to controller
    - Handle invalid date format (HTTP 400)
    - Handle invalid date range (HTTP 400)
    - Handle missing required parameters (HTTP 400)
    - Handle invalid filter values (HTTP 400)
    - Handle invalid pagination (HTTP 400)
    - Handle database errors (HTTP 500)
    - Handle timeout errors (HTTP 504)
    - Log all errors appropriately
    - _Requirements: Error Handling section_

  - [x] 11.3 Call analytics service and format response
    - Call `AnalyticsService.calculateAttendanceMetrics()`
    - Format response with summary, employeeAnalytics, pagination
    - Ensure numeric precision (2 decimal places)
    - Return HTTP 200 with JSON response
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 20.5_

  - [ ]* 11.4 Write property test for numeric precision
    - **Property 20: Numeric Precision**
    - **Validates: Requirements 16.5**

  - [ ]* 11.5 Write unit tests for analytics controller
    - Test successful request
    - Test validation errors
    - Test error responses
    - Test response format
    - _Requirements: 16.1-16.5_

- [ ] 12. Create analytics API route
  - [x] 12.1 Create `backend/routes/analytics.js`
    - Define GET `/api/analytics/attendance` route
    - Add authentication middleware
    - Add authorization check (Admin/HR only)
    - Wire to analyticsController.getAttendanceAnalytics
    - Export router
    - _Requirements: 16.1_

  - [x] 12.2 Register analytics routes in main server
    - Import analytics router in `backend/server.js`
    - Mount at `/api/analytics` path
    - _Requirements: 16.1_

  - [ ]* 12.3 Write integration tests for analytics API
    - Test end-to-end API flow
    - Test with authentication
    - Test with various filters
    - Test pagination
    - Test error responses
    - _Requirements: 16.1-16.5_

- [ ] 13. Checkpoint - Ensure backend is complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Create frontend analytics service
  - [x] 14.1 Create `frontend/src/services/analyticsService.js`
    - Implement `fetchAttendanceAnalytics()` function
    - Accept filters object as parameter
    - Build query string from filters
    - Make GET request to `/api/analytics/attendance`
    - Handle authentication token
    - Handle response parsing
    - Handle error cases
    - Return formatted data
    - _Requirements: 13.1-13.7_

  - [ ]* 14.2 Write unit tests for analytics service
    - Test query string building
    - Test successful fetch
    - Test error handling
    - Mock API responses
    - _Requirements: 13.1-13.7_

- [ ] 15. Create KPI Summary Cards component
  - [x] 15.1 Create `frontend/src/components/Analytics/KPISummaryCards.jsx`
    - Accept summary prop
    - Render 10 KPI cards in grid layout
    - Display Total Employees
    - Display Present Days
    - Display Leave Days
    - Display Absent Days
    - Display Total Non-Working Days
    - Display Attendance %
    - Display Total Net Working Hours
    - Display Average Working Hours
    - Display Overtime Hours
    - Display Late Login Count
    - Format numbers with 2 decimal places
    - Add appropriate icons and colors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 15.2 Write unit tests for KPI cards
    - Test rendering with mock data
    - Test number formatting
    - Test all 10 cards display
    - _Requirements: 2.1-2.10_

- [ ] 16. Create Employee Analytics Table component
  - [x] 16.1 Create `frontend/src/components/Analytics/EmployeeAnalyticsTable.jsx`
    - Accept employees and pagination props
    - Render table with 11 columns
    - Display Employee Name
    - Display Department
    - Display Present Days
    - Display Leave Days
    - Display Absent Days
    - Display Total Non-Working Days
    - Display Total Net Hours
    - Display Avg Working Hours
    - Display Overtime Hours
    - Display Late Count
    - Display Attendance %
    - Format numbers with 2 decimal places
    - Add sorting capability
    - Add pagination controls
    - Handle empty state
    - _Requirements: 12.1-12.12, 19.4_

  - [ ]* 16.2 Write unit tests for employee table
    - Test rendering with mock data
    - Test sorting
    - Test pagination
    - Test empty state
    - _Requirements: 12.1-12.12_

- [ ] 17. Create Filter Controls component
  - [x] 17.1 Create `frontend/src/components/Analytics/FilterControls.jsx`
    - Accept filters and onFilterChange props
    - Render date range picker (IST-based)
    - Render department dropdown
    - Render location dropdown
    - Render shift type dropdown
    - Render employment status dropdown
    - Handle filter changes
    - Add "Apply Filters" button
    - Add "Clear Filters" button
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ]* 17.2 Write unit tests for filter controls
    - Test filter input changes
    - Test apply filters
    - Test clear filters
    - _Requirements: 13.1-13.7_

- [ ] 18. Create main Analytics Dashboard component
  - [x] 18.1 Create `frontend/src/components/Analytics/AttendanceDashboard.jsx`
    - Set up state for filters, data, loading, error
    - Implement useEffect to fetch data on mount and filter change
    - Call analyticsService.fetchAttendanceAnalytics()
    - Handle loading state
    - Handle error state
    - Render FilterControls component
    - Render KPISummaryCards component
    - Render EmployeeAnalyticsTable component
    - Handle pagination changes
    - Add refresh button
    - _Requirements: 2.1-2.10, 12.1-12.12, 13.1-13.7_

  - [ ]* 18.2 Write integration tests for dashboard
    - Test data fetching
    - Test filter application
    - Test pagination
    - Test error handling
    - Test loading state
    - _Requirements: 2.1-2.10, 12.1-12.12, 13.1-13.7_

- [ ] 19. Create analytics page route
  - [x] 19.1 Create `frontend/src/pages/AnalyticsPage.jsx`
    - Import AttendanceDashboard component
    - Add page layout and header
    - Add breadcrumbs
    - Render AttendanceDashboard
    - _Requirements: 2.1-2.10_

  - [x] 19.2 Register analytics route in app router
    - Add route for `/analytics/attendance`
    - Restrict to Admin/HR roles
    - Add to navigation menu
    - _Requirements: 2.1-2.10_

- [ ] 20. Add edge case handling
  - [x] 20.1 Handle half-day records
    - Ensure half-day present counts as 0.5 in presentDays
    - Ensure half-day leave counts as 0.5 in leaveDays
    - Update aggregation pipeline to handle isHalfDay flag
    - _Requirements: 3.4, 18.1, 18.2, 18.3, 18.5_

  - [x] 20.2 Handle null/missing data
    - Treat null totalWorkingHours as 0 for Present days
    - Skip late count if clockInTime is null
    - Skip overtime if shiftDurationMinutes is null
    - Display "N/A" for missing employee metadata
    - Exclude records with null critical fields
    - _Requirements: 7.5, 20.1, 20.2, 20.3, 20.4, 20.5_

  - [ ]* 20.3 Write unit tests for edge cases
    - Test half-day handling
    - Test null value handling
    - Test missing metadata
    - _Requirements: 3.4, 7.5, 18.1-18.5, 20.1-20.5_

- [ ] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Add performance optimizations
  - [x] 22.1 Add database indexes
    - Ensure index on AttendanceLog: (user, attendanceDate, attendanceStatus)
    - Ensure index on User: (department, isActive)
    - Verify indexes exist in production
    - _Requirements: 19.2_

  - [x] 22.2 Add query optimization
    - Use lean() for read-only queries
    - Project only required fields
    - Add query timeout (30 seconds)
    - _Requirements: 19.1, 19.2, 19.3_

  - [x] 22.3 Add frontend optimizations
    - Implement debouncing for filter changes
    - Add loading skeletons
    - Cache API responses (5 minutes)
    - _Requirements: 13.7_

- [ ] 23. Add documentation
  - [ ] 23.1 Document API endpoint
    - Add JSDoc comments to controller
    - Document query parameters
    - Document response format
    - Add example requests/responses
    - _Requirements: 16.1-16.5_

  - [ ] 23.2 Document analytics service
    - Add JSDoc comments to all functions
    - Document calculation formulas
    - Add usage examples
    - _Requirements: 1.1-20.5_

  - [ ] 23.3 Add user guide
    - Document how to use filters
    - Explain each KPI metric
    - Add screenshots
    - _Requirements: 2.1-2.10, 13.1-13.7_

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- The implementation builds incrementally: service → controller → API → frontend
- All calculations use pre-computed data from AttendanceLog (no raw punch log access)
- IST timezone is used consistently throughout
- Pagination is required for employee table (default 50 records per page)
