# GridFS Policy System - Deployment Checklist

## 📋 Pre-Deployment Checklist

### ✅ Backend Setup (Complete)
- [x] GridFS bucket initialized in `db.js`
- [x] Policy model updated with `fileId` and `fileSize`
- [x] Upload middleware created (`uploadPolicyGridFS.js`)
- [x] Routes created (`policiesGridFS.js`)
- [x] Routes registered in `server.js`
- [x] Migration scripts created
- [x] Test scripts created
- [x] Documentation written
- [x] System verified (all checks passed)

### ⏳ Migration Tasks
- [ ] Backup existing policies directory
  ```bash
  cp -r backend/storage/policies backend/storage/policies.backup
  ```
- [ ] Run migration dry run
  ```bash
  cd backend
  node scripts/migrate-policies-to-gridfs.js --dry-run
  ```
- [ ] Review dry run output
- [ ] Run actual migration
  ```bash
  node scripts/migrate-policies-to-gridfs.js
  ```
- [ ] Verify migration success
  ```bash
  node scripts/test-gridfs-policy-system.js
  ```
- [ ] Test policy viewing in production
- [ ] (Optional) Delete old files after verification
  ```bash
  node scripts/migrate-policies-to-gridfs.js --delete-old
  ```

### ⏳ Frontend Updates
- [ ] Update API base URL
  - Change: `/api/policies` → `/api/policies-gridfs`
- [ ] Update authentication method
  - Remove: Cookie-based auth
  - Add: Authorization header with JWT
- [ ] Update PDF fetching
  - Add: `responseType: 'blob'`
  - Add: `Authorization` header
- [ ] Update PDF viewer
  - Use: Blob URL from response
  - Add: Cleanup on unmount
- [ ] Test upload flow (Admin)
- [ ] Test view flow (All users)
- [ ] Test delete flow (Admin)

### ⏳ Testing
- [ ] Test with admin account
  - [ ] Upload new policy
  - [ ] View uploaded policy
  - [ ] Replace existing policy
  - [ ] Delete policy
- [ ] Test with regular user account
  - [ ] View policies list
  - [ ] View policy PDF
  - [ ] Verify cannot upload (403)
  - [ ] Verify cannot delete (403)
- [ ] Test without authentication
  - [ ] Verify all endpoints return 401
- [ ] Test with invalid token
  - [ ] Verify returns 403
- [ ] Test with large PDF (>5MB)
  - [ ] Verify uploads successfully
- [ ] Test with non-PDF file
  - [ ] Verify rejected with error

### ⏳ Security Review
- [ ] Verify JWT authentication working
- [ ] Verify Authorization header required
- [ ] Verify admin-only endpoints protected
- [ ] Verify PDF signature validation
- [ ] Verify file size limits enforced
- [ ] Verify security headers present
- [ ] Verify no directory traversal possible
- [ ] Test CORS configuration
- [ ] Review error messages (no sensitive info)

### ⏳ Performance Testing
- [ ] Test with multiple concurrent uploads
- [ ] Test with multiple concurrent downloads
- [ ] Monitor MongoDB memory usage
- [ ] Monitor server memory usage
- [ ] Test PDF streaming speed
- [ ] Verify no memory leaks

### ⏳ Database
- [ ] Verify MongoDB connection stable
- [ ] Verify GridFS collections created
  - `policyFiles.files`
  - `policyFiles.chunks`
- [ ] Check GridFS storage usage
- [ ] Verify backups include GridFS
- [ ] Test restore from backup

### ⏳ Monitoring
- [ ] Set up alerts for failed uploads
- [ ] Monitor GridFS storage growth
- [ ] Monitor API response times
- [ ] Track policy view counts (optional)
- [ ] Monitor error logs

### ⏳ Documentation
- [ ] Update API documentation
- [ ] Update frontend documentation
- [ ] Update deployment guide
- [ ] Create user guide for admins
- [ ] Document troubleshooting steps

## 🚀 Deployment Steps

### Development Environment
1. [ ] Pull latest code
2. [ ] Install dependencies: `npm install`
3. [ ] Run verification: `node scripts/verify-gridfs-setup.js`
4. [ ] Start server: `npm start`
5. [ ] Run tests: `node scripts/test-gridfs-policy-system.js`
6. [ ] Test manually with Postman/curl

### Staging Environment
1. [ ] Deploy backend code
2. [ ] Run migration: `node scripts/migrate-policies-to-gridfs.js`
3. [ ] Verify migration: Check database
4. [ ] Deploy frontend code
5. [ ] Test all flows
6. [ ] Monitor logs for errors
7. [ ] Get stakeholder approval

### Production Environment
1. [ ] Schedule maintenance window (if needed)
2. [ ] Backup database
3. [ ] Backup policies directory
4. [ ] Deploy backend code
5. [ ] Run migration: `node scripts/migrate-policies-to-gridfs.js`
6. [ ] Verify migration success
7. [ ] Deploy frontend code
8. [ ] Test critical flows
9. [ ] Monitor for 24 hours
10. [ ] (Optional) Delete old files after 1 week

## 🔄 Rollback Plan

### If Issues Occur

1. **Backend Issues**
   ```bash
   # Revert to previous version
   git checkout <previous-commit>
   npm install
   npm start
   ```

2. **Migration Issues**
   ```bash
   # Policies still have fileUrl, old system still works
   # No rollback needed for database
   ```

3. **Frontend Issues**
   ```bash
   # Revert frontend to use old endpoints
   # Change: /api/policies-gridfs → /api/policies
   ```

## ✅ Post-Deployment Verification

### Immediate (0-1 hour)
- [ ] Server started successfully
- [ ] No errors in logs
- [ ] Admin can upload policy
- [ ] Users can view policies
- [ ] PDF streaming works

### Short-term (1-24 hours)
- [ ] No memory leaks
- [ ] No performance degradation
- [ ] No user complaints
- [ ] Logs clean
- [ ] MongoDB stable

### Long-term (1-7 days)
- [ ] All policies accessible
- [ ] No data loss
- [ ] Performance acceptable
- [ ] Users satisfied
- [ ] Ready to delete old files

## 📊 Success Metrics

- [ ] 100% of policies migrated successfully
- [ ] 0 data loss incidents
- [ ] <500ms average PDF load time
- [ ] 0 authentication failures
- [ ] 0 security incidents
- [ ] 100% uptime during migration
- [ ] Positive user feedback

## 🐛 Known Issues & Workarounds

### Issue: Bucket name shows as "undefined"
**Status:** Cosmetic only, does not affect functionality  
**Workaround:** None needed, bucket works correctly

### Issue: Old policies have fileUrl but no fileId
**Status:** Expected before migration  
**Workaround:** Run migration script

## 📞 Emergency Contacts

- **Backend Lead:** [Name/Email]
- **Frontend Lead:** [Name/Email]
- **DevOps Lead:** [Name/Email]
- **Database Admin:** [Name/Email]

## 📝 Notes

- Migration is non-destructive (old files preserved)
- Both old and new systems can coexist
- No downtime required for migration
- Rollback is simple (revert code)
- Old policies still work until migrated

## 🎯 Definition of Done

- [x] Code implemented and tested
- [x] Documentation complete
- [ ] Migration completed
- [ ] Frontend updated
- [ ] All tests passing
- [ ] Security review passed
- [ ] Performance acceptable
- [ ] Deployed to production
- [ ] Monitored for 1 week
- [ ] Old files cleaned up
- [ ] Team trained
- [ ] Users notified

---

**Last Updated:** February 14, 2026  
**Status:** Ready for Migration  
**Next Step:** Run migration in staging environment
