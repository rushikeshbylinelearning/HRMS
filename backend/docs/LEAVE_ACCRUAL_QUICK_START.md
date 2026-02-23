# Leave Accrual System - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Create Database Indexes
```bash
cd backend
node scripts/create-leave-indexes.js
```

**Expected Output:**
```
[CreateIndexes] ✓ All indexes created and verified successfully
[CreateIndexes] Performance optimization complete
```

### Step 2: Verify System Status
```bash
curl -X GET http://localhost:5000/api/admin/leave-accrual/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "status": {
    "currentMonth": {
      "month": 2,
      "year": 2026,
      "processed": false,
      "status": "NOT_PROCESSED"
    },
    "lastSuccessful": null,
    "pending": 0,
    "failed": 0
  }
}
```

### Step 3: Test Accrual (Dry Run)
```bash
curl -X POST http://localhost:5000/api/admin/leave-accrual/process \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "month": 2,
    "year": 2026,
    "dryRun": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Dry run completed",
  "result": {
    "employeesProcessed": 150,
    "employeesFailed": 0,
    "accruals": [...]
  }
}
```

### Step 4: Run Actual Accrual
```bash
curl -X POST http://localhost:5000/api/admin/leave-accrual/process \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "month": 2,
    "year": 2026,
    "dryRun": false
  }'
```

---

## 📋 Common Tasks

### Check Accrual History
```bash
curl -X GET http://localhost:5000/api/admin/leave-accrual/history \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### View Employee Accrual History
```bash
curl -X GET http://localhost:5000/api/admin/leave-accrual/employee/EMPLOYEE_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Manual Balance Adjustment
```bash
curl -X POST http://localhost:5000/api/admin/leave-accrual/adjust \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMPLOYEE_ID",
    "leaveType": "sick",
    "amount": 2.5,
    "reason": "Correction for system migration"
  }'
```

### Verify Balance Integrity
```bash
curl -X GET http://localhost:5000/api/admin/leave-accrual/verify/EMPLOYEE_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🔍 Monitoring

### Check Cron Job Status
```bash
# View server logs
tail -f backend/logs/combined.log | grep LeaveAccrual
```

### View Accrual Locks
```javascript
// In MongoDB shell
db.leaveaccruallocks.find().sort({ createdAt: -1 }).limit(5)
```

### View Ledger Entries
```javascript
// In MongoDB shell
db.leaveledgers.find({ source: 'CRON' }).sort({ createdAt: -1 }).limit(10)
```

---

## ⚠️ Troubleshooting

### Accrual Not Running
**Problem:** Cron job not executing

**Solution:**
1. Check server logs: `tail -f backend/logs/combined.log`
2. Verify cron job started: Look for `[CRON] Leave accrual job scheduler started`
3. Check database connection
4. Restart server if needed

### Balance Discrepancy
**Problem:** Employee balance doesn't match ledger

**Solution:**
```bash
# 1. Verify balance integrity
curl -X GET http://localhost:5000/api/admin/leave-accrual/verify/EMPLOYEE_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 2. If discrepancy found, manual adjustment
curl -X POST http://localhost:5000/api/admin/leave-accrual/adjust \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMPLOYEE_ID",
    "leaveType": "sick",
    "amount": CORRECTION_AMOUNT,
    "reason": "Balance reconciliation"
  }'
```

### Duplicate Accrual
**Problem:** Accrual ran twice for same month

**Solution:**
- System is idempotent - duplicate execution is prevented by LeaveAccrualLock
- Check lock status: `db.leaveaccruallocks.find({ month: X, year: Y })`
- If lock exists with status=COMPLETED, accrual will be skipped

---

## 📊 Performance Metrics

### Expected Performance
- **Accrual Time (1000 employees):** ~5 seconds
- **Accrual Time (10000 employees):** ~45 seconds
- **Validation Time:** <150ms per request
- **DB Queries per Validation:** 1-2 (down from 4-6)

### Monitor Performance
```bash
# Check accrual duration
curl -X GET http://localhost:5000/api/admin/leave-accrual/history \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq '.history[0].metadata.duration'
```

---

## 🔐 Security Checklist

- [ ] Only Admin/HR roles can access accrual endpoints
- [ ] All balance changes logged in LeaveLedger
- [ ] All override attempts logged in SystemAuditLog
- [ ] Email notifications configured for accrual success/failure
- [ ] Database indexes created for performance
- [ ] Backup strategy in place

---

## 📅 Monthly Checklist

**1st of Every Month:**
- [ ] Verify accrual executed successfully (check logs)
- [ ] Review accrual history: `GET /api/admin/leave-accrual/history`
- [ ] Spot-check employee balances
- [ ] Review any failed employees

**Weekly:**
- [ ] Monitor override statistics
- [ ] Review suspicious override activity

**Monthly:**
- [ ] Verify balance integrity for sample employees
- [ ] Review audit logs
- [ ] Check system performance metrics

---

## 🆘 Emergency Contacts

**System Issues:**
- Check logs: `backend/logs/combined.log`
- Check errors: `backend/logs/error.log`

**Rollback Required:**
- See: `backend/docs/LEAVE_MANAGEMENT_REFACTOR_REPORT.md` Section 5.2

**Documentation:**
- Full Report: `backend/docs/LEAVE_MANAGEMENT_REFACTOR_REPORT.md`
- This Guide: `backend/docs/LEAVE_ACCRUAL_QUICK_START.md`

---

**Last Updated:** February 20, 2026  
**Version:** 1.0
