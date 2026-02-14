# Leave Policy Report

## Executive Summary

This document provides a comprehensive overview of the company's leave policy system, including leave types, balances, eligibility criteria, validation rules, and anti-exploitation measures.

---

## 1. Leave Types

### 1.1 Standard Leave Types

| Leave Type | Code | Description | Balance Deduction |
|------------|------|-------------|-------------------|
| **Planned Leave** | `Planned` | Pre-planned leaves requiring advance notice | Paid Leave Balance |
| **Sick Leave** | `Sick` | Medical/health-related absences | Sick Leave Balance |
| **Casual Leave** | `Casual` | Short-notice personal leaves | Casual Leave Balance |
| **Loss of Pay (LOP)** | `Loss of Pay` | Unpaid leave when balance exhausted | No balance deduction |
| **Compensatory Leave** | `Compensatory` | Leave earned by working on holidays | Paid Leave Balance |
| **Comp-Off** | `Comp-Off` | Compensatory off for working Saturdays | Paid Leave Balance |
| **Backdated Leave** | `Backdated Leave` | Retroactive leave applications | Sick/Casual Balance |
| **Year-End Leave** | `YEAR_END` | Year-end carry forward or encashment | N/A |

### 1.2 Leave Duration Types

- **Full Day**: Complete day off (1.0 day deduction)
- **Half Day - First Half**: Morning off (0.5 day deduction)
- **Half Day - Second Half**: Afternoon off (0.5 day deduction)

---

## 2. Leave Balance Entitlements

### 2.1 Permanent Employees (On-Role)

| Leave Category | Annual Entitlement | Balance Field |
|----------------|-------------------|---------------|
| Sick Leave | 6 days | `leaveBalances.sick` |
| Casual Leave | 6 days | `leaveBalances.casual` |
| Planned Leave | 10 days | `leaveBalances.paid` |
| **Total** | **22 days** | |

### 2.2 Probation & Intern Employees

- Probation employees have restricted leave access
- Interns have limited or no leave entitlements based on employment type
- Leave eligibility validated through `employmentStatus` and `employeeType` fields

---

## 3. Leave Application Rules

### 3.1 Planned Leave Requirements

**Advance Notice Requirements:**
- **≤7 working days**: Minimum 30 days advance notice
- **>7 working days**: Minimum 60 days advance notice

**Half-Year Period Tracking:**
- First Half: January - June
- Second Half: July - December

**Special Rules:**
- Planned leaves are exempt from monthly working days cap
- Can override weekday restrictions with valid advance notice
- Requires sufficient paid leave balance

### 3.2 Sick Leave Requirements

**Medical Certificate Requirements:**
- Same-day sick leave: No certificate required
- Multi-day sick leave: Certificate required
- Applied after return: Certificate mandatory

**Medical Proof Status Tracking:**
- `NotRequired`: Certificate not needed
- `Pending`: Future-dated, awaiting certificate
- `Provided`: Certificate uploaded
- `Requested`: Admin requested proof
- `Overdue`: Deadline passed without upload

**Deadline:** Leave date + N days (configurable)

### 3.3 Casual Leave Requirements

**Advance Notice Override:**
- Applied >10 days in advance: Weekday restrictions waived
- Applied ≤10 days: Subject to weekday blocking rules

**Balance Requirements:**
- Must have sufficient casual leave balance
- Deducts from `leaveBalances.casual`

### 3.4 Compensatory Leave Requirements

**Eligibility Criteria:**
- Must have worked on a declared holiday
- Alternate date (worked date) must be provided
- Alternate date must be a valid company holiday
- Cannot claim comp leave for regular working days

**Validation:**
- Checks holiday calendar for alternate date
- Validates employee worked on that date
- Separate monthly cap from regular leaves

### 3.5 Comp-Off Requirements

**Eligibility Criteria:**
- Must have worked on a Saturday
- Saturday must be a working Saturday per employee's policy
- Validates against `alternateSaturdayPolicy`

**Saturday Policies:**
- `All Saturdays Working`: All Saturdays are working days
- `All Saturdays Off`: All Saturdays are off
- `Week 1 & 3 Off`: 1st and 3rd Saturdays off
- `Week 2 & 4 Off`: 2nd and 4th Saturdays off

### 3.6 Loss of Pay (LOP) Rules

**Key Characteristics:**
- No balance requirement
- No advance notice requirement
- Subject to monthly frequency cap (4 requests/month)
- Subject to monthly working days cap (5 days/month)
- Subject to Friday/Monday restrictions
- Counts toward monthly leave limits

### 3.7 Backdated Leave Rules

