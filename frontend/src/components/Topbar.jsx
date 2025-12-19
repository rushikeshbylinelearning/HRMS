// frontend/src/layouts/Topbar.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar, Menu, MenuItem, Tooltip, IconButton, Badge } from '@mui/material';
import { Search as SearchIcon, NotificationsNone as NotificationsNoneIcon } from '@mui/icons-material';
import { getAvatarUrl } from '../utils/avatarUtils';
import useNewNotifications from '../hooks/useNewNotifications';
import '../styles/Topbar.css';

const Topbar = ({ onNotificationClick }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState(null);
    const [avatarImageError, setAvatarImageError] = useState(false);
    const { unreadCount } = useNewNotifications();

    const handleMenu = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);
    
    // Reset avatar error state when profile image URL changes
    useEffect(() => {
        setAvatarImageError(false);
    }, [user?.profileImageUrl]);
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
                            src={!avatarImageError ? (() => {
                                const avatarUrl = getAvatarUrl(user?.profileImageUrl);
                                // Add cache-busting query parameter to force browser to fetch fresh image
                                // Use profileImageUpdatedAt if available, otherwise use current timestamp
                                const cacheBuster = user?.profileImageUpdatedAt || Date.now();
                                return avatarUrl ? `${avatarUrl}?v=${cacheBuster}` : undefined;
                            })() : undefined} 
                            key={`topbar-avatar-${user?.profileImageUrl || 'no-image'}-${user?.profileImageUpdatedAt || Date.now()}`}
                            sx={{ bgcolor: '#212121' }}
                            onError={() => {
                                setAvatarImageError(true);
                            }}
                            imgProps={{
                                style: {
                                    objectFit: 'cover',
                                    width: '100%',
                                    height: '100%'
                                },
                                onError: (e) => {
                                    e.target.onerror = null; // Prevent infinite loop
                                    setAvatarImageError(true);
                                }
                            }}
                        >
                            {!user?.profileImageUrl || avatarImageError ? (user?.name?.charAt(0) || user?.fullName?.charAt(0) || 'U') : null}
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