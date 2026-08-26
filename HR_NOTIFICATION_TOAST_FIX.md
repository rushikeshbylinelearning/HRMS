# HR Query Notifications - Desktop Toast Fix

**Date:** August 13, 2026  
**Status:** ✅ FIXED - Desktop toasts now working

---

## Issue

Desktop notification toasts were not appearing when:
- Employee creates new HR query
- Employee sends message to HR
- HR/Admin responds to query

The notifications were being created in the database but not emitted via Socket.IO, so no desktop toast appeared.

---

## Root Cause

**Problem:** Direct database creation without Socket.IO emission

The code was using direct `NewNotification.create()` which:
- ✅ Creates notification in database
- ❌ Does NOT emit Socket.IO event
- ❌ Does NOT trigger desktop toast

**What was happening:**
```javascript
// WRONG - No Socket.IO emission
await NewNotification.create({
    id: uuidv4(),
    message: 'New HR Query: ...',
    type: 'hr_query_new',
    // ... other fields
});
```

**What should happen:**
```javascript
// CORRECT - Emits Socket.IO event
await NewNotificationService.broadcastToAdmins({
    message: 'New HR Query: ...',
    type: 'hr_query_new',
    // ... other fields
});
```

---

## Solution

**Use `NewNotificationService` methods instead of direct database creation**

The `NewNotificationService` provides two key methods:

### 1. `createAndEmitNotification()` - For individual users
```javascript
await NewNotificationService.createAndEmitNotification({
    message: 'Your message here',
    userId: employeeId,
    userName: employeeName,
    type: 'hr_query_response',
    recipientType: 'user',
    category: 'hr_query',
    priority: 'high',
    // ... other fields
});
```

**What it does:**
1. Creates notification in database
2. Emits Socket.IO event to user's room: `user_{userId}`
3. Desktop toast appears immediately

### 2. `broadcastToAdmins()` - For Admin/HR users
```javascript
await NewNotificationService.broadcastToAdmins({
    message: 'New HR Query: ...',
    type: 'hr_query_new',
    category: 'hr_query',
    priority: 'high',
    // ... other fields
}, originatingUserId); // Optional: exclude self from notification
```

**What it does:**
1. Creates ONE notification in database (with `userId: null`)
2. Finds all Admin/HR users
3. Emits Socket.IO event to each admin's room
4. Desktop toasts appear for all admins (except originating user)

---

## Changes Made

### File: `backend/routes/hrQueries.js`

#### 1. **Updated Imports**
```javascript
// BEFORE
const NewNotification = require('../models/NewNotification');
const { v4: uuidv4 } = require('uuid');

// AFTER
const NewNotificationService = require('../services/NewNotificationService');
```

#### 2. **Employee Creates Query** (Line ~65)
```javascript
// BEFORE
await NewNotification.create({
    id: uuidv4(),
    message: `New HR Query: ${subject}`,
    userId: req.user.userId,
    userName: employee.fullName,
    recipientType: 'admin',
    // ... full notification object
});

// AFTER
await NewNotificationService.broadcastToAdmins({
    message: `New HR Query: ${subject}`,
    type: 'hr_query_new',
    category: 'hr_query',
    priority: 'high',
    // ... essential fields only
}, req.user.userId); // Exclude employee from notification
```

#### 3. **Employee Sends Message** (Line ~105)
```javascript
// BEFORE
await NewNotification.create({
    id: uuidv4(),
    message: `New message in HR Query: ${query.subject}`,
    userId: req.user.userId,
    userName: employee.fullName,
    recipientType: 'admin',
    // ... full notification object
});

// AFTER
await NewNotificationService.broadcastToAdmins({
    message: `New message in HR Query: ${query.subject}`,
    type: 'hr_query_response',
    category: 'hr_query',
    priority: 'medium',
    // ... essential fields only
}, req.user.userId); // Exclude employee from notification
```

#### 4. **HR/Admin Responds** (Line ~265)
```javascript
// BEFORE
await NewNotification.create({
    id: uuidv4(),
    message: `${responder.fullName} responded to your query: ${query.subject}`,
    userId: query.employeeId,
    userName: responder.fullName,
    recipientType: 'user',
    // ... full notification object
});

// AFTER
await NewNotificationService.createAndEmitNotification({
    message: notifMessage,
    userId: query.employeeId,
    userName: responder.fullName,
    type: 'hr_query_response',
    recipientType: 'user',
    category: 'hr_query',
    priority: 'high',
    // ... essential fields only
});
```

