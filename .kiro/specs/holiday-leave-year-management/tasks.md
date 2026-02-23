# Implementation Plan: Holiday & Leave Year Management System

## Overview

This implementation plan transforms the existing basic holiday modal into an enterprise-grade system with proper yearly segregation, historical archiving, and clean hierarchical UI. The system enforces a single active year constraint, provides automatic synchronization of attendance calculations, and delivers an Apple-style UI with slide-over panels.

The implementation follows a logical progression: database schema → backend models → backend APIs → event system → caching → frontend context → frontend components → integration → testing.

## Tasks

- [x] 1. Database schema and migrations
  - [x] 1.1 Create LeaveYear model with schema and indexes
    - Define LeaveYear schema with year, isActive, startDate, endDate, isLocked, version fields
    - Add unique constraint on year field
    - Add partial unique index on isActive=true to enforce single active year
    - Add pre-save hook to validate single active year constraint
    - Add date range validation (startDate < endDate)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 18.1_

  - [x] 1.2 Update Holiday model to include leaveYearId reference
    - Add leaveYearId field as ObjectId reference to LeaveYear
    - Add compound index on (leaveYearId, date) for efficient queries
    - Add partial unique index on (date, leaveYearId) for non-tentative holidays
    - Update existing Holiday schema to support year association
    - _Requirements: 3.4, 7.1_

  - [x] 1.3 Create database migration script for default leave year
    - Create migration to generate default leave year for current calendar year
    - Set default year as active (isActive=true)
    - Handle migration rollback scenario
    - _Requirements: 17.1, 17.3_

  - [x] 1.4 Create database migration script to associate existing holidays
    - Migrate all existing holidays to reference the default leave year
    - Update Holiday collection to add leaveYearId to all documents
    - Create indexes after migration
    - Verify all holidays have valid leaveYearId after migration
    - _Requirements: 17.2, 17.4_


- [x] 2. Backend models and business logic
  - [x] 2.1 Implement LeaveYear model with validation logic
    - Create backend/models/LeaveYear.js with complete schema
    - Implement pre-save hook for single active year enforcement
    - Add instance methods for locking/unlocking
    - Add static methods for finding active year
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

  - [ ]* 2.2 Write property test for single active year enforcement
    - **Property 1: Single Active Year Enforcement**
    - **Validates: Requirements 2.1, 2.2, 18.1, 18.2**
    - Test that activating one year deactivates all others
    - Use fast-check to generate multiple year scenarios

  - [x] 2.3 Update Holiday model with leaveYearId field
    - Update backend/models/Holiday.js to include leaveYearId
    - Add validation for required leaveYearId
    - Update indexes for efficient year-based queries
    - _Requirements: 3.4_

  - [ ]* 2.4 Write property test for active year filtering
    - **Property 2: Active Year Filtering**
    - **Validates: Requirements 4.1, 4.2, 5.1**
    - Test that queries return only active year data
    - Use fast-check to generate multi-year holiday datasets

  - [ ]* 2.5 Write property test for date range validation
    - **Property 3: Date Range Validation**
    - **Validates: Requirements 1.3**
    - Test that startDate is always before endDate
    - Use fast-check to generate various date combinations

  - [ ]* 2.6 Write property test for default values on creation
    - **Property 4: Default Values on Creation**
    - **Validates: Requirements 1.2, 1.4**
    - Test that new leave years have correct defaults
    - Verify unique ID assignment and timestamp creation

