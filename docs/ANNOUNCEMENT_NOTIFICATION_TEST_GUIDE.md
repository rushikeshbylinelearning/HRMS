# Announcement Desktop Notification - Testing Guide

## 🎯 Quick Test Steps

### Prerequisites
- Two user accounts (or one account + incognito window)
- Browser with notification support (Chrome, Firefox, Edge, Safari)
- Notification permission granted

### Test 1: Basic Desktop Notification (Tab Hidden)

1. **Setup**:
   - Open app as User A in Tab 1
   - Switch to another tab or minimize browser
   
2. **Action**:
   - Open app as User B in another window/incognito
   - Send an announcement: "Test notification"
   
3. **Expected Result**:
   - ✅ Desktop notification appears
   - ✅ Title: "New Company Announcement"
   - ✅ Body: "User B Name: Test notification"
   - ✅ Sound plays (`announcement.mp3`)
   - ✅ Badge shows "1" on megaphone icon

### Test 2: No Notification When Tab Active

1. **Setup**:
   - Open app as User A in Tab 1
   - Keep tab ACTIVE and visible
   
2. **Action**:
   - Send announcement from User B
   
3. **Expected Result**:
   - ❌ NO desktop notification (tab is visible)
   - ✅ Sound plays
   - ✅ Badge updates
   - ✅ Message appears in UI

### Test 3: No Self-Notification

1. **Setup**:
   - Open app as User A
   
2. **Action**:
   - Send your own announcement
   
3. **Expected Result**:
   - ❌ NO desktop notification
   - ❌ NO sound
   - ❌ NO badge update
   - ✅ Message appears in UI immediately

### Test 4: Notification Click Action

1. **Setup**:
   - Open app in Tab 1
   - Switch to another tab
   
2. **Action**:
   - Receive announcement (desktop notification appears)
   - Click on the desktop notification
   
3. **Expected Result**:
   - ✅ Browser focuses on the app tab
   - ✅ Announcement dropdown opens
   - ✅ Notification closes

### Test 5: Permission Handling

1. **Setup**:
   - Block notification permission in browser
   - Reload app
   
2. **Action**:
   - Try to receive announcement
   
3. **Expected Result**:
   - ❌ NO desktop notification (permission denied)
   - ✅ Sound still plays
   - ✅ Badge still updates
   - ✅ Message appears in UI

4. **Grant Permission**:
   - Grant notification permission
   - Receive another announcement
   
5. **Expected Result**:
   - ✅ Desktop notification now appears

### Test 6: Multiple Announcements

1. **Setup**:
   - Open app in Tab 1
   - Switch to another tab
   
2. **Action**:
   - Send 3 announcements quickly from User B
   
3. **Expected Result**:
   - ✅ 3 desktop notifications appear (may stack)
   - ✅ Sound plays for each (with 1-second throttle)
   - ✅ Badge shows "3"

### Test 7: Sound Throttling

1. **Setup**:
   - Open app
   
2. **Action**:
   - Receive 5 announcements within 1 second
   
3. **Expected Result**:
   - ✅ Only 1-2 sounds play (throttled)
   - ✅ All notifications appear
   - ✅ Badge shows correct count

## 🔍 Debugging

### Check Browser Console

Look for these log messages:

**On Permission Request**:
```
[Notification] Permission: granted
```

**On Notification Show**:
```
[Notification] Shown: New Company Announcement
```

**On Sound Play**:
```
[Sound] Played announcement notification sound
```

**On Socket Event**:
```
[Socket] ✅ Connected successfully
```

### Common Issues

#### Issue: No Desktop Notification

**Possible Causes**:
1. Permission denied → Check browser settings
2. Tab is visible → Expected behavior (onlyWhenHidden: true)
3. Self-message → Expected behavior (no self-notification)
4. Socket not connected → Check console for socket errors

**Debug Steps**:
```javascript
// In browser console
console.log('Permission:', Notification.permission);
console.log('Socket connected:', socket.connected);
console.log('Tab visible:', document.visibilityState);
```

#### Issue: No Sound

**Possible Causes**:
1. Autoplay policy blocked → User interaction required first
2. Sound file missing → Check `/public/sounds/announcement.mp3`
3. Volume muted → Check `soundManager.setVolume(0.7)`

**Debug Steps**:
```javascript
// In browser console
soundManager.testAnnouncement();
```

#### Issue: Socket Not Receiving Events

**Possible Causes**:
1. Wrong socket instance → Should import from `../socket` not `../utils/socket`
2. Not authenticated → Check token in socket.auth
3. Not in 'announcements' room → Backend should join room

**Debug Steps**:
```javascript
// In browser console
console.log('Socket ID:', socket.id);
console.log('Socket connected:', socket.connected);
console.log('Socket auth:', socket.auth);
```

## 🎨 Visual Indicators

### Badge States

| State | Visual | Meaning |
|-------|--------|---------|
| No badge | 🔔 | No unread announcements |
| Badge "1" | 🔔¹ | 1 unread announcement |
| Badge "99+" | 🔔⁹⁹⁺ | 99+ unread announcements |

### Notification Appearance

**Desktop Notification**:
```
┌─────────────────────────────────┐
│ 🔔 New Company Announcement     │
│                                 │
│ John Doe: This is an important  │
│ announcement for all employees  │
│                                 │
│ [Company Logo]                  │
└─────────────────────────────────┘
```

## 📊 Comparison: Notifications vs Announcements

| Feature | General Notifications | Announcements |
|---------|----------------------|---------------|
| **Icon** | Bell 🔔 | Megaphone 📢 |
| **Sound** | `notification.mp3` | `announcement.mp3` |
| **Title** | Category-based | "New Company Announcement" |
| **Badge Color** | Red | Red |
| **Socket Event** | `new_notification` | `receiveAnnouncement` |
| **Visibility Rule** | Always show | Only when tab hidden |
| **Self-Notification** | Yes (for some types) | No |

## ✅ Success Criteria

All tests should pass with these results:

- [x] Desktop notification appears when tab is hidden
- [x] Desktop notification does NOT appear when tab is visible
- [x] Sound plays for all announcements (throttled)
- [x] Badge updates correctly
- [x] No self-notifications
- [x] Clicking notification opens dropdown
- [x] Permission prompt appears on first load
- [x] Multiple announcements handled correctly

## 🚀 Production Checklist

Before deploying to production:

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Edge
- [ ] Test in Safari
- [ ] Test on mobile browsers
- [ ] Test with slow network
- [ ] Test with multiple tabs
- [ ] Test with permission denied
- [ ] Test with sound muted
- [ ] Verify sound files exist in production build
- [ ] Verify socket connection in production
- [ ] Monitor error logs for notification failures

## 📝 Notes

- Desktop notifications only work in secure contexts (HTTPS or localhost)
- Some browsers may block notifications if user hasn't interacted with the page
- Sound autoplay may be blocked until user interacts with the page
- Notification appearance varies by OS and browser
- Maximum notification body length is ~100 characters (truncated with "...")
