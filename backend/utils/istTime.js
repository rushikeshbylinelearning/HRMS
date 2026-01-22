/**
 * CENTRAL IST TIME UTILITY
 * 
 * SINGLE SOURCE OF TRUTH for all timezone operations.
 * All business logic MUST use these functions.
 * 
 * Rules:
 * - IST (Asia/Kolkata) is the ONLY timezone for business logic
 * - UTC is ONLY used as MongoDB storage format
 * - NO browser timezone
 * - NO server OS timezone
 */

/**
 * Get current date/time in IST
 * @returns {Date} Date object representing current time in IST
 */
const getISTNow = () => {
    // Get current UTC time
    const now = new Date();
    
    // Convert to IST using Intl.DateTimeFormat
    // This ensures we get the correct IST time regardless of server timezone
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const parts = istFormatter.formatToParts(now);
    const partsMap = {};
    parts.forEach(part => {
        partsMap[part.type] = part.value;
    });
    
    // Create Date object in IST (using UTC constructor with IST values)
    // Format: YYYY-MM-DDTHH:mm:ss+05:30
    const istISOString = `${partsMap.year}-${partsMap.month}-${partsMap.day}T${partsMap.hour}:${partsMap.minute}:${partsMap.second}+05:30`;
    return new Date(istISOString);
};

/**
 * Get current date as YYYY-MM-DD string in IST
 * This is the ONLY way to generate attendanceDate
 * @returns {string} Date string in YYYY-MM-DD format (IST)
 */
const getISTDateString = (date = null) => {
    const targetDate = date || getISTNow();
    
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    const parts = istFormatter.formatToParts(targetDate);
    const partsMap = {};
    parts.forEach(part => {
        partsMap[part.type] = part.value;
    });
    
    return `${partsMap.year}-${partsMap.month}-${partsMap.day}`;
};

/**
 * Parse a YYYY-MM-DD date string as IST date
 * This safely parses date strings as IST, avoiding UTC parsing issues
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} Date object representing IST midnight of that date
 */
const parseISTDate = (dateString) => {
    if (!dateString) {
        throw new Error('Date string is required');
    }
    
    // If already a Date object, return as is (assume it's already in correct timezone context)
    if (dateString instanceof Date) {
        return dateString;
    }
    
    // Parse YYYY-MM-DD as IST midnight
    if (typeof dateString === 'string') {
        // Handle ISO datetime strings
        if (dateString.includes('T')) {
            // Already has timezone info, parse directly
            return new Date(dateString);
        }
        
        // Handle YYYY-MM-DD format - parse as IST midnight
        const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
            const [, year, month, day] = dateMatch;
            // Create IST midnight: YYYY-MM-DDTHH:mm:ss+05:30
            const istISOString = `${year}-${month}-${day}T00:00:00+05:30`;
            return new Date(istISOString);
        }
        
        // Fallback: try standard Date parsing
        return new Date(dateString);
    }
    
    throw new Error(`Invalid date string format: ${dateString}`);
};

/**
 * Get start of day (00:00:00) in IST for a given date
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @returns {Date} Date object representing IST midnight
 */
const startOfISTDay = (date = null) => {
    const targetDate = date ? (typeof date === 'string' ? parseISTDate(date) : date) : getISTNow();
    const dateString = getISTDateString(targetDate);
    return parseISTDate(dateString);
};

/**
 * Get end of day (23:59:59.999) in IST for a given date
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @returns {Date} Date object representing IST end of day
 */
const endOfISTDay = (date = null) => {
    const dateString = getISTDateString(date);
    const [year, month, day] = dateString.split('-');
    // Create IST end of day: YYYY-MM-DDTHH:mm:ss.sss+05:30
    const istISOString = `${year}-${month}-${day}T23:59:59.999+05:30`;
    return new Date(istISOString);
};

/**
 * Convert a Date object to IST time string for display
 * @param {Date} date - Date object (assumed to be in correct timezone context)
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted time string in IST
 */
const formatISTTime = (date, options = { hour12: true, hour: '2-digit', minute: '2-digit' }) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        ...options
    });
};

/**
 * Convert a Date object to IST date string for display
 * @param {Date} date - Date object
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string in IST
 */
const formatISTDate = (date, options = { day: '2-digit', month: 'short', year: 'numeric' }) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        ...options
    });
};

/**
 * Get shift date/time in IST
 * Helper for shift start/end time calculations
 * @param {Date|string} onDate - Date object or YYYY-MM-DD string
 * @param {string} shiftTime - Time string in HH:MM format
 * @returns {Date} Date object representing shift time in IST
 */
const getShiftDateTimeIST = (onDate, shiftTime) => {
    const [hours, minutes] = shiftTime.split(':').map(Number);
    const targetDate = onDate ? (typeof onDate === 'string' ? parseISTDate(onDate) : onDate) : getISTNow();
    
    const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    const parts = istDateFormatter.formatToParts(targetDate);
    const partsMap = {};
    parts.forEach(part => {
        partsMap[part.type] = part.value;
    });
    
    const shiftDateTimeISO_IST = `${partsMap.year}-${partsMap.month}-${partsMap.day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000+05:30`;
    return new Date(shiftDateTimeISO_IST);
};

/**
 * Check if two dates are on the same IST day
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {boolean} True if both dates are on the same IST day
 */
const isSameISTDay = (date1, date2) => {
    const d1 = typeof date1 === 'string' ? parseISTDate(date1) : date1;
    const d2 = typeof date2 === 'string' ? parseISTDate(date2) : date2;
    return getISTDateString(d1) === getISTDateString(d2);
};

/**
 * Get IST date parts (year, month, day) from a date
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @returns {object} Object with year, month, day, monthIndex (0-based)
 */
const getISTDateParts = (date = null) => {
    const targetDate = date ? (typeof date === 'string' ? parseISTDate(date) : date) : getISTNow();
    const dateString = getISTDateString(targetDate);
    const [year, month, day] = dateString.split('-').map(Number);
    return {
        year,
        month, // 1-based month (1-12)
        monthIndex: month - 1, // 0-based month (0-11)
        day
    };
};

module.exports = {
    getISTNow,
    getISTDateString,
    parseISTDate,
    startOfISTDay,
    endOfISTDay,
    formatISTTime,
    formatISTDate,
    getShiftDateTimeIST,
    isSameISTDay,
    getISTDateParts
};



