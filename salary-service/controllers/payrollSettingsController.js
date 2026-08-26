'use strict';
// controllers/payrollSettingsController.js
// Singleton settings document — upsert pattern.

const PayrollSettings = require('../models/PayrollSettings');

// GET /api/payroll-settings
async function getSettings(req, res) {
    try {
        let settings = await PayrollSettings.findOne({});
        if (!settings) {
            // Auto-create with sensible defaults on first access
            settings = await PayrollSettings.create({});
        }
        return res.json({ settings });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch payroll settings' });
    }
}

// PUT /api/payroll-settings
async function updateSettings(req, res) {
    const {
        basicPercentage, hraPercentage, allowancesPercentage,
        pfPercentage, esiPercentage, professionalTax, tdsPercentage,
        lopDailyRate, overtimeHourlyRate, standardWorkingDays,
    } = req.body;

    try {
        const settings = await PayrollSettings.findOneAndUpdate(
            {},
            {
                $set: {
                    ...(basicPercentage      !== undefined && { basicPercentage }),
                    ...(hraPercentage        !== undefined && { hraPercentage }),
                    ...(allowancesPercentage !== undefined && { allowancesPercentage }),
                    ...(pfPercentage         !== undefined && { pfPercentage }),
                    ...(esiPercentage        !== undefined && { esiPercentage }),
                    ...(professionalTax      !== undefined && { professionalTax }),
                    ...(tdsPercentage        !== undefined && { tdsPercentage }),
                    ...(lopDailyRate         !== undefined && { lopDailyRate }),
                    ...(overtimeHourlyRate   !== undefined && { overtimeHourlyRate }),
                    ...(standardWorkingDays  !== undefined && { standardWorkingDays }),
                    updatedBy: req.user.userId,
                },
            },
            { new: true, upsert: true, runValidators: true }
        );
        return res.json({ settings });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: 'Invalid settings values', details: err.message });
        }
        return res.status(500).json({ error: 'Failed to update payroll settings' });
    }
}

module.exports = { getSettings, updateSettings };
