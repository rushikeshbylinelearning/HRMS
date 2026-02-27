// backend/services/teamsAttendanceNotificationService.js
/**
 * Teams Attendance Notification Service — Power Automate Webhook
 *
 * Sends a configurable daily attendance report to a Teams channel.
 * Report content is controlled by TEAMS_REPORT_CONFIG setting in DB.
 */

const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const AttendanceLog = require('../models/AttendanceLog');
const LeaveRequest = require('../models/LeaveRequest');
const Setting = require('../models/Setting');
const { getISTNow, getISTDateString, startOfISTDay } = require('../utils/istTime');

const TEAMS_WEBHOOK_KEY     = 'teamsAttendanceWebhookUrl';
const NOTIFICATION_SENT_KEY = 'teamsAttendanceLastSentDate';
const REPORT_CONFIG_KEY     = 'teamsReportConfig';

// Default report config — all off except core absent/leave
const DEFAULT_CONFIG = {
    showAbsent:        true,
    showOnLeave:       true,
    showPresent:       false,
    showClockInTime:   false,
    showLateEmployees: false,
    showLateMinutes:   false,
    showWorkingHours:  false,
    reportTime:        '11:30', // HH:mm IST
};

const isTodayWorkingDay = () => getISTNow().getDay() !== 0;

const getWebhookUrl = async () => {
    const s = await Setting.findOne({ key: TEAMS_WEBHOOK_KEY });
    return s?.value || null;
};

const getReportConfig = async () => {
    const s = await Setting.findOne({ key: REPORT_CONFIG_KEY });
    return s?.value ? { ...DEFAULT_CONFIG, ...s.value } : DEFAULT_CONFIG;
};

/**
 * Formats a Date object to IST time string HH:MM AM/PM
 */
const formatISTTime = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Kolkata',
    });
};

/**
 * Returns a display label for a leave record combining requestType + leaveType.
 * Examples: "🤒 Sick Leave", "📅 Casual Leave", "🌗 Half Day (AM) – Sick"
 */
const buildLeaveLabel = (requestType, leaveType) => {
    // Base emoji + name from requestType
    const typeMap = {
        'Sick':             { emoji: '🤒', name: 'Sick Leave'        },
        'Casual':           { emoji: '📅', name: 'Casual Leave'       },
        'Planned':          { emoji: '🏖️', name: 'Planned Leave'      },
        'Compensatory':     { emoji: '🔄', name: 'Compensatory Leave' },
        'Comp-Off':         { emoji: '🔄', name: 'Comp Off'           },
        'COMP_OFF':         { emoji: '🔄', name: 'Comp Off'           },
        'Loss of Pay':      { emoji: '💸', name: 'Loss of Pay'        },
        'Backdated Leave':  { emoji: '📋', name: 'Backdated Leave'    },
        'YEAR_END':         { emoji: '🗓️', name: 'Year-End Leave'     },
    };

    const { emoji = '🟡', name = 'On Leave' } = typeMap[requestType] || {};

    // Half day overrides
    if (leaveType === 'Half Day - First Half') {
        return `🌗 Half Day (AM)${name !== 'On Leave' ? ` – ${name.replace(' Leave', '')}` : ''}`;
    }
    if (leaveType === 'Half Day - Second Half') {
        return `🌓 Half Day (PM)${name !== 'On Leave' ? ` – ${name.replace(' Leave', '')}` : ''}`;
    }

    return `${emoji} ${name}`;
};

/**
 * Build the Adaptive Card payload — Power Automate format.
 * Columns shown depend on config flags.
 */