**Balance Resolution:**
- Attempts to deduct from Sick balance first
- Falls back to Casual balance if Sick insufficient
- Requires sufficient combined balance
- Tracks deductions separately for restoration on rejection

---

## 4. Anti-Exploitation Validation Rules

### 4.1 Weekday Restrictions

#### Rule 1: Friday Restriction (STRICT)
- **Status**: BLOCKED for ALL leave types
- **Exceptions**: LOP and Comp-Off only
- **Override**: Admin override required
- **Message**: "Leave cannot be applied on Friday. Please contact Admin if necessary."

#### Rule 2: Monday Restriction (STRICT)
- **Status**: BLOCKED for ALL leave types
- **Exceptions**: LOP and Comp-Off only
- **Override**: Admin override required
- **Message**: "Leave cannot be applied on Monday. Please contact Admin if necessary."

#### Rule 3: Tuesday Restriction (CONDITIONAL)
- **Status**: BLOCKED for short-notice requests
- **Exceptions**: 
  - Planned leave with valid advance notice
  - Casual leave >10 days in advance
  - LOP and Comp-Off
- **Message**: "Leave cannot be applied on Tuesday when requested within 10 days."

#### Rule 4: Thursday Restriction (CONDITIONAL)
- **Status**: BLOCKED for short-notice requests
- **Exceptions**: Same as Tuesday
- **Message**: "Leave cannot be applied on Thursday when requested within 10 days."

### 4.2 Monthly Frequency Cap

**Limit**: Maximum 4 leave requests per month

**Counting Rules:**
- Counts PENDING + APPROVED requests only
- REJECTED requests do NOT count
- Applies to ALL leave types including LOP
- Comp-Off has separate limit
- Counted by leave date month, not application month

**Error Message:**
```
You have already submitted X leave request(s) for [Month] [Year]. 
The maximum allowed is 4 requests per month (including LOP).
```

### 4.3 Monthly Working Days Cap

**Limit**: Maximum 5 working days on leave per month

**Counting Rules:**
- Counts only working days (excludes weekends and holidays)
- Applies to Casual, Sick, and LOP
- **Planned Leave is EXEMPT**
- Comp-Off has separate validation
- Considers half-day leaves (0.5 multiplier)

**Working Day Calculation:**
- Excludes Sundays (always off)
- Excludes Saturdays based on employee's policy
- Excludes declared holidays
- Accounts for half-day leaves

**Error Message:**
```
You have already used X working day(s) of leave in [Month] [Year]. 
This request would exceed the monthly limit of 5 working days.
```

### 4.4 Overlapping Leave Prevention

**Validation:**
- Checks for existing leaves on requested dates
- Prevents duplicate leave applications
- Validates across all leave types
- Can exclude specific request ID for updates

---

## 5. Saturday Clubbing Policy

### 5.1 Saturday Clubbing Rules

**Automatic Saturday Inclusion:**
- When leave spans across a working Saturday
- Saturday is automatically included in leave dates
- Applies based on employee's Saturday policy

**Validation:**
- Checks if Saturday falls within leave period
- Validates against employee's `alternateSaturdayPolicy`
- Ensures Saturday is a working day before clubbing

---

## 6. Admin Override Capabilities

### 6.1 Override Scenarios

Admins can override validation blocks for:
- Friday/Monday restrictions
- Tuesday/Thursday restrictions
- Monthly frequency caps
- Monthly working days caps
- Balance insufficiency

### 6.2 Override Tracking

**Fields Tracked:**
- `adminOverride`: Boolean flag
- `overrideReason`: Admin's justification
- `overriddenBy`: Admin user ID
- `overriddenAt`: Timestamp

**Audit Logging:**
- All overrides are logged for audit trail
- Includes employee details, dates, and reason
- Stored in audit logs for compliance

---

## 7. Year-End Leave Processing

### 7.1 Year-End Actions

**Sub-Types:**
- `CARRY_FORWARD`: Carry unused leaves to next year
- `ENCASH`: Encash unused leaves for payment

**Applicable Leave Types:**
- Sick Leave
- Casual Leave
- Planned Leave

**Validation:**
- One request per employee per leave type per year
- Prevents duplicate year-end requests
- Tracks processing status to prevent double-processing

### 7.2 Year-End Fields

- `yearEndSubType`: CARRY_FORWARD or ENCASH
- `yearEndLeaveType`: Sick, Casual, or Planned
- `yearEndDays`: Number of days for action
- `yearEndYear`: Year for the request
- `isProcessed`: Prevents double processing

---

## 8. Medical Certificate Management

### 8.1 Certificate Requirements

**When Required:**
- Multi-day sick leaves
- Sick leaves applied after return
- Admin-requested proof

