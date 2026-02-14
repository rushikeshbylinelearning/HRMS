# Implementation Plan: Scheduling Management

## Overview

This implementation plan consolidates the Shifts and Office Locations pages into a unified Scheduling Management page. The approach focuses on component composition, reusing existing components (ShiftForm, OfficeLocationManager), and maintaining all existing functionality while introducing a new two-section vertical layout.

## Tasks

- [x] 1. Create the SchedulingManagementPage component with basic structure
  - Create new file `frontend/src/pages/SchedulingManagementPage.jsx`
  - Set up component skeleton with imports for Material-UI, React hooks, and existing components
  - Import ShiftForm and OfficeLocationManager components
  - Import PageHeroHeader component
  - Set up all state variables for shifts section (shifts, loading, error, modals, pagination, sorting)
  - Set up state variables for office locations section (error state)
  - Set up shared snackbar state
  - Create ref for OfficeLocationManager component
  - _Requirements: 1.1, 1.2, 1.5, 6.3, 6.5_

- [ ] 2. Implement Shifts Section functionality
  - [x] 2.1 Implement shifts data fetching and state management
    - Create `fetchShifts` function using useCallback with pagination parameters
    - Set up useEffect to call fetchShifts on mount and when pagination changes
    - Handle API response for both paginated and non-paginated formats
    - Implement error handling with shiftsError state
    - _Requirements: 2.1, 2.8, 8.1_
  
  - [x] 2.2 Implement shift CRUD operations
    - Create `handleOpenShiftForm` function for add/edit modal
    - Create `handleCloseShiftForm` function to reset modal state
    - Create `handleSaveShift` function for create/update API calls
    - Create `confirmDeleteShift` function with optimistic updates
    - Implement proper error handling and snackbar notifications
    - _Requirements: 2.2, 2.3, 2.4, 2.7, 8.1, 8.3, 8.5_
  
  - [x] 2.3 Implement table sorting and pagination
    - Create `handleShiftRequestSort` function for column sorting
    - Create `handleShiftPageChange` function for page navigation
    - Create `handleShiftRowsPerPageChange` function for rows per page
    - Implement `stableSort` and `getComparator` helper functions
    - Use useMemo for visibleRows calculation
    - _Requirements: 2.5, 2.6_
  
  - [ ]* 2.4 Write property test for table sorting
    - **Property 1: Table Sorting Consistency**
    - **Validates: Requirements 2.5**
  
  - [ ]* 2.5 Write property test for pagination
    - **Property 2: Pagination Data Integrity**
    - **Validates: Requirements 2.6**
  
  - [x] 2.6 Render Shifts Section UI
    - Create section container with header "Manage Shifts"
    - Add "Add Shift" button with AddIcon
    - Render sortable table with SortableTableHead component
    - Render ShiftRow components for each shift
    - Add TablePagination component
    - Include ShiftForm modal component
    - Include delete confirmation Dialog
    - Add loading state display
    - Add error Alert display
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.2, 7.6, 7.7_

- [ ] 3. Implement Office Locations Section functionality
  - [x] 3.1 Implement office locations section UI and integration
    - Create section container with header "Office Locations"
    - Add "Add Office Location" button with Add icon
    - Create `handleAddLocation` function to call locationManagerRef.current.openAddDialog()
    - Render OfficeLocationManager component with ref
    - Add error Alert display for locationsError
    - Wrap OfficeLocationManager in Box with padding
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 7.3, 7.6_

- [ ] 4. Implement page layout and styling
  - [x] 4.1 Create CSS file for SchedulingManagementPage
    - Create `frontend/src/styles/SchedulingManagementPage.css`
    - Define `.scheduling-management-page` with grid layout
    - Set grid-template-rows for header and two sections (40% / 60%)
    - Add gap of 24px between sections
    - Define `.shifts-section-container` with overflow-y: auto
    - Define `.office-locations-section-container` with overflow-y: auto
    - Add section header styles
    - Add responsive styles for mobile (viewport < 768px)
    - Import existing ShiftsPage.css and OfficeLocationsPage.css classes
    - _Requirements: 1.3, 4.1, 4.2, 4.3, 4.4, 4.5, 7.4_
  
  - [x] 4.2 Apply layout structure to component
    - Wrap entire page in `.scheduling-management-page` div
    - Add PageHeroHeader with title "Scheduling Management" and eyebrow "Administration"
    - Wrap Shifts Section in `.shifts-section-container` div
    - Wrap Office Locations Section in `.office-locations-section-container` div
    - Add section dividers or visual separators
    - _Requirements: 1.2, 1.3, 4.1, 4.2, 4.4, 4.5, 7.1, 7.4_

