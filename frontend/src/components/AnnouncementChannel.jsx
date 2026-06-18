import { useEffect, useState, useRef, Fragment } from "react";
import api from "../api/axios";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";
import UserAvatar from "./common/UserAvatar";
import { Send, X, Megaphone, Smile, MoreVertical, Edit2, Trash2, Pin, PinOff } from "lucide-react";
import EmojiPicker from "./EmojiPicker";

const AnnouncementChannel = ({ onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [menuOpen, setMenuOpen] = useState(null);
  const [isTeaBreakAnnouncement, setIsTeaBreakAnnouncement] = useState(false);
  const [teaBreakType, setTeaBreakType] = useState("morning");
  const [activeTeaBreak, setActiveTeaBreak] = useState(null);
  const [stoppingTeaBreak, setStoppingTeaBreak] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { user, token } = useAuth();

  const isAdminOrHr = ['Admin', 'HR'].includes(user?.role);

  const fetchActiveTeaBreak = async () => {
    if (!isAdminOrHr) return;
    try {
      const { data } = await api.get("/tea-break/active");
      if (data?.active) {
        setActiveTeaBreak(data);
      } else {
        setActiveTeaBreak(null);
      }
    } catch {
      setActiveTeaBreak(null);
    }
  };

  const handleStopTeaBreak = async () => {
    if (stoppingTeaBreak) return;
    try {
      setStoppingTeaBreak(true);
      await api.post("/tea-break/stop", activeTeaBreak?.announcementId
        ? { announcementId: activeTeaBreak.announcementId }
        : {});
      setActiveTeaBreak(null);
      setIsTeaBreakAnnouncement(false);
    } catch (error) {
      console.error("Error stopping tea break:", error);
      alert(error.response?.data?.message || "Failed to stop tea break");
    } finally {
      setStoppingTeaBreak(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Fetch messages on mount
    fetchMessages();
    fetchActiveTeaBreak();
    
    // Connect socket with authentication
    if (token && !socket.connected) {
      socket.auth = { token };
      socket.connect();
    }

    // Listen for new announcements
    const handleNewAnnouncement = (msg) => {
      // Only add if not already in messages (avoid duplicates for sender)
      setMessages((prev) => {
        const exists = prev.some(m => m._id === msg._id);
        if (exists) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 100);
    };

    // Listen for announcement updates
    const handleAnnouncementUpdated = (msg) => {
      setMessages((prev) => prev.map(m => m._id === msg._id ? msg : m));
    };

    // Listen for announcement deletions
    const handleAnnouncementDeleted = (data) => {
      setMessages((prev) => prev.filter(m => m._id !== data.id));
    };

    // Listen for announcement pin/unpin
    const handleAnnouncementPinned = (msg) => {
      setMessages((prev) => {
        const updated = prev.map(m => m._id === msg._id ? msg : m);
        // Re-sort: pinned first, then by date
        return updated.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(a.createdAt) - new Date(b.createdAt);
        });
      });
    };

    const handleTeaBreakStarted = () => {
      fetchActiveTeaBreak();
    };
    const handleTeaBreakStopped = () => {
      setActiveTeaBreak(null);
    };

    socket.on("receiveAnnouncement", handleNewAnnouncement);
    socket.on("announcementUpdated", handleAnnouncementUpdated);
    socket.on("announcementDeleted", handleAnnouncementDeleted);
    socket.on("announcementPinned", handleAnnouncementPinned);
    socket.on("tea_break_started", handleTeaBreakStarted);
    socket.on("tea_break_stopped", handleTeaBreakStopped);

    return () => {
      socket.off("receiveAnnouncement", handleNewAnnouncement);
      socket.off("announcementUpdated", handleAnnouncementUpdated);
      socket.off("announcementDeleted", handleAnnouncementDeleted);
      socket.off("announcementPinned", handleAnnouncementPinned);
      socket.off("tea_break_started", handleTeaBreakStarted);
      socket.off("tea_break_stopped", handleTeaBreakStopped);
    };
  }, [token]); // Only depend on token

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/announcements");
      setMessages(data);
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    try {
      setSending(true);
      const postBody = { message: input.trim() };
      if (isAdminOrHr && isTeaBreakAnnouncement) {
        postBody.isTEABreak = true;
        postBody.teaBreakType = teaBreakType;
      }

      const { data } = await api.post("/announcements", postBody);

      // Add message immediately to local state for instant feedback
      setMessages((prev) => [...prev, data]);
      setTimeout(scrollToBottom, 100);

      // Real-time delivery is handled server-side on POST /announcements
      if (data.isTEABreak) {
        fetchActiveTeaBreak();
      }
      setInput("");
      setIsTeaBreakAnnouncement(false);
    } catch (error) {
      console.error("Error sending announcement:", error);
      alert(error.response?.data?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const isCurrentUser = (senderId) => {
    return senderId === user?._id || senderId === user?.id;
  };

  const canEditDelete = (msg) => {
    const isOwner = isCurrentUser(msg.sender._id);
    const isAdmin = ['Admin', 'HR'].includes(user?.role);
    return isOwner || isAdmin;
  };

  const canPin = () => {
    return ['Admin', 'HR'].includes(user?.role);
  };

  const handleEdit = (msg) => {
    setEditingId(msg._id);
    setEditText(msg.message);
    setMenuOpen(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleSaveEdit = async (msgId) => {
    if (!editText.trim()) return;

    try {
      const { data } = await api.put(`/announcements/${msgId}`, {
        message: editText.trim(),
      });

      setMessages((prev) => prev.map(m => m._id === msgId ? data : m));
      socket.emit("updateAnnouncement", data);
      setEditingId(null);
      setEditText("");
    } catch (error) {
      console.error("Error updating announcement:", error);
      alert(error.response?.data?.message || "Failed to update message");
    }
  };

  const handleDelete = async (msgId) => {
    try {
      await api.delete(`/announcements/${msgId}`);
      setMessages((prev) => prev.filter(m => m._id !== msgId));
      socket.emit("deleteAnnouncement", { id: msgId });
      setMenuOpen(null);
    } catch (error) {
      console.error("Error deleting announcement:", error);
      alert(error.response?.data?.message || "Failed to delete message");
    }
  };

  const handlePin = async (msg) => {
    try {
      const { data } = await api.patch(`/announcements/${msg._id}/pin`, {
        pinned: !msg.pinned,
      });

      setMessages((prev) => {
        const updated = prev.map(m => m._id === msg._id ? data : m);
        // Re-sort: pinned first, then by date
        return updated.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(a.createdAt) - new Date(b.createdAt);
        });
      });
      
      socket.emit("pinAnnouncement", data);
      setMenuOpen(null);
    } catch (error) {
      console.error("Error pinning announcement:", error);
      alert(error.response?.data?.message || "Failed to pin message");
    }
  };

  const istDateKey = (timestamp) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestamp));

  const isSameISTDay = (a, b) => istDateKey(a) === istDateKey(b);

  const formatMessageTime = (timestamp) =>
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(timestamp));

  const formatDateDivider = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const key = istDateKey(date);
    const todayKey = istDateKey(now);

    if (key === todayKey) return 'Today';

    const yesterday = new Date(now.getTime() - 86400000);
    if (key === istDateKey(yesterday)) return 'Yesterday';

    const msgYear = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
    }).format(date);
    const currentYear = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
    }).format(now);

    if (msgYear === currentYear) {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(date);
    }

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div className="announcement-channel">
      <div className="announcement-header">
        <div className="announcement-header-content">
          <Megaphone size={18} />
          <span className="announcement-title">Company Announcements</span>
        </div>
        <button onClick={onClose} className="announcement-close-btn" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="announcement-messages">
        {loading ? (
          <div className="announcement-loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="announcement-empty">
            <Megaphone size={32} />
            <p>No announcements yet</p>
            <span>Be the first to post!</span>
          </div>
        ) : (
          messages.map((msg, index) => {
            // Safety check for sender object
            if (!msg.sender) {
              console.warn('Message missing sender:', msg);
              return null;
            }
            
            const isOwn = isCurrentUser(msg.sender._id);
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showDateDivider = !prevMsg || !isSameISTDay(msg.createdAt, prevMsg.createdAt);
            const showAvatar = showDateDivider || index === 0 || messages[index - 1]?.sender?._id !== msg.sender._id;
            const showName = showAvatar;
            const isEditing = editingId === msg._id;
            
            // Get sender name with fallback
            const senderName = msg.sender.firstName && msg.sender.lastName 
              ? `${msg.sender.firstName} ${msg.sender.lastName}`
              : msg.sender.fullName || 'Unknown User';
            
            return (
              <Fragment key={msg._id}>
              {showDateDivider && (
                <div className="announcement-date-divider" role="separator">
                  <span>{formatDateDivider(msg.createdAt)}</span>
                </div>
              )}
              <div 
                className={`announcement-message-wrapper ${isOwn ? 'own-message' : 'other-message'}`}
              >
                {!isOwn && showAvatar && (
                  <div className="announcement-message-avatar">
                    <UserAvatar user={msg.sender} size="xs" />
                  </div>
                )}
                {!isOwn && !showAvatar && <div className="announcement-message-avatar-spacer" />}
                
                <div className="announcement-message-group">
                  {showName && (
                    <div className={`announcement-sender-label ${isOwn ? 'own' : ''}`}>
                      {isOwn ? 'You' : senderName}
                      {msg.pinned && <Pin size={12} className="pinned-icon" />}
                    </div>
                  )}
                  
                  {isEditing ? (
                    <div className="announcement-edit-container">
                      <textarea
                        className="announcement-edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        maxLength={1000}
                        autoFocus
                      />
                      <div className="announcement-edit-actions">
                        <button onClick={() => handleSaveEdit(msg._id)} className="edit-save-btn">
                          Save
                        </button>
                        <button onClick={handleCancelEdit} className="edit-cancel-btn">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="announcement-bubble-wrapper group">
                        <div className={`announcement-message-bubble ${isOwn ? 'own' : ''} ${msg.pinned ? 'pinned' : ''}`}>
                          {msg.message}
                        </div>
                        {(canEditDelete(msg) || canPin()) && (
                          <>
                            <button 
                              className="message-menu-btn"
                              onClick={() => setMenuOpen(menuOpen === msg._id ? null : msg._id)}
                              aria-label="Message options"
                            >
                              <MoreVertical size={16} strokeWidth={2} />
                            </button>
                            
                            {menuOpen === msg._id && (
                              <div className="message-menu">
                                {canEditDelete(msg) && (
                                  <>
                                    <button onClick={() => handleEdit(msg)}>
                                      <Edit2 size={13} /> Edit
                                    </button>
                                    <button onClick={() => handleDelete(msg._id)} className="delete-btn">
                                      <Trash2 size={13} /> Delete
                                    </button>
                                  </>
                                )}
                                {canPin() && (
                                  <button onClick={() => handlePin(msg)}>
                                    {msg.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                                    {msg.pinned ? 'Unpin' : 'Pin'}
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className={`announcement-message-time ${isOwn ? 'own' : ''}`}>
                        <span className="announcement-message-time-value">{formatMessageTime(msg.createdAt)}</span>
                        {msg.updatedAt && msg.updatedAt !== msg.createdAt && (
                          <span className="announcement-message-edited">edited</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              </Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {isAdminOrHr && activeTeaBreak && (
        <div className="announcement-tea-break-active">
          <div className="announcement-tea-break-active-label">
            Tea break in progress ({activeTeaBreak.teaBreakType === 'evening' ? 'Evening' : 'Morning'})
          </div>
          <button
            type="button"
            onClick={handleStopTeaBreak}
            disabled={stoppingTeaBreak}
            className="announcement-tea-break-stop-btn"
          >
            {stoppingTeaBreak ? 'Stopping…' : 'Stop Tea Break for Everyone'}
          </button>
        </div>
      )}

      {isAdminOrHr && (
        <div className="announcement-tea-break-options">
          <label className="announcement-tea-break-checkbox">
            <input
              type="checkbox"
              checked={isTeaBreakAnnouncement}
              onChange={(e) => setIsTeaBreakAnnouncement(e.target.checked)}
            />
            <span className="announcement-tea-break-checkbox-box" aria-hidden="true" />
            <span className="announcement-tea-break-checkbox-label">This is a Tea Break announcement</span>
          </label>
          {isTeaBreakAnnouncement && (
            <div className="announcement-tea-break-selector" role="group" aria-label="Tea break type">
              <button
                type="button"
                className={`announcement-tea-break-option${teaBreakType === 'morning' ? ' active' : ''}`}
                onClick={() => setTeaBreakType('morning')}
                aria-pressed={teaBreakType === 'morning'}
              >
                Morning Break
              </button>
              <button
                type="button"
                className={`announcement-tea-break-option${teaBreakType === 'evening' ? ' active' : ''}`}
                onClick={() => setTeaBreakType('evening')}
                aria-pressed={teaBreakType === 'evening'}
              >
                Evening Break
              </button>
            </div>
          )}
        </div>
      )}

      <div className="announcement-input-container">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="announcement-emoji-btn"
          aria-label="Add emoji"
        >
          <Smile size={20} strokeWidth={1.5} />
        </button>
        
        {showEmojiPicker && (
          <EmojiPicker 
            onSelect={handleEmojiSelect} 
            onClose={() => setShowEmojiPicker(false)} 
          />
        )}
        
        <input
          ref={inputRef}
          className="announcement-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Write a message..."
          maxLength={1000}
          disabled={sending}
        />
        <button
          onClick={sendMessage}
          className="announcement-send-btn"
          disabled={!input.trim() || sending}
          aria-label="Send message"
          type="button"
        >
          <Send size={18} className="text-white" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

export default AnnouncementChannel;
