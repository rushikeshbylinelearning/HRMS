# Requirements Document: Employee Attendance Analytics Dashboard

## Introduction

This document specifies the requirements for an industry-standard Attendance Analytics Dashboard that provides comprehensive workforce attendance insights. The system aggregates pre-computed attendance data to deliver accurate metrics for HR decision-making, ensuring clear separation between Leave and Absent statuses, proper timezone handling, and performance-optimized calculations.

## Glossary

- **Attendance_System**: The overall system that manages and analyzes employee attendance data
- **Dashboard**: The visual interface displaying attendance analytics and metrics
- **Attendance_Summary**: The pre-computed dataset containing daily attendance records (single source of truth)
- **Present_Day**: A working day where the employee was physically or virtually present
- **Leave_Day**: A day where the employee took approved leave (vacation, sick leave, etc.)
- **Absent_Day**: A day where the employee was expected to work but did not attend without approval
- **Non_Working_Day**: The sum of Leave Days and Absent Days for an employee
- **Net_Working_Hours**: Pre-computed actual working hours for a day (already calculated in Attendance Summary)
- **Average_Working_Hours**: Total Net Working Hours divided by Present Days only
- **Overtime_Hours**: Hours worked beyond the standard shift duration
- **Late_Login**: First login time occurring after the designated shift start time
- **IST**: Indian Standard Time (UTC+5:30)
- **Holiday**: Company-designated non-working day (excluded from all calculations)
- **Weekend**: Saturday/Sunday or configured weekly off days (excluded from all calculations)
- **Shift_Duration**: Standard working hours expected per shift (e.g., 9 hours)
- **Attendance_Percentage**: Ratio of Present Days to total considered days (Present + Leave + Absent)

## Requirements

### Requirement 1: Data Source Architecture

**User Story:** As a system architect, I want the dashboard to use pre-computed attendance summary data exclusively, so that calculations are consistent, performant, and maintainable.

#### Acceptance Criteria

1. THE Attendance_System SHALL fetch all attendance data exclusively from the Attendance_Summary dataset
2. THE Attendance_System SHALL NOT recalculate working hours from raw punch logs
3. THE Attendance_System SHALL NOT access raw login/logout timestamps for duration calculations
4. WHEN retrieving daily attendance records, THE Attendance_System SHALL use the pre-computed Net_Working_Hours field
5. THE Attendance_System SHALL perform all aggregations on the backend server

### Requirement 2: KPI Summary Metrics

**User Story:** As an HR manager, I want to see key attendance metrics at a glance, so that I can quickly assess workforce attendance patterns.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Attendance_System SHALL display Total Employees count
2. WHEN the Dashboard loads, THE Attendance_System SHALL display total Present Days across all employees
3. WHEN the Dashboard loads, THE Attendance_System SHALL display total Leave Days across all employees
4. WHEN the Dashboard loads, THE Attendance_System SHALL display total Absent Days across all employees
5. WHEN the Dashboard loads, THE Attendance_System SHALL display Total Non-Working Days calculated as Leave Days plus Absent Days
6. WHEN the Dashboard loads, THE Attendance_System SHALL display Attendance Percentage
7. WHEN the Dashboard loads, THE Attendance_System SHALL display Total Net Working Hours
8. WHEN the Dashboard loads, THE Attendance_System SHALL display Average Working Hours
9. WHEN the Dashboard loads, THE Attendance_System SHALL display total Overtime Hours
10. WHEN the Dashboard loads, THE Attendance_System SHALL display total Late Login Count

### Requirement 3: Present Days Calculation

**User Story:** As an HR analyst, I want accurate present day counts, so that I can measure actual employee availability.

#### Acceptance Criteria

1. WHEN calculating Present Days, THE Attendance_System SHALL count all records where status equals "Present"
2. WHEN calculating Present Days, THE Attendance_System SHALL exclude records where status equals "Holiday"
3. WHEN calculating Present Days, THE Attendance_System SHALL exclude records where status equals "Weekend"
4. WHEN a half-day present record exists, THE Attendance_System SHALL count it as 0.5 Present Days
5. WHEN aggregating across employees, THE Attendance_System SHALL sum all individual Present Day counts

### Requirement 4: Leave Days Calculation

