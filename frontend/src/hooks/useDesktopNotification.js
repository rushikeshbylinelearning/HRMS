import { useEffect, useState, useCallback } from 'react';

/**
 * Custom hook for managing desktop notifications
 * Handles permission requests and notification display
 */
const useDesktopNotification = () => {
  const [permission, setPermission] = useState(Notification.permission);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if browser supports notifications
    setIsSupported('Notification' in window);
    
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  /**
   * Request notification permission from user
   * @returns {Promise<string>} Permission status: 'granted', 'denied', or 'default'
   */
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.log('[Notification] Browser does not support notifications');
      return 'denied';
    }

    if (permission === 'granted') {
      return 'granted';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      console.log('[Notification] Permission:', result);
      return result;
    } catch (error) {
      console.error('[Notification] Permission request failed:', error);
      return 'denied';
    }
  }, [isSupported, permission]);

  /**
   * Show a desktop notification
   * @param {string} title - Notification title
   * @param {Object} options - Notification options
   * @param {string} options.body - Notification body text
   * @param {string} options.icon - Icon URL
   * @param {string} options.tag - Unique tag to prevent duplicates
   * @param {Function} options.onClick - Click handler
   * @returns {Notification|null} Notification instance or null
   */
  const showNotification = useCallback((title, options = {}) => {
    if (!isSupported) {
      console.log('[Notification] Browser does not support notifications');
      return null;
    }

    if (permission !== 'granted') {
      console.log('[Notification] Permission not granted');
      return null;
    }

    // Check if tab is visible (optional - only show when tab is hidden)
    if (options.onlyWhenHidden && document.visibilityState === 'visible') {
      console.log('[Notification] Tab is visible, skipping notification');
      return null;
    }

    try {
      const notification = new Notification(title, {
        body: options.body || '',
        icon: options.icon || '/AMS.webp',
        tag: options.tag || `notification-${Date.now()}`,
        requireInteraction: false,
        silent: false, // Allow sound
      });

      // Handle click event
      if (options.onClick) {
        notification.onclick = (event) => {
          event.preventDefault();
          window.focus();
          options.onClick();
          notification.close();
        };
      }

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      console.log('[Notification] Shown:', title);
      return notification;
    } catch (error) {
      console.error('[Notification] Failed to show:', error);
      return null;
    }
  }, [isSupported, permission]);

  /**
   * Show announcement notification
   * @param {Object} announcement - Announcement data
   * @param {string} announcement.message - Message text
   * @param {Object} announcement.sender - Sender info
   * @param {string} announcement._id - Message ID
   * @param {Function} onClick - Click handler
   */
  const showAnnouncementNotification = useCallback((announcement, onClick) => {
    const senderName = announcement.sender?.fullName || 
                       `${announcement.sender?.firstName || ''} ${announcement.sender?.lastName || ''}`.trim() ||
                       'Someone';
    
    const body = announcement.message.length > 100 
      ? announcement.message.substring(0, 100) + '...'
      : announcement.message;

    return showNotification('New Company Announcement', {
      body: `${senderName}: ${body}`,
      icon: '/AMS.webp',
      tag: `announcement-${announcement._id}`,
      onlyWhenHidden: true, // Only show when tab is not active
      onClick: onClick || (() => {
        // Default: focus window
        window.focus();
      })
    });
  }, [showNotification]);

  /**
   * Show general notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Function} onClick - Click handler
   */
  const showGeneralNotification = useCallback((title, message, onClick) => {
    const body = message.length > 100 
      ? message.substring(0, 100) + '...'
      : message;

    return showNotification(title, {
      body: body,
      icon: '/AMS.webp',
      tag: `general-${Date.now()}`,
      onlyWhenHidden: true,
      onClick: onClick
    });
  }, [showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    showAnnouncementNotification,
    showGeneralNotification,
  };
};

export default useDesktopNotification;
