# Internship Tracker Fix - Implementation Guide

## Summary
The internship tracker endpoint needs to be updated to include:
1. Working days calculation (excluding Sundays, alternate Saturdays, holidays)
2. Leave extensions (full-day + half-day leaves)
3. Absent day extensions
4. Proper end date calculation based on working days

## Key Changes Needed

### 1. Add Helper Functions
Add these helper functions before the `/internship/calculations` route:

```javascript
/**
 * Helper function to calculate working days between two dates
 */
async function calculateWorkingDaysBetween(startDate, endDate, saturdayPolicy, holidays) {
    const holidayDatesSet = new Set();
    holidays.forEach(h => {
        const holidayDate = parseISTDate(h.date);
        if (holidayDate) {
            const dateStr = formatDateIST(holidayDate);
            if (dateStr) holidayDatesSet.add(dateStr);
        }
    });
    
    let workingDaysCount = 0;
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    while (currentDate <= endDateObj) {
        const dateStr = formatDateIST(currentDate);
        if (!dateStr) break;
        const dayOfWeek = currentDate.getDay();
        
        if (dayOfWeek === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        if (dayOfWeek === 6) {
            if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
        }
        
        if (holidayDatesSet.has(dateStr)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        workingDaysCount++;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDaysCount;
}

/**
 * Helper function to add working days to a start date
 */
async function addWorkingDays(startDate, workingDaysToAdd, saturdayPolicy, holidays) {
    const holidayDatesSet = new Set();
    holidays.forEach(h => {
        const holidayDate = parseISTDate(h.date);
        if (holidayDate) {
            const dateStr = formatDateIST(holidayDate);
            if (dateStr) holidayDatesSet.add(dateStr);
        }
    });
    
    let currentDate = new Date(startDate);
    let workingDaysCounted = 0;
    const maxIterations = 365 * 5;
    let iterations = 0;
    
    while (workingDaysCounted < workingDaysToAdd && iterations < maxIterations) {
        iterations++;
        const dateStr = formatDateIST(currentDate);
        if (!dateStr) break;
        const dayOfWeek = currentDate.getDay();
        
        if (dayOfWeek === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        if (dayOfWeek === 6) {
            if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
        }
        
        if (holidayDatesSet.has(dateStr)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        workingDaysCounted++;
        if (workingDaysCounted < workingDaysToAdd) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
    
    return currentDate;
}
```

### 2. Update `/internship/calculations` Route
The route needs to:
1. Fetch `alternateSaturdayPolicy` for interns
2. Calculate working days in the base period
3. Count leaves and absences
4. Calculate end date using working days
5. Return all required fields

## Implementation Notes

1. **Working Days Logic**: Internship duration is stored as months, but calculations should use working days
2. **Leave Extensions**: Full-day = +1, Half-day = +0.5
3. **Absent Extensions**: Full-day absent = +1, Half-day absent = +0.5
4. **End Date**: Joining Date + (Base Working Days) + (Leave Extensions) + (Absent Extensions) = Final End Date

## Response Format

The endpoint should return:
```javascript
{
  calculations: [{
    employeeId: string,
    employeeCode: string,
    fullName: string,
    joiningDate: string, // YYYY-MM-DD
    internshipDurationMonths: number,
    fullDayLeave: number,
    halfDayLeave: number,
    leaveExtensionDays: number, // decimal
    absentDays: number, // decimal
    companyHolidays: number,
    internshipEndDate: string, // YYYY-MM-DD
    daysLeft: number, // working days
    status: string // 'On Track' | 'Warning' | 'Critical' | 'Completed' | 'Not Assigned'
  }]
}
```