**User Story:** As an HR manager, I want to track approved leave separately from absences, so that I can distinguish planned time off from unplanned absences.

#### Acceptance Criteria

1. WHEN calculating Leave Days, THE Attendance_System SHALL count all records where status equals "Approved Leave"
2. WHEN calculating Leave Days, THE Attendance_System SHALL exclude Holiday records
3. WHEN calculating Leave Days, THE Attendance_System SHALL exclude Weekend records
4. WHEN a leave spans multiple days, THE Attendance_System SHALL count each day individually
5. WHEN aggregating across employees, THE Attendance_System SHALL sum all individual Leave Day counts

### Requirement 5: Absent Days Calculation

**User Story:** As an HR manager, I want to identify unplanned absences, so that I can address attendance issues proactively.

#### Acceptance Criteria

1. WHEN calculating Absent Days, THE Attendance_System SHALL count all records where status equals "Absent"
2. WHEN calculating Absent Days, THE Attendance_System SHALL exclude Holiday records
3. WHEN calculating Absent Days, THE Attendance_System SHALL exclude Weekend records
4. WHEN a Holiday is incorrectly marked as Absent, THE Attendance_System SHALL log a validation error
5. WHEN aggregating across employees, THE Attendance_System SHALL sum all individual Absent Day counts

### Requirement 6: Total Non-Working Days Calculation

**User Story:** As an HR analyst, I want to see total non-working days combining leave and absences, so that I understand total employee unavailability.

#### Acceptance Criteria

1. WHEN calculating Total Non-Working Days, THE Attendance_System SHALL add Leave Days to Absent Days
2. THE Attendance_System SHALL NOT include Holiday days in Non-Working Days
3. THE Attendance_System SHALL NOT include Weekend days in Non-Working Days
4. WHEN displaying employee-level data, THE Attendance_System SHALL validate that Non-Working Days equals Leave Days plus Absent Days
5. IF the validation fails, THEN THE Attendance_System SHALL log an error with employee details

### Requirement 7: Total Net Working Hours Calculation

**User Story:** As an HR manager, I want to see total hours worked across the organization, so that I can measure productivity and capacity.

#### Acceptance Criteria

1. WHEN calculating Total Net Working Hours, THE Attendance_System SHALL sum Net_Working_Hours for all records where status equals "Present"
2. THE Attendance_System SHALL NOT include Net_Working_Hours from Leave Day records
3. THE Attendance_System SHALL NOT include Net_Working_Hours from Absent Day records
4. THE Attendance_System SHALL NOT include Net_Working_Hours from Holiday records
5. WHEN Net_Working_Hours is null for a Present Day record, THE Attendance_System SHALL treat it as zero

### Requirement 8: Average Working Hours Calculation

**User Story:** As an HR analyst, I want to calculate average working hours correctly, so that leave and absences do not artificially reduce the average for employees who work full days when present.

#### Acceptance Criteria

1. WHEN calculating Average Working Hours, THE Attendance_System SHALL divide Total Net Working Hours by Present Days only
2. THE Attendance_System SHALL NOT include Leave Days in the divisor
3. THE Attendance_System SHALL NOT include Absent Days in the divisor
4. THE Attendance_System SHALL NOT include Holiday days in the divisor
5. THE Attendance_System SHALL NOT include Weekend days in the divisor
6. WHEN Present Days equals zero, THE Attendance_System SHALL return zero for Average Working Hours
7. WHEN an employee has Leave Days, THE Average_Working_Hours SHALL remain unaffected by those Leave Days

### Requirement 9: Attendance Percentage Calculation

**User Story:** As an HR manager, I want to measure attendance percentage, so that I can identify employees with attendance concerns.

#### Acceptance Criteria

1. WHEN calculating Attendance Percentage, THE Attendance_System SHALL divide Present Days by the sum of Present Days, Leave Days, and Absent Days
2. THE Attendance_System SHALL NOT include Holiday days in the denominator
3. THE Attendance_System SHALL NOT include Weekend days in the denominator
4. WHEN the denominator equals zero, THE Attendance_System SHALL return zero for Attendance Percentage
5. THE Attendance_System SHALL express Attendance Percentage as a value between 0 and 100

### Requirement 10: Overtime Hours Calculation

**User Story:** As an HR manager, I want to track overtime hours, so that I can manage workload and compensation appropriately.

