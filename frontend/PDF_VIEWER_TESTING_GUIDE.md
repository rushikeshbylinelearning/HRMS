# PDF Viewer - Testing Guide

## Quick Test Checklist

### 1. Open Modal
- [ ] Click on any policy in Profile page
- [ ] Modal appears centered in viewport
- [ ] Dark backdrop appears with blur effect
- [ ] Background page is locked (cannot scroll)
- [ ] Smooth entrance animation plays

### 2. Modal Behavior
- [ ] Click backdrop → Modal closes
- [ ] Press ESC key → Modal closes
- [ ] Click X button → Modal closes
- [ ] Modal stays centered when window resized
- [ ] No layout shift when opening/closing

### 3. Toolbar (Sticky)
- [ ] Toolbar visible at top
- [ ] Scroll PDF content down
- [ ] Toolbar stays at top (doesn't scroll away)
- [ ] All buttons clearly visible
- [ ] Page indicator shows current page

### 4. Navigation
- [ ] Click Next → Goes to next page
- [ ] Click Previous → Goes to previous page
- [ ] Previous disabled on page 1
- [ ] Next disabled on last page
- [ ] Page counter updates correctly
- [ ] Content scrolls to top on page change

### 5. Zoom Controls
- [ ] Click Zoom In → PDF gets larger
- [ ] Click Zoom Out → PDF gets smaller
- [ ] Zoom indicator shows percentage
- [ ] Zoom In disabled at 300%
- [ ] Zoom Out disabled at 50%
- [ ] Click Reset → Returns to 100%
- [ ] Click Fit to Width → Optimizes view
- [ ] No layout breaks at any zoom level

### 6. Scrolling
- [ ] Only PDF content scrolls
- [ ] Header stays fixed
- [ ] Toolbar stays fixed
- [ ] Smooth scroll behavior
- [ ] Custom scrollbar visible
- [ ] Background page doesn't scroll

### 7. Keyboard Support
- [ ] Press ESC → Closes modal
- [ ] Tab key navigates buttons
- [ ] Enter/Space activates buttons
- [ ] Focus visible on all elements
- [ ] No keyboard traps

### 8. Responsive (Resize Browser)
- [ ] Desktop (1920px): Large modal, good spacing
- [ ] Laptop (1366px): Comfortable viewing
- [ ] Tablet (768px): Toolbar wraps, still usable
- [ ] Mobile (375px): Full width, touch-friendly

### 9. Loading States
- [ ] Shows spinner while loading
- [ ] "Loading PDF..." message visible
- [ ] Spinner animates smoothly
- [ ] Toolbar disabled during load

### 10. Error Handling
- [ ] Invalid PDF shows error icon
- [ ] Error message displayed
- [ ] Can still close modal
- [ ] No console errors

---

## Visual Inspection

### Header
- Clean typography
- Version and date visible
- Close button has hover effect
- Proper spacing

### Toolbar
- Buttons have clear borders
- Icons are crisp and visible
- Hover effects work (lift + shadow)
- Disabled buttons are faded
- Page/zoom indicators have background

### Content Area
- PDF renders clearly
- White background on PDF
- Shadow around PDF page
- Proper padding
- Scrollbar styled (not default)

### Backdrop
- Dark semi-transparent
- Blur effect visible (if supported)
- Covers entire viewport

---

## Browser Testing

### Chrome/Edge
- [ ] All features work
- [ ] Backdrop blur visible
- [ ] Animations smooth
- [ ] Custom scrollbar visible

### Firefox
- [ ] All features work
- [ ] Backdrop blur visible
- [ ] Animations smooth
- [ ] Custom scrollbar visible

### Safari
- [ ] All features work
- [ ] Backdrop blur visible (with -webkit-)
- [ ] Animations smooth
- [ ] Custom scrollbar visible

---

## Accessibility Testing

### Screen Reader (NVDA/JAWS)
- [ ] Modal announced as dialog
- [ ] Title read correctly
- [ ] Buttons have clear labels
- [ ] Page changes announced
- [ ] Zoom changes announced

### Keyboard Only
- [ ] Can open modal (click policy)
- [ ] Can navigate all buttons
- [ ] Can close with ESC
- [ ] Can close with X button
- [ ] Focus visible at all times
- [ ] No focus traps

### Color Contrast
- [ ] Text passes WCAG AA (4.5:1)
- [ ] Buttons pass WCAG AA
- [ ] Disabled state clear
- [ ] Icons visible

---

## Performance Testing

### Load Time
- [ ] Modal opens instantly
- [ ] PDF loads within 2 seconds
- [ ] No lag when scrolling
- [ ] Zoom is responsive
- [ ] Page changes are instant

### Memory
- [ ] No memory leaks on close
- [ ] Event listeners cleaned up
- [ ] Body styles restored
- [ ] Can open/close multiple times

---

## Edge Cases

### Multiple Opens
- [ ] Open modal
- [ ] Close modal
- [ ] Open again
- [ ] Works correctly
- [ ] No duplicate backdrops

### Window Resize
- [ ] Open modal
- [ ] Resize window
- [ ] Modal stays centered
- [ ] Content adjusts
- [ ] No layout breaks

### Rapid Clicks
- [ ] Click buttons rapidly
- [ ] No errors
- [ ] State updates correctly
- [ ] No race conditions

### Long Documents
- [ ] Open 10+ page PDF
- [ ] Scroll through all pages
- [ ] Navigate to last page
- [ ] Performance stays good
- [ ] Memory usage reasonable

---

## Regression Testing

### Profile Page
- [ ] Profile page loads normally
- [ ] Policy list displays
- [ ] Click policy opens modal
- [ ] Other profile features work
- [ ] No layout shifts

### Other Modals
- [ ] Other modals still work
- [ ] No z-index conflicts
- [ ] No CSS conflicts
- [ ] No JavaScript conflicts

---

## Sign-Off Checklist

Before marking as complete:

- [ ] All critical tests pass
- [ ] No console errors
- [ ] No console warnings
- [ ] Works on all target browsers
- [ ] Works on all screen sizes
- [ ] Accessibility requirements met
- [ ] Performance is acceptable
- [ ] Code is clean and documented
- [ ] No regressions introduced

---

## Common Issues & Solutions

### Issue: Background still scrolls
**Solution:** Check that body overflow is being set to hidden

### Issue: Modal not centered
**Solution:** Check that .pdf-modal-container has proper flexbox

### Issue: Toolbar scrolls away
**Solution:** Check that toolbar has position: sticky

### Issue: Backdrop blur not working
**Solution:** Check browser support, fallback is still functional

### Issue: ESC key doesn't work
**Solution:** Check that event listener is attached and cleaned up

### Issue: Focus trap not working
**Solution:** Check that modalRef.current.focus() is called

---

## Test Data

### Test PDFs
- Small PDF (1-2 pages)
- Medium PDF (5-10 pages)
- Large PDF (20+ pages)
- Invalid PDF (for error testing)

### Test Policies
Use existing policies in the system or create test policies with:
- Different titles
- Different versions
- Different effective dates
- Different file sizes

---

## Automated Testing (Future)

Consider adding:
- Cypress E2E tests for modal behavior
- Jest unit tests for component logic
- Visual regression tests for UI
- Accessibility automated tests (axe-core)

---

## Success Criteria

✅ **Modal feels like a true modal**
- Background locked
- Proper overlay
- Centered and stable

✅ **Toolbar is always accessible**
- Stays visible while scrolling
- Buttons are clear and responsive

✅ **Professional appearance**
- Clean design
- Smooth animations
- Good contrast
- Polished interactions

✅ **Fully accessible**
- Keyboard navigation works
- Screen reader compatible
- WCAG AA compliant

✅ **Responsive**
- Works on all screen sizes
- Touch-friendly on mobile
- Adapts gracefully

✅ **Reliable**
- No errors
- No memory leaks
- Consistent behavior
- Fast performance
