// Photo Repository for PostgreSQL
// Repository pattern for inspection photo metadata management
// Includes file management, EXIF data, and thumbnail generation

import { BaseRepository } from './BaseRepository';
import { QueryResult } from 'pg';

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  inspection_item_id?: string;
  file_url: string;
  file_path: string;
  original_name?: string;
  file_size?: number;
  mime_type?: string;
  width?: number;
  height?: number;
  thumbnail_path?: string;
  compressed_path?: string;
  category: string;
  description?: string;
  tags?: string[];
  exif_data?: Record<string, any>;
  uploaded_by: string;
  sort_order: number;
  status: 'active' | 'deleted' | 'processing';
  created_at: Date;
  updated_at: Date;
}

export interface PhotoCreateRequest {
  inspectionId: string;
  inspectionItemId?: string;
  fileUrl: string;
  filePath: string;
  originalName?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  compressedPath?: string;
  category?: string;
  description?: string;
  tags?: string[];
  exifData?: Record<string, any>;
  sortOrder?: number;
}

export interface PhotoUpdateRequest {
  category?: string;
  description?: string;
  tags?: string[];
  sortOrder?: number;
  status?: 'active' | 'deleted' | 'processing';
}

export class PhotoRepository extends BaseRepository {
  
  // Create new photo record
  async create(data: PhotoCreateRequest, userId: string, shopId: string): Promise<InspectionPhoto> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verify inspection exists and belongs to shop
      const inspectionCheck = await client.query(
        'SELECT id FROM inspections WHERE id = $1 AND shop_id = $2',
        [data.inspectionId, shopId]
      );
      
      if (inspectionCheck.rows.length === 0) {
        throw new Error('Inspection not found or access denied');
      }
      
      // Verify inspection item if provided
      if (data.inspectionItemId) {
        const itemCheck = await client.query(
          'SELECT id FROM inspection_items WHERE id = $1 AND inspection_id = $2',
          [data.inspectionItemId, data.inspectionId]
        );
        
        if (itemCheck.rows.length === 0) {
          throw new Error('Inspection item not found');
        }
      }
      
