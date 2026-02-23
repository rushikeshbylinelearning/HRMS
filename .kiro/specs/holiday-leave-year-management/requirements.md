# Requirements Document

## Introduction

The Advanced Holiday & Leave Year Management System transforms the existing basic holiday modal into an enterprise-grade system with proper yearly segregation, historical archiving, and clean hierarchical UI. The system ensures employees only interact with the current active leave year while providing administrators with comprehensive multi-year governance capabilities. All attendance calculations and leave displays automatically synchronize with the active leave year context.

## Glossary

- **Leave_Year**: A calendar year entity containing holidays, with exactly one marked as active for operational use
- **Active_Year**: The single leave year where isActive = true, used for all employee-facing operations
- **Archived_Year**: A past leave year that is read-only unless manually unlocked by administrators
- **Holiday**: A non-working day with specific type and applicability scope
- **Employee_Leaves_Section**: The UI component displaying leave records and balances for employees
- **Attendance_Summary**: The system component calculating attendance metrics using holiday data
- **Admin**: A user with permissions to manage leave years and holidays
- **Employee**: A user who views leaves and holidays from the active year only

## Requirements

### Requirement 1: Leave Year Entity Management

**User Story:** As an Admin, I want to create and manage leave years with unique identifiers and date ranges, so that holidays can be properly segregated by year.

#### Acceptance Criteria

1. THE Leave_Year_System SHALL store a year number, isActive boolean flag, start date, end date, and associated holidays
2. WHEN an Admin creates a new leave year, THE Leave_Year_System SHALL assign a unique identifier and set isActive to false by default
3. THE Leave_Year_System SHALL enforce that start date is before end date for all leave years
4. THE Leave_Year_System SHALL record creation timestamp for audit purposes

### Requirement 2: Single Active Year Enforcement

**User Story:** As an Admin, I want only one leave year to be active at any time, so that the system has a clear operational context.

#### Acceptance Criteria

1. THE Leave_Year_System SHALL enforce that exactly one leave year has isActive = true at any given time
2. WHEN an Admin activates a leave year, THE Leave_Year_System SHALL automatically deactivate all other leave years
3. IF no active year exists, THEN THE Attendance_Summary SHALL block attendance calculations and display an error message
4. THE Leave_Year_System SHALL prevent deletion of the active leave year

### Requirement 3: Holiday Data Structure

**User Story:** As an Admin, I want to define holidays with detailed attributes, so that different types of holidays can be managed appropriately.

#### Acceptance Criteria

1. THE Holiday_System SHALL store holiday name, date, type, and applicability scope
2. THE Holiday_System SHALL support holiday types: National, Regional, Company, and Optional
3. THE Holiday_System SHALL support applicability scopes: All, Department, and Branch
4. WHEN a holiday is created, THE Holiday_System SHALL associate it with a specific leave year

### Requirement 4: Employee Leave Year Context

**User Story:** As an Employee, I want to see only holidays and leaves from the current active year, so that I am not confused by historical data.

#### Acceptance Criteria

1. THE Employee_Leaves_Section SHALL display only holidays where the associated leave year has isActive = true
2. THE Employee_Leaves_Section SHALL display only leave records associated with the active leave year
3. THE Employee_Leaves_Section SHALL show a badge indicating the current leave year number
4. WHEN the active year changes, THE Employee_Leaves_Section SHALL automatically update to show the new active year data

### Requirement 5: Attendance Calculation Context

**User Story:** As a System Administrator, I want attendance calculations to use only the active year's holidays, so that metrics are accurate for the current operational period.

#### Acceptance Criteria

1. THE Attendance_Summary SHALL use only holidays from the leave year where isActive = true
2. WHEN an Admin activates a different leave year, THE Attendance_Summary SHALL recalculate metrics using the newly active year's holidays
3. THE Attendance_Summary SHALL complete recalculation within 3 seconds for datasets up to 1000 employees
4. THE Attendance_Summary SHALL not require manual refresh after active year changes

### Requirement 6: Year Archive System

**User Story:** As an Admin, I want past leave years to be archived and read-only, so that historical data is preserved but not accidentally modified.

#### Acceptance Criteria

