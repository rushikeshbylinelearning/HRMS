# Employee Ranking in Analytics Page

**Date**: February 20, 2026  
**Location**: `backend/services/AnalyticsService.js` (Lines 148-159)

---

## How Employees Are Ranked

The analytics page ranks employees using a **two-tier sorting system**:

### Primary Sort: Attendance Percentage (Descending)
Employees are first sorted by their **attendance percentage** from highest to lowest.

### Secondary Sort: Average Working Hours (Descending)
If two or more employees have the **same attendance percentage**, they are then sorted by their **average working hours** from highest to lowest.

---

## Ranking Algorithm

```javascript
// Sort by attendance percentage DESC, then by avg working hours DESC
employeeMetrics.sort((a, b) => {
    // Primary sort: Attendance percentage (higher is better)
    if (b.attendancePercentage !== a.attendancePercentage) {
        return b.attendancePercentage - a.attendancePercentage;
    }
    // Secondary sort: Average working hours (higher is better)
    return b.avgWorkingHours - a.avgWorkingHours;
});

// Add rank to each employee
employeeMetrics.forEach((emp, index) => {
    emp.rank = index + 1;
});
```

---

## Ranking Examples

### Example 1: Different Attendance Percentages

| Rank | Employee | Attendance % | Avg Working Hours | Explanation |
|------|----------|--------------|-------------------|-------------|
| 1 | Alice | 98.5% | 8.2 hrs | Highest attendance % |
| 2 | Bob | 95.0% | 9.5 hrs | Second highest attendance % (even though more hours than Alice) |
| 3 | Charlie | 92.0% | 8.0 hrs | Third highest attendance % |

**Key Point**: Bob has more working hours than Alice (9.5 vs 8.2), but Alice ranks higher because attendance percentage is the primary criterion.

---

### Example 2: Same Attendance Percentage (Tie-Breaker)

| Rank | Employee | Attendance % | Avg Working Hours | Explanation |
|------|----------|--------------|-------------------|-------------|
| 1 | David | 95.0% | 9.2 hrs | Same attendance %, but more working hours |
| 2 | Emma | 95.0% | 8.5 hrs | Same attendance %, but fewer working hours |
| 3 | Frank | 95.0% | 8.0 hrs | Same attendance %, but fewest working hours |

**Key Point**: When attendance percentages are identical, average working hours becomes the deciding factor.

---

### Example 3: Mixed Scenario

| Rank | Employee | Attendance % | Avg Working Hours | Explanation |
|------|----------|--------------|-------------------|-------------|
| 1 | Grace | 100.0% | 7.5 hrs | Perfect attendance (highest %) |
| 2 | Henry | 98.0% | 9.5 hrs | Second highest attendance % |
| 3 | Ivy | 98.0% | 9.0 hrs | Same attendance % as Henry, but fewer hours |
| 4 | Jack | 98.0% | 8.5 hrs | Same attendance % as Henry & Ivy, but fewest hours |
| 5 | Kate | 95.0% | 10.0 hrs | Lower attendance % (even with most working hours) |

**Key Point**: Kate works the most hours (10.0) but ranks 5th because her attendance percentage (95%) is lower than others.

---

## Metrics Used in Ranking

### 1. Attendance Percentage (Primary)
**Formula**: `(Present Days / Total Days) × 100`

Where:
- **Present Days** = Days marked as "On-time", "Late", or "Half-day"
- **Total Days** = Present Days + Leave Days + Absent Days
- **Excludes**: Holidays, Weekly Offs, Weekends (non-working days)

**Example Calculation**:
```
Present Days: 20
Leave Days: 2
Absent Days: 1
Total Days: 20 + 2 + 1 = 23

Attendance % = (20 / 23) × 100 = 86.96%
```

### 2. Average Working Hours (Secondary)
**Formula**: `Total Net Hours / (Present Days - 1)`

Where:
- **Total Net Hours** = Sum of all working hours on present days
- **Present Days - 1** = Excludes the first day to avoid skewing the average

**Example Calculation**:
```
Total Net Hours: 160 hours
Present Days: 20

Average Working Hours = 160 / (20 - 1) = 160 / 19 = 8.42 hours
```

