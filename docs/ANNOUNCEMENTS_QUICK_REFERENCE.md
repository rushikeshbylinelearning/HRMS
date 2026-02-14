# Announcements Feature - Quick Reference

## 🎯 What It Does
Real-time company announcements channel accessible from TopBar bell icon.

## 📍 Location
TopBar → Bell Icon (replaced Search button)

## 🔑 Key Files

### Backend
```
backend/models/AnnouncementMessage.js       - Database model
backend/routes/announcementRoutes.js        - API endpoints
backend/socket.js                           - Real-time events
backend/server.js                           - Route registration
```

### Frontend
```
frontend/src/components/AnnouncementDropdown.jsx  - Dropdown wrapper
frontend/src/components/AnnouncementChannel.jsx   - Channel UI
frontend/src/utils/socket.js                      - Socket client
frontend/src/styles/AnnouncementDropdown.css      - Styles
frontend/src/components/TopBar.jsx                - Integration
```

## 🌐 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/announcements` | ✅ | Get last 50 messages |
| POST | `/api/announcements` | ✅ | Post new message |

## 🔌 Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `sendAnnouncement` | Client → Server | Broadcast message |
| `receiveAnnouncement` | Server → Client | Receive message |

## 📊 Message Schema
```javascript
{
  sender: ObjectId,           // User reference
  message: String,            // Max 1000 chars
  pinned: Boolean,            // Default: false
  type: String,               // general, important, holiday, policy
  createdAt: Date,
  updatedAt: Date
}
```

## 🎨 UI Specs

| Property | Desktop | Tablet | Mobile |
|----------|---------|--------|--------|
| Width | 420px | 360px | Full width |
| Height | 500px | 450px | 70vh (max 500px) |
| Position | Right-aligned | Right-aligned | Centered |
| Animation | Slide-down 0.2s | Slide-down 0.2s | Slide-down 0.2s |

## ⌨️ Keyboard Shortcuts
- `Enter` - Send message
- `Shift + Enter` - New line (not implemented, single line only)
- `Esc` - Close dropdown (via click-outside)

## 🔒 Security
- ✅ JWT authentication required
- ✅ Token validation on Socket.IO
- ✅ Message length validation (1000 chars)
- ✅ Empty message rejection
- ✅ Content trimming

## 🐛 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Bell icon not showing | Clear cache, check TopBar.jsx import |
| Messages not loading | Check backend running, verify auth token |
| Real-time not working | Check Socket.IO connection in DevTools |
| Styling broken | Clear cache, verify CSS import |

## 📝 Quick Test
```bash
# 1. Start backend
cd backend && npm start

# 2. Start frontend
cd frontend && npm run dev

# 3. Open browser
# 4. Login
# 5. Click bell icon
# 6. Send message
# 7. Open another tab - verify real-time
```

## 🔧 Quick Disable
```javascript
// In TopBar.jsx, replace:
<AnnouncementDropdown />
// With:
<IconButton className="topbar-icon-btn"><SearchIcon /></IconButton>
```

## 📦 Dependencies (Already Installed)
- Backend: `socket.io`
- Frontend: `socket.io-client`, `lucide-react`

## 🎯 User Permissions
- All authenticated users can:
  - ✅ View messages
  - ✅ Post messages
  - ✅ See real-time updates

## 💾 Database
- Collection: `announcementmessages`
- Indexes: Default `_id`, `createdAt`
- Size: ~1KB per message

## 📈 Monitoring
```javascript
// Check message count
db.announcementmessages.countDocuments()

// View recent messages
db.announcementmessages.find().sort({createdAt: -1}).limit(10)

// Check collection size
db.announcementmessages.stats()
```

## 🚀 Production Checklist
- [x] All files committed
- [x] No environment variables needed
- [x] Socket.IO configured for production
- [x] CORS settings configured
- [x] Authentication working
- [x] No breaking changes

## 📞 Support
- Feature docs: `docs/ANNOUNCEMENTS_FEATURE.md`
- Setup guide: `docs/ANNOUNCEMENTS_SETUP.md`
- Summary: `ANNOUNCEMENTS_IMPLEMENTATION_SUMMARY.md`

---
**Status**: ✅ Production Ready  
**Version**: 1.0  
**Last Updated**: February 2026
