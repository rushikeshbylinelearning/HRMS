# Secure PDF Viewer - Testing Guide

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

This will install:
- `react-pdf@^9.2.1`
- `pdfjs-dist` (peer dependency)

### 2. Start Servers

**Backend**:
```bash
cd backend
npm start
```

**Frontend**:
```bash
cd frontend
npm run dev
```

---

## Employee Testing

### Test 1: View Policy

1. Navigate to: `http://localhost:5173/profile`
2. Look at right sidebar "Policies & Anonymous Feedback"
3. Click any policy
4. **Expected**: Dialog opens with custom PDF viewer

### Test 2: Page Navigation

1. In the PDF viewer, look at toolbar
2. Click "Next" button (>)
3. **Expected**: Page number increases, next page displays
4. Click "Previous" button (<)
5. **Expected**: Page number decreases, previous page displays

### Test 3: Zoom Controls

1. Click "Zoom In" button (+)
2. **Expected**: PDF enlarges, percentage increases
3. Click "Zoom Out" button (-)
4. **Expected**: PDF shrinks, percentage decreases
5. Try zooming to 300% (max)
6. Try zooming to 50% (min)

### Test 4: Security - Right Click

1. Right-click anywhere on the PDF
2. **Expected**: Context menu does NOT appear
3. **If Failed**: Context menu appears (security breach)

### Test 5: Security - Ctrl+S (Save)

1. Press `Ctrl+S` (Windows/Linux) or `Cmd+S` (Mac)
2. **Expected**: Nothing happens, save dialog does NOT open
3. **If Failed**: Save dialog opens (security breach)

### Test 6: Security - Ctrl+P (Print)

1. Press `Ctrl+P` (Windows/Linux) or `Cmd+P` (Mac)
2. **Expected**: Nothing happens, print dialog does NOT open
3. **If Failed**: Print dialog opens (security breach)

### Test 7: Security - Text Selection

1. Try to select text in the PDF
2. **Expected**: Cannot select text, cursor doesn't change
3. **If Failed**: Text can be selected (security breach)

### Test 8: Security - Download Button

1. Look at the toolbar
2. **Expected**: NO download button visible
3. **If Failed**: Download button exists (security breach)

### Test 9: Close Viewer

1. Click the X button in toolbar
2. **Expected**: Dialog closes, returns to policies list
3. Click outside dialog (on dimmed background)
4. **Expected**: Dialog closes
5. Press ESC key
6. **Expected**: Dialog closes

---

## Admin Testing

### Test 1: View Policy (Admin)

1. Login as admin
2. Navigate to: `http://localhost:5173/admin/policies`
3. Click eye icon (👁️) on any policy
4. **Expected**: Dialog opens with custom PDF viewer

### Test 2: Download Button (Admin Only)

1. In the PDF viewer toolbar
2. **Expected**: Download button (⬇️) IS visible
3. Click download button
4. **Expected**: PDF downloads with policy name

### Test 3: All Employee Features

1. Test page navigation → Should work
2. Test zoom controls → Should work
3. Test right-click → Should be disabled
4. Test Ctrl+S → Should be blocked
5. Test text selection → Should be disabled

---

## Visual Verification

### Toolbar Layout

```
┌──────────────────────────────────────────────────────────┐
│ [<] Page 1 of 5 [>] │ [-] 100% [+] │ [⬇️] [X]          │
│                                        ↑    ↑            │
│                                     Admin  Close         │
│                                     Only                 │
└──────────────────────────────────────────────────────────┘
```

**Employee View**:
- Navigation: ✅
- Zoom: ✅
- Download: ❌ (hidden)
- Close: ✅

**Admin View**:
- Navigation: ✅
- Zoom: ✅
- Download: ✅ (visible)
- Close: ✅

### PDF Display

