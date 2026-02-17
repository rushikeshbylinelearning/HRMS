# CIF GridFS Quick Start Guide

## What Changed?
CIF attachments now use GridFS (MongoDB) instead of filesystem storage.

## Quick Deploy (5 Minutes)

### 1. Deploy Code
```bash
git pull
pm2 restart all
```

### 2. Run Migration
```bash
cd backend
node scripts/migrate-cif-attachments-to-gridfs.js
```

### 3. Verify
```bash
# Check logs
pm2 logs

# Check GridFS
mongo
> db.cifAttachments.files.count()
```

## That's It! ✅

The system is now using GridFS for CIF attachments.

## Quick Test

### Upload Test
```bash
curl -X POST http://localhost:5000/api/cif/YOUR_CIF_ID/attachments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "attachments=@test.pdf"
```

### Download Test
```bash
curl http://localhost:5000/api/cif/attachments/ATTACHMENT_ID/download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded.pdf
```

## What If Something Goes Wrong?

### Rollback
```bash
git checkout HEAD~1
pm2 restart all
```

Original files are still on filesystem (not deleted by migration).

## Need More Details?

- **Full Guide:** [CIF_GRIDFS_MIGRATION.md](./CIF_GRIDFS_MIGRATION.md)
- **Deployment Checklist:** [CIF_GRIDFS_DEPLOYMENT_CHECKLIST.md](./CIF_GRIDFS_DEPLOYMENT_CHECKLIST.md)
- **Complete Reference:** [GRIDFS_COMPLETE_REFERENCE.md](./GRIDFS_COMPLETE_REFERENCE.md)

## Support

Check logs if issues:
```bash
pm2 logs --err
```

Common issues already fixed:
- ✅ "MongoDB not connected yet" - Fixed with lazy initialization
- ✅ File not found - Migration script handles this
- ✅ Upload fails - Proper error handling in place

## Status

✅ Code ready  
✅ Migration script ready  
✅ Documentation complete  
✅ No syntax errors  
✅ Backward compatible  

**Ready to deploy!**
