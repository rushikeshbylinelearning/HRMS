// Complete internship/calculations endpoint with all fixes
// Replace the existing router.get('/internship/calculations', ...) in backend/routes/employees.js

/**
 * Helper function to calculate working days between two dates
 * Excludes: Sundays, alternate Saturdays (based on policy), Holidays
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
        
        // Skip Sundays
        if (dayOfWeek === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        // Skip alternate Saturdays based on policy
        if (dayOfWeek === 6) {
            if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
        }
        
        // Skip holidays
        if (holidayDatesSet.has(dateStr)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        // It's a working day
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
        
        // Skip Sundays
        if (dayOfWeek === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        // Skip alternate Saturdays based on policy
        if (dayOfWeek === 6) {
            if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
        }
        
        // Skip holidays
        if (holidayDatesSet.has(dateStr)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }
        
        // It's a working day - count it
        workingDaysCounted++;
        if (workingDaysCounted < workingDaysToAdd) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
    
    return currentDate;
}

router.get('/internship/calculations', [authenticateToken, isAdminOrHr], async (req, res) => {
    try {
        const internEmployees = await User.find({
            employmentStatus: 'Intern',
            isActive: true
        }).select('_id fullName employeeCode joiningDate internshipDurationMonths alternateSaturdayPolicy').lean();
        
        const calculations = [];
        const todayIST = getTodayIST();
        
        for (const employee of internEmployees) {
            try {
                if (!employee.joiningDate) {
                    calculations.push({
                        employeeId: employee._id,
                        employeeCode: employee.employeeCode,
                        fullName: employee.fullName,
                        error: 'Joining date not found'
                    });
                    continue;
                }
                
                const joiningDateIST = parseISTDate(employee.joiningDate);
                if (!joiningDateIST) {
                    calculations.push({
                        employeeId: employee._id,
                        employeeCode: employee.employeeCode,
                        fullName: employee.fullName,
                        error: 'Invalid joining date'
                    });
                    continue;
                }
                const joiningDateStr = formatDateIST(joiningDateIST);
                
                // If no duration specified, return with defaults
                if (!employee.internshipDurationMonths || employee.internshipDurationMonths <= 0) {
                    calculations.push({
                        employeeId: employee._id,
                        employeeCode: employee.employeeCode || 'N/A',
                        fullName: employee.fullName || 'N/A',
                        joiningDate: formatDateIST(joiningDateIST),
                        internshipDurationMonths: null,
                        fullDayLeave: 0,
                        halfDayLeave: 0,
                        leaveExtensionDays: 0,
                        absentDays: 0,
                        companyHolidays: 0,
                        internshipEndDate: null,
                        daysLeft: null,
                        status: 'Not Assigned'
                    });
                    continue;
                }
                
                const saturdayPolicy = employee.alternateSaturdayPolicy || 'All Saturdays Working';
                
                // Calculate base end date (calendar months from joining date)
                const baseEndDateCalendar = addMonthsIST(joiningDateIST, employee.internshipDurationMonths);
                if (!baseEndDateCalendar) {
                    calculations.push({
                        employeeId: employee._id,
                        employeeCode: employee.employeeCode,
                        fullName: employee.fullName,
                        error: 'Invalid base end date calculation'
                    });
                    continue;
                }
                
                // Get all holidays from joining date to a reasonable future date
                const futureDate = addDaysIST(baseEndDateCalendar, 60); // Add buffer for extensions
                const allHolidays = await Holiday.find({
                    date: {
                        $gte: joiningDateIST,
                        $lte: futureDate,
                        $ne: null
                    },
                    isTentative: { $ne: true }
                }).lean();
                
                // Calculate working days from joining to base end date (this is the internship duration in working days)
                const internshipWorkingDays = await calculateWorkingDaysBetween(joiningDateIST, baseEndDateCalendar, saturdayPolicy, allHolidays);
                
                // Count company holidays in the base period
                const holidayDatesSet = new Set();
                allHolidays.forEach(h => {
                    const holidayDate = parseISTDate(h.date);
                    if (holidayDate && holidayDate >= joiningDateIST && holidayDate <= baseEndDateCalendar) {
                        const dateStr = formatDateIST(holidayDate);
                        if (dateStr) holidayDatesSet.add(dateStr);
                    }
                });
                const companyHolidaysCount = holidayDatesSet.size;
                
                // Build holiday set for absence calculation
                const allHolidayDatesSet = new Set();
                allHolidays.forEach(h => {
                    const holidayDate = parseISTDate(h.date);
                    if (holidayDate) {
                        const dateStr = formatDateIST(holidayDate);
                        if (dateStr) allHolidayDatesSet.add(dateStr);
                    }
                });
                
                // Get all approved leaves from joining date
                const leaveRequests = await LeaveRequest.find({
                    employee: employee._id,
                    status: 'Approved',
                    leaveDates: {
                        $elemMatch: {
                            $gte: joiningDateIST
                        }
                    }
                }).lean();
                
                // Calculate leave counts (only from joining date)
                let fullDayLeaveCount = 0;
                let halfDayLeaveCount = 0;
                const leaveDatesSet = new Set();
                
                leaveRequests.forEach(leave => {
                    leave.leaveDates.forEach(leaveDate => {
                        const leaveDateObj = parseISTDate(leaveDate);
                        if (leaveDateObj && leaveDateObj >= joiningDateIST) {
                            const leaveDateStr = formatDateIST(leaveDateObj);
                            if (leaveDateStr && !leaveDatesSet.has(leaveDateStr)) {
                                leaveDatesSet.add(leaveDateStr);
                                if (leave.leaveType === 'Full Day') {
                                    fullDayLeaveCount++;
                                } else if (leave.leaveType && leave.leaveType.includes('Half Day')) {
                                    halfDayLeaveCount++;
                                }
                            }
                        }
                    });
                });
                
                // Calculate leave extension in days
                const leaveExtensionDays = fullDayLeaveCount + (halfDayLeaveCount * 0.5);
                
                // Get all attendance logs from joining date to today
                const attendanceLogs = await AttendanceLog.find({
                    user: employee._id,
                    attendanceDate: { $gte: joiningDateStr }
                }).lean();
                
                // Calculate absent days (only working days, excluding weekends and holidays)
                let absentFullDays = 0;
                let absentHalfDays = 0;
                const attendanceDatesSet = new Set();
                attendanceLogs.forEach(log => {
                    if (log.attendanceDate) attendanceDatesSet.add(log.attendanceDate);
                });
                
                // Count absences from joining date to today (only on working days)
                let currentDate = new Date(joiningDateIST);
                const maxDate = todayIST < baseEndDateCalendar ? todayIST : baseEndDateCalendar;
                while (currentDate <= maxDate) {
                    const dateStr = formatDateIST(currentDate);
                    if (!dateStr) break;
                    const dayOfWeek = currentDate.getDay();
                    
                    // Skip Sundays
                    if (dayOfWeek === 0) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }
                    
                    // Skip alternate Saturdays
                    if (dayOfWeek === 6) {
                        if (AntiExploitationLeaveService.isOffSaturday(currentDate, saturdayPolicy)) {
                            currentDate.setDate(currentDate.getDate() + 1);
                            continue;
                        }
                    }
                    
                    // Skip holidays
                    if (allHolidayDatesSet.has(dateStr)) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }
                    
                    // This is a working day - check if absent
                    if (!attendanceDatesSet.has(dateStr)) {
                        // No attendance log = absent
                        absentFullDays++;
                    } else {
                        // Check if attendance log indicates absence
                        const log = attendanceLogs.find(l => l.attendanceDate === dateStr);
                        if (log && (log.attendanceStatus === 'Absent' || (!log.clockInTime && !log.clockOutTime))) {
                            absentFullDays++;
                        } else if (log && (log.attendanceStatus === 'Half-day' || log.isHalfDay)) {
                            // Half-day could count as 0.5 absence
                            absentHalfDays += 0.5;
                        }
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                
                // Calculate internship end date
                // Formula: Joining Date + Internship Working Days + Leave Extension + Absent Extension
                const totalExtensionDays = leaveExtensionDays + absentFullDays + absentHalfDays;
                const totalWorkingDaysNeeded = internshipWorkingDays + Math.ceil(totalExtensionDays);
                
                // Calculate final end date by adding working days from joining date
                const internshipEndDate = await addWorkingDays(joiningDateIST, totalWorkingDaysNeeded, saturdayPolicy, allHolidays);
                
                // Calculate days left (remaining working days from today to end date)
                const daysLeft = await calculateWorkingDaysBetween(todayIST, internshipEndDate, saturdayPolicy, allHolidays);
                
                calculations.push({
                    employeeId: employee._id,
                    employeeCode: employee.employeeCode || 'N/A',
                    fullName: employee.fullName || 'N/A',
                    joiningDate: formatDateIST(joiningDateIST),
                    internshipDurationMonths: employee.internshipDurationMonths || null,
                    fullDayLeave: fullDayLeaveCount,
                    halfDayLeave: halfDayLeaveCount,
                    leaveExtensionDays: parseFloat(leaveExtensionDays.toFixed(1)),
                    absentDays: absentFullDays + absentHalfDays,
                    companyHolidays: companyHolidaysCount,
                    internshipEndDate: formatDateIST(internshipEndDate),
                    daysLeft: daysLeft !== null ? daysLeft : null,
                    status: daysLeft === null ? 'Not Assigned' : (daysLeft < 0 ? 'Completed' : (daysLeft <= 7 ? 'Critical' : (daysLeft <= 15 ? 'Warning' : 'On Track')))
                });
                
            } catch (empError) {
                console.error(`Error calculating for intern ${employee._id}:`, empError);
                calculations.push({
                    employeeId: employee._id,
                    employeeCode: employee.employeeCode,
                    fullName: employee.fullName,
                    error: empError.message
                });
            }
        }
        
        res.json({ calculations });
        
    } catch (error) {
        console.error('Error fetching internship calculations:', error);
        res.status(500).json({ error: 'Failed to fetch internship calculations' });
    }
});







