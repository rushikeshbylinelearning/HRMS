// backend/routes/settingsRoutes.js

const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const authenticateToken = require('../middleware/authenticateToken');
const cache = require('../utils/cache');

// Admin-only middleware for RBAC-protected settings (e.g. enforce required logout toggle)
const isAdmin = (req, res, next) => {
    if (req.user?.role !== 'Admin') {
        return res.status(403).json({ error: 'Access forbidden: Requires Admin role.' });
    }
    next();
};

const HR_EMAIL_KEY = 'hrNotificationEmails';
const HIRING_EMAIL_KEY = 'hiringNotificationEmails';
const YEAR_END_FEATURE_KEY = 'yearEndFeature';
// Feature toggle: disable Check-out until required logout time (shift end + excess paid break)
const ENFORCE_REQUIRED_LOGOUT_KEY = 'enforceRequiredLogoutBeforeCheckout';
// Feature toggle: require admin approval before early checkout is executed
const REQUIRE_ADMIN_APPROVAL_EARLY_CHECKOUT_KEY = 'requireAdminApprovalForEarlyCheckout';

// GET /api/admin/settings/hr-emails - Get the list of HR emails
router.get('/hr-emails', async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: HR_EMAIL_KEY });
        res.json(setting ? setting.value : []); // Return emails array or empty array if not found
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching email settings.' });
    }
});

// POST /api/admin/settings/hr-emails - Add a new email to the list
router.post('/hr-emails', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }
    try {
        const updatedSetting = await Setting.findOneAndUpdate(
            { key: HR_EMAIL_KEY },
            // $addToSet adds the email only if it's not already in the array
            { $addToSet: { value: email } },
            // { upsert: true } creates the document if it doesn't exist
            // { new: true } returns the updated document
            { upsert: true, new: true }
        );
        res.json(updatedSetting.value);
    } catch (error) {
        res.status(500).json({ error: 'Server error adding email.' });
    }
});

// DELETE /api/admin/settings/hr-emails - Remove an email from the list
router.delete('/hr-emails', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }
    try {
        const updatedSetting = await Setting.findOneAndUpdate(
            { key: HR_EMAIL_KEY },
            // $pull removes the specified email from the array
            { $pull: { value: email } },
            { new: true }
        );
        res.json(updatedSetting ? updatedSetting.value : []);
    } catch (error) {
        res.status(500).json({ error: 'Server error deleting email.' });
    }
});

// GET /api/admin/settings/hiring-emails - Get the list of hiring emails
router.get('/hiring-emails', async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: HIRING_EMAIL_KEY });
        res.json(setting ? setting.value : []); // Return emails array or empty array if not found
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching hiring email settings.' });
    }
});

// POST /api/admin/settings/hiring-emails - Add a new email to the hiring list
router.post('/hiring-emails', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }
    try {
        const updatedSetting = await Setting.findOneAndUpdate(
            { key: HIRING_EMAIL_KEY },
            // $addToSet adds the email only if it's not already in the array
            { $addToSet: { value: email } },
            // { upsert: true } creates the document if it doesn't exist
            // { new: true } returns the updated document
            { upsert: true, new: true }
        );
        res.json(updatedSetting.value);
    } catch (error) {
        res.status(500).json({ error: 'Server error adding hiring email.' });
    }
});

// DELETE /api/admin/settings/hiring-emails - Remove an email from the hiring list
router.delete('/hiring-emails', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }
    try {
        const updatedSetting = await Setting.findOneAndUpdate(
            { key: HIRING_EMAIL_KEY },
            // $pull removes the specified email from the array
            { $pull: { value: email } },
            { new: true }
        );
        res.json(updatedSetting ? updatedSetting.value : []);
    } catch (error) {
        res.status(500).json({ error: 'Server error deleting hiring email.' });
    }
});

// GET /api/admin/settings/year-end-feature - Get the year-end feature enabled status
router.get('/year-end-feature', async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: YEAR_END_FEATURE_KEY });
        res.json({ enabled: setting ? setting.value : false }); // Return enabled status, default to false if not found
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching year-end feature setting.' });
    }
});

// POST /api/admin/settings/year-end-feature - Update the year-end feature enabled status
router.post('/year-end-feature', async (req, res) => {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Enabled must be a boolean value.' });
    }
    
    try {
        const updatedSetting = await Setting.findOneAndUpdate(
            { key: YEAR_END_FEATURE_KEY },
            { value: enabled },
            { upsert: true, new: true }
        );
        res.json({ enabled: updatedSetting.value });
    } catch (error) {
        res.status(500).json({ error: 'Server error updating year-end feature setting.' });
    }
});

// GET /api/admin/settings/enforce-required-logout - Get "Enforce Required Logout Before Checkout" toggle (Admin only)
router.get('/enforce-required-logout', [authenticateToken, isAdmin], async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: ENFORCE_REQUIRED_LOGOUT_KEY });
        res.json({ enabled: setting ? !!setting.value : false });
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching enforce required logout setting.' });
    }
});

// POST /api/admin/settings/enforce-required-logout - Update toggle (hot-applied; no deploy/refresh required)
router.post('/enforce-required-logout', [authenticateToken, isAdmin], async (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Enabled must be a boolean value.' });
    }
    try {
        const updatedSetting = await Setting.findOneAndUpdate(
            { key: ENFORCE_REQUIRED_LOGOUT_KEY },
            { value: enabled },
            { upsert: true, new: true }
        );
        // Invalidate employee dashboard cache so next load gets fresh canCheckout (hot-applied)
        cache.deletePattern('employee_dashboard:*');
        res.json({ enabled: !!updatedSetting.value });
    } catch (error) {
        res.status(500).json({ error: 'Server error updating enforce required logout setting.' });
    }
});

// GET /api/admin/settings/require-admin-approval-early-checkout - Get "Require Admin Approval for Early Checkout" toggle (Admin only)
router.get('/require-admin-approval-early-checkout', [authenticateToken, isAdmin], async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: REQUIRE_ADMIN_APPROVAL_EARLY_CHECKOUT_KEY });
        res.json({ enabled: setting ? !!setting.value : false });
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching require admin approval for early checkout setting.' });
    }
});

// POST /api/admin/settings/require-admin-approval-early-checkout - Update toggle (hot-applied)
router.post('/require-admin-approval-early-checkout', [authenticateToken, isAdmin], async (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Enabled must be a boolean value.' });
    }
    try {
        const updatedSetting = await Setting.findOneAndUpdate(
            { key: REQUIRE_ADMIN_APPROVAL_EARLY_CHECKOUT_KEY },
            { value: enabled },
            { upsert: true, new: true }
        );
        cache.deletePattern('employee_dashboard:*');
        res.json({ enabled: !!updatedSetting.value });
    } catch (error) {
        res.status(500).json({ error: 'Server error updating require admin approval for early checkout setting.' });
    }
});

module.exports = router;