const buildPayload = (sections, config, dateStr) => {
    const dateObj = new Date(dateStr + 'T00:00:00+05:30');
    const formattedDate = dateObj.toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: 'Asia/Kolkata',
    });

    // Determine which extra columns to show
    const showTime  = config.showClockInTime  && (config.showAbsent || config.showPresent || config.showLateEmployees);
    const showHours = config.showWorkingHours && (config.showPresent || config.showLateEmployees);
    const showLateMin = config.showLateMinutes && config.showLateEmployees;

    // Build column widths dynamically
    const columns = [{ width: 2 }, { width: 2 }, { width: 1 }];
    if (showTime)    columns.push({ width: 1 });
    if (showHours)   columns.push({ width: 1 });
    if (showLateMin) columns.push({ width: 1 });

    const makeHeaderCell = (text) => ({
        type: 'TableCell',
        style: 'accent',
        items: [{ type: 'TextBlock', text, weight: 'Bolder', color: 'Light', wrap: true }],
    });

    const headerCells = [
        makeHeaderCell('Employee'),
        makeHeaderCell('Designation'),
        makeHeaderCell('Status'),
    ];
    if (showTime)    headerCells.push(makeHeaderCell('Clock In'));
    if (showHours)   headerCells.push(makeHeaderCell('Hours'));
    if (showLateMin) headerCells.push(makeHeaderCell('Late By'));

    const headerRow = { type: 'TableRow', style: 'accent', cells: headerCells };

    // Build rows from sections
    const allRows = [];

    const makeRow = (emp, statusText, statusColor, extraCells = []) => ({
        type: 'TableRow',
        cells: [
            { type: 'TableCell', items: [{ type: 'TextBlock', text: emp.name, wrap: true, weight: 'Bolder' }] },
            { type: 'TableCell', items: [{ type: 'TextBlock', text: emp.designation || '—', wrap: true }] },
            { type: 'TableCell', items: [{ type: 'TextBlock', text: statusText, wrap: true, color: statusColor }] },
            ...extraCells,
        ],
    });

    if (config.showPresent && sections.present.length > 0) {
        sections.present.forEach(emp => {
            const extra = [];
            if (showTime)    extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: formatISTTime(emp.clockInTime), wrap: true, color: 'Good' }] });
            if (showHours)   extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: emp.totalWorkingHours ? `${emp.totalWorkingHours.toFixed(1)}h` : '—', wrap: true }] });
            if (showLateMin) extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: '—', wrap: true }] });
            allRows.push(makeRow(emp, '✅ Present', 'Good', extra));
        });
    }

    if (config.showLateEmployees && sections.late.length > 0) {
        sections.late.forEach(emp => {
            const extra = [];
            if (showTime)    extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: formatISTTime(emp.clockInTime), wrap: true, color: 'Warning' }] });
            if (showHours)   extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: emp.totalWorkingHours ? `${emp.totalWorkingHours.toFixed(1)}h` : '—', wrap: true }] });
            if (showLateMin) extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: emp.lateMinutes ? `${emp.lateMinutes} min` : '—', wrap: true, color: 'Warning' }] });
            allRows.push(makeRow(emp, '🕐 Late', 'Warning', extra));
        });
    }

    if (config.showOnLeave && sections.onLeave.length > 0) {
        sections.onLeave.forEach(emp => {
            const extra = [];
            if (showTime)    extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: '—', wrap: true }] });
            if (showHours)   extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: '—', wrap: true }] });
            if (showLateMin) extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: '—', wrap: true }] });
            allRows.push(makeRow(emp, emp.leaveType, 'Warning', extra));
        });
    }

    if (config.showAbsent && sections.absent.length > 0) {
        sections.absent.forEach(emp => {
            const extra = [];
            if (showTime)    extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: '—', wrap: true }] });
            if (showHours)   extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: '—', wrap: true }] });
            if (showLateMin) extra.push({ type: 'TableCell', items: [{ type: 'TextBlock', text: '—', wrap: true }] });
            allRows.push(makeRow(emp, '🔴 Absent', 'Attention', extra));
        });
    }

    // Summary counts
    const summaryParts = [];
    if (config.showPresent && sections.present.length > 0)       summaryParts.push(`✅ Present: **${sections.present.length}**`);
    if (config.showLateEmployees && sections.late.length > 0)    summaryParts.push(`🕐 Late: **${sections.late.length}**`);
    if (config.showOnLeave && sections.onLeave.length > 0)       summaryParts.push(`🟡 On Leave: **${sections.onLeave.length}**`);
    if (config.showAbsent && sections.absent.length > 0)         summaryParts.push(`🔴 Absent: **${sections.absent.length}**`);

    const notPresentCount = sections.onLeave.length + sections.absent.length;

    const bodyBlocks = [
        // ── Header banner ──
        {
            type: 'ColumnSet',
            style: 'emphasis',
            bleed: true,
            columns: [
                {
                    type: 'Column', width: 'auto',
                    items: [{ type: 'TextBlock', text: '📋', size: 'ExtraLarge' }],
                    verticalContentAlignment: 'Center',
                },
                {
                    type: 'Column', width: 'stretch',
                    items: [
                        { type: 'TextBlock', text: 'Daily Attendance Report', weight: 'Bolder', size: 'Large', color: 'Accent' },
                        { type: 'TextBlock', text: formattedDate, isSubtle: true, spacing: 'None', wrap: true },
                    ],
                    verticalContentAlignment: 'Center',
                },
            ],
        },
        // ── Summary line ──
        {
            type: 'TextBlock',
            spacing: 'Medium',
            text: notPresentCount === 0 && !config.showPresent && !config.showLateEmployees
                ? '✅ All employees accounted for!'
                : notPresentCount > 0
                    ? `⚠️ **${notPresentCount} employee${notPresentCount > 1 ? 's' : ''}** not present as of **${config.reportTime} IST**`
                    : `📊 Attendance summary as of **${config.reportTime} IST**`,
            wrap: true,
            size: 'Medium',
        },
    ];

    // ── Table ──
    if (allRows.length > 0) {
        bodyBlocks.push({
            type: 'Table',
            gridStyle: 'accent',
            firstRowAsHeader: true,
            columns,
            rows: [headerRow, ...allRows],
        });
    }

    // ── Footer summary ──
    if (summaryParts.length > 0) {
        bodyBlocks.push({
            type: 'TextBlock',
            spacing: 'Small',
            separator: true,
            text: summaryParts.join('  ·  '),
            isSubtle: true,
            size: 'Small',
            wrap: true,
        });
    }

    // ── Power Automate wrapper ──
    return {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            contentUrl: null,
            content: {
                '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                type: 'AdaptiveCard',
                version: '1.4',
                body: bodyBlocks,
            },
        }],
    };
};

