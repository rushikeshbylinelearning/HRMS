# PDF Viewer - Scrolling Guide

## Visual Guide to Continuous Scrolling

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│ Leave Policy v1.3                              [X]      │ ← Header (Fixed)
├─────────────────────────────────────────────────────────┤
│ [<] Page 2 of 6 [>]  [-] 100% [+] [↻] [⊞]            │ ← Toolbar (Sticky)
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │                                               │    │
│  │  Page 1 Content                              │    │
│  │  Lorem ipsum dolor sit amet...               │    │
│  │                                               │    │
│  └───────────────────────────────────────────────┘    │
│              [ Page 1 of 6 ]                           │ ← Badge
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │                                               │    │
│  │  Page 2 Content ← Currently in view          │    │
│  │  Consectetur adipiscing elit...              │    │
│  │                                               │    │
│  └───────────────────────────────────────────────┘    │
│              [ Page 2 of 6 ]                           │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │                                               │    │
│  │  Page 3 Content                              │    │
│  │  Sed do eiusmod tempor...                    │    │
│  │                                               │    │
│  └───────────────────────────────────────────────┘    │
│              [ Page 3 of 6 ]                           │
│                                                         │
│  ... (continues for all pages)                         │
│                                                         │
│  ┌───────────────────────────────────────────────┐    │
│  │                                               │    │
│  │  Page 6 Content                              │    │
│  │  Final page content...                       │    │
│  │                                               │    │
│  └───────────────────────────────────────────────┘    │
│              [ Page 6 of 6 ]                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
         ↑ Scroll bar (smooth scrolling)
```

---

## User Interactions

### 1. Natural Scrolling

**Action**: User scrolls with mouse wheel or trackpad

```
Initial State:
┌─────────────────┐
│ [<] Page 1 of 6 │ ← Toolbar shows page 1
├─────────────────┤
│ Page 1 Content  │ ← Visible
│                 │
│ Page 2 Content  │ ← Partially visible
└─────────────────┘

User scrolls down ↓

New State:
┌─────────────────┐
│ [<] Page 2 of 6 │ ← Toolbar updates to page 2
├─────────────────┤
│ Page 2 Content  │ ← Now fully visible
│                 │
│ Page 3 Content  │ ← Partially visible
└─────────────────┘
```

**Result**: 
- Smooth, continuous scrolling
- Toolbar updates automatically
- No page breaks or jumps

---

### 2. Next Button Navigation

**Action**: User clicks Next button

```
Before Click:
┌─────────────────┐
│ [<] Page 2 of 6 │ ← Currently on page 2
├─────────────────┤
│ Page 2 Content  │ ← Visible
│                 │
│ Page 3 Content  │ ← Partially visible
└─────────────────┘

User clicks [>] Next button

Animation (smooth scroll):
┌─────────────────┐
│ [<] Page 3 of 6 │ ← Updates during scroll
├─────────────────┤
│ Page 2 Content  │ ↑ Scrolling up
│                 │ ↑
│ Page 3 Content  │ ← Coming into view
└─────────────────┘

After Click:
┌─────────────────┐
│ [<] Page 3 of 6 │ ← Now on page 3
├─────────────────┤
│ Page 3 Content  │ ← Fully visible at top
│                 │
│ Page 4 Content  │ ← Partially visible
└─────────────────┘
```

**Result**:
- Smooth scroll animation to next page
- Page 3 scrolls to top of view
- Toolbar updates to show page 3

---

### 3. Previous Button Navigation

**Action**: User clicks Previous button

```
Before Click:
┌─────────────────┐
│ [<] Page 4 of 6 │ ← Currently on page 4
├─────────────────┤
│ Page 4 Content  │ ← Visible
│                 │
│ Page 5 Content  │ ← Partially visible
└─────────────────┘

User clicks [<] Previous button

