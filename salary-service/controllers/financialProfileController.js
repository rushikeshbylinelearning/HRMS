'use strict';
// controllers/financialProfileController.js
//
// CRUD for EmployeeFinancialProfile.
// Sensitive fields are encrypted before save and decrypted on read
// using utils/encryption.js (AES-256-GCM, key from ENCRYPTION_KEY env var).

const EmployeeFinancialProfile = require('../models/EmployeeFinancialProfile');
const { encrypt, decrypt } = require('../utils/encryption');
const { audit } = require('../services/auditLogger');

// Fields that are encrypted at rest
const ENCRYPTED_FIELDS = ['bankAccountNumber', 'ifscCode', 'panNumber', 'uan'];

function encryptSensitiveFields(data) {
    const out = { ...data };
    for (const field of ENCRYPTED_FIELDS) {
        if (out[field] !== undefined && out[field] !== null) {
            out[field] = encrypt(out[field]);
        }
    }
    return out;
}

function decryptProfile(profile) {
    const obj = profile.toObject ? profile.toObject() : { ...profile };
    for (const field of ENCRYPTED_FIELDS) {
        if (obj[field]) {
            try { obj[field] = decrypt(obj[field]); }
            catch (e) {
                // Decryption failure — return masked value rather than crashing
                console.error(`[FinancialProfile] Failed to decrypt ${field} for ${obj.employeeId}:`, e.message);
                obj[field] = '***DECRYPTION_ERROR***';
            }
        }
    }
    return obj;
}

// GET /api/financial-profiles
async function listProfiles(req, res) {
    try {
        const profiles = await EmployeeFinancialProfile.find({ isActive: true }).sort({ employeeId: 1 });
        return res.json({ profiles: profiles.map(decryptProfile) });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to list financial profiles' });
    }
}

// GET /api/financial-profiles/:employeeId
async function getProfile(req, res) {
    try {
        const profile = await EmployeeFinancialProfile.findOne({ employeeId: req.params.employeeId });
        if (!profile) return res.status(404).json({ error: 'Financial profile not found' });
        return res.json({ profile: decryptProfile(profile) });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to get profile' });
    }
}

// POST /api/financial-profiles
async function createProfile(req, res) {
    const { employeeId, employeeName, bankAccountNumber, ifscCode, panNumber, uan,
            ctc, basicSalary, hra, allowances, useFixedSalary } = req.body;

    if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });

    try {
        const exists = await EmployeeFinancialProfile.findOne({ employeeId });
        if (exists) return res.status(409).json({ error: 'Financial profile already exists for this employee' });

        const data = encryptSensitiveFields({
            employeeId, employeeName, bankAccountNumber, ifscCode, panNumber, uan,
            ctc: Number(ctc) || 0,
            basicSalary: Number(basicSalary) || 0,
            hra: Number(hra) || 0,
            allowances: Number(allowances) || 0,
            useFixedSalary: Boolean(useFixedSalary),
            createdBy: req.user.userId,
            updatedBy: req.user.userId,
        });

        const profile = await EmployeeFinancialProfile.create(data);
        await audit({ action: 'FINANCIAL_PROFILE_CREATED', req, subject: employeeId });
        return res.status(201).json({ profile: decryptProfile(profile) });
    } catch (err) {
        console.error('[FinancialProfile] create:', err.message);
        return res.status(500).json({ error: 'Failed to create financial profile' });
    }
}

// PUT /api/financial-profiles/:employeeId
async function updateProfile(req, res) {
    const { employeeId } = req.params;
    const { employeeName, bankAccountNumber, ifscCode, panNumber, uan,
            ctc, basicSalary, hra, allowances, useFixedSalary, isActive } = req.body;

    try {
        const profile = await EmployeeFinancialProfile.findOne({ employeeId });
        if (!profile) return res.status(404).json({ error: 'Financial profile not found' });

        const updates = { updatedBy: req.user.userId };

        if (employeeName   !== undefined) updates.employeeName   = employeeName;
        if (ctc            !== undefined) updates.ctc            = Number(ctc);
        if (basicSalary    !== undefined) updates.basicSalary    = Number(basicSalary);
        if (hra            !== undefined) updates.hra            = Number(hra);
        if (allowances     !== undefined) updates.allowances     = Number(allowances);
        if (useFixedSalary !== undefined) updates.useFixedSalary = Boolean(useFixedSalary);
        if (isActive       !== undefined) updates.isActive       = Boolean(isActive);

        // Encrypt only fields that are being updated
        for (const field of ENCRYPTED_FIELDS) {
            if (req.body[field] !== undefined) {
                updates[field] = encrypt(req.body[field]);
            }
        }

        Object.assign(profile, updates);
        await profile.save();

        await audit({ action: 'FINANCIAL_PROFILE_UPDATED', req, subject: employeeId });
        return res.json({ profile: decryptProfile(profile) });
    } catch (err) {
        console.error('[FinancialProfile] update:', err.message);
        return res.status(500).json({ error: 'Failed to update financial profile' });
    }
}

// GET /api/financial-profiles/sync/employees — fetch employee list from AMS
async function syncEmployees(req, res) {
    try {
        const { fetchEmployeeList } = require('../services/amsFeedClient');
        const employees = await fetchEmployeeList();
        
        // Get existing profiles to mark which employees already have profiles
        const existingProfiles = await EmployeeFinancialProfile.find({})
            .select('employeeId')
            .lean();
        
        const existingSet = new Set(existingProfiles.map(p => p.employeeId));
        
        // Enrich employee data with hasProfile flag
        const enrichedEmployees = employees.map(emp => ({
            ...emp,
            hasProfile: existingSet.has(emp.employeeId)
        }));
        
        return res.json({ 
            employees: enrichedEmployees,
            count: enrichedEmployees.length,
            profilesCount: existingProfiles.length
        });
    } catch (err) {
        console.error('[FinancialProfile] syncEmployees:', err.message);
        return res.status(500).json({ error: 'Failed to fetch employees from AMS', details: err.message });
    }
}

module.exports = { listProfiles, getProfile, createProfile, updateProfile, syncEmployees };
