# Holiday & Leave Year Management - Frontend Implementation

## Overview

This directory contains the frontend implementation for the Holiday & Leave Year Management System. The system provides an Apple-style UI for managing holidays across multiple years with proper segregation and archiving.

## Components Created

### Context
- **ActiveYearContext** (`src/context/ActiveYearContext.jsx`)
  - Provides active year state across the application
  - Handles loading and error states
  - Exposes `refreshActiveYear()` method for manual refresh

### Admin Components
- **YearSelector** (`src/components/admin/YearSelector.jsx`)
  - Horizontal segmented control for year selection
  - Highlights active year with visual indicator
  - "Create New Year" button

- **YearOverviewCard** (`src/components/admin/YearOverviewCard.jsx`)
  - Displays year statistics (total, national, optional holidays)
  - Shows year status (Active/Archived)
  - Lock/unlock toggle for archived years

- **HolidayList** (`src/components/admin/HolidayList.jsx`)
  - Table view of holidays with sorting
  - Edit, Delete, and Move actions
  - Respects locked year status

- **HolidayFormPanel** (`src/components/admin/HolidayFormPanel.jsx`)
  - Slide-over drawer for creating/editing holidays
  - Form validation
  - Support for all holiday types and applicability scopes

- **YearActivationDialog** (`src/components/admin/YearActivationDialog.jsx`)
  - Confirmation dialog for year activation
  - Shows impact warning
  - Displays current and target year

### Pages
- **HolidayManagementPage** (`src/pages/admin/HolidayManagementPage.jsx`)
  - Main page integrating all components
  - Handles year and holiday CRUD operations
  - Snackbar notifications for user feedback

## Usage

### 1. Wrap App with ActiveYearProvider

```jsx
// src/App.jsx
import { ActiveYearProvider } from './context/ActiveYearContext';

function App() {
    return (
        <AuthProvider>
            <ActiveYearProvider>
                <Router>
                    {/* Your routes */}
                </Router>
            </ActiveYearProvider>
        </AuthProvider>
    );
}
```

### 2. Add Route for Holiday Management

```jsx
// In your admin routes
import HolidayManagementPage from './pages/admin/HolidayManagementPage';

<Route path="/admin/holidays" element={<HolidayManagementPage />} />
```

### 3. Use ActiveYear Context in Components

```jsx
import { useActiveYear } from './context/ActiveYearContext';

function MyComponent() {
    const { activeYear, loading, error, refreshActiveYear } = useActiveYear();
    
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!activeYear) return <div>No active year configured</div>;
    
    return <div>Active Year: {activeYear.year}</div>;
}
```

## API Integration

The components use axios to communicate with the backend API:

### Leave Year Endpoints
- `GET /api/admin/leave-years` - List all years
- `POST /api/admin/leave-years` - Create new year
- `POST /api/admin/leave-years/:id/activate` - Activate year
- `POST /api/admin/leave-years/:id/lock` - Toggle lock
- `GET /api/admin/leave-years/active` - Get active year

### Holiday Endpoints
- `GET /api/admin/holidays?yearId=:id` - List holidays for year
- `POST /api/admin/holidays` - Create holiday
- `PUT /api/admin/holidays/:id` - Update holiday
- `DELETE /api/admin/holidays/:id` - Delete holiday
- `PUT /api/admin/holidays/:id/move` - Move holiday to another year

## Design System

