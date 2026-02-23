# Vite Cache Issue Fix

## Problem
Error: `Failed to fetch dynamically imported module` or `504 (Outdated Optimize Dep)`

This occurs when Vite's dependency optimization cache becomes stale after:
- Installing/updating npm packages
- Switching branches
- Making changes to dependencies

## Solution

### Quick Fix (Recommended)
1. Stop the dev server (Ctrl+C)
2. Clear Vite cache:
   ```bash
   # Windows PowerShell
   cd frontend
   Remove-Item -Recurse -Force node_modules/.vite
   Remove-Item -Recurse -Force dist
   
   # Linux/Mac
   cd frontend
   rm -rf node_modules/.vite
   rm -rf dist
   ```
3. Restart the dev server:
   ```bash
   npm run dev
   ```

### Alternative: Force Vite to Re-optimize
```bash
cd frontend
npm run dev -- --force
```

### If Issue Persists
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. If still failing, clear node_modules and reinstall:
   ```bash
   cd frontend
   Remove-Item -Recurse -Force node_modules
   npm install
   npm run dev
   ```

## Prevention
- Always restart dev server after installing new packages
- Use `npm run dev -- --force` when switching branches
- Clear cache regularly during active development

## What Was Fixed
✅ Cleared `node_modules/.vite` cache
✅ Cleared `dist` folder
✅ Ready for fresh dev server start

## Next Steps
1. Start the frontend dev server: `cd frontend && npm run dev`
2. The pages should now load correctly
3. All attendance override fixes are in place and ready to test
