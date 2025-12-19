/**
 * Utility functions for checking Planned Leave eligibility and rules
 */

/**
 * Calculate leave duration from dates array and leave type
 */
export const calculateLeaveDuration = (startDate, endDate, leaveType) => {
    if (!startDate) return 0;
    
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(start);
    
    // Calculate days difference
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
    
    // Apply leave type multiplier
    const multiplier = leaveType && leaveType.startsWith('Half Day') ? 0.5 : 1;
    
    return diffDays * multiplier;
};

/**
 * Calculate days difference between today and a date
 */
export const calculateDaysDifference = (targetDate) => {
    if (!targetDate) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target - today;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
};

/**
 * Check if Planned Leave option should be disabled
 * Returns object with disabled status and tooltip message
 */
export const isPlannedLeaveDisabled = (user, plannedLeaveHistory = [], startDate, endDate, leaveType = 'Full Day') => {
    // If no user, default to disabled for safety
    if (!user) {
        return {
            disabled: true,
            tooltip: 'User information not available.'
        };
    }
    
    const employmentStatus = user?.employmentStatus;
    
    // Always disable for Probation employees
    if (employmentStatus === 'Probation') {
        return {
            disabled: true,
            tooltip: 'Planned Leave is not available during probation period.'
        };
    }
    
    // Always disable for Intern employees
    if (employmentStatus === 'Intern') {
        return {
            disabled: true,
            tooltip: 'Planned Leave is only available for permanent employees.'
        };
    }
    
    // IMPORTANT: If no start date is selected yet, allow selection for Permanent employees
    // This allows users to select Planned Leave first, then pick dates
    // Validation will happen when dates are selected or on form submit
    // Check for null, undefined, empty string, or invalid date
    const hasValidStartDate = startDate && startDate !== null && startDate !== '' && !isNaN(new Date(startDate).getTime());
    
    if (!hasValidStartDate) {
        // When no date is selected, DEFAULT TO ALLOWING SELECTION
        // This ensures the option is selectable when form first opens
        // Only disable if user is explicitly Probation or Intern (already checked above)
        // For all other cases (Permanent, undefined, or any other status), allow selection
        // Backend will validate the actual rules when request is submitted
        return {
            disabled: false,
            tooltip: null
        };
    }
    
    // Calculate leave duration
    const duration = calculateLeaveDuration(startDate, endDate, leaveType);
    
    // Get current year history
    const currentYear = new Date(startDate).getFullYear();
    const currentYearHistory = plannedLeaveHistory.filter(h => {
        const historyYear = new Date(h.appliedFrom).getFullYear();
        return historyYear === currentYear;
    });
    
    // Check 10+ days rule
    if (duration >= 10) {
        // Check if already used 10+ days PL this year
        const has10Plus = currentYearHistory.some(h => h.category === '10PLUS');
        if (has10Plus) {
            return {
                disabled: true,
                tooltip: '10+ day Planned Leave has already been availed this year. Only one 10+ day Planned Leave is allowed per calendar year.'
            };
        }
        
        // Check advance notice (60 days)
        const daysDiff = calculateDaysDifference(startDate);
        if (daysDiff !== null && daysDiff < 60) {
            const requiredDate = new Date();
            requiredDate.setDate(requiredDate.getDate() + 60);
            return {
                disabled: true,
                tooltip: `Planned Leave of 10+ days requires 60 days advance notice. You can apply for leaves starting from ${requiredDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`
            };
        }
    }
    
    // Check 5-7 days rule
    if (duration >= 5 && duration <= 7) {
        // Check if already used 2 times this year
        const fiveToSevenHistory = currentYearHistory.filter(h => h.category === '5TO7');
        if (fiveToSevenHistory.length >= 2) {
            return {
                disabled: true,
                tooltip: 'You have already availed two 5-7 day Planned Leaves this year. Maximum 2 allowed per year.'
            };
        }
        
        // Check 6-month gap if already used once
        if (fiveToSevenHistory.length === 1) {
            const previousPL = fiveToSevenHistory[0];
            const previousFromDate = new Date(previousPL.appliedFrom);
            const selectedDate = new Date(startDate);
            
            const monthsSincePrevious = (selectedDate.getFullYear() - previousFromDate.getFullYear()) * 12 + 
                                       (selectedDate.getMonth() - previousFromDate.getMonth());
            
            if (monthsSincePrevious < 6) {
                const nextAllowedDate = new Date(previousFromDate);
                nextAllowedDate.setMonth(nextAllowedDate.getMonth() + 6);
                return {
                    disabled: true,
                    tooltip: `You can apply for 5-7 day Planned Leave only after ${nextAllowedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. A minimum 6-month gap is required between two 5-7 day Planned Leaves.`
                };
            }
        }
        
        // Check advance notice (30 days)
        const daysDiff = calculateDaysDifference(startDate);
        if (daysDiff !== null && daysDiff < 30) {
            const requiredDate = new Date();
            requiredDate.setDate(requiredDate.getDate() + 30);
            return {
                disabled: true,
                tooltip: `Planned Leave of 5-7 days requires 30 days advance notice. You can apply for leaves starting from ${requiredDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`
            };
        }
    }
    
    // For less than 5 days, check 30 days advance notice
    if (duration < 5) {
        const daysDiff = calculateDaysDifference(startDate);
        if (daysDiff !== null && daysDiff < 30) {
            const requiredDate = new Date();
            requiredDate.setDate(requiredDate.getDate() + 30);
            return {
                disabled: true,
                tooltip: `Planned Leave requires 30 days advance notice. You can apply for leaves starting from ${requiredDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`
            };
        }
    }
    
    return {
        disabled: false,
        tooltip: null
    };
};

