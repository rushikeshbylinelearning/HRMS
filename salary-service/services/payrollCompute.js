'use strict';
// services/payrollCompute.js
//
// Pure payroll computation logic — no DB calls, no side effects.
// All inputs are validated before entry; all outputs are plain objects.
//
// This replaces the placeholder calculation in AMS's payrollRoutes.js /calculate.
// Real logic: computes from CTC or fixed salary, applies statutory deductions,
// and applies LOP (Loss of Pay) based on actual attendance days.

/**
 * Computes the full breakdown for one employee's monthly salary slip.
 *
 * @param {object} params
 * @param {object} params.financialProfile  — from EmployeeFinancialProfile
 * @param {object} params.settings          — from PayrollSettings
 * @param {object} params.attendanceData    — from AMS internal feed
 * @param {number} params.bonus             — one-time bonus for this run (default 0)
 * @param {Array}  params.lopAdjustments    — additive LOP adjustment entries [{ days, type }] (default [])
 * @param {Array}  params.oneTimeEntries    — additive one-time earning/deduction entries [{ amount, kind }] (default [])
 * @returns {object} computed salary breakdown
 */
function computeSalarySlip({
    financialProfile,
    settings,
    attendanceData,
    bonus = 0,
    lopAdjustments = [],   // NEW — array of { days, type } entries from SalarySlip
    oneTimeEntries = [],   // NEW — array of { amount, kind } entries from SalarySlip
}) {
    // ─── Step 1: Monthly salary components ────────────────────────────────────
    let basicMonthly, hraMonthly, allowancesMonthly;

    if (financialProfile.useFixedSalary && financialProfile.basicSalary > 0) {
        // Fixed salary mode — use stored values directly
        basicMonthly       = financialProfile.basicSalary;
        hraMonthly         = financialProfile.hra;
        allowancesMonthly  = financialProfile.allowances;
    } else {
        // CTC percentage mode — annualised CTC divided by 12
        const annualCTC    = financialProfile.ctc;
        basicMonthly       = (annualCTC * settings.basicPercentage / 100) / 12;
        hraMonthly         = (annualCTC * settings.hraPercentage / 100) / 12;
        allowancesMonthly  = (annualCTC * settings.allowancesPercentage / 100) / 12;
    }

    const grossBeforeLOP = basicMonthly + hraMonthly + allowancesMonthly;

    // ─── Step 2: LOP (Loss of Pay) deduction ──────────────────────────────────
    // lopDays = attendanceData.lopDays (explicitly marked by AMS) or
    //           unpaidLeaveDays (leave days without pay).
    const lopDays = (attendanceData.lopDays || 0) + (attendanceData.unpaidLeaveDays || 0);
    const standardWorkingDays = settings.standardWorkingDays || 26;

    // LOP daily rate: use configured rate or fall back to proportional computation
    const lopDailyRate = settings.lopDailyRate > 0
        ? settings.lopDailyRate
        : grossBeforeLOP / standardWorkingDays;

    const lopDeduction = round2(lopDays * lopDailyRate);

    // ─── Step 3: Half-day adjustment (half-days counted as 0.5 LOP) ───────────
    const halfDayDeduction = round2((attendanceData.halfDays || 0) * 0.5 * lopDailyRate);

    // ─── Step 4: Overtime earnings ────────────────────────────────────────────
    const overtimePay = round2((attendanceData.overtimeHours || 0) * (settings.overtimeHourlyRate || 0));

    // ─── Step 5b: Apply lopAdjustments additively ────────────────────────────
    // reversals: add days back (negative delta); manual_additions: add more LOP (positive delta)
    const lopAdjDelta = lopAdjustments.reduce((acc, adj) => {
        return acc + (adj.type === 'reversal' ? -adj.days : adj.days);
    }, 0);
    // Effective LOP days (clamped at 0 — cannot go negative)
    const effectiveLopDays = Math.max(0, lopDays + lopAdjDelta);
    // Recompute lopDeduction with adjusted days
    const lopDeductionAdjusted = round2(effectiveLopDays * lopDailyRate);

    // ─── Step 5c: Apply oneTimeEntries additively ─────────────────────────────
    const oneTimeEarnings = oneTimeEntries
        .filter(e => e.kind === 'earning')
        .reduce((s, e) => s + e.amount, 0);
    const oneTimeDeductions = oneTimeEntries
        .filter(e => e.kind === 'deduction')
        .reduce((s, e) => s + e.amount, 0);

    // ─── Step 5: Gross pay (recomputed with adjusted LOP and one-time earnings) ──
    const grossPay = round2(
        grossBeforeLOP
        - lopDeductionAdjusted
        - halfDayDeduction
        + overtimePay
        + (bonus || 0)
        + oneTimeEarnings
    );

    // ─── Step 6: Statutory deductions (applied to post-LOP gross) ─────────────
    // PF is on basic only (post-LOP proportional basic, using adjusted effective LOP days)
    const effectiveBasic = round2(basicMonthly - (effectiveLopDays + (attendanceData.halfDays || 0) * 0.5) * (basicMonthly / standardWorkingDays));
    const pf             = round2(effectiveBasic * settings.pfPercentage / 100);
    const esi            = round2(grossPay * settings.esiPercentage / 100);
    const tds            = round2(grossPay * settings.tdsPercentage / 100);
    const profTax        = settings.professionalTax || 0;

    // totalDeductions includes oneTimeDeductions
    const totalDeductions = round2(pf + esi + tds + profTax + lopDeductionAdjusted + halfDayDeduction + oneTimeDeductions);

    // ─── Step 7: Net pay ──────────────────────────────────────────────────────
    const netPay = round2(grossPay - pf - esi - tds - profTax - oneTimeDeductions);

    return {
        basicSalary:     round2(basicMonthly),
        hra:             round2(hraMonthly),
        allowances:      round2(allowancesMonthly),
        overtimePay,
        bonus:           round2(bonus || 0),
        grossPay,
        deductions: {
            pf,
            esi,
            professionalTax: profTax,
            tds,
            lopDeduction:    round2(lopDeductionAdjusted + halfDayDeduction),
            other:           round2(oneTimeDeductions),
        },
        totalDeductions,
        netPay,
        // Expose computed adjustment deltas for auditability
        _lopAdjDelta:        lopAdjDelta,
        _oneTimeEarnings:    round2(oneTimeEarnings),
        _oneTimeDeductions:  round2(oneTimeDeductions),
    };
}

function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { computeSalarySlip };
