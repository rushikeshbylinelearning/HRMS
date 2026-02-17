# Fix CIF Status - Do This Now

## The Problem
Status is not changing because the server hasn't been restarted with the new code.

## The Solution (2 Steps)

### Step 1: Restart Backend Server
```bash
pm2 restart all
```

Wait 5 seconds, then check:
```bash
pm2 logs --lines 10
```

You should see:
- ✅ "MongoDB connection ready"
- ✅ "Server started"

### Step 2: Hard Refresh Browser
Press: **Ctrl + Shift + R** (Windows/Linux) or **Cmd + Shift + R** (Mac)

## Test It

1. Open the CIF record (BYL_CIF_02)
2. Click "Change Status" button
3. You should now see "Closed" in the dropdown
4. Select "Closed"
5. Enter reason: "Test closure"
6. Click "Confirm"
7. Status should change to "CLOSED"

## If It Still Doesn't Work

Open browser DevTools (F12) and check:

**Console Tab:**
- Any red errors?
- Screenshot and share

**Network Tab:**
- Try changing status
- Look for `PATCH /api/admin/cif/.../status`
- What's the status code? (200 = success, 400/500 = error)
- Screenshot and share

---

**That's it!** Just restart the server and refresh the browser.
