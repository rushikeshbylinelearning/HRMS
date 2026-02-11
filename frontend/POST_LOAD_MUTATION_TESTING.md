# Post-Load Mutation Testing Guide

## ⚡ QUICK TEST (30 seconds)

```bash
# 1. Start dev server
npm run dev

# 2. Open Profile page
# http://localhost:3000/profile

# 3. Open console (F12)

# 4. Wait 10 seconds

# 5. Check output:
# ✅ "AUDIT PASSED: NO MUTATIONS DETECTED"
# ❌ "AUDIT FAILED: X ISSUES DETECTED"
```

---

## 🔍 DETAILED TESTING

### Test 1: Component Remount Detection

**What to Check:**
```
Console output should show:
✅ Component mounted: ProfilePage
```

**Failure:**
```
🚨 COMPONENT REMOUNT DETECTED: ProfilePage (mount #2)
```

**If Failed:**
- Check React StrictMode (causes double mount in DEV)
- Check for conditional rendering
- Check for route changes

---

### Test 2: API Call Tracking

**What to Check:**
```
Console output should show:
📡 API CALL: /api/policies at XXXms after load
```

**Should Only Appear ONCE**

**If Multiple Calls:**
- Check useEffect dependencies
- Check for context re-renders
- Check for prefetch interference

---

### Test 3: Style Mutation Detection

**What to Check:**
```
Console should NOT show:
🚨 STYLE MUTATION DETECTED
```

**If Detected:**
- Check which element mutated
- Check for MUI sx props
- Check for inline style changes
- Add containment to parent

---

### Test 4: DOM Structure Mutation

**What to Check:**
```
Console should NOT show:
🚨 DOM STRUCTURE MUTATION
```

**If Detected:**
- Check for conditional rendering
- Check for lazy-loaded components
- Check for dynamic content

---

### Test 5: PageTransition Disabled

**What to Check:**
- Navigate to Profile page
- Should appear INSTANTLY (no fade/slide)
- No animation delay

**If Animated:**
- Check NO_TRANSITION_ROUTES in PageTransition.jsx
- Verify route path matches exactly

---

### Test 6: Prefetch Disabled

**What to Check:**
```
Console should show:
[Prefetch] Skipping protected route: /profile
```

**If Prefetched:**
- Check NO_PREFETCH_ROUTES in prefetch.js
- Verify route path matches exactly

---

### Test 7: Font Loading Stability

**What to Check:**
- Open DevTools → Network tab
- Filter by "Font"
- Refresh page
- Fonts should load with Priority: High
- No layout shift during font load

**If Shifted:**
- Check font preload in index.html
- Check line-height locks
- Check font-display: swap

---

### Test 8: CSS Load Order

**What to Check:**
- Open DevTools → Network tab
- Filter by "CSS"
- Refresh page
- ProfileLayoutLock.css should load EARLY (via index.css)

**If Late:**
- Check @import in index.css (first line)
- Check for lazy CSS loading

---

### Test 9: Lighthouse CLS Score

**Steps:**
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Performance" category
4. Click "Analyze page load"
5. Check "Cumulative Layout Shift" metric

**Expected:**
```
CLS: 0.000 (green)
```

**If > 0:**
- Run audit to identify source
- Check Performance tab for Layout Shift events
- Apply additional containment

---

### Test 10: Visual Inspection

**Steps:**
1. Screen record page load
2. Play back at 0.25x speed
3. Watch for ANY visual movement

**Expected:**
- Page renders ONCE
- No spacing changes
- No section shifts
- No grid recalculations

**If Shifted:**
- Identify which element moved
- Check console for mutation logs
- Add dimension locks

---

## 📊 AUDIT REPORT INTERPRETATION

### ✅ PASS Example:
```
📊 LAYOUT MUTATION AUDIT REPORT
═══════════════════════════════════════════════════════════

🔄 COMPONENT REMOUNTS:
   ✅ ProfilePage: 1 mount

📡 API CALLS AFTER LOAD:
   ⚠️  /api/policies at 234.56ms

🚨 LAYOUT MUTATIONS:
   ✅ No layout mutations detected

✅ AUDIT PASSED: NO MUTATIONS DETECTED
```

**Analysis:**
- ✅ Single mount (correct)
- ⚠️ One API call (acceptable, tracked)
- ✅ No mutations (perfect)

---

### ❌ FAIL Example:
```
📊 LAYOUT MUTATION AUDIT REPORT
═══════════════════════════════════════════════════════════

🔄 COMPONENT REMOUNTS:
   ❌ ProfilePage: 2 mounts (SHOULD BE 1)

📡 API CALLS AFTER LOAD:
   ⚠️  /api/policies at 234.56ms
   ⚠️  /api/policies at 1234.56ms
   ⚠️  /api/auth/me at 567.89ms

🚨 LAYOUT MUTATIONS:
   ❌ Style mutations: 3
   ❌ Class mutations: 1
   ❌ DOM mutations: 2

   Detailed log:
   1. STYLE_MUTATION: { element: 'profile-card', ... }
   2. STYLE_MUTATION: { element: 'profile-layout', ... }
   3. CLASS_MUTATION: { element: 'DIV', ... }

❌ AUDIT FAILED: 9 ISSUES DETECTED
```

**Analysis:**
- ❌ Double mount (FIX REQUIRED)
- ❌ Multiple API calls (FIX REQUIRED)
- ❌ Style mutations (FIX REQUIRED)

**Actions:**
1. Fix component remount (check routing)
2. Prevent duplicate API calls (check useEffect)
3. Add containment to mutating elements

---

## 🔧 DEBUGGING WORKFLOW

### If Audit Fails:

1. **Identify Issue Type:**
   - Component remount?
   - API call duplication?
   - Style mutation?
   - DOM mutation?

2. **Locate Source:**
   - Check console stack traces
   - Check element className
   - Check timing (when did it happen?)

3. **Apply Fix:**
   - Remount → Check routing/conditional rendering
   - API → Check useEffect dependencies
   - Style → Add containment or !important
   - DOM → Check for dynamic content

4. **Re-test:**
   - Refresh page
   - Wait for audit
   - Verify fix worked

5. **Iterate:**
   - Repeat until audit passes

---

## 🎯 ACCEPTANCE CRITERIA

**Profile Page is READY when:**

- [ ] Audit passes with 0 issues
- [ ] Component mounts ONCE
- [ ] API calls tracked (acceptable)
- [ ] No style mutations
- [ ] No DOM mutations
- [ ] PageTransition disabled
- [ ] Prefetch disabled
- [ ] Fonts load without shift
- [ ] Lighthouse CLS = 0.000
- [ ] Visual inspection shows no shifts

---

## 📞 SUPPORT

**If issues persist:**

1. Check `POST_LOAD_MUTATION_FIX_REPORT.md` for detailed fixes
2. Run manual audit: `auditLayoutMutations()`
3. Check console for specific errors
4. Apply nuclear options (disable all transitions/prefetch)

---

**Last Updated:** 2026-02-10  
**Status:** ✅ READY FOR TESTING