1. WHEN a leave year has isActive = false, THE Leave_Year_System SHALL treat it as archived
2. THE Leave_Year_System SHALL prevent modifications to archived year holidays by default
3. WHEN an Admin manually unlocks an archived year, THE Leave_Year_System SHALL allow modifications until re-locked
4. THE Leave_Year_System SHALL display archived years only in admin interfaces

### Requirement 7: Year Selector Interface

**User Story:** As an Admin, I want to switch between leave years using a segmented control, so that I can manage different years efficiently.

#### Acceptance Criteria

1. THE Year_Selector SHALL display all leave years in a horizontal segmented control
2. THE Year_Selector SHALL highlight the active year with a visual indicator
3. WHEN an Admin clicks a year segment, THE Year_Selector SHALL switch the page context to display that year's data
4. THE Year_Selector SHALL include a "Create New Year" button positioned on the right side

### Requirement 8: Year Overview Display

**User Story:** As an Admin, I want to see summary statistics for each leave year, so that I can quickly understand the year's configuration.

#### Acceptance Criteria

1. THE Year_Overview_Card SHALL display total holiday count, national holiday count, and optional holiday count
2. THE Year_Overview_Card SHALL display the year's status as either Active or Archived
3. WHERE the user is an Admin, THE Year_Overview_Card SHALL display a lock/unlock toggle control
4. THE Year_Overview_Card SHALL use white background with brand red accent and 16px border radius

### Requirement 9: Holiday List Management

**User Story:** As an Admin, I want to view and manage holidays in a structured table, so that I can efficiently maintain holiday data.

#### Acceptance Criteria

1. THE Holiday_List SHALL display holidays in a table with columns: Holiday Name, Date, Type, Applies To, and Actions
2. THE Holiday_List SHALL provide Edit and Delete actions for each holiday
3. THE Holiday_List SHALL provide a "Move to another year" action for each holiday
4. THE Holiday_List SHALL sort holidays by date in ascending order by default

### Requirement 10: Holiday Creation Interface

**User Story:** As an Admin, I want to add holidays using a slide-over panel, so that I can create holidays without losing page context.

#### Acceptance Criteria

1. WHEN an Admin clicks "Add Holiday", THE Holiday_Creation_Panel SHALL slide in from the right side
2. THE Holiday_Creation_Panel SHALL provide fields for Holiday Name, Date, Type, and Applies To
3. WHEN an Admin saves a holiday, THE Holiday_Creation_Panel SHALL validate all required fields before submission
4. WHEN validation succeeds, THE Holiday_Creation_Panel SHALL close and refresh the holiday list

### Requirement 11: Holiday Cloning

**User Story:** As an Admin, I want to clone holidays from a previous year, so that I can quickly set up a new leave year.

#### Acceptance Criteria

1. WHEN an Admin creates a new leave year, THE Leave_Year_System SHALL offer an option to clone holidays from an existing year
2. WHEN an Admin selects a source year for cloning, THE Leave_Year_System SHALL copy all holiday definitions with dates adjusted to the new year
3. THE Leave_Year_System SHALL preserve holiday type and applicability scope during cloning
4. THE Leave_Year_System SHALL complete cloning within 2 seconds for up to 50 holidays

### Requirement 12: Bulk Holiday Upload

**User Story:** As an Admin, I want to upload holidays from an Excel file, so that I can efficiently import large holiday datasets.

#### Acceptance Criteria

1. WHERE bulk upload is selected, THE Holiday_System SHALL accept Excel files with columns: Holiday Name, Date, Type, Applies To
2. WHEN an Admin uploads a file, THE Holiday_System SHALL validate all rows before importing
3. IF validation fails for any row, THEN THE Holiday_System SHALL display specific error messages with row numbers
4. WHEN validation succeeds, THE Holiday_System SHALL import all holidays and associate them with the selected leave year

### Requirement 13: Holiday Export

**User Story:** As an Admin, I want to export a leave year's holidays to Excel, so that I can share or archive holiday data.

#### Acceptance Criteria