**Status Workflow:**
1. `NotRequired` → No certificate needed
2. `Pending` → Awaiting certificate upload
3. `Provided` → Certificate uploaded successfully
4. `Requested` → Admin explicitly requested
5. `Overdue` → Deadline passed without upload

### 8.2 Certificate Tracking

- `medicalProofRequired`: Boolean flag
- `medicalProofDeadline`: Upload deadline date
- `medicalProofRequestedAt`: Request timestamp
- `medicalProofRequestedBy`: Admin user ID
- `medicalCertificateUploadedAt`: Upload timestamp
- `medicalCertificate`: File URL/path

---

## 9. Leave Approval Workflow

### 9.1 Status Flow

```
Pending → Approved/Rejected
```

### 9.2 Approval Fields

- `status`: Pending, Approved, Rejected
- `approvedBy`: Approver user ID
- `approvedAt`: Approval timestamp
- `rejectionNotes`: Reason for rejection (if rejected)

### 9.3 Balance Deduction

**On Approval:**
- Deducts from appropriate balance field
- Updates `leaveBalances` in User model
- Tracks deduction for restoration on rejection

**On Rejection:**
- Restores deducted balance
- Uses tracked deduction amounts
- Maintains balance integrity

---

## 10. Working Hours & Shift Policy

### 10.1 Shift Configuration

**Standard Shift:**
- Working time: 8 hours 30 minutes (510 minutes)
- Paid break allowance: 30 minutes
- Total shift duration: 9 hours (540 minutes)

**Shift Types:**
- General Shift 1 (10 AM): 10:00 AM - 7:00 PM
- General Shift 2 (11 AM): 11:00 AM - 8:00 PM

### 10.2 Half-Day Criteria

**Minimum Requirements:**
- Working time: 4.5 hours (270 minutes)
- Total elapsed time: 5 hours (300 minutes)
- Includes paid break allowance

**Full-Day Criteria:**
- Working time: 8.5 hours (510 minutes)
- Total elapsed time: 9 hours (540 minutes)

---

## 11. Validation Service Architecture

### 11.1 Service Layers

**LeavePolicyService** (Primary)
- Core policy validation logic
- Balance calculations
- Date validations
- Eligibility checks

**LeaveValidationService** (Facade)
- API compatibility layer
- Delegates to LeavePolicyService
- Maintains route interface

**AntiExploitationLeaveService** (Deprecated)
- Legacy validation rules
- Being consolidated into LeavePolicyService
- Kept for backward compatibility

### 11.2 Validation Methods

**Key Methods:**
- `validateApply()`: Validate new leave application
- `validateApproval()`: Validate approval action
- `validateAdminUpdate()`: Validate admin modifications
- `checkLeaveBalance()`: Verify sufficient balance
- `checkNoOverlappingLeaves()`: Prevent duplicates
- `validateMonthlyCapsIntelligent()`: Monthly limits
- `validateWeekdayRestrictionsIntelligent()`: Weekday rules

---

## 12. Reporting & Analytics

### 12.1 Leave Tracking

**Tracked Metrics:**
- Leave balance utilization
- Monthly leave frequency
- Working days on leave
- Leave type distribution
- Approval/rejection rates

### 12.2 Audit Trail

**Logged Events:**
- Leave applications
- Approvals/rejections
- Admin overrides
- Balance deductions/restorations
- Blocked leave attempts
- Medical certificate uploads

---

## 13. Employee Types & Eligibility

### 13.1 Employment Status

**Types:**
- `Intern`: Internship period
- `Probation`: Probationary period
- `Permanent`: Permanent employee

### 13.2 Employee Type

**Categories:**
- `Intern`: Intern employees
- `On-Role`: Regular employees

### 13.3 Probation Status

**States:**
- `None`: Not applicable
- `On Probation`: Currently in probation
- `Permanent`: Probation completed

### 13.4 Eligibility Rules

**Permanent Employees:**
- Full leave entitlements (22 days)
- All leave types available
- Standard validation rules apply

**Probation Employees:**
- Restricted leave access
- May have reduced entitlements
- Additional approval requirements

**Interns:**
- Limited or no leave entitlements
- Based on internship duration
- Special validation rules

---

## 14. Key Configuration Files

### 14.1 Models

- `backend/models/LeaveRequest.js`: Leave request schema
- `backend/models/User.js`: Employee and balance schema
- `backend/models/Holiday.js`: Holiday calendar
- `backend/models/Policy.js`: Policy documents

### 14.2 Services

- `backend/services/LeavePolicyService.js`: Core policy logic
- `backend/services/leaveValidationService.js`: Validation facade
- `backend/services/antiExploitationLeaveService.js`: Anti-exploitation rules
- `backend/services/leaveAttendanceSyncService.js`: Attendance sync

