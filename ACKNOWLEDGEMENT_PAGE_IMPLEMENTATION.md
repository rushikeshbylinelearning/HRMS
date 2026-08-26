# Policy Acknowledgement Page - Complete Implementation Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [User Journey](#user-journey)
7. [Technical Flow](#technical-flow)
8. [Validation & Security](#validation--security)
9. [Notification System](#notification-system)
10. [State Management](#state-management)
11. [Database Schema](#database-schema)
12. [API Reference](#api-reference)

---

## Overview

The Policy Acknowledgement system is a comprehensive feature that allows administrators to assign policies to employees and track their acknowledgement. It supports two distinct flows:

1. **Onboarding Flow**: Mandatory policy acknowledgement for new employees during their first login
2. **Standalone Flow**: Dynamic policy assignment to existing employees at any time

### Key Features
- ✅ Read time tracking (minimum 60 seconds)
- ✅ Scroll-to-bottom validation
- ✅ Explicit checkbox acknowledgement
- ✅ IP address and device tracking
- ✅ Complete audit trail
- ✅ Deadline management
- ✅ Email and in-app notifications
- ✅ Overdue alerts
- ✅ Bulk assignment capabilities

---

## Architecture

### High-Level Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      ADMIN INTERFACE                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │  PolicyAssignmentModal                             │     │
│  │  - Select policy                                   │     │
│  │  - Choose employees or "Assign to All"            │     │
│  │  - Set deadline                                    │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓
                   [Backend API Call]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND CONTROLLER                        │
│  - assignPolicyToUsers() / assignPolicyToAll()              │
│  - Create PolicyAcceptanceLog entries                       │
│  - Send notifications                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
                   [Database Write]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 EMPLOYEE NOTIFICATION                        │
│  - Email notification                                       │
│  - In-app notification                                      │
│  - Dashboard banner alert                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
                  [Employee Opens Modal]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  EMPLOYEE INTERFACE                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │  PendingPolicyBanner (Dashboard)                   │     │
│  │  - Shows count of pending policies                │     │
│  │  - Highlights overdue policies                    │     │
│  │  - "Review Now" button                            │     │
│  └────────────────────────────────────────────────────┘     │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐     │
│  │  StandalonePolicyModal                             │     │
│  │  - PDF Viewer                                     │     │
│  │  - Reading timer                                  │     │
│  │  - Scroll tracker                                 │     │
│  │  - Acknowledgement checkbox                       │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓
                   [Accept & Acknowledge]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               BACKEND VALIDATION & STORAGE                   │
│  - Validate reading time (≥ 60 seconds)                    │
│  - Validate scroll completion                               │
│  - Validate checkbox state                                  │
│  - Update PolicyAcceptanceLog                               │
│  - Record IP, user agent, timestamp                         │
│  - Send confirmation notification                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Policy Assignment Flow (Admin)

```
Admin Action
    ↓
Opens PolicyAssignmentModal
    ↓
Selects policy + employees/all + deadline
    ↓
POST /api/onboarding/admin/assign-policy-to-users
OR
POST /api/onboarding/admin/assign-policy-to-all
    ↓
Backend: assignPolicyToUsers() / assignPolicyToAll()
    ↓
For each employee:
    ├─ Check if already accepted → Skip
    ├─ Create/Update PolicyAcceptanceLog
    │   {
    │     userId, policyId, policyVersion,
    │     accepted: false,
    │     status: 'pending',
    │     deadline,
    │     timeline: [{ event: 'policy_assigned', ... }]
    │   }
    └─ Send notification via NewNotificationService
        {
          type: 'policy_assignment',
          priority: 'high',
          message: "New policy requires your acknowledgement",
          navigationData: { page: 'policy-acknowledgement' }
        }
    ↓
Return results: { success: [], alreadyAccepted: [], failed: [] }
    ↓
Admin sees confirmation modal
```

### 2. Employee Discovery Flow

```
Employee Logs In
    ↓
AuthContext authenticates user
    ↓
OnboardingContext loads
    ↓
useEffect → loadStatus()
    ↓
GET /api/onboarding/status
    ↓
Backend: getOnboardingStatus()
    ↓
Returns:
    {
      onboarding: {...},
      mandatoryPolicy: {...},
      pendingPolicyAcknowledgement: {...}
    }
    ↓
OnboardingContext → loadPendingPolicies()
    ↓
GET /api/onboarding/pending-policies
    ↓
Backend: getPendingPolicies()
    ↓
Returns:
    {
      pendingPolicies: [
        {
          logId, policyId, policyName,
          policyVersion, deadline, assignedAt
        }
      ]
    }
    ↓
OnboardingContext updates state:
    - setPendingPolicies([...])
    - Auto-opens StandalonePolicyModal if policies exist
    ↓
Dashboard renders PendingPolicyBanner
```

### 3. Acknowledgement Flow (Employee)

```
Employee Clicks "Review Now"
    ↓
openStandalonePolicyModal()
    ↓
StandalonePolicyModal opens
    ↓
useEffect:
    - setReadingStartTime(Date.now())
    - loadPolicyDetails() → GET /policies/:policyId
    - recordStandaloneReadingStart(logId)
    ↓
Backend: standaloneStartReading()
    ↓
Updates PolicyAcceptanceLog:
    {
      readingStartedAt: Date.now(),
      status: 'in_progress',
      timeline: [{ event: 'reading_started', ... }]
    }
    ↓
Employee Reads Policy
    ├─ PolicyViewer renders PDF
    ├─ Timer tracks reading duration
    └─ onScrollChange() → setScrolledToBottom(true)
    ↓
Employee Checks Acknowledgement Checkbox
    ↓
setAcknowledged(true)
    ↓
Employee Clicks "Accept & Acknowledge"
    ↓
handleAccept():
    - Validate acknowledged === true
    - Validate scrolledToBottom === true
    - Calculate readingDurationSeconds
    ↓
POST /api/onboarding/policy/standalone-accept
    {
      logId, policyId, policyVersion,
      checkboxAcknowledged: true,
      readingDurationSeconds: 125,
      scrolledToBottom: true
    }
    ↓
Backend: standaloneAcceptPolicy()
    ↓
Validation:
    ├─ Check reading time ≥ 60 seconds
    ├─ Check scrolledToBottom === true
    ├─ Check checkboxAcknowledged === true
    └─ Check policy version matches
    ↓
Update PolicyAcceptanceLog:
    {
      accepted: true,
      acceptedAt: Date.now(),
      checkboxAcknowledged: true,
      scrolledToBottom: true,
      readingDurationSeconds: 125,
      acknowledgmentIp: req.ip,
      acknowledgmentUserAgent: req.headers['user-agent'],
      acknowledgmentDeviceType: 'Desktop',
      acknowledgmentBrowser: 'Chrome',
      status: 'completed',
      timeline: [
        ...,
        { event: 'policy_accepted', timestamp: Date.now() }
      ]
    }
    ↓
Send confirmation notification
    {
      type: 'policy_accepted',
      message: "You have successfully acknowledged the policy"
    }
    ↓
Return success response
    ↓
Frontend:
    - Remove policy from pendingPolicies[]
    - Show next pending policy or close modal
    - Banner disappears if no more policies
```

---

## Backend Implementation

### Directory Structure

```
backend/
├── controllers/
│   └── onboardingController.js     # Main controller
├── models/
│   └── PolicyAcceptanceLog.js      # Audit log schema
├── routes/
│   └── onboarding.js                # API routes
└── services/
    └── NewNotificationService.js    # Notification dispatch
```

### Core Controller Functions

#### 1. `getPendingPolicies()`
**Purpose**: Fetch all pending policy acknowledgements for the current user

```javascript
// GET /api/onboarding/pending-policies
exports.getPendingPolicies = async (req, res) => {
    const userId = req.user.userId;
    
    // Find all unaccepted logs for this user
    const logs = await PolicyAcceptanceLog.find({
        userId: userId,
        accepted: false
    }).sort({ createdAt: -1 });
    
    // Hydrate with policy details
    const pendingPolicies = await Promise.all(
        logs.map(async (log) => {
            const policy = await Policy.findById(log.policyId);
            return {
                logId: log._id,
                policyId: log.policyId,
                policyName: log.policyName,
                policyVersion: log.policyVersion,
                deadline: log.profileDeadline,
                assignedAt: log.createdAt
            };
        })
    );
    
    return res.json({ pendingPolicies });
};
```

#### 2. `standaloneStartReading()`
**Purpose**: Record when employee starts reading a policy

```javascript
// POST /api/onboarding/policy/standalone-start-reading
exports.standaloneStartReading = async (req, res) => {
    const { logId } = req.body;
    const userId = req.user.userId;
    
    const log = await PolicyAcceptanceLog.findOne({
        _id: logId,
        userId: userId
    });
    
    if (!log) return res.status(404).json({ error: 'Log not found' });
    
    // Update reading start time
    log.readingStartedAt = new Date();
    log.status = 'in_progress';
    log.timeline.push({
        event: 'reading_started',
        timestamp: new Date(),
        notes: 'Employee started reading policy'
    });
    
    await log.save();
    return res.json({ message: 'Reading started recorded' });
};
```

#### 3. `standaloneAcceptPolicy()`
**Purpose**: Process policy acceptance with full validation

```javascript
// POST /api/onboarding/policy/standalone-accept
exports.standaloneAcceptPolicy = async (req, res) => {
    const {
        logId,
        policyId,
        policyVersion,
        checkboxAcknowledged,
        readingDurationSeconds,
        scrolledToBottom
    } = req.body;
    
    const userId = req.user.userId;
    
    // Validation
    if (!logId || !policyId || !policyVersion) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!checkboxAcknowledged) {
        return res.status(400).json({ 
            error: 'You must acknowledge the checkbox to accept' 
        });
    }
    
    if (!scrolledToBottom) {
        return res.status(400).json({ 
            error: 'Please scroll to the bottom of the policy' 
        });
    }
    
    if (readingDurationSeconds < 60) {
        return res.status(400).json({ 
            error: 'Minimum reading time of 60 seconds required' 
        });
    }
    
    // Find log
    const log = await PolicyAcceptanceLog.findOne({
        _id: logId,
        userId: userId
    });
    
    if (!log) return res.status(404).json({ error: 'Log not found' });
    
    if (log.accepted) {
        return res.json({ message: 'Already accepted', log });
    }
    
    // Verify policy version
    const policy = await Policy.findById(policyId);
    if (policy.version !== policyVersion) {
        return res.status(400).json({ 
            error: 'Policy version mismatch' 
        });
    }
    
    // Extract IP and User Agent
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ua = req.headers['user-agent'] || '';
    const { device, browser } = parseUA(ua);
    
    const now = new Date();
    
    // Update log
    log.accepted = true;
    log.acceptedAt = now;
    log.checkboxAcknowledged = checkboxAcknowledged;
    log.readingCompletedAt = now;
    log.scrolledToBottom = scrolledToBottom;
    log.readingDurationSeconds = readingDurationSeconds;
    log.ipAddress = ip;
    log.userAgent = ua;
    log.deviceType = device;
    log.browser = browser;
    log.status = 'completed';
    
    log.timeline.push({
        event: 'policy_accepted',
        timestamp: now,
        notes: `Accepted from ${ip} via ${browser}`
    });
    
    await log.save();
    
    // Send confirmation notification
    await NewNotificationService.createAndEmitNotification({
        message: `You have successfully acknowledged the policy "${policy.name}".`,
        type: 'policy_accepted',
        userId: userId,
        userName: req.user.fullName,
        recipientType: 'user',
        category: 'compliance',
        priority: 'medium'
    });
    
    return res.json({ 
        message: 'Policy accepted successfully', 
        log 
    });
};
```

#### 4. `assignPolicyToUsers()`
**Purpose**: Admin assigns policy to specific employees

```javascript
// POST /api/onboarding/admin/assign-policy-to-users
exports.assignPolicyToUsers = async (req, res) => {
    const { policyId, userIds, deadline } = req.body;
    
    if (!policyId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'Invalid input' });
    }
    
    const policy = await Policy.findById(policyId);
    if (!policy || policy.status !== 'Active') {
        return res.status(400).json({ error: 'Invalid or inactive policy' });
    }
    
    const results = {
        success: [],
        alreadyAccepted: [],
        failed: []
    };
    
    for (const userId of userIds) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.isActive) {
                results.failed.push({ userId, reason: 'User not found or inactive' });
                continue;
            }
            
            // Check if already accepted
            const existing = await PolicyAcceptanceLog.findOne({
                userId: userId,
                policyId: policyId,
                accepted: true
            });
            
            if (existing) {
                results.alreadyAccepted.push({
                    userId,
                    userName: user.fullName,
                    status: 'already_accepted'
                });
                continue;
            }
            
            // Create or update log
            let log = await PolicyAcceptanceLog.findOne({
                userId: userId,
                policyId: policyId,
                accepted: false
            });
            
            if (log) {
                // Update existing pending log
                log.profileDeadline = new Date(deadline);
                log.timeline.push({
                    event: 'policy_reassigned',
                    timestamp: new Date(),
                    notes: `Deadline updated by ${req.user.fullName}`
                });
            } else {
                // Create new log
                log = await PolicyAcceptanceLog.create({
                    userId: user._id,
                    userName: user.fullName,
                    employeeCode: user.employeeCode,
                    department: user.department || '',
                    policyId: policy._id,
                    policyName: policy.name,
                    policyVersion: policy.version,
                    minimumReadingSeconds: calcMinReadSeconds(policy.wordCount),
                    profileDeadline: new Date(deadline),
                    status: 'pending',
                    timeline: [{
                        event: 'policy_assigned',
                        timestamp: new Date(),
                        notes: `Assigned by ${req.user.fullName}`
                    }]
                });
            }
            
            await log.save();
            
            // Send notification
            await NewNotificationService.createAndEmitNotification({
                message: `New policy "${policy.name}" requires your acknowledgement. Please review and accept it.`,
                type: 'policy_assignment',
                userId: user._id,
                userName: user.fullName,
                recipientType: 'user',
                category: 'compliance',
                priority: 'high',
                navigationData: { page: 'policy-acknowledgement' },
                metadata: { 
                    type: 'POLICY_ASSIGNMENT',
                    policyId: policy._id.toString(),
                    policyName: policy.name,
                    deadline: deadline
                }
            });
            
            results.success.push({
                userId,
                userName: user.fullName,
                status: 'assigned'
            });
            
        } catch (err) {
            console.error(`Failed to assign policy to user ${userId}:`, err);
            results.failed.push({ userId, reason: err.message });
        }
    }
    
    return res.json({
        message: 'Policy assignment completed.',
        results
    });
};
```

#### 5. `assignPolicyToAll()`
**Purpose**: Bulk assign policy to all active employees

```javascript
// POST /api/onboarding/admin/assign-policy-to-all
exports.assignPolicyToAll = async (req, res) => {
    const { policyId, deadline } = req.body;
    
    // Fetch all active employees (excluding Admin/HR)
    const users = await User.find({
        isActive: true,
        role: { $in: ['Employee', 'Intern'] }
    });
    
    const userIds = users.map(u => u._id.toString());
    
    // Reuse assignPolicyToUsers logic
    req.body.userIds = userIds;
    return exports.assignPolicyToUsers(req, res);
};
```

---

## Frontend Implementation

### Directory Structure

```
frontend/src/
├── components/
│   ├── PendingPolicyBanner.jsx          # Dashboard alert
│   ├── admin/
│   │   └── PolicyAssignmentModal.jsx    # Admin assignment UI
│   └── onboarding/
│       └── StandalonePolicyModal.jsx    # Employee review modal
├── context/
│   └── OnboardingContext.jsx             # State management
└── pages/
    └── EmployeeDashboardPage.jsx         # Integration point
```

### Key Components

#### 1. PendingPolicyBanner.jsx
**Purpose**: Alert banner on employee dashboard showing pending policies

```jsx
// Displays on dashboard if pendingPolicies.length > 0
<Alert severity={overdueCount > 0 ? 'error' : 'warning'}>
  <PolicyIcon />
  {pendingPolicies.length} {pendingPolicies.length === 1 ? 'Policy' : 'Policies'} 
  Awaiting Your Acknowledgement
  
  {overdueCount > 0 && (
    <Chip label={`${overdueCount} Overdue`} color="error" />
  )}
  
  <Button onClick={() => openStandalonePolicyModal()}>
    Review Now
  </Button>
  
  <List>
    {pendingPolicies.slice(0, 3).map(policy => (
      <ListItem key={policy.logId}>
        • {policy.policyName} (v{policy.policyVersion})
        {policy.deadline && ` - Due: ${formatDate(policy.deadline)}`}
      </ListItem>
    ))}
  </List>
</Alert>
```

**Key Features**:
- Auto-hides when all policies acknowledged
- Shows overdue count in red chip
- Lists up to 3 policies inline
- "Review Now" opens modal

#### 2. StandalonePolicyModal.jsx
**Purpose**: Full-screen modal for policy review and acknowledgement

**State Management**:
```javascript
const [acknowledged, setAcknowledged] = useState(false);
const [scrolledToBottom, setScrolledToBottom] = useState(false);
const [readingStartTime, setReadingStartTime] = useState(null);
const [error, setError] = useState('');
const [policyDetails, setPolicyDetails] = useState(null);
```

**Lifecycle**:
```javascript
useEffect(() => {
    if (standalonePolicyModalOpen && currentStandalonePolicy) {
        // Reset state
        setAcknowledged(false);
        setScrolledToBottom(false);
        setReadingStartTime(Date.now());
        setError('');
        
        // Load policy details
        loadPolicyDetails();
        
        // Notify backend reading started
        recordStandaloneReadingStart(currentStandalonePolicy.logId);
    }
}, [standalonePolicyModalOpen, currentStandalonePolicy]);
```

**Accept Handler**:
```javascript
const handleAccept = async () => {
    // Validation
    if (!acknowledged) {
        setError('You must acknowledge that you have read and understood the policy.');
        return;
    }
    
    if (!scrolledToBottom) {
        setError('Please scroll to the bottom of the policy document.');
        return;
    }
    
    // Calculate reading duration
    const readingDurationSeconds = Math.floor(
        (Date.now() - readingStartTime) / 1000
    );
    
    // Submit
    const result = await acceptStandalonePolicy({
        logId: currentStandalonePolicy.logId,
        policyId: currentStandalonePolicy.policyId,
        policyVersion: currentStandalonePolicy.policyVersion,
        checkboxAcknowledged: acknowledged,
        readingDurationSeconds,
        scrolledToBottom
    });
    
    if (!result.success) {
        setError(result.error);
    }
};
```

**UI Structure**:
```jsx
<Dialog open={standalonePolicyModalOpen} maxWidth="md" fullWidth>
  <DialogTitle>
    Policy Acknowledgement Required
    {!mandatory && <CloseIcon onClick={handleClose} />}
  </DialogTitle>
  
  <DialogContent>
    {/* Error/Warning Alerts */}
    {error && <Alert severity="error">{error}</Alert>}
    {isOverdue && <Alert severity="warning">Overdue!</Alert>}
    
    {/* Policy Info */}
    <Typography variant="h6">{policyName}</Typography>
    <Chip label={`Version ${policyVersion}`} />
    <Chip label={`Deadline: ${deadline}`} />
    
    {/* Instructions */}
    <Alert severity="info">
      Please read the entire policy. You must scroll to the bottom
      and spend at least 60 seconds reading.
    </Alert>
    
    {/* PDF Viewer */}
    <PolicyViewer
      policyId={policyId}
      onScrollChange={handleScrollChange}
    />
    
    {/* Acknowledgement Checkbox */}
    <FormControlLabel
      control={<Checkbox checked={acknowledged} onChange={...} />}
      label="I acknowledge that I have read, understood, and agree to comply"
    />
    
    {!scrolledToBottom && (
      <Alert severity="warning">
        Please scroll to the bottom
      </Alert>
    )}
  </DialogContent>
  
  <DialogActions>
    {!mandatory && <Button onClick={handleClose}>Later</Button>}
    <Button
      variant="contained"
      onClick={handleAccept}
      disabled={!canAccept || pending}
    >
      Accept & Acknowledge
    </Button>
  </DialogActions>
</Dialog>
```

#### 3. PolicyAssignmentModal.jsx
**Purpose**: Admin interface for assigning policies

**State**:
```javascript
const [policies, setPolicies] = useState([]);
const [employees, setEmployees] = useState([]);
const [selectedPolicy, setSelectedPolicy] = useState('');
const [selectedEmployees, setSelectedEmployees] = useState([]);
const [assignToAll, setAssignToAll] = useState(false);
const [deadline, setDeadline] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
```

**Assignment Handler**:
```javascript
const handleAssign = async () => {
    // Validation
    if (!selectedPolicy) {
        setError('Please select a policy');
        return;
    }
    
    if (!assignToAll && selectedEmployees.length === 0) {
        setError('Please select at least one employee or choose "Assign to All"');
        return;
    }
    
    const payload = {
        policyId: selectedPolicy,
        deadline: deadline.toISOString()
    };
    
    let response;
    if (assignToAll) {
        response = await api.post('/onboarding/admin/assign-policy-to-all', payload);
    } else {
        payload.userIds = selectedEmployees.map(e => e._id);
        response = await api.post('/onboarding/admin/assign-policy-to-users', payload);
    }
    
    setResult(response.data.results);
    
    // Auto-close after 2 seconds
    setTimeout(() => {
        onSuccess(response.data);
        onClose();
    }, 2000);
};
```

**UI Structure**:
```jsx
<Dialog open={open} onClose={onClose} maxWidth="md">
  <DialogTitle>Assign Policy to Employees</DialogTitle>
  
  <DialogContent>
    {/* Error/Success Alerts */}
    {error && <Alert severity="error">{error}</Alert>}
    {result && (
      <Alert severity="success">
        ✓ Successfully assigned: {result.success.length}
        ℹ Already accepted: {result.alreadyAccepted.length}
        ✗ Failed: {result.failed.length}
      </Alert>
    )}
    
    {/* Policy Selection */}
    <FormControl fullWidth>
      <InputLabel>Select Policy</InputLabel>
      <Select value={selectedPolicy} onChange={...}>
        {policies.map(policy => (
          <MenuItem value={policy._id}>
            {policy.name} (v{policy.version})
          </MenuItem>
        ))}
      </Select>
    </FormControl>
    
    {/* Selected Policy Details */}
    {selectedPolicyData && (
      <Box>
        <Typography>Name: {selectedPolicyData.name}</Typography>
        <Typography>Version: {selectedPolicyData.version}</Typography>
        <Typography>Effective From: {selectedPolicyData.effectiveFrom}</Typography>
      </Box>
    )}
    
    {/* Assign to All Toggle */}
    <FormControlLabel
      control={<Switch checked={assignToAll} onChange={...} />}
      label="Assign to All Active Employees"
    />
    
    {/* Employee Selection (if not assignToAll) */}
    {!assignToAll && (
      <Autocomplete
        multiple
        options={employees}
        getOptionLabel={(option) => 
          `${option.fullName} (${option.employeeCode})`
        }
        value={selectedEmployees}
        onChange={(e, newValue) => setSelectedEmployees(newValue)}
        renderInput={(params) => (
          <TextField {...params} label="Select Employees" />
        )}
      />
    )}
    
    {/* Deadline Picker */}
    <DatePicker
      label="Acknowledgement Deadline"
      value={deadline}
      onChange={(newValue) => setDeadline(newValue)}
      minDate={new Date()}
    />
  </DialogContent>
  
  <DialogActions>
    <Button onClick={onClose}>Cancel</Button>
    <Button variant="contained" onClick={handleAssign} disabled={loading}>
      {loading ? 'Assigning...' : 'Assign Policy'}
    </Button>
  </DialogActions>
</Dialog>
```

---

## User Journey

### Admin Journey: Assigning a Policy

```
Step 1: Navigate to Admin Dashboard
    ↓
Step 2: Go to Policies → Onboarding Compliance tab
    ↓
Step 3: Click "Assign Policy to Employees" button
    ↓
Step 4: PolicyAssignmentModal opens
    ↓
Step 5: Select policy from dropdown
    - Dropdown shows: "Policy Name (vX.X)"
    - Below dropdown: Policy details (name, version, effective date)
    ↓
Step 6: Choose assignment method
    Option A: Select specific employees
        - Use Autocomplete to search by name/employee code
        - Can select multiple employees
        - Shows count: "5 employee(s) selected"
    
    Option B: Toggle "Assign to All Active Employees"
        - Disables employee selector
        - Shows alert: "This will assign to 50 active employees"
    ↓
Step 7: Set deadline
    - DatePicker with minimum date = today
    - Default = 7 days from now
    ↓
Step 8: Click "Assign Policy"
    ↓
Step 9: Backend processes assignment
    - Shows loading spinner
    - Processes each employee
    ↓
Step 10: See results summary
    ✓ Successfully assigned: 45
    ℹ Already accepted: 3
    ✗ Failed: 2
    ↓
Step 11: Modal auto-closes after 2 seconds
    - Compliance dashboard refreshes
```

### Employee Journey: Acknowledging a Policy

```
Step 1: Employee logs in
    ↓
Step 2: Dashboard loads
    - OnboardingContext fetches pending policies
    - GET /api/onboarding/pending-policies
    ↓
Step 3: PendingPolicyBanner appears (if policies exist)
    - Shows count and list of pending policies
    - Highlights overdue policies in red
    - "Review Now" button visible
    ↓
Step 4: Employee clicks "Review Now"
    - openStandalonePolicyModal() called
    - StandalonePolicyModal opens
    ↓
Step 5: Modal initialization
    - Loads policy details (PDF URL)
    - Starts reading timer
    - Records reading start to backend
    - Displays policy info (name, version, deadline)
    ↓
Step 6: Employee reads policy
    - PDF viewer displays document
    - Timer silently tracks duration
    - Scroll tracker monitors position
    - Warning: "Please scroll to the bottom" (until done)
    ↓
Step 7: Employee scrolls to bottom
    - onScrollChange(true) fires
    - scrolledToBottom = true
    - Warning disappears
    ↓
Step 8: Employee checks acknowledgement checkbox
    - "I acknowledge that I have read, understood, and agree to comply"
    - acknowledged = true
    ↓
Step 9: Employee clicks "Accept & Acknowledge"
    - Frontend validation:
        ✓ acknowledged === true
        ✓ scrolledToBottom === true
    - Calculates readingDurationSeconds
    - POST /api/onboarding/policy/standalone-accept
    ↓
Step 10: Backend validation
    - Check reading time ≥ 60 seconds
    - Check scrolledToBottom
    - Check checkboxAcknowledged
    - Check policy version
    ↓
Step 11A: Validation passes
    - Update PolicyAcceptanceLog (accepted = true)
    - Record IP, user agent, timestamp
    - Send success notification
    - Return success response
    ↓
Step 12A: Frontend success
    - Remove policy from pendingPolicies
    - Show next pending policy (if any)
    - Or close modal if no more policies
    - Banner disappears
    - Success toast: "Policy acknowledged successfully"
    ↓
Step 13A: Done! ✅
    
    
Step 11B: Validation fails
    - Return error: "Minimum reading time of 60 seconds required"
    - OR: "Please scroll to the bottom"
    - OR: "You must acknowledge the checkbox"
    ↓
Step 12B: Frontend shows error
    - Error Alert displays at top of modal
    - Employee must fix issue and retry
    ↓
Step 13B: Employee corrects and retries
    - Goes back to Step 9
```

### Edge Cases

1. **Employee closes modal without accepting**
   - Policy remains pending
   - Banner persists
   - Can review later

2. **Mandatory policy**
   - No "Later" button
   - No close button (X)
   - Must accept to continue

3. **Multiple pending policies**
   - Modal shows first policy
   - After accepting, automatically shows next
   - Banner updates count in real-time

4. **Overdue policies**
   - Banner shows in red (error severity)
   - "Overdue" chip displayed
   - Modal shows warning alert

5. **Policy assigned twice**
   - Backend checks if already accepted
   - Returns in "alreadyAccepted" array
   - No duplicate logs created

---

## Technical Flow

### Backend Request-Response Cycle

#### GET /api/onboarding/pending-policies

**Request**:
```http
GET /api/onboarding/pending-policies HTTP/1.1
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "pendingPolicies": [
    {
      "logId": "6691234567890abcdef12345",
      "policyId": "6691234567890abcdef67890",
      "policyName": "Code of Conduct",
      "policyVersion": "2.1",
      "deadline": "2026-08-27T23:59:59.000Z",
      "assignedAt": "2026-08-20T10:30:00.000Z"
    },
    {
      "logId": "6691234567890abcdef54321",
      "policyId": "6691234567890abcdef09876",
      "policyName": "Data Privacy Policy",
      "policyVersion": "1.3",
      "deadline": "2026-08-30T23:59:59.000Z",
      "assignedAt": "2026-08-22T14:15:00.000Z"
    }
  ]
}
```

#### POST /api/onboarding/policy/standalone-accept

**Request**:
```http
POST /api/onboarding/policy/standalone-accept HTTP/1.1
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "logId": "6691234567890abcdef12345",
  "policyId": "6691234567890abcdef67890",
  "policyVersion": "2.1",
  "checkboxAcknowledged": true,
  "readingDurationSeconds": 125,
  "scrolledToBottom": true
}
```

**Success Response**:
```json
{
  "message": "Policy accepted successfully",
  "log": {
    "_id": "6691234567890abcdef12345",
    "userId": "6691234567890abcdef11111",
    "policyId": "6691234567890abcdef67890",
    "accepted": true,
    "acceptedAt": "2026-08-26T15:30:45.123Z",
    "status": "completed",
    "readingDurationSeconds": 125,
    "scrolledToBottom": true,
    "checkboxAcknowledged": true,
    "ipAddress": "192.168.1.100",
    "deviceType": "Desktop",
    "browser": "Chrome"
  }
}
```

**Error Responses**:
```json
// Insufficient reading time
{
  "error": "Minimum reading time of 60 seconds required (you spent 45 seconds)"
}

// Not scrolled to bottom
{
  "error": "Please scroll to the bottom of the policy document"
}

// Checkbox not checked
{
  "error": "You must acknowledge the checkbox to accept"
}

// Policy version mismatch
{
  "error": "Policy version mismatch. Please refresh and try again."
}
```

#### POST /api/onboarding/admin/assign-policy-to-users

**Request**:
```http
POST /api/onboarding/admin/assign-policy-to-users HTTP/1.1
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "policyId": "6691234567890abcdef67890",
  "userIds": [
    "6691234567890abcdef11111",
    "6691234567890abcdef22222",
    "6691234567890abcdef33333"
  ],
  "deadline": "2026-09-01T23:59:59.000Z"
}
```

**Response**:
```json
{
  "message": "Policy assignment completed.",
  "results": {
    "success": [
      {
        "userId": "6691234567890abcdef11111",
        "userName": "John Doe",
        "status": "assigned"
      },
      {
        "userId": "6691234567890abcdef22222",
        "userName": "Jane Smith",
        "status": "assigned"
      }
    ],
    "alreadyAccepted": [
      {
        "userId": "6691234567890abcdef33333",
        "userName": "Bob Johnson",
        "status": "already_accepted"
      }
    ],
    "failed": []
  }
}
```

---

## Validation & Security

### Frontend Validations

1. **Reading Time**
   ```javascript
   const readingDurationSeconds = Math.floor(
       (Date.now() - readingStartTime) / 1000
   );
   // Enforced: ≥ 60 seconds
   ```

2. **Scroll Completion**
   ```javascript
   const handleScrollChange = (reachedBottom) => {
       if (reachedBottom) {
           setScrolledToBottom(true);
       }
   };
   // PolicyViewer component tracks scroll position
   ```

3. **Checkbox State**
   ```javascript
   if (!acknowledged) {
       setError('You must acknowledge...');
       return;
   }
   ```

4. **Button Disabled State**
   ```javascript
   const canAccept = acknowledged && scrolledToBottom;
   
   <Button disabled={!canAccept || policyAcceptancePending}>
       Accept & Acknowledge
   </Button>
   ```

### Backend Validations

1. **Authentication**
   ```javascript
   router.post('/policy/standalone-accept', 
       authenticateToken,  // JWT validation
       ctrl.standaloneAcceptPolicy
   );
   ```

2. **Authorization**
   ```javascript
   // Employee can only access their own logs
   const log = await PolicyAcceptanceLog.findOne({
       _id: logId,
       userId: req.user.userId  // User from JWT
   });
   ```

3. **Reading Time**
   ```javascript
   const minSeconds = log.minimumReadingSeconds || 60;
   
   if (readingDurationSeconds < minSeconds) {
       return res.status(400).json({ 
           error: `Minimum reading time of ${minSeconds} seconds required 
                   (you spent ${readingDurationSeconds} seconds)` 
       });
   }
   ```

4. **Scroll Validation**
   ```javascript
   if (!scrolledToBottom) {
       return res.status(400).json({ 
           error: 'Please scroll to the bottom of the policy document' 
       });
   }
   ```

5. **Checkbox Validation**
   ```javascript
   if (!checkboxAcknowledged) {
       return res.status(400).json({ 
           error: 'You must acknowledge the checkbox to accept' 
       });
   }
   ```

6. **Policy Version Match**
   ```javascript
   const policy = await Policy.findById(policyId);
   
   if (policy.version !== policyVersion) {
       return res.status(400).json({ 
           error: 'Policy version mismatch. Please refresh and try again.' 
       });
   }
   ```

7. **Idempotency**
   ```javascript
   if (log.accepted) {
       return res.json({ 
           message: 'Already accepted', 
           log 
       });
   }
   ```

### Security Features

1. **IP Address Tracking**
   ```javascript
   const ip = req.ip || 
              req.headers['x-forwarded-for'] || 
              'unknown';
   log.ipAddress = ip;
   ```

2. **User Agent Tracking**
   ```javascript
   const ua = req.headers['user-agent'] || '';
   log.userAgent = ua;
   
   const { device, browser } = parseUA(ua);
   log.deviceType = device;  // Desktop/Mobile/Tablet
   log.browser = browser;     // Chrome/Firefox/Safari/etc
   ```

3. **Timestamp Tracking**
   ```javascript
   log.acceptedAt = new Date();
   log.readingStartedAt = new Date();
   log.readingCompletedAt = new Date();
   ```

4. **Audit Trail**
   ```javascript
   log.timeline.push({
       event: 'policy_accepted',
       timestamp: new Date(),
       notes: `Accepted from ${ip} via ${browser}`
   });
   ```

5. **Immutable Records**
   - PolicyAcceptanceLog records are never deleted
   - Only updated with acceptance data
   - Complete history in timeline array

---

## Notification System

### Notification Types

1. **Policy Assignment Notification**
   ```javascript
   {
       type: 'policy_assignment',
       priority: 'high',
       category: 'compliance',
       message: "New policy 'Code of Conduct' requires your acknowledgement. 
                 Please review and accept it.",
       navigationData: { page: 'policy-acknowledgement' },
       metadata: {
           type: 'POLICY_ASSIGNMENT',
           policyId: "6691234567890abcdef67890",
           policyName: "Code of Conduct",
           deadline: "2026-09-01T23:59:59.000Z"
       }
   }
   ```

2. **Policy Accepted Notification**
   ```javascript
   {
       type: 'policy_accepted',
       priority: 'medium',
       category: 'compliance',
       message: "You have successfully acknowledged the policy 'Code of Conduct'.",
       navigationData: { page: 'dashboard' }
   }
   ```

### Notification Channels

1. **In-App Notification Drawer**
   - Real-time via Socket.IO
   - Notification icon badge count
   - Click to navigate to acknowledgement page

2. **Email Notification**
   - Sent immediately upon assignment
   - Contains policy name, deadline
   - Direct link to login and acknowledge

3. **Dashboard Banner**
   - PendingPolicyBanner component
   - Persistent until acknowledged
   - Shows on every page visit

### Notification Flow

```
Admin Assigns Policy
    ↓
Backend: assignPolicyToUsers()
    ↓
For each employee:
    ├─ Create PolicyAcceptanceLog
    └─ Call NewNotificationService.createAndEmitNotification()
        ↓
        ├─ Save to notifications collection
        ├─ Emit via Socket.IO → Employee's browser
        │   └─ NotificationDrawer updates badge count
        └─ Send email via email service
            └─ Employee receives email with link
    ↓
Employee logs in
    ↓
Frontend: loadPendingPolicies()
    ↓
PendingPolicyBanner appears on dashboard
    ↓
Employee acknowledges policy
    ↓
Backend: standaloneAcceptPolicy()
    ↓
Send confirmation notification
    ↓
Frontend: Remove from pendingPolicies
    ↓
Banner disappears
```

---

## State Management

### OnboardingContext State

```javascript
{
    // Onboarding flow state
    step: 0-4,                         // Current onboarding step
    mandatoryPolicy: Object | null,    // Mandatory onboarding policy
    statusLoaded: Boolean,             // Status fetch complete
    policyAcceptancePending: Boolean,  // Submitting acceptance
    tourPending: Boolean,              // Tour completion pending
    
    // Standalone policy acknowledgement
    pendingPolicies: Array,            // List of pending policies
    standalonePolicyModalOpen: Boolean, // Modal visibility
    currentStandalonePolicy: Object | null, // Currently viewing policy
    
    // Computed flags
    isOnboardingActive: Boolean,       // User in onboarding flow
    showPolicyModal: Boolean,          // Show onboarding policy modal
    showTour: Boolean,                 // Show app tour
    showProfilePrompt: Boolean,        // Show profile completion prompt
}
```

### State Update Flow

```
Component Mount
    ↓
useOnboarding() hook
    ↓
OnboardingContext.Provider
    ↓
useEffect → authStatus === 'authenticated'
    ↓
loadStatus()
    ├─ GET /api/onboarding/status
    │   ├─ Sets mandatoryPolicy
    │   └─ Computes step
    └─ loadPendingPolicies()
        ├─ GET /api/onboarding/pending-policies
        └─ setPendingPolicies([...])
        └─ Auto-opens modal if policies exist
    ↓
Component receives updated context
    ↓
Dashboard renders PendingPolicyBanner
    ↓
User clicks "Review Now"
    ↓
openStandalonePolicyModal()
    ├─ setCurrentStandalonePolicy(pendingPolicies[0])
    └─ setStandalonePolicyModalOpen(true)
    ↓
StandalonePolicyModal renders
    ↓
User accepts policy
    ↓
acceptStandalonePolicy(payload)
    ├─ POST /api/onboarding/policy/standalone-accept
    ├─ setPendingPolicies(prev => prev.filter(...))
    ├─ Check if more policies
    │   ├─ Yes: setCurrentStandalonePolicy(next)
    │   └─ No: closeStandalonePolicyModal()
    └─ Return { success: true }
    ↓
Component re-renders with updated state
    ↓
Banner updates or disappears
```

### Context Provider Setup

```jsx
// App.jsx
<AuthProvider>
  <OnboardingProvider>
    <Router>
      <Routes>
        <Route path="/dashboard" element={<EmployeeDashboardPage />} />
        ...
      </Routes>
    </Router>
    
    {/* Global Modal - rendered outside route */}
    <StandalonePolicyModal />
  </OnboardingProvider>
</AuthProvider>
```

---

## Database Schema

### PolicyAcceptanceLog Collection

```javascript
{
    // ── Employee ──────────────────────────────────────────────
    userId: ObjectId,              // ref: 'User'
    userName: String,              // "John Doe"
    employeeCode: String,          // "EMP001"
    department: String,            // "Engineering"
    
    // ── Policy ────────────────────────────────────────────────
    policyId: ObjectId,            // ref: 'Policy'
    policyName: String,            // "Code of Conduct"
    policyVersion: String,         // "2.1"
    
    // ── Reading Metrics ───────────────────────────────────────
    readingStartedAt: Date,        // When employee opened policy
    readingCompletedAt: Date,      // When employee finished reading
    readingDurationSeconds: Number, // Actual time spent (125)
    minimumReadingSeconds: Number, // Required time (60)
    scrolledToBottom: Boolean,     // true
    
    // ── Acceptance ────────────────────────────────────────────
    accepted: Boolean,             // false → true on acceptance
    acceptedAt: Date,              // Acceptance timestamp
    checkboxAcknowledged: Boolean, // true
    
    // ── Device / Network ──────────────────────────────────────
    ipAddress: String,             // "192.168.1.100"
    userAgent: String,             // "Mozilla/5.0 ..."
    deviceType: String,            // "Desktop" | "Mobile" | "Tablet"
    browser: String,               // "Chrome" | "Firefox" | "Safari"
    
    // ── Timeline ──────────────────────────────────────────────
    timeline: [
        {
            event: String,         // 'policy_assigned', 'reading_started', ...
            timestamp: Date,
            notes: String          // "Assigned by Admin User"
        }
    ],
    
    // ── Status ────────────────────────────────────────────────
    status: String,                // 'pending' | 'in_progress' | 'completed'
    onboardingCompletedAt: Date,   // When full onboarding done
    profileDeadline: Date,         // Acknowledgement deadline
    
    // ── Timestamps ────────────────────────────────────────────
    createdAt: Date,               // Auto-generated
    updatedAt: Date                // Auto-generated
}
```

### Indexes

```javascript
policyAcceptanceLogSchema.index({ userId: 1, policyId: 1 });
policyAcceptanceLogSchema.index({ accepted: 1 });
policyAcceptanceLogSchema.index({ status: 1, createdAt: -1 });
policyAcceptanceLogSchema.index({ department: 1, status: 1 });
```

### Example Document

```json
{
    "_id": "6691234567890abcdef12345",
    "userId": "6691234567890abcdef11111",
    "userName": "John Doe",
    "employeeCode": "EMP001",
    "department": "Engineering",
    "policyId": "6691234567890abcdef67890",
    "policyName": "Code of Conduct",
    "policyVersion": "2.1",
    "readingStartedAt": "2026-08-26T15:28:30.123Z",
    "readingCompletedAt": "2026-08-26T15:30:45.123Z",
    "readingDurationSeconds": 125,
    "minimumReadingSeconds": 60,
    "scrolledToBottom": true,
    "accepted": true,
    "acceptedAt": "2026-08-26T15:30:45.123Z",
    "checkboxAcknowledged": true,
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
    "deviceType": "Desktop",
    "browser": "Chrome",
    "timeline": [
        {
            "event": "policy_assigned",
            "timestamp": "2026-08-26T10:00:00.000Z",
            "notes": "Assigned by Admin User"
        },
        {
            "event": "reading_started",
            "timestamp": "2026-08-26T15:28:30.123Z",
            "notes": "Employee started reading policy"
        },
        {
            "event": "policy_accepted",
            "timestamp": "2026-08-26T15:30:45.123Z",
            "notes": "Accepted from 192.168.1.100 via Chrome"
        }
    ],
    "status": "completed",
    "profileDeadline": "2026-09-01T23:59:59.000Z",
    "createdAt": "2026-08-26T10:00:00.000Z",
    "updatedAt": "2026-08-26T15:30:45.123Z"
}
```

---

## API Reference

### Employee Endpoints

#### GET /api/onboarding/pending-policies
Fetch all pending policy acknowledgements for the current user.

**Auth**: Required (JWT)  
**Role**: Employee, Intern

**Response**:
```json
{
    "pendingPolicies": [
        {
            "logId": "string",
            "policyId": "string",
            "policyName": "string",
            "policyVersion": "string",
            "deadline": "ISO 8601 date",
            "assignedAt": "ISO 8601 date"
        }
    ]
}
```

---

#### POST /api/onboarding/policy/standalone-start-reading
Record when employee starts reading a policy.

**Auth**: Required (JWT)  
**Role**: Employee, Intern

**Request Body**:
```json
{
    "logId": "string (required)"
}
```

**Response**:
```json
{
    "message": "Reading started recorded"
}
```

---

#### POST /api/onboarding/policy/standalone-accept
Accept a standalone policy assignment.

**Auth**: Required (JWT)  
**Role**: Employee, Intern

**Request Body**:
```json
{
    "logId": "string (required)",
    "policyId": "string (required)",
    "policyVersion": "string (required)",
    "checkboxAcknowledged": "boolean (required, must be true)",
    "readingDurationSeconds": "number (required, ≥ 60)",
    "scrolledToBottom": "boolean (required, must be true)"
}
```

**Success Response (200)**:
```json
{
    "message": "Policy accepted successfully",
    "log": { /* PolicyAcceptanceLog object */ }
}
```

**Error Responses**:
- **400**: Missing required fields, insufficient reading time, not scrolled, checkbox not checked, policy version mismatch
- **404**: Log not found

---

### Admin Endpoints

#### POST /api/onboarding/admin/assign-policy-to-users
Assign a policy to specific employees.

**Auth**: Required (JWT)  
**Role**: Admin, HR

**Request Body**:
```json
{
    "policyId": "string (required)",
    "userIds": ["string array (required)"],
    "deadline": "ISO 8601 date (required)"
}
```

**Response (200)**:
```json
{
    "message": "Policy assignment completed.",
    "results": {
        "success": [
            {
                "userId": "string",
                "userName": "string",
                "status": "assigned"
            }
        ],
        "alreadyAccepted": [
            {
                "userId": "string",
                "userName": "string",
                "status": "already_accepted"
            }
        ],
        "failed": [
            {
                "userId": "string",
                "reason": "string"
            }
        ]
    }
}
```

**Error Responses**:
- **400**: Invalid input, invalid or inactive policy

---

#### POST /api/onboarding/admin/assign-policy-to-all
Assign a policy to all active employees.

**Auth**: Required (JWT)  
**Role**: Admin, HR

**Request Body**:
```json
{
    "policyId": "string (required)",
    "deadline": "ISO 8601 date (required)"
}
```

**Response**: Same as assign-policy-to-users

---

## Summary

The Policy Acknowledgement system is a comprehensive, audit-compliant solution for managing policy distribution and tracking employee acknowledgements. It features:

- **Dual Flows**: Onboarding for new employees, standalone for existing employees
- **Robust Validation**: Reading time, scroll tracking, explicit acknowledgement
- **Complete Audit Trail**: IP tracking, device fingerprinting, timeline events
- **User-Friendly UX**: Dashboard banners, modal views, clear error messages
- **Admin Control**: Flexible assignment, bulk operations, compliance dashboard
- **Real-Time Notifications**: Socket.IO, email, in-app alerts
- **Security**: JWT authentication, role-based access, idempotent operations

The implementation ensures legal compliance while maintaining a seamless user experience for both administrators and employees.

---

**Last Updated**: August 26, 2026  
**Version**: 1.0.0
