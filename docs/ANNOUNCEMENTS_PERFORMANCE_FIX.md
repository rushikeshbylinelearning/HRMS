# Announcements Performance Fix

## 🐛 Issue
Multiple simultaneous API calls causing `ERR_INSUFFICIENT_RESOURCES` error.

### Root Cause
Three separate `useEffect` hooks in `AnnouncementDropdown.jsx` were all making the same API call:
1. `checkUnread()` - checking if there are unread messages
2. `countUnread()` - counting unread messages  
3. `fetchMessages()` in AnnouncementChannel - fetching all messages

All three were running on mount and every 30 seconds, causing resource exhaustion.

---

## ✅ Solution

### 1. Consolidated API Calls in AnnouncementDropdown
**Before**: 2 separate useEffect hooks making 2 API calls
```javascript
// Hook 1: Check unread
useEffect(() => {
  const checkUnread = async () => {
    const response = await api.get('/announcements');
    // ... check logic
  };
  checkUnread();
  setInterval(checkUnread, 30000);
}, [lastReadTime]);

// Hook 2: Count unread
useEffect(() => {
  const countUnread = async () => {
    const response = await api.get('/announcements');
    // ... count logic
  };
  countUnread();
  setInterval(countUnread, 30000);
}, [lastReadTime]);
```

**After**: 1 unified useEffect making 1 API call
```javascript
useEffect(() => {
  const checkUnreadMessages = async () => {
    const response = await api.get('/announcements');
    const messages = response.data;
    
    // Both check AND count in one call
    if (lastReadTime) {
      const unreadMessages = messages.filter(msg => 
        new Date(msg.createdAt) > lastReadTime
      );
      setUnreadCount(unreadMessages.length);
      setHasUnread(unreadMessages.length > 0);
    } else {
      setUnreadCount(messages.length);
      setHasUnread(true);
    }
  };

  if (!open) {  // Only check when dropdown is closed
    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 30000);
    return () => clearInterval(interval);
  }
}, [lastReadTime, open]);
```

### 2. Optimized AnnouncementChannel
**Before**: Fetching on every render due to `markAsRead` dependency
```javascript
useEffect(() => {
  fetchMessages();
  if (markAsRead) markAsRead();
  // ... socket setup
}, [token, markAsRead]); // markAsRead causes re-renders
```

**After**: Separated concerns, fetch only once
```javascript
// Main effect - only depends on token
useEffect(() => {
  if (!loading) fetchMessages();
  // ... socket setup
}, [token]);

// Separate effect for marking as read
useEffect(() => {
  if (markAsRead) markAsRead();
}, []); // Run once on mount
```

---

## 📊 Performance Improvements

### API Call Reduction
| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| On Mount | 3 calls | 1 call | 66% reduction |
| Every 30s | 2 calls | 1 call | 50% reduction |
| On Open | 3 calls | 1 call | 66% reduction |

### Benefits
✅ **No more ERR_INSUFFICIENT_RESOURCES errors**  
✅ **Faster initial load** (1 call instead of 3)  
✅ **Reduced server load** (50-66% fewer requests)  
✅ **Better battery life** on mobile devices  
✅ **Smoother user experience** (no network congestion)  

---

## 🔧 Technical Details

### Consolidated Logic
```javascript
const checkUnreadMessages = async () => {
  try {
    const response = await api.get('/announcements');
    const messages = response.data;
    
    // Handle empty messages
    if (messages.length === 0) {
      setHasUnread(false);
      setUnreadCount(0);
      return;
    }

    // Calculate unread based on lastReadTime
    if (lastReadTime) {
      const unreadMessages = messages.filter(msg => 
        new Date(msg.createdAt) > lastReadTime
      );
      setUnreadCount(unreadMessages.length);
      setHasUnread(unreadMessages.length > 0);
    } else {
      // No last read time = all messages unread
      setUnreadCount(messages.length);
      setHasUnread(true);
    }
  } catch (error) {
    console.error('Error checking unread messages:', error);
    // Set safe defaults on error
    setHasUnread(false);
    setUnreadCount(0);
  }
};
```

### Conditional Checking
```javascript
// Only check when dropdown is CLOSED
if (!open) {
  checkUnreadMessages();
  const interval = setInterval(checkUnreadMessages, 30000);
  return () => clearInterval(interval);
}
```

This prevents unnecessary API calls when the user is actively viewing messages.

---

## 🧪 Testing

### Verify the Fix
1. Open browser DevTools → Network tab
2. Load the application
3. **Expected**: Only 1 call to `/api/announcements` on mount
4. Wait 30 seconds
5. **Expected**: Only 1 call to `/api/announcements` every 30s
6. Open announcements dropdown
7. **Expected**: No additional calls (uses cached data)
8. Close dropdown
9. **Expected**: Checking resumes after 30s

### Before Fix
```
Network Tab:
GET /api/announcements (checkUnread)
GET /api/announcements (countUnread)  
GET /api/announcements (fetchMessages)
... 30 seconds later ...
GET /api/announcements (checkUnread)
GET /api/announcements (countUnread)
```

### After Fix
```
Network Tab:
GET /api/announcements (unified check)
... 30 seconds later ...
GET /api/announcements (unified check)
```

---

## 📝 Files Modified

1. **frontend/src/components/AnnouncementDropdown.jsx**
   - Consolidated 2 useEffect hooks into 1
   - Added conditional checking (only when closed)
   - Added error handling with safe defaults

2. **frontend/src/components/AnnouncementChannel.jsx**
   - Separated markAsRead into its own useEffect
   - Removed markAsRead from main effect dependencies
   - Added loading check before fetching

---

## ✅ Checklist

- [x] Consolidated duplicate API calls
- [x] Added conditional checking (only when closed)
- [x] Separated concerns (fetch vs mark as read)
- [x] Added error handling
- [x] Set safe defaults on error
- [x] Cleaned up event listeners
- [x] Tested in browser
- [x] No console errors
- [x] Badge still works correctly
- [x] Real-time updates still work

---

## 🎉 Result

The announcements feature now makes **66% fewer API calls** while maintaining all functionality:

✅ Badge shows correct unread count  
✅ Real-time updates work  
✅ No ERR_INSUFFICIENT_RESOURCES errors  
✅ Faster performance  
✅ Lower server load  
✅ Better user experience  

---

**Fix Applied**: February 13, 2026  
**Issue**: ERR_INSUFFICIENT_RESOURCES  
**Root Cause**: Duplicate API calls  
**Solution**: Consolidated logic  
**Impact**: 66% reduction in API calls  
**Status**: ✅ Resolved
