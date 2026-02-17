// backend/middleware/uploadAvatarGridFS.js
// SECURE AVATAR UPLOAD MIDDLEWARE - GridFS Only
// Features:
// - GridFS storage (MongoDB) - no filesystem dependency
// - Image compression & resizing (256x256 max, WebP format)
// - EXIF metadata stripping for privacy
// - Magic number validation (prevents fake images)
// - Dimension validation (50px-2000px)
// - File size limit (5MB)
// - Rate limiting (5 uploads/hour per user)
// - Filename sanitization (UUID-based)

const busboy = require('busboy');
const sharp = require('sharp');
const crypto = require('crypto');
const mongoose = require('mongoose');

// SAFE LAZY INITIALIZATION - GridFSBucket
let bucket;

function getBucket() {
    if (!bucket) {
        if (!mongoose.connection || !mongoose.connection.db) {
            throw new Error("MongoDB not connected yet");
        }
        
        bucket = new mongoose.mongo.GridFSBucket(
            mongoose.connection.db,
            { bucketName: "avatars" }
        );
    }
    
    return bucket;
}

// UUID generation function
const uuidv4 = () => {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    } else {
        // Fallback for older Node versions
        return crypto.randomBytes(16).toString('hex');
    }
};

// Configuration
const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB (reduced from 10MB)
const MAX_DIMENSION = 2000; // Max width/height before processing
const MIN_DIMENSION = 50; // Min width/height
const TARGET_SIZE = 256; // Target avatar size (256x256)
const WEBP_QUALITY = 80; // WebP compression quality
const TARGET_FILE_SIZE = 100 * 1024; // Target < 100KB

// Magic numbers for image validation (file signatures)
const IMAGE_SIGNATURES = {
    'image/jpeg': [
        Buffer.from([0xFF, 0xD8, 0xFF]), // JPEG
    ],
    'image/png': [
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG
    ],
    'image/gif': [
        Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
        Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
    ],
    'image/webp': [
        Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF (WebP container)
    ],
};

// Rate limiting store (in-memory, consider Redis for production clusters)
const uploadRateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // 5 uploads per hour

/**
 * Validate magic numbers (file signature) to prevent fake images
 */
function validateMagicNumbers(buffer, mimeType) {
    const signatures = IMAGE_SIGNATURES[mimeType];
    if (!signatures) return false;
    
    return signatures.some(signature => {
        if (buffer.length < signature.length) return false;
        return buffer.slice(0, signature.length).equals(signature);
    });
}

/**
 * Check rate limit for user
 */
function checkRateLimit(userId) {
    const now = Date.now();
    const userLimits = uploadRateLimits.get(userId) || [];
    
    // Remove expired entries
    const validLimits = userLimits.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    
    if (validLimits.length >= RATE_LIMIT_MAX) {
        const oldestUpload = Math.min(...validLimits);
        const resetTime = new Date(oldestUpload + RATE_LIMIT_WINDOW);
        return {
            allowed: false,
            resetTime,
            remaining: 0
        };
    }
    
    validLimits.push(now);
    uploadRateLimits.set(userId, validLimits);
    
    return {
        allowed: true,
        remaining: RATE_LIMIT_MAX - validLimits.length
    };
}

/**
 * Process and validate image with Sharp
 */
async function processImage(buffer, mimeType) {
    try {
        // Load image with Sharp
        const image = sharp(buffer);
        const metadata = await image.metadata();
        
        console.log('[Avatar Upload] Original image metadata:', {
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
            size: buffer.length,
            hasAlpha: metadata.hasAlpha,
            space: metadata.space
        });
        
        // Validate dimensions
        if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
            throw new Error(`Image dimensions too large. Maximum ${MAX_DIMENSION}x${MAX_DIMENSION}px allowed.`);
        }
        
        if (metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
            throw new Error(`Image dimensions too small. Minimum ${MIN_DIMENSION}x${MIN_DIMENSION}px required.`);
        }
        
        // Process image:
        // 1. Resize to fit within 256x256 (maintain aspect ratio)
        // 2. Strip EXIF metadata
        // 3. Convert to WebP
        // 4. Compress to target quality
        const processedBuffer = await image
            .resize(TARGET_SIZE, TARGET_SIZE, {
                fit: 'inside', // Maintain aspect ratio
                withoutEnlargement: true // Don't upscale small images
            })
            .withMetadata(false) // Strip EXIF data
            .webp({ quality: WEBP_QUALITY })
            .toBuffer();
        
        console.log('[Avatar Upload] Processed image:', {
            originalSize: buffer.length,
            processedSize: processedBuffer.length,
            reduction: `${((1 - processedBuffer.length / buffer.length) * 100).toFixed(1)}%`,
            targetMet: processedBuffer.length < TARGET_FILE_SIZE
        });
        
        return {
            buffer: processedBuffer,
            contentType: 'image/webp',
            metadata: {
                originalFormat: metadata.format,
                originalWidth: metadata.width,
                originalHeight: metadata.height,
                originalSize: buffer.length,
                processedSize: processedBuffer.length
            }
        };
        
    } catch (error) {
        console.error('[Avatar Upload] Image processing error:', error);
        throw new Error(`Image processing failed: ${error.message}`);
    }
}