      const query = `
        INSERT INTO inspection_photos (
          inspection_id, inspection_item_id, file_url, file_path,
          original_name, file_size, mime_type, width, height,
          thumbnail_path, compressed_path, category, description,
          tags, exif_data, uploaded_by, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;
      
      const values = [
        data.inspectionId,
        data.inspectionItemId,
        data.fileUrl,
        data.filePath,
        data.originalName,
        data.fileSize,
        data.mimeType,
        data.width,
        data.height,
        data.thumbnailPath,
        data.compressedPath,
        data.category || 'general',
        data.description,
        data.tags || [],
        data.exifData ? JSON.stringify(data.exifData) : null,
        userId,
        data.sortOrder || 0
      ];
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Find photo by ID with access control
  async findById(id: string, shopId: string): Promise<InspectionPhoto | null> {
    const query = `
      SELECT p.*, u.first_name || ' ' || u.last_name as uploader_name
      FROM inspection_photos p
      JOIN inspections i ON p.inspection_id = i.id
      JOIN users u ON p.uploaded_by = u.id
      WHERE p.id = $1 AND i.shop_id = $2 AND p.status = 'active'
    `;
    
    const result = await this.query(query, [id, shopId]);
    return result.rows[0] || null;
  }
  
  // Find all photos for an inspection
  async findByInspectionId(inspectionId: string, shopId: string): Promise<InspectionPhoto[]> {
    const query = `
      SELECT p.*, u.first_name || ' ' || u.last_name as uploader_name
      FROM inspection_photos p
      JOIN inspections i ON p.inspection_id = i.id
      JOIN users u ON p.uploaded_by = u.id
      WHERE p.inspection_id = $1 AND i.shop_id = $2 AND p.status = 'active'
      ORDER BY p.sort_order, p.created_at
    `;
    
    const result = await this.query(query, [inspectionId, shopId]);
    return result.rows;
  }
  
  // Find photos for a specific inspection item
  async findByInspectionItemId(inspectionItemId: string, shopId: string): Promise<InspectionPhoto[]> {
    const query = `
      SELECT p.*, u.first_name || ' ' || u.last_name as uploader_name
      FROM inspection_photos p
      JOIN inspection_items ii ON p.inspection_item_id = ii.id
      JOIN inspections i ON ii.inspection_id = i.id
      JOIN users u ON p.uploaded_by = u.id
      WHERE p.inspection_item_id = $1 AND i.shop_id = $2 AND p.status = 'active'
      ORDER BY p.sort_order, p.created_at
    `;
    
    const result = await this.query(query, [inspectionItemId, shopId]);
    return result.rows;
  }
  
  // Find photos by category
  async findByCategory(
    inspectionId: string, 
    category: string, 
    shopId: string
  ): Promise<InspectionPhoto[]> {
    const query = `
      SELECT p.*, u.first_name || ' ' || u.last_name as uploader_name
      FROM inspection_photos p
      JOIN inspections i ON p.inspection_id = i.id
      JOIN users u ON p.uploaded_by = u.id
      WHERE p.inspection_id = $1 AND p.category = $2 AND i.shop_id = $3 AND p.status = 'active'
      ORDER BY p.sort_order, p.created_at
    `;
    
    const result = await this.query(query, [inspectionId, category, shopId]);
    return result.rows;
  }
  
  // Update photo metadata
  async update(
    id: string, 
    data: PhotoUpdateRequest, 
    shopId: string
  ): Promise<InspectionPhoto | null> {
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verify photo exists and belongs to shop
      const photoCheck = await client.query(`
        SELECT p.id 
        FROM inspection_photos p
        JOIN inspections i ON p.inspection_id = i.id
        WHERE p.id = $1 AND i.shop_id = $2
      `, [id, shopId]);
      
      if (photoCheck.rows.length === 0) {
        throw new Error('Photo not found or access denied');
      }
      
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 0;
      
      // Build dynamic update fields
      const updateFields = {
        category: data.category,
        description: data.description,
        tags: data.tags,
        sort_order: data.sortOrder,
        status: data.status
      };
      
      Object.entries(updateFields).forEach(([key, value]) => {
        if (value !== undefined) {
          paramCount++;
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
        }
      });
      
      if (updates.length === 0) {
        throw new Error('No valid update fields provided');
      }
      
      updates.push('updated_at = NOW()');
      
      paramCount++;
      values.push(id);
      
      const query = `
        UPDATE inspection_photos 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      return result.rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Soft delete photo (mark as deleted)
  async delete(id: string, shopId: string): Promise<boolean> {
    const query = `
      UPDATE inspection_photos p
      SET status = 'deleted', updated_at = NOW()
      FROM inspections i
      WHERE p.inspection_id = i.id AND p.id = $1 AND i.shop_id = $2
    `;
    
    const result = await this.query(query, [id, shopId]);
    return result.rowCount > 0;
  }
  
  // Hard delete photo (remove from database)
  async hardDelete(id: string, shopId: string): Promise<InspectionPhoto | null> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get photo info before deletion for cleanup
      const photoQuery = `
        SELECT p.file_path, p.thumbnail_path, p.compressed_path
        FROM inspection_photos p
        JOIN inspections i ON p.inspection_id = i.id
        WHERE p.id = $1 AND i.shop_id = $2
      `;
      
      const photoResult = await client.query(photoQuery, [id, shopId]);
      
      if (photoResult.rows.length === 0) {
        return null;
      }
      
      const photo = photoResult.rows[0];
      
      // Delete from database
      const deleteQuery = `
        DELETE FROM inspection_photos p
        USING inspections i
        WHERE p.inspection_id = i.id AND p.id = $1 AND i.shop_id = $2
        RETURNING p.*
      `;
      
      const deleteResult = await client.query(deleteQuery, [id, shopId]);
      await client.query('COMMIT');
      
