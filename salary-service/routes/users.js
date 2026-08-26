'use strict';
// routes/users.js — Admin-only user management
const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticateToken');
const requireAdmin = require('../middleware/requireAdmin');
const userCtrl     = require('../controllers/userController');

// All user management routes require Admin
router.use(authenticate, requireAdmin);

router.get('/',              userCtrl.listUsers);
router.post('/',             userCtrl.createUser);
router.patch('/:id',         userCtrl.updateUser);
router.post('/:id/reset-password', userCtrl.resetPassword);

module.exports = router;