#### Acceptance Criteria

1. WHEN calculating daily overtime, THE Attendance_System SHALL subtract Shift_Duration from Net_Working_Hours
2. WHEN Net_Working_Hours is less than or equal to Shift_Duration, THE Attendance_System SHALL record zero overtime for that day
3. WHEN Net_Working_Hours exceeds Shift_Duration, THE Attendance_System SHALL record the difference as overtime
4. WHEN calculating total Overtime Hours, THE Attendance_System SHALL sum overtime only from Present Day records
5. THE Attendance_System SHALL NOT calculate overtime for Leave Days or Absent Days

### Requirement 11: Late Login Count Calculation

**User Story:** As an HR manager, I want to track late arrivals, so that I can address punctuality issues.

#### Acceptance Criteria

1. WHEN determining if a login is late, THE Attendance_System SHALL compare first_login_time to shift_start_time
2. WHEN first_login_time is after shift_start_time, THE Attendance_System SHALL increment the late login count
3. WHEN first_login_time is on or before shift_start_time, THE Attendance_System SHALL NOT count it as late
4. THE Attendance_System SHALL count late logins only for Present Day records
5. THE Attendance_System SHALL NOT count late logins for Leave Days or Absent Days

### Requirement 12: Employee Analytics Table

**User Story:** As an HR analyst, I want to see detailed per-employee attendance metrics, so that I can analyze individual performance and identify trends.

#### Acceptance Criteria

1. WHEN displaying the employee table, THE Dashboard SHALL show Employee Name
2. WHEN displaying the employee table, THE Dashboard SHALL show Department
3. WHEN displaying the employee table, THE Dashboard SHALL show Present Days
4. WHEN displaying the employee table, THE Dashboard SHALL show Leave Days
5. WHEN displaying the employee table, THE Dashboard SHALL show Absent Days
6. WHEN displaying the employee table, THE Dashboard SHALL show Total Non-Working Days
7. WHEN displaying the employee table, THE Dashboard SHALL show Total Net Hours
8. WHEN displaying the employee table, THE Dashboard SHALL show Average Working Hours
9. WHEN displaying the employee table, THE Dashboard SHALL show Overtime Hours
10. WHEN displaying the employee table, THE Dashboard SHALL show Late Count
11. WHEN displaying the employee table, THE Dashboard SHALL show Attendance Percentage
12. WHEN displaying employee data, THE Attendance_System SHALL validate that Total Non-Working Days equals Leave Days plus Absent Days for each employee

### Requirement 13: Filter System

**User Story:** As an HR manager, I want to filter attendance data by various criteria, so that I can analyze specific segments of the workforce.

#### Acceptance Criteria

1. WHEN a date range filter is applied, THE Attendance_System SHALL recalculate all metrics using only records within that range
2. WHEN a department filter is applied, THE Attendance_System SHALL include only employees from selected departments
3. WHEN a location filter is applied, THE Attendance_System SHALL include only employees from selected locations
4. WHEN a shift type filter is applied, THE Attendance_System SHALL include only employees with selected shift types
5. WHEN an employment status filter is applied, THE Attendance_System SHALL include only employees with selected status (Active/Inactive)
6. WHEN multiple filters are applied, THE Attendance_System SHALL apply all filters using AND logic
7. WHEN filters are changed, THE Attendance_System SHALL refresh all KPI metrics and employee table data

### Requirement 14: Timezone Handling

**User Story:** As a system administrator, I want all date-based calculations to use IST consistently, so that attendance records are grouped correctly by calendar date.

#### Acceptance Criteria

1. WHEN grouping attendance records by date, THE Attendance_System SHALL convert all timestamps to IST before grouping
2. WHEN applying date range filters, THE Attendance_System SHALL interpret filter boundaries using IST
3. WHEN filtering by month, THE Attendance_System SHALL use IST month boundaries
4. THE Attendance_System SHALL NOT allow UTC date shifts to affect daily attendance grouping
5. WHEN storing or displaying dates, THE Attendance_System SHALL use IST as the reference timezone

### Requirement 15: Data Validation

**User Story:** As a system administrator, I want the system to validate data integrity, so that calculation errors are detected and reported.

#### Acceptance Criteria

