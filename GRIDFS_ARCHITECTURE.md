# GridFS Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│  - Upload files via multipart/form-data                         │
│  - Download files via authenticated endpoints                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      EXPRESS SERVER                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              AUTHENTICATION LAYER                         │  │
│  │  - JWT Token Validation                                   │  │
│  │  - User Identity Verification                             │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐  │
│  │              UPLOAD MIDDLEWARE                            │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │ uploadAvatarGridFS.js                           │    │  │
│  │  │ - Bucket: avatars                               │    │  │
│  │  │ - Max: 5MB                                      │    │  │
│  │  │ - Types: JPEG, PNG, GIF, WebP                  │    │  │
│  │  │ - Features: Compression, EXIF strip            │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │ uploadPolicyGridFS.js                           │    │  │
│  │  │ - Bucket: policyFiles                           │    │  │
│  │  │ - Max: 10MB                                     │    │  │
│  │  │ - Types: PDF only                               │    │  │
│  │  │ - Access: Admin only                            │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │ uploadMedicalCertificate.js                     │    │  │
│  │  │ - Bucket: medicalCertificates                   │    │  │
│  │  │ - Max: 10MB                                     │    │  │
│  │  │ - Types: PDF, Images                            │    │  │
│  │  │ - Linked: Leave requests                        │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │ uploadCIFAttachmentGridFS.js (NEW)              │    │  │
│  │  │ - Bucket: cifAttachments                        │    │  │
│  │  │ - Max: 10MB per file                            │    │  │
│  │  │ - Types: PDF, DOCX, DOC, Images                │    │  │
│  │  │ - Features: Multiple files, Audit logs         │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                           │  │
│  │  All use SAFE LAZY INITIALIZATION:                       │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │ let bucket;                                      │    │  │
│  │  │ function getBucket() {                           │    │  │
│  │  │   if (!bucket) {                                 │    │  │
│  │  │     bucket = new GridFSBucket(...);             │    │  │
│  │  │   }                                              │    │  │
│  │  │   return bucket;                                 │    │  │
│  │  │ }                                                │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐  │
│  │              ROUTE HANDLERS                               │  │
│  │  - Validate business logic                                │  │
│  │  - Create database records                                │  │
│  │  - Send responses                                         │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          │
┌─────────────────────────▼────────────────────────────────────┐
│                    MONGODB DATABASE                           │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              GRIDFS BUCKETS                            │  │
│  │                                                        │  │
│  │  avatars.files          avatars.chunks                │  │
│  │  ├─ _id                 ├─ files_id                   │  │
│  │  ├─ filename            ├─ n (chunk number)           │  │
│  │  ├─ contentType         └─ data (binary)             │  │
│  │  ├─ length                                            │  │
│  │  └─ metadata                                          │  │
│  │                                                        │  │
│  │  policyFiles.files      policyFiles.chunks            │  │
│  │  ├─ _id                 ├─ files_id                   │  │
│  │  ├─ filename            ├─ n                          │  │
│  │  ├─ contentType         └─ data                       │  │
│  │  ├─ length                                            │  │
│  │  └─ metadata                                          │  │
│  │                                                        │  │
│  │  medicalCertificates.files  medicalCertificates.chunks│  │
│  │  ├─ _id                     ├─ files_id               │  │
│  │  ├─ filename                ├─ n                      │  │
│  │  ├─ contentType             └─ data                   │  │
│  │  ├─ length                                            │  │
│  │  └─ metadata                                          │  │
│  │                                                        │  │
│  │  cifAttachments.files   cifAttachments.chunks (NEW)   │  │
│  │  ├─ _id                 ├─ files_id                   │  │
│  │  ├─ filename            ├─ n                          │  │
│  │  ├─ contentType         └─ data                       │  │
│  │  ├─ length                                            │  │
│  │  └─ metadata                                          │  │
│  │     ├─ originalName                                   │  │
│  │     ├─ uploadedBy                                     │  │
│  │     ├─ uploadedAt                                     │  │
│  │     └─ fileSize                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              APPLICATION COLLECTIONS                   │  │
│  │                                                        │  │
│  │  users                                                 │  │
│  │  ├─ profileImageUrl: "/api/users/avatar/:fileId"     │  │
│  │                                                        │  │
│  │  policies                                              │  │
│  │  ├─ fileId: ObjectId (GridFS)                        │  │
│  │  ├─ fileName                                          │  │
│  │                                                        │  │
│  │  leaverequests                                         │  │
│  │  ├─ medicalCertificateUrl: "/api/medical-certs/:id"  │  │
│  │                                                        │  │
│  │  cifattachments (NEW)                                  │  │
│  │  ├─ cifId: ObjectId                                   │  │
│  │  ├─ fileId: ObjectId (GridFS)                        │  │
│  │  ├─ fileName                                          │  │
│  │  ├─ originalName                                      │  │
│  │  ├─ fileType                                          │  │
│  │  ├─ fileSize                                          │  │
│  │  └─ uploadedBy: ObjectId                             │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## Upload Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ 1. POST /api/upload (multipart/form-data)
     │
┌────▼─────────────┐
│ authenticateToken│
└────┬─────────────┘
     │ 2. Verify JWT
     │
┌────▼──────────────┐
│ Upload Middleware │
│ (busboy)          │
└────┬──────────────┘
     │ 3. Parse multipart
     │ 4. Validate file
     │ 5. Buffer in memory
     │