// ─── Preview data builder (for admin edit before send) ────────────────────────
/**
 * Gathers attendance sections without sending — used by the admin preview UI.
 * Returns { sections, config, todayStr, totalEmployees }
 */
const getPreviewData = async () => {
    const config = await getReportConfig();
    const todayStr = getISTDateString(getISTNow());
    const todayStart = startOfISTDay(getISTNow());
    const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const employees   = await User.find({ isActive: true, role: { $nin: ['Admin'] } })
                                  .select('fullName designation _id').lean();
    const employeeIds = employees.map(e => e._id);

    const todayLogs = await AttendanceLog.find({
        user: { $in: employeeIds },
        attendanceDate: todayStr,
    }).select('user clockInTime totalWorkingHours lateMinutes isLate attendanceStatus').lean();

    const logMap = new Map(todayLogs.map(l => [l.user.toString(), l]));

    const approvedLeaves = await LeaveRequest.find({
        employee: { $in: employeeIds }, status: 'Approved',
        leaveDates: { $elemMatch: { $gte: todayStart, $lt: todayEnd } },
    }).select('employee leaveType requestType').lean();

    const leaveMap = new Map();
    approvedLeaves.forEach(leave => {
        const id = leave.employee.toString();
        leaveMap.set(id, buildLeaveLabel(leave.requestType, leave.leaveType));
    });

    const sections = { present: [], late: [], onLeave: [], absent: [] };

    for (const emp of employees) {
        const id  = emp._id.toString();
        const log = logMap.get(id);

        if (leaveMap.has(id)) {
            sections.onLeave.push({ name: emp.fullName, designation: emp.designation, leaveType: leaveMap.get(id) });
        } else if (log?.clockInTime) {
            const empData = { name: emp.fullName, designation: emp.designation, clockInTime: log.clockInTime, totalWorkingHours: log.totalWorkingHours, lateMinutes: log.lateMinutes };
            if (log.isLate) sections.late.push(empData);
            else sections.present.push(empData);
        } else {
            sections.absent.push({ name: emp.fullName, designation: emp.designation });
        }
    }

    Object.values(sections).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));

    return { sections, config, todayStr, totalEmployees: employees.length };
};

/**
 * Sends a report with explicitly provided (possibly edited) sections & config.
 * Used when admin clicks "Send" from the preview/edit modal.
 */
const sendEditedReport = async (sections, config, todayStr) => {
    const webhookUrl = await getWebhookUrl();
    if (!webhookUrl) throw new Error('No webhook URL configured.');

    const payload = buildPayload(sections, config, todayStr || getISTDateString(getISTNow()));

    const response = await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
    });

    if (response.status !== 200 && response.status !== 202) {
        throw new Error(`Webhook returned ${response.status}`);
    }

    // Mark as sent for today
    const sentDate = todayStr || getISTDateString(getISTNow());
    await Setting.findOneAndUpdate(
        { key: NOTIFICATION_SENT_KEY },
        { value: sentDate },
        { upsert: true }
    );
    console.log('[TeamsNotification] ✅ Edited report sent successfully.');
};

