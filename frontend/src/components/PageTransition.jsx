// frontend/src/components/PageTransition.jsx
// Smooth page transitions for route changes

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

/**
 * Page Transition Wrapper
 * Provides fade + slide animation for page transitions
 */
const PageTransition = ({ children }) => {
    const location = useLocation();
    const [displayLocation, setDisplayLocation] = useState(location);
    const [transitionStage, setTransitionStage] = useState('enter');

    useEffect(() => {
        // Only animate if pathname actually changed
        if (location.pathname !== displayLocation.pathname) {
            setTransitionStage('exit');
        }
    }, [location, displayLocation]);

    useEffect(() => {
        if (transitionStage === 'exit') {
            // Delay updating location until exit animation starts
            const timer = setTimeout(() => {
                setDisplayLocation(location);
                setTransitionStage('enter');
            }, 150); // Half of transition duration
            
            return () => clearTimeout(timer);
        }
    }, [transitionStage, location]);

    return (
        <Box
            sx={{
                width: '100%',
                minHeight: '100%',
                opacity: transitionStage === 'enter' ? 1 : 0,
                transform: transitionStage === 'enter' 
                    ? 'translateY(0)' 
                    : 'translateY(10px)',
                transition: 'opacity 200ms ease-in-out, transform 200ms ease-in-out',
                willChange: transitionStage === 'exit' ? 'opacity, transform' : 'auto',
            }}
        >
            {children}
        </Box>
    );
};

export default PageTransition;