---

## How It Works Now

### Socket.IO Event Flow:

```
1. Employee creates HR query
   ↓
2. Backend calls NewNotificationService.broadcastToAdmins()
   ↓
3. Service creates notification in DB (userId: null, recipientType: 'admin')
   ↓
4. Service finds all Admin/HR users
   ↓
5. For each admin: io.to('user_123').emit('new_notification', notification)
   ↓
6. Frontend Socket.IO client receives event
   ↓
7. Desktop toast appears ("New HR Query: ...")
   ↓
8. Notification drawer updates with unread badge
```

### Desktop Toast Appearance:

**For Admin/HR (when employee messages):**
```
╔═══════════════════════════════════╗
║ 🔔 New HR Query                  ║
║                                   ║
║ Need help with leave request      ║
║                                   ║
║ Just now                          ║
╚═══════════════════════════════════╝
```

**For Employee (when HR responds):**
```
╔═══════════════════════════════════╗
║ 🔔 HR Response                   ║
║                                   ║
║ John Doe responded to your        ║
║ query: Need help with leave       ║
║                                   ║
║ Just now                          ║
╚═══════════════════════════════════╝
```

---

## Benefits of Using NewNotificationService

### 1. **Automatic Socket.IO Emission**
- ✅ Desktop toasts appear automatically
- ✅ No manual `io.emit()` needed
- ✅ Handles room targeting (`user_{userId}`)

### 2. **Automatic ID Generation**
- ✅ No need for `uuid` import
- ✅ Generates unique IDs automatically
- ✅ Format: `notif_1234567890_abc123xyz`

### 3. **Broadcasting Support**
- ✅ `broadcastToAdmins()` finds all Admin/HR users
- ✅ Emits to multiple rooms simultaneously
- ✅ Excludes originating user (no self-notification)

### 4. **Error Handling**
- ✅ Built-in try-catch for notification creation
- ✅ Validation error messages
- ✅ Graceful fallback if Socket.IO unavailable

### 5. **Consistent Patterns**
- ✅ Same API as other notification types (leave, break, attendance)
- ✅ Easier to maintain
- ✅ Less code duplication

---

## Testing

### Test Cases:

#### 1. **Employee Creates Query**
```
STEPS:
1. Login as employee
2. Go to HR Queries page
3. Click "New Query"
4. Fill form: Subject, Category, Message
5. Click Submit

EXPECTED:
✅ Query created successfully
✅ Admin/HR sees desktop toast notification
✅ Notification drawer shows unread badge
✅ Click notification → Floating chat opens → Query opens
```

#### 2. **Employee Sends Message**
```
STEPS:
1. Login as employee
2. Open existing query
3. Type message
4. Click Send

EXPECTED:
✅ Message sent successfully
✅ Admin/HR sees desktop toast notification
✅ Toast shows: "New message in HR Query: [subject]"
✅ Click notification → Floating chat opens → Query opens with new message
```

#### 3. **HR/Admin Responds**
```
STEPS:
1. Login as Admin/HR
2. Click floating chat FAB
3. Open query
4. Type response
5. Press Enter

EXPECTED:
✅ Response sent successfully
✅ Employee sees desktop toast notification
✅ Toast shows: "[HR Name] responded to your query: [subject]"
✅ Click notification → HR Query page opens → Query opens with response
```

#### 4. **Multiple Admins**
```
STEPS:
1. Have 2+ Admin/HR users logged in
2. Employee creates query or sends message

EXPECTED:
✅ ALL Admin/HR users see desktop toast (except sender if admin)
✅ All toasts appear simultaneously
✅ Each admin can click their notification independently
```

---

## Socket.IO Architecture

### Room Naming:
```javascript
user_123456789abc  // Individual user room
user_987654321xyz  // Another user room
```

