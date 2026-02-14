import { useState, useEffect, useRef } from "react";
import { Megaphone } from "lucide-react";
import AnnouncementChannel from "./AnnouncementChannel";
import api from "../api/axios";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";
import soundManager from "../services/NotificationSoundManager";
import useDesktopNotification from "../hooks/useDesktopNotification";
import "../styles/AnnouncementDropdown.css";

const AnnouncementDropdown = () => {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTime, setLastReadTime] = useState(null);
  const dropdownRef = useRef(null);
  const { user } = useAuth();
  const { showAnnouncementNotification, requestPermission } = useDesktopNotification();

  // Load last read time from localStorage and request notification permission
  useEffect(() => {
    const stored = localStorage.getItem('announcements_last_read');
    if (stored) {
      setLastReadTime(new Date(stored));
    }

    // Request desktop notification permission on mount
    requestPermission();
  }, [requestPermission]);

  // Single unified check for unread messages (combines both checks)
  useEffect(() => {
    const checkUnreadMessages = async () => {
      try {
        const response = await api.get('/announcements');
        const messages = response.data;
        
        if (messages.length === 0) {
          setHasUnread(false);
          setUnreadCount(0);
          return;
        }

        // Filter out messages from current user
        const otherUsersMessages = messages.filter(msg => {
          const senderId = msg.sender?._id || msg.sender?.id;
          const currentUserId = user?._id || user?.id;
          return senderId !== currentUserId;
        });

        if (lastReadTime) {
          const unreadMessages = otherUsersMessages.filter(msg => 
            new Date(msg.createdAt) > lastReadTime
          );
          setUnreadCount(unreadMessages.length);
          setHasUnread(unreadMessages.length > 0);
        } else {
          // No last read time means all messages from others are unread
          setUnreadCount(otherUsersMessages.length);
          setHasUnread(otherUsersMessages.length > 0);
        }
      } catch (error) {
        console.error('Error checking unread messages:', error);
        // Set defaults on error to prevent infinite loops
        setHasUnread(false);
        setUnreadCount(0);
      }
    };

    // Only check if not currently open
    if (!open) {
      checkUnreadMessages();
      const interval = setInterval(checkUnreadMessages, 30000);
      return () => clearInterval(interval);
    }
  }, [lastReadTime, open, user]);

  // Listen for real-time announcements to update badge, play sound, and show desktop notification
  useEffect(() => {
    const handleNewAnnouncement = (msg) => {
      // Only show notification if dropdown is closed and message is from another user
      if (!open) {
        const senderId = msg.sender?._id || msg.sender?.id;
        const currentUserId = user?._id || user?.id;
        
        if (senderId !== currentUserId) {
          // Update badge
          setUnreadCount(prev => prev + 1);
          setHasUnread(true);
          
          // Play announcement sound
          soundManager.playAnnouncement();
          
          // Show desktop notification
          showAnnouncementNotification(msg, () => {
            // When notification is clicked, open the dropdown
            setOpen(true);
          });
        }
      }
    };

    socket.on("receiveAnnouncement", handleNewAnnouncement);

    return () => {
      socket.off("receiveAnnouncement", handleNewAnnouncement);
    };
  }, [open, user, showAnnouncementNotification]);

  const handleOpen = () => {
    // Open dropdown first
    setOpen(true);
    
    // Immediately hide badge
    setHasUnread(false);
    setUnreadCount(0);
    
    // Mark as read with current timestamp
    const now = new Date();
    setLastReadTime(now);
    localStorage.setItem('announcements_last_read', now.toISOString());
  };

  const handleClose = () => {
    setOpen(false);
    
    // Update lastReadTime again when closing to ensure it's saved
    const now = new Date();
    setLastReadTime(now);
    localStorage.setItem('announcements_last_read', now.toISOString());
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="announcement-dropdown-container" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="announcement-icon-btn"
        aria-label="Announcements"
      >
        <Megaphone size={20} className="announcement-icon" />
        {!open && unreadCount > 0 && (
          <span className="announcement-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="announcement-dropdown-panel">
          <AnnouncementChannel onClose={handleClose} />
        </div>
      )}
    </div>
  );
};

export default AnnouncementDropdown;
