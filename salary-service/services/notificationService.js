'use strict';
// services/notificationService.js
//
// Email notification service for payroll events.
// Uses nodemailer for SMTP delivery when EMAIL_NOTIFICATIONS_ENABLED is true.
//
// NOTE: nodemailer must be added as a dependency:
//   npm install nodemailer@^6.9.0
//
// Environment variables required for email functionality:
//   - EMAIL_NOTIFICATIONS_ENABLED=true  (gate flag, default false)
//   - SMTP_HOST                         (e.g. smtp.gmail.com)
//   - SMTP_PORT                         (e.g. 587 for TLS, 465 for SSL)
//   - SMTP_USER                         (SMTP auth username)
//   - SMTP_PASS                         (SMTP auth password)
//   - SMTP_FROM                         (sender address, e.g. noreply@company.com)
//
// If EMAIL_NOTIFICATIONS_ENABLED is not set to 'true', all email functions log
// a warning and return without error — email failures never crash callers.

const { audit } = require('./auditLogger');
const { fetchEmployeeList } = require('./amsFeedClient');

// Lazy-load nodemailer only when needed (not a dependency yet)
let nodemailer = null;
let transporter = null;

const EMAIL_ENABLED = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';

/**
 * Initialises the nodemailer transporter if SMTP is configured.
 * Called lazily on first use.
 * @returns {object|null} nodemailer transporter or null if not configured
 */
function getTransporter() {
    if (!EMAIL_ENABLED) return null;
    if (transporter) return transporter;

    try {
        // Attempt to load nodemailer (will fail if not installed)
        nodemailer = require('nodemailer');
    } catch (err) {
        console.warn('[NotificationService] nodemailer not installed — email sending disabled. Install with: npm install nodemailer');
        return null;
    }

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
        console.warn('[NotificationService] SMTP config incomplete (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM required) — email sending disabled.');
        return null;
    }

    try {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT, 10),
            secure: parseInt(SMTP_PORT, 10) === 465, // true for port 465, false for other ports (use STARTTLS)
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });
        console.log('[NotificationService] SMTP transporter initialised successfully.');
    } catch (err) {
        console.error('[NotificationService] Failed to create SMTP transporter:', err.message);
        return null;
    }

    return transporter;
}

/**
 * Sends payroll finalised emails to all employees who have non-skipped slips
 * in the given payroll run.
 *
 * @param {object} payrollRun   — PayrollRun document
 * @param {Array<object>} slips — array of SalarySlip documents for this run
 * @returns {Promise<void>}
 */
