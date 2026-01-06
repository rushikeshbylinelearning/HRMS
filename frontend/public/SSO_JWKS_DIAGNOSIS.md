# SSO JWKS Configuration Error - Comprehensive Diagnosis Guide

## Error Messages

### Error 1: JWKS Endpoint Not Accessible
```
The SSO portal's JWKS endpoint is not accessible. Please contact your administrator.
```

### Error 2: Signing Key Not Found
```
The SSO token's signing key is not available in the SSO portal's JWKS endpoint. 
This usually means the SSO portal has rotated its keys or the token is from a different SSO instance.
```

---

## Quick Diagnosis Checklist

### ✅ Step 1: Verify SSO Portal is Running
```bash
# Check if SSO portal is accessible
curl -I https://sso.bylinelms.com/api/auth/jwks

# Or for local development
curl -I http://localhost:3003/api/auth/jwks
```

**Expected Response:**
- Status: `200 OK`
- Content-Type: `application/json`

**If Failed:**
- Check if SSO backend server is running
- Check firewall/network connectivity
- Verify the SSO portal URL is correct

---

### ✅ Step 2: Test JWKS Endpoint Directly

#### Option A: Using curl
```bash
# Production
curl https://sso.bylinelms.com/api/auth/jwks | jq

# Local Development
curl http://localhost:3003/api/auth/jwks | jq
```

#### Option B: Using Browser
Navigate to:
- Production: `https://sso.bylinelms.com/api/auth/jwks`
- Local: `http://localhost:3003/api/auth/jwks`

**Expected Response:**
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "sso-key-XXXXX",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

**If Empty or Error:**
- Check SSO backend logs for key loading errors
- Verify keys exist in `sso/backend/keys/` directory
- Check if keys are expired (>90 days old)

---

### ✅ Step 3: Check Environment Variables

#### In Attendance System Backend (`attendance-system/backend/.env`):
```bash
# Required SSO Configuration
SSO_ENABLED=true
SSO_ISSUER=sso-portal
SSO_AUDIENCE=sso-apps
SSO_PORTAL_URL=https://sso.bylinelms.com
SSO_JWKS_URL=https://sso.bylinelms.com/api/auth/jwks
```

#### Verify Configuration:
```bash
# Check if variables are set
cd attendance-system/backend
node -e "require('dotenv').config(); console.log('SSO_JWKS_URL:', process.env.SSO_JWKS_URL);"
```

**Common Issues:**
- Missing `SSO_JWKS_URL` variable
- Incorrect URL (wrong port, wrong path)
- Using `http://` instead of `https://` in production
- Trailing slashes in URL

---

### ✅ Step 4: Decode Token to Check Key ID

#### Extract Key ID from Token:
```bash
# Replace YOUR_TOKEN with actual SSO token
TOKEN="YOUR_TOKEN_HERE"
echo $TOKEN | cut -d. -f1 | base64 -d | jq
```

**Expected Output:**
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "sso-key-XXXXX"
}
```

**Note the `kid` value** - this is the key ID that must exist in JWKS.

---

### ✅ Step 5: Compare Token Key ID with JWKS Keys

```bash
# Get all key IDs from JWKS
curl https://sso.bylinelms.com/api/auth/jwks | jq '.keys[].kid'

# Compare with token's kid from Step 4
```

**If Token's `kid` is NOT in JWKS:**
- Token was signed with a rotated/removed key
- Token is from a different SSO instance
- Key was deleted from server

**Solution:** Generate a new SSO token (click the app again in SSO portal)

---

## Detailed Troubleshooting

### Issue 1: JWKS Endpoint Returns HTML Instead of JSON

**Symptoms:**
- Error: `"Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"`
- JWKS endpoint returns HTML error page instead of JSON
- Response contains `<!DOCTYPE html>` instead of `{"keys":[...]}`

**Root Cause:**
- `SSO_JWKS_URL` environment variable is set to wrong endpoint: `/.well-known/jwks.json`
- This endpoint may not be configured or returns an HTML error page
- The primary endpoint is `/api/auth/jwks`

**Solution:**
```bash
# Update .env file in attendance-system/backend/
SSO_JWKS_URL=https://sso.bylinelms.com/api/auth/jwks

