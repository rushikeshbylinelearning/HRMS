// frontend/src/components/Sidebar.jsx

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

// Importing icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import AssessmentIcon from '@mui/icons-material/Assessment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Badge from '@mui/material/Badge';
import useNewNotifications from '../hooks/useNewNotifications';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AnalyticsIcon from '@mui/icons-material/Analytics';

import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import './Sidebar.css';

const Logo = () => (
    <img src="/BL.svg" alt="Company Logo" style={{ height: '40px' }} />
);

// Updated to accept notification props
const Sidebar = ({ onNotificationClick }) => {
    const { user } = useAuth();
    const { unreadCount } = useNewNotifications();
    const { canAccess, rolePermissions } = usePermissions();

    const menuItems = [
        { text: 'Home', icon: <DashboardIcon />, path: '/dashboard', roles: ['Employee', 'Intern', 'HR', 'Admin'] },
        { 
            text: 'Summary', 
            icon: <AssessmentIcon />, 
            path: (user && ['Admin', 'HR'].includes(user.role)) ? '/admin/attendance-summary' : '/attendance-summary',
            roles: ['Employee', 'Intern', 'HR', 'Admin'] 
        },
        { text: 'Employees', icon: <PeopleIcon />, path: '/employees', roles: ['HR', 'Admin'] },
        { text: 'Shift Management', icon: <TimelapseIcon />, path: '/shifts', roles: ['Admin'] },
        { text: 'Office Locations', icon: <LocationOnIcon />, path: '/office-locations', roles: ['Admin'] },
        { text: 'Manage Section', icon: <AdminPanelSettingsIcon />, path: '/manage-section', roles: ['Admin'] },
        { 
            text: 'Leaves', 
            icon: <EventNoteIcon />, 
            path: (user && ['Admin', 'HR'].includes(user.role)) ? '/admin/leaves' : '/leaves', 
            roles: ['Employee', 'Intern', 'HR', 'Admin'],
            permissionCheck: () => canAccess.leaves()
        },
        { 
            text: 'Reports', 
            icon: <AdminPanelSettingsIcon />, 
            path: '/reports', 
            roles: ['Admin', 'HR'],
            permissionCheck: () => canAccess.viewReports()
        },
        { 
            text: 'Analytics', 
            icon: <AnalyticsIcon />, 
            path: '/analytics', 
            roles: ['Employee', 'Intern', 'HR', 'Admin'],
            permissionCheck: () => canAccess.viewAnalytics()
        },
        { text: 'Activity Log', icon: <AssessmentIcon />, path: '/activity-log', roles: ['Admin', 'HR', 'Manager'] },
    ];
    
    // Notification item config for all users
    const notificationItem = {
        text: 'Notifications',
        icon: <NotificationsIcon />,
        roles: ['Employee', 'Intern', 'HR', 'Admin', 'Manager']
    };

    if (!user) {
        return <aside className="sidebar"></aside>;
    }

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <Logo />
            </div>

            <nav className="sidebar-nav">
                {menuItems.filter(item => {
                    // Check role-based access
                    if (!item.roles.includes(user.role)) return false;
                    
                    // Check permission-based access if permissionCheck is defined
                    if (item.permissionCheck && !item.permissionCheck()) return false;
                    
                    return true;
                }).map((item) => (
                    <NavLink
                        key={item.text}
                        to={typeof item.path === 'function' ? item.path(user) : item.path}
                        className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                        data-tooltip={item.text}
                    >
                        <div className="icon-container">
                            {item.icon}
                        </div>
                        <span className="sidebar-label">{item.text}</span>
                    </NavLink>
                ))}
            </nav>

            {/* --- Renders Notification Bell at the bottom for Employees --- */}
            {notificationItem.roles.includes(user.role) && (
                <div className="sidebar-footer">
                     <div
                        className="sidebar-link"
                        data-tooltip={notificationItem.text}
                        onClick={onNotificationClick}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="icon-container">
                            <Badge 
                                badgeContent={unreadCount} 
                                color="error"
                                max={99}
                            >
                                {notificationItem.icon}
                            </Badge>
                        </div>
                        <span className="sidebar-label">{notificationItem.text}</span>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;