async function sendPayrollFinalisedEmails(payrollRun, slips) {
    if (!EMAIL_ENABLED) {
        console.log(`[NotificationService] EMAIL_NOTIFICATIONS_ENABLED is not true — skipping payroll finalised emails for run ${payrollRun._id}`);
        return;
    }

    const transport = getTransporter();
    if (!transport) {
        console.warn(`[NotificationService] SMTP not configured — skipping payroll finalised emails for run ${payrollRun._id}`);
        return;
    }

    // Filter out skipped slips
    const eligibleSlips = slips.filter(slip => !slip.skipped);
    if (eligibleSlips.length === 0) {
        console.log(`[NotificationService] No eligible slips for run ${payrollRun._id} — no emails to send.`);
        return;
    }

    // Fetch employee list from AMS to get email addresses
    let employeeMap = {};
    try {
        const employees = await fetchEmployeeList();
        employeeMap = employees.reduce((map, emp) => {
            if (emp.employeeId && emp.email) {
                map[emp.employeeId] = emp.email;
            }
            return map;
        }, {});
    } catch (err) {
        console.error('[NotificationService] Failed to fetch employee list from AMS:', err.message);
        // Log audit event for failure
        await audit({
            action: 'PAYRUN_FINALIZED',
            subject: payrollRun._id.toString(),
            details: {
                emailNotificationFailed: true,
                reason: 'Failed to fetch employee list from AMS',
                error: err.message,
            },
            success: false,
            errorMessage: err.message,
        });
        return; // Don't block finalization if email fails
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[payrollRun.month - 1] || payrollRun.month;
    const subject = `Your Salary Slip for ${monthName} ${payrollRun.year}`;

    let successCount = 0;
    let failureCount = 0;

    // Send emails one by one (could be batched/queued for production scale)
    for (const slip of eligibleSlips) {
        const employeeEmail = employeeMap[slip.employeeId];
        
        if (!employeeEmail) {
            console.warn(`[NotificationService] No email found for employee ${slip.employeeId} — skipping.`);
            failureCount++;
            continue;
        }

        try {
            await sendPayslipEmail({
                to: employeeEmail,
                subject,
                employeeName: slip.employeeName || slip.employeeId,
                month: monthName,
                year: payrollRun.year,
                payDate: payrollRun.payDate || null,
            });
            successCount++;
        } catch (err) {
            console.error(`[NotificationService] Failed to send email to ${employeeEmail} (${slip.employeeId}):`, err.message);
            failureCount++;
            // Don't throw — continue sending to other employees
        }
    }

    console.log(`[NotificationService] Payroll finalised emails for run ${payrollRun._id}: ${successCount} sent, ${failureCount} failed.`);

    // Log audit event summarising email delivery
    await audit({
        action: 'PAYRUN_FINALIZED',
        subject: payrollRun._id.toString(),
        details: {
            emailNotificationEnabled: true,
            totalEligibleSlips: eligibleSlips.length,
            emailsSent: successCount,
            emailsFailed: failureCount,
        },
        success: failureCount === 0,
        errorMessage: failureCount > 0 ? `${failureCount} email(s) failed to send` : null,
    });
}

/**
 * Sends a single payslip notification email.
 *
 * @param {object} opts
 * @param {string} opts.to            — recipient email address
 * @param {string} opts.subject       — email subject line
 * @param {string} opts.employeeName  — employee name for personalisation
 * @param {string} opts.month         — month name (e.g. "January")
 * @param {number} opts.year          — year (e.g. 2026)
 * @param {Date|null} opts.payDate    — scheduled pay date (optional)
 * @returns {Promise<void>}
 */
async function sendPayslipEmail({ to, subject, employeeName, month, year, payDate }) {
    const transport = getTransporter();
    if (!transport) {
        throw new Error('SMTP transporter not available');
    }

    const payDateText = payDate 
        ? `Your salary will be credited on ${new Date(payDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`
        : 'Your salary will be credited as per the scheduled pay date.';

    const text = `Dear ${employeeName},

Your salary slip for ${month} ${year} has been finalised and is now available for download.

${payDateText}

You can download your salary slip from the employee portal at your convenience.

If you have any questions regarding your salary slip, please contact the HR department.

Best regards,
Payroll Team`;

    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .content { padding: 10px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0; color: #2c3e50;">Salary Slip Available</h2>
        </div>
        <div class="content">
            <p>Dear ${employeeName},</p>
            <p>Your salary slip for <strong>${month} ${year}</strong> has been finalised and is now available for download.</p>
            <p>${payDateText}</p>
            <p>You can download your salary slip from the employee portal at your convenience.</p>
            <p>If you have any questions regarding your salary slip, please contact the HR department.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>Payroll Team</p>
        </div>
    </div>
</body>
</html>`;

    const mailOptions = {
        from: process.env.SMTP_FROM,
        to,
        subject,
        text,
        html,
    };

    try {
        const info = await transport.sendMail(mailOptions);
        console.log(`[NotificationService] Email sent to ${to}: ${info.messageId}`);
    } catch (err) {
        console.error(`[NotificationService] Failed to send email to ${to}:`, err.message);
        throw err; // Re-throw so caller can handle
    }
}

/**
 * Sends a payment notification for an individual salary slip.
 * Called when a slip is marked paid individually (not as part of whole-run mark-paid).
 *
 * @param {object} opts
 * @param {object} opts.slip     — SalarySlip document that was just marked paid
 * @param {object} opts.run      — Parent PayrollRun document
 * @param {string} opts.actorId  — User ID who marked the slip paid
 * @returns {Promise<void>}
 */
async function sendPayslipNotification({ slip, run, actorId }) {
    if (!EMAIL_ENABLED) {
        // Write explicit audit note — do not silently skip
        await audit({
            action: 'SLIP_MARKED_PAID_INDIVIDUAL',
            subject: slip.employeeId,
            details: {
                runId: run._id,
                paymentMode: slip.paymentMode,
                notificationRequested: true,
                notificationSent: false,
                notificationSkipReason: 'EMAIL_NOTIFICATIONS_ENABLED is not set to true',
            },
        });
        console.log(`[NotificationService] EMAIL_NOTIFICATIONS_ENABLED is not true — skipping payslip notification for slip ${slip._id}`);
        return;
    }

    const transport = getTransporter();
    if (!transport) {
        console.warn(`[NotificationService] SMTP not configured — skipping payslip notification for slip ${slip._id}`);
        await audit({
            action: 'SLIP_MARKED_PAID_INDIVIDUAL',
            subject: slip.employeeId,
            details: {
                runId: run._id,
                paymentMode: slip.paymentMode,
                notificationRequested: true,
                notificationSent: false,
                notificationSkipReason: 'SMTP not configured',
            },
        });
        return;
    }

    // Fetch employee email from AMS
    let employeeEmail = null;
    try {
        const employees = await fetchEmployeeList();
        const employee = employees.find(emp => emp.employeeId === slip.employeeId);
        employeeEmail = employee?.email;
    } catch (err) {
        console.error('[NotificationService] Failed to fetch employee list from AMS:', err.message);
        await audit({
            action: 'SLIP_MARKED_PAID_INDIVIDUAL',
            subject: slip.employeeId,
            details: {
                runId: run._id,
                paymentMode: slip.paymentMode,
                notificationRequested: true,
                notificationSent: false,
                notificationSkipReason: 'Failed to fetch employee email from AMS',
                error: err.message,
            },
        });
        return;
    }

    if (!employeeEmail) {
        console.warn(`[NotificationService] No email found for employee ${slip.employeeId} — skipping notification.`);
        await audit({
            action: 'SLIP_MARKED_PAID_INDIVIDUAL',
            subject: slip.employeeId,
            details: {
                runId: run._id,
                paymentMode: slip.paymentMode,
                notificationRequested: true,
                notificationSent: false,
                notificationSkipReason: 'No email address found for employee',
            },
        });
        return;
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[run.month - 1] || run.month;
    const subject = `Payment Confirmation: ${monthName} ${run.year} Salary`;

    try {
        await sendPaymentConfirmationEmail({
            to: employeeEmail,
            subject,
            employeeName: slip.employeeName || slip.employeeId,
            month: monthName,
            year: run.year,
            paidAt: slip.paidAt,
            paymentMode: slip.paymentMode,
        });

        await audit({
            action: 'SLIP_MARKED_PAID_INDIVIDUAL',
            subject: slip.employeeId,
            details: {
                runId: run._id,
                paymentMode: slip.paymentMode,
                notificationRequested: true,
                notificationSent: true,
                recipientEmail: employeeEmail,
            },
        });

        console.log(`[NotificationService] Payment notification sent to ${employeeEmail} for slip ${slip._id}`);
    } catch (err) {
        console.error(`[NotificationService] Failed to send payment notification to ${employeeEmail}:`, err.message);
        await audit({
            action: 'SLIP_MARKED_PAID_INDIVIDUAL',
            subject: slip.employeeId,
            details: {
                runId: run._id,
                paymentMode: slip.paymentMode,
                notificationRequested: true,
                notificationSent: false,
                notificationSkipReason: 'Email send failed',
                error: err.message,
            },
        });
        // Don't throw — notification failure shouldn't fail the payment recording
    }
}

/**
 * Sends a payment confirmation email for an individual salary slip.
 *
 * @param {object} opts
 * @param {string} opts.to            — recipient email address
 * @param {string} opts.subject       — email subject line
 * @param {string} opts.employeeName  — employee name for personalisation
 * @param {string} opts.month         — month name (e.g. "January")
 * @param {number} opts.year          — year (e.g. 2026)
 * @param {Date} opts.paidAt          — payment date
 * @param {string} opts.paymentMode   — payment mode (bankTransfer, cheque, cash)
 * @returns {Promise<void>}
 */
async function sendPaymentConfirmationEmail({ to, subject, employeeName, month, year, paidAt, paymentMode }) {
    const transport = getTransporter();
    if (!transport) {
        throw new Error('SMTP transporter not available');
    }

    const paymentModeLabel = {
        bankTransfer: 'Bank Transfer',
        cheque: 'Cheque',
        cash: 'Cash',
    }[paymentMode] || paymentMode;

    const paidDateText = new Date(paidAt).toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });

    const text = `Dear ${employeeName},

This is to confirm that your salary payment for ${month} ${year} has been processed successfully.

Payment Details:
- Payment Date: ${paidDateText}
- Payment Mode: ${paymentModeLabel}

You can view your salary slip details in the employee portal.

If you have any questions or concerns regarding this payment, please contact the HR department.

Best regards,
Payroll Team`;

    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .content { padding: 10px 0; }
        .payment-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .payment-details table { width: 100%; border-collapse: collapse; }
        .payment-details td { padding: 8px; }
        .payment-details td:first-child { font-weight: bold; width: 40%; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0; color: #2e7d32;">Payment Confirmation</h2>
        </div>
        <div class="content">
            <p>Dear ${employeeName},</p>
            <p>This is to confirm that your salary payment for <strong>${month} ${year}</strong> has been processed successfully.</p>
            <div class="payment-details">
                <table>
                    <tr>
                        <td>Payment Date:</td>
                        <td>${paidDateText}</td>
                    </tr>
                    <tr>
                        <td>Payment Mode:</td>
                        <td>${paymentModeLabel}</td>
                    </tr>
                </table>
            </div>
            <p>You can view your salary slip details in the employee portal.</p>
            <p>If you have any questions or concerns regarding this payment, please contact the HR department.</p>
        </div>
        <div class="footer">
            <p>Best regards,<br>Payroll Team</p>
        </div>
    </div>
</body>
</html>`;

    const mailOptions = {
        from: process.env.SMTP_FROM,
        to,
        subject,
        text,
        html,
    };

    try {
        const info = await transport.sendMail(mailOptions);
        console.log(`[NotificationService] Payment confirmation email sent to ${to}: ${info.messageId}`);
    } catch (err) {
        console.error(`[NotificationService] Failed to send payment confirmation email to ${to}:`, err.message);
        throw err; // Re-throw so caller can handle
    }
}

module.exports = {
    sendPayrollFinalisedEmails,
    sendPayslipNotification,
};
