# Probation Calculation - Corrected Logic

## Summary
Fixed the probation tracker to correctly apply time-based vs elapsed-time policies when counting absences for probation extension.

## Probation Formula
**Base Probation Period:** Joining Date + 6 months

**Exclusions from base period:**
- Company holidays
- Alternate Saturdays (based on employee's Saturday policy)
- Sundays

**Extensions to probation:**
- Full-day leaves: +1 day per leave
- Half-day leaves: +0.5 days per leave
- Full-day absences: +1 day per absence
- Half-day absences: +0.5 days per absence

## Policy Transition Date: January 30, 2025

### Before January 30, 2025 (Time-based Attendance)
**Attendance was based on worked time (excluding breaks)**

- **Full day present:** Worked time >= 8 hours → No probation extension
- **Half-day absence:** Worked time < 8 hours → Extends probation by 0.5 days
- **Full-day absence:** No check-in → Extends probation by 1 day

### From January 30, 2025 onwards (Elapsed Shift Time)
**Attendance is based on elapsed shift time (clock-out - clock-in, includes breaks)**

- **Full day present:** Elapsed shift time >= 9 hours → No probation extension
- **Half-day absence:** Elapsed shift time 5-9 hours → Extends probation by 0.5 days
- **Full-day absence:** Elapsed shift time < 5 hours OR no check-in → Extends probation by 1 day

## What Was Fixed

### Previous Incorrect Logic
The system was NOT counting insufficient working hours as half-day absences for dates before Jan 30, 2025. This meant employees who worked < 8 hours were incorrectly treated as full day present for probation purposes.

### Corrected Logic
Now the system correctly applies:
- **Before Jan 30, 2025:** Worked time < 8 hours = half-day absence (extends probation)
- **From Jan 30, 2025:** Elapsed shift time < 9 hours = half-day absence (extends probation)

## Example Calculation

**Employee:** John Doe
**Joining Date:** 2024-08-01
**Base Probation End:** 2025-02-01 (6 months later)

**Period Analysis (Aug 1, 2024 - Feb 24, 2025):**
- Total calendar days: 177 days
- Company holidays: 15 days (excluded)
- Sundays: 25 days (excluded)
- Alternate Saturdays off: 12 days (excluded)
- Working days: 125 days

**Attendance during probation:**
- Present (full day): 100 days
- Half-day absences (< 8 hrs before Jan 30): 10 days
- Half-day absences (< 9 hrs after Jan 30): 5 days
- Full-day absences: 3 days
- Full-day leaves: 5 days
- Half-day leaves: 2 days

**Extension Calculation:**
- Leave extension: (5 × 1.0) + (2 × 0.5) = 6 days
- Absence extension: (3 × 1.0) + (10 × 0.5) + (5 × 0.5) = 10.5 days
- Total extension: 16.5 days

**Final Probation End Date:** 2025-02-01 + 16.5 days = 2025-02-17

## Files Modified
1. `backend/routes/probation.js` - Corrected policy application logic
2. `backend/docs/PROBATION_TRACKER_FIX.md` - Updated documentation
3. `backend/docs/PROBATION_TRACKER_UPDATE.md` - Updated policy description

## Testing Recommendations
1. Test employees who joined before Jan 30, 2025 with varying worked hours
2. Test employees who joined after Jan 30, 2025 with varying elapsed shift times
3. Verify that holidays, Sundays, and alternate Saturdays are properly excluded
4. Verify that approved leaves extend probation correctly
5. Verify that absences extend probation correctly
