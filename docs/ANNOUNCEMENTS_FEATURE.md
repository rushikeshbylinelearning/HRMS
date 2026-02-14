# Slack-Style Announcements Channel

## Overview
A real-time company announcements channel integrated into the TopBar, replacing the Search button. Features a Slack-like interface with Apple-style animations in a dropdown panel.

## Features
- ✅ Real-time messaging using Socket.IO
- ✅ Slack-style channel interface
- ✅ Apple-style animated dropdown
- ✅ All users can view and post messages
- ✅ Message history (last 50 messages)
- ✅ User avatars and timestamps
- ✅ Responsive design (supports 80% and 100% zoom)
- ✅ No impact on existing routes or functionality

## Architecture

### Backend Components

#### 1. Model: `backend/models/AnnouncementMessage.js`
```javascript
{
  sender: ObjectId (ref: User),
  message: String (max 1000 chars),
  pinned: Boolean,
  type: String (enum: general, important, holiday, policy),
  timestamps: true
}
```

#### 2. Routes: `backend/routes/announcementRoutes.js`
- `GET /api/announcements` - Fetch last 50 messages (sorted by pinned, then date)
- `POST /api/announcements` - Post new message (validates length and content)

#### 3. Socket.IO Integration: `backend/socket.js`
- Users join `announcements` channel on connection
- `sendAnnouncement` event broadcasts to all connected users
- `receiveAnnouncement` event delivers messages in real-time

### Frontend Components

#### 1. Socket Utility: `frontend/src/utils/socket.js`
Configures Socket.IO client with:
- Auto-reconnection
- WebSocket transport priority
- Authentication token support

#### 2. AnnouncementDropdown: `frontend/src/components/AnnouncementDropdown.jsx`
- Bell icon button in TopBar
- Click-outside detection to close
- Smooth animation on open/close

#### 3. AnnouncementChannel: `frontend/src/components/AnnouncementChannel.jsx`
- Message list with auto-scroll
- Real-time message updates
- Input field with character limit (1000)
- User avatars and timestamps
- Loading and empty states

#### 4. Styles: `frontend/src/styles/AnnouncementDropdown.css`
- Apple-style glassmorphism effect
- Smooth animations
- Responsive breakpoints
- Custom scrollbar styling

## Integration Points

### TopBar Integration
The Search button in `frontend/src/components/TopBar.jsx` has been replaced with:
```jsx
<AnnouncementDropdown />
```

### Socket Authentication
Uses existing Socket.IO authentication from `backend/socket.js`:
- Supports both AMS JWT and SSO tokens
- Validates token on connection
- Joins user-specific and role-based rooms

## Security Features

1. **Authentication Required**: All endpoints use `authenticateToken` middleware
2. **Message Validation**: 
   - Empty messages rejected
   - Max length: 1000 characters
   - Content trimmed
3. **User Verification**: Sender verified from JWT token
4. **Socket Authentication**: Token required for Socket.IO connection

## API Endpoints

### GET /api/announcements
**Authentication**: Required  
**Response**: Array of last 50 messages
```json
[
  {
    "_id": "...",
    "sender": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "role": "Employee",
      "profileImage": "..."
    },
    "message": "Welcome to the team!",
    "type": "general",
    "pinned": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

### POST /api/announcements
**Authentication**: Required  
**Body**:
```json
{
  "message": "Your announcement text",
  "type": "general" // optional: general, important, holiday, policy
}
```
**Response**: Created message object with populated sender

## Socket.IO Events

### Client → Server
- `sendAnnouncement`: Broadcast new message to all users

### Server → Client
- `receiveAnnouncement`: Receive new message in real-time

## UI/UX Features

### Animations
- Slide-down animation on open (0.2s ease-out)
- Fade-in for new messages
- Smooth scroll to bottom

### Responsive Design
- Desktop: 420px × 500px
- Tablet: 360px × 450px
- Mobile: Full width × 70vh (max 500px)

### Accessibility
- ARIA labels on buttons
- Keyboard support (Enter to send)
- Focus management
- Screen reader friendly

## Testing Checklist

- [ ] Messages load on dropdown open
- [ ] Real-time updates work across multiple tabs
- [ ] Message sending validates input
- [ ] Empty messages are rejected
- [ ] Long messages (>1000 chars) are rejected
- [ ] Avatars display correctly
- [ ] Timestamps format properly
- [ ] Dropdown closes on outside click
- [ ] Socket reconnects after disconnect
- [ ] Works at 80% and 100% zoom
- [ ] Mobile responsive
- [ ] No console errors
- [ ] Existing routes unaffected

## Future Enhancements

1. **Message Types**: Visual indicators for important/holiday/policy messages
2. **Pinned Messages**: Display pinned messages at top
3. **Reactions**: Add emoji reactions to messages
4. **Mentions**: @mention users in messages
5. **File Attachments**: Share images/documents
6. **Search**: Search message history
7. **Notifications**: Desktop notifications for new messages
8. **Read Receipts**: Track who has seen messages

## Troubleshooting

### Messages not loading
- Check backend server is running
- Verify `/api/announcements` endpoint is accessible
- Check browser console for errors
- Verify authentication token is valid

### Real-time updates not working
- Check Socket.IO connection in browser DevTools
- Verify backend Socket.IO is configured correctly
- Check firewall/proxy settings for WebSocket support
- Ensure token is passed in socket auth

### Styling issues
- Clear browser cache
- Check CSS file is imported
- Verify no conflicting styles
- Test in different browsers

## Dependencies

### Backend
- `socket.io`: ^4.x (already installed)
- `mongoose`: (already installed)
- `express`: (already installed)

### Frontend
- `socket.io-client`: ^4.8.1 (already installed)
- `lucide-react`: ^0.525.0 (already installed)
- `react`: ^18.3.1 (already installed)

## File Structure
```
backend/
├── models/
│   └── AnnouncementMessage.js
├── routes/
│   └── announcementRoutes.js
├── socket.js (modified)
└── server.js (modified)

frontend/
├── src/
│   ├── components/
│   │   ├── AnnouncementDropdown.jsx
│   │   ├── AnnouncementChannel.jsx
│   │   └── TopBar.jsx (modified)
│   ├── utils/
│   │   └── socket.js
│   └── styles/
│       └── AnnouncementDropdown.css
```

## Maintenance Notes

- Messages are stored indefinitely (consider adding cleanup job)
- Socket connections are managed automatically
- No additional cron jobs required
- Monitor MongoDB collection size for `announcementmessages`
