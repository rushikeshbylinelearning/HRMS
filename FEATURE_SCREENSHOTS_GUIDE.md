# Dynamic Policy Acknowledgement - UI Guide

## 📸 User Interface Walkthrough

This guide describes the key screens and interactions for the dynamic policy acknowledgement feature.

---

## 🔐 Admin Interface

### 1. **Admin Policies Page - Onboarding Compliance Tab**

**Location**: Admin → Policies → Onboarding Compliance

**Key Elements**:
```
┌─────────────────────────────────────────────────────────────┐
│  Onboarding Compliance          [Assign Policy to Employees]│
│─────────────────────────────────────────────────────────────│
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Compliance Dashboard                               │    │
│  │                                                      │    │
│  │  Status Filters: [All] [Pending] [In Progress]     │    │
│  │                 [Completed] [Overdue] [Incomplete]  │    │
│  │                                                      │    │
│  │  Employee List with compliance status...            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Action**: Click the "Assign Policy to Employees" button to open assignment modal

---

### 2. **Policy Assignment Modal**

**Triggered by**: Admin clicks "Assign Policy to Employees" button

**Layout**:
```
┌───────────────────────────────────────────────────────┐
│  Assign Policy to Employees                      [X]  │
│  Assign a policy for employees to acknowledge         │
│───────────────────────────────────────────────────────│
│                                                        │
│  Select Policy:                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │ [▼] Code of Conduct (v2.0)                   │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  ┌─────────────────────────────────────────────┐     │
│  │ ℹ️ Policy Details                            │     │
│  │ Name: Code of Conduct                        │     │
│  │ Version: 2.0                                 │     │
│  │ Effective From: Jan 1, 2026                  │     │
│  └─────────────────────────────────────────────┘     │
│                                                        │
│  ────────────────────────────────────────────────     │
│                                                        │
│  ☐ Assign to All Active Employees                     │
│     Assign to all active employees (Employee & Intern)│
│                                                        │
│  Select Employees:                                     │
│  ┌──────────────────────────────────────────────┐    │
│  │ [Search employees...]                        │    │
│  │ × John Doe (EMP001)  × Jane Smith (EMP002)   │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  Acknowledgement Deadline:                             │
│  ┌──────────────────────────────────────────────┐    │
│  │ 📅 08/20/2026                                │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│───────────────────────────────────────────────────────│
│                           [Cancel] [Assign Policy]    │
└───────────────────────────────────────────────────────┘
```

**Features**:
- Policy dropdown with all active policies
- Policy details preview
- Toggle for "Assign to All" vs specific employees
- Multi-select autocomplete for employee selection
- Date picker for deadline
- Real-time validation

**Success Message**:
```
┌─────────────────────────────────────────────────────┐
│ ✓ Assignment Complete                               │
│ ✓ Successfully assigned: 25                         │
│ ℹ️ Already accepted: 3                              │
│ ✗ Failed: 0                                         │
└─────────────────────────────────────────────────────┘
```

---

## 👤 Employee Interface

### 3. **Employee Dashboard with Pending Policy Banner**

**Location**: Employee Dashboard (after login)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│  Employee Dashboard                                          │
│─────────────────────────────────────────────────────────────│
│                                                              │
│  ⚠️ 2 Policies Awaiting Your Acknowledgement  [Review Now] │
│  You have pending policy documents that require your review │
│  and acknowledgement. Please review them at your earliest   │
│  convenience.                                                │
│  • Code of Conduct (v2.0) - Due: 08/20/2026                │
│  • Data Privacy Policy (v1.5) - Due: 08/25/2026            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Time Tracking                                      │    │
│  │  Status: Clocked In                                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  [Rest of dashboard content...]                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Banner Variants**:

**Warning (Pending)**:
- Yellow/Orange background
- Standard "⚠️" icon
- Shows policy count and list

**Error (Overdue)**:
- Red background
- Shows "1 Overdue" chip
- More urgent messaging

---

### 4. **Standalone Policy Acknowledgement Modal**

**Triggered by**: Employee clicks "Review Now" on banner

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  📄 Policy Acknowledgement Required               [X]      │
│     Please review and acknowledge the following policy      │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  Code of Conduct                                            │
│  [v2.0] [Deadline: 08/20/2026]                             │
│                                                             │
│  ℹ️ Please read the entire policy document carefully. You  │
│     must scroll to the bottom and spend at least 60 seconds│
│     reading before you can acknowledge.                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  [PDF Viewer - Policy Content]                       │  │
│  │                                                       │  │
│  │  Policy text displays here...                        │  │
│  │  ▼ Scroll to read more ▼                            │  │
│  │                                                       │  │
│  │                                                       │  │
│  │  [...more content...]                                │  │
│  │                                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ☑️ I acknowledge that I have read, understood, and   │  │
│  │   agree to comply with this policy                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ⚠️ Please scroll to the bottom of the policy document    │
│                                                             │
│─────────────────────────────────────────────────────────────│
│                          [Later] [Accept & Acknowledge]    │
└────────────────────────────────────────────────────────────┘
```

**Interactive States**:

