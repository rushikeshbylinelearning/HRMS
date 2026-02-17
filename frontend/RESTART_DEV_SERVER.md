# 🔧 Fix Vite Cache Issue - COMPLETE RESTART REQUIRED

## The Problem
Vite's dependency cache is stale after removing Analytics module files.

## ✅ SOLUTION - Follow These Steps EXACTLY:

### Step 1: Stop Dev Server
Press `Ctrl+C` in your terminal to stop the running dev server.

### Step 2: Clear ALL Caches
Run these commands in your terminal:

```bash
cd frontend

# Clear Vite cache
rm -rf node_modules/.vite

# Clear dist folder
rm -rf dist

# Clear browser cache (or do Step 3)
```

### Step 3: Clear Browser Cache
**Option A - Hard Refresh (Quick):**
- Press `Ctrl+Shift+R` (Windows/Linux)
- Or `Cmd+Shift+R` (Mac)

**Option B - Clear Cache (Thorough):**
- Press `Ctrl+Shift+Delete`
- Select "Cached images and files"
- Click "Clear data"

### Step 4: Restart Dev Server
```bash
npm run dev
```

### Step 5: Refresh Browser
After the dev server starts, do a hard refresh:
- Press `Ctrl+F5` (Windows/Linux)
- Or `Cmd+Shift+R` (Mac)

## ✅ Expected Result
You should see:
- No "Outdated Optimize Dep" errors
- All pages load correctly
- Probation page works at `/probation`

## 🚨 If Still Not Working
Try this nuclear option:

```bash
cd frontend
rm -rf node_modules/.vite
rm -rf dist
npm run dev -- --force
```

Then clear browser cache and hard refresh.

---

**Note:** The `--force` flag forces Vite to rebuild all dependencies from scratch.
