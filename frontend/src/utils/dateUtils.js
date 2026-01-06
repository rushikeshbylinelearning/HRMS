/**
 * Frontend IST (Asia/Kolkata) Date Utilities
 * 
 * Prevents timezone conversion bugs by treating all dates as IST.
 * Critical: Never use new Date("YYYY-MM-DD") directly - it parses as UTC midnight,
 * which then converts to previous day in IST (e.g., "2025-09-01" → 31 Aug in IST).
 */

/**
 * Parse a date string as IST (treats YYYY-MM-DD as IST midnight)
 * @param {string|null|undefined} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date|null} Date object representing IST midnight, or null if invalid
 */
export function parseISTDate(dateStr) {
    if (!dateStr) return null;
    
    // If already a Date object, return as-is (assuming it's correct)
    if (dateStr instanceof Date) {
        return dateStr;
    }
    
    // Handle YYYY-MM-DD format - parse as IST midnight
    if (typeof dateStr === 'string') {
        // Check if it's already ISO format with timezone
        if (dateStr.includes('T')) {
            // ISO format - parse and create IST date
            const tempDate = new Date(dateStr);
            if (isNaN(tempDate.getTime())) return null;
            
            // Extract date parts in IST
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
            
            // Create date as IST midnight
            return new Date(`${year}-${month}-${day}T00:00:00+05:30`);
        } else {
            // YYYY-MM-DD format - parse as IST midnight directly
            // This is the critical fix: append IST timezone offset
            return new Date(`${dateStr}T00:00:00+05:30`);
        }
    }
    
    return null;
}

/**
 * Format a date as readable string in IST
 * @param {string|Date|null|undefined} dateInput - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string, or 'N/A' if invalid
 */
export function formatDateIST(dateInput, options = {}) {
    if (!dateInput) return 'N/A';
    
    const date = parseISTDate(dateInput);
    if (!date || isNaN(date.getTime())) return 'N/A';
    
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kolkata'
    };
    
    return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Format a date as YYYY-MM-DD string in IST
 * @param {string|Date|null|undefined} dateInput - Date to format
 * @returns {string|null} Date string in YYYY-MM-DD format, or null if invalid
 */
export function formatDateYYYYMMDD(dateInput) {
    if (!dateInput) return null;
    
    const date = parseISTDate(dateInput);
    if (!date || isNaN(date.getTime())) return null;
    
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    return istFormatter.format(date);
}

/**
 * Get today's date in IST (as YYYY-MM-DD string)
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function getTodayIST() {
    const now = new Date();
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return istFormatter.format(now);
}

/**
 * Calculate days difference between two dates in IST
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns {number|null} Number of days (date2 - date1), or null if invalid
 */
export function daysDifferenceIST(date1, date2) {
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
 * Normalize a date to YYYY-MM-DD format string in IST
 * Used for creating consistent date keys in maps and comparisons
 * @param {string|Date|null|undefined} dateInput - Date to normalize
 * @returns {string} Date string in YYYY-MM-DD format, or empty string if invalid
 */
export function normalizeDate(dateInput) {
    return formatDateYYYYMMDD(dateInput) || '';
}



