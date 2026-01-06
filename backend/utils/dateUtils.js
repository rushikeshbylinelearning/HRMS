/**
 * Centralized IST (Asia/Kolkata) Date Utilities
 * 
 * This module provides safe date parsing, formatting, and manipulation functions
 * that enforce IST timezone. This prevents timezone conversion bugs where dates
 * are incorrectly shifted (e.g., 1 Sep showing as 31 Aug).
 * 
 * CRITICAL RULES:
 * - All dates are treated as IST (Asia/Kolkata, UTC+5:30)
 * - Date strings in YYYY-MM-DD format are parsed as IST midnight
 * - Never use new Date("YYYY-MM-DD") directly (parses as UTC)
 * - Never use toISOString() for date-only values (includes UTC time)
 */

/**
 * Parse a date string or Date object as IST midnight
 * @param {string|Date|null|undefined} dateInput - Date string (YYYY-MM-DD) or Date object
 * @returns {Date} Date object representing IST midnight of the given date
 * 
 * Examples:
 * - "2025-09-01" → Date representing 2025-09-01 00:00:00 IST
 * - new Date("2025-09-01") → Date representing 2025-09-01 00:00:00 IST (corrected)
 */
function parseISTDate(dateInput) {
    if (!dateInput) return null;
    
    let date;
    
    // If already a Date object, extract date parts
    if (dateInput instanceof Date) {
        // Use IST formatter to get correct date parts
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
        // Create date string and parse as IST
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
}

/**
 * Get today's date in IST (at midnight)
 * @returns {Date} Today's date at 00:00:00 IST
 */
function getTodayIST() {
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
}

/**
 * Format a date as YYYY-MM-DD string in IST
 * @param {Date|string|null|undefined} dateInput - Date to format
 * @returns {string|null} Date string in YYYY-MM-DD format, or null if invalid
 */
function formatDateIST(dateInput) {
    if (!dateInput) return null;
    
    const date = parseISTDate(dateInput);
    if (!date) return null;
    
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    return istFormatter.format(date);
}

/**
 * Format a date as readable string in IST
 * @param {Date|string|null|undefined} dateInput - Date to format
 * @param {object} options - Formatting options
 * @returns {string|null} Formatted date string, or null if invalid
 */
function formatDateReadableIST(dateInput, options = {}) {
    if (!dateInput) return null;
    
    const date = parseISTDate(dateInput);
    if (!date) return null;
    
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kolkata'
    };
    
    return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Add days to a date in IST
 * @param {Date|string} dateInput - Starting date
 * @param {number} days - Number of days to add (can be negative)
 * @returns {Date|null} New date object, or null if invalid
 */
function addDaysIST(dateInput, days) {
    const date = parseISTDate(dateInput);
    if (!date) return null;
    
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
}

/**
 * Add months to a date in IST
 * @param {Date|string} dateInput - Starting date
 * @param {number} months - Number of months to add (can be negative)
 * @returns {Date|null} New date object, or null if invalid
 */
function addMonthsIST(dateInput, months) {
    const date = parseISTDate(dateInput);
    if (!date) return null;
    
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + months);
    return newDate;
}

/**
 * Calculate days difference between two dates in IST
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {number|null} Number of days (date2 - date1), or null if invalid
 */
function daysDifferenceIST(date1, date2) {
    const d1 = parseISTDate(date1);
    const d2 = parseISTDate(date2);
    
    if (!d1 || !d2) return null;
    
    // Normalize to midnight for accurate day calculations
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    
    const diffTime = d2 - d1;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Compare two dates in IST
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
function compareDatesIST(date1, date2) {
    const d1 = parseISTDate(date1);
    const d2 = parseISTDate(date2);
    
    if (!d1 || !d2) return 0;
    
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    
    if (d1 < d2) return -1;
    if (d1 > d2) return 1;
    return 0;
}

/**
 * Check if a date is between two dates (inclusive) in IST
 * @param {Date|string} date - Date to check
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {boolean} True if date is between startDate and endDate (inclusive)
 */
function isDateBetweenIST(date, startDate, endDate) {
    const d = parseISTDate(date);
    const start = parseISTDate(startDate);
    const end = parseISTDate(endDate);
    
    if (!d || !start || !end) return false;
    
    d.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    return d >= start && d <= end;
}

/**
 * Get date parts (year, month, day) in IST
 * @param {Date|string} dateInput - Date to extract parts from
 * @returns {object|null} Object with year, month, day properties, or null if invalid
 */
function getDatePartsIST(dateInput) {
    const date = parseISTDate(dateInput);
    if (!date) return null;
    
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    const parts = istFormatter.formatToParts(date);
    return {
        year: parseInt(parts.find(p => p.type === 'year').value, 10),
        month: parseInt(parts.find(p => p.type === 'month').value, 10),
        day: parseInt(parts.find(p => p.type === 'day').value, 10)
    };
}

module.exports = {
    parseISTDate,
    getTodayIST,
    formatDateIST,
    formatDateReadableIST,
    addDaysIST,
    addMonthsIST,
    daysDifferenceIST,
    compareDatesIST,
    isDateBetweenIST,
    getDatePartsIST
};