- [x] 3. Backend API endpoints for leave year management
  - [x] 3.1 Create LeaveYear controller with CRUD operations
    - Implement GET /api/admin/leave-years (list all years)
    - Implement POST /api/admin/leave-years (create new year)
    - Implement GET /api/admin/leave-years/:id (get specific year)
    - Implement PUT /api/admin/leave-years/:id (update year)
    - Implement DELETE /api/admin/leave-years/:id (delete if not active)
    - Implement GET /api/admin/leave-years/active (get active year)
    - Add authorization middleware (admin/HR only)
    - _Requirements: 1.1, 1.2, 2.4_

  - [x] 3.2 Implement year activation endpoint with transaction support
    - Create POST /api/admin/leave-years/:id/activate endpoint
    - Use MongoDB transactions to deactivate current and activate new year atomically
    - Add confirmation parameter validation
    - Return previous and new active year in response
    - _Requirements: 2.2, 14.1, 14.2, 14.3_

  - [ ]* 3.3 Write property test for active year deletion prevention
    - **Property 5: Active Year Deletion Prevention**
    - **Validates: Requirements 2.4**
    - Test that active years cannot be deleted
    - Verify error is thrown for deletion attempts

  - [x] 3.4 Implement year locking/unlocking endpoint
    - Create POST /api/admin/leave-years/:id/lock endpoint
    - Toggle isLocked flag for archived years
    - Prevent locking of active year
    - _Requirements: 6.2, 6.3_

  - [ ]* 3.5 Write property test for lock/unlock round trip
    - **Property 10: Lock/Unlock Round Trip**
    - **Validates: Requirements 6.3**
    - Test that locking then unlocking restores modification ability
    - Verify locked years prevent modifications

  - [x] 3.6 Implement holiday cloning endpoint
    - Create POST /api/admin/leave-years/:id/clone endpoint
    - Accept source year ID and target year ID
    - Copy all holidays with dates adjusted to target year
    - Preserve type and applicability scope
    - Complete within 2 seconds for up to 50 holidays
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 3.7 Write property test for holiday cloning
    - **Property 6: Holiday Cloning Preserves Attributes**
    - **Validates: Requirements 11.2, 11.3**
    - Test that type and scope are preserved during cloning
    - Verify dates are adjusted to target year
    - Use fast-check to generate various holiday configurations

- [x] 4. Backend API endpoints for holiday management
  - [x] 4.1 Update Holiday controller to support year filtering
    - Update GET /api/admin/holidays to accept yearId query parameter
    - Update POST /api/admin/holidays to require leaveYearId
    - Update PUT /api/admin/holidays/:id to validate year association
    - Update DELETE /api/admin/holidays/:id with year context
    - Add validation for locked year modifications
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.2, 9.2_

  - [ ]* 4.2 Write property test for holiday year association
    - **Property 7: Holiday Year Association**
    - **Validates: Requirements 3.4**
    - Test that all holidays have valid leaveYearId
    - Verify association is maintained through updates

  - [ ]* 4.3 Write property test for locked year modification prevention
    - **Property 9: Locked Year Modification Prevention**
    - **Validates: Requirements 6.2**
    - Test that locked years reject holiday modifications
    - Verify error messages are appropriate

  - [x] 4.2 Create employee holiday endpoint with active year filtering
    - Implement GET /api/leaves/holidays (employee-facing)
    - Automatically filter by active year only
    - No year parameter required for employees
    - Return holidays sorted by date
    - _Requirements: 4.1, 4.2_

  - [x] 4.3 Implement holiday move endpoint
    - Create PUT /api/admin/holidays/:id/move endpoint
    - Accept targetYearId parameter
    - Update leaveYearId while preserving all other attributes
    - Validate target year exists and is different from current
    - _Requirements: 9.3, 19.1, 19.2, 19.3, 19.4_

  - [ ]* 4.4 Write property test for holiday movement
    - **Property 22: Holiday Move Updates Association**
    - **Validates: Requirements 19.3, 19.4**
    - Test that leaveYearId is updated correctly
    - Verify all other attributes remain unchanged

  - [ ]* 4.5 Write property test for year selection filtering
    - **Property 21: Year Selection Filtering**
    - **Validates: Requirements 19.2**
    - Test that target year list excludes current year
    - Verify only valid years are shown

- [ ] 5. Checkpoint - Ensure backend models and APIs are working
  - Ensure all tests pass, ask the user if questions arise.


