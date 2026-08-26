# Dynamic Policy Acknowledgement - Testing Guide

## 🧪 Quick Start Testing

Follow these steps to test the dynamic policy acknowledgement feature end-to-end.

---

## 📋 Prerequisites

Before testing, ensure:
- ✅ Backend server is running (`npm start` in backend folder)
- ✅ Frontend server is running (`npm start` in frontend folder)
- ✅ MongoDB is running and accessible
- ✅ You have admin and employee test accounts
- ✅ At least one active policy exists in the system

---

## 🔧 Test Environment Setup

### Step 1: Create Test Data

**Create Test Policy** (if needed):
1. Log in as Admin
2. Navigate to **Admin → Policies**
3. Upload a test policy PDF
   - Name: "Test Policy for Acknowledgement"
   - Version: "1.0"
   - Status: Active
4. Note the policy ID for reference

**Verify Test Employees**:
1. Navigate to **Admin → Employees**
2. Ensure you have at least 2 active employees:
   - One for individual assignment test
   - One for bulk assignment test
3. Note employee codes/IDs

---

## 🎯 Test Scenarios

### Test Case 1: Assign Policy to Single Employee

**Objective**: Verify policy can be assigned to a specific employee

**Steps**:
1. **As Admin**:
   ```
   a. Navigate to Admin → Policies → Onboarding Compliance tab
   b. Click "Assign Policy to Employees" button
   c. Modal should open
   d. Select "Test Policy for Acknowledgement v1.0"
   e. In "Select Employees", search and select one employee
   f. Set deadline to 7 days from now
   g. Click "Assign Policy"
   ```

2. **Verify**:
   ```
   ✓ Success message displays: "Successfully assigned: 1"
   ✓ No errors in console
   ✓ Modal closes automatically
   ```

3. **As the Assigned Employee**:
   ```
   a. Log out and log in as the assigned employee
   b. Dashboard loads
   c. Pending policy banner should display:
      "1 Policy Awaiting Your Acknowledgement"
   d. Policy name and deadline visible in banner
   e. "Review Now" button present
   ```

**Expected Result**: ✅ Policy successfully assigned and visible to employee

---

### Test Case 2: Acknowledge Policy (Happy Path)

**Objective**: Complete full acknowledgement flow

**Steps**:
1. **From Previous Test** (logged in as employee with pending policy):
   ```
   a. Click "Review Now" button on banner
   b. StandalonePolicyModal opens
   c. Policy viewer displays policy content
   ```

2. **Read Policy**:
   ```
   a. Observe reading timer starting
   b. Scroll through policy document
   c. Scroll all the way to bottom
   d. Wait until at least 60 seconds have passed
   ```

3. **Acknowledge**:
   ```
   a. Check the acknowledgement checkbox
   b. "Accept & Acknowledge" button should now be enabled
   c. Click "Accept & Acknowledge"
   ```

4. **Verify**:
   ```
   ✓ Modal closes
   ✓ Banner disappears from dashboard
   ✓ Success notification appears
   ✓ No errors in console
   ```

5. **As Admin** (verify acceptance):
   ```
   a. Go to Admin → Policies → Onboarding Compliance
   b. Find the employee in compliance dashboard
   c. Status should show "Completed"
   d. Click to view timeline
   e. Verify events: assigned → reading_started → reading_completed → policy_accepted
   ```

**Expected Result**: ✅ Policy acknowledged successfully with complete audit trail

---

### Test Case 3: Validation - Insufficient Reading Time

**Objective**: Verify reading time validation works

**Steps**:
1. **Setup**: Assign a new policy to employee (follow Test Case 1)
2. **As Employee**:
   ```
   a. Click "Review Now" on banner
   b. Modal opens
   c. Scroll to bottom immediately (within 10 seconds)
   d. Check acknowledgement box
   e. Try to click "Accept & Acknowledge"
   ```

3. **Verify**:
   ```
   ✓ Error message displays: "Minimum reading time not met"
   ✓ Shows required time (60s) vs recorded time
   ✓ Modal remains open
   ✓ Policy still pending
   ```