- [ ] 5. Update routing configuration
  - [x] 5.1 Add new route and redirects in App.jsx
    - Import SchedulingManagementPage component (lazy loaded)
    - Add route for `/scheduling-management` with Suspense and PermissionProtectedRoute (Admin only)
    - Add redirect route from `/shifts` to `/scheduling-management`
    - Add redirect route from `/office-locations` to `/scheduling-management`
    - Remove or comment out old `/shifts` and `/office-locations` routes
    - _Requirements: 1.1, 1.4, 5.3, 5.4, 5.5_
  
  - [ ]* 5.2 Write unit tests for routing
    - Test `/scheduling-management` route renders SchedulingManagementPage
    - Test `/shifts` redirects to `/scheduling-management`
    - Test `/office-locations` redirects to `/scheduling-management`
    - Test admin-only access control
    - _Requirements: 1.1, 1.4, 5.3, 5.4, 5.5_

- [ ] 6. Update sidebar navigation
  - [x] 6.1 Update Sidebar.jsx menu items
    - Remove "Shift Management" menu item (path: `/shifts`)
    - Remove "Office Locations" menu item (path: `/office-locations`)
    - Add new "Scheduling" menu item with path `/scheduling-management`
    - Use appropriate icon (TimelapseIcon or CalendarTodayIcon)
    - Set roles to `['Admin']` for admin-only access
    - _Requirements: 5.1, 5.2, 5.6_
  
  - [ ]* 6.2 Write unit tests for sidebar navigation
    - Test "Scheduling" menu item appears for Admin users
    - Test old menu items do not appear
    - Test clicking "Scheduling" navigates to `/scheduling-management`
    - Test menu item not visible for non-admin users
    - _Requirements: 5.1, 5.2, 5.6_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement shared snackbar and error handling
  - [x] 8.1 Add shared Snackbar component
    - Render Snackbar component at page level
    - Use snackbar state for open/close, message, and severity
    - Handle auto-hide after 4000ms
    - Include Alert component inside Snackbar
    - _Requirements: 2.7, 3.6, 8.5_
  
  - [ ]* 8.2 Write property test for section independence
    - **Property 3: Section Independence**
    - **Validates: Requirements 6.3, 6.5, 6.6**

- [ ] 9. Integration and final touches
  - [x] 9.1 Verify all existing functionality preserved
    - Test all shift CRUD operations work correctly
    - Test all office location CRUD operations work correctly
    - Test table sorting and pagination
    - Test modals and dialogs
    - Test error handling and notifications
    - Test geolocation features
    - Verify API endpoints unchanged
    - _Requirements: 2.1-2.8, 3.1-3.7, 8.1-8.5_
  
  - [ ]* 9.2 Write integration tests
    - Test complete user flow: navigate to page, create shift, edit shift, delete shift
    - Test complete user flow: create location, edit location, delete location
    - Test error scenarios in both sections
    - Test responsive layout behavior
    - _Requirements: 1.1-1.4, 2.1-2.8, 3.1-3.7, 4.1-4.5_
  
  - [ ] 9.3 Clean up old page files (optional)
    - Consider deprecating or removing `frontend/src/pages/ShiftsPage.jsx`
    - Consider deprecating or removing `frontend/src/pages/OfficeLocationsPage.jsx`
    - Keep CSS files if they're being imported by the new page
    - Update any documentation or comments referencing old pages
    - _Requirements: 5.4_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The SchedulingManagementPage reuses existing components (ShiftForm, OfficeLocationManager) without modifications
- All existing API endpoints and data structures remain unchanged
- Both sections maintain independent state and error handling
