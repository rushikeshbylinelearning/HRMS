const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Policy = require('../models/Policy');
const AnonymousFeedback = require('../models/AnonymousFeedback');
const requireAuth = require('../middleware/requireAuth');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/policies');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'policy-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Get all policies (accessible by all authenticated users)
router.get('/', requireAuth, async (req, res) => {
    try {
        const policies = await Policy.find()
            .sort({ effectiveFrom: -1, createdAt: -1 })
            .select('-__v')
            .lean();

        res.json({ policies });
    } catch (error) {
        console.error('Error fetching policies:', error);
        res.status(500).json({ error: 'Failed to fetch policies' });
    }
});

// Get active policies only
router.get('/active', requireAuth, async (req, res) => {
    try {
        const policies = await Policy.find({ status: 'Active' })
            .sort({ effectiveFrom: -1 })
            .select('-__v')
            .lean();

        res.json({ policies });
    } catch (error) {
        console.error('Error fetching active policies:', error);
        res.status(500).json({ error: 'Failed to fetch active policies' });
    }
});

// Upload new policy (Admin only)
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Only admins can upload policies' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        const { name, version, effectiveFrom, department, status } = req.body;

        if (!name || !effectiveFrom) {
            return res.status(400).json({ error: 'Policy name and effective date are required' });
        }

        // Auto-generate version if requested
        let policyVersion = version;
        if (version === 'auto') {
            const latestPolicy = await Policy.findOne({ name })
                .sort({ createdAt: -1 })
                .select('version');
            
            if (latestPolicy) {
                const versionNum = parseFloat(latestPolicy.version) || 1.0;
                policyVersion = (versionNum + 0.1).toFixed(1);
            } else {
                policyVersion = '1.0';
            }
        }

        const fileUrl = `/policies/${req.file.filename}`;

        const policy = new Policy({
            name,
            version: policyVersion,
            effectiveFrom: new Date(effectiveFrom),
            department: department || '',
            status: status || 'Active',
            fileUrl,
            fileName: req.file.originalname,
            uploadedBy: req.user.userId || req.user._id
        });

        await policy.save();

        res.status(201).json({
            message: 'Policy uploaded successfully',
            policy
        });
    } catch (error) {
        console.error('Error uploading policy:', error);
        // Clean up uploaded file if database save fails
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting file:', unlinkError);
            }
        }
        res.status(500).json({ error: 'Failed to upload policy' });
    }
});

// Replace policy (Admin only)
router.post('/:id/replace', requireAuth, upload.single('file'), async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Only admins can replace policies' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'PDF file is required' });
        }

        const oldPolicy = await Policy.findById(req.params.id);
        if (!oldPolicy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        const { name, version, effectiveFrom, department, status } = req.body;

        // Auto-generate version
        let policyVersion = version;
        if (version === 'auto') {
            const versionNum = parseFloat(oldPolicy.version) || 1.0;
            policyVersion = (versionNum + 0.1).toFixed(1);
        }

        const fileUrl = `/policies/${req.file.filename}`;

        // Create new policy version
        const newPolicy = new Policy({
            name: name || oldPolicy.name,
            version: policyVersion,
            effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
            department: department || oldPolicy.department,
            status: status || 'Active',
            fileUrl,
            fileName: req.file.originalname,
            uploadedBy: req.user.userId || req.user._id
        });

        await newPolicy.save();

        // Archive old policy
        oldPolicy.status = 'Archived';
        oldPolicy.replacedBy = newPolicy._id;
        await oldPolicy.save();

        res.json({
            message: 'Policy replaced successfully',
            policy: newPolicy
        });
    } catch (error) {
        console.error('Error replacing policy:', error);
        // Clean up uploaded file if database save fails
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting file:', unlinkError);
            }
        }
        res.status(500).json({ error: 'Failed to replace policy' });
    }
});

// Delete policy (Admin only)
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Only admins can delete policies' });
        }

        const policy = await Policy.findById(req.params.id);
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        // Delete file from filesystem
        const filePath = path.join(__dirname, '../public', policy.fileUrl);
        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.error('Error deleting file:', error);
        }

        await Policy.findByIdAndDelete(req.params.id);

        res.json({ message: 'Policy deleted successfully' });
    } catch (error) {
        console.error('Error deleting policy:', error);
        res.status(500).json({ error: 'Failed to delete policy' });
    }
});

// Submit anonymous feedback
router.post('/anonymous-feedback', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const feedback = new AnonymousFeedback({
            message: message.trim(),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent')
        });

        await feedback.save();

        res.status(201).json({
            message: 'Feedback submitted successfully'
        });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// Get all anonymous feedback (Admin only)
router.get('/anonymous-feedback', requireAuth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Only admins can view feedback' });
        }

        const feedback = await AnonymousFeedback.find()
            .sort({ submittedAt: -1 })
            .select('-__v')
            .lean();

        res.json({ feedback });
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

module.exports = router;