- [x] 6. Event system for active year synchronization
  - [x] 6.1 Create YearEventEmitter service
    - Create backend/services/yearEventEmitter.js using Node.js EventEmitter
    - Implement emitActiveYearChanged method
    - Add event payload with previousYear, newYear, timestamp
    - _Requirements: 20.1_

  - [x] 6.2 Integrate event emission in year activation endpoint
    - Update activation endpoint to emit activeYearChanged event
    - Pass previous and new year information in event
    - Ensure event is emitted after successful database transaction
    - _Requirements: 20.1, 5.2_

  - [x] 6.3 Create attendance synchronization event listener
    - Create backend/services/attendanceSync.js
    - Subscribe to activeYearChanged events
    - Invalidate active year cache on event
    - Log synchronization actions
    - _Requirements: 20.2, 20.3, 5.2_

  - [ ]* 6.4 Write property test for event emission
    - **Property 8: Active Year Change Triggers Synchronization**
    - **Validates: Requirements 4.4, 5.2, 20.1**
    - Test that year activation emits events
    - Verify dependent systems receive notifications

  - [ ]* 6.5 Write integration test for event system
    - Test end-to-end event flow from activation to listener
    - Verify cache invalidation occurs
    - Test multiple listeners receive events
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [x] 7. Cache service for active year data
  - [x] 7.1 Create ActiveYearCache service
    - Create backend/services/activeYearCache.js using node-cache
    - Implement getActiveYear method with 1-hour TTL
    - Implement invalidate method for cache clearing
    - Add cache hit/miss logging
    - _Requirements: 5.1, 5.3_

  - [x] 7.2 Update attendance calculator to use cache
    - Update backend/services/attendanceCalculator.js
    - Replace direct database queries with cache service
    - Handle case when no active year exists
    - Add error handling for missing active year
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 7.3 Update holiday queries to use active year cache
    - Update all holiday query endpoints to use cache
    - Ensure employee endpoints use cached active year
    - Add cache warming on server startup
    - _Requirements: 4.1, 4.2, 5.1_

- [ ] 8. Bulk operations - Excel import/export
  - [ ] 8.1 Implement bulk holiday upload endpoint
    - Create POST /api/admin/holidays/bulk-upload endpoint
    - Accept Excel files with columns: Holiday Name, Date, Type, Applies To
    - Validate all rows before importing (fail-fast approach)
    - Return specific error messages with row numbers on validation failure
    - Associate all imported holidays with specified leave year
    - Add rate limiting (5 requests per 15 minutes)
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 8.2 Write property test for bulk import validation
    - **Property 14: Bulk Import Validation**
    - **Validates: Requirements 12.2, 12.3**
    - Test that invalid rows prevent entire import
    - Verify error messages include row numbers
    - Use fast-check to generate various invalid Excel data

  - [ ]* 8.3 Write property test for bulk import success
    - **Property 15: Bulk Import Success**
    - **Validates: Requirements 12.4**
    - Test that valid Excel data creates all holidays
    - Verify all holidays are associated with correct year
    - Use fast-check to generate valid holiday datasets

  - [ ] 8.4 Implement holiday export endpoint
    - Create GET /api/admin/holidays/export/:yearId endpoint
    - Generate Excel file with columns: Holiday Name, Date, Type, Applies To
    - Use filename format: "Holidays_[Year]_[Timestamp].xlsx"
    - Complete export within 3 seconds for up to 100 holidays
    - Set appropriate content-type and headers for download
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ]* 8.5 Write property test for export round trip
    - **Property 16: Export Round Trip**
    - **Validates: Requirements 13.1, 13.2**
    - Test that exporting then importing produces equivalent holidays
    - Verify all attributes are preserved
    - Use fast-check to generate holiday datasets

  - [ ]* 8.6 Write property test for export filename format
    - **Property 17: Export Filename Format**
    - **Validates: Requirements 13.3**
    - Test that filename matches required format
    - Verify year and timestamp are included correctly

- [x] 9. Error handling and validation
  - [x] 9.1 Create centralized error handler middleware
    - Create backend/middleware/errorHandler.js
    - Handle Mongoose validation errors (400)
    - Handle duplicate key errors (409)
    - Handle business rule violations (422)
    - Handle authorization errors (403)
    - Handle not found errors (404)
    - Add structured logging for all errors
    - _Requirements: All error scenarios_

  - [x] 9.2 Implement BusinessRuleError custom error class
    - Create backend/errors/BusinessRuleError.js
    - Include rule identifier for tracking
    - Support error message customization
    - _Requirements: 2.4, 6.2, 15.2_

  - [ ]* 9.3 Write property test for holiday validation
    - **Property 13: Holiday Validation**
    - **Validates: Requirements 10.3**
    - Test that missing required fields are rejected
    - Verify specific error messages are returned
    - Use fast-check to generate invalid holiday data

  - [x] 9.4 Add validation for archive prevention without replacement
    - Implement check in archive endpoint
    - Reject archiving if only one year exists
    - Return appropriate error message
    - _Requirements: 15.2_

  - [ ]* 9.5 Write property test for archive prevention
    - **Property 18: Archive Prevention Without Replacement**
    - **Validates: Requirements 15.2**
    - Test that single year cannot be archived
    - Verify error is returned

