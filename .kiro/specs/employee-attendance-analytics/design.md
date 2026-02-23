# Design Document: Employee Attendance Analytics Dashboard

## Overview

The Employee Attendance Analytics Dashboard is a production-grade analytics system that provides comprehensive workforce attendance insights for HR managers and administrators. The system leverages pre-computed attendance data from the existing AttendanceLog collection and AttendanceSummaryService to deliver accurate, performant metrics without recalculating raw punch data.

The dashboard follows industry-standard HR analytics patterns with clear separation between Leave (approved time off) and Absent (unplanned absence) statuses, proper timezone handling using IST, and mathematically correct average calculations that exclude non-working days from divisors.

Key design principles:
- Single source of truth: AttendanceLog collection with pre-computed Net Working Hours
- Backend aggregation: All calculations performed via MongoDB aggregation pipelines
- Timezone consistency: All date operations use IST (UTC+5:30)
- Performance optimization: Indexed queries, pagination, and efficient aggregation
- Data validation: Built-in integrity checks for calculation accuracy

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Analytics Dashboard Component                        │   │
│  │  - KPI Summary Cards                                  │   │
│  │  - Employee Analytics Table                           │   │
│  │  - Filter Controls                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Node.js/Express)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Analytics Controller                                 │   │
│  │  - Request validation                                 │   │
│  │  - Filter processing                                  │   │
│  │  - Response formatting                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Analytics Service                                    │   │
│  │  - Aggregation query builder                          │   │
│  │  - Metric calculations                                │   │
│  │  - Data validation                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Attendance Summary Service (existing)                │   │
│  │  - Status resolution                                  │   │
│  │  - Holiday/Weekend detection                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ MongoDB Driver
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    MongoDB Database                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AttendanceLog Collection (Source of Truth)           │   │
│  │  - Pre-computed totalWorkingHours                     │   │
│  │  - Resolved attendanceStatus                          │   │
│  │  - Indexed: user, attendanceDate, status              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  User Collection                                      │   │
│  │  - Employee metadata                                  │   │
│  │  - Department, location, shift                        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Holiday Collection                                   │   │
│  │  - Company holidays                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Shift Collection                                     │   │
│  │  - Shift definitions                                  │   │
│  │  - Standard duration                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. User applies filters (date range, department, etc.) in the Dashboard UI
2. Frontend sends GET request to `/api/analytics/attendance` with filter parameters
3. Analytics Controller validates request and extracts filter criteria
4. Analytics Service builds MongoDB aggregation pipeline with filters
5. Aggregation pipeline:
   - Filters AttendanceLog records by date range and user criteria
   - Joins with User collection for employee metadata
   - Joins with Shift collection for shift duration
   - Groups by employee to calculate per-employee metrics
   - Calculates organization-wide summary metrics
6. Service validates calculation integrity (e.g., Non-Working Days = Leave + Absent)
7. Controller formats response with summary and employeeAnalytics arrays
8. Frontend renders KPI cards and employee table

### Technology Stack

- Backend: Node.js with Express.js
- Database: MongoDB with Mongoose ODM
- Frontend: React with modern hooks
- API: RESTful JSON API
- Timezone: IST (UTC+5:30) using existing istTime utility

## Components and Interfaces

### Backend Components

#### 1. Analytics Controller (`backend/controllers/analyticsController.js`)

Handles HTTP requests for attendance analytics.

```javascript
/**
 * GET /api/analytics/attendance
 * 
 * Query Parameters:
 * - startDate: string (YYYY-MM-DD, required)
 * - endDate: string (YYYY-MM-DD, required)
 * - department: string (optional)
 * - location: string (optional)
 * - shiftType: string (optional, 'Fixed' | 'Flexible')
 * - employmentStatus: string (optional, 'Active' | 'Inactive')
 * - page: number (optional, default: 1)
 * - limit: number (optional, default: 50)
 * 
 * Response: {
 *   summary: SummaryMetrics,
 *   employeeAnalytics: EmployeeMetrics[],
 *   pagination: PaginationInfo
 * }
 */
async function getAttendanceAnalytics(req, res) {
  // 1. Validate and extract query parameters
  // 2. Build filter object
  // 3. Call AnalyticsService.calculateAttendanceMetrics()
  // 4. Format and return response
}
```

#### 2. Analytics Service (`backend/services/AnalyticsService.js`)

Core business logic for attendance analytics calculations.

