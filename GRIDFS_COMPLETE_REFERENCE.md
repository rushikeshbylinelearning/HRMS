# GridFS Complete Reference - All File Uploads

## Overview
All file uploads in the attendance system now use GridFS (MongoDB) for storage instead of filesystem. This provides better scalability, reliability, and deployment compatibility.

## GridFS Buckets

| Bucket Name | Purpose | Middleware | Max Size | File Types |
|-------------|---------|------------|----------|------------|
| `avatars` | User profile images | `uploadAvatarGridFS.js` | 5MB | JPEG, PNG, GIF, WebP |
| `policyFiles` | Company policies | `uploadPolicyGridFS.js` | 10MB | PDF only |
| `medicalCertificates` | Leave medical certs | `uploadMedicalCertificate.js` + route handler | 10MB | PDF, JPEG, PNG, GIF |
| `cifAttachments` | CIF attachments | `uploadCIFAttachmentGridFS.js` | 10MB | PDF, DOCX, DOC, Images |

## Implementation Pattern

All GridFS middleware follow the same safe pattern:

```javascript
const mongoose = require('mongoose');

// SAFE LAZY INITIALIZATION
let bucket;

function getBucket() {
    if (!bucket) {
        if (!mongoose.connection || !mongoose.connection.db) {
            throw new Error("MongoDB not connected yet");
        }
        
        bucket = new mongoose.mongo.GridFSBucket(
            mongoose.connection.db,
            { bucketName: "bucketName" }
        );
    }
    
    return bucket;
}
```

## File Upload Flow

### 1. Avatar Upload
```
Client → POST /api/users/profile/avatar
       → authenticateToken middleware
       → uploadAvatarGridFS middleware
       → Controller: Update user.profileImageUrl
       → Response: { profileImageUrl: "/api/users/avatar/:fileId" }
```

### 2. Policy Upload
```
Client → POST /api/policies
       → authenticateToken middleware
       → uploadPolicyGridFS middleware
       → Controller: Create policy record
       → Response: { fileId, filename, url }
```

### 3. Medical Certificate Upload
```
Client → POST /api/leaves/:id/medical-certificate
       → authenticateToken middleware
       → uploadMedicalCertificate middleware (buffers file)
       → Controller: Upload to GridFS + update leave record
       → Response: { medicalCertificateUrl: "/api/medical-certificates/:fileId" }
```

### 4. CIF Attachment Upload
```
Client → POST /api/cif/:cifId/attachments
       → authenticateToken middleware
       → uploadCIFAttachmentGridFS middleware
       → Controller: Create attachment records
       → Response: [{ fileId, fileName, originalName, ... }]
```

## File Download Flow

### Pattern 1: Direct Stream (Avatars, Medical Certs)
```javascript
app.get('/avatar/:fileId', (req, res) => {
    const bucket = getBucket();
    const downloadStream = bucket.openDownloadStream(fileId);
    
    res.set('Content-Type', 'image/webp');
    downloadStream.pipe(res);
});
```

### Pattern 2: With Attachment Header (Policies, CIF)
```javascript
app.get('/download/:fileId', (req, res) => {
    const bucket = getBucket();
    const downloadStream = bucket.openDownloadStream(fileId);
    
    res.set('Content-Type', attachment.fileType);
    res.set('Content-Disposition', `attachment; filename="${originalName}"`);
    downloadStream.pipe(res);
});
```

## File Deletion

```javascript
async function deleteFile(fileId) {
    const bucket = getBucket();
    await bucket.delete(fileId);
}
```

## Database Models

### Avatar (User Model)
```javascript
{
  profileImageUrl: "/api/users/avatar/507f1f77bcf86cd799439011"
}
```

### Policy Model
```javascript
{
  fileId: ObjectId("507f1f77bcf86cd799439011"),
  fileName: "policy-uuid.pdf",
  title: "Leave Policy 2024"
}
```

### Medical Certificate (LeaveRequest Model)
```javascript
{
  medicalCertificateUrl: "/api/medical-certificates/507f1f77bcf86cd799439011"
}
```

### CIF Attachment Model
```javascript
{
  cifId: ObjectId,
  fileId: ObjectId("507f1f77bcf86cd799439011"),
  fileName: "cif-uuid.pdf",
  originalName: "document.pdf",
  fileType: "application/pdf",
  fileSize: 102400,
  uploadedBy: ObjectId
}
```

## GridFS Metadata

Each file in GridFS stores metadata:

```javascript
{
  _id: ObjectId,
  filename: "generated-filename.ext",
  contentType: "application/pdf",
  length: 102400,
  uploadDate: ISODate,
  metadata: {
    originalName: "user-filename.pdf",
    uploadedBy: ObjectId,
    uploadedAt: ISODate,
    fileSize: 102400,
    // Additional custom metadata
  }
}
```

## Security Features

### 1. Authentication
All upload/download endpoints require authentication:
```javascript
router.use(authenticateToken);
```

