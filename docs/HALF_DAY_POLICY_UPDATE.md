# Half-Day Policy Update

## Overview
Updated the attendance system's half-day calculation logic to properly account for break time allowance.

## Previous Policy
- **Half-day threshold**: 5 hours of worked time (excluding breaks)
- **Full-day threshold**: 8.5 hours of worked time
- **Absent threshold**: Less than 5 hours worked time

## New Policy
- **Half-day threshold**: 4.5 hours worked time + 0.5 hours break allowance = 5 hours total
- **Full-day threshold**: 8.5 hours worked time (unchanged)
- **Absent threshold**: Less than 5 hours total time (worked + break allowance)

## Key Changes

### 1. Constants Updated (`backend/config/shiftPolicy.js`)
```javascript
// OLD
const MINIMUM_HOURS_FOR_HALF_DAY = 5; // 5 hours worked
const HALF_DAY_WORKING_MINUTES = 300; // 5 hours

// NEW
const MINIMUM_HOURS_FOR_HALF_DAY = 4.5; // 4.5 hours worked
const MINIMUM_TOTAL_HOURS_FOR_HALF_DAY = 5; // 5 hours total (worked + break)
const HALF_DAY_WORKING_MINUTES = 270; // 4.5 hours
```

### 2. Logic Updated
- **Absence calculation**: Now uses total time (worked hours + 0.5 hour break allowance)
- **Half-day calculation**: Uses worked hours only (4.5 to < 8.5 hours)
- **Break time irrelevant**: System always assumes 0.5 hour break allowance regardless of actual breaks taken

### 3. Files Modified
- `backend/config/shiftPolicy.js` - Updated constants
- `backend/routes/attendance.js` - Updated clock-out logic
- `backend/services/dailyStatusService.js` - Updated status calculation
- `backend/services/earlyCheckoutService.js` - Updated early checkout logic
- `backend/utils/attendanceStatusResolver.js` - Updated status resolution

## Examples

| Worked Hours | Break Allowance | Total Time | Status |
|--------------|----------------|------------|---------|
| 3.0 hours    | +0.5 hours     | 3.5 hours  | **Absent** |
| 4.0 hours    | +0.5 hours     | 4.5 hours  | **Absent** |
| 4.5 hours    | +0.5 hours     | 5.0 hours  | **Half-day** |
| 6.0 hours    | +0.5 hours     | 6.5 hours  | **Half-day** |
| 8.5 hours    | +0.5 hours     | 9.0 hours  | **Full day** |

## Benefits
1. **Fair calculation**: Employees get credit for standard break time
2. **Consistent policy**: 5 hours total time threshold is clear and consistent
3. **Break-agnostic**: Doesn't penalize employees who take shorter breaks
4. **Simplified logic**: Total time calculation is more intuitive

## Testing
Run the test script to verify the logic:
```bash
node backend/scripts/test-half-day-logic.js
```

## Deployment Notes
- This is a policy change that affects attendance calculations
- Existing attendance records are not retroactively updated
- New calculations apply to future clock-outs only
- Consider communicating the policy change to employees