/**
 * Upload processed image to GridFS
 */
async function uploadToGridFS(buffer, userId, metadata) {
    try {
        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not available');
        }
        
        // Use lazy-initialized bucket
        const bucket = getBucket();
        
        // Generate secure filename (UUID-based, no user input)
        const filename = `avatar-${userId}-${uuidv4()}.webp`;
        
        // Delete old avatar if exists
        const User = mongoose.model('User');
        const user = await User.findById(userId);
        if (user && user.profileImageUrl) {
            try {
                // Extract ObjectId from old URL if it's a GridFS ID
                const oldIdMatch = user.profileImageUrl.match(/\/avatar\/([a-f0-9]{24})/i);
                if (oldIdMatch) {
                    const oldId = new mongoose.Types.ObjectId(oldIdMatch[1]);
                    await bucket.delete(oldId);
                    console.log('[Avatar Upload] Deleted old avatar:', oldId);
                }
            } catch (deleteError) {
                console.warn('[Avatar Upload] Could not delete old avatar:', deleteError.message);
                // Continue anyway - not critical
            }
        }
        
        // Upload to GridFS
        const uploadStream = bucket.openUploadStream(filename, {
            contentType: 'image/webp',
            metadata: {
                userId: userId,
                uploadedAt: new Date(),
                ...metadata
            }
        });
        
        return new Promise((resolve, reject) => {
            uploadStream.on('finish', () => {
                console.log('[Avatar Upload] GridFS upload complete:', {
                    fileId: uploadStream.id,
                    filename: filename
                });
                resolve({
                    fileId: uploadStream.id,
                    filename: filename
                });
            });
            
            uploadStream.on('error', (error) => {
                console.error('[Avatar Upload] GridFS upload error:', error);
                reject(new Error('Failed to upload to GridFS'));
            });
            
            uploadStream.end(buffer);
        });
        
    } catch (error) {
        console.error('[Avatar Upload] GridFS error:', error);
        throw new Error(`GridFS upload failed: ${error.message}`);
    }
}

/**
 * Express middleware: Secure avatar upload with GridFS
 * Must run after authenticateToken middleware
 */
function uploadAvatarGridFS(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({ error: 'Content-Type must be multipart/form-data.' });
    }
    
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    
    // Check rate limit
    const rateLimit = checkRateLimit(req.user.userId);
    if (!rateLimit.allowed) {
        return res.status(429).json({
            error: 'Too many upload attempts. Please try again later.',
            resetTime: rateLimit.resetTime,
            remaining: rateLimit.remaining
        });
    }
    
    const chunks = [];
    let originalname = '';
    let mimetype = '';
    let totalSize = 0;
    let foundFile = false;
    let rejected = false;
    
    function sendError(status, message) {
        if (rejected) return;
        rejected = true;
        res.status(status).json({ error: message });
    }
    
    const bb = busboy({ headers: { 'content-type': contentType } });
    
    bb.on('file', (fieldname, file, info) => {
        if (fieldname !== 'profileImage') {
            file.resume();
            return;
        }
        
        foundFile = true;
        originalname = info.filename || 'unknown';
        mimetype = info.mimeType || 'application/octet-stream';
        
        // Validate MIME type
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimes.includes(mimetype)) {
            sendError(400, 'Invalid file type. Only JPEG, PNG, GIF, or WebP images are allowed.');
            file.destroy();
            return;
        }
        
        file.on('data', (chunk) => {
            if (rejected) return;
            totalSize += chunk.length;
            if (totalSize > FILE_SIZE_LIMIT) {
                sendError(400, 'File size exceeds 5MB limit.');
                file.destroy();
                return;
            }
            chunks.push(chunk);
        });
        
        file.on('error', () => {
            if (!rejected) sendError(500, 'Error reading uploaded file.');
        });
        
        file.resume();
    });
    
    bb.on('finish', async () => {
        if (rejected) return;
        
        if (!foundFile || chunks.length === 0) {
            return sendError(400, 'File not provided. Please upload an image.');
        }
        
        try {
            const buffer = Buffer.concat(chunks);
            
            // Validate magic numbers (file signature)
            if (!validateMagicNumbers(buffer, mimetype)) {
                return sendError(400, 'Invalid image file. File signature does not match declared type.');
            }
            
            // Process image (resize, compress, strip EXIF)
            const processed = await processImage(buffer, mimetype);
            
            // Upload to GridFS
            const gridfsResult = await uploadToGridFS(
                processed.buffer,
                req.user.userId,
                processed.metadata
            );
            
            // Attach result to request for route handler
            req.avatarUpload = {
                fileId: gridfsResult.fileId,
                filename: gridfsResult.filename,
                contentType: processed.contentType,
                size: processed.buffer.length,
                metadata: processed.metadata
            };
            
            // Set rate limit headers
            res.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
            
            next();
            
        } catch (error) {
            console.error('[Avatar Upload] Processing error:', error);
            sendError(500, error.message || 'Failed to process image.');
        }
    });
    
    bb.on('error', () => {
        if (!rejected) sendError(400, 'Invalid multipart request.');
    });
    
    req.pipe(bb);
}

module.exports = uploadAvatarGridFS;
