# Test Guide - Employee PDF Popup

## Quick Test

### 1. Navigate to Profile Page

```
http://localhost:5173/profile
```

### 2. Locate Policies Section

Look for the right sidebar card titled:
```
Policies & Anonymous Feedback
```

### 3. Click on a Policy

Click on any policy in the "Company Policies" list.

### 4. Verify Dialog Opens

**Expected Behavior:**
- ✅ A large dialog/popup appears
- ✅ Dialog shows policy name and version at top
- ✅ PDF content displays in the dialog
- ✅ Background is dimmed (overlay)
- ✅ Policies list still visible behind dialog
- ✅ Anonymous feedback section still visible behind dialog

### 5. Test Close Functionality

**Method 1: Close Button**
- Click the X button in top-right of dialog
- Dialog should close

**Method 2: Click Outside**
- Click anywhere outside the dialog (on the dimmed background)
- Dialog should close

**Method 3: ESC Key**
- Press ESC key on keyboard
- Dialog should close

### 6. Test Multiple Policies

1. Close the dialog
2. Click a different policy
3. Dialog should open with new PDF
4. Repeat for all policies

## What You Should See

### Before Clicking Policy

```
┌─────────────────────────────────────┐
│ Profile Page                        │
│                                     │
│ ┌─────────────┐  ┌───────────────┐ │
│ │             │  │ Policies &    │ │
│ │  Profile    │  │ Anonymous     │ │
│ │  Info       │  │ Feedback      │ │
│ │             │  │               │ │
│ │             │  │ Company       │ │
│ │             │  │ Policies      │ │
│ │             │  │ ┌───────────┐ │ │
│ │             │  │ │📄 Policy 1│ │ │ ← Click here
│ │             │  │ │📄 Policy 2│ │ │
│ │             │  │ └───────────┘ │ │
│ │             │  │               │ │
│ │             │  │ Anonymous     │ │
│ │             │  │ Message       │ │
│ │             │  │ [Textarea]    │ │
│ └─────────────┘  └───────────────┘ │
└─────────────────────────────────────┘
```

### After Clicking Policy

```
┌─────────────────────────────────────┐
│ Profile Page (Dimmed Background)    │
│                                     │
│ ┌─────────────┐  ┌───────────────┐ │
│ │             │  │ Policies &    │ │
│ │  Profile    │  │ Anonymous     │ │
│ │  Info       │  │ Feedback      │ │
│ │  (Dimmed)   │  │  (Dimmed)     │ │
│ │             │  │               │ │
│ └─────────────┘  └───────────────┘ │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ Leave Policies v1.1    [X] │   │ ← Dialog
│   ├─────────────────────────────┤   │
│   │                             │   │
│   │   [PDF Content Here]        │   │
│   │                             │   │
│   │                             │   │
│   │                             │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Common Issues

### Issue: Dialog Not Opening

**Symptoms:**
- Clicking policy does nothing
- No dialog appears

**Check:**
1. Browser console for errors (F12)
2. Verify frontend server is running
3. Check if policies are loading (list should show)

**Fix:**
- Restart frontend server
- Clear browser cache
- Check browser console for errors

### Issue: PDF Not Displaying in Dialog

**Symptoms:**
- Dialog opens but shows blank/white area
- Dialog shows web application instead of PDF

**Check:**
1. Network tab in DevTools (F12)
2. Look for request to `/policies/policy-xxx.pdf`
3. Check if request returns 200 OK

**Fix:**
- Ensure backend server is running
- Verify Vite proxy is configured
- Check PDF file exists in backend

### Issue: Dialog Too Small

**Symptoms:**
- Dialog is small
- PDF is hard to read

**Expected:**
- Dialog should be large (85% of screen height)
- Dialog should be wide (maxWidth="lg")

**Fix:**
- Already configured in code
- If still small, check browser zoom level

### Issue: Can't Close Dialog

**Symptoms:**
- X button doesn't work
- Clicking outside doesn't work

**Check:**
- Browser console for errors
- Try ESC key

**Fix:**
- Refresh page
- Check browser console

## Browser Compatibility

### Tested Browsers

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari

### Known Issues

- Some browsers may not support inline PDF viewing
- If PDF downloads instead of displaying, browser doesn't support inline PDFs
- Try different browser if issues persist

## Mobile Testing

### Mobile Behavior

On mobile devices:
- Dialog should be full-screen
- PDF should be scrollable
- Close button should be easily accessible

### Test on Mobile

1. Open on mobile device or use browser DevTools mobile emulation
2. Navigate to profile page
3. Click policy
4. Verify dialog is full-screen
5. Verify PDF is readable

## Performance

### Expected Load Times

- Dialog open: Instant
- PDF load: 1-3 seconds (depending on file size)
- Dialog close: Instant

### If Slow

- Check network speed
- Check PDF file size
- Check backend server performance

## Accessibility

### Keyboard Navigation

- ✅ ESC key closes dialog
- ✅ Tab key navigates within dialog
- ✅ Focus trapped in dialog when open

### Screen Readers

- Dialog should announce when opened
- Close button should be labeled
- PDF content may not be fully accessible (browser-dependent)

## Success Checklist

- [ ] Dialog opens when clicking policy
- [ ] PDF displays correctly
- [ ] Dialog is large and readable
- [ ] Close button (X) works
- [ ] Click outside closes dialog
- [ ] ESC key closes dialog
- [ ] Can open different policies
- [ ] Policies list remains visible (dimmed)
- [ ] Anonymous feedback remains visible (dimmed)
- [ ] No console errors
- [ ] Works in Chrome/Firefox/Safari
- [ ] Works on mobile

## If All Tests Pass

✅ **Feature is working correctly!**

The employee PDF viewer popup is now functioning as expected.

---

**Last Updated**: February 10, 2026  
**Status**: Ready for Testing
