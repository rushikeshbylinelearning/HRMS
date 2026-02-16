# GridFS Policy System Documentation

## Overview

Secure policy PDF storage and delivery system using MongoDB GridFS, eliminating filesystem dependencies and cookie-based authentication issues.

## Architecture

### Key Components

1. **GridFS Bucket** (`policyFiles`)
   - Separate from avatar bucket
   - Stores policy PDFs in MongoDB
   - No filesystem dependency

2. **Upload Middleware** (`uploadPolicyGridFS.js`)
   - Memory-only processing (no disk writes)
   - PDF validation (magic number + MIME type)
   - 10MB file size limit
   - Admin-only access

3. **Routes** (`policiesGridFS.js`)
   - JWT-based authentication (Authorization header)
   - Secure PDF streaming
   - No cookie dependency
   - CRUD operations for policies

4. **Policy Model** (updated)
   - `fileId`: GridFS ObjectId (required)
   - `fileName`: Original filename
   - `fileSize`: File size in bytes
   - `fileUrl`: Legacy field (optional)

## Security Features

### Authentication
- JWT token via Authorization header: `Bearer <token>`
- No cookie dependency
- Works with LiteSpeed/OpenLiteSpeed

### File Validation
- PDF magic number verification (`%PDF`)
- MIME type validation (`application/pdf`)
- File size limit (10MB)
- Admin-only upload/delete

