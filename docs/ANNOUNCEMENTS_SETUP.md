# Announcements Feature - Setup Guide

## Quick Start

The Slack-style Announcements Channel has been fully implemented and integrated into your application. Follow these steps to verify and test the feature.

## What Was Changed

### Backend Changes
1. ✅ Created `AnnouncementMessage` model
2. ✅ Created `/api/announcements` routes (GET, POST)
3. ✅ Integrated Socket.IO announcements channel
4. ✅ Registered routes in `server.js`

### Frontend Changes
1. ✅ Created socket utility (`utils/socket.js`)
2. ✅ Created `AnnouncementDropdown` component
3. ✅ Created `AnnouncementChannel` component
4. ✅ Created CSS styles
5. ✅ Replaced Search button with Announcements in TopBar

## No Installation Required

All dependencies are already installed:
- ✅ `socket.io` (backend)
- ✅ `socket.io-client` (frontend)
- ✅ `lucide-react` (frontend)

## Testing the Feature

### 1. Start the Backend
```bash
cd backend
npm start
```

### 2. Start the Frontend
```bash
cd frontend
npm run dev
```

### 3. Test the Feature

1. **Open the application** in your browser
2. **Login** with any user account
3. **Look for the Bell icon** in the TopBar (where Search used to be)
4. **Click the Bell icon** to open the announcements dropdown
5. **Type a message** and click Send or press Enter
6. **Open another tab/browser** and verify real-time updates work

### 4. Multi-User Testing

To test real-time functionality:
1. Open the app in two different browsers (or incognito mode)
2. Login with different users
3. Send a message from one user
4. Verify it appears instantly for the other user

## Verification Checklist

- [ ] Bell icon appears in TopBar
- [ ] Clicking bell opens dropdown panel
- [ ] Dropdown has smooth animation
- [ ] Messages load when opening dropdown
- [ ] Can type and send messages
- [ ] Messages appear in real-time
- [ ] User avatars display correctly
- [ ] Timestamps show relative time
- [ ] Dropdown closes when clicking outside
- [ ] No console errors
- [ ] Existing features still work (notifications, profile, etc.)

## API Testing

### Test GET endpoint
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/announcements
```

### Test POST endpoint
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test announcement"}' \
  http://localhost:5000/api/announcements
```

## Socket.IO Testing

Open browser DevTools → Network → WS (WebSocket) tab:
- Should see connection to `/api/socket.io/`
- Status should be "101 Switching Protocols"
- Connection should stay open

## Common Issues & Solutions

### Issue: Bell icon not showing
**Solution**: Clear browser cache and refresh

### Issue: Messages not loading
**Solution**: 
- Check backend is running
- Verify MongoDB is connected
- Check browser console for errors

### Issue: Real-time updates not working
**Solution**:
- Check Socket.IO connection in DevTools
- Verify token is valid
- Check firewall/proxy settings

### Issue: Styling looks wrong
**Solution**:
- Clear browser cache
- Check CSS file is imported
- Verify no conflicting styles

## Database

The feature creates a new collection: `announcementmessages`

To view messages in MongoDB:
```javascript
db.announcementmessages.find().sort({createdAt: -1}).limit(10)
```

## Rollback (if needed)

If you need to temporarily disable the feature:

1. **Revert TopBar changes**:
```jsx
// In frontend/src/components/TopBar.jsx
// Replace:
<AnnouncementDropdown />
// With:
<IconButton className="topbar-icon-btn"><SearchIcon /></IconButton>
```

2. **Comment out route in server.js**:
```javascript
// app.use('/api/announcements', announcementRoutes);
```

## Production Deployment

Before deploying to production:

1. ✅ All files are already in place
2. ✅ No additional environment variables needed
3. ✅ Socket.IO is already configured for production
4. ✅ CORS settings are already configured

Just deploy as usual:
```bash
# Backend
cd backend
npm run build  # if you have a build script
pm2 restart backend  # or your process manager

# Frontend
cd frontend
npm run build
# Deploy dist folder to your hosting
```

## Monitoring

Monitor these metrics in production:
- Socket.IO connection count
- Message creation rate
- MongoDB collection size
- API response times for `/api/announcements`

## Support

For issues or questions:
1. Check the troubleshooting section in `ANNOUNCEMENTS_FEATURE.md`
2. Review browser console for errors
3. Check backend logs for Socket.IO connection issues
4. Verify MongoDB connection and collection

## Next Steps

The feature is ready to use! Consider these enhancements:
- Add message types (important, holiday, policy)
- Implement pinned messages
- Add emoji reactions
- Enable file attachments
- Add search functionality
