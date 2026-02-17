# CIF GridFS Deployment Checklist

## Pre-Deployment

- [x] Created `uploadCIFAttachmentGridFS.js` middleware with safe lazy initialization
- [x] Updated `cifAttachment.model.js` to use GridFS file IDs
- [x] Updated `cif.controller.js` upload/download/delete methods
- [x] Updated `cif.routes.js` to use new middleware
- [x] Created migration script `migrate-cif-attachments-to-gridfs.js`
- [x] No syntax errors in any files
- [x] Documentation created

## Deployment Steps

### 1. Backup Current System
```bash
# Backup MongoDB
mongodump --uri="mongodb://..." --out=/backup/pre-cif-gridfs/

# Backup filesystem attachments
tar -czf cif-attachments-backup.tar.gz backend/uploads/cif-attachments/
```

### 2. Deploy Code
```bash
# Pull latest code
git pull origin main

# Install dependencies (if needed)
cd backend
npm install

# Verify files exist
ls -la middleware/uploadCIFAttachmentGridFS.js
ls -la scripts/migrate-cif-attachments-to-gridfs.js
```

### 3. Restart Backend
```bash
# Stop server
pm2 stop all

# Start server (MongoDB will connect first)
pm2 start backend/server.js

# Check logs
pm2 logs
```

Look for:
- ✅ MongoDB connection ready
- ✅ Server started successfully
- No "MongoDB not connected yet" errors

### 4. Run Migration Script
```bash
cd backend
node scripts/migrate-cif-attachments-to-gridfs.js
```

Expected output:
```
🔄 Starting CIF attachments migration to GridFS...
✅ Connected to MongoDB
📊 Found X CIF attachments to migrate
📤 Uploading file1.pdf (12345 bytes)...
✅ Migrated file1.pdf - GridFS ID: 507f1f77bcf86cd799439011
...
📊 Migration Summary:
   ✅ Successfully migrated: X
   ⏭️  Skipped (already migrated): Y
   ❌ Errors: Z
   📊 Total: X+Y+Z
```

### 5. Verify Migration
```bash
# Check MongoDB for GridFS files
mongo
> use attendance-system
> db.cifAttachments.files.count()
> db.cifAttachments.files.find().limit(5).pretty()
```

### 6. Test Functionality

#### Test 1: Upload New Attachment
```bash
# Use Postman or curl
curl -X POST http://localhost:5000/api/cif/:cifId/attachments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "attachments=@test.pdf"
```

Expected: 201 Created with attachment details

#### Test 2: List Attachments
```bash
curl http://localhost:5000/api/cif/:cifId/attachments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: Array of attachments with fileId

#### Test 3: Download Attachment
```bash
curl http://localhost:5000/api/cif/attachments/:attachmentId/download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded-file.pdf
```

Expected: File downloads successfully

#### Test 4: Delete Attachment
```bash
curl -X DELETE http://localhost:5000/api/cif/attachments/:attachmentId \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: 200 OK with success message

### 7. Frontend Testing

- [ ] Login as Admin/HR
- [ ] Navigate to CIF module
- [ ] Open a CIF record
- [ ] Upload new attachment
- [ ] View attachments list
- [ ] Download existing attachment
- [ ] Delete attachment
- [ ] Verify all operations work

### 8. Monitor Logs
```bash
# Watch server logs
pm2 logs --lines 100

# Watch for errors
pm2 logs | grep -i error
```

Look for:
- No "MongoDB not connected yet" errors
- No "File not found" errors
- Successful upload/download logs

## Post-Deployment

### 1. Verify GridFS Storage
```javascript
// In MongoDB shell
db.cifAttachments.files.find().count()
db.cifAttachments.chunks.find().count()

// Check total storage
db.cifAttachments.files.aggregate([
  { $group: { _id: null, totalSize: { $sum: "$length" } } }
])
```

