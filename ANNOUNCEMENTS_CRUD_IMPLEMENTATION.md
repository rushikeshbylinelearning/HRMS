# Announcements CRUD Operations Implementation

## Overview
Complete CRUD (Create, Read, Update, Delete) operations have been added to the announcements feature with proper permissions, real-time updates, and a polished UI.

## Features Implemented

### 1. Create (Already Existed - Enhanced)
- Users can post new announcements
- Messages are limited to 1000 characters
- Real-time broadcast to all users except sender
- Immediate local update for sender

### 2. Read (Already Existed - Enhanced)
- Fetch last 50 messages
- Messages sorted by pinned status first, then by date
- Proper population of sender information
- Real-time updates when new messages arrive

### 3. Update (NEW)
- Users can edit their own messages
- Admins/HR can edit any message
- Inline editing with textarea
- Real-time broadcast of updates to all users
- Shows "(edited)" indicator on edited messages

### 4. Delete (NEW)
- Users can delete their own messages
- Admins/HR can delete any message
- Confirmation dialog before deletion
- Real-time broadcast of deletions to all users
- Smooth removal animation

### 5. Pin/Unpin (NEW)
- Admin/HR exclusive feature
- Pin important announcements to the top
- Visual indicator for pinned messages (orange border + pin icon)
- Pinned messages always appear first
- Real-time updates when messages are pinned/unpinned

## API Endpoints

### GET /api/announcements
Fetch last 50 announcements
- **Auth**: Required
- **Response**: Array of announcement objects

### POST /api/announcements
Create new announcement
- **Auth**: Required
- **Body**: `{ message: string, type?: string }`
- **Response**: Created announcement object

### PUT /api/announcements/:id
Update announcement
- **Auth**: Required (owner or admin/HR)
- **Body**: `{ message: string }`
- **Response**: Updated announcement object

### DELETE /api/announcements/:id
Delete announcement
- **Auth**: Required (owner or admin/HR)
- **Response**: `{ message: string, id: string }`

### PATCH /api/announcements/:id/pin
Pin/unpin announcement
- **Auth**: Required (admin/HR only)
- **Body**: `{ pinned: boolean }`
- **Response**: Updated announcement object

## Permissions

### Regular Users
- ✅ Create announcements
- ✅ Read all announcements
- ✅ Edit their own messages
- ✅ Delete their own messages
- ❌ Pin/unpin messages
- ❌ Edit others' messages
- ❌ Delete others' messages

### Admin/HR
- ✅ Create announcements
- ✅ Read all announcements
- ✅ Edit any message
- ✅ Delete any message
- ✅ Pin/unpin any message

## Real-Time Socket Events

### Client → Server
- `sendAnnouncement` - Broadcast new message
- `updateAnnouncement` - Broadcast message update
- `deleteAnnouncement` - Broadcast message deletion
- `pinAnnouncement` - Broadcast pin/unpin action

### Server → Client
- `receiveAnnouncement` - New message received
- `announcementUpdated` - Message was updated
- `announcementDeleted` - Message was deleted
- `announcementPinned` - Message was pinned/unpinned

## UI/UX Features

### Message Actions Menu
- Three-dot menu button appears on hover
- Context menu with Edit, Delete, and Pin options
- Positioned relative to message bubble
- Smooth fade-in animation

### Edit Mode
- Inline textarea for editing
- Save and Cancel buttons
- Auto-focus on textarea
- Character limit enforcement (1000 chars)
- Preserves message formatting

### Delete Confirmation
- Browser confirmation dialog
- Prevents accidental deletions
- Clear error messages on failure

### Pinned Messages
- Orange border around pinned messages
- Pin icon next to sender name
- Always sorted to top of list
- Visual distinction from regular messages

### Visual Indicators
- "(edited)" label on edited messages
- Pin icon for pinned messages
- Hover effects on interactive elements
- Smooth animations for all actions

## Technical Implementation

### Backend Changes

#### announcementRoutes.js
```javascript
// New routes added:
PUT /api/announcements/:id - Update message
DELETE /api/announcements/:id - Delete message
PATCH /api/announcements/:id/pin - Pin/unpin message
```

#### socket.js
```javascript
// New socket events:
socket.on('updateAnnouncement', ...)
socket.on('deleteAnnouncement', ...)
socket.on('pinAnnouncement', ...)
```

### Frontend Changes

#### AnnouncementChannel.jsx
- Added state for editing: `editingId`, `editText`, `menuOpen`
- Added permission checks: `canEditDelete()`, `canPin()`
- Added handlers: `handleEdit()`, `handleSaveEdit()`, `handleDelete()`, `handlePin()`
- Added socket listeners for update/delete/pin events
- Enhanced message rendering with action menu

#### AnnouncementDropdown.css
- Added styles for message menu button
- Added styles for dropdown menu
- Added styles for edit mode (textarea + buttons)
- Added styles for pinned messages
- Added hover effects and animations

## Security Considerations

1. **Authorization Checks**
   - Backend validates user permissions before any operation
   - Frontend hides unavailable actions based on role
   - Double-layer security (UI + API)

2. **Input Validation**
   - Message length limited to 1000 characters
   - Empty messages rejected
   - Trimmed whitespace

3. **Error Handling**
   - Graceful error messages
   - Failed operations don't break UI
   - Console logging for debugging

## Testing Checklist

- [x] Regular user can create messages
- [x] Regular user can edit own messages
- [x] Regular user can delete own messages
- [x] Regular user cannot edit others' messages
- [x] Regular user cannot delete others' messages
- [x] Regular user cannot pin messages
- [x] Admin can edit any message
- [x] Admin can delete any message
- [x] Admin can pin/unpin messages
- [x] Real-time updates work for all operations
- [x] Edit mode works correctly
- [x] Delete confirmation appears
- [x] Pinned messages appear at top
- [x] Visual indicators display correctly
- [x] Menu closes after action
- [x] Edited messages show "(edited)" label

## Usage Examples

### Editing a Message
1. Hover over your message
2. Click the three-dot menu button
3. Click "Edit"
4. Modify the text in the textarea
5. Click "Save" or "Cancel"

### Deleting a Message
1. Hover over your message
2. Click the three-dot menu button
3. Click "Delete"
4. Confirm in the dialog

### Pinning a Message (Admin/HR only)
1. Hover over any message
2. Click the three-dot menu button
3. Click "Pin" or "Unpin"
4. Message moves to top/bottom automatically

## Future Enhancements

Potential features to add:
- [ ] Message reactions (emoji reactions)
- [ ] Reply/thread functionality
- [ ] Message search
- [ ] File attachments
- [ ] Rich text formatting
- [ ] Message categories/tags
- [ ] Notification preferences
- [ ] Message history/archive
- [ ] Bulk operations (admin)
- [ ] Message templates

## Files Modified

### Backend
- `backend/routes/announcementRoutes.js` - Added PUT, DELETE, PATCH routes
- `backend/socket.js` - Added socket event handlers

### Frontend
- `frontend/src/components/AnnouncementChannel.jsx` - Added CRUD UI and logic
- `frontend/src/styles/AnnouncementDropdown.css` - Added styles for new features

## Notes

- All operations maintain real-time synchronization across clients
- Permission checks are enforced on both frontend and backend
- UI provides clear feedback for all actions
- Animations enhance user experience without being distracting
- Code follows existing patterns and conventions
