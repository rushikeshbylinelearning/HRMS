'use strict';
// controllers/salarySlipController.js
//
// Authenticated access to salary slips for admin/payroll users.
// Unauthenticated/external access goes through linkShareController.

const SalarySlip = require('../models/SalarySlip');
const { presignedGetUrl } = require('../services/b2Storage');

// GET /api/salary-slips?employeeId=&year=&month=
async function listSlips(req, res) {
    try {
        const filter = {};
        if (req.query.employeeId) filter.employeeId = req.query.employeeId;
        if (req.query.year)       filter.year       = parseInt(req.query.year, 10);
        if (req.query.month)      filter.month      = parseInt(req.query.month, 10);
        if (req.query.runId)      filter.payrollRunId = req.query.runId;

        const slips = await SalarySlip.find(filter).sort({ year: -1, month: -1, employeeId: 1 }).limit(200);
        return res.json({ slips });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to list salary slips' });
    }
}

// GET /api/salary-slips/:id
async function getSlip(req, res) {
    try {
        const slip = await SalarySlip.findById(req.params.id);
        if (!slip) return res.status(404).json({ error: 'Salary slip not found' });
        return res.json({ slip });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to get salary slip' });
    }
}

// GET /api/salary-slips/:id/download — generates presigned URL for authenticated users
async function downloadSlip(req, res) {
    try {
        const slip = await SalarySlip.findById(req.params.id).select('storageKey status employeeId');
        if (!slip) return res.status(404).json({ error: 'Salary slip not found' });
        if (!slip.storageKey) return res.status(404).json({ error: 'PDF not yet generated' });

        const url = await presignedGetUrl(slip.storageKey, 'attachment');
        return res.json({ url, expiresInSeconds: 600 });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to generate download URL' });
    }
}

// GET /api/salary-slips/:id/view — inline presigned URL for authenticated users
async function viewSlip(req, res) {
    try {
        const slip = await SalarySlip.findById(req.params.id).select('storageKey');
        if (!slip) return res.status(404).json({ error: 'Salary slip not found' });
        if (!slip.storageKey) return res.status(404).json({ error: 'PDF not yet generated' });

        const url = await presignedGetUrl(slip.storageKey, 'inline');
        return res.json({ url, expiresInSeconds: 600 });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to generate view URL' });
    }
}

module.exports = { listSlips, getSlip, downloadSlip, viewSlip };
