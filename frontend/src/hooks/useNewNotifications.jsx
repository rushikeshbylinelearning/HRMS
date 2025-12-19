// frontend/src/hooks/useNewNotifications.jsx
import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { useAuth } from '../context/AuthContext';
import socket from '../socket';
import useDesktopNotifications from './useDesktopNotifications.jsx';
import api from '../api/axios';

const NewNotificationContext = createContext();

export const NewNotificationProvider = ({ children }) => {
    const { user, token, loading: authLoading } = useAuth();
    const { showNotification, requestPermission } = useDesktopNotifications();
    
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [loadingNotifications, setLoadingNotifications] = useState(true);

    const fetchNotifications = useCallback(async () => {
        if (!user || !token) {
            setLoadingNotifications(false);
            return;
        }
        setLoadingNotifications(true);
        try {
            const { data } = await api.get('/new-notifications');
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoadingNotifications(false);
        }
    }, [user, token]);

    const markAsRead = useCallback(async (notificationId) => {
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        try {
            await api.post(`/new-notifications/${notificationId}/read`);
        } catch (error) {
            fetchNotifications();
        }
    }, [fetchNotifications]);

    const markAllAsRead = useCallback(async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
        try {
            await api.post('/new-notifications/mark-all-read');
        } catch (error) {
            fetchNotifications();
        }
    }, [fetchNotifications]);

    const deleteNotification = useCallback(async (notificationId) => {
        const optimisticBackup = [...notifications];
        const notificationToDelete = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (notificationToDelete && !notificationToDelete.read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        try {
            // This endpoint is now safe for both users and admins
            await api.delete(`/new-notifications/${notificationId}`);
        } catch (error) {
            console.error('Failed to delete notification on server:', error);
            setNotifications(optimisticBackup);
        }
    }, [notifications]);

    const clearAllNotifications = useCallback(async () => {
        const optimisticBackup = [...notifications];
        setNotifications([]);
        setUnreadCount(0);
        try {
            const isAdmin = user && (user.role === 'Admin' || user.role === 'HR');
            // **THE FIX IS HERE**
            // Use the new, more explicit endpoints
            const endpoint = isAdmin ? '/new-notifications/admin/clear-all' : '/new-notifications/user/clear-mine';
            console.log(`[useNewNotifications] Clearing notifications via endpoint: ${endpoint}`);
            await api.delete(endpoint);
        } catch (error) {
            console.error('Failed to clear all notifications on server:', error);
            setNotifications(optimisticBackup);
            fetchNotifications();
        }
    }, [user, fetchNotifications, notifications]);

    const handleNewNotification = useCallback((notification) => {
        setNotifications(prev => {
            const exists = prev.some(n => n.id === notification.id);
            if (exists) return prev;
            return [notification, ...prev];
        });
        if (!notification.read) {
            setUnreadCount(prev => prev + 1);
        }
        const title = notification.category?.charAt(0).toUpperCase() + notification.category?.slice(1) || 'Notification';
        showNotification(title, notification.message, { data: notification });
    }, [showNotification]);

    useEffect(() => {
        if (authLoading || !user || !token) {
            if (socket.connected) socket.disconnect();
            return;
        }

        // Guard: only connect with a well-formed token
        // Token should be raw JWT (not Bearer prefix for socket.auth)
        const rawToken = typeof token === 'string' && token.includes('.') ? token : null;
        if (!rawToken) {
            console.warn('[useNewNotifications] No valid token available, skipping socket connection');
            if (socket.connected) socket.disconnect();
            return;
        }

        // Note: Socket connection is now managed by AuthContext after /api/auth/me succeeds
        // This hook should not connect socket directly - it waits for AuthContext
        // Only set up socket listeners here
        
        requestPermission();
        fetchNotifications();

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        const onConnectError = (err) => console.error('❌ [Socket Hook] Connection Error:', err.message);

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on('new_notification', handleNewNotification);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('new_notification', handleNewNotification);
            if (socket.connected) socket.disconnect();
        };
    }, [user, token, authLoading, fetchNotifications, handleNewNotification, requestPermission]);

    const value = {
        notifications,
        unreadCount,
        isConnected,
        loadingNotifications,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications
    };

    return <NewNotificationContext.Provider value={value}>{children}</NewNotificationContext.Provider>;
};

const useNewNotifications = () => {
    const context = useContext(NewNotificationContext);
    if (context === undefined) {
        throw new Error('useNewNotifications must be used within a NewNotificationProvider');
    }
    return context;
};

export default useNewNotifications;