- [ ] 10. Checkpoint - Ensure backend is complete and tested
  - Ensure all tests pass, ask the user if questions arise.


- [-] 11. Frontend context provider for active year
  - [x] 11.1 Create ActiveYearContext with provider and hook
    - Create frontend/src/context/ActiveYearContext.jsx
    - Implement useActiveYear hook
    - Fetch active year on mount
    - Provide loading, error, and activeYear state
    - Implement refreshActiveYear method for manual refresh
    - _Requirements: 4.3, 4.4_

  - [ ]* 11.2 Write unit tests for ActiveYearContext
    - Test successful active year fetch
    - Test error handling when no active year exists
    - Test loading states
    - Test refresh functionality
    - Mock API calls with jest

  - [ ] 11.3 Integrate ActiveYearProvider into App component
    - Wrap application with ActiveYearProvider in frontend/src/App.jsx
    - Place provider inside AuthProvider but outside Router
    - Ensure context is available to all routes
    - _Requirements: 4.4_

- [x] 12. Frontend year selector component
  - [x] 12.1 Create YearSelector component
    - Create frontend/src/components/admin/YearSelector.jsx
    - Display years as horizontal segmented control using MUI Chips
    - Highlight active year with visual indicator (filled chip with dot icon)
    - Handle year selection with onClick
    - Include "Create New Year" button on right side
    - Apply Apple-style design: white background, 16px border radius, 150ms transitions
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 16.1, 16.2, 16.3, 16.4_

  - [ ]* 12.2 Write unit tests for YearSelector
    - Test that active year is highlighted
    - Test year selection callback
    - Test create new year button callback
    - Test visual styling and transitions

- [x] 13. Frontend year overview card component
  - [x] 13.1 Create YearOverviewCard component
    - Create frontend/src/components/admin/YearOverviewCard.jsx
    - Display total holiday count, national count, optional count
    - Show year status badge (Active/Archived)
    - Include lock/unlock toggle for admins
    - Use white background with brand red accent
    - Apply 16px border radius and 24px section spacing
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 16.1, 16.2, 16.3_

  - [ ]* 13.2 Write property test for holiday count aggregation
    - **Property 12: Holiday Count Aggregation**
    - **Validates: Requirements 8.1**
    - Test that total count equals sum of all holidays
    - Test that type-specific counts are accurate
    - Use fast-check to generate various holiday distributions

  - [ ]* 13.3 Write unit tests for YearOverviewCard
    - Test holiday count display
    - Test status badge rendering
    - Test lock/unlock toggle for admins
    - Test that non-admins don't see toggle

- [x] 14. Frontend holiday list component
  - [x] 14.1 Create HolidayList component
    - Create frontend/src/components/admin/HolidayList.jsx
    - Display holidays in MUI Table with columns: Name, Date, Type, Applies To, Actions
    - Provide Edit and Delete action buttons
    - Provide "Move to another year" action
    - Sort holidays by date in ascending order by default
    - Include "Add Holiday" button above table
    - Apply 14px regular font for table text
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 16.2_

  - [ ]* 14.2 Write property test for holiday sorting
    - **Property 11: Holiday Sorting**
    - **Validates: Requirements 9.4**
    - Test that non-tentative holidays are sorted by date ascending
    - Test that tentative holidays appear at end sorted alphabetically
    - Use fast-check to generate unsorted holiday lists

  - [ ]* 14.3 Write unit tests for HolidayList
    - Test table rendering with holiday data
    - Test action button callbacks
    - Test sorting behavior
    - Test empty state display