# Restart attendance system backend
pm2 restart attendance-backend
```

**Note:** The code now auto-corrects this, but you should update the environment variable.

---

### Issue 2: JWKS Endpoint Returns 404 or Not Found

**Symptoms:**
- `curl` returns 404
- Browser shows "Not Found"
- Network request fails

**Possible Causes:**

1. **Wrong Endpoint Path**
   - SSO portal uses: `/api/auth/jwks` (NOT `/.well-known/jwks.json`)
   - Check `sso/backend/src/routes/jwks.js` for correct route

2. **Server Not Running**
   ```bash
   # Check SSO backend process
   ps aux | grep "node.*server.js"
   
   # Check if port is listening
   netstat -an | grep 3003
   ```

3. **Route Not Registered**
   - Verify `jwks.js` route is imported in `sso/backend/server.js`
   - Check route registration order

4. **CORS Issues**
   - JWKS endpoint should allow CORS: `Access-Control-Allow-Origin: *`
   - Check browser console for CORS errors

**Solutions:**
```bash
# 1. Restart SSO backend
cd sso/backend
pm2 restart sso-backend
# OR
node server.js

# 2. Verify route exists
curl -v https://sso.bylinelms.com/api/auth/jwks

# 3. Check server logs
tail -f sso/backend/logs/combined.log
```

---

### Issue 3: JWKS Endpoint Returns Empty Keys Array

**Symptoms:**
```json
{
  "keys": []
}
```

**Possible Causes:**

1. **No Keys on Disk**
   ```bash
   # Check if keys exist
   ls -la sso/backend/keys/
   ```
   
   **Expected:** Files like `sso-key-*.pem` or `sso-key-*.json`

2. **Keys Expired (>90 Days)**
   - SSO portal automatically excludes keys older than 90 days
   - Check key file creation dates

3. **Key Loading Error**
   - Check SSO backend logs for key loading errors
   - Verify key file format (PEM format)

**Solutions:**
```bash
# 1. Generate new keys
cd sso/backend
node scripts/generate-rsa-keys.js

# 2. Reload keys (if endpoint exists)
curl -X POST https://sso.bylinelms.com/api/sso/reload-keys

# 3. Restart SSO backend to reload keys
pm2 restart sso-backend
```

---

### Issue 4: Token's Key ID Not in JWKS

**Symptoms:**
- Token has `kid: "sso-key-XXXXX"`
- JWKS doesn't contain that key ID
- Error: "Signing key not found for kid"

**Possible Causes:**

1. **Key Rotation**
   - Old token signed with rotated key
   - New keys generated, old keys removed

2. **Token from Different Instance**
   - Token signed by different SSO portal
   - Wrong `SSO_JWKS_URL` configured

3. **Key Deleted**
   - Key file removed from disk
   - Key expired and removed from JWKS

**Solutions:**

1. **Generate Fresh Token (Recommended)**
   - Go to SSO portal
   - Click on the app again
   - New token will use current active key

2. **Check Key Status**
   ```bash
   # Use diagnostic endpoint (if available)
   curl -X POST https://sso.bylinelms.com/api/sso/check-token-key \
     -H "Content-Type: application/json" \
     -d '{"sso_token": "YOUR_TOKEN"}'
   ```

3. **Verify Key Exists**
   ```bash
   # Check if key file exists
   ls -la sso/backend/keys/sso-key-XXXXX*
   
   # Check if key is in JWKS
   curl https://sso.bylinelms.com/api/auth/jwks | jq '.keys[] | select(.kid == "sso-key-XXXXX")'
   ```

---

### Issue 5: Network/Connectivity Issues

**Symptoms:**
- Timeout errors
- Connection refused
- DNS resolution failures

**Diagnosis:**
```bash
# 1. Test DNS resolution
nslookup sso.bylinelms.com

# 2. Test connectivity
ping sso.bylinelms.com

