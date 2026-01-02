/**
 * Date utility functions for consistent date handling across the application
 * All dates are normalized to YYYY-MM-DD format in local timezone (IST)
 */

/**
 * Normalize a date to YYYY-MM-DD string format
 * Handles Date objects, ISO strings, and date strings
 * Uses local timezone to avoid UTC conversion issues
 * 
 * @param {Date|string} date - Date to normalize
 * @returns {string} YYYY-MM-DD format string
 */
export const normalizeDate = (date) => {
    let dateObj;
    
    if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string') {
        // If it's already in YYYY-MM-DD format, return as-is
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return date;
        }
        // Otherwise parse as date
        dateObj = new Date(date);
    } else {
        dateObj = new Date(date);
    }
    
    // Use local timezone components to avoid UTC conversion
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

/**
 * Check if two dates are the same day (ignoring time)
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {boolean} True if same day
 */
export const isSameDay = (date1, date2) => {
    return normalizeDate(date1) === normalizeDate(date2);
};

/**
 * Check if a date string is in a leave's leaveDates array
 * Handles timezone issues by normalizing all dates
 * 
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {Object} leave - Leave object with leaveDates array
 * @returns {boolean} True if date is in leaveDates
 */
export const isDateInLeaveDates = (dateStr, leave) => {
    if (!leave || !leave.leaveDates || !Array.isArray(leave.leaveDates)) {
        return false;
    }
    
    const normalizedDateStr = normalizeDate(dateStr);
    
    return leave.leaveDates.some(leaveDateItem => {
        const leaveDateStr = normalizeDate(leaveDateItem);
        return leaveDateStr === normalizedDateStr;
    });
};

/**
 * Find a leave for a specific date from an array of leaves
 * Handles timezone issues and ensures only approved leaves are considered
 * 
 * @param {Date|string} date - Date to check
 * @param {Array} leaves - Array of leave objects
 * @returns {Object|null} Leave object if found, null otherwise
 */
export const findLeaveForDate = (date, leaves) => {
    if (!leaves || !Array.isArray(leaves)) {
        return null;
    }
    
    const dateStr = normalizeDate(date);
    
    return leaves.find(leave => {
        // Only consider approved leaves
        if (leave.status !== 'Approved') {
            return false;
        }
        
        // Check if date is in leaveDates
        return isDateInLeaveDates(dateStr, leave);
    }) || null;
};

/**
 * Find a holiday for a specific date from an array of holidays
 * 
 * @param {Date|string} date - Date to check
 * @param {Array} holidays - Array of holiday objects
 * @returns {Object|null} Holiday object if found, null otherwise
 */
export const findHolidayForDate = (date, holidays) => {
    if (!holidays || !Array.isArray(holidays)) {
        return null;
    }
    
    const dateStr = normalizeDate(date);
    
    return holidays.find(holiday => {
        // Skip tentative holidays
        if (!holiday.date || holiday.isTentative) {
            return false;
        }
        
        const holidayDateStr = normalizeDate(holiday.date);
        return holidayDateStr === dateStr;
    }) || null;
};

/**
 * Get today's date in IST (at midnight) as a Date object
 * @returns {Date} Today's date at 00:00:00 IST
 */
export const getTodayIST = () => {
    const now = new Date();
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = istFormatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return new Date(`${year}-${month}-${day}T00:00:00+05:30`);
};

/**
 * Format a date as YYYY-MM-DD string in IST timezone
 * @param {Date|string|null|undefined} dateInput - Date to format
 * @returns {string|null} Date string in YYYY-MM-DD format, or null if invalid
 */
export const formatDateYYYYMMDD = (dateInput) => {
    if (!dateInput) return null;
    
    let dateObj;
    
    if (dateInput instanceof Date) {
        dateObj = dateInput;
    } else if (typeof dateInput === 'string') {
        // If it's already in YYYY-MM-DD format, return as-is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return dateInput;
        }
        dateObj = new Date(dateInput);
    } else {
        dateObj = new Date(dateInput);
    }
    
    if (isNaN(dateObj.getTime())) {
        return null;
    }
    
    // Format using IST timezone to get correct date components
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    return istFormatter.format(dateObj);
};

/**
 * Parse a date string or Date object as IST midnight
 * @param {string|Date|null|undefined} dateInput - Date string (YYYY-MM-DD) or Date object
 * @returns {Date} Date object representing IST midnight of the given date
 */
export const parseISTDate = (dateInput) => {
    if (!dateInput) return null;
    
    let date;
    
    // If already a Date object, extract date parts in IST
    if (dateInput instanceof Date) {
        const istFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = istFormatter.formatToParts(dateInput);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        const dateStr = `${year}-${month}-${day}`;
        date = new Date(`${dateStr}T00:00:00+05:30`);
    } else if (typeof dateInput === 'string') {
        // Handle date strings (YYYY-MM-DD or ISO format)
        if (dateInput.includes('T')) {
            // ISO format - parse and extract date part in IST
            const tempDate = new Date(dateInput);
            const istFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const parts = istFormatter.formatToParts(tempDate);
            const year = parts.find(p => p.type === 'year').value;
            const month = parts.find(p => p.type === 'month').value;
            const day = parts.find(p => p.type === 'day').value;
            date = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
        } else {
            // YYYY-MM-DD format - parse as IST midnight
            date = new Date(`${dateInput}T00:00:00+05:30`);
        }
    } else {
        return null;
    }
    
    // Validate
    if (isNaN(date.getTime())) {
        console.warn('[dateUtils] Invalid date input:', dateInput);
        return null;
    }
    
    return date;
};

/**
 * Format a date using IST timezone for display
 * Formats dates as readable strings (e.g., "Jan 15, 2025")
 * Handles timezone issues by using IST explicitly
 * 
 * @param {Date|string|null|undefined} dateInput - Date to format
 * @returns {string} Formatted date string or 'N/A' if invalid
 */
export const formatDateIST = (dateInput) => {
    if (!dateInput) return 'N/A';
    
    let dateObj;
    
    if (dateInput instanceof Date) {
        dateObj = dateInput;
    } else if (typeof dateInput === 'string') {
        // If it's already in YYYY-MM-DD format, parse it as IST date
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            const [year, month, day] = dateInput.split('-').map(Number);
            // Create date in IST timezone (UTC+5:30)
            dateObj = new Date(Date.UTC(year, month - 1, day, 5, 30, 0));
        } else {
            dateObj = new Date(dateInput);
        }
    } else {
        dateObj = new Date(dateInput);
    }
    
    if (isNaN(dateObj.getTime())) {
        return 'N/A';
    }
    
    // Format using IST timezone explicitly
    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kolkata'
    });
};
