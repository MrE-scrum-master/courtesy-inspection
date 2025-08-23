# Railway Volume Setup for Photo Storage

This guide explains how to configure Railway volumes for persistent photo storage in the Courtesy Inspection platform.

## Overview

Railway volumes provide persistent storage that survives deployments, making them perfect for storing inspection photos. The system is configured to use the path `/data/uploads` which maps to a Railway volume.

## Volume Configuration

### 1. Create Railway Volume

```bash
# Login to Railway CLI
railway login

# Connect to your project
railway link

# Create a volume (this creates a 1GB volume by default)
railway volume create data

# Or specify size explicitly
railway volume create data --size=5GB
```

### 2. Environment Variables

Set these environment variables in your Railway project:

```env
# Upload configuration
UPLOAD_PATH=/data/uploads
MAX_FILE_SIZE=10485760

# Database connection (already configured)
DATABASE_URL=postgresql://...

# File serving
NODE_ENV=production
```

### 3. Railway Service Configuration

In your `railway.toml` or through the Railway dashboard:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"

[volumes]
data = "/data"
```

## File Structure

The volume will be mounted at `/data` with this structure:

```
/data/
└── uploads/
    └── inspections/
        ├── 1640995200000-abc123.jpg
        ├── 1640995201000-def456.png
        └── ...
```

## Photo Upload Endpoints

### Upload Photo
```http
POST /api/photos/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

{
  "photo": <file>,
  "inspection_id": 123,
  "item_id": 456,  // optional
  "caption": "Brake pad wear"  // optional
}
```

### Get Photo
```http
GET /api/photos/:id
Authorization: Bearer <token>
```

### Attach to Inspection
```http
POST /api/inspections/:id/photos
Content-Type: multipart/form-data
Authorization: Bearer <token>

{
  "photo": <file>,
  "item_id": 456,  // optional
  "caption": "Front brake inspection"
}
```

### Delete Photo
```http
DELETE /api/photos/:id
Authorization: Bearer <token>
```

## Database Schema

Photos are stored in the `inspection_photos` table:

```sql
CREATE TABLE inspection_photos (
  id SERIAL PRIMARY KEY,
  inspection_id INTEGER REFERENCES inspections(id),
  item_id INTEGER REFERENCES inspection_items(id),
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(50),
  caption TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Features

### File Validation
- **Type Validation**: Only JPEG, PNG, and WebP images allowed
- **Size Limits**: Maximum 10MB per file
- **Path Security**: Prevents directory traversal attacks
- **User Authentication**: All endpoints require valid JWT tokens

### Access Control
- Photos can only be accessed by authenticated users
- Shop-level access control ensures users only see their shop's photos
- Soft delete implementation for photo removal

## Usage in Frontend

### PhotoCapture Component

The existing `PhotoCapture` component integrates with these endpoints:

```typescript
import { PhotoCapture } from '@/components';

// In your inspection form
<PhotoCapture
  onPhotoCapture={(photo) => {
    // Upload to server
    uploadPhoto(photo, inspectionId);
  }}
  maxPhotos={5}
  currentPhotoCount={photos.length}
/>
```

### Upload Implementation

```typescript
const uploadPhoto = async (photo: PhotoCaptureType, inspectionId: number) => {
  const formData = new FormData();
  formData.append('photo', {
    uri: photo.uri,
    type: 'image/jpeg',
    name: 'inspection-photo.jpg',
  } as any);
  formData.append('inspection_id', inspectionId.toString());
  formData.append('caption', caption);

  const response = await fetch('/api/photos/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  return response.json();
};
```

## Volume Management

### Monitoring Usage

```bash
# Check volume usage
railway logs

# Monitor file system in container
df -h /data
du -sh /data/uploads
```

### Backup Strategy

```bash
# Download all photos (for backup)
railway run bash -c "tar -czf photos-backup.tar.gz /data/uploads"

# Or use Railway's volume snapshots
railway volume snapshot create data
```

### Cleanup

```bash
# Clean up orphaned files (already implemented in upload.js)
railway run node -e "
const upload = require('./upload');
upload.cleanupOrphanedFiles();
"
```

## Production Considerations

### Performance
- **CDN Integration**: Consider CloudFlare or AWS CloudFront for image serving
- **Image Optimization**: Implement automatic resizing and compression
- **Caching**: Set appropriate cache headers (already implemented)

### Monitoring
- **Storage Usage**: Monitor volume usage to prevent overflow
- **Error Tracking**: Log upload failures and investigate patterns
- **Performance**: Monitor upload and serving response times

### Scaling
- **Volume Size**: Start with 5GB, monitor usage patterns
- **Multiple Volumes**: Consider separating uploads by date/shop for better organization
- **Image Processing**: Add background job for image optimization

## Troubleshooting

### Common Issues

1. **Volume Not Mounted**
   ```bash
   # Check if volume is properly mounted
   railway logs | grep volume
   ls -la /data
   ```

2. **Permission Issues**
   ```bash
   # Fix permissions if needed
   chmod -R 755 /data/uploads
   ```

3. **Disk Full**
   ```bash
   # Check usage
   df -h /data
   
   # Clean up if needed
   railway run node scripts/cleanup-old-photos.js
   ```

4. **Upload Failures**
   - Check file size limits
   - Verify MIME type restrictions
   - Ensure proper authentication

### Logs
```bash
# View upload-related logs
railway logs | grep -i upload
railway logs | grep -i photo
```

## Cost Optimization

### Railway Volume Pricing
- **Storage**: ~$0.25/GB/month
- **Transfer**: Included in Railway plan
- **Backups**: Volume snapshots are free

### Optimization Strategies
1. **Image Compression**: Reduce file sizes by 60-80%
2. **Cleanup Jobs**: Remove deleted photos after 30 days
3. **Archive Old Data**: Move old inspections to cold storage
4. **Monitor Growth**: Set up alerts for storage usage

## Migration from Local Storage

If migrating from local file storage:

1. **Export Current Photos**
   ```bash
   tar -czf current-photos.tar.gz uploads/
   ```

2. **Upload to Volume**
   ```bash
   # Copy to Railway volume
   railway run bash -c "cd /data && tar -xzf current-photos.tar.gz"
   ```

3. **Update Database Paths**
   ```sql
   UPDATE inspection_photos 
   SET file_path = REPLACE(file_path, './uploads/', '/data/uploads/');
   ```

This setup provides a robust, scalable photo storage solution that integrates seamlessly with Railway's infrastructure while maintaining security and performance standards.