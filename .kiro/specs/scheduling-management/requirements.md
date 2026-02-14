# Requirements Document

## Introduction

This document specifies the requirements for merging the "Office Locations" and "Manage Shifts" pages into a single unified page called "Scheduling Management". The unified page will consolidate shift management and office location management into a single interface with a two-section vertical layout, while preserving all existing functionality, CRUD operations, and admin-only access controls.

## Glossary

- **Scheduling_Management_Page**: The new unified page that combines shift management and office location management functionality
- **Shifts_Section**: The top section of the unified page containing all shift management functionality
- **Office_Locations_Section**: The bottom section of the unified page containing all office location management functionality
- **ShiftForm_Component**: The existing React component used for adding and editing shifts
- **OfficeLocationManager_Component**: The existing React component used for managing office locations
- **Admin_User**: A user with the "Admin" role who has permission to access scheduling management features
- **CRUD_Operations**: Create, Read, Update, and Delete operations for data entities
- **Sidebar_Navigation**: The application's left sidebar menu used for page navigation
- **Route_Configuration**: The React Router configuration in App.jsx that defines URL paths and their corresponding page components

## Requirements

### Requirement 1: Unified Page Creation

**User Story:** As an admin user, I want to access both shift management and office location management from a single page, so that I can efficiently manage all scheduling-related configurations in one place.

#### Acceptance Criteria

1. THE Scheduling_Management_Page SHALL be accessible via the route "/scheduling-management"
2. WHEN an Admin_User navigates to "/scheduling-management", THE Scheduling_Management_Page SHALL display both the Shifts_Section and Office_Locations_Section
3. THE Scheduling_Management_Page SHALL use a vertical two-section layout with the Shifts_Section occupying 40-45% of the viewport height and the Office_Locations_Section occupying 55-60% of the viewport height
4. THE Scheduling_Management_Page SHALL maintain admin-only access control consistent with the original pages
5. THE Scheduling_Management_Page SHALL be implemented as a new React component file

### Requirement 2: Shifts Section Functionality

**User Story:** As an admin user, I want all existing shift management features available in the unified page, so that I can continue managing shifts without any loss of functionality.

#### Acceptance Criteria

1. THE Shifts_Section SHALL display all shifts in a sortable table with columns for Name, Type, Start Time, End Time, Duration, Paid Break, and Actions
2. WHEN an Admin_User clicks the "Add Shift" button, THE Shifts_Section SHALL open the ShiftForm_Component modal for creating a new shift
3. WHEN an Admin_User clicks the edit icon for a shift, THE Shifts_Section SHALL open the ShiftForm_Component modal pre-populated with that shift's data
4. WHEN an Admin_User clicks the delete icon for a shift, THE Shifts_Section SHALL display a confirmation dialog and delete the shift upon confirmation
5. THE Shifts_Section SHALL support table sorting by clicking column headers
6. THE Shifts_Section SHALL support pagination with configurable rows per page
7. THE Shifts_Section SHALL display appropriate loading states, error messages, and success notifications
8. THE Shifts_Section SHALL preserve all existing API calls to /admin/shifts endpoints

### Requirement 3: Office Locations Section Functionality

**User Story:** As an admin user, I want all existing office location management features available in the unified page, so that I can continue managing office locations without any loss of functionality.

#### Acceptance Criteria

1. THE Office_Locations_Section SHALL display all office locations in a table with columns for Name, Address, Coordinates, Radius, Status, and Actions
2. WHEN an Admin_User clicks the "Add Office Location" button, THE Office_Locations_Section SHALL open a dialog for creating a new office location
3. WHEN an Admin_User clicks the edit icon for a location, THE Office_Locations_Section SHALL open a dialog pre-populated with that location's data
4. WHEN an Admin_User clicks the delete icon for a location, THE Office_Locations_Section SHALL display a confirmation dialog and delete the location upon confirmation
5. THE Office_Locations_Section SHALL support geolocation features including "Use Current Location" functionality
6. THE Office_Locations_Section SHALL display appropriate loading states, error messages, and success notifications
7. THE Office_Locations_Section SHALL preserve all existing API calls to /admin/office-locations endpoints
8. THE Office_Locations_Section SHALL utilize the existing OfficeLocationManager_Component

### Requirement 4: Layout and Responsive Design