### 2. Authorization
Role-based access control:
- Avatars: Own profile only (or Admin)
- Policies: Admin only
- Medical Certificates: Own leaves only (or Admin/HR)
- CIF Attachments: Admin/HR only

### 3. File Validation
- Magic number validation (file signature)
- MIME type validation
- File extension validation
- File size limits

### 4. Rate Limiting
Avatar uploads: 5 uploads per hour per user

### 5. Sanitization
- UUID-based filenames (no user input)
- EXIF metadata stripping (avatars)
- Content-Type validation

## Performance Optimization

### 1. Image Processing (Avatars)
- Resize to 256x256
- Convert to WebP
- Compress to <100KB
- Strip EXIF data

### 2. Streaming
- Files streamed directly from GridFS
- No intermediate buffering
- Memory efficient

### 3. Caching
- Client-side caching with proper headers
- CDN-friendly URLs

## Migration Scripts

### Migrate Avatars
```bash
node backend/scripts/migrate-avatars-to-gridfs.js
```

### Migrate Policies
```bash
node backend/scripts/migrate-policies-to-gridfs.js
```

### Migrate CIF Attachments
```bash
node backend/scripts/migrate-cif-attachments-to-gridfs.js
```

## Monitoring

### Check GridFS Collections
```javascript
// In MongoDB shell
db.avatars.files.count()
db.policyFiles.files.count()
db.medicalCertificates.files.count()
db.cifAttachments.files.count()

// List files
db.avatars.files.find().pretty()
```

### Check File Sizes
```javascript
db.avatars.files.aggregate([
  { $group: { _id: null, totalSize: { $sum: "$length" } } }
])
```

### Find Orphaned Files
```javascript
// Files in GridFS but not in database
const gridfsFiles = db.avatars.files.find().map(f => f._id);
const userAvatars = db.users.find({ profileImageUrl: { $exists: true } });
// Compare and find orphans
```

## Troubleshooting

### Issue: "MongoDB not connected yet"
**Cause:** GridFSBucket initialized before MongoDB connection
**Solution:** Use lazy initialization pattern (already implemented)

### Issue: "File not found in storage"
**Cause:** File deleted from GridFS but record exists in database
**Solution:** Clean up orphaned records or restore from backup

### Issue: Large memory usage
**Cause:** Buffering large files in memory
**Solution:** Use streaming (already implemented)

### Issue: Slow uploads
**Cause:** Network latency or large files
**Solution:** 
- Compress images before upload (client-side)
- Use progress indicators
- Implement chunked uploads for very large files

## Best Practices

### 1. Always Use Lazy Initialization
```javascript
// ✅ GOOD
let bucket;
function getBucket() {
    if (!bucket) {
        bucket = new GridFSBucket(...);
    }
    return bucket;
}

// ❌ BAD
const bucket = new GridFSBucket(...); // Crashes if DB not connected
```

### 2. Always Clean Up on Errors
```javascript
try {
    const result = await uploadToGridFS(buffer);
    // ... process result
} catch (error) {
    // Clean up uploaded file
    await bucket.delete(result.fileId);
    throw error;
}
```

### 3. Always Stream Large Files
```javascript
// ✅ GOOD
const downloadStream = bucket.openDownloadStream(fileId);
downloadStream.pipe(res);

// ❌ BAD
const buffer = await bucket.downloadAsBuffer(fileId); // Memory intensive
res.send(buffer);
```

### 4. Always Validate Before Upload
```javascript
// Check file type, size, magic numbers BEFORE uploading
if (!validateFile(buffer)) {
    throw new Error('Invalid file');
}
```

### 5. Always Handle Stream Errors
```javascript
downloadStream.on('error', (error) => {
    if (!res.headersSent) {
        res.status(404).json({ error: 'File not found' });
    }
});
```

## Backup and Restore

### Backup GridFS Files
```bash
# Backup entire database (includes GridFS)
mongodump --uri="mongodb://..." --out=/backup/

# Restore
mongorestore --uri="mongodb://..." /backup/
```

### Export Specific Bucket
```bash
# Export avatars bucket
mongoexport --uri="mongodb://..." --collection=avatars.files --out=avatars-files.json
mongoexport --uri="mongodb://..." --collection=avatars.chunks --out=avatars-chunks.json
```

## Related Documentation

- [GRIDFS_CRASH_FIX.md](./GRIDFS_CRASH_FIX.md) - Avatar upload fix
- [CIF_GRIDFS_MIGRATION.md](./CIF_GRIDFS_MIGRATION.md) - CIF attachments migration
- [GRIDFS_POLICY_SYSTEM.md](./backend/docs/GRIDFS_POLICY_SYSTEM.md) - Policy system docs

## Summary

All file uploads now use GridFS with:
- ✅ Safe lazy initialization
- ✅ Proper error handling
- ✅ Streaming for efficiency
- ✅ Security validation
- ✅ Audit logging
- ✅ Migration scripts
- ✅ Consistent patterns

This provides a robust, scalable file storage solution that works across all deployment environments.