1. WHEN an Admin clicks "Export", THE Holiday_System SHALL generate an Excel file containing all holidays for the selected year
2. THE Holiday_System SHALL include columns: Holiday Name, Date, Type, Applies To in the export
3. THE Holiday_System SHALL name the export file with format "Holidays_[Year]_[Timestamp].xlsx"
4. THE Holiday_System SHALL complete export within 3 seconds for up to 100 holidays

### Requirement 14: Year Activation Workflow

**User Story:** As an Admin, I want to activate a new leave year with confirmation, so that I don't accidentally change the operational context.

#### Acceptance Criteria

1. WHEN an Admin attempts to activate a leave year, THE Leave_Year_System SHALL display a confirmation dialog
2. THE Leave_Year_System SHALL show the current active year and the year being activated in the confirmation dialog
3. WHEN an Admin confirms activation, THE Leave_Year_System SHALL deactivate the previous year and activate the selected year
4. THE Leave_Year_System SHALL update all dependent systems within 2 seconds of activation

### Requirement 15: Year Archiving Workflow

**User Story:** As an Admin, I want to archive a leave year with warning, so that I understand the implications before proceeding.

#### Acceptance Criteria

1. WHEN an Admin attempts to archive the active year, THE Leave_Year_System SHALL display a warning about system-wide impact
2. THE Leave_Year_System SHALL prevent archiving if no other year exists to become active
3. WHEN an Admin confirms archiving, THE Leave_Year_System SHALL set isActive to false and lock the year
4. THE Leave_Year_System SHALL log the archiving action with timestamp and admin identifier

### Requirement 16: UI Design System Compliance

**User Story:** As a User, I want a clean Apple-style interface, so that the system is visually appealing and easy to use.

#### Acceptance Criteria

1. THE User_Interface SHALL use color scheme: 85% white, 10% brand red, 5% neutral gray
2. THE User_Interface SHALL use typography: 22px semibold for page titles, 16px medium for section titles, 14px regular for table text
3. THE User_Interface SHALL constrain content to maximum width of 1280px with 24px section spacing
4. THE User_Interface SHALL apply 150ms transitions to interactive elements with subtle hover states

### Requirement 17: Data Migration from Legacy System

**User Story:** As a System Administrator, I want existing holidays migrated to the new system, so that no data is lost during the transition.

#### Acceptance Criteria

1. THE Migration_System SHALL create a default leave year using the current calendar year
2. THE Migration_System SHALL migrate all existing holidays into the default leave year
3. THE Migration_System SHALL set the default leave year as active with isActive = true
4. THE Migration_System SHALL update all database queries to filter by active year after migration

### Requirement 18: Prevent Dual Active Years

**User Story:** As a System Administrator, I want the system to prevent two years from being active simultaneously, so that data integrity is maintained.

#### Acceptance Criteria

1. THE Leave_Year_System SHALL validate isActive uniqueness at the database constraint level
2. IF an attempt is made to activate a second year without deactivating the first, THEN THE Leave_Year_System SHALL reject the operation with an error message
3. THE Leave_Year_System SHALL log all activation attempts for audit purposes
4. THE Leave_Year_System SHALL provide an API endpoint that returns the current active year

### Requirement 19: Holiday Movement Between Years

**User Story:** As an Admin, I want to move holidays between leave years, so that I can correct misplaced holidays.

#### Acceptance Criteria

1. WHEN an Admin selects "Move to another year" for a holiday, THE Holiday_System SHALL display a year selection dialog
2. THE Holiday_System SHALL show only valid target years excluding the current year
3. WHEN an Admin confirms the move, THE Holiday_System SHALL update the holiday's leave year association
4. THE Holiday_System SHALL preserve all holiday attributes except the year association during the move

### Requirement 20: System Synchronization

**User Story:** As a Developer, I want all system components to automatically synchronize when the active year changes, so that users see consistent data.

#### Acceptance Criteria

1. WHEN the active year changes, THE Leave_Year_System SHALL emit a system-wide event
2. THE Employee_Leaves_Section SHALL subscribe to active year change events and refresh displayed data
3. THE Attendance_Summary SHALL subscribe to active year change events and recalculate metrics
4. THE Leave_Year_System SHALL complete all synchronization operations within 5 seconds