### Event Flow:
```
Backend                          Frontend
--------                         ---------
NewNotificationService           Socket.IO Client
       ↓                                ↓
createNotification()              socket.on('new_notification')
       ↓                                ↓
io.to('user_123')                 Show desktop toast
  .emit('new_notification')       Update notification drawer
       ↓                                ↓
Socket.IO Server                  User sees notification
       ↓
Multiple clients receive
(if multiple tabs open)
```

### Connection Flow:
```
1. User logs in
   ↓
2. Frontend establishes Socket.IO connection
   ↓
3. Frontend joins room: socket.join(`user_${userId}`)
   ↓
4. Backend can now emit to: io.to(`user_${userId}`)
   ↓
5. All tabs for this user receive event
   ↓
6. Desktop toast appears in all tabs
```

---

## Debugging

### Check if Socket.IO is connected:
```javascript
// Frontend (Browser Console)
console.log('Socket connected:', socket.connected);
console.log('Socket ID:', socket.id);
```

### Check if room joined:
```javascript
// Backend logs should show:
[Socket.IO] User 123456789abc joined room: user_123456789abc
```

### Check if event emitted:
```javascript
// Backend logs should show:
[SVC] Emitting 'new_notification' to room: user_123456789abc
[SVC] Event emitted to user_123456789abc
```

### Check if event received:
```javascript
// Frontend (Browser Console)
socket.on('new_notification', (data) => {
    console.log('Received notification:', data);
});
```

### Common Issues:

#### Issue: No toast appears
**Check:**
1. ✅ Socket.IO connected (`socket.connected === true`)
2. ✅ User joined their room
3. ✅ Backend emitting to correct room
4. ✅ Frontend listening to `new_notification` event

#### Issue: Toast appears but no sound
**Check:**
1. ✅ Browser notification permissions granted
2. ✅ System volume not muted
3. ✅ Do Not Disturb mode disabled

#### Issue: Multiple toasts for same notification
**Check:**
1. ✅ Multiple browser tabs open (expected behavior)
2. ✅ Frontend not registering duplicate listeners

---

## Performance Considerations

### Database Operations:
```
broadcastToAdmins():
- 1 DB write (create notification)
- 1 DB read (find all Admin/HR users)
- N Socket.IO emissions (N = number of admins)

createAndEmitNotification():
- 1 DB write (create notification)
- 1 Socket.IO emission
```

### Optimization:
- ✅ Admins cached in memory (no DB query per emission)
- ✅ One notification document per event (not one per admin)
- ✅ Parallel emissions (non-blocking)

---

## Migration Notes

### No Breaking Changes:
- ✅ Existing notifications still work
- ✅ Database schema unchanged
- ✅ Frontend code unchanged
- ✅ Socket.IO infrastructure already in place

### Backward Compatibility:
- ✅ Old notifications remain in database
- ✅ New notifications use same format
- ✅ All notification types work together

---

## Conclusion

Desktop toast notifications now work correctly for HR Query messages by using the existing `NewNotificationService` infrastructure instead of direct database creation. This ensures:

1. ✅ **Socket.IO Emission**: Events emitted to correct rooms
2. ✅ **Desktop Toasts**: Appear immediately for all relevant users
3. ✅ **Notification Drawer**: Updates with unread badges
4. ✅ **Consistency**: Same pattern as other notification types
5. ✅ **Reliability**: Built-in error handling and validation

**Status:** ✅ Complete and working

---

## Quick Reference

### For Admins (broadcastToAdmins):
```javascript
await NewNotificationService.broadcastToAdmins({
    message: 'Your message',
    type: 'hr_query_new' | 'hr_query_response',
    category: 'hr_query',
    priority: 'high' | 'medium' | 'low',
    actionData: { actionType, actionUrl, requiresAction },
    navigationData: { page, params },
    metadata: { queryId, queryCategory, status }
}, originatingUserId); // Optional: exclude self
```

### For Employees (createAndEmitNotification):
```javascript
await NewNotificationService.createAndEmitNotification({
    message: 'Your message',
    userId: employeeId,
    userName: employeeName,
    type: 'hr_query_response',
    recipientType: 'user',
    category: 'hr_query',
    priority: 'high',
    actionData: { actionType, actionUrl, requiresAction },
    navigationData: { page, params },
    metadata: { queryId, queryCategory, status }
});
```

---

**Last Updated:** August 13, 2026