**User Story:** As an admin user, I want the unified page to be usable on different screen sizes, so that I can manage scheduling configurations from various devices.

#### Acceptance Criteria

1. WHEN the viewport height is sufficient, THE Scheduling_Management_Page SHALL display both sections with the Shifts_Section at 40-45% height and Office_Locations_Section at 55-60% height
2. WHEN content in either section exceeds its allocated height, THAT section SHALL provide independent vertical scrolling
3. WHEN the viewport width is below 768px, THE Scheduling_Management_Page SHALL stack sections vertically with each section taking full width
4. THE Scheduling_Management_Page SHALL maintain proper spacing between sections with a minimum gap of 24px
5. THE Scheduling_Management_Page SHALL ensure both sections remain visible and accessible without requiring page-level scrolling on desktop viewports

### Requirement 5: Navigation and Routing Updates

**User Story:** As an admin user, I want the sidebar navigation to reflect the new unified page, so that I can easily find and access scheduling management features.

#### Acceptance Criteria

1. THE Sidebar_Navigation SHALL replace the separate "Shift Management" and "Office Locations" menu items with a single "Scheduling" menu item
2. WHEN an Admin_User clicks the "Scheduling" menu item, THE application SHALL navigate to "/scheduling-management"
3. THE Route_Configuration in App.jsx SHALL include a route for "/scheduling-management" that renders the Scheduling_Management_Page
4. THE Route_Configuration SHALL remove or deprecate the routes "/shifts" and "/office-locations"
5. WHEN a user attempts to navigate to "/shifts" or "/office-locations", THE application SHALL redirect to "/scheduling-management"
6. THE "Scheduling" menu item SHALL only be visible to Admin_Users

### Requirement 6: Component Reusability and State Management

**User Story:** As a developer, I want to reuse existing components and maintain existing state management patterns, so that the implementation is maintainable and consistent with the codebase.

#### Acceptance Criteria

1. THE Shifts_Section SHALL reuse the existing ShiftForm_Component without modifications
2. THE Office_Locations_Section SHALL reuse the existing OfficeLocationManager_Component without modifications
3. THE Scheduling_Management_Page SHALL manage state for shifts and office locations independently
4. THE Scheduling_Management_Page SHALL preserve all existing React hooks patterns (useState, useEffect, useCallback, useMemo) from the original pages
5. THE Scheduling_Management_Page SHALL maintain separate loading states, error states, and modal states for each section
6. WHEN an error occurs in one section, THE other section SHALL continue to function normally

### Requirement 7: Visual Design and User Experience

**User Story:** As an admin user, I want the unified page to have a clear visual hierarchy and consistent styling, so that I can easily distinguish between the two sections and understand their purpose.

#### Acceptance Criteria

1. THE Scheduling_Management_Page SHALL use a single PageHeroHeader component with the title "Scheduling Management"
2. THE Shifts_Section SHALL have a clear section header labeled "Manage Shifts"
3. THE Office_Locations_Section SHALL have a clear section header labeled "Office Locations"
4. THE Scheduling_Management_Page SHALL use consistent spacing, borders, or visual separators between sections
5. THE Scheduling_Management_Page SHALL maintain the existing Material-UI styling patterns and CSS class naming conventions
6. THE Scheduling_Management_Page SHALL display action buttons (Add Shift, Add Office Location) in contextually appropriate locations within each section
7. THE Scheduling_Management_Page SHALL preserve all existing table styling, chip colors, icon buttons, and tooltip behaviors

### Requirement 8: Data Integrity and API Consistency

**User Story:** As a developer, I want all API interactions to remain unchanged, so that the backend integration continues to work without modifications.

#### Acceptance Criteria

1. THE Shifts_Section SHALL use the same API endpoints as the original ShiftsPage: GET /admin/shifts, POST /admin/shifts, PUT /admin/shifts/:id, DELETE /admin/shifts/:id
2. THE Office_Locations_Section SHALL use the same API endpoints as the original OfficeLocationsPage: GET /admin/office-locations, POST /admin/office-locations, PUT /admin/office-locations/:id, DELETE /admin/office-locations/:id
3. THE Scheduling_Management_Page SHALL handle API responses and errors identically to the original pages
4. THE Scheduling_Management_Page SHALL maintain the same request/response data structures for all API calls
5. WHEN API calls fail, THE Scheduling_Management_Page SHALL display error messages consistent with the original pages
