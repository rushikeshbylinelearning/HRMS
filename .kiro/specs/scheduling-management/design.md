# Design Document: Scheduling Management

## Overview

The Scheduling Management feature consolidates shift management and office location management into a single unified page. This design leverages existing components (ShiftForm, OfficeLocationManager) and follows established patterns from the current implementation while introducing a new two-section vertical layout.

The implementation strategy focuses on:
- Component composition and reusability
- Independent state management for each section
- Responsive layout with section-specific scrolling
- Minimal changes to existing components
- Consistent Material-UI styling patterns

## Architecture

### Component Hierarchy

```
SchedulingManagementPage
├── PageHeroHeader (unified header)
├── ShiftsSection (container)
│   ├── Section Header
│   ├── Add Shift Button
│   ├── Shifts Table (sortable, paginated)
│   ├── ShiftForm Modal (existing component)
│   └── Delete Confirmation Dialog
└── OfficeLocationsSection (container)
    ├── Section Header
    ├── Add Location Button
    └── OfficeLocationManager (existing component via ref)
```

### Routing Architecture

**New Route:**
- `/scheduling-management` → SchedulingManagementPage (Admin only)

**Deprecated Routes (with redirects):**
- `/shifts` → redirects to `/scheduling-management`
- `/office-locations` → redirects to `/scheduling-management`

**Navigation Update:**
- Sidebar: Replace "Shift Management" and "Office Locations" with single "Scheduling" item

### Layout Strategy

The page uses CSS Grid for the two-section layout:

```css
.scheduling-management-page {
  display: grid;
  grid-template-rows: auto 40% 60%;
  height: calc(100vh - header-height);
  gap: 24px;
}
```

Each section is independently scrollable using `overflow-y: auto` to handle content overflow without affecting the other section.

## Components and Interfaces

### SchedulingManagementPage Component

**File:** `frontend/src/pages/SchedulingManagementPage.jsx`

**Props:** None (uses AuthContext for user role)

**State Management:**

```javascript
// Shifts Section State
const [shifts, setShifts] = useState([]);
const [shiftsLoading, setShiftsLoading] = useState(true);
const [shiftsError, setShiftsError] = useState('');
const [isShiftFormOpen, setIsShiftFormOpen] = useState(false);
const [selectedShift, setSelectedShift] = useState(null);
const [shiftDeleteDialog, setShiftDeleteDialog] = useState({ open: false, shift: null });
const [isSavingShift, setIsSavingShift] = useState(false);
const [shiftOrder, setShiftOrder] = useState('asc');
const [shiftOrderBy, setShiftOrderBy] = useState('shiftName');
const [shiftPage, setShiftPage] = useState(0);
const [shiftRowsPerPage, setShiftRowsPerPage] = useState(10);
const [shiftTotalCount, setShiftTotalCount] = useState(0);

// Office Locations Section State
const [locationsError, setLocationsError] = useState('');

// Shared Snackbar State
const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

// Ref for OfficeLocationManager
const locationManagerRef = useRef();
```

**Key Methods:**

```javascript
// Shifts Section Methods
fetchShifts() // Fetches shifts with pagination
handleOpenShiftForm(shift) // Opens add/edit modal
handleCloseShiftForm() // Closes modal
handleSaveShift(formData) // Creates or updates shift
confirmDeleteShift() // Deletes shift after confirmation
handleShiftRequestSort(event, property) // Handles table sorting
handleShiftPageChange(event, newPage) // Handles pagination
handleShiftRowsPerPageChange(event) // Changes rows per page

// Office Locations Section Methods
handleAddLocation() // Triggers OfficeLocationManager.openAddDialog()
```

### ShiftsSection Sub-Component

**Approach:** Inline functional component within SchedulingManagementPage

**Structure:**
- Section header with title and "Add Shift" button
- Table with sorting and pagination (reused from ShiftsPage)
- ShiftForm modal
- Delete confirmation dialog
- Error/loading states

**Styling:** Uses existing ShiftsPage.css classes with new container class

### OfficeLocationsSection Sub-Component

**Approach:** Inline functional component within SchedulingManagementPage