┌────▼──────────────┐
│ getBucket()       │
│ (Lazy Init)       │
└────┬──────────────┘
     │ 6. Initialize GridFSBucket if needed
     │
┌────▼──────────────┐
│ GridFS Upload     │
└────┬──────────────┘
     │ 7. Stream to MongoDB
     │ 8. Store in chunks (255KB each)
     │
┌────▼──────────────┐
│ Database Record   │
└────┬──────────────┘
     │ 9. Create/update record with fileId
     │
┌────▼──────────────┐
│ Response          │
└────┬──────────────┘
     │ 10. Return success + fileId
     │
┌────▼─────┐
│  Client  │
└──────────┘
```

## Download Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ 1. GET /api/download/:fileId
     │
┌────▼─────────────┐
│ authenticateToken│
└────┬─────────────┘
     │ 2. Verify JWT
     │
┌────▼──────────────┐
│ Route Handler     │
└────┬──────────────┘
     │ 3. Lookup database record
     │ 4. Check authorization
     │
┌────▼──────────────┐
│ getBucket()       │
└────┬──────────────┘
     │ 5. Get GridFSBucket
     │
┌────▼──────────────┐
│ GridFS Download   │
└────┬──────────────┘
     │ 6. openDownloadStream(fileId)
     │ 7. Read chunks from MongoDB
     │
┌────▼──────────────┐
│ Stream to Client  │
└────┬──────────────┘
     │ 8. Pipe stream to response
     │ 9. Set Content-Type headers
     │
┌────▼─────┐
│  Client  │
└──────────┘
```

## Delete Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ 1. DELETE /api/delete/:id
     │
┌────▼─────────────┐
│ authenticateToken│
└────┬─────────────┘
     │ 2. Verify JWT
     │
┌────▼──────────────┐
│ Route Handler     │
└────┬──────────────┘
     │ 3. Lookup database record
     │ 4. Check authorization
     │
┌────▼──────────────┐
│ getBucket()       │
└────┬──────────────┘
     │ 5. Get GridFSBucket
     │
┌────▼──────────────┐
│ GridFS Delete     │
└────┬──────────────┘
     │ 6. bucket.delete(fileId)
     │ 7. Remove file + chunks
     │
┌────▼──────────────┐
│ Database Delete   │
└────┬──────────────┘
     │ 8. Remove database record
     │ 9. Create audit log
     │
┌────▼──────────────┐
│ Response          │
└────┬──────────────┘
     │ 10. Return success
     │
┌────▼─────┐
│  Client  │
└──────────┘
```

## Server Startup Sequence

```
┌─────────────────┐
│ Start Server    │
└────┬────────────┘
     │
┌────▼────────────┐
│ Load Modules    │
│ (require)       │
└────┬────────────┘
     │ ⚠️ GridFSBucket NOT initialized yet
     │    (only function definitions loaded)
     │
┌────▼────────────┐
│ Connect MongoDB │
│ await connectDB()│
└────┬────────────┘
     │ ✅ MongoDB ready
     │
┌────▼────────────┐
│ Load Routes     │
└────┬────────────┘
     │ Routes registered but not executed
     │
┌────▼────────────┐
│ Start HTTP      │
│ Server          │
└────┬────────────┘
     │ ✅ Server listening
     │
┌────▼────────────┐
│ First Request   │
└────┬────────────┘
     │
┌────▼────────────┐
│ getBucket()     │
│ called          │
└────┬────────────┘
     │ ✅ GridFSBucket initialized NOW
     │    (MongoDB already connected)
     │
┌────▼────────────┐
│ Upload/Download │
│ Works!          │
└─────────────────┘
```

## Why Lazy Initialization?

### ❌ Without Lazy Init (OLD - CRASHES)
```javascript
// Module load time
const bucket = new GridFSBucket(mongoose.connection.db);
// ❌ mongoose.connection.db is undefined
// ❌ Server crashes before starting
```

### ✅ With Lazy Init (NEW - SAFE)
```javascript
// Module load time
let bucket;  // ✅ Just a variable, no crash

// First request time
function getBucket() {
    if (!bucket) {
        // ✅ MongoDB already connected
        bucket = new GridFSBucket(mongoose.connection.db);
    }
    return bucket;
}
```

## Storage Comparison

### Filesystem (OLD)
```
backend/
└── uploads/
    ├── avatars/
    │   ├── avatar-123.jpg
    │   └── avatar-456.png
    ├── policies/
    │   └── policy-789.pdf
    └── cif-attachments/
        ├── cif-abc.pdf
        └── cif-def.docx

❌ Problems:
- Deployment issues (file permissions)
- No automatic backup
- Orphaned files possible
- Not scalable
```

### GridFS (NEW)
```
MongoDB Database
├── avatars.files (metadata)
├── avatars.chunks (binary data)
├── policyFiles.files
├── policyFiles.chunks
├── medicalCertificates.files
├── medicalCertificates.chunks
├── cifAttachments.files
└── cifAttachments.chunks

✅ Benefits:
- Works anywhere MongoDB works
- Automatic backup with MongoDB
- No orphaned files
- Scalable with MongoDB
- Consistent with database
```

## Summary

- **4 GridFS Buckets** for different file types
- **Safe Lazy Initialization** prevents crashes
- **Streaming** for memory efficiency
- **Security** at every layer
- **Complete Documentation** for maintenance

**Status:** ✅ Production Ready
