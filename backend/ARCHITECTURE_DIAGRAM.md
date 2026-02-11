# Required Logout Service - Architecture Diagram

## Before Fix (UNSAFE - Caused Crashes)

```
┌─────────────────────────────────────────────────────────┐
│ Passenger Startup                                       │
│                                                         │
│  1. require('requiredLogoutService.js')                │
│     ↓                                                   │
│  2. const moment = require('moment-timezone')  ← CRASH │
│     ↓ (moment initializes at import time)              │
│  3. Fatal Error: Runtime execution during import       │
│                                                         │
│  Result: App never starts, restart loop                │
└─────────────────────────────────────────────────────────┘
```

## After Fix (SAFE - No Crashes)

```
┌─────────────────────────────────────────────────────────┐
│ Passenger Startup                                       │
│                                                         │
│  1. require('requiredLogoutService.js')                │
│     ↓                                                   │
│  2. Import config constants (pure references)  ✓       │
│     ↓                                                   │
│  3. Define getMoment() function (no execution) ✓       │
│     ↓                                                   │
│  4. Define calculateRequiredLogoutTime() (no exec) ✓   │
│     ↓                                                   │
│  5. Export function                            ✓       │
│                                                         │
│  Result: App starts successfully                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Runtime (When Function is Called)                      │
│                                                         │
│  1. calculateRequiredLogoutTime({ ... })               │
│     ↓                                                   │
│  2. getMoment() - lazy load moment-timezone   ✓       │
│     ↓                                                   │
│  3. Calculate duration-based logout           ✓       │
│     ↓                                                   │
│  4. Apply shift-specific boundaries           ✓       │
│     ↓                                                   │
│  5. Return { requiredLogoutTime, breakdown }  ✓       │
│                                                         │
│  Result: Correct logout time calculated                │
└─────────────────────────────────────────────────────────┘
```

## Module Loading Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    IMPORT TIME (Safe)                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ shiftPolicy.js                                     │    │
│  │ • SHIFT_TOTAL_MINUTES = 540                       │    │
│  │ • PAID_BREAK_ALLOWANCE_MINUTES = 30               │    │
│  │ • SHIFT_10AM_CONFIG = { ... }                     │    │
│  │ • SHIFT_11AM_CONFIG = { ... }                     │    │
│  │ • isShiftMatch() function                         │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ requiredLogoutService.js                           │    │
│  │ • Import constants from shiftPolicy.js            │    │
│  │ • let momentInstance = null                       │    │
│  │ • function getMoment() { ... }                    │    │
│  │ • function calculateRequiredLogoutTime() { ... }  │    │
│  │ • module.exports = { ... }                        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  NO EXECUTION - Just definitions                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   RUNTIME (When Called)                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ dailyStatusService.js                              │    │
│  │ • const result = calculateRequiredLogoutTime({    │    │
│  │     clockInTime,                                  │    │
│  │     totalPaidBreakMinutes,                        │    │
│  │     totalUnpaidBreakMinutes,                      │    │
│  │     shift,                                        │    │
│  │     attendanceDate                                │    │
│  │   })                                              │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ calculateRequiredLogoutTime()                      │    │
│  │ 1. const moment = getMoment()  ← Load here        │    │
│  │ 2. Validate inputs                                │    │
│  │ 3. Calculate excess breaks                        │    │
│  │ 4. Calculate duration-based logout                │    │
│  │ 5. Apply shift-specific boundaries                │    │
│  │ 6. Return result                                  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  EXECUTION HAPPENS - Safe and controlled                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Lazy Loading Pattern

```
┌─────────────────────────────────────────────────────────┐
│ Lazy Loading Pattern                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  let momentInstance = null;  ← Initially null          │
│                                                         │
│  function getMoment() {                                │
│    if (!momentInstance) {    ← Check if loaded        │
│      momentInstance = require('moment-timezone');      │
│    }                         ← Load only once          │
│    return momentInstance;    ← Return cached instance  │
│  }                                                      │
│                                                         │
│  Benefits:                                              │
│  • No import-time execution                            │
│  • Loaded only when needed                             │
│  • Cached after first use                              │
│  • Safe for Passenger                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Shift Logic Flow

```
┌─────────────────────────────────────────────────────────────┐
│ calculateRequiredLogoutTime()                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input: clockInTime, breaks, shift, attendanceDate         │
│    ↓                                                        │
│  Calculate excess breaks                                   │
│    excessMinutes = max(0, paidBreak - 30) + unpaidBreak   │
│    ↓                                                        │
│  Calculate duration-based logout                           │
│    durationLogout = clockIn + 540 min + excessMinutes     │
│    ↓                                                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Is 10 AM Shift?                                     │  │
│  │   YES → boundaryLogout = 7:00 PM                    │  │
│  │   NO  → Check if 11 AM Shift                        │  │
│  └─────────────────────────────────────────────────────┘  │
│    ↓                                                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Is 11 AM Shift?                                     │  │
│  │   YES → Check clock-in time                         │  │
│  │     • < 10 AM  → boundaryLogout = 7:00 PM          │  │
│  │     • ≥ 10 AM → boundaryLogout = null              │  │
│  │   NO  → boundaryLogout = null                       │  │
│  └─────────────────────────────────────────────────────┘  │
│    ↓                                                        │
│  Calculate final logout                                    │
│    requiredLogout = MAX(durationLogout, boundaryLogout)   │
│    ↓                                                        │
│  Return { requiredLogoutTime, breakdown }                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Principles

### ✓ SAFE (What We Did)
- Pure imports (no execution)
- Lazy loading (load on demand)
- Function definitions (no calls)
- Exports only (no side effects)

### ✗ UNSAFE (What We Avoided)
- Top-level require() with side effects
- Date calculations at import time
- Function calls outside functions
- Global state initialization

## Testing Strategy

```
┌─────────────────────────────────────────────────────────┐
│ Test 1: Import Safety                                  │
│ • Verify module can be imported without execution      │
│ • Check no side effects during require()               │
│ • Confirm function is exported correctly               │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ Test 2: Shift Logic                                    │
│ • Test 10 AM shift (hard 7 PM floor)                  │
│ • Test 11 AM shift early check-in (7 PM floor)        │
│ • Test 11 AM shift on-time/late (duration-based)      │
│ • Test break extensions                                │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│ Test 3: Integration                                    │
│ • Verify dailyStatusService.js works                   │
│ • Check API returns correct times                      │
│ • Confirm frontend displays correctly                  │
└─────────────────────────────────────────────────────────┘
```

---

**Key Takeaway**: Lazy loading ensures moment-timezone is only loaded when the function is called, not when the module is imported. This prevents Passenger crashes while maintaining all functionality.
