# CIF Attachments GridFS Migration - COMPLETED ✅

## Overview
Converted CIF (Confidential Incident Form) attachment storage from filesystem to GridFS (MongoDB) for better scalability, reliability, and deployment compatibility.

## Changes Made

### 1. New GridFS Middleware
Created `backend/middleware/uploadCIFAttachmentGridFS.js`:
- Safe lazy initialization of GridFSBucket
- Supports multiple file uploads
- File types: PDF, DOCX, DOC, images (JPEG, JPG, PNG, GIF, WEBP)
- 10MB per file size limit
- Stores files in `cifAttachments` bucket

### 2. Updated CIFAttachment Model
Modified `backend/modules/cif/cifAttachment.model.js`:
- Added `fileId` field (GridFS ObjectId)
- Removed `filePath` field (no longer needed)
- Added indexes for efficient queries
- Schema now stores:
  - `fileId`: GridFS file ID
  - `fileName`: Stored filename in GridFS
  - `originalName`: Original filename from upload
  - `fileType`: MIME type
  - `fileSize`: File size in bytes
  - `uploadedBy`: User who uploaded
  - `cifId`: Reference to CIF record

### 3. Updated Routes
Modified `backend/modules/cif/cif.routes.js`:
- Changed from `uploadCIFAttachment` to `uploadCIFAttachmentGridFS`
- All routes remain the same (backward compatible API)

### 4. Updated Controller Methods
Modified `backend/modules/cif/cif.controller.js`:

#### uploadAttachments
- Now stores files in GridFS instead of filesystem
- Creates attachment records with `fileId` instead of `filePath`
- Cleans up GridFS files if CIF not found

#### downloadAttachment
- Streams files from GridFS using `bucket.openDownloadStream()`
- Sets proper Content-Type and Content-Disposition headers
- Handles streaming errors gracefully

#### deleteAttachment
- Deletes files from GridFS using `bucket.delete()`
- Removes database records
- Creates audit logs

### 5. Migration Script
Created `backend/scripts/migrate-cif-attachments-to-gridfs.js`:
- Migrates existing filesystem attachments to GridFS
- Updates database records with GridFS file IDs
- Preserves original metadata
- Provides detailed migration summary
- Optional: Can delete original files after migration

## Benefits

### Scalability
- No filesystem dependency
- Files stored in MongoDB (same as other data)
- Automatic replication with MongoDB replica sets
- Better for distributed deployments

### Reliability
- Files backed up with MongoDB backups
- No orphaned files on filesystem
- Atomic operations with database

### Deployment
- Works on shared hosting (A2 Hosting, etc.)
- No need to manage upload directories
- No file permission issues
- Easier to deploy and scale

### Consistency
- All file uploads now use GridFS:
  - ✅ Avatars → `avatars` bucket
  - ✅ Policies → `policyFiles` bucket
  - ✅ Medical Certificates → `medicalCertificates` bucket
  - ✅ CIF Attachments → `cifAttachments` bucket

## Migration Steps

### 1. Deploy Code Changes
```bash
# Pull latest code
git pull

# Install dependencies (if needed)
cd backend
npm install

# Restart server
pm2 restart all
```

### 2. Run Migration Script
```bash
cd backend
node scripts/migrate-cif-attachments-to-gridfs.js
```

The script will:
1. Connect to MongoDB
2. Find all CIF attachments
3. Upload files to GridFS
4. Update database records
5. Provide migration summary

### 3. Verify Migration
Check the migration output:
- ✅ Successfully migrated: X files
- ⏭️ Skipped (already migrated): Y files
- ❌ Errors: Z files

### 4. Test Functionality
Test the following:
1. Upload new CIF attachment
2. Download existing attachment
3. Delete attachment
4. View attachments list

### 5. Clean Up (Optional)
After verifying everything works, you can delete old filesystem files:
1. Uncomment deletion code in migration script
2. Run migration again to clean up
3. Or manually delete `backend/uploads/cif-attachments/` directory

## API Endpoints (Unchanged)

All API endpoints remain the same:

```
POST   /api/cif/:cifId/attachments          - Upload attachments
GET    /api/cif/:cifId/attachments          - List attachments
GET    /api/cif/attachments/:id/download    - Download attachment
DELETE /api/cif/attachments/:id             - Delete attachment
```

## Database Schema

### Before (Filesystem)
```javascript
{
  cifId: ObjectId,
  fileName: "cif-123456.pdf",
  originalName: "document.pdf",
  fileType: "application/pdf",
  fileSize: 102400,
  filePath: "/uploads/cif-attachments/cif-123456.pdf",  // ❌ Removed
  uploadedBy: ObjectId
}
```

### After (GridFS)
```javascript
{
  cifId: ObjectId,
  fileId: ObjectId,                          // ✅ Added (GridFS ID)
  fileName: "cif-123456.pdf",
  originalName: "document.pdf",
  fileType: "application/pdf",
  fileSize: 102400,
  uploadedBy: ObjectId
}
```

## GridFS Bucket Structure

```
MongoDB Database
└── cifAttachments (GridFS Bucket)
    ├── cifAttachments.files (metadata)
    │   ├── _id: ObjectId
    │   ├── filename: "cif-uuid.pdf"
    │   ├── contentType: "application/pdf"
    │   ├── length: 102400
    │   └── metadata: {
    │       originalName: "document.pdf",
    │       uploadedBy: ObjectId,
    │       uploadedAt: Date,
    │       fileSize: 102400
    │   }
    └── cifAttachments.chunks (file data)
        └── Binary chunks (255KB each)
```

## Troubleshooting

### Issue: "MongoDB not connected yet"
**Solution:** Ensure MongoDB connects before routes are loaded (already configured in server.js)

### Issue: "File not found in storage"
**Solution:** Run migration script to move existing files to GridFS

### Issue: Migration fails for some files
**Solution:** Check migration output for specific errors. Files might be missing from filesystem.

### Issue: Old files still on filesystem
**Solution:** After verifying GridFS works, uncomment deletion code in migration script and run again

## Rollback Plan (If Needed)

If you need to rollback:

1. Keep the old `uploadCIFAttachment.js` middleware as backup
2. Revert routes to use old middleware
3. Revert controller to use filesystem paths
4. Original files are still on filesystem (unless deleted)

## Security Notes

- GridFS files are only accessible through authenticated API endpoints
- Same access control as before (Admin/HR only)
- File type validation still enforced
- File size limits still enforced (10MB)
- Audit logs still created for all operations

## Performance

GridFS performance is comparable to filesystem:
- Small files (<16MB): Similar performance
- Large files: Slightly slower due to chunking
- Network overhead: Minimal (same server)
- Benefit: Better for distributed systems

## Next Steps

1. ✅ Deploy code changes
2. ✅ Run migration script
3. ✅ Test functionality
4. ⏳ Monitor for issues
5. ⏳ Clean up old files (optional)

## Related Files

- `backend/middleware/uploadCIFAttachmentGridFS.js` - New GridFS middleware
- `backend/middleware/uploadCIFAttachment.js` - Old filesystem middleware (can be removed)
- `backend/modules/cif/cifAttachment.model.js` - Updated model
- `backend/modules/cif/cif.controller.js` - Updated controller
- `backend/modules/cif/cif.routes.js` - Updated routes
- `backend/scripts/migrate-cif-attachments-to-gridfs.js` - Migration script

## Support

If you encounter any issues:
1. Check server logs: `pm2 logs`
2. Check MongoDB logs
3. Verify GridFS bucket exists: `db.cifAttachments.files.find()`
4. Test with a small file first