### 14.3 Configuration

- `backend/config/shiftPolicy.js`: Shift and working hours
- `backend/config/security.js`: Security settings
- `backend/config/production.js`: Production config

---

## 15. Best Practices & Recommendations

### 15.1 For Employees

1. **Plan Ahead**: Apply planned leaves 30-60 days in advance
2. **Check Balance**: Verify leave balance before applying
3. **Avoid Restricted Days**: Avoid Friday/Monday leaves
4. **Medical Certificates**: Upload certificates promptly for sick leaves
5. **Monthly Limits**: Track your monthly leave frequency (max 4 requests)

### 15.2 For Admins

1. **Override Judiciously**: Use admin override only when necessary
2. **Document Reasons**: Always provide clear override reasons
3. **Monitor Patterns**: Watch for leave abuse patterns
4. **Certificate Verification**: Verify medical certificates promptly
5. **Balance Management**: Regularly audit leave balances

### 15.3 For HR

1. **Policy Communication**: Ensure employees understand leave policies
2. **Regular Audits**: Conduct periodic leave balance audits
3. **Year-End Processing**: Process year-end requests timely
4. **Compliance**: Maintain audit trails for compliance
5. **Policy Updates**: Keep leave policies updated and documented

---

## 16. Common Scenarios & Solutions

### 16.1 Insufficient Balance

**Scenario**: Employee has no leave balance
**Solution**: Apply for Loss of Pay (LOP)

### 16.2 Friday/Monday Leave

**Scenario**: Emergency leave needed on Friday
**Solution**: Contact admin for override with valid reason

### 16.3 Backdated Leave

**Scenario**: Forgot to apply leave on time
**Solution**: Apply backdated leave (deducts from Sick/Casual)

### 16.4 Working on Holiday

**Scenario**: Worked on company holiday
**Solution**: Apply compensatory leave with alternate date

### 16.5 Monthly Limit Reached

**Scenario**: Already applied 4 leaves this month
**Solution**: Wait for next month or contact admin for override

---

## 17. System Integration Points

### 17.1 Attendance System

- Leave approval creates attendance records
- Marks leave dates as absent with reason
- Syncs with attendance logs
- Updates daily status

### 17.2 Notification System

- Leave application notifications
- Approval/rejection notifications
- Medical certificate reminders
- Balance low warnings

### 17.3 Excel Export

- Leave reports generation
- Balance reports
- Audit trail exports
- Monthly summaries

---

## Appendix A: Leave Type Matrix

| Leave Type | Balance Required | Advance Notice | Weekday Restrictions | Monthly Cap | Working Days Cap |
|------------|-----------------|----------------|---------------------|-------------|------------------|
| Planned | Yes (Paid) | 30-60 days | Exempt with notice | Yes (4) | Exempt |
| Sick | Yes (Sick) | No | Yes | Yes (4) | Yes (5) |
| Casual | Yes (Casual) | No | Conditional | Yes (4) | Yes (5) |
| LOP | No | No | Yes | Yes (4) | Yes (5) |
| Compensatory | Yes (Paid) | No | Own rules | Separate | Separate |
| Comp-Off | Yes (Paid) | No | Own rules | Separate | Separate |
| Backdated | Yes (Sick/Casual) | N/A | N/A | Yes (4) | Yes (5) |

---

## Appendix B: Validation Error Messages

### Balance Errors
- "Insufficient sick leave balance. Available: X days, Required: Y days"
- "Insufficient casual leave balance. Available: X days, Required: Y days"
- "Insufficient paid leave balance. Available: X days, Required: Y days"

### Weekday Errors
- "Leave cannot be applied on Friday. Please contact Admin if necessary."
- "Leave cannot be applied on Monday. Please contact Admin if necessary."
- "Leave cannot be applied on Tuesday when requested within 10 days."
- "Leave cannot be applied on Thursday when requested within 10 days."

### Monthly Limit Errors
- "You have already submitted X leave request(s) for [Month] [Year]. Maximum allowed is 4."
- "You have already used X working day(s) in [Month] [Year]. Maximum allowed is 5."

### Advance Notice Errors
- "Planned leave requires minimum 30 days advance notice for ≤7 working days"
- "Planned leave requires minimum 60 days advance notice for >7 working days"

### Overlap Errors
- "You already have a leave request for one or more of these dates"

---

## Document Information

**Report Generated**: February 14, 2026
**Version**: 1.0
**Last Updated**: February 14, 2026
**Maintained By**: HR Department

---

*This report is based on the current leave policy implementation in the system. For policy changes or clarifications, please contact HR.*
