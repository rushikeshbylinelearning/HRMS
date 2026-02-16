# GridFS Policy System - Quick Start Guide

## 🚀 What Changed?

New secure policy system using MongoDB GridFS instead of filesystem storage.

### Key Benefits
✅ No filesystem dependency  
✅ No cookie issues with LiteSpeed  
✅ JWT-based authentication (Authorization header)  
✅ Automatic MongoDB backup inclusion  
✅ Easier deployment and scaling  

## 📋 For Backend Developers

### New Endpoints
```
/api/policies-gridfs/*  (NEW - GridFS-based)
/api/policies/*         (OLD - filesystem-based, still available)
```

### Upload Policy (Admin)
```javascript
const FormData = require('form-data');
const form = new FormData();
form.append('file', fs.createReadStream('policy.pdf'));
form.append('name', 'Employee Handbook');
form.append('version', '1.0');
form.append('effectiveFrom', new Date().toISOString());

await axios.post('/api/policies-gridfs/upload', form, {
  headers: {
    ...form.getHeaders(),
    'Authorization': `Bearer ${token}`
  }
});
```

### Stream Policy PDF
```javascript
const response = await axios.get(
  `/api/policies-gridfs/${policyId}/file`,
  {
    responseType: 'arraybuffer',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
```

## 🎨 For Frontend Developers

### Fetch and Display PDF

```javascript
import axios from 'axios';

// Fetch PDF as blob
async function fetchPolicyPDF(policyId, token) {
  const response = await axios.get(
    `/api/policies-gridfs/${policyId}/file`,
    {
      responseType: 'blob',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  return URL.createObjectURL(response.data);
}

// Usage in React component
function PolicyViewer({ policyId }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const token = localStorage.getItem('token'); // or from context
  
  useEffect(() => {
    fetchPolicyPDF(policyId, token)
      .then(setPdfUrl)
      .catch(console.error);
    
    // Cleanup blob URL
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [policyId]);
  
  if (!pdfUrl) return <div>Loading...</div>;
  
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

### With react-pdf

```javascript
import { Document, Page, pdfjs } from 'react-pdf';

// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function PolicyViewer({ policyId }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const token = localStorage.getItem('token');
  
  useEffect(() => {
    fetchPolicyPDF(policyId, token).then(setPdfUrl);
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [policyId]);
  
  return (
    <Document
      file={pdfUrl}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
    >
      {Array.from(new Array(numPages), (el, index) => (
        <Page key={`page_${index + 1}`} pageNumber={index + 1} />
      ))}
    </Document>
  );
}
```

## 🔧 Migration Steps

### 1. Test Current System
```bash
cd backend
node scripts/test-gridfs-policy-system.js
```

### 2. Migrate Existing Policies (Dry Run)
```bash
node scripts/migrate-policies-to-gridfs.js --dry-run
```

### 3. Migrate for Real
```bash
node scripts/migrate-policies-to-gridfs.js
```

### 4. Update Frontend
Replace API calls from `/api/policies/*` to `/api/policies-gridfs/*`

### 5. Verify Everything Works
Test upload, view, and delete operations

### 6. Cleanup Old Files (Optional)
```bash
node scripts/migrate-policies-to-gridfs.js --delete-old
```

## 🔐 Authentication

### Old Way (Cookie-based) ❌
```javascript
// Doesn't work with LiteSpeed
fetch('/api/policies/file/policy.pdf', {
  credentials: 'include'
});
```

### New Way (JWT Header) ✅
```javascript
// Works everywhere
fetch('/api/policies-gridfs/123/file', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## 📊 API Comparison

| Feature | Old (/api/policies) | New (/api/policies-gridfs) |
|---------|---------------------|----------------------------|
| Storage | Filesystem | MongoDB GridFS |
| Auth | Cookie | JWT Header |
| Upload | Disk write | Memory only |
| Streaming | File read | GridFS stream |
| Backup | Separate | Included in DB |
| Scaling | Complex | Simple |
| LiteSpeed | Issues | Works |

## 🐛 Troubleshooting

### "Unauthorized" Error
```javascript
// ❌ Wrong
headers: { 'Authorization': token }

// ✅ Correct
headers: { 'Authorization': `Bearer ${token}` }
```

### PDF Not Loading
```javascript
// Check response type
responseType: 'blob'  // For blob URL
responseType: 'arraybuffer'  // For ArrayBuffer
```

### CORS Issues
```javascript
// Backend: Ensure CORS allows Authorization header
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  exposedHeaders: ['Authorization']
}));
```

## 📚 Full Documentation

See [GRIDFS_POLICY_SYSTEM.md](./GRIDFS_POLICY_SYSTEM.md) for complete documentation.

## 🆘 Need Help?

1. Check logs: `backend/logs/combined.log`
2. Run tests: `node scripts/test-gridfs-policy-system.js`
3. Verify MongoDB: Check `policyFiles.files` collection
4. Check token: Decode JWT at jwt.io

## 🎯 Next Steps

1. ✅ Backend implementation complete
2. ⏳ Update frontend to use new endpoints
3. ⏳ Migrate existing policies
4. ⏳ Test thoroughly
5. ⏳ Deploy to production
6. ⏳ Remove old filesystem routes (optional)