// ─── Main exported function ────────────────────────────────────────────────────

const sendMorningAttendanceReport = async () => {
    console.log('[TeamsNotification] Running morning attendance report...');

    if (mongoose.connection.readyState !== 1) { console.log('[TeamsNotification] DB not connected.'); return; }
    if (!isTodayWorkingDay())                  { console.log('[TeamsNotification] Sunday — skipping.'); return; }

    const todayStr = getISTDateString(getISTNow());
    const lastSent = await Setting.findOne({ key: NOTIFICATION_SENT_KEY });
    if (lastSent?.value === todayStr) { console.log('[TeamsNotification] Already sent today.'); return; }

    const webhookUrl = await getWebhookUrl();
    if (!webhookUrl) { console.log('[TeamsNotification] No webhook URL configured.'); return; }

    const config = await getReportConfig();

    try {
        const todayStart = startOfISTDay(getISTNow());
        const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const employees   = await User.find({ isActive: true, role: { $nin: ['Admin'] } })
                                      .select('fullName designation _id').lean();
        const employeeIds = employees.map(e => e._id);

        // Get all attendance logs for today
        const todayLogs = await AttendanceLog.find({
            user: { $in: employeeIds },
            attendanceDate: todayStr,
        }).select('user clockInTime totalWorkingHours lateMinutes isLate attendanceStatus').lean();

        const logMap = new Map(todayLogs.map(l => [l.user.toString(), l]));

        // Get approved leaves today
        const approvedLeaves = await LeaveRequest.find({
            employee: { $in: employeeIds }, status: 'Approved',
            leaveDates: { $elemMatch: { $gte: todayStart, $lt: todayEnd } },
        }).select('employee leaveType requestType').lean();

        const leaveMap = new Map();
        approvedLeaves.forEach(leave => {
            const id = leave.employee.toString();
            leaveMap.set(id, buildLeaveLabel(leave.requestType, leave.leaveType));
        });

        const sections = { present: [], late: [], onLeave: [], absent: [] };

        for (const emp of employees) {
            const id  = emp._id.toString();
            const log = logMap.get(id);

            if (leaveMap.has(id)) {
                sections.onLeave.push({ name: emp.fullName, designation: emp.designation, leaveType: leaveMap.get(id) });
            } else if (log?.clockInTime) {
                const empData = { name: emp.fullName, designation: emp.designation, clockInTime: log.clockInTime, totalWorkingHours: log.totalWorkingHours, lateMinutes: log.lateMinutes };
                if (log.isLate) {
                    sections.late.push(empData);
                } else {
                    sections.present.push(empData);
                }
            } else {
                sections.absent.push({ name: emp.fullName, designation: emp.designation });
            }
        }

        // Sort each section alphabetically
        Object.values(sections).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));

        const totalToReport = [
            config.showPresent       ? sections.present.length  : 0,
            config.showLateEmployees ? sections.late.length     : 0,
            config.showOnLeave       ? sections.onLeave.length  : 0,
            config.showAbsent        ? sections.absent.length   : 0,
        ].reduce((a, b) => a + b, 0);

        console.log(`[TeamsNotification] Present:${sections.present.length} Late:${sections.late.length} Leave:${sections.onLeave.length} Absent:${sections.absent.length}`);

        if (totalToReport === 0 && !config.showPresent) {
            console.log('[TeamsNotification] Nothing to report based on current config.');
        }

        const payload = buildPayload(sections, config, todayStr);

        const response = await axios.post(webhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
        });

        if (response.status !== 200 && response.status !== 202) {
            throw new Error(`Webhook returned ${response.status}`);
        }

        await Setting.findOneAndUpdate(
            { key: NOTIFICATION_SENT_KEY },
            { value: todayStr },
            { upsert: true }
        );
        console.log('[TeamsNotification] ✅ Report sent successfully.');
    } catch (error) {
        console.error('[TeamsNotification] ❌ Failed:', error.response?.data || error.message);
    }
};

module.exports = { sendMorningAttendanceReport, sendEditedReport, getPreviewData, buildPayload, getReportConfig, TEAMS_WEBHOOK_KEY, REPORT_CONFIG_KEY, DEFAULT_CONFIG };
