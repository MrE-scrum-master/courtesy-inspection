// File Upload Module for Railway PostgreSQL
// Railway volume storage with multer integration
// KISS, DRY, SOLID principles

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class UploadService {
  constructor(db) {
    this.db = db;
    this.uploadDir = process.env.UPLOAD_PATH || './uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    this.initializeUploadDirectory();
    this.configureMulter();
  }

  // Initialize upload directory
  async initializeUploadDirectory() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'inspections'), { recursive: true });
      console.log('Upload directories initialized');
    } catch (error) {
      console.error('Failed to initialize upload directory:', error);
      throw error;
    }
  }

  // Configure multer for file uploads
  configureMulter() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const inspectionDir = path.join(this.uploadDir, 'inspections');
        cb(null, inspectionDir);
      },
      filename: (req, file, cb) => {
        // Generate unique filename: timestamp-random-originalname
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
      }
    });

    const fileFilter = (req, file, cb) => {
      if (this.allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed types: ${this.allowedTypes.join(', ')}`), false);
      }
    };

    this.upload = multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 10 // Max 10 files per request
      }
    });
  }

  // Save photo metadata to database
  async savePhotoMetadata(inspectionId, file, description = '', category = 'general') {
    try {
      const filePath = file.path;
      const fileUrl = `/api/uploads/${path.basename(filePath)}`;
      
      const result = await this.db.query(`
        INSERT INTO inspection_photos (
          inspection_id, 
          file_url, 
          file_path, 
          original_name,
          file_size,
          mime_type,
          category, 
          description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        inspectionId,
        fileUrl,
        filePath,
        file.originalname,
        file.size,
        file.mimetype,
        category,
        description
      ]);

      return result.rows[0];
    } catch (error) {
      // Clean up file if database save fails
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        console.error('Failed to clean up file:', unlinkError);
      }
      throw error;
    }
  }

  // Middleware for single file upload
  single(fieldName = 'photo') {
    return this.upload.single(fieldName);
  }

  // Middleware for multiple file upload
  multiple(fieldName = 'photos', maxCount = 10) {
    return this.upload.array(fieldName, maxCount);
  }

  // Handle photo upload for inspection
  handleInspectionPhotoUpload() {
    return async (req, res, next) => {
      try {
        const { inspectionId, description, category } = req.body;
        
        if (!inspectionId) {
          return res.status(400).json({ error: 'Inspection ID is required' });
        }

        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        // Verify inspection exists and user has access
        const inspectionResult = await this.db.query(
          'SELECT id FROM inspections WHERE id = $1 AND shop_id = $2',
          [inspectionId, req.user.shop_id]
        );

        if (inspectionResult.rows.length === 0) {
          // Clean up uploaded file
          await fs.unlink(req.file.path);
          return res.status(404).json({ error: 'Inspection not found' });
        }

        // Save photo metadata
        const photo = await this.savePhotoMetadata(
          inspectionId,
          req.file,
          description,
          category
        );

        res.json({
          success: true,
          photo: {
            id: photo.id,
            fileUrl: photo.file_url,
            originalName: photo.original_name,
            category: photo.category,
            description: photo.description,
            createdAt: photo.created_at
          }
        });
      } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
      }
    };
  }

  // Serve static files
  serveStaticFiles() {
    return async (req, res) => {
      try {
        const filename = req.params.filename;
        const filePath = path.join(this.uploadDir, 'inspections', filename);

        // Security check - prevent directory traversal
        if (!filePath.startsWith(this.uploadDir)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Check if file exists
        try {
          await fs.access(filePath);
        } catch {
          return res.status(404).json({ error: 'File not found' });
        }

        // Set appropriate headers
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp'
        };

        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache

        res.sendFile(filePath);
      } catch (error) {
        console.error('File serve error:', error);
        res.status(500).json({ error: 'Failed to serve file' });
      }
    };
  }

  // Delete photo
  async deletePhoto(photoId, userId, shopId) {
    try {
      // Get photo info with access check
      const result = await this.db.query(`
        SELECT ip.file_path 
        FROM inspection_photos ip
        JOIN inspections i ON ip.inspection_id = i.id
        WHERE ip.id = $1 AND i.shop_id = $2
      `, [photoId, shopId]);

      if (result.rows.length === 0) {
        throw new Error('Photo not found or access denied');
      }

      const filePath = result.rows[0].file_path;

      // Delete from database
      await this.db.query('DELETE FROM inspection_photos WHERE id = $1', [photoId]);

      // Delete physical file
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Failed to delete physical file:', unlinkError);
        // Don't throw error if file deletion fails - database cleanup is more important
      }

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Clean up orphaned files (utility function)
  async cleanupOrphanedFiles() {
    try {
      const files = await fs.readdir(path.join(this.uploadDir, 'inspections'));
      const dbResult = await this.db.query('SELECT file_path FROM inspection_photos');
      const dbFiles = dbResult.rows.map(row => path.basename(row.file_path));
      
      const orphanedFiles = files.filter(file => !dbFiles.includes(file));
      
      for (const file of orphanedFiles) {
        const filePath = path.join(this.uploadDir, 'inspections', file);
        await fs.unlink(filePath);
        console.log(`Deleted orphaned file: ${file}`);
      }

      return { cleaned: orphanedFiles.length };
    } catch (error) {
      console.error('Cleanup error:', error);
      throw error;
    }
  }
}

module.exports = UploadService;