**Initial State**:
- Accept button disabled (grayed out)
- Checkbox unchecked
- Warning: "Please scroll to the bottom"

**After Scrolling (< 60 seconds)**:
- Warning: "Please read for at least 60 seconds"
- Accept button still disabled

**Ready to Accept**:
- Scrolled to bottom ✓
- Reading time ≥ 60 seconds ✓
- Accept button enabled
- Checkbox can be checked

**Error States**:
```
┌─────────────────────────────────────────────────────┐
│ ✗ You must acknowledge that you have read and       │
│   understood the policy.                             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ✗ Minimum reading time not met. Required: 60s,      │
│   Recorded: 45s.                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ✗ You must scroll to the bottom of the policy       │
│   before accepting.                                  │
└─────────────────────────────────────────────────────┘
```

---

### 5. **Post-Acknowledgement State**

**After successful acknowledgement**:

**Dashboard**:
```
┌─────────────────────────────────────────────────────────────┐
│  Employee Dashboard                                          │
│─────────────────────────────────────────────────────────────│
│                                                              │
│  [Banner no longer displays]                                │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Time Tracking                                      │    │
│  │  Status: Clocked In                                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Notification Drawer**:
```
┌─────────────────────────────────────────────────────┐
│ ✓ You have successfully acknowledged the policy     │
│   "Code of Conduct".                                 │
│   2 minutes ago                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🔄 Interaction Flow Diagram

```
ADMIN FLOW:
Admin Dashboard
    ↓
Policies → Onboarding Compliance Tab
    ↓
Click "Assign Policy to Employees"
    ↓
Policy Assignment Modal Opens
    ↓
Select Policy + Employees + Deadline
    ↓
Click "Assign Policy"
    ↓
Success Message Displayed
    ↓
Employees Receive Notifications


EMPLOYEE FLOW:
Employee Login
    ↓
Dashboard Loads
    ↓
OnboardingContext.loadPendingPolicies()
    ↓
Banner Displays (if policies pending)
    ↓
Employee Clicks "Review Now"
    ↓
Standalone Policy Modal Opens
    ↓
Policy Viewer Loads
    ↓
Timer Starts (must be ≥ 60s)
    ↓
Employee Scrolls (must reach bottom)
    ↓
Employee Checks Acknowledgement Box
    ↓
Click "Accept & Acknowledge"
    ↓
Backend Validates All Requirements
    ↓
Success: Modal Closes, Banner Disappears
    ↓
Confirmation Notification Sent
```

---

## 🎨 Design System

### Colors Used

**Banner Variants**:
- Warning (Pending): `#FFA726` (orange)
- Error (Overdue): `#E53935` (red)
- Info: `#42A5F5` (blue)
- Success: `#66BB6A` (green)

**Status Chips**:
- Active: Green outline
- Pending: Orange outline
- Completed: Green filled
- Overdue: Red filled

### Typography
- **Titles**: `fontWeight: 600`, size varies by context
- **Body**: `fontWeight: 400`, readable sizing
- **Captions**: `fontSize: 0.75rem`, secondary color

### Spacing
- Card padding: `24px`
- Stack spacing: `spacing={3}` (24px)
- Modal content padding: `padding: 3` (24px)

---

## 📱 Responsive Behavior

### Desktop (≥ 1024px)
- Modal: `maxWidth: md` (900px)
- Full feature set visible
- Side-by-side layouts

### Tablet (768px - 1023px)
- Modal: Full width with margins
- Stacked layouts
- Touch-friendly buttons

### Mobile (< 768px)
- Modal: Full screen
- Single column layout
- Larger touch targets
- Simplified navigation

---

## ♿ Accessibility

### Keyboard Navigation
- ✅ Tab through all interactive elements
- ✅ Enter/Space to activate buttons
- ✅ Escape to close modals

### Screen Readers
- ✅ Proper ARIA labels
- ✅ Alert roles for banners
- ✅ Status announcements
- ✅ Form field descriptions

### Visual
- ✅ High contrast text
- ✅ Color not sole indicator
- ✅ Focus indicators visible
- ✅ Readable font sizes

---

## 🎯 Key UX Principles

1. **Progressive Disclosure**: Show banner → Modal on demand
2. **Clear Feedback**: Real-time validation messages
3. **Visual Hierarchy**: Important actions prominent
4. **Error Prevention**: Disable actions until requirements met
5. **Confirmation**: Success messages on completion
6. **Accessibility**: Keyboard, screen reader, high contrast support

---

## 📊 Status Indicators

### Compliance Dashboard Statuses

- **Pending**: Not yet opened by employee
- **In Progress**: Opened but not acknowledged
- **Completed**: Successfully acknowledged
- **Overdue**: Past deadline, not acknowledged
- **Incomplete**: Partial progress (e.g., tour done but profile not)

### Visual Indicators

```
[Pending]     - Orange dot
[In Progress] - Blue dot  
[Completed]   - Green checkmark
[Overdue]     - Red exclamation
```

---

This UI guide provides a complete visual reference for the dynamic policy acknowledgement feature. Use it alongside the technical documentation for full understanding of the implementation.

---

**Last Updated**: August 13, 2026  
**Version**: 1.0.0