Animation (smooth scroll):
┌─────────────────┐
│ [<] Page 3 of 6 │ ← Updates during scroll
├─────────────────┤
│ Page 3 Content  │ ↓ Scrolling down
│                 │ ↓
│ Page 4 Content  │ ← Moving down
└─────────────────┘

After Click:
┌─────────────────┐
│ [<] Page 3 of 6 │ ← Now on page 3
├─────────────────┤
│ Page 3 Content  │ ← Fully visible at top
│                 │
│ Page 4 Content  │ ← Partially visible
└─────────────────┘
```

**Result**:
- Smooth scroll animation to previous page
- Page 3 scrolls to top of view
- Toolbar updates to show page 3

---

### 4. Zoom Behavior

**Action**: User clicks Zoom In

```
Before Zoom (100%):
┌─────────────────┐
│ [-] 100% [+]    │
├─────────────────┤
│ ┌─────────────┐ │
│ │ Page 1      │ │ ← Normal size
│ │ Content     │ │
│ └─────────────┘ │
│                 │
│ ┌─────────────┐ │
│ │ Page 2      │ │
│ │ Content     │ │
│ └─────────────┘ │
└─────────────────┘

User clicks [+] Zoom In

After Zoom (120%):
┌─────────────────┐
│ [-] 120% [+]    │
├─────────────────┤
│ ┌───────────────│ ← Larger
│ │ Page 1        │
│ │ Content       │
│ │               │
│ └───────────────│
│                 │
│ ┌───────────────│
│ │ Page 2        │
│ │ Content       │
└─────────────────┘
```

**Result**:
- All pages zoom together
- Scroll position maintained
- Can still scroll through all pages
- Toolbar remains visible

---

## Page Tracking Logic

### How Current Page is Calculated

```javascript
// Scroll position tracking
const scrollTop = 200;        // Current scroll position
const scrollHeight = 1000;    // Total scrollable height
const clientHeight = 400;     // Visible area height

// Calculate scroll percentage
const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
// = 200 / (1000 - 400) = 200 / 600 = 0.33 (33%)

// Calculate current page
const numPages = 6;
const currentPage = Math.ceil(scrollPercentage * numPages);
// = Math.ceil(0.33 * 6) = Math.ceil(1.98) = 2

// Result: Page 2 is current
```

### Visual Representation

```
Scroll Position:
┌─────────────────┐ ← Top (0%)
│ Page 1          │
│                 │ ← 16% (Page 1)
├─────────────────┤
│ Page 2          │
│                 │ ← 33% (Page 2) ← User is here
├─────────────────┤
│ Page 3          │
│                 │ ← 50% (Page 3)
├─────────────────┤
│ Page 4          │
│                 │ ← 66% (Page 4)
├─────────────────┤
│ Page 5          │
│                 │ ← 83% (Page 5)
├─────────────────┤
│ Page 6          │
│                 │ ← 100% (Page 6)
└─────────────────┘ ← Bottom (100%)
```

---

## Button States

### At First Page

```
┌─────────────────────────────────┐
│ [<] Page 1 of 6 [>]            │
│  ↑              ↑               │
│  Disabled       Enabled         │
└─────────────────────────────────┘

Previous button is grayed out (disabled)
Next button is active (enabled)
```

### At Middle Page

```
┌─────────────────────────────────┐
│ [<] Page 3 of 6 [>]            │
│  ↑              ↑               │
│  Enabled        Enabled         │
└─────────────────────────────────┘

Both buttons are active (enabled)
```

### At Last Page

```
┌─────────────────────────────────┐
│ [<] Page 6 of 6 [>]            │
│  ↑              ↑               │
│  Enabled        Disabled        │
└─────────────────────────────────┘

Previous button is active (enabled)
Next button is grayed out (disabled)
```

---

## Mobile Experience

### Touch Scrolling

```
┌─────────────────┐
│ Toolbar         │
├─────────────────┤
│ Page 1          │
│                 │ ← User swipes up
│ Page 2          │    ↑
│                 │    ↑
│ Page 3          │    ↑
└─────────────────┘