      return { ...deleteResult.rows[0], ...photo };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Update sort order for multiple photos
  async updateSortOrder(updates: { id: string; sortOrder: number }[], shopId: string): Promise<boolean> {
    if (updates.length === 0) {
      return true;
    }
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const update of updates) {
        const query = `
          UPDATE inspection_photos p
          SET sort_order = $2, updated_at = NOW()
          FROM inspections i
          WHERE p.inspection_id = i.id AND p.id = $1 AND i.shop_id = $3
        `;
        
        await client.query(query, [update.id, update.sortOrder, shopId]);
      }
      
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get photo statistics
  async getStatistics(inspectionId: string, shopId: string): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_photos,
        COUNT(CASE WHEN category = 'before' THEN 1 END) as before_photos,
        COUNT(CASE WHEN category = 'after' THEN 1 END) as after_photos,
        COUNT(CASE WHEN category = 'damage' THEN 1 END) as damage_photos,
        COUNT(CASE WHEN category = 'general' THEN 1 END) as general_photos,
        SUM(file_size) as total_file_size,
        AVG(file_size) as avg_file_size,
        COUNT(CASE WHEN thumbnail_path IS NOT NULL THEN 1 END) as photos_with_thumbnails
      FROM inspection_photos p
      JOIN inspections i ON p.inspection_id = i.id
      WHERE p.inspection_id = $1 AND i.shop_id = $2 AND p.status = 'active'
    `;
    
    const result = await this.query(query, [inspectionId, shopId]);
    return result.rows[0];
  }
  
  // Find orphaned photos (not linked to any inspection item)
  async findOrphaned(shopId: string): Promise<InspectionPhoto[]> {
    const query = `
      SELECT p.*
      FROM inspection_photos p
      JOIN inspections i ON p.inspection_id = i.id
      WHERE i.shop_id = $1 
        AND p.inspection_item_id IS NULL
        AND p.category = 'general'
        AND p.status = 'active'
        AND p.created_at < NOW() - INTERVAL '1 hour'
      ORDER BY p.created_at DESC
    `;
    
    const result = await this.query(query, [shopId]);
    return result.rows;
  }
  
  // Find photos needing processing (thumbnail generation, compression)
  async findNeedingProcessing(limit: number = 50): Promise<InspectionPhoto[]> {
    const query = `
      SELECT p.*
      FROM inspection_photos p
      WHERE p.status = 'processing' 
        OR (p.status = 'active' AND (p.thumbnail_path IS NULL OR p.compressed_path IS NULL))
      ORDER BY p.created_at
      LIMIT $1
    `;
    
    const result = await this.query(query, [limit]);
    return result.rows;
  }
  
  // Update processing status and paths
  async updateProcessingResults(
    id: string,
    thumbnailPath?: string,
    compressedPath?: string,
    width?: number,
    height?: number
  ): Promise<boolean> {
    
    const updates: string[] = ['status = $1', 'updated_at = NOW()'];
    const values: any[] = ['active'];
    let paramCount = 1;
    
    if (thumbnailPath) {
      paramCount++;
      updates.push(`thumbnail_path = $${paramCount}`);
      values.push(thumbnailPath);
    }
    
    if (compressedPath) {
      paramCount++;
      updates.push(`compressed_path = $${paramCount}`);
      values.push(compressedPath);
    }
    
    if (width) {
      paramCount++;
      updates.push(`width = $${paramCount}`);
      values.push(width);
    }
    
    if (height) {
      paramCount++;
      updates.push(`height = $${paramCount}`);
      values.push(height);
    }
    
    paramCount++;
    values.push(id);
    
    const query = `
      UPDATE inspection_photos 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
    `;
    
    const result = await this.query(query, values);
    return result.rowCount > 0;
  }
  
  // Get photos by file size for cleanup
  async findByFileSize(minSize: number, maxSize: number): Promise<InspectionPhoto[]> {
    const query = `
      SELECT p.*, i.shop_id
      FROM inspection_photos p
      JOIN inspections i ON p.inspection_id = i.id
      WHERE p.file_size BETWEEN $1 AND $2
        AND p.status = 'active'
      ORDER BY p.file_size DESC
    `;
    
    const result = await this.query(query, [minSize, maxSize]);
    return result.rows;
  }
  
  // Find photos older than specified days
  async findOlderThan(days: number): Promise<InspectionPhoto[]> {
    const query = `
      SELECT p.*, i.shop_id
      FROM inspection_photos p
      JOIN inspections i ON p.inspection_id = i.id
      WHERE p.created_at < NOW() - INTERVAL '${days} days'
        AND p.status = 'active'
      ORDER BY p.created_at
    `;
    
    const result = await this.query(query);
    return result.rows;
  }
}