**Expected Result**: ✅ Validation prevents premature acknowledgement

---

### Test Case 4: Validation - No Scroll to Bottom

**Objective**: Verify scroll validation works

**Steps**:
1. **Setup**: Use same pending policy from Test Case 3
2. **As Employee**:
   ```
   a. Modal still open
   b. Stay at top of document (don't scroll)
   c. Wait 60+ seconds
   d. Check acknowledgement box
   e. Try to click "Accept & Acknowledge"
   ```

3. **Verify**:
   ```
   ✓ Error message displays: "You must scroll to the bottom"
   ✓ Modal remains open
   ✓ Policy still pending
   ```

**Expected Result**: ✅ Validation enforces full document review

---

### Test Case 5: Validation - No Checkbox

**Objective**: Verify checkbox requirement

**Steps**:
1. **Setup**: Continue from Test Case 4
2. **As Employee**:
   ```
   a. Scroll to bottom of document
   b. Wait 60+ seconds
   c. Leave checkbox UNCHECKED
   d. Try to click "Accept & Acknowledge"
   ```

3. **Verify**:
   ```
   ✓ Error message displays: "You must acknowledge..."
   ✓ Modal remains open
   ✓ Policy still pending
   ```

**Expected Result**: ✅ Explicit acknowledgement required

---

### Test Case 6: Assign to All Employees

**Objective**: Verify bulk assignment works

**Steps**:
1. **As Admin**:
   ```
   a. Navigate to Admin → Policies → Onboarding Compliance
   b. Click "Assign Policy to Employees"
   c. Select a policy
   d. Toggle "Assign to All Active Employees" switch ON
   e. Employee selector should disable
   f. Info alert shows: "This will assign to X employees"
   g. Set deadline
   h. Click "Assign Policy"
   ```

2. **Verify**:
   ```
   ✓ Success message shows count of assignments
   ✓ Lists any already accepted or failed
   ✓ Modal closes
   ```

3. **As Different Employees**:
   ```
   a. Log in as multiple different employees
   b. Each should see the pending policy banner
   c. Policy name and deadline should be consistent
   ```

**Expected Result**: ✅ Policy assigned to all active employees

---

### Test Case 7: Multiple Pending Policies

**Objective**: Verify handling of multiple assignments

**Steps**:
1. **As Admin**:
   ```
   a. Assign Policy A to employee
   b. Assign Policy B to same employee
   c. Both with different deadlines
   ```

2. **As Employee**:
   ```
   a. Log in
   b. Banner should show: "2 Policies Awaiting..."
   c. Both policies listed with deadlines
   d. Click "Review Now"
   e. Modal opens with first policy
   f. Acknowledge first policy
   g. Modal should show second policy automatically
   ```

3. **Verify**:
   ```
   ✓ Banner count decreases after each acknowledgement
   ✓ Modal cycles through all pending policies
   ✓ Banner disappears when all acknowledged
   ```

**Expected Result**: ✅ Multiple policies handled sequentially

---

### Test Case 8: Overdue Policy Display

**Objective**: Verify overdue indicator works

**Steps**:
1. **Setup** (using database or API):
   ```
   a. Manually create a PolicyAcceptanceLog with:
      - deadline: Yesterday's date
      - accepted: false
   OR
   b. Assign policy with very short deadline (e.g., 1 hour)
   c. Wait for deadline to pass
   ```

2. **As Employee**:
   ```
   a. Log in
   b. Banner should display in RED
   c. "1 Overdue" chip visible
   d. More urgent messaging
   ```

3. **Verify**:
   ```
   ✓ Banner severity is "error" (red)
   ✓ Overdue count displayed
   ✓ Urgent call-to-action
   ```

**Expected Result**: ✅ Overdue policies highlighted prominently

---

### Test Case 9: Duplicate Assignment Prevention

**Objective**: Verify system handles reassignment gracefully

**Steps**:
1. **As Admin**:
   ```
   a. Assign Policy X to Employee A
   b. Immediately assign same Policy X to Employee A again
      (same version)
   ```