### 2. Check Database Records
```javascript
// Verify all attachments have fileId
db.cifattachments.find({ fileId: { $exists: false } }).count()
// Should be 0

// Verify no filePath field (old schema)
db.cifattachments.find({ filePath: { $exists: true } }).count()
// Should be 0 after migration
```

### 3. Performance Check
- Upload a 5MB file → Should complete in <5 seconds
- Download a 5MB file → Should stream smoothly
- List 100 attachments → Should load in <1 second

### 4. Clean Up (Optional)
After verifying everything works for 1-2 days:

```bash
# Option 1: Keep filesystem files as backup
# Do nothing

# Option 2: Delete filesystem files
# Uncomment deletion code in migration script
node scripts/migrate-cif-attachments-to-gridfs.js

# Option 3: Archive and delete
tar -czf cif-attachments-archive.tar.gz backend/uploads/cif-attachments/
rm -rf backend/uploads/cif-attachments/*
```

## Rollback Plan (If Needed)

If something goes wrong:

### 1. Stop Server
```bash
pm2 stop all
```

### 2. Restore Code
```bash
git checkout HEAD~1  # Go back one commit
# Or manually restore old files
```

### 3. Restore Database (if needed)
```bash
mongorestore --uri="mongodb://..." /backup/pre-cif-gridfs/
```

### 4. Restart Server
```bash
pm2 start backend/server.js
```

### 5. Verify Old System Works
Test upload/download with old filesystem-based system

## Success Criteria

- [x] All existing attachments migrated to GridFS
- [ ] New uploads work correctly
- [ ] Downloads work correctly
- [ ] Deletions work correctly
- [ ] No errors in server logs
- [ ] Frontend functionality intact
- [ ] Performance acceptable
- [ ] MongoDB storage growing (not filesystem)

## Monitoring (First 24 Hours)

### Check Every Hour
```bash
# Server status
pm2 status

# Error logs
pm2 logs --err --lines 50

# GridFS file count
mongo --eval "db.cifAttachments.files.count()"
```

### Check Daily
- Total GridFS storage size
- Number of new uploads
- Any error patterns
- User feedback

## Troubleshooting

### Issue: Migration script fails
**Check:**
- MongoDB connection string correct?
- Files exist in `backend/uploads/cif-attachments/`?
- Sufficient disk space?
- MongoDB write permissions?

### Issue: Upload fails with "MongoDB not connected yet"
**Solution:**
- Check server.js startup order
- Verify MongoDB connects before routes load
- Check lazy initialization in middleware

### Issue: Download returns 404
**Solution:**
- Verify fileId exists in GridFS: `db.cifAttachments.files.findOne({ _id: ObjectId("...") })`
- Check attachment record has correct fileId
- Verify bucket name matches ("cifAttachments")

### Issue: Old files still being used
**Solution:**
- Verify routes use `uploadCIFAttachmentGridFS` not `uploadCIFAttachment`
- Check controller imports `getBucket` from correct middleware
- Restart server to reload code

## Support Contacts

- Backend Developer: [Your contact]
- DevOps: [Your contact]
- Database Admin: [Your contact]

## Documentation Links

- [CIF_GRIDFS_MIGRATION.md](./CIF_GRIDFS_MIGRATION.md) - Detailed migration guide
- [GRIDFS_COMPLETE_REFERENCE.md](./GRIDFS_COMPLETE_REFERENCE.md) - Complete GridFS reference
- [GRIDFS_CRASH_FIX.md](./GRIDFS_CRASH_FIX.md) - GridFS initialization fix

## Sign-Off

- [ ] Code deployed successfully
- [ ] Migration completed successfully
- [ ] All tests passed
- [ ] No critical errors in logs
- [ ] Frontend verified working
- [ ] Documentation updated
- [ ] Team notified

**Deployed by:** _______________  
**Date:** _______________  
**Time:** _______________  
**Sign:** _______________
