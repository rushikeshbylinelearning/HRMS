// frontend/src/hooks/useDesktopNotifications.jsx
import React, { useCallback, useEffect, useState } from 'react';

const useDesktopNotifications = () => {
    const [permission, setPermission] = useState('default');
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        if ('Notification' in window && window.isSecureContext) {
            setIsSupported(true);
            setPermission(Notification.permission);
        } else {
            setIsSupported(false);
        }
    }, []);

    const requestPermission = useCallback(async () => {
        if (!isSupported) {
            return false;
        }

        if (permission === 'granted') return true;

        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result === 'granted';
        } catch (error) {
            return false;
        }
    }, [isSupported, permission]);

    const showNotification = useCallback((title, message, options = {}) => {
        if (!isSupported || Notification.permission !== 'granted') {
            return null;
        }

        try {
            // **THE FIX for Branding**
            // The title is now hardcoded for consistency.
            // Ensure you have a logo at `/public/favicon.ico` for the icon to work.
            const notification = new Notification("Byline People", {
                body: `${title}: ${message}`, // Prepend the category for context
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'ams-notification',
                renotify: true,
                ...options
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                if (options.data?.navigationData?.page) {
                     const path = options.data.navigationData.page;
                     window.location.href = path.startsWith('/') ? path : `/${path}`;
                }
            };

            setTimeout(() => notification.close(), 8000);
            return notification;
        } catch (error) {
            return null;
        }
    }, [isSupported]);

    return { isSupported, permission, requestPermission, showNotification };
};

export default useDesktopNotifications;