const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Photo upload endpoints
router.post('/upload', (req, res, next) => {
  // Apply upload middleware
  req.upload.single('photo')(req, res, next);
}, async (req, res) => {
  try {
    const { inspection_id, item_id, caption } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No photo uploaded'
      });
    }

    if (!inspection_id) {
      return res.status(400).json({
        success: false,
        error: 'inspection_id is required'
      });
    }

    // Verify inspection exists and user has access
    const inspectionResult = await req.db.query(
      'SELECT id FROM inspections WHERE id = $1',
      [inspection_id]
    );

    if (inspectionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inspection not found'
      });
    }

    // Save photo metadata to database
    const photoResult = await req.db.query(`
      INSERT INTO inspection_photos (
        inspection_id, item_id, file_path, file_size, 
        mime_type, caption, uploaded_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [
      inspection_id,
      item_id || null,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      caption || '',
      req.user.id
    ]);

    const photo = photoResult.rows[0];
    
    res.status(201).json({
      success: true,
      data: {
        id: photo.id,
        url: `/api/photos/${photo.id}`,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        caption: photo.caption,
        createdAt: photo.created_at
      },
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get photo by ID
router.get('/:id', async (req, res) => {
  try {
    const photoResult = await req.db.query(`
      SELECT ip.*, i.shop_id 
      FROM inspection_photos ip
      JOIN inspections i ON ip.inspection_id = i.id
      WHERE ip.id = $1
    `, [req.params.id]);

    if (photoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found'
      });
    }

    const photo = photoResult.rows[0];
    
    // Security check - serve the actual file
    if (!fs.existsSync(photo.file_path)) {
      return res.status(404).json({
        success: false,
        error: 'Photo file not found'
      });
    }

    // Set appropriate headers and serve file
    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(path.resolve(photo.file_path));
    
  } catch (error) {
    console.error('Get photo error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete photo (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const photoResult = await req.db.query(`
      SELECT ip.*, i.shop_id 
      FROM inspection_photos ip
      JOIN inspections i ON ip.inspection_id = i.id
      WHERE ip.id = $1
    `, [req.params.id]);

    if (photoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Photo not found'
      });
    }

    // Soft delete - mark as deleted instead of actually deleting
    await req.db.query(`
      UPDATE inspection_photos 
      SET file_path = CONCAT(file_path, '.deleted'), caption = 'DELETED'
      WHERE id = $1
    `, [req.params.id]);

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;