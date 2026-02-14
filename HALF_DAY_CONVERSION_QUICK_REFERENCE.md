# 🚀 HALF-DAY AUTO-CONVERSION - QUICK REFERENCE

## 📌 WHAT IT DOES

Automatically converts **Half-Day Leave → Full-Day LOP** when employee has **NO check-in** record.

---

## ⏰ WHEN IT RUNS

**Daily at 12:30 AM IST** (processes yesterday's data only)

---

## 🔒 CONVERSION RULES (ALL MUST BE TRUE)

1. ✅ Leave status = **Approved**
2. ✅ Leave type = **Half Day** (First/Second Half)
3. ✅ Request type ≠ **Loss of Pay**
4. ✅ Attendance record **exists**
5. ✅ **clockInTime === null** (absolute no-show)
6. ✅ Date is **NOT a holiday**
7. ✅ Date is **NOT a weekend**
8. ✅ **NOT already converted**
9. ✅ **NO admin override**

**If ANY fails → NO CONVERSION**

---

## 🛠️ ADMIN ENDPOINTS

### 1. Manual Trigger
```
POST /api/admin/leaves/run-halfday-validation
Body: { "date": "2026-02-13" }
```

### 2. Revert Conversion
```
POST /api/admin/leaves/revert-auto-conversion/:leaveId
Body: { 
  "originalLeaveType": "Half Day - First Half",
  "originalRequestType": "Planned"
}
```

### 3. View Audit Log
```
GET /api/admin/leaves/auto-conversion-log?startDate=2026-02-01&endDate=2026-02-14
```

---

## 📊 WHAT GETS UPDATED

### LeaveRequest
- `leaveType`: "Half Day" → **"Full Day"**
- `requestType`: "Planned/Sick/Casual" → **"Loss of Pay"**
- `autoConvertedToLOP`: **true**
- `autoConversionDate`: **timestamp**
- `reason`: **+ "[AUTO-CONVERTED...]"**

### AttendanceLog
- `attendanceStatus`: **"Leave"** (via sync)
- `leaveRequest`: **updated reference**

---

## 🚨 COMMON SCENARIOS

| Scenario | Result |
|----------|--------|
| Half-Day + No check-in | ✅ **CONVERTED** |
| Half-Day + 5 min check-in | ❌ NOT converted |
| Half-Day + Holiday | ❌ NOT converted |
| Half-Day + Weekend | ❌ NOT converted |
| Already LOP | ❌ NOT converted |
| Admin override exists | ❌ NOT converted |

---

## 🐛 TROUBLESHOOTING

### Not Converting?
1. Check leave is **Approved**
2. Check **clockInTime is null**
3. Check date is **not holiday/weekend**
4. Check **no admin override**

### False Positive?
1. Use **revert endpoint**
2. Check attendance log
3. Verify clockInTime was actually null

### Job Not Running?
1. Check server logs for "✅ Half-day conversion job scheduled"
2. Verify cron service started
3. Manually trigger for testing

---

## 📝 FILES MODIFIED

- `backend/services/halfDayAutoConversionService.js` (NEW)
- `backend/models/LeaveRequest.js` (schema update)
- `backend/services/cronService.js` (cron job added)
- `backend/routes/admin.js` (3 new endpoints)

---

## ✅ SAFETY FEATURES

- ✅ **Transactional** (rollback on error)
- ✅ **Auditable** (full history)
- ✅ **Reversible** (admin can revert)
- ✅ **Idempotent** (no double conversion)
- ✅ **Isolated** (one failure doesn't affect others)

---

## 📞 SUPPORT

**Questions?** Contact Backend Engineering Team  
**Documentation:** See `HALF_DAY_AUTO_CONVERSION_IMPLEMENTATION.md`