2. **Verify**:
   ```
   ✓ Second assignment updates the first one
   ✓ Only one PolicyAcceptanceLog exists
   ✓ Deadline updated to new value
   ✓ Timeline shows "policy_reassigned" event
   ```

3. **As Employee A**:
   ```
   a. Should see only ONE pending policy
   b. Not duplicated
   ```

**Expected Result**: ✅ Duplicate assignments handled intelligently

---

### Test Case 10: Already Accepted Policy

**Objective**: Verify system skips already-accepted policies

**Steps**:
1. **Setup**:
   ```
   a. Employee B has already accepted Policy Y
   ```

2. **As Admin**:
   ```
   a. Try to assign Policy Y to Employee B again
      (same version)
   ```

3. **Verify**:
   ```
   ✓ Success message shows:
     "Already accepted: 1"
   ✓ No new PolicyAcceptanceLog created
   ✓ Employee doesn't see duplicate
   ```

**Expected Result**: ✅ Already-accepted policies skipped

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: Banner Doesn't Appear

**Symptoms**: Employee logs in but no banner shows despite pending policy

**Debug Steps**:
1. Open browser DevTools Console
2. Check for errors in console
3. Verify API call: `GET /api/onboarding/pending-policies`
4. Check response - should have `pendingPolicies` array
5. Verify employee role is not Admin/HR

**Fix**:
- Check PolicyAcceptanceLog in database
- Ensure `accepted: false`
- Verify `userId` matches employee
- Check employee `isActive: true`

---

### Issue 2: Modal Doesn't Open

**Symptoms**: Click "Review Now" but nothing happens

**Debug Steps**:
1. Check console for errors
2. Verify `currentStandalonePolicy` in OnboardingContext
3. Check `standalonePolicyModalOpen` state

**Fix**:
- Ensure OnboardingContext properly initialized
- Check StandalonePolicyModal imported in App.jsx
- Verify modal not blocked by CSS/z-index issues

---

### Issue 3: Policy Content Not Loading

**Symptoms**: Modal opens but policy viewer empty

**Debug Steps**:
1. Check network tab for policy fetch request
2. Verify policy ID exists
3. Check GridFS for policy file

**Fix**:
- Ensure PolicyViewer component receives correct policyId
- Verify GridFS configuration
- Check file exists in database

---

### Issue 4: Accept Button Stays Disabled

**Symptoms**: Met all requirements but button remains disabled

**Debug Steps**:
1. Check state in React DevTools:
   - `scrolledToBottom` should be `true`
   - `acknowledged` should be `true`
   - `readingStartTime` should exist
   - Reading duration >= 60000ms

**Fix**:
- Verify scroll event handler working
- Check timer calculation logic
- Ensure checkbox state updates

---

### Issue 5: Acceptance Fails

**Symptoms**: Click "Accept" but gets error

**Debug Steps**:
1. Check error message details
2. Review network request payload
3. Check backend validation logs

**Fix**:
- Ensure all required fields sent
- Verify policy version matches
- Check policy still active
- Confirm reading time >= 60 seconds

---

## 📊 Test Data Verification

### Check Database Records

**PolicyAcceptanceLog Collection**:
```javascript
// Find pending policies for a user
db.policyacceptancelogs.find({
  userId: ObjectId("..."),
  accepted: false
})

// Find accepted policies
db.policyacceptancelogs.find({
  userId: ObjectId("..."),
  accepted: true
})

// View timeline
db.policyacceptancelogs.findOne({
  _id: ObjectId("...")
}).timeline
```

**Expected Fields**:
- `status`: 'pending' → 'in_progress' → 'completed'
- `timeline`: Array of events
- `readingDurationSeconds`: Number (should be >= 60)
- `ipAddress`: String
- `userAgent`: String
- `deviceType`: 'Desktop'|'Mobile'|'Tablet'
- `browser`: String

---

## ✅ Acceptance Criteria Checklist

### Admin Features
- [ ] Can assign policy to single employee
- [ ] Can assign policy to multiple employees
- [ ] Can assign policy to all employees
- [ ] Deadline picker works
- [ ] Success/failure reporting accurate
- [ ] Notifications sent on assignment
- [ ] Compliance dashboard shows assignments
- [ ] Export includes new assignments