- [x] 15. Frontend holiday form panel (slide-over)
  - [x] 15.1 Create HolidayFormPanel component
    - Create frontend/src/components/admin/HolidayFormPanel.jsx
    - Implement as MUI Drawer sliding from right (480px width)
    - Include fields: Holiday Name, Date, Day, Type, Applies To
    - Support both create and edit modes
    - Validate required fields before submission
    - Close panel and refresh list on success
    - Apply #fafafa background color
    - Use 16px medium font for section titles
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 16.1, 16.2, 16.4_

  - [ ]* 15.2 Write unit tests for HolidayFormPanel
    - Test form field rendering
    - Test validation on submit
    - Test create mode
    - Test edit mode with pre-filled data
    - Test panel open/close behavior

- [x] 16. Frontend holiday management page
  - [x] 16.1 Create HolidayManagementPage component
    - Create frontend/src/pages/admin/HolidayManagementPage.jsx
    - Integrate YearSelector, YearOverviewCard, HolidayList components
    - Fetch years on mount and set active year as default selection
    - Fetch holidays when selected year changes
    - Handle year creation dialog
    - Handle holiday form panel state
    - Constrain content to 1280px max width with 24px spacing
    - Use 22px semibold font for page title
    - _Requirements: 7.1, 8.1, 9.1, 16.1, 16.2, 16.3_

  - [ ]* 16.2 Write integration tests for HolidayManagementPage
    - Test year selection updates holiday list
    - Test holiday creation flow
    - Test holiday editing flow
    - Test holiday deletion flow
    - Mock API calls

- [-] 17. Frontend dialogs and confirmations
  - [x] 17.1 Create YearActivationDialog component
    - Create frontend/src/components/admin/YearActivationDialog.jsx
    - Show current active year and year being activated
    - Require explicit confirmation
    - Display warning about system-wide impact
    - Call activation API on confirm
    - Refresh active year context after activation
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [ ]* 17.2 Write property test for archiving flags
    - **Property 19: Archiving Sets Flags**
    - **Validates: Requirements 15.3**
    - Test that archiving sets isActive=false and isLocked=true
    - Verify flags are set atomically

  - [ ] 17.3 Create YearArchiveDialog component
    - Create frontend/src/components/admin/YearArchiveDialog.jsx
    - Display warning about archiving active year
    - Prevent archiving if no other year exists
    - Show confirmation with impact details
    - Call archive API on confirm
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ] 17.4 Create HolidayMoveDialog component
    - Create frontend/src/components/admin/HolidayMoveDialog.jsx
    - Display list of target years (excluding current year)
    - Show holiday details being moved
    - Call move API on confirm
    - Refresh holiday list after move
    - _Requirements: 19.1, 19.2, 19.3_

  - [ ] 17.5 Create YearCreationDialog component
    - Create frontend/src/components/admin/YearCreationDialog.jsx
    - Include fields: Year, Start Date, End Date
    - Offer option to clone holidays from existing year
    - Validate year is unique and in valid range (2000-2100)
    - Call create API on submit
    - Refresh year list after creation
    - _Requirements: 1.1, 1.2, 11.1_

- [ ] 18. Update existing employee-facing components
  - [ ] 18.1 Update Employee Leaves Section to use ActiveYearContext
    - Update frontend/src/components/employee/EmployeeLeavesSection.jsx
    - Import and use useActiveYear hook
    - Filter displayed holidays by active year
    - Show active year badge in section header
    - Handle loading and error states
    - Auto-refresh when active year changes
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 18.2 Write unit tests for updated Employee Leaves Section
    - Test active year badge display
    - Test holiday filtering by active year
    - Test auto-refresh on year change
    - Test loading and error states

  - [ ] 18.3 Update Attendance Summary to use active year holidays
    - Update attendance calculation logic to fetch holidays from active year
    - Handle case when no active year exists (show error)
    - Ensure recalculation completes within 3 seconds
    - No manual refresh required after year changes
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 18.4 Write unit tests for updated Attendance Summary
    - Test that only active year holidays are used
    - Test error handling when no active year exists
    - Test performance (3 second limit)
    - Test automatic recalculation