Natural touch scrolling
Momentum scrolling supported
Smooth and responsive
```

### Pinch to Zoom

```
Before Pinch:
┌─────────────────┐
│ ┌─────────────┐ │
│ │ Page        │ │
│ │ Content     │ │
│ └─────────────┘ │
└─────────────────┘

User pinches out (zoom in):
┌─────────────────┐
│ ┌───────────────│
│ │ Page          │
│ │ Content       │
│ │               │
└─────────────────┘

Browser native pinch-to-zoom works
```

---

## Keyboard Navigation (Future)

### Potential Shortcuts

```
Arrow Down    → Scroll down
Arrow Up      → Scroll up
Page Down     → Next page (smooth scroll)
Page Up       → Previous page (smooth scroll)
Home          → First page
End           → Last page
Space         → Scroll down one screen
Shift+Space   → Scroll up one screen
```

---

## Performance Indicators

### Loading States

```
Initial Load:
┌─────────────────┐
│ [Loading PDF...] │ ← Spinner
│      ⟳          │
└─────────────────┘

Pages Loading:
┌─────────────────┐
│ Page 1 ✓        │ ← Loaded
│                 │
│ Page 2 ⟳        │ ← Loading
│                 │
│ Page 3 ...      │ ← Waiting
└─────────────────┘

All Loaded:
┌─────────────────┐
│ Page 1 ✓        │
│ Page 2 ✓        │
│ Page 3 ✓        │
│ ... all pages   │
└─────────────────┘
```

---

## Edge Cases

### Single Page Document

```
┌─────────────────────────────────┐
│ [<] Page 1 of 1 [>]            │
│  ↑              ↑               │
│  Disabled       Disabled        │
├─────────────────────────────────┤
│ Page 1 Content                  │
│                                 │
│ (No scrolling needed)           │
└─────────────────────────────────┘

Both buttons disabled
No scrolling required
```

### Very Long Page

```
┌─────────────────┐
│ [<] Page 1 of 2 │
├─────────────────┤
│ Page 1          │
│ Very            │
│ Long            │
│ Content         │ ← Scrolling within page
│ ...             │
│ ...             │
│ ...             │
│ Still Page 1    │
├─────────────────┤
│ Page 2          │
└─────────────────┘

Toolbar shows Page 1 until
user scrolls past midpoint
```

---

## Best Practices

### For Users

✅ **DO**: Scroll naturally to read
✅ **DO**: Use buttons for quick jumps
✅ **DO**: Zoom to comfortable size
✅ **DO**: Use page badges for reference

❌ **DON'T**: Expect instant page changes
❌ **DON'T**: Scroll too fast (may miss content)

### For Developers

✅ **DO**: Test with various document sizes
✅ **DO**: Monitor scroll performance
✅ **DO**: Verify page tracking accuracy
✅ **DO**: Test on mobile devices

❌ **DON'T**: Modify scroll behavior without testing
❌ **DON'T**: Remove page badges (user orientation)
❌ **DON'T**: Disable smooth scrolling

---

## Troubleshooting

### Issue: Page indicator not updating

**Check**:
- Scroll event listener attached?
- Calculation logic correct?
- numPages loaded?

### Issue: Buttons not scrolling

**Check**:
- pageRefs populated?
- scrollIntoView supported?
- Smooth behavior enabled?

### Issue: Jerky scrolling

**Check**:
- CSS scroll-behavior: smooth?
- Too many pages loading?
- Browser performance?

---

## Summary

The continuous scrolling feature provides:

✅ **Natural reading** - scroll like any document
✅ **Smart tracking** - always know your position
✅ **Quick navigation** - buttons for precise jumps
✅ **Visual feedback** - badges and indicators
✅ **Smooth experience** - no jarring transitions

**Result**: A professional PDF viewer that matches industry standards and provides an excellent user experience.
