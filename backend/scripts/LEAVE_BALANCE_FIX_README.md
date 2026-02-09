# Leave Balance Deduction Fix Script

## Overview

This script fixes incorrect leave balance deductions in existing approved leave records. It recalculates employee leave balances from scratch based on their entitlements and all approved leaves, ensuring accuracy.

## Issue Fixed

Some approved leave requests may have deducted from the wrong balance field:
- Casual leave deducted from Sick balance instead of Casual balance
- Sick leave deducted from Casual balance instead of Sick balance
- Planned leave deducted from wrong balance

## How It Works

1. **Finds all approved leave requests** for each active employee
2. **Calculates correct deductions** based on requestType:
   - `Sick` → deducts from `sick` balance
   - `Casual` → deducts from `casual` balance
   - `Planned` → deducts from `paid` balance
   - `Loss of Pay`, `Compensatory`, `Comp-Off`, `Backdated Leave` → no deduction
3. **Recalculates correct balances** = Entitlements - Total Deductions
4. **Compares with current balances** and identifies discrepancies
5. **Updates balances** to correct values (if not in dry-run mode)

## Safety Features

✅ **Dry-run mode by default** - No changes until you explicitly enable it  
✅ **Detailed audit report** - Complete log of all changes  
✅ **Error handling** - Continues processing even if one employee fails  
✅ **Idempotent** - Can be run multiple times safely  

## Usage

### Step 1: Dry-Run Analysis (MANDATORY FIRST STEP)

```bash
cd backend
node scripts/fix-leave-balance-deductions.js
```

This will:
- Scan all employees
- Calculate correct balances
- Show what needs to be fixed
- **NOT make any changes** to the database

### Step 2: Review the Report

Check the generated report file:
```
backend/scripts/leave-balance-fix-report.json
```

This contains:
- List of all employees needing fixes
- Current vs correct balances
- Detailed breakdown of all approved leaves
- Differences that will be corrected

### Step 3: Enable Live Mode

Edit `backend/scripts/fix-leave-balance-deductions.js`:

```javascript
const CONFIG = {
    DRY_RUN: false, // Change to false to apply fixes
    LOG_DETAILS: true,
};
```

### Step 4: Run the Fix

```bash
node scripts/fix-leave-balance-deductions.js
```

This will:
- Recalculate all balances
- Update employee records with correct balances
- Generate a final report

## Example Output

```
🔍 Starting Leave Balance Fix Script...

Mode: DRY RUN (no changes will be made)

📊 Found 25 active employees

⚠️  Employee: Rahul Kirad (#BYL202505-E69)
   Current Balances: sick=4.5, casual=6, paid=10
   Correct Balances: sick=5.5, casual=5, paid=10
   Differences: sick=1.00, casual=-1.00, paid=0.00
   Total Deductions: sick=0, casual=1, paid=0
   Approved Leaves: 1

📊 SUMMARY
================================================================================
Total Employees Checked: 25
Employees Needing Fix: 3
Employees Fixed: 0
Total Approved Leaves Processed: 45
Errors: 0
```

## What Gets Fixed

For each employee, the script:
1. Gets all approved leaves
2. Calculates what should have been deducted from each balance type
3. Recalculates correct balance = Entitlement - Total Deductions
4. Updates balance if different from current

## Important Notes

- **This script recalculates from entitlements** - If entitlements were changed after leaves were approved, balances will reflect current entitlements
- **Half-day leaves are handled correctly** - 0.5 days for half-day leaves
- **LOP/Comp-Off leaves are ignored** - They don't affect balances
- **The script is safe to run multiple times** - It recalculates from scratch each time

## Rollback

If you need to rollback:
1. The script generates a detailed report with current balances
2. You can manually restore balances from the report if needed
3. Or re-run the script after fixing entitlements

## Verification

After running the fix, verify:
1. Check employee leave pages - balances should be correct
2. Check admin leave tracker - balances should match
3. Verify a few employees manually by checking their approved leaves