**Structure:**
- Section header with title and "Add Office Location" button
- OfficeLocationManager component (via ref)
- Error state display

**Styling:** Uses existing OfficeLocationsPage.css classes with new container class

### Reused Components

**ShiftForm** (`frontend/src/components/ShiftForm.jsx`)
- No modifications required
- Used as-is for add/edit operations

**OfficeLocationManager** (`frontend/src/components/OfficeLocationManager.jsx`)
- No modifications required
- Accessed via ref to trigger openAddDialog()
- Manages its own state, dialogs, and API calls

**PageHeroHeader** (`frontend/src/components/PageHeroHeader.jsx`)
- Used once at the top of the page
- Title: "Scheduling Management"
- Eyebrow: "Administration"
- No action buttons in header (buttons are section-specific)

## Data Models

### Shift Model (unchanged)

```javascript
{
  _id: String,
  shiftName: String,
  shiftType: 'Fixed' | 'Flexible',
  startTime: String, // HH:mm format
  endTime: String, // HH:mm format
  durationHours: Number,
  paidBreakMinutes: Number
}
```

### Office Location Model (unchanged)

```javascript
{
  _id: String,
  name: String,
  address: String,
  latitude: Number,
  longitude: Number,
  radius: Number, // in meters
  description: String,
  isActive: Boolean
}
```

### API Response Models

**Shifts List Response:**
```javascript
{
  shifts: Array<Shift>,
  totalCount: Number
}
```