```
┌──────────────────────────────────────────────────────────┐
│                    [Toolbar]                             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│              [PDF Page Rendered on Canvas]               │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Characteristics**:
- Dark gray background (#525659)
- PDF centered
- White page with content
- No browser PDF controls
- No URL bar in PDF area

---

## Browser Testing

### Chrome/Edge

1. Open in Chrome or Edge
2. Run all tests above
3. **Expected**: All tests pass

### Firefox

1. Open in Firefox
2. Run all tests above
3. **Expected**: All tests pass

### Safari

1. Open in Safari (Mac only)
2. Run all tests above
3. **Expected**: All tests pass

---

## Console Checks

### Expected Console Output

```
[Vite] connected.
[Axios] Token auto-restored from sessionStorage
```

### No Errors Should Appear

If you see errors like:
- `Worker not found` → PDF.js worker issue
- `Failed to load PDF` → Backend or network issue
- `Blob error` → Fetch or blob creation issue

---

## Network Tab Checks

### PDF Fetch Request

1. Open DevTools (F12)
2. Go to Network tab
3. Click a policy to view
4. Look for request to `/policies/policy-xxx.pdf`

**Expected**:
```
Request URL: http://localhost:5173/policies/policy-xxx.pdf
Status: 200 OK
Type: application/pdf
Size: [PDF file size]
```

**Headers Should Include**:
```
Authorization: Bearer [token]
```

---

## Security Verification Checklist

### Employee Role

- [ ] Right-click disabled
- [ ] Ctrl+S blocked
- [ ] Ctrl+P blocked
- [ ] Cmd+S blocked (Mac)
- [ ] Cmd+P blocked (Mac)
- [ ] Text selection disabled
- [ ] No download button
- [ ] No direct URL in DOM
- [ ] Cannot open in new tab
- [ ] Cannot save via browser menu

### Admin Role

- [ ] All employee restrictions apply
- [ ] Download button visible
- [ ] Download works correctly
- [ ] Downloaded file has correct name
- [ ] Can still view and navigate

---

## Performance Testing

### Load Time

1. Click policy to open viewer
2. Measure time until PDF displays
3. **Expected**: 1-3 seconds (depends on PDF size)

### Page Navigation Speed

1. Click Next button rapidly
2. **Expected**: Pages change instantly

### Zoom Speed

1. Click Zoom In/Out rapidly
2. **Expected**: Zoom changes instantly

### Memory Usage

1. Open DevTools → Performance → Memory
2. Open PDF viewer
3. Navigate through pages
4. Close viewer
5. **Expected**: Memory released after close

---

## Edge Cases

### Test 1: Very Large PDF

1. Upload a large PDF (>10MB)
2. Try to view it
3. **Expected**: May take longer to load, but should work

### Test 2: Multi-Page PDF

1. Upload a PDF with 50+ pages
2. Navigate to last page
3. **Expected**: Should work, may be slower

### Test 3: Corrupted PDF

1. Upload a corrupted/invalid PDF
2. Try to view it
3. **Expected**: Error message displays

### Test 4: Network Interruption

1. Open PDF viewer
2. Disconnect network
3. Try to navigate pages
4. **Expected**: Current page works, new pages may fail

---

## Troubleshooting

### Issue: Blank PDF Area

**Check**:
1. Browser console for errors
2. Network tab for failed requests
3. PDF file exists in backend

**Fix**:
- Restart backend server
- Clear browser cache
- Check PDF file is valid

### Issue: Worker Error

**Error**: `Setting up fake worker failed`

**Fix**:
```javascript
// Verify in SecurePdfViewer.jsx
pdfjs.GlobalWorkerOptions.workerSrc = 
  `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
```

### Issue: Security Features Not Working

**Check**:
1. Component is mounted
2. Event listeners attached
3. No browser extensions interfering

**Fix**:
- Test in incognito mode
- Disable extensions
- Check console for errors

---

## Success Criteria

### All Tests Must Pass

✅ PDF displays correctly  
✅ Page navigation works  
✅ Zoom controls work  
✅ Right-click disabled  
✅ Ctrl+S blocked  
✅ Ctrl+P blocked  
✅ Text selection disabled  
✅ Download button hidden (employee)  
✅ Download button visible (admin)  
✅ Download works (admin)  
✅ Close button works  
✅ No console errors  
✅ Works in all browsers  

### If All Pass

🎉 **Secure PDF Viewer is working correctly!**

---

## Reporting Issues

If any test fails:

1. **Note the test number**
2. **Capture screenshot**
3. **Copy console errors**
4. **Note browser and version**
5. **Describe expected vs actual behavior**

---

**Last Updated**: February 10, 2026  
**Version**: 1.0  
**Status**: Ready for Testing
