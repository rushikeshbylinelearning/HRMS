# Probation Tracker - Quick Reference

## Formula
```
Final Probation End Date = Joining Date + 6 months + Extensions
```

## What's Excluded from Base 6 Months?
✅ Company holidays
✅ Sundays
✅ Alternate Saturdays (based on employee policy)

## What Extends Probation?
❌ Full-day leaves (+1 day each)
❌ Half-day leaves (+0.5 days each)
❌ Full-day absences (+1 day each)
❌ Half-day absences (+0.5 days each)

## Policy Transition: January 30, 2025

### Before Jan 30, 2025 (Time-based)
| Worked Time | Status | Probation Impact |
|-------------|--------|------------------|
| >= 8 hours | Full day present | No extension |
| < 8 hours | Half-day absence | +0.5 days |
| No check-in | Full-day absence | +1 day |

### From Jan 30, 2025 (Elapsed Shift Time)
| Elapsed Shift Time | Status | Probation Impact |
|-------------------|--------|------------------|
| >= 9 hours | Full day present | No extension |
| 5-9 hours | Half-day absence | +0.5 days |
| < 5 hours | Full-day absence | +1 day |
| No check-in | Full-day absence | +1 day |

## Key Points
1. **Holidays, Sundays, and alternate Saturdays do NOT count** toward the base 6-month period
2. **Approved leaves extend probation** (both full-day and half-day)
3. **Absences extend probation** (both full-day and half-day)
4. **Policy changed on Jan 30, 2025** from worked time to elapsed shift time
5. **Before Jan 30:** Worked time < 8 hrs = half-day absence
6. **From Jan 30:** Elapsed shift time < 9 hrs = half-day absence

## API Endpoint
```
GET /api/probation/tracker
```

**Response includes:**
- Employee details
- Base probation end date (joining + 6 months)
- Leave counts and extension days
- Absence counts and extension days
- Final probation end date
- Days left until probation ends

## Cache
- Cache TTL: 10 minutes
- Cache invalidation: Automatic on leave approval or attendance correction
- Manual refresh: Available in frontend
