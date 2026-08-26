'use strict';
// services/pdfGenerator.js
//
// Generates a salary slip PDF using pdf-lib.
// Each generated PDF is watermarked with the generation metadata so a leaked
// document is traceable (recipient label + date stamped visibly).
//
// Watermarking note: this is the practical deterrent against casual redistribution.
// It does NOT prevent a determined actor with a screenshot tool — document this
// limitation to the admin team.  The watermark identifies the source if a
// document leaks and deters casual forwarding.

const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');

/**
 * Generates a salary slip PDF.
 *
 * @param {object} params
 * @param {object} params.slip        — SalarySlip document (plain object / lean)
 * @param {object} params.profile     — EmployeeFinancialProfile (with decrypted fields if needed)
 * @param {string} params.companyName — from env or settings
 * @param {object} [params.watermark] — { label, date } — added as diagonal overlay if provided
 * @returns {Promise<Buffer>} PDF bytes
 */
async function generateSalarySlipPDF({ slip, profile, companyName = 'Company', watermark = null }) {
    const doc  = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();

    const fontBold    = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

    const COLOR_DARK   = rgb(0.1, 0.1, 0.1);
    const COLOR_ACCENT = rgb(0.18, 0.38, 0.65);
    const COLOR_LIGHT  = rgb(0.6, 0.6, 0.6);
    const COLOR_LINE   = rgb(0.82, 0.82, 0.82);

    const MARGIN  = 50;
    const COL_MID = width / 2;

    let y = height - MARGIN;

    // ─── Header ────────────────────────────────────────────────────────────────
    page.drawText(companyName, {
        x: MARGIN, y,
        size: 18, font: fontBold, color: COLOR_ACCENT,
    });

    y -= 20;
    page.drawText('SALARY SLIP', {
        x: MARGIN, y,
        size: 12, font: fontRegular, color: COLOR_LIGHT,
    });

    const monthLabel = new Date(slip.year, slip.month - 1, 1)
        .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    page.drawText(monthLabel, {
        x: width - MARGIN - 120, y: height - MARGIN,
        size: 11, font: fontBold, color: COLOR_DARK,
    });

    y -= 14;
    drawHRule(page, MARGIN, width - MARGIN, y, COLOR_ACCENT, 1.5);
    y -= 20;

    // ─── Employee info ─────────────────────────────────────────────────────────
    page.drawText('Employee Details', {
        x: MARGIN, y, size: 10, font: fontBold, color: COLOR_ACCENT,
    });
    y -= 16;

    const empInfoRows = [
        ['Employee ID', slip.employeeId],
        ['Employee Name', slip.employeeName || '—'],
        ['Pay Period', monthLabel],
        ['Generated', new Date(slip.generatedAt || Date.now()).toLocaleDateString('en-IN')],
    ];
    for (const [label, value] of empInfoRows) {
        page.drawText(`${label}:`, { x: MARGIN, y, size: 9, font: fontBold, color: COLOR_DARK });
        page.drawText(String(value), { x: MARGIN + 110, y, size: 9, font: fontRegular, color: COLOR_DARK });
        y -= 14;
    }

    y -= 8;
    drawHRule(page, MARGIN, width - MARGIN, y, COLOR_LINE, 0.5);
    y -= 18;

    // ─── Earnings ──────────────────────────────────────────────────────────────
    const colEarning  = MARGIN;
    const colDeduct   = COL_MID + 10;
    const colValWidth = 80;

    drawSectionHeader(page, 'Earnings', colEarning, y, fontBold, COLOR_ACCENT);
    drawSectionHeader(page, 'Deductions', colDeduct, y, fontBold, COLOR_ACCENT);
    y -= 16;

    const earnings = [
        ['Basic Salary',    slip.basicSalary],
        ['HRA',             slip.hra],
        ['Allowances',      slip.allowances],
        ['Overtime Pay',    slip.overtimePay],
        ['Bonus',           slip.bonus],
    ];
    const deductions = [
        ['Provident Fund',    slip.deductions?.pf],
        ['ESI',               slip.deductions?.esi],
        ['Professional Tax',  slip.deductions?.professionalTax],
        ['TDS',               slip.deductions?.tds],
        ['LOP Deduction',     slip.deductions?.lopDeduction],
        ['Other',             slip.deductions?.other],
    ];

    const maxRows = Math.max(earnings.length, deductions.length);
    for (let i = 0; i < maxRows; i++) {
        if (earnings[i]) {
            drawLabelValue(page, earnings[i][0], formatINR(earnings[i][1]),
                colEarning, COL_MID - 10, y, fontRegular, fontBold, COLOR_DARK);
        }
        if (deductions[i]) {
            drawLabelValue(page, deductions[i][0], formatINR(deductions[i][1]),
                colDeduct, width - MARGIN, y, fontRegular, fontBold, COLOR_DARK);
        }
        y -= 14;
    }

    y -= 6;
    drawHRule(page, MARGIN, width - MARGIN, y, COLOR_LINE, 0.5);
    y -= 16;

    // Totals row
    drawLabelValue(page, 'Gross Pay', formatINR(slip.grossPay),
        colEarning, COL_MID - 10, y, fontBold, fontBold, COLOR_ACCENT);
    drawLabelValue(page, 'Total Deductions', formatINR(slip.totalDeductions),
        colDeduct, width - MARGIN, y, fontBold, fontBold, rgb(0.7, 0.1, 0.1));
    y -= 20;

    // Net pay banner
    page.drawRectangle({
        x: MARGIN, y: y - 8,
        width: width - 2 * MARGIN,
        height: 28,
        color: COLOR_ACCENT,
        borderWidth: 0,
    });
    page.drawText('Net Pay:', {
        x: MARGIN + 10, y: y + 4,
        size: 11, font: fontBold, color: rgb(1, 1, 1),
    });
    const netStr = formatINR(slip.netPay);
    const netWidth = fontBold.widthOfTextAtSize(netStr, 13);
    page.drawText(netStr, {
        x: width - MARGIN - netWidth - 10, y: y + 4,
        size: 13, font: fontBold, color: rgb(1, 1, 1),
    });
    y -= 42;

    // ─── Attendance summary ────────────────────────────────────────────────────
    y -= 10;
    page.drawText('Attendance Summary', {
        x: MARGIN, y, size: 10, font: fontBold, color: COLOR_ACCENT,
    });
    y -= 16;

    const att = slip.attendanceData || {};
    const attRows = [
        ['Working Days', att.workingDays],
        ['Present Days', att.presentDays],
        ['Paid Leave',   att.paidLeaveDays],
        ['Unpaid Leave', att.unpaidLeaveDays],
        ['Half Days',    att.halfDays],
        ['LOP Days',     att.lopDays],
        ['Overtime Hrs', att.overtimeHours],
    ];
    const perCol = Math.ceil(attRows.length / 2);
    for (let i = 0; i < perCol; i++) {
        if (attRows[i]) {
            page.drawText(`${attRows[i][0]}: ${attRows[i][1] ?? 0}`, {
                x: MARGIN, y, size: 9, font: fontRegular, color: COLOR_DARK,
            });
        }
        if (attRows[i + perCol]) {
            page.drawText(`${attRows[i + perCol][0]}: ${attRows[i + perCol][1] ?? 0}`, {
                x: COL_MID + 10, y, size: 9, font: fontRegular, color: COLOR_DARK,
            });
        }
        y -= 14;
    }

    // ─── Footer ────────────────────────────────────────────────────────────────
    drawHRule(page, MARGIN, width - MARGIN, MARGIN + 30, COLOR_LINE, 0.5);
    page.drawText('This is a computer-generated document. No signature required.', {
        x: MARGIN, y: MARGIN + 14,
        size: 8, font: fontRegular, color: COLOR_LIGHT,
    });
    page.drawText(`Generated by salary-service • ${new Date().toISOString()}`, {
        x: MARGIN, y: MARGIN + 4,
        size: 7, font: fontRegular, color: COLOR_LIGHT,
    });

    // ─── Watermark (diagonal, semi-transparent) ────────────────────────────────
    if (watermark && watermark.label) {
        const wmText  = `Shared with: ${watermark.label}  |  ${watermark.date || new Date().toLocaleDateString('en-IN')}`;
        const wmSize  = 11;
        const wmWidth = fontRegular.widthOfTextAtSize(wmText, wmSize);
        page.drawText(wmText, {
            x: (width - wmWidth) / 2,
            y: height / 2 - 20,
            size: wmSize,
            font: fontRegular,
            color: rgb(0.6, 0.6, 0.6),
            opacity: 0.35,
            rotate: degrees(35),
        });
    }

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function drawHRule(page, x1, x2, y, color, thickness = 0.5) {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function drawSectionHeader(page, text, x, y, font, color) {
    page.drawText(text, { x, y, size: 10, font, color });
}

function drawLabelValue(page, label, value, colStart, colEnd, y, labelFont, valueFont, color) {
    const valWidth = valueFont.widthOfTextAtSize(value, 9);
    page.drawText(label, { x: colStart, y, size: 9, font: labelFont, color });
    page.drawText(value, { x: colEnd - valWidth, y, size: 9, font: valueFont, color });
}

function formatINR(amount) {
    const n = Number(amount) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

module.exports = { generateSalarySlipPDF };