- [ ] 19. Checkpoint - Ensure frontend components are working
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 20. Frontend bulk operations UI
  - [ ] 20.1 Create BulkUploadDialog component
    - Create frontend/src/components/admin/BulkUploadDialog.jsx
    - Accept Excel file upload with drag-and-drop support
    - Show file validation feedback
    - Display upload progress
    - Show detailed error messages with row numbers on failure
    - Refresh holiday list on success
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 20.2 Write unit tests for BulkUploadDialog
    - Test file selection and validation
    - Test error display with row numbers
    - Test success flow
    - Mock file upload API

  - [ ] 20.3 Add export button to HolidayList component
    - Add "Export to Excel" button to HolidayList toolbar
    - Trigger download on click
    - Show loading indicator during export
    - Handle export errors gracefully
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ] 20.4 Implement frontend Excel export utility
    - Create frontend/src/utils/excelExport.js
    - Use xlsx library to generate Excel files
    - Format columns: Holiday Name, Date, Type, Applies To
    - Trigger browser download with correct filename
    - _Requirements: 13.1, 13.2, 13.3_

- [-] 21. Audit logging and security
  - [x] 21.1 Create SystemAuditLog model
    - Create backend/models/SystemAuditLog.js
    - Include fields: action, userId, userName, timestamp, details, ipAddress
    - Add indexes on timestamp and userId
    - _Requirements: 15.4, 18.3_

  - [x] 21.2 Implement audit logging for year activation
    - Log all year activation attempts with user details
    - Include previous and new active year in log
    - Record timestamp and IP address
    - _Requirements: 15.4, 18.3_

  - [ ]* 21.3 Write property test for audit logging
    - **Property 20: Audit Logging**
    - **Validates: Requirements 15.4, 18.3**
    - Test that all activation/archiving operations create logs
    - Verify log entries include required fields
    - Use fast-check to generate various operation scenarios

  - [ ] 21.4 Implement audit logging for year archiving
    - Log all archiving operations with admin identifier
    - Include year details and lock status
    - Record timestamp and IP address
    - _Requirements: 15.4_

  - [ ] 21.5 Add authorization middleware for admin-only endpoints
    - Create backend/middleware/isAdminOrHr.js
    - Check user role before allowing access
    - Return 403 Forbidden for unauthorized users
    - Apply to all leave year and holiday management endpoints
    - _Requirements: Security considerations_

  - [ ] 21.6 Add rate limiting for bulk upload endpoint
    - Implement rate limiter: 5 requests per 15 minutes
    - Return 429 Too Many Requests when limit exceeded
    - Add appropriate error message
    - _Requirements: 12.1, Security considerations_

  - [ ] 21.7 Add input validation and sanitization
    - Validate year range (2000-2100)
    - Validate date formats
    - Sanitize holiday names (max 100 characters)
    - Validate Excel file size (max 5MB)
    - Validate Excel file type
    - _Requirements: Security considerations_

- [ ] 22. Performance optimization
  - [ ] 22.1 Add database indexes for common queries
    - Create index on LeaveYear.isActive
    - Create index on LeaveYear.year (unique)
    - Create compound index on Holiday (leaveYearId, date)
    - Create compound index on Holiday (leaveYearId, type)
    - Verify index usage with explain() queries
    - _Requirements: 5.3, Performance optimization_

  - [ ] 22.2 Implement query optimization with lean() and projection
    - Use lean() for read-only holiday queries
    - Use select() to limit returned fields
    - Optimize year list queries with projection
    - Measure query performance improvements
    - _Requirements: 5.3, Performance optimization_

  - [ ] 22.3 Add frontend performance optimizations
    - Lazy load HolidayManagementPage component
    - Memoize expensive computations with useMemo
    - Use React.memo for static components
    - Debounce search inputs (if applicable)
    - Virtualize long holiday lists (if needed)
    - _Requirements: Performance optimization_

  - [ ] 22.4 Implement cache warming on server startup
    - Fetch and cache active year on application start
    - Pre-load active year holidays into cache
    - Add health check endpoint to verify cache status
    - _Requirements: 5.3, Performance optimization_

