#!/bin/bash

# CORS Fix Verification Script
# Run this after deployment to verify all changes are working

echo "=========================================="
echo "CORS Fix Verification Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Backend Health Check
echo "Test 1: Backend Health Check"
echo "----------------------------"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://attendance.bylinelms.com/api/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Backend is running (HTTP $HEALTH_RESPONSE)${NC}"
else
    echo -e "${RED}✗ Backend health check failed (HTTP $HEALTH_RESPONSE)${NC}"
fi
echo ""

# Test 2: CORS Headers Check
echo "Test 2: CORS Headers Check"
echo "----------------------------"
echo "Testing /api/auth/me endpoint..."
CORS_HEADERS=$(curl -s -I -H "Origin: https://attendance.bylinelms.com" https://attendance.bylinelms.com/api/auth/me)
if echo "$CORS_HEADERS" | grep -q "Access-Control-Allow-Origin"; then
    echo -e "${YELLOW}⚠ CORS headers present (may not be needed for same-origin)${NC}"
    echo "$CORS_HEADERS" | grep "Access-Control"
else
    echo -e "${GREEN}✓ No CORS headers (correct for same-origin requests)${NC}"
fi
echo ""

# Test 3: Check for old domain references
echo "Test 3: Check for Old Domain References"
echo "----------------------------------------"
echo "Checking backend config files..."
OLD_DOMAIN_COUNT=$(grep -r "legatolxp.online" backend/config/ backend/routes/auth.js 2>/dev/null | grep -v "sso.legatolxp.online" | wc -l)
if [ "$OLD_DOMAIN_COUNT" -eq "0" ]; then
    echo -e "${GREEN}✓ No old domain references found (except SSO)${NC}"
else
    echo -e "${RED}✗ Found $OLD_DOMAIN_COUNT references to old domain${NC}"
    grep -r "legatolxp.online" backend/config/ backend/routes/auth.js 2>/dev/null | grep -v "sso.legatolxp.online"
fi
echo ""

# Test 4: Environment Variables Check
echo "Test 4: Environment Variables Check"
echo "------------------------------------"
echo "Checking backend .env..."
if grep -q "FRONTEND_URL=https://attendance.bylinelms.com" backend/.env; then
    echo -e "${GREEN}✓ FRONTEND_URL is correct${NC}"
else
    echo -e "${RED}✗ FRONTEND_URL is incorrect${NC}"
fi

if grep -q "BACKEND_PUBLIC_URL=https://attendance.bylinelms.com" backend/.env; then
    echo -e "${GREEN}✓ BACKEND_PUBLIC_URL is correct${NC}"
else
    echo -e "${RED}✗ BACKEND_PUBLIC_URL is incorrect${NC}"
fi

echo ""
echo "Checking frontend .env..."
if grep -q "VITE_API_BASE_URL=https://attendance.bylinelms.com" frontend/.env; then
    echo -e "${GREEN}✓ VITE_API_BASE_URL is correct${NC}"
else
    echo -e "${RED}✗ VITE_API_BASE_URL is incorrect${NC}"
fi
echo ""

# Test 5: Service Worker Version Check
echo "Test 5: Service Worker Version Check"
echo "-------------------------------------"
if grep -q "v1.0.1" frontend/public/sw.js; then
    echo -e "${GREEN}✓ Service worker version updated to v1.0.1${NC}"
else
    echo -e "${YELLOW}⚠ Service worker version not updated${NC}"
fi
echo ""

# Test 6: Cookie Domain Check
echo "Test 6: Cookie Domain Check"
echo "----------------------------"
if grep -q "cookieOptions.domain = '.bylinelms.com'" backend/routes/auth.js; then
    echo -e "${GREEN}✓ Cookie domain set to .bylinelms.com${NC}"
else
    echo -e "${RED}✗ Cookie domain not set correctly${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Test login in browser (incognito mode)"
echo "2. Check browser DevTools for CORS errors"
echo "3. Verify all API calls go to attendance.bylinelms.com"
echo "4. Test SSO integration"
echo ""
echo "If all tests pass, deployment is successful!"