**Note**: The `-1` adjustment is to account for the first day which might be a partial day or have different hours.

---

## Why This Ranking System?

### Rationale

1. **Attendance First**: Regular presence is valued more than hours worked
   - Consistent attendance shows reliability and commitment
   - Missing days impacts team productivity more than shorter hours

2. **Hours as Tie-Breaker**: When attendance is equal, productivity matters
   - Differentiates between employees with same attendance
   - Rewards those who put in more effort when present

3. **Fair Comparison**: Excludes non-working days
   - Holidays, weekly offs don't penalize employees
   - Only counts days when work was expected

---

## Special Cases

### Half-Day Handling
- **Half-days count as 1 full present day** for attendance percentage
- But the actual hours worked are used for average working hours
- This means a half-day (4 hours) counts as "present" but lowers average hours

**Example**:
```
Employee with 20 days:
- 18 full days (9 hours each) = 162 hours
- 2 half days (4 hours each) = 8 hours
- Total: 20 present days, 170 hours

Attendance %: (20 / 20) × 100 = 100%
Avg Hours: 170 / 19 = 8.95 hours
```

### Late Arrivals
- **Late arrivals count as present days** (not penalized in attendance %)
- Hours worked are still counted normally
- This means being late doesn't hurt attendance percentage, only punctuality metrics

### Overtime
- Overtime hours are included in total working hours
- Can boost average working hours and improve tie-breaker ranking
- But doesn't affect attendance percentage

---

## Ranking Display

The rank is added to each employee's metrics and displayed in the analytics table:

```javascript
{
    rank: 1,
    employeeId: "...",
    employeeName: "Alice Johnson",
    employeeCode: "EMP001",
    attendancePercentage: 98.5,
    avgWorkingHours: 8.2,
    presentDays: 20,
    leaveDays: 0,
    absentDays: 0,
    // ... other metrics
}
```

---

## Frontend Display

The analytics table typically shows:

| Rank | Employee | Code | Attendance % | Avg Hours | Present | Leave | Absent |
|------|----------|------|--------------|-----------|---------|-------|--------|
| 1 | Alice Johnson | EMP001 | 98.5% | 8.2 | 20 | 0 | 0 |
| 2 | Bob Smith | EMP002 | 95.0% | 9.5 | 19 | 1 | 0 |
| 3 | Charlie Brown | EMP003 | 92.0% | 8.0 | 18 | 0 | 2 |

---

## Potential Improvements

### Current System Limitations

1. **No Punctuality Factor**: Late arrivals don't affect ranking
2. **No Quality Metrics**: Only quantity (days/hours), not quality of work
3. **No Overtime Distinction**: Overtime and regular hours treated equally
4. **Simple Tie-Breaker**: Only uses hours, could consider other factors

### Possible Enhancements

1. **Add Punctuality Score**:
   ```javascript
   // Tertiary sort by punctuality (fewer late days = better)
   if (a.avgWorkingHours === b.avgWorkingHours) {
       return a.lateDays - b.lateDays;
   }
   ```

2. **Weighted Scoring System**:
   ```javascript
   // Combined score: 70% attendance + 20% hours + 10% punctuality
   const score = (attendance * 0.7) + (hours * 0.2) + (punctuality * 0.1);
   ```

3. **Department-Relative Ranking**:
   - Rank within department first
   - Then overall ranking

4. **Time-Weighted Attendance**:
   - Recent attendance weighted more than older data
   - Rewards improvement over time

---

## Summary

**Current Ranking Logic**:
1. **Primary**: Attendance Percentage (higher is better) ⬆️
2. **Secondary**: Average Working Hours (higher is better) ⬆️
3. **Result**: Rank 1 = Best attendance, Rank N = Lowest attendance

**Philosophy**: "Show up consistently first, work hard second"

This ranking system prioritizes **reliability** (attendance) over **productivity** (hours), which is appropriate for most organizations where consistent presence is valued.

---

**Documentation Date**: February 20, 2026  
**Code Location**: `backend/services/AnalyticsService.js:148-159`  
**Status**: Current Implementation
