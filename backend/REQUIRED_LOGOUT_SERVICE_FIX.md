# Required Logout Service - Passenger Safety Fix

## Problem Statement

The production Node.js app was crashing during startup under Passenger due to runtime logic executing at import time in `backend/services/requiredLogoutService.js`. The crash occurred around line 20 when Passenger eagerly loaded all modules during initialization.

### Root Cause
- **Top-level execution**: The original code imported `moment-timezone` at the top level, which could trigger initialization code
- **Passenger behavior**: Unlike development environments, Passenger eagerly loads all modules during startup, exposing any import-time side effects
- **Fatal error**: Any runtime logic (date calculations, function calls, etc.) at import time caused the app to crash before it could start

## Solution Implemented

### 1. Lazy Loading Pattern
Implemented lazy loading for `moment-timezone` to ensure it's only loaded when the function is actually called:

```javascript
// Lazy-loaded moment instance (initialized on first use)
let momentInstance = null;

function getMoment() {
    if (!momentInstance) {
        momentInstance = require('moment-timezone');
    }
    return momentInstance;
}
```

### 2. Zero Top-Level Execution
- **NO** date/time calculations at import time
- **NO** function calls outside exported functions
- **NO** access to user, shift, env, or DB during require()
- **NO** side effects during module loading

### 3. Safe Module Structure
```
1. Imports only (pure references, no execution)
2. Pure helper functions (no side effects)
3. Exported function: calculateRequiredLogoutTime()
4. NO execution outside functions
```

## Shift Logic Implementation

### General Rules
- Work duration: 9 hours (540 minutes)
- Paid break allowance: 30 minutes
- Extra break beyond 30 minutes extends logout time
- Required Log Out never earlier than policy minimums

### 10 AM Shift (General Shift 1)
**HARD FLOOR**: Always enforce 7:00 PM minimum logout

```
Required Log Out = MAX(
    7:00 PM,
    clockInTime + 9 hours + max(0, actualBreakMinutes - 30)
)
```

**Examples:**
- Clock-in at 10:00 AM → Logout at 7:00 PM
- Clock-in at 9:00 AM → Logout at 7:00 PM (hard floor)
- Clock-in at 10:00 AM + 45 min break → Logout at 7:15 PM

### 11 AM Shift (General Shift 2)
**FLEXIBLE**: Conditional 7:00 PM floor based on check-in time

**Case 1: Clock-in < 10:00 AM**
```
Required Log Out = MAX(
    7:00 PM,
    clockInTime + 9 hours + max(0, actualBreakMinutes - 30)
)
```

**Case 2: Clock-in ≥ 10:00 AM**
```
Required Log Out = clockInTime + 9 hours + max(0, actualBreakMinutes - 30)
```

**Examples:**
- Clock-in at 9:30 AM → Logout at 7:00 PM (early floor)
- Clock-in at 10:00 AM → Logout at 7:00 PM (duration-based)
- Clock-in at 11:00 AM → Logout at 8:00 PM (duration-based)
- Clock-in at 12:00 PM → Logout at 9:00 PM (duration-based)

## Testing

### Import Safety Test
```bash
cd backend
node test-import-safety.js
```

Verifies:
- ✓ Module imports without runtime execution
- ✓ No top-level side effects
- ✓ Function works correctly when called

### Shift Logic Test
```bash
cd backend
node test-shift-logic.js
```

Tests all shift scenarios:
- ✓ 10 AM shift with various check-in times
- ✓ 11 AM shift early check-in (< 10 AM)
- ✓ 11 AM shift on-time/late check-in (≥ 10 AM)
- ✓ Break extensions
- ✓ Boundary conditions

## Expected Results

### Production Stability
- ✓ App starts cleanly under Passenger
- ✓ No restart loops
- ✓ No import-time crashes
- ✓ Module is 100% safe to require()

### Functional Correctness
- ✓ Required Log Out calculated correctly for all shifts
- ✓ 10 AM employees always have 7:00 PM minimum
- ✓ 11 AM employees have flexible logout based on check-in
- ✓ Break extensions work correctly
- ✓ Integer minutes used (no floating-point issues)

## Backend Integration

The service is used by `dailyStatusService.js` and other services that need to calculate Required Log Out times. The function signature remains unchanged:

```javascript
const { calculateRequiredLogoutTime } = require('./services/requiredLogoutService');

const result = calculateRequiredLogoutTime({
    clockInTime: new Date(),
    totalPaidBreakMinutes: 30,
    totalUnpaidBreakMinutes: 0,
    shift: userShift,
    attendanceDate: '2026-02-09',
    timezone: 'Asia/Kolkata'
});

// result.requiredLogoutTime - Date object
// result.breakdown - detailed calculation breakdown
```

## Frontend Integration

The Employee Dashboard should:
1. **Receive** `requiredLogoutTime` from backend API
2. **Display** this value directly (no frontend calculations)
3. **Remove** any client-side Required Log Out logic
4. **Ensure** Admin and Employee views show identical times

## Deployment Checklist

- [x] Remove all top-level runtime execution
- [x] Implement lazy loading for moment-timezone
- [x] Preserve shift-specific logic (10 AM hard floor, 11 AM flexible)
- [x] Use integer minutes (avoid floating-point)
- [x] Test import safety
- [x] Test shift logic correctness
- [x] Verify no circular imports
- [x] Document changes

## Files Modified

1. `backend/services/requiredLogoutService.js` - Main fix
2. `backend/test-import-safety.js` - Import safety test (new)
3. `backend/test-shift-logic.js` - Shift logic test (new)
4. `backend/REQUIRED_LOGOUT_SERVICE_FIX.md` - This documentation (new)

## Maintenance Notes

### Adding New Shifts
To add a new shift type:
1. Define shift config in `backend/config/shiftPolicy.js`
2. Add shift-specific logic in `calculateRequiredLogoutTime()`
3. Add test cases in `test-shift-logic.js`
4. Verify import safety remains intact

### Debugging
If issues arise:
1. Check logs for `[requiredLogoutService]` prefix
2. Verify shift name matching (use `normalizeShiftName()`)
3. Confirm `attendanceDate` is in YYYY-MM-DD format
4. Ensure `clockInTime` is a valid Date object

### Performance
- Lazy loading adds negligible overhead (one-time initialization)
- moment-timezone is cached after first use
- No performance impact on subsequent calls
- Safe for high-frequency usage

## Success Criteria

✓ Production app starts without Passenger crashes
✓ requiredLogoutService.js is safe to import
✓ Required Log Out is correct for all shift scenarios
✓ 10 AM and 11 AM shifts behave per policy
✓ Employee Required Log Out is backend-driven
✓ No circular dependencies
✓ All tests pass