### Colors
- Primary: Material-UI default (blue)
- Error/Brand: Red (#d32f2f)
- Background: White (#ffffff) with subtle gradients
- Secondary Background: #fafafa

### Typography
- Page Title: 22px, Semibold (h4)
- Section Title: 16px, Medium (h6)
- Table Text: 14px, Regular (body2)

### Spacing
- Container Max Width: 1280px
- Section Spacing: 24px (mb: 3)
- Internal Spacing: 12px (gap: 1.5)
- Card Padding: 24px (p: 3)

### Transitions
- All interactive elements: 150ms ease
- Hover effects: translateY(-2px)

### Border Radius
- Cards: 16px
- Buttons: 12px
- Chips: Default (rounded)

## Features

### Year Management
- ✅ Create new leave years
- ✅ View all years in segmented control
- ✅ Activate/deactivate years
- ✅ Lock/unlock archived years
- ✅ Clone holidays from previous years

### Holiday Management
- ✅ Add holidays with type and applicability
- ✅ Edit existing holidays
- ✅ Delete holidays (with confirmation)
- ✅ Move holidays between years
- ✅ Sort holidays by date
- ✅ Locked year protection

### User Experience
- ✅ Apple-style clean UI
- ✅ Slide-over panels (not modals)
- ✅ Snackbar notifications
- ✅ Loading states
- ✅ Error handling
- ✅ Confirmation dialogs for destructive actions

## Pending Features

### To Be Implemented
- [ ] Bulk upload holidays from Excel
- [ ] Export holidays to Excel
- [ ] Year archive dialog
- [ ] Employee leaves section integration
- [ ] Attendance summary integration
- [ ] Real-time updates via WebSocket
- [ ] Undo/redo functionality
- [ ] Holiday templates
- [ ] Multi-language support

## Testing

### Manual Testing Checklist
- [ ] Create a new leave year
- [ ] Clone holidays from previous year
- [ ] Add a new holiday
- [ ] Edit an existing holiday
- [ ] Delete a holiday
- [ ] Move a holiday to another year
- [ ] Activate a different year
- [ ] Lock/unlock an archived year
- [ ] Verify locked years prevent modifications
- [ ] Check snackbar notifications
- [ ] Test error handling

### Unit Tests (To Be Written)
- [ ] ActiveYearContext tests
- [ ] YearSelector component tests
- [ ] HolidayList component tests
- [ ] HolidayFormPanel validation tests
- [ ] API integration tests

## Troubleshooting

### Common Issues

**Issue: "Failed to fetch active year"**
- Solution: Ensure backend is running and `/api/admin/leave-years/active` endpoint is accessible
- Check that at least one year exists with `isActive: true`

**Issue: "Cannot modify holidays in locked year"**
- Solution: This is expected behavior. Unlock the year first using the toggle in YearOverviewCard

**Issue: Components not rendering**
- Solution: Verify ActiveYearProvider is wrapping your app
- Check browser console for errors
- Ensure all Material-UI dependencies are installed

**Issue: Axios 401 errors**
- Solution: Ensure authentication token is being sent with requests
- Check that user has admin/HR role

## Dependencies

Required npm packages:
```json
{
  "@mui/material": "^5.x",
  "@mui/icons-material": "^5.x",
  "@emotion/react": "^11.x",
  "@emotion/styled": "^11.x",
  "axios": "^1.x",
  "react": "^18.x",
  "react-dom": "^18.x",
  "react-router-dom": "^6.x"
}
```

## Performance Considerations

- ActiveYearContext fetches data once on mount
- Holiday list refetches only when year changes
- Optimistic UI updates for better UX
- Debounced search (if implemented)
- Lazy loading for large holiday lists (if needed)

## Accessibility

- All interactive elements are keyboard accessible
- Proper ARIA labels on buttons and inputs
- Color contrast meets WCAG AA standards
- Focus indicators visible
- Screen reader friendly

## Future Enhancements

1. **Drag and Drop**: Reorder holidays within a year
2. **Calendar View**: Visual calendar showing all holidays
3. **Recurring Holidays**: Auto-create holidays for next year
4. **Holiday Conflicts**: Detect and warn about overlapping holidays
5. **Approval Workflow**: Require approval before year activation
6. **Audit Trail**: Show history of changes
7. **Export Options**: PDF, CSV, iCal formats
8. **Mobile Optimization**: Responsive design for tablets and phones

## Support

For issues or questions:
- Check the design document: `.kiro/specs/holiday-leave-year-management/design.md`
- Review the requirements: `.kiro/specs/holiday-leave-year-management/requirements.md`
- See implementation status: `.kiro/specs/holiday-leave-year-management/IMPLEMENTATION_STATUS.md`