```javascript
/**
 * Calculate attendance metrics for filtered employees
 * 
 * @param {Object} filters - Filter criteria
 * @param {string} filters.startDate - Start date (YYYY-MM-DD)
 * @param {string} filters.endDate - End date (YYYY-MM-DD)
 * @param {string} [filters.department] - Department filter
 * @param {string} [filters.location] - Location filter
 * @param {string} [filters.shiftType] - Shift type filter
 * @param {string} [filters.employmentStatus] - Employment status filter
 * @param {number} [filters.page] - Page number for pagination
 * @param {number} [filters.limit] - Records per page
 * 
 * @returns {Promise<AnalyticsResult>}
 */
async function calculateAttendanceMetrics(filters) {
  // 1. Build user filter criteria
  // 2. Get filtered employee IDs
  // 3. Build aggregation pipeline for employee metrics
  // 4. Execute aggregation
  // 5. Calculate summary metrics from employee data
  // 6. Validate data integrity
  // 7. Return formatted result
}

/**
 * Build MongoDB aggregation pipeline for employee metrics
 */
function buildEmployeeMetricsPipeline(employeeIds, startDate, endDate, shiftDuration) {
  // Returns aggregation pipeline array
}

/**
 * Calculate summary metrics from employee metrics
 */
function calculateSummaryMetrics(employeeMetrics) {
  // Aggregates employee-level data into organization-wide metrics
}

/**
 * Validate calculation integrity
 */
function validateMetrics(metrics) {
  // Checks: Non-Working Days = Leave + Absent
  // Checks: Avg Working Hours > 0 only if Present Days > 0
  // Logs errors if validation fails
}
```

#### 3. Attendance Summary Service (existing)

Already exists in the codebase. Will be used for status resolution logic.

```javascript
// backend/services/AttendanceSummaryService.js
// Provides: getEmployeeAttendanceSummary(employeeId, startDate, endDate)
// Returns: Array of daily attendance records with resolved status
```

### Frontend Components

#### 1. Analytics Dashboard Component

Main container component for the analytics dashboard.

```javascript
// frontend/src/components/Analytics/AttendanceDashboard.jsx

function AttendanceDashboard() {
  // State management for filters, data, loading
  // Fetches data from API
  // Renders KPI cards and employee table
}
```

#### 2. KPI Summary Cards Component

Displays key performance indicators.

```javascript
// frontend/src/components/Analytics/KPISummaryCards.jsx

function KPISummaryCards({ summary }) {
  // Renders 10 KPI cards:
  // - Total Employees
  // - Present Days
  // - Leave Days
  // - Absent Days
  // - Total Non-Working Days
  // - Attendance %
  // - Total Net Working Hours
  // - Average Working Hours
  // - Overtime Hours
  // - Late Login Count
}
```

#### 3. Employee Analytics Table Component

Displays per-employee metrics with pagination.

```javascript
// frontend/src/components/Analytics/EmployeeAnalyticsTable.jsx

function EmployeeAnalyticsTable({ employees, pagination, onPageChange }) {
  // Renders table with columns:
  // - Employee Name
  // - Department
  // - Present Days
  // - Leave Days
  // - Absent Days
  // - Total Non-Working Days
  // - Total Net Hours
  // - Avg Working Hours
  // - Overtime Hours
  // - Late Count
  // - Attendance %
}
```

#### 4. Filter Controls Component

Provides filtering interface.

```javascript
// frontend/src/components/Analytics/FilterControls.jsx

function FilterControls({ filters, onFilterChange }) {
  // Renders filter inputs:
  // - Date Range Picker (IST-based)
  // - Department Dropdown
  // - Location Dropdown
  // - Shift Type Dropdown
  // - Employment Status Dropdown
}
```

## Data Models

