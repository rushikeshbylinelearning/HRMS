// frontend/src/layouts/Topbar.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar, Menu, MenuItem, Tooltip, IconButton, Badge } from '@mui/material';
import { Search as SearchIcon, NotificationsNone as NotificationsNoneIcon } from '@mui/icons-material';
import useNewNotifications from '../hooks/useNewNotifications';
import '../styles/Topbar.css';

const Topbar = ({ onNotificationClick }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState(null);
    const { unreadCount } = useNewNotifications();

    const handleMenu = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);
    const handleProfile = () => {
        handleClose();
        navigate('/profile');
    };
    const handleLogout = () => { 
        handleClose(); 
        logout(); 
        // Don't navigate - logout() handles SSO redirect if needed
        // Only navigate to login if not SSO user
        if (user?.authMethod !== 'SSO') {
        navigate('/login'); 
        }
    };

    return (
        <header className="topbar">
            <div className="topbar-left">
                <img src="/BL.svg" alt="Company Logo" className="topbar-logo-img" />
            </div>
            <div className="topbar-right">
                <IconButton className="topbar-icon-btn"><SearchIcon /></IconButton>
                <IconButton className="topbar-icon-btn" onClick={onNotificationClick}>
                    <Badge badgeContent={Number(unreadCount) || 0} color="error" max={99}>
                        <NotificationsNoneIcon />
                    </Badge>
                </IconButton>
                <Tooltip title="Account">
                    <IconButton onClick={handleMenu} sx={{ p: 0 }}>
                        <Avatar 
                            sx={{ bgcolor: '#212121' }}
                        >
                            {user?.name?.charAt(0) || user?.fullName?.charAt(0) || 'U'}
                        </Avatar>
                    </IconButton>
                </Tooltip>
                <Menu 
                    anchorEl={anchorEl} 
                    open={Boolean(anchorEl)} 
                    onClose={handleClose} 
                    sx={{ mt: '45px' }}
                    PaperProps={{ sx: { borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } }}
                >
                    <MenuItem onClick={handleProfile}>Profile</MenuItem>
                    <MenuItem onClick={handleLogout}>Logout</MenuItem>
                </Menu>
            </div>
        </header>
    );
};

export default Topbar;