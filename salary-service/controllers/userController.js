'use strict';
// controllers/userController.js
// Admin-only: manage salary-service users (Admins and PayrollOfficers).

const User = require('../models/User');
const { audit } = require('../services/auditLogger');

// GET /api/users
async function listUsers(req, res) {
    try {
        const users = await User.find({}).select('-passwordHash').sort({ createdAt: -1 });
        return res.json({ users });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to list users' });
    }
}

// POST /api/users
async function createUser(req, res) {
    const { email, password, role, fullName } = req.body;
    if (!email || !password || !role) {
        return res.status(400).json({ error: 'email, password, and role are required' });
    }
    if (!['Admin', 'PayrollOfficer'].includes(role)) {
        return res.status(400).json({ error: 'role must be Admin or PayrollOfficer' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({ error: 'A user with this email already exists' });
        }
        const user = new User({ email: email.toLowerCase().trim(), role, fullName, createdBy: req.user.userId });
        await user.setPassword(password);
        await user.save();

        await audit({ action: 'USER_CREATED', req, subject: user._id.toString(), details: { email, role } });

        return res.status(201).json({ user: { id: user._id, email: user.email, role, fullName } });
    } catch (err) {
        console.error('[UserController] createUser:', err.message);
        return res.status(500).json({ error: 'Failed to create user' });
    }
}

// PATCH /api/users/:id
async function updateUser(req, res) {
    const { fullName, role, isActive } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (fullName !== undefined) user.fullName = fullName;
        if (role !== undefined) {
            if (!['Admin', 'PayrollOfficer'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }
            user.role = role;
        }
        if (isActive !== undefined) user.isActive = Boolean(isActive);
        await user.save();

        await audit({ action: 'USER_UPDATED', req, subject: user._id.toString(), details: { role, isActive } });

        return res.json({ user: { id: user._id, email: user.email, role: user.role, fullName: user.fullName, isActive: user.isActive } });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update user' });
    }
}

// POST /api/users/:id/reset-password  (Admin only)
async function resetPassword(req, res) {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    }
    try {
        const user = await User.findById(req.params.id).select('+passwordHash');
        if (!user) return res.status(404).json({ error: 'User not found' });
        await user.setPassword(newPassword);
        await user.save();

        await audit({ action: 'USER_UPDATED', req, subject: user._id.toString(), details: { action: 'password_reset' } });

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to reset password' });
    }
}

module.exports = { listUsers, createUser, updateUser, resetPassword };
