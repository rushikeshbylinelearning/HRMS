// frontend/src/components/MainLayout.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NewNotificationDrawer from './NewNotificationDrawer';
import NotificationPermissionPrompt from './NotificationPermissionPrompt';
import PageTransition from './PageTransition';
import useNewNotifications from '../hooks/useNewNotifications'; // Central notification hook
import '../styles/MainLayout.css';

const MainLayout = () => {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const location = useLocation();
    const mainContentRef = useRef(null);
    const scrollPositionsRef = useRef({});

    // Initialize the notification system for the entire layout.
    // This hook will manage the socket connection, fetch notifications,
    // and provide the unread count to child components (Topbar, Sidebar).
    useNewNotifications();

    // Preserve scroll position when navigating
    useEffect(() => {
        const currentPath = location.pathname;
        
        // Save scroll position before navigation
        return () => {
            if (mainContentRef.current) {
                scrollPositionsRef.current[currentPath] = mainContentRef.current.scrollTop;
            }
        };
    }, [location.pathname]);

    // Restore scroll position after navigation (only for back/forward)
    useEffect(() => {
        const savedPosition = scrollPositionsRef.current[location.pathname];
        if (savedPosition !== undefined && mainContentRef.current) {
            // Restore after a brief delay to ensure layout is complete
            requestAnimationFrame(() => {
                if (mainContentRef.current) {
                    mainContentRef.current.scrollTop = savedPosition;
                }
            });
        } else if (mainContentRef.current) {
            // New page - scroll to top smoothly
            mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [location.pathname]);

    const handleNotificationIconClick = () => {
        setIsDrawerOpen(true);
    };

    const handleDrawerClose = () => {
        setIsDrawerOpen(false);
    };

    const handleNotificationPermissionChange = (permission) => {
        console.log('Desktop notification permission changed to:', permission);
    };

    return (
        <div className="app-container">
            <Topbar onNotificationClick={handleNotificationIconClick} />
            <Sidebar onNotificationClick={handleNotificationIconClick} />
            
            <main className="main-content" ref={mainContentRef}>
                <PageTransition>
                <Outlet />
                </PageTransition>
            </main>
            
            <NewNotificationDrawer 
                open={isDrawerOpen} 
                onClose={handleDrawerClose}
            />
            
            <NotificationPermissionPrompt 
                onPermissionChange={handleNotificationPermissionChange}
            />
        </div>
    );
};

export default MainLayout;