# 3. Test HTTPS
openssl s_client -connect sso.bylinelms.com:443

# 4. Test from attendance system server
curl -v https://sso.bylinelms.com/api/auth/jwks
```

**Solutions:**
- Check firewall rules
- Verify SSL certificate is valid
- Check network connectivity between servers
- Verify reverse proxy (nginx) configuration

---

## Diagnostic Scripts

### Script 1: Test JWKS Connectivity
```bash
# Save as: test-jwks.sh
#!/bin/bash

JWKS_URL="${SSO_JWKS_URL:-https://sso.bylinelms.com/api/auth/jwks}"

echo "Testing JWKS endpoint: $JWKS_URL"
echo ""

# Test connectivity
echo "1. Testing connectivity..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$JWKS_URL")
echo "   HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
  echo "   ❌ JWKS endpoint not accessible!"
  exit 1
fi

# Get JWKS
echo "2. Fetching JWKS..."
JWKS=$(curl -s "$JWKS_URL")

# Check if keys exist
KEY_COUNT=$(echo "$JWKS" | jq '.keys | length')
echo "   Key count: $KEY_COUNT"

if [ "$KEY_COUNT" -eq 0 ]; then
  echo "   ❌ No keys in JWKS!"
  exit 1
fi

# List key IDs
echo "3. Available key IDs:"
echo "$JWKS" | jq -r '.keys[].kid' | while read kid; do
  echo "   - $kid"
done

echo ""
echo "✅ JWKS endpoint is working correctly!"
```

### Script 2: Check Token Key
```bash
# Save as: check-token-key.sh
#!/bin/bash

TOKEN="$1"
JWKS_URL="${SSO_JWKS_URL:-https://sso.bylinelms.com/api/auth/jwks}"

if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <SSO_TOKEN>"
  exit 1
fi

# Decode token header
echo "1. Decoding token header..."
HEADER=$(echo "$TOKEN" | cut -d. -f1 | base64 -d 2>/dev/null)
KID=$(echo "$HEADER" | jq -r '.kid')

if [ -z "$KID" ] || [ "$KID" == "null" ]; then
  echo "   ❌ Token missing key ID (kid)"
  exit 1
fi

echo "   Token Key ID: $KID"
echo ""

# Get JWKS
echo "2. Fetching JWKS..."
JWKS=$(curl -s "$JWKS_URL")
AVAILABLE_KIDS=$(echo "$JWKS" | jq -r '.keys[].kid')

echo "   Available Key IDs:"
echo "$AVAILABLE_KIDS" | while read available_kid; do
  echo "   - $available_kid"
done
echo ""

# Check if token's kid is in JWKS
if echo "$AVAILABLE_KIDS" | grep -q "^$KID$"; then
  echo "✅ Token's key ID is in JWKS!"
else
  echo "❌ Token's key ID NOT found in JWKS!"
  echo "   Solution: Generate a new SSO token"
  exit 1
fi
```

---

## Common Configuration Mistakes

### ❌ Wrong JWKS URL Path
```bash
# WRONG
SSO_JWKS_URL=https://sso.bylinelms.com/.well-known/jwks.json

# CORRECT
SSO_JWKS_URL=https://sso.bylinelms.com/api/auth/jwks
```

### ❌ Missing HTTPS in Production
```bash
# WRONG (in production)
SSO_JWKS_URL=http://sso.bylinelms.com/api/auth/jwks

# CORRECT
SSO_JWKS_URL=https://sso.bylinelms.com/api/auth/jwks
```

### ❌ Trailing Slash
```bash
# WRONG
SSO_JWKS_URL=https://sso.bylinelms.com/api/auth/jwks/

# CORRECT
SSO_JWKS_URL=https://sso.bylinelms.com/api/auth/jwks
```

### ❌ Wrong Port
```bash
# WRONG (if SSO runs on port 3003)
SSO_JWKS_URL=https://sso.bylinelms.com:5000/api/auth/jwks