1. WHEN calculating metrics, THE Attendance_System SHALL verify that Present Days plus Leave Days plus Absent Days equals total considered days
2. WHEN Average Working Hours is greater than zero, THE Attendance_System SHALL verify that Present Days is greater than zero
3. WHEN calculating Non-Working Days, THE Attendance_System SHALL verify it equals Leave Days plus Absent Days
4. WHEN a Holiday is counted as Absent, THE Attendance_System SHALL log a validation error
5. IF any validation check fails, THEN THE Attendance_System SHALL log the error with relevant employee and date details

### Requirement 16: API Response Structure

**User Story:** As a frontend developer, I want a well-structured API response, so that I can easily render the dashboard components.

#### Acceptance Criteria

1. WHEN the API returns analytics data, THE Attendance_System SHALL include a summary object with all KPI metrics
2. WHEN the API returns analytics data, THE Attendance_System SHALL include an employeeAnalytics array with per-employee metrics
3. THE summary object SHALL contain totalEmployees, presentDays, leaveDays, absentDays, nonWorkingDays, attendancePercentage, totalNetHours, averageWorkingHours, overtimeHours, and lateCount fields
4. THE employeeAnalytics array SHALL contain objects with employeeName, department, presentDays, leaveDays, absentDays, nonWorkingDays, totalNetHours, avgWorkingHours, overtimeHours, lateCount, and attendancePercentage fields
5. THE Attendance_System SHALL return numeric values with appropriate precision (hours to 2 decimal places, percentages to 2 decimal places)

### Requirement 17: Mid-Period Employment Changes

**User Story:** As an HR analyst, I want attendance calculations to account for employees who joined or exited mid-period, so that metrics reflect actual availability.

#### Acceptance Criteria

1. WHEN an employee joined mid-month, THE Attendance_System SHALL calculate metrics starting from the join date
2. WHEN an employee exited mid-month, THE Attendance_System SHALL calculate metrics ending at the exit date
3. THE Attendance_System SHALL NOT count days before join date as Absent
4. THE Attendance_System SHALL NOT count days after exit date as Absent
5. WHEN calculating organization-wide metrics, THE Attendance_System SHALL include partial-month employees proportionally

### Requirement 18: Half-Day Attendance

**User Story:** As an HR manager, I want to handle half-day attendance correctly, so that partial presence is accurately reflected.

#### Acceptance Criteria

1. WHEN a half-day present record exists, THE Attendance_System SHALL count it as 0.5 in Present Days
2. WHEN a half-day leave record exists, THE Attendance_System SHALL count it as 0.5 in Leave Days
3. WHEN calculating Average Working Hours with half-days, THE Attendance_System SHALL use the fractional Present Days count as the divisor
4. WHEN displaying half-day records in the employee table, THE Dashboard SHALL show the fractional day count
5. THE Attendance_System SHALL support combinations of half-day present and half-day leave on the same calendar date

### Requirement 19: Performance Optimization

**User Story:** As a system administrator, I want the dashboard to load quickly even with large datasets, so that users have a responsive experience.

#### Acceptance Criteria

1. WHEN calculating metrics, THE Attendance_System SHALL use database aggregation queries rather than application-level loops
2. WHEN querying attendance data, THE Attendance_System SHALL use indexed fields (employeeId, date, status)
3. THE Attendance_System SHALL NOT execute N+1 queries when fetching employee-level data
4. WHEN displaying the employee table, THE Attendance_System SHALL implement pagination
5. WHEN filters are applied, THE Attendance_System SHALL push filter conditions to the database query level

### Requirement 20: Null and Missing Data Handling

**User Story:** As a system administrator, I want the system to handle missing or null data gracefully, so that incomplete records do not cause calculation errors.

#### Acceptance Criteria

1. WHEN Net_Working_Hours is null for a Present Day, THE Attendance_System SHALL treat it as zero
2. WHEN first_login_time is null, THE Attendance_System SHALL NOT count it as a late login
3. WHEN shift_start_time is null, THE Attendance_System SHALL NOT calculate late login for that record
4. WHEN Shift_Duration is null, THE Attendance_System SHALL NOT calculate overtime for that record
5. IF critical fields (employeeId, date, status) are null, THEN THE Attendance_System SHALL log an error and exclude that record from calculations
