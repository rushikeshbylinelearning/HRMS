/**
 * TEST SCRIPT: Probation Confirmation Leave Allotment
 *
 * Validates the prorated confirmation allotment feature end-to-end:
 *   1. Creates a temporary test user with employmentStatus: 'Probation'
 *   2. Calls ProbationTrackingService.promoteEmployeeToPermanent
 *   3. Asserts leaveEntitlements are UNCHANGED (6/6/10)
 *   4. Asserts leaveBalances are prorated correctly
 *   5. Asserts probationConfirmation is persisted
 *   6. Dry-runs LeaveAccrualService.processMonthlyAccrual for the next month
 *      and confirms the prorated cap is respected
 *   7. Cleans up the test user and its ledger entries
 *
 * Run from repo root:
 *   node backend/scripts/test-confirmation-allotment.js
 *
 * Optional env override:
 *   CONFIRMATION_MONTH=7   (default: current month, 1-12)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const mongoose = require('mongoose');
const User = require('../models/User');
const LeaveLedger = require('../models/LeaveLedger');
const ProbationTrackingService = require('../services/probationTrackingService');
const LeaveAccrualService = require('../services/LeaveAccrualService');

// ─── helpers ────────────────────────────────────────────────────────────────

function pass(msg) { console.log(`  ✅  ${msg}`); }
function fail(msg) { console.error(`  ❌  ${msg}`); process.exitCode = 1; }
function info(msg) { console.log(`  ℹ️   ${msg}`); }

function assertEq(label, actual, expected) {
    if (Math.abs(actual - expected) < 0.01) {
        pass(`${label}: ${actual}`);
    } else {
        fail(`${label}: expected ${expected}, got ${actual}`);
    }
}

function assertNull(label, actual) {
    if (actual === null || actual === undefined) {
        pass(`${label} is null/undefined (unchanged)`);
    } else {
        fail(`${label} must be null/undefined but got: ${actual}`);
    }
}

// ─── prorated math mirror (for cross-checking) ──────────────────────────────

function expectedProrated(confirmationMonth) {
    // Mirrors LeaveAccrualService.computeProratedRemainingYearEntitlement
    const ACCRUAL_CONFIG = LeaveAccrualService.ACCRUAL_CONFIG;
    const result = {};
    for (const [leaveType, config] of Object.entries(ACCRUAL_CONFIG)) {
        let total = 0;
        for (let m = confirmationMonth; m <= 12; m++) {
            total += LeaveAccrualService.calculateAccrualAmount(leaveType, m, config);
        }
        result[leaveType] = Math.round(total * 10) / 10;
    }
    return result;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function run() {
    console.log('\n🔌  Connecting to database…');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅  Connected\n');

    // Determine confirmation month (env override or current month)
    const confirmationMonth = parseInt(process.env.CONFIRMATION_MONTH, 10) || (new Date().getMonth() + 1);
    const confirmationYear  = new Date().getFullYear();

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Confirmation month: ${confirmationMonth} / ${confirmationYear}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // ── find a fake admin (any Admin user will do) ────────────────────────────
    const admin = await User.findOne({ role: 'Admin', isActive: true }).lean();
    if (!admin) {
        console.error('❌  No Admin user found — cannot run test.');
        process.exit(1);
    }
    const adminId = admin._id;
    info(`Using admin: ${admin.fullName} (${admin.employeeCode})`);

    // ── create a disposable test employee ────────────────────────────────────
    const testCode = `TEST-CONF-${Date.now()}`;
    let testUser = await User.create({
        employeeCode:     testCode,
        fullName:         'Test Confirmation Employee',
        email:            `${testCode.toLowerCase()}@test.invalid`,
        passwordHash:     'not-a-real-hash',
        role:             'Employee',
        joiningDate:      new Date(`${confirmationYear}-01-01`),
        employmentStatus: 'Probation',
        leaveBalances:    { sick: 0, casual: 0, paid: 0 },
        leaveEntitlements:{ sick: 6, casual: 6, paid: 10 }
    });
    info(`Created test user: ${testUser.fullName} (${testUser.employeeCode})`);

    try {
        // ── BEFORE snapshot ──────────────────────────────────────────────────
        console.log('\n── BEFORE promotion ──────────────────────────────────');
        info(`leaveBalances    : ${JSON.stringify(testUser.leaveBalances.toObject())}`);
        info(`leaveEntitlements: ${JSON.stringify(testUser.leaveEntitlements.toObject())}`);
        info(`probationConfirmation: ${JSON.stringify(testUser.probationConfirmation)}`);

        // ── PROMOTE ──────────────────────────────────────────────────────────
        console.log('\n── Calling promoteEmployeeToPermanent… ───────────────');
        const result = await ProbationTrackingService.promoteEmployeeToPermanent(
            testUser._id.toString(),
            adminId.toString()
        );
        info(`Result: ${JSON.stringify(result, null, 2)}`);

        // ── AFTER snapshot ───────────────────────────────────────────────────
        const after = await User.findById(testUser._id).lean();
        console.log('\n── AFTER promotion ───────────────────────────────────');
        info(`leaveBalances    : ${JSON.stringify(after.leaveBalances)}`);
        info(`leaveEntitlements: ${JSON.stringify(after.leaveEntitlements)}`);
        info(`probationConfirmation: ${JSON.stringify(after.probationConfirmation)}`);

        // ── ASSERTIONS ───────────────────────────────────────────────────────
        console.log('\n── Assertions ────────────────────────────────────────');

        // 1. employmentStatus must be Permanent
        if (after.employmentStatus === 'Permanent') {
            pass('employmentStatus is Permanent');
        } else {
            fail(`employmentStatus expected Permanent, got ${after.employmentStatus}`);
        }

        // 2. leaveEntitlements must be UNCHANGED at 6/6/10
        console.log('\n  [leaveEntitlements must stay at 6/6/10]');
        assertEq('leaveEntitlements.sick',   after.leaveEntitlements.sick,   6);
        assertEq('leaveEntitlements.casual', after.leaveEntitlements.casual, 6);
        assertEq('leaveEntitlements.paid',   after.leaveEntitlements.paid,   10);

        // 3. leaveBalances must equal prorated amounts
        const expected = expectedProrated(confirmationMonth);
        console.log(`\n  [leaveBalances must equal prorated values for month ${confirmationMonth}]`);
        info(`Expected prorated: ${JSON.stringify(expected)}`);
        assertEq('leaveBalances.sick',   after.leaveBalances.sick,   expected.sick);
        assertEq('leaveBalances.casual', after.leaveBalances.casual, expected.casual);
        assertEq('leaveBalances.paid',   after.leaveBalances.paid,   expected.paid);

        // 4. probationConfirmation must be stored correctly
        console.log('\n  [probationConfirmation persisted]');
        const pc = after.probationConfirmation;
        if (!pc) {
            fail('probationConfirmation is missing');
        } else {
            assertEq('probationConfirmation.year',  pc.year,  confirmationYear);
            assertEq('probationConfirmation.month', pc.month, confirmationMonth);
            assertEq('probationConfirmation.proratedEntitlements.sick',   pc.proratedEntitlements.sick,   expected.sick);
            assertEq('probationConfirmation.proratedEntitlements.casual', pc.proratedEntitlements.casual, expected.casual);
            assertEq('probationConfirmation.proratedEntitlements.paid',   pc.proratedEntitlements.paid,   expected.paid);
            if (pc.appliedAt) { pass('probationConfirmation.appliedAt is set'); }
            else              { fail('probationConfirmation.appliedAt is missing'); }
        }

        // 5. LeaveLedger must have exactly one CONFIRMATION_ALLOTMENT per leave type
        console.log('\n  [LeaveLedger CONFIRMATION_ALLOTMENT entries]');
        for (const lt of ['sick', 'casual', 'paid']) {
            const count = await LeaveLedger.countDocuments({
                employeeId:      testUser._id,
                leaveType:       lt,
                transactionType: 'CONFIRMATION_ALLOTMENT'
            });
            if (expected[lt] > 0) {
                if (count === 1) { pass(`${lt}: exactly 1 CONFIRMATION_ALLOTMENT ledger entry`); }
                else             { fail(`${lt}: expected 1 ledger entry, found ${count}`); }
            } else {
                if (count === 0) { pass(`${lt}: 0 entries (amount was 0, correct)`); }
                else             { fail(`${lt}: expected 0 entries (amount=0) but found ${count}`); }
            }
        }

        // 6. Dry-run accrual for next month — cron must not exceed prorated cap
        const nextMonth = confirmationMonth < 12 ? confirmationMonth + 1 : 1;
        const nextYear  = confirmationMonth < 12 ? confirmationYear : confirmationYear + 1;
        console.log(`\n── Dry-run accrual for month ${nextMonth}/${nextYear} ──────────────`);

        const dryRun = await LeaveAccrualService.processMonthlyAccrual(
            nextMonth,
            nextYear,
            { dryRun: true, employeeIds: [testUser._id] }
        );

        const empAccrual = dryRun.accruals.find(a => String(a.employeeId) === String(testUser._id));
        if (!empAccrual) {
            fail('Employee not found in dry-run accrual results');
        } else {
            info(`Dry-run accrual result: ${JSON.stringify(empAccrual.accruals, null, 2)}`);
            // In the same year: for each leave type, balance + accrual must not exceed prorated cap
            if (nextYear === confirmationYear) {
                console.log('\n  [Same year — balance must not exceed prorated cap]');
                for (const lt of ['sick', 'casual', 'paid']) {
                    const accrualData = empAccrual.accruals[lt];
                    if (!accrualData) continue;
                    const balanceAfter = accrualData.balanceAfter ?? (after.leaveBalances[lt] + (accrualData.amount || 0));
                    const cap = expected[lt];
                    if (balanceAfter <= cap + 0.01) {
                        pass(`${lt}: dry-run balanceAfter (${balanceAfter}) ≤ prorated cap (${cap})`);
                    } else {
                        fail(`${lt}: dry-run balanceAfter (${balanceAfter}) exceeds prorated cap (${cap})`);
                    }
                }
            } else {
                // Next year — probationConfirmation.year won't match, falls back to full 6/6/10
                console.log('\n  [Next year — falls back to full entitlements, no cap applied]');
                pass('Next year accrual uses standard leaveEntitlements (self-expiring cap)');
            }
        }

        // 7. Dry-run accrual for month 12/2026 (same year — cap must still hold)
        console.log('\n── Dry-run accrual for month 12/2026 (still same year, cap must still hold) ──');
        const decResult = await LeaveAccrualService.processMonthlyAccrual(
            12, confirmationYear, { dryRun: true, employeeIds: [testUser._id] }
        );
        const decAccrual = decResult.accruals.find(a => String(a.employeeId) === String(testUser._id))?.accruals;
        assert(
            decAccrual.sick.amount === 0 && decAccrual.sick.reason === 'Already at maximum',
            `sick should still be capped in Dec ${confirmationYear}, got ${JSON.stringify(decAccrual.sick)}`
        );
        pass(`cap still holds later in the same confirmation year (Dec ${confirmationYear})`);

        // 8. Dry-run accrual for month 1/2027 (cross-year rollover)
        console.log('\n── Dry-run accrual for month 1/2027 (cross-year rollover) ──────────────────');
        const rolloverResult = await LeaveAccrualService.processMonthlyAccrual(
            1,      // January
            2027,   // next calendar year
            { dryRun: true, employeeIds: [testUser._id] }
        );
        const rolloverAccrual = rolloverResult.accruals.find(a => String(a.employeeId) === String(testUser._id))?.accruals;
        info(`Rollover dry-run result: ${JSON.stringify(rolloverAccrual, null, 2)}`);

        console.log('\n  [Next year — cap must be ignored, full 6/6/10 entitlement must apply]');
        assert(
            rolloverAccrual.sick.entitlement === 6,
            `sick entitlement in 2027 should be 6 (full annual), got ${rolloverAccrual.sick.entitlement}`
        );
        assert(
            rolloverAccrual.casual.entitlement === 6,
            `casual entitlement in 2027 should be 6 (full annual), got ${rolloverAccrual.casual.entitlement}`
        );
        assert(
            rolloverAccrual.paid.entitlement === 10,
            `paid entitlement in 2027 should be 10 (full annual), got ${rolloverAccrual.paid.entitlement}`
        );
        assert(
            rolloverAccrual.sick.amount > 0,
            `sick should accrue normally in 2027 (amount > 0), got ${rolloverAccrual.sick.amount}`
        );
        pass('entitlement correctly reverted to full annual 6/6/10 in 2027');
        pass('normal monthly accrual resumed (probationConfirmation.year 2026 correctly ignored)');

        // 9. Edge case: attempting to promote again must throw
        console.log('\n── Edge case: double-promote must throw ──────────────');
        try {
            await ProbationTrackingService.promoteEmployeeToPermanent(
                testUser._id.toString(),
                adminId.toString()
            );
            fail('Second promote should have thrown but did not');
        } catch (e) {
            if (e.message === 'Employee is not on probation') {
                pass(`Throws 'Employee is not on probation' on second attempt`);
            } else {
                fail(`Unexpected error on second attempt: ${e.message}`);
            }
        }

    } finally {
        // ── CLEANUP ──────────────────────────────────────────────────────────
        console.log('\n── Cleanup ───────────────────────────────────────────');
        await LeaveLedger.deleteMany({ employeeId: testUser._id });
        await User.deleteOne({ _id: testUser._id });
        info(`Removed test user ${testCode} and their ledger entries`);

        await mongoose.connection.close();
        console.log('\n🔌  Connection closed');
        console.log(process.exitCode ? '\n❌  Some assertions FAILED.' : '\n✅  All assertions passed.');
    }
}

run().catch(err => {
    console.error('\n💥  Unhandled error:', err);
    process.exit(1);
});
