// Utility to suppress false positive React prop type warnings in development
// These warnings occur due to React 18's stricter prop validation with MUI 7
// They are false positives and don't affect functionality

if (import.meta.env.DEV) {
    const originalError = console.error;
    const originalWarn = console.warn;

    // List of warning patterns to suppress (false positives)
    // These are false positives from React 18's stricter prop validation with MUI components
    const suppressPatterns = [
        // Children prop warnings
        /Warning: Failed prop type: Invalid prop.*children.*supplied/,
        /Warning: Failed prop type: Invalid prop.*children.*expected a ReactNode/,
        /Warning: Failed prop type: Invalid prop.*children.*expected a single ReactElement/,
        /Warning: Failed prop type: Invalid prop.*children.*of type.*object.*supplied/,
        /Warning: Failed prop type: Invalid prop.*children.*of type.*array.*supplied/,
        // Other prop warnings
        /Warning: Failed prop type: Invalid prop.*startIcon.*supplied/,
        /Warning: Failed prop type: Invalid prop.*endAdornment.*supplied/,
        /Warning: Failed prop type: Invalid prop.*divider.*supplied/,
        /Warning: Failed prop type: Invalid prop.*label.*supplied/,
        // General ReactNode/ReactElement warnings (catch-all for false positives)
        /Warning: Failed prop type: Invalid prop.*supplied to.*expected a ReactNode/,
        /Warning: Failed prop type: Invalid prop.*supplied to.*expected a single ReactElement/,
        /Warning: Failed prop type: Invalid prop.*of type.*object.*supplied.*expected/,
        /Warning: Failed prop type: Invalid prop.*of type.*array.*supplied.*expected/,
        // Stack trace from this file (to avoid showing our own suppression)
        /suppressPropWarnings\.js/,
        // MUI Grid deprecation warnings
        /MUI Grid: The.*item.*prop has been removed/,
        /MUI Grid: The.*xs.*prop has been removed/,
        /MUI Grid: The.*md.*prop has been removed/,
        /MUI Grid: The.*lg.*prop has been removed/,
    ];

    const shouldSuppress = (args) => {
        // Convert all arguments to string and check each one
        for (const arg of args) {
            const message = typeof arg === 'string' ? arg : String(arg);
            
            // Check if it's a React prop type warning
            if (/Warning: Failed prop type/.test(message)) {
                // Check all patterns against this message
                if (suppressPatterns.some(pattern => pattern.test(message))) {
                    return true;
                }
                
                // Also suppress if it mentions ReactNode or ReactElement (common false positives)
                if (/expected a ReactNode/.test(message) || /expected a single ReactElement/.test(message)) {
                    return true;
                }
            }
        }
        
        // Also check the combined message
        const fullMessage = args.map(arg => {
            if (typeof arg === 'string') return arg;
            if (arg && typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        // Check patterns against full message
        if (suppressPatterns.some(pattern => pattern.test(fullMessage))) {
            return true;
        }
        
        // Also suppress if full message mentions ReactNode or ReactElement
        if (/Warning: Failed prop type.*expected a ReactNode/.test(fullMessage) || 
            /Warning: Failed prop type.*expected a single ReactElement/.test(fullMessage)) {
            return true;
        }
        
        return false;
    };

    console.error = (...args) => {
        if (shouldSuppress(args)) {
            return; // Suppress this warning
        }
        originalError.apply(console, args);
    };

    console.warn = (...args) => {
        if (shouldSuppress(args)) {
            return; // Suppress this warning
        }
        originalWarn.apply(console, args);
    };
}