**Office Locations List Response:**
```javascript
Array<OfficeLocation>
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Table Sorting Consistency

*For any* list of shifts and any sortable column (shiftName, shiftType, startTime, endTime, durationHours, paidBreakMinutes), clicking the column header should sort the table data in ascending order on first click and descending order on second click, with the sorted data maintaining referential integrity to the original shift objects.

**Validates: Requirements 2.5**

### Property 2: Pagination Data Integrity

*For any* page number and rows-per-page configuration, the displayed shifts should be a correct subset of the total shifts collection, with no duplicates across pages and all shifts accessible through pagination navigation.

**Validates: Requirements 2.6**

### Property 3: Section Independence

*For any* state change or error in one section (Shifts or Office Locations), the other section should maintain its current state, functionality, and data without interference, ensuring that loading states, error states, modal states, and data operations remain isolated.

**Validates: Requirements 6.3, 6.5, 6.6**

## Error Handling

### Shifts Section Error Handling

**API Errors:**
- Network failures during fetch: Display error alert "Failed to fetch shifts. Please try again."
- Create/Update failures: Display snackbar with error message from API response or fallback message
- Delete failures: Restore deleted shift to table, display error snackbar
- Validation errors: Display error message in ShiftForm component

**State Recovery:**
- Failed delete operations: Optimistically remove shift, restore on error
- Failed create/update: Keep modal open with form data intact
- Network timeout: Maintain current data, allow retry

### Office Locations Section Error Handling

**API Errors:**
- Handled by OfficeLocationManager component
- Network failures: Display error alert within section
- CRUD operation failures: Display error messages in dialogs or alerts
- Geolocation errors: Display error message "Failed to get current location. Please ensure location permissions are granted."

**State Recovery:**
- Managed internally by OfficeLocationManager
- Failed operations keep dialogs open for retry

### Cross-Section Error Isolation

**Principle:** Errors in one section must not affect the other section

**Implementation:**
- Separate error state variables: `shiftsError` and `locationsError`
- Independent try-catch blocks for API calls
- Section-specific error display components
- Shared snackbar for success messages only

### User-Facing Error Messages

**Shifts Section:**
- "Failed to fetch shifts. Please try again."
- "Failed to save shift." (with API error details if available)
- "Failed to delete shift." (with API error details if available)
- "Shift updated successfully!"
- "Shift added successfully!"
- "Shift deleted successfully!"

**Office Locations Section:**
- "Failed to fetch office locations"
- "Failed to save office location"
- "Failed to delete office location"
- "Failed to get current location. Please ensure location permissions are granted."
- "Geolocation is not supported by this browser."

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests:** Verify specific examples, edge cases, and error conditions
- Component rendering with mock data
- User interactions (button clicks, form submissions)
- API integration with mocked responses
- Error state handling
- Routing and navigation
- Access control

**Property Tests:** Verify universal properties across all inputs
- Table sorting behavior across all columns and data sets
- Pagination correctness across different page sizes and data volumes
- Section independence under various state changes

Both testing approaches are complementary and necessary for comprehensive coverage.

### Unit Testing

**Framework:** Jest + React Testing Library

**Test Coverage:**

1. **Component Rendering Tests**
   - SchedulingManagementPage renders both sections
   - PageHeroHeader displays correct title
   - Section headers display correct labels
   - Action buttons render in correct sections
   - Tables render with correct columns

2. **Shifts Section Tests**
   - Fetch shifts on mount
   - Display loading state during fetch
   - Display error state on fetch failure
   - Open ShiftForm modal on "Add Shift" click
   - Open ShiftForm modal with data on edit click
   - Display delete confirmation dialog
   - Call correct API endpoints for CRUD operations
   - Display success/error snackbars
   - Handle pagination controls
   - Handle sorting controls

3. **Office Locations Section Tests**
   - OfficeLocationManager renders correctly
   - "Add Office Location" button triggers openAddDialog
   - Error messages display correctly
   - API endpoints are called correctly (via OfficeLocationManager)

4. **Routing Tests**
   - /scheduling-management route renders SchedulingManagementPage
   - /shifts redirects to /scheduling-management
   - /office-locations redirects to /scheduling-management
   - Admin-only access control enforced

5. **Navigation Tests**
   - Sidebar displays "Scheduling" menu item for Admin users
   - Sidebar does not display old "Shift Management" and "Office Locations" items
   - Clicking "Scheduling" navigates to /scheduling-management

6. **Layout Tests**
   - Sections have correct height percentages
   - Sections have independent scrolling
   - Responsive layout on mobile viewports
   - Proper spacing between sections

7. **Error Isolation Tests**
   - Shifts section error doesn't affect Office Locations section
   - Office Locations section error doesn't affect Shifts section
   - Independent loading states

### Property-Based Testing

**Framework:** fast-check (JavaScript property-based testing library)

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with feature name and property reference

**Property Tests:**

1. **Property Test: Table Sorting Consistency**
   - **Tag:** Feature: scheduling-management, Property 1: Table Sorting Consistency
   - **Generator:** Generate random arrays of shift objects
   - **Test:** For each sortable column, verify ascending/descending sort order
   - **Assertion:** Sorted array maintains correct order and referential integrity

2. **Property Test: Pagination Data Integrity**
   - **Tag:** Feature: scheduling-management, Property 2: Pagination Data Integrity
   - **Generator:** Generate random shift arrays of varying sizes
   - **Test:** For different page sizes and page numbers, verify correct subset display
   - **Assertion:** No duplicates, all items accessible, correct total count

3. **Property Test: Section Independence**
   - **Tag:** Feature: scheduling-management, Property 3: Section Independence
   - **Generator:** Generate random state changes and errors for each section
   - **Test:** Apply state changes to one section, verify other section unchanged
   - **Assertion:** State variables, loading states, and error states remain isolated

### Integration Testing

**Scope:** End-to-end user flows

**Test Scenarios:**
1. Admin user navigates to /scheduling-management
2. Admin user creates a new shift
3. Admin user edits an existing shift
4. Admin user deletes a shift
5. Admin user creates a new office location
6. Admin user edits an existing office location
7. Admin user deletes an office location
8. Admin user sorts shifts table
9. Admin user changes pagination settings
10. Non-admin user attempts to access /scheduling-management (should be denied)

### Manual Testing Checklist

- [ ] Visual layout matches design specifications
- [ ] Both sections scroll independently
- [ ] Responsive layout works on mobile devices
- [ ] All buttons and interactions work correctly
- [ ] Error messages display appropriately
- [ ] Success notifications appear correctly
- [ ] Sidebar navigation updated correctly
- [ ] Old routes redirect properly
- [ ] Access control enforced for non-admin users
- [ ] Browser geolocation works correctly
- [ ] All existing functionality preserved from original pages