### AttendanceLog (existing, source of truth)

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  attendanceDate: String, // "YYYY-MM-DD"
  clockInTime: Date,
  clockOutTime: Date,
  attendanceStatus: String, // "On-time" | "Late" | "Half-day" | "Absent" | "Leave"
  totalWorkingHours: Number, // Pre-computed net working hours
  isLate: Boolean,
  isHalfDay: Boolean,
  lateMinutes: Number,
  shiftDurationMinutes: Number,
  paidBreakMinutesTaken: Number,
  unpaidBreakMinutesTaken: Number,
  leaveRequest: ObjectId (ref: LeaveRequest),
  // ... other fields
}
```

### User (existing)

```javascript
{
  _id: ObjectId,
  employeeCode: String,
  fullName: String,
  email: String,
  department: String,
  designation: String,
  joiningDate: Date,
  isActive: Boolean,
  shiftGroup: ObjectId (ref: Shift),
  alternateSaturdayPolicy: String,
  // ... other fields
}
```

### Shift (existing)

```javascript
{
  _id: ObjectId,
  shiftName: String,
  shiftType: String, // "Fixed" | "Flexible"
  startTime: String, // "HH:mm"
  endTime: String, // "HH:mm"
  durationHours: Number,
  paidBreakMinutes: Number
}
```

### Holiday (existing)

```javascript
{
  _id: ObjectId,
  date: Date,
  name: String,
  isTentative: Boolean
}
```

### Analytics Response Models

#### SummaryMetrics

```javascript
{
  totalEmployees: Number,
  presentDays: Number,
  leaveDays: Number,
  absentDays: Number,
  nonWorkingDays: Number, // leaveDays + absentDays
  attendancePercentage: Number, // 0-100, 2 decimal places
  totalNetHours: Number, // 2 decimal places
  averageWorkingHours: Number, // totalNetHours / presentDays, 2 decimal places
  overtimeHours: Number, // 2 decimal places
  lateCount: Number
}
```

#### EmployeeMetrics

```javascript
{
  employeeId: String,
  employeeName: String,
  employeeCode: String,
  department: String,
  designation: String,
  presentDays: Number,
  leaveDays: Number,
  absentDays: Number,
  nonWorkingDays: Number, // leaveDays + absentDays
  totalNetHours: Number, // 2 decimal places
  avgWorkingHours: Number, // totalNetHours / presentDays, 2 decimal places
  overtimeHours: Number, // 2 decimal places
  lateCount: Number,
  attendancePercentage: Number // 0-100, 2 decimal places
}
```

#### PaginationInfo

```javascript
{
  currentPage: Number,
  totalPages: Number,
  totalRecords: Number,
  limit: Number
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I identified the following consolidations to eliminate redundancy:

**Consolidations:**
- Properties 3.1, 3.2, 3.3 → Combined into single property: "Present Days counts only 'Present' status"
- Properties 4.1, 4.2, 4.3 → Combined into single property: "Leave Days counts only 'Approved Leave' status"
- Properties 5.1, 5.2, 5.3 → Combined into single property: "Absent Days counts only 'Absent' status"
- Properties 7.1, 7.2, 7.3, 7.4 → Combined into single property: "Total Net Hours sums only Present days"
- Properties 8.1, 8.2, 8.3, 8.4, 8.5 → Combined into single property: "Average = Total Hours / Present Days"
- Properties 9.1, 9.2, 9.3 → Combined into single property: "Attendance % = Present / (Present + Leave + Absent)"
- Properties 10.1, 10.2, 10.3 → Combined into single property: "Overtime = max(0, hours - shift)"
- Properties 10.4, 10.5 → Combined into single property: "Total Overtime sums only Present days"
- Properties 11.1, 11.2, 11.3 → Combined into single property: "Late if login > shift start"
- Properties 11.4, 11.5 → Combined into single property: "Late count only for Present days"
- Properties 13.2, 13.3, 13.4, 13.5 → Combined into single property: "Filters include only matching employees"
- Properties 17.1, 17.3 → Combined into single property: "Metrics start from join date"
- Properties 17.2, 17.4 → Combined into single property: "Metrics end at exit date"

**Redundancies Eliminated:**
- Property 6.4 is redundant with 6.1 (same validation at different level)
- Property 12.12 is redundant with 6.1 (same validation)
- Property 15.3 is redundant with 6.1 (same validation)

**Result:** Reduced from 100+ acceptance criteria to 25 unique, non-redundant properties.

### Core Correctness Properties

Property 1: Non-Working Days Invariant
*For any* attendance dataset (summary or employee-level), the Total Non-Working Days MUST equal Leave Days plus Absent Days.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 12.12, 15.3**

Property 2: Present Days Status Filter
*For any* attendance dataset, Present Days count MUST equal the count of records where status is exactly "Present" (excluding Holiday, Weekend, Leave, and Absent statuses).
**Validates: Requirements 3.1, 3.2, 3.3**

Property 3: Leave Days Status Filter
*For any* attendance dataset, Leave Days count MUST equal the count of records where status is exactly "Approved Leave" (excluding Holiday, Weekend, Present, and Absent statuses).
**Validates: Requirements 4.1, 4.2, 4.3**

Property 4: Absent Days Status Filter
*For any* attendance dataset, Absent Days count MUST equal the count of records where status is exactly "Absent" (excluding Holiday, Weekend, Present, and Leave statuses).
**Validates: Requirements 5.1, 5.2, 5.3**

Property 5: Aggregation Consistency
*For any* set of employee metrics, the sum of individual employee counts (Present, Leave, Absent) MUST equal the organization-wide summary counts.
**Validates: Requirements 3.5, 4.5, 5.5**

Property 6: Total Net Hours Calculation
*For any* attendance dataset, Total Net Working Hours MUST equal the sum of totalWorkingHours field for all records where status is "Present" (treating null values as zero).
**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

Property 7: Average Working Hours Calculation
*For any* attendance dataset where Present Days > 0, Average Working Hours MUST equal Total Net Working Hours divided by Present Days only (not including Leave, Absent, Holiday, or Weekend days in the divisor).
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 18.3**

Property 8: Average Working Hours Zero Case
*For any* attendance dataset where Present Days equals zero, Average Working Hours MUST equal zero.
**Validates: Requirements 8.6**

Property 9: Leave Days Independence
*For any* attendance dataset, adding or removing Leave Day records MUST NOT change the Average Working Hours (since Leave days are excluded from both numerator and denominator).
**Validates: Requirements 8.7**

Property 10: Attendance Percentage Calculation
*For any* attendance dataset where (Present + Leave + Absent) > 0, Attendance Percentage MUST equal (Present Days / (Present Days + Leave Days + Absent Days)) × 100, expressed as a value between 0 and 100.
**Validates: Requirements 9.1, 9.2, 9.3, 9.5**

Property 11: Attendance Percentage Zero Case
*For any* attendance dataset where (Present + Leave + Absent) equals zero, Attendance Percentage MUST equal zero.
**Validates: Requirements 9.4**

Property 12: Daily Overtime Calculation
*For any* Present Day record with valid Net_Working_Hours and Shift_Duration, daily overtime MUST equal max(0, Net_Working_Hours - Shift_Duration).
**Validates: Requirements 10.1, 10.2, 10.3**

Property 13: Total Overtime Calculation
*For any* attendance dataset, Total Overtime Hours MUST equal the sum of daily overtime for all records where status is "Present" (excluding Leave and Absent days).
**Validates: Requirements 10.4, 10.5**

Property 14: Late Login Determination
*For any* Present Day record with valid first_login_time and shift_start_time, the record MUST be counted as late if and only if first_login_time > shift_start_time.
**Validates: Requirements 11.1, 11.2, 11.3**

Property 15: Late Count Calculation
*For any* attendance dataset, Late Login Count MUST equal the count of Present Day records where first_login_time > shift_start_time (excluding Leave and Absent days).
**Validates: Requirements 11.4, 11.5**

Property 16: Date Range Filter
*For any* date range filter [startDate, endDate], all calculated metrics MUST include only attendance records where attendanceDate >= startDate AND attendanceDate <= endDate.
**Validates: Requirements 13.1**

Property 17: Employee Attribute Filters
*For any* filter on employee attributes (department, location, shiftType, employmentStatus), all calculated metrics MUST include only employees whose attributes match ALL applied filters (AND logic).
**Validates: Requirements 13.2, 13.3, 13.4, 13.5, 13.6**

Property 18: Total Days Validation
*For any* attendance dataset, the sum (Present Days + Leave Days + Absent Days) MUST equal the total number of considered working days (excluding Holidays and Weekends).
**Validates: Requirements 15.1**

Property 19: Average Hours Validation
*For any* attendance dataset, if Average Working Hours > 0, then Present Days MUST be > 0.
**Validates: Requirements 15.2**

Property 20: Numeric Precision
*For any* calculated metric, hours MUST be rounded to 2 decimal places and percentages MUST be rounded to 2 decimal places.
**Validates: Requirements 16.5**

Property 21: Join Date Boundary
*For any* employee with joiningDate within the analysis period, all calculated metrics MUST exclude days before joiningDate (those days MUST NOT be counted as Absent).
**Validates: Requirements 17.1, 17.3**

Property 22: Exit Date Boundary
*For any* inactive employee with an exit date within the analysis period, all calculated metrics MUST exclude days after the exit date (those days MUST NOT be counted as Absent).
**Validates: Requirements 17.2, 17.4**

## Error Handling

### Input Validation Errors

1. **Invalid Date Format**
   - Condition: Date parameters not in YYYY-MM-DD format
   - Response: HTTP 400 with error message "Invalid date format. Use YYYY-MM-DD."
   - Logging: Log warning with request details

2. **Invalid Date Range**
   - Condition: startDate > endDate
   - Response: HTTP 400 with error message "Start date must be before or equal to end date."
   - Logging: Log warning with request details

3. **Missing Required Parameters**
   - Condition: startDate or endDate not provided
   - Response: HTTP 400 with error message "Start date and end date are required."
   - Logging: Log warning with request details

4. **Invalid Filter Values**
   - Condition: Invalid enum values for filters (e.g., invalid shiftType)
   - Response: HTTP 400 with error message specifying valid values
   - Logging: Log warning with request details

5. **Invalid Pagination Parameters**
   - Condition: page < 1 or limit < 1 or limit > 1000
   - Response: HTTP 400 with error message "Invalid pagination parameters."
   - Logging: Log warning with request details

### Data Integrity Errors

1. **Non-Working Days Mismatch**
   - Condition: nonWorkingDays ≠ leaveDays + absentDays
   - Response: Continue processing, but log error
   - Logging: Log error with employee ID, calculated values, and date range
   - Action: Include warning flag in response

2. **Average Hours with Zero Present Days**
   - Condition: averageWorkingHours > 0 but presentDays = 0
   - Response: Continue processing, but log error
   - Logging: Log error with employee ID and calculated values
   - Action: Force averageWorkingHours to 0

3. **Holiday Marked as Absent**
   - Condition: Attendance record has status "Absent" but date matches a Holiday
   - Response: Continue processing, but log error
   - Logging: Log error with employee ID, date, and holiday name
   - Action: Include data quality warning in response

4. **Null Critical Fields**
   - Condition: employeeId, attendanceDate, or status is null
   - Response: Exclude record from calculations
   - Logging: Log error with record ID and missing fields
   - Action: Continue processing remaining records

### System Errors

1. **Database Connection Error**
   - Condition: Cannot connect to MongoDB
   - Response: HTTP 503 with error message "Service temporarily unavailable."
   - Logging: Log critical error with connection details
   - Action: Retry with exponential backoff (3 attempts)

2. **Aggregation Pipeline Error**
   - Condition: MongoDB aggregation fails
   - Response: HTTP 500 with error message "Internal server error while calculating metrics."
   - Logging: Log error with pipeline details and error message
   - Action: Return empty result set with error flag

3. **Timeout Error**
   - Condition: Query exceeds 30-second timeout
   - Response: HTTP 504 with error message "Request timeout. Try reducing date range or applying more filters."
   - Logging: Log warning with query parameters
   - Action: Suggest optimization to user

### Null/Missing Data Handling

1. **Null Net Working Hours**
   - Condition: totalWorkingHours field is null for Present Day
   - Action: Treat as 0 hours
   - Logging: Log info-level message

2. **Null First Login Time**
   - Condition: clockInTime is null for Present Day
   - Action: Do not count as late login
   - Logging: Log info-level message

3. **Null Shift Duration**
   - Condition: shiftDurationMinutes is null
   - Action: Cannot calculate overtime for that record
   - Logging: Log warning with employee ID and date

4. **Missing Employee Metadata**
   - Condition: department, designation, or other metadata is null
   - Action: Display as "N/A" in UI
   - Logging: No logging required (expected for some employees)

## Testing Strategy

### Dual Testing Approach

This feature requires both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific examples demonstrating correct behavior
- Edge cases (half-days, null values, zero divisions)
- Error conditions and validation
- API response structure
- Integration between components

**Property-Based Tests** focus on:
- Universal properties that hold for all inputs
- Calculation correctness across randomized datasets
- Invariants that must always be true
- Metamorphic properties (e.g., filtering, aggregation)

Together, these approaches provide comprehensive coverage: unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across all possible inputs.

### Property-Based Testing Configuration

**Library Selection:**
- JavaScript/Node.js: Use `fast-check` library
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: employee-attendance-analytics, Property {number}: {property_text}`

**Test Organization:**
- Create `backend/tests/analytics/properties/` directory
- One test file per property or related property group
- Each correctness property MUST be implemented by a SINGLE property-based test

**Example Property Test Structure:**

```javascript
// backend/tests/analytics/properties/nonWorkingDaysInvariant.test.js
const fc = require('fast-check');
const { calculateAttendanceMetrics } = require('../../../services/AnalyticsService');

describe('Property 1: Non-Working Days Invariant', () => {
  it('Feature: employee-attendance-analytics, Property 1: For any attendance dataset, Total Non-Working Days MUST equal Leave Days plus Absent Days', () => {
    fc.assert(
      fc.property(
        // Generators for random attendance data
        fc.array(attendanceRecordArbitrary()),
        async (attendanceRecords) => {
          const result = await calculateAttendanceMetrics({
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            testData: attendanceRecords
          });
          
          // Property assertion
          expect(result.summary.nonWorkingDays).toBe(
            result.summary.leaveDays + result.summary.absentDays
          );
          
          // Also check employee-level
          result.employeeAnalytics.forEach(emp => {
            expect(emp.nonWorkingDays).toBe(emp.leaveDays + emp.absentDays);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing Strategy

**Test Coverage Areas:**

1. **Analytics Service Tests** (`backend/tests/analytics/analyticsService.test.js`)
   - Test specific calculation examples
   - Test edge cases (zero present days, null values)
   - Test filter combinations
   - Test pagination logic
   - Test data validation

2. **Analytics Controller Tests** (`backend/tests/analytics/analyticsController.test.js`)
   - Test request validation
   - Test error responses
   - Test response formatting
   - Test authentication/authorization

3. **Integration Tests** (`backend/tests/analytics/integration.test.js`)
   - Test end-to-end API flow
   - Test with real database (test DB)
   - Test filter combinations
   - Test pagination

4. **Frontend Component Tests**
   - Test KPI card rendering
   - Test employee table rendering
   - Test filter controls
   - Test data fetching and error handling

**Example Unit Test:**

```javascript
describe('AnalyticsService - Average Working Hours', () => {
  it('should calculate average correctly with only present days', async () => {
    const testData = [
      { status: 'Present', totalWorkingHours: 9 },
      { status: 'Present', totalWorkingHours: 8.5 },
      { status: 'Leave', totalWorkingHours: 0 },
      { status: 'Absent', totalWorkingHours: 0 }
    ];
    
    const result = await calculateMetrics(testData);
    
    expect(result.summary.presentDays).toBe(2);
    expect(result.summary.totalNetHours).toBe(17.5);
    expect(result.summary.averageWorkingHours).toBe(8.75); // 17.5 / 2
  });
  
  it('should return zero average when no present days', async () => {
    const testData = [
      { status: 'Leave', totalWorkingHours: 0 },
      { status: 'Absent', totalWorkingHours: 0 }
    ];
    
    const result = await calculateMetrics(testData);
    
    expect(result.summary.presentDays).toBe(0);
    expect(result.summary.averageWorkingHours).toBe(0);
  });
});
```

### Test Data Generators for Property Tests

Create reusable generators for property-based tests:

```javascript
// backend/tests/analytics/generators/attendanceArbitraries.js

const fc = require('fast-check');

// Generate random attendance status
const statusArbitrary = () => fc.constantFrom(
  'Present', 'Leave', 'Absent', 'Holiday', 'Weekend'
);

// Generate random attendance record
const attendanceRecordArbitrary = () => fc.record({
  attendanceDate: fc.date().map(d => d.toISOString().split('T')[0]),
  status: statusArbitrary(),
  totalWorkingHours: fc.option(fc.float({ min: 0, max: 12 }), { nil: null }),
  isHalfDay: fc.boolean(),
  clockInTime: fc.option(fc.date(), { nil: null }),
  shiftDurationMinutes: fc.integer({ min: 480, max: 600 })
});

// Generate random employee
const employeeArbitrary = () => fc.record({
  _id: fc.hexaString({ minLength: 24, maxLength: 24 }),
  fullName: fc.fullName(),
  department: fc.constantFrom('Engineering', 'HR', 'Sales', 'Marketing'),
  joiningDate: fc.date({ min: new Date('2020-01-01') })
});
```

### Continuous Integration

- Run all tests on every commit
- Property tests run with 100 iterations in CI
- Unit tests must maintain >80% code coverage
- Integration tests run against test database
- Performance benchmarks for aggregation queries