# CORRECT
SSO_JWKS_URL=https://sso.bylinelms.com/api/auth/jwks
```

---

## Server Logs to Check

### SSO Backend Logs
```bash
# Check for JWKS endpoint access
tail -f sso/backend/logs/combined.log | grep -i jwks

# Check for key loading errors
tail -f sso/backend/logs/combined.log | grep -i "key\|jwks"

# Check for errors
tail -f sso/backend/logs/error.log
```

**Look for:**
- `🔑 JWKS endpoint accessed` - Endpoint is being hit
- `🔑 JWKS generated successfully` - Keys loaded correctly
- `❌ Error generating JWKS` - Key loading failed
- `⚠️ Found X valid key(s) on disk not in JWKS` - Keys not loaded

### Attendance System Backend Logs
```bash
# Check for JWKS fetch errors
tail -f attendance-system/backend/logs/combined.log | grep -i "jwks\|sso"

# Check for token validation errors
tail -f attendance-system/backend/logs/combined.log | grep -i "token\|validation"
```

**Look for:**
- `[SSOAuth] Fetching JWKS from:` - Attempting to fetch
- `[SSOAuth] Failed to fetch JWKS:` - Connection failed
- `[JWT Utils] JWKS ENDPOINT ERROR` - Detailed error info
- `Signing key not found for kid:` - Key ID mismatch

---

## Quick Fixes

### Fix 1: Restart SSO Backend
```bash
cd sso/backend
pm2 restart sso-backend
# OR
pkill -f "node.*server.js" && node server.js
```

### Fix 2: Reload Keys
```bash
# If reload endpoint exists
curl -X POST https://sso.bylinelms.com/api/sso/reload-keys
```

### Fix 3: Generate New Token
1. Go to SSO portal
2. Click on the app
3. New token will use current active key

### Fix 4: Regenerate Keys
```bash
cd sso/backend
node scripts/generate-rsa-keys.js
pm2 restart sso-backend
```

### Fix 5: Update Environment Variables
```bash
cd attendance-system/backend
# Edit .env file
nano .env
# Update SSO_JWKS_URL
# Restart attendance system backend
pm2 restart attendance-backend
```

---

## Verification Steps

After fixing issues, verify:

1. **JWKS Endpoint is Accessible**
   ```bash
   curl https://sso.bylinelms.com/api/auth/jwks | jq '.keys | length'
   # Should return > 0
   ```

2. **Token's Key is in JWKS**
   ```bash
   # Use check-token-key.sh script
   ./check-token-key.sh "YOUR_NEW_TOKEN"
   ```

3. **Token Validation Works**
   - Try SSO login again
   - Check attendance system logs for success
   - Verify user is authenticated

---

## Additional Resources

- **Existing Diagnosis File:** `sso/JWKS_KEY_NOT_FOUND_DIAGNOSIS.md`
- **SSO Backend JWKS Route:** `sso/backend/src/routes/jwks.js`
- **Attendance System JWKS Client:** `attendance-system/backend/utils/jwtUtils.js`
- **SSO Auth Middleware:** `attendance-system/backend/middleware/ssoAuth.js`

---

## Support Checklist

When reporting issues, include:

- [ ] SSO portal URL
- [ ] JWKS endpoint URL
- [ ] HTTP status code from JWKS endpoint
- [ ] Token's key ID (kid)
- [ ] Available key IDs from JWKS
- [ ] SSO backend logs (last 50 lines)
- [ ] Attendance system backend logs (last 50 lines)
- [ ] Environment variables (masked secrets)
- [ ] Network connectivity test results

---

## Summary

**Most Common Issues:**
1. **HTML instead of JSON** → `SSO_JWKS_URL` set to `/.well-known/jwks.json` (should be `/api/auth/jwks`)
2. JWKS endpoint not accessible → Check SSO portal is running
3. Empty JWKS → Check keys exist and are not expired
4. Key ID mismatch → Generate new token
5. Wrong URL → Verify `SSO_JWKS_URL` environment variable

**Quick Solution:**
1. Verify SSO portal is running
2. Test JWKS endpoint directly
3. Generate a fresh SSO token
4. Verify environment variables are correct