### Secure Delivery
- Private streaming (no caching)
- Security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Cache-Control: private, no-store`
- Content-Disposition: inline (browser preview)

## API Endpoints

### Base URL
```
/api/policies-gridfs
```

### Endpoints

#### 1. Get All Policies
```http
GET /api/policies-gridfs
Authorization: Bearer <token>
```

**Response:**
```json
{
  "policies": [
    {
      "_id": "...",
      "name": "Employee Handbook",
      "version": "1.0",
      "effectiveFrom": "2024-01-01T00:00:00.000Z",
      "department": "HR",
      "status": "Active",
      "fileId": "...",
      "fileName": "handbook.pdf",
      "fileSize": 1234567,
      "uploadedBy": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

#### 2. Get Active Policies
```http
GET /api/policies-gridfs/active
Authorization: Bearer <token>
```

#### 3. Stream Policy PDF
```http
GET /api/policies-gridfs/:id/file
Authorization: Bearer <token>
```

**Response:** PDF binary stream

#### 4. Upload Policy (Admin Only)
```http
POST /api/policies-gridfs/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
- file: PDF file (required)
- name: Policy name (required)
- version: Version number or "auto" (required)
- effectiveFrom: ISO date string (required)
- department: Department name (optional)
- status: "Active" or "Archived" (optional, default: "Active")
```

**Response:**
```json
{
  "message": "Policy uploaded successfully",
  "policy": { ... }
}
```

#### 5. Replace Policy (Admin Only)
```http
POST /api/policies-gridfs/:id/replace
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields: Same as upload
```

#### 6. Delete Policy (Admin Only)
```http
DELETE /api/policies-gridfs/:id
Authorization: Bearer <token>
```

## Frontend Integration

### Fetching PDF with Axios

```javascript
import axios from 'axios';

async function viewPolicy(policyId, token) {
  try {
    const response = await axios.get(
      `/api/policies-gridfs/${policyId}/file`,
      {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    // Create blob URL
    const fileURL = URL.createObjectURL(response.data);
    
    // Use with react-pdf or iframe
    return fileURL;
  } catch (error) {
    console.error('Failed to load PDF:', error);
    throw error;
  }
}
```

### React PDF Viewer

```jsx
import { Document, Page } from 'react-pdf';

function PolicyViewer({ policyId, token }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  
  useEffect(() => {
    viewPolicy(policyId, token).then(setPdfUrl);
    
    // Cleanup blob URL
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [policyId, token]);
  
  return (
    <Document file={pdfUrl}>
      <Page pageNumber={1} />
    </Document>
  );
}
```

### Iframe Viewer

```jsx
function PolicyViewer({ policyId, token }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  
  useEffect(() => {
    viewPolicy(policyId, token).then(setPdfUrl);
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [policyId, token]);
  
  return (
    <iframe
      src={pdfUrl}
      width="100%"
      height="600px"
      title="Policy Document"
    />
  );
}
```

## Migration from Filesystem

### Step 1: Backup
```bash
# Backup existing policies
cp -r backend/storage/policies backend/storage/policies.backup
```

### Step 2: Dry Run
```bash
cd backend
node scripts/migrate-policies-to-gridfs.js --dry-run
```

### Step 3: Migrate
```bash
node scripts/migrate-policies-to-gridfs.js
```

### Step 4: Verify
```bash
node scripts/test-gridfs-policy-system.js
```

### Step 5: Cleanup (Optional)
```bash
# Delete old files after verification
node scripts/migrate-policies-to-gridfs.js --delete-old
```

## Server Configuration

### Update server.js

Replace old policy routes:
```javascript
// OLD
app.use('/api/policies', require('./routes/policies'));

// NEW
app.use('/api/policies-gridfs', require('./routes/policiesGridFS'));
```

### Environment Variables

No additional environment variables required. Uses existing:
- `MONGODB_URI` or `MONGO_URI`
- `JWT_SECRET`

## Testing

### Manual Testing

1. **Login as Admin:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

2. **Upload Policy:**
```bash
curl -X POST http://localhost:5000/api/policies-gridfs/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@policy.pdf" \
  -F "name=Test Policy" \
  -F "version=1.0" \
  -F "effectiveFrom=2024-01-01"
```

3. **Get Policies:**
```bash
curl http://localhost:5000/api/policies-gridfs \
  -H "Authorization: Bearer <token>"
```

4. **Stream PDF:**
```bash
curl http://localhost:5000/api/policies-gridfs/<id>/file \
  -H "Authorization: Bearer <token>" \
  --output policy.pdf
```

### Automated Testing

```bash
cd backend
node scripts/test-gridfs-policy-system.js
```

## Troubleshooting

### Issue: "Policy bucket not initialized"
**Solution:** Ensure MongoDB is connected before accessing policies
```javascript
await connectDB();
const bucket = getPolicyBucket();
```

### Issue: "Invalid PDF signature"
**Solution:** Verify file is actually a PDF (starts with `%PDF`)

### Issue: "Unauthorized" (401)
**Solution:** Check Authorization header format: `Bearer <token>`

### Issue: "File not found in storage"
**Solution:** Policy fileId may be invalid. Check GridFS:
```javascript
const files = await mongoose.connection.db
  .collection('policyFiles.files')
  .find({})
  .toArray();
console.log(files);
```

## Performance Considerations

### Streaming Benefits
- No memory buffering of entire file
- Efficient for large PDFs
- Supports range requests (future enhancement)

### Caching Strategy
- No caching (private documents)
- Consider Redis for frequently accessed policies
- Client-side blob URL caching

### Scalability
- GridFS handles files > 16MB (MongoDB document limit)
- Horizontal scaling with MongoDB replica sets
- No filesystem synchronization needed

## Security Best Practices

1. **Always use HTTPS in production**
2. **Rotate JWT secrets regularly**
3. **Implement rate limiting** (consider adding to middleware)
4. **Audit log downloads** (add to route handlers)
5. **Scan uploaded PDFs** (consider antivirus integration)
6. **Set appropriate CORS policies**

## Advantages Over Filesystem

| Feature | Filesystem | GridFS |
|---------|-----------|--------|
| Deployment | Complex (sync files) | Simple (database only) |
| Backup | Separate process | Included in DB backup |
| Scaling | Shared storage needed | Automatic with MongoDB |
| Security | File permissions | Database ACL |
| Versioning | Manual | Built-in |
| Replication | rsync/NFS | MongoDB replication |
| Cookie Issues | Affected by LiteSpeed | Not affected |

## Future Enhancements

1. **Range Request Support** - For large PDFs
2. **PDF Thumbnails** - Generate preview images
3. **Version History** - Track all policy versions
4. **Download Audit Log** - Track who viewed what
5. **PDF Watermarking** - Add user info to PDFs
6. **Compression** - Compress PDFs before storage
7. **CDN Integration** - Cache public policies
8. **Search** - Full-text search in PDFs

## Support

For issues or questions:
1. Check logs: `backend/logs/combined.log`
2. Run test suite: `node scripts/test-gridfs-policy-system.js`
3. Verify MongoDB connection: Check `connectDB()` logs
4. Check GridFS collections: `policyFiles.files` and `policyFiles.chunks`
