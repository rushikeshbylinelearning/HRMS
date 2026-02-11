# Profile Page - Quick Mutation Check

## ⚡ 30-SECOND VALIDATION

### Before Deploying ANY Profile Page Changes:

```bash
# 1. Start dev server
npm run dev

# 2. Open Profile Page
# http://localhost:3000/profile

# 3. Open browser console (F12)

# 4. Check for warnings (should be NONE):
# ✅ "Mutation detection completed (5s window)"
# ❌ "🚨 CSS MUTATION DETECTED"
# ❌ "🚨 DIMENSION MUTATION DETECTED"
# ❌ "🚨 RESIZE DETECTED"

# 5. Run manual validation:
validateProfileStability()

# 6. Wait 5 seconds, check result:
# ✅ "PASSED: ZERO MUTATIONS DETECTED"
# ❌ "FAILED: MUTATIONS DETECTED"
```

---

## 🚨 COMMON MISTAKES TO AVOID

### ❌ DON'T DO THIS:

```javascript
// ❌ Using sx props (causes runtime style injection)
<Box sx={{ p: 3, m: 2 }}>

// ❌ Using useMediaQuery (causes responsive mutations)
const isMobile = useMediaQuery('(max-width: 768px)');

// ❌ Updating layout state post-mount
useEffect(() => {
  setLayoutWidth(calculateWidth());
}, []);

// ❌ Dynamic grid columns
<div style={{ gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>

// ❌ Conditional layout sections
{isLoaded && <ProfileSection />}
```

### ✅ DO THIS INSTEAD:

```javascript
// ✅ Static CSS classes
<div className="profile-card">

// ✅ No responsive hooks (use CSS media queries)
// CSS: @media (max-width: 768px) { ... }

// ✅ Guard state updates
const layoutLocked = useRef(true);
useEffect(() => {
  if (!layoutLocked.current) return;
  // safe update
}, []);

// ✅ Fixed grid columns
<div className="profile-layout"> // CSS handles grid

// ✅ Always render (use empty states)
<ProfileSection data={data || []} />
```

---

## 🔧 QUICK FIXES

### If Mutation Detected:

1. **Find the element:**
   ```
   Console: "🚨 CSS MUTATION DETECTED { selector: '.profile-card' }"
   ```

2. **Add hard lock in `ProfileLayoutLock.css`:**
   ```css
   .profile-card {
     padding: 24px !important;
     contain: layout style !important;
   }
   ```

3. **Re-test:**
   ```javascript
   validateProfileStability()
   ```

---

## 📊 QUICK METRICS CHECK

### Lighthouse (DevTools → Lighthouse):
- **CLS:** Must be 0.000
- **Performance:** Should be 90+

### Performance Profile (DevTools → Performance):
- **Layout Shifts:** Should be 0 after first paint
- **Recalculate Style:** Should stop after 500ms

---

## 🎯 ACCEPTANCE CRITERIA

Before merging PR:

- [ ] No console warnings
- [ ] `validateProfileStability()` passes
- [ ] Lighthouse CLS = 0
- [ ] No visual shifts observed
- [ ] All tests in testing guide pass

---

## 📞 EMERGENCY CONTACTS

**If mutations persist:**
1. Check `PROFILE_PAGE_ZERO_MUTATION_REPORT.md` (nuclear options)
2. Review `ProfileLayoutLock.css` (add more `!important`)
3. Enable mutation detector in production temporarily

---

## 🔗 FULL DOCUMENTATION

- **Complete Report:** `PROFILE_PAGE_ZERO_MUTATION_REPORT.md`
- **Testing Guide:** `PROFILE_PAGE_MUTATION_TESTING_GUIDE.md`
- **Summary:** `PROFILE_PAGE_MUTATION_ELIMINATION_SUMMARY.md`

---

**Remember:** First paint = Final paint. NO EXCEPTIONS.