### Employee Features
- [ ] Banner displays pending policies
- [ ] Count and list accurate
- [ ] Overdue indicator works
- [ ] Modal opens on click
- [ ] Policy content loads correctly
- [ ] Reading timer displays
- [ ] Scroll validation works
- [ ] Time validation works (60s minimum)
- [ ] Checkbox validation works
- [ ] Acceptance successful
- [ ] Banner disappears after acceptance
- [ ] Confirmation notification sent

### Edge Cases
- [ ] Multiple pending policies handled
- [ ] Duplicate assignments prevented
- [ ] Already-accepted skipped
- [ ] Invalid policy version rejected
- [ ] Inactive policy rejected
- [ ] Network errors handled gracefully

### Security
- [ ] Auth required on all endpoints
- [ ] Admin/HR role verified for assignment
- [ ] User can only see own pending policies
- [ ] IP and user agent logged
- [ ] Complete audit trail recorded

### Performance
- [ ] Bulk assignment completes reasonably
- [ ] Dashboard loads quickly
- [ ] Modal opens without delay
- [ ] Policy PDF loads acceptably
- [ ] No memory leaks on modal open/close

---

## 🚀 Automated Testing (Future)

### Unit Tests Needed

```javascript
// Backend
describe('onboardingController', () => {
  describe('assignPolicyToUsers', () => {
    it('should create PolicyAcceptanceLog for each user')
    it('should skip already-accepted policies')
    it('should update existing pending logs')
    it('should send notifications')
  })
  
  describe('standaloneAcceptPolicy', () => {
    it('should validate reading time >= 60s')
    it('should validate scrolledToBottom = true')
    it('should validate checkbox = true')
    it('should update status to completed')
    it('should record IP and user agent')
  })
})

// Frontend
describe('StandalonePolicyModal', () => {
  it('should track reading time')
  it('should track scroll position')
  it('should disable accept until requirements met')
  it('should show validation errors')
  it('should call acceptStandalonePolicy on submit')
})

describe('PendingPolicyBanner', () => {
  it('should display when policies pending')
  it('should not display when no pending')
  it('should show overdue indicator')
  it('should open modal on click')
})
```

---

## 📈 Performance Benchmarks

Target metrics:
- Policy assignment: < 2s for 100 employees
- Dashboard load with banner: < 1s
- Modal open: < 500ms
- Policy PDF load: < 2s
- Acceptance submit: < 1s

---

## 🎓 User Acceptance Testing (UAT)

### UAT Session Plan

**Participants**:
- 1 Admin user
- 3 Employee users
- 1 QA tester
- 1 Product owner

**Duration**: 1-2 hours

**Agenda**:
1. Walkthrough (15 min)
2. Admin testing (20 min)
3. Employee testing (30 min)
4. Edge case testing (20 min)
5. Feedback collection (15 min)

**Success Criteria**:
- All participants can complete workflows
- No critical bugs found
- User feedback positive
- Performance acceptable

---

## 📝 Test Report Template

```markdown
# Test Report - Dynamic Policy Acknowledgement

**Date**: [DATE]
**Tester**: [NAME]
**Environment**: [DEV/STAGING/PROD]

## Summary
- Total Test Cases: X
- Passed: X
- Failed: X
- Blocked: X

## Test Results

### Test Case 1: Assign to Single Employee
- Status: [PASS/FAIL]
- Notes: [...]

### Test Case 2: Acknowledge Policy
- Status: [PASS/FAIL]
- Notes: [...]

[Continue for all test cases]

## Issues Found
1. [Issue description] - Severity: [High/Medium/Low]
2. [Issue description] - Severity: [High/Medium/Low]

## Recommendations
- [...]

## Sign-off
Tester: _____________ Date: _______
QA Lead: _____________ Date: _______
```

---

**Testing Status**: Ready for QA  
**Last Updated**: August 13, 2026  
**Version**: 1.0.0