- [-] 23. Migration scripts and deployment preparation
  - [x] 23.1 Create migration runner script
    - Create backend/migrations/migrate.js
    - Support running migrations in order
    - Support rollback functionality
    - Log migration progress and results
    - _Requirements: 17.1, 17.2_

  - [ ] 23.2 Test migrations on staging environment
    - Run migrations on staging database
    - Verify all existing holidays are migrated
    - Verify default year is created and active
    - Test rollback procedures
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [ ]* 23.3 Write property test for migration preservation
    - **Property 23: Migration Preserves All Holidays**
    - **Validates: Requirements 17.2**
    - Test that all holidays exist after migration
    - Verify attributes are preserved
    - Use fast-check to generate pre-migration holiday sets

  - [ ] 23.4 Create deployment checklist document
    - Document pre-deployment steps (backup, testing)
    - Document deployment steps (migrations, backend, frontend)
    - Document post-deployment verification steps
    - Document rollback procedures
    - _Requirements: Deployment checklist_

  - [ ] 23.5 Update API documentation
    - Document all new leave year endpoints
    - Document updated holiday endpoints
    - Include request/response examples
    - Document error codes and messages
    - Add authentication requirements
    - _Requirements: All API endpoints_

- [ ] 24. Integration testing and end-to-end flows
  - [ ]* 24.1 Write integration test for year activation flow
    - Test complete flow: create year → activate → verify deactivation of previous
    - Test event emission and cache invalidation
    - Test attendance recalculation trigger
    - Verify database state after activation
    - _Requirements: 2.2, 14.1, 14.2, 14.3, 14.4, 20.1, 20.2, 20.3_

  - [ ]* 24.2 Write integration test for holiday cloning flow
    - Test complete flow: create source year with holidays → create target year → clone
    - Verify all holidays are copied with adjusted dates
    - Verify attributes are preserved
    - Test performance (2 second limit for 50 holidays)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 24.3 Write integration test for bulk upload flow
    - Test complete flow: upload Excel → validate → import → verify
    - Test validation failure with error messages
    - Test successful import with year association
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 24.4 Write integration test for export-import round trip
    - Test complete flow: export holidays → import exported file → verify equivalence
    - Verify all attributes match after round trip
    - Test filename format
    - _Requirements: 13.1, 13.2, 13.3, 16_

  - [ ]* 24.5 Write integration test for employee view synchronization
    - Test that employee views update when active year changes
    - Verify only active year holidays are displayed
    - Test automatic refresh without manual intervention
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.2, 5.4_

- [ ] 25. Monitoring and observability
  - [ ] 25.1 Add structured logging for critical operations
    - Log year activation with duration and user details
    - Log holiday bulk operations with success/failure counts
    - Log cache hit/miss ratios
    - Log event emission and listener execution
    - Use structured format (JSON) for easy parsing
    - _Requirements: Monitoring and observability_

  - [ ] 25.2 Create health check endpoint for active year
    - Create GET /api/health/active-year endpoint
    - Return active year status and cache status
    - Return error if no active year exists
    - Include in application health checks
    - _Requirements: Monitoring and observability_

  - [ ] 25.3 Add performance metrics tracking
    - Track active year query response times
    - Track holiday filter query performance
    - Track bulk upload success/failure rates
    - Track cache hit/miss ratios
    - Set up alerts for performance degradation
    - _Requirements: 5.3, Monitoring and observability_

- [ ] 26. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 27. Documentation and handoff
  - [ ] 27.1 Create user guide for administrators
    - Document how to create and manage leave years
    - Document how to activate/archive years
    - Document how to manage holidays
    - Document bulk upload/export procedures
    - Include screenshots and examples
    - _Requirements: All user-facing features_

  - [ ] 27.2 Create developer documentation
    - Document architecture and design decisions
    - Document API endpoints and usage
    - Document event system and cache strategy
    - Document database schema and indexes
    - Include code examples and best practices
    - _Requirements: All technical components_

  - [ ] 27.3 Create runbook for operations team
    - Document deployment procedures
    - Document rollback procedures
    - Document troubleshooting common issues
    - Document monitoring and alerting setup
    - Include emergency contact information
    - _Requirements: Deployment and operations_

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests validate end-to-end workflows and system interactions
- All 23 correctness properties from the design document have corresponding test tasks
- Backend implementation uses Node.js, Express, MongoDB with Mongoose
- Frontend implementation uses React 18, Material-UI v5, Context API
- Event system uses Node.js EventEmitter for active year synchronization
- Caching uses node-cache with TTL-based invalidation
- Excel processing uses xlsx library on both frontend and backend
