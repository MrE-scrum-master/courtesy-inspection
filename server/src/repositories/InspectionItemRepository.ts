// Inspection Item Repository for PostgreSQL
// Repository pattern for individual inspection findings and items
// Includes condition tracking, measurements, and voice notes

import { BaseRepository } from './BaseRepository';
import { QueryResult } from 'pg';

export interface InspectionItem {
  id: string;
  inspection_id: string;
  category: string;
  component: string;
  condition: 'good' | 'fair' | 'poor' | 'needs_immediate';
  notes?: string;
  measurements?: Record<string, any>;
  recommendations?: string;
  estimated_cost?: number;
  priority: number;
  voice_notes?: string[];
  photo_ids?: string[];
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface InspectionItemCreateRequest {
  category: string;
  component: string;
  condition?: 'good' | 'fair' | 'poor' | 'needs_immediate';
  notes?: string;
  measurements?: Record<string, any>;
  recommendations?: string;
  estimatedCost?: number;
  priority?: number;
  sortOrder?: number;
}

export interface InspectionItemUpdateRequest {
  condition?: 'good' | 'fair' | 'poor' | 'needs_immediate';
  notes?: string;
  measurements?: Record<string, any>;
  recommendations?: string;
  estimatedCost?: number;
  priority?: number;
  voiceNotes?: string[];
  photoIds?: string[];
  sortOrder?: number;
}

export class InspectionItemRepository extends BaseRepository {
  
  // Create new inspection item
  async create(
    inspectionId: string, 
    data: InspectionItemCreateRequest, 
    shopId: string
  ): Promise<InspectionItem> {
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verify inspection exists and belongs to shop
      const inspectionCheck = await client.query(
        'SELECT id FROM inspections WHERE id = $1 AND shop_id = $2',
        [inspectionId, shopId]
      );
      
      if (inspectionCheck.rows.length === 0) {
        throw new Error('Inspection not found or access denied');
      }
      
      const query = `
        INSERT INTO inspection_items (
          inspection_id, category, component, condition,
          notes, measurements, recommendations, estimated_cost,
          priority, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const values = [
        inspectionId,
        data.category,
        data.component,
        data.condition || 'good',
        data.notes,
        data.measurements ? JSON.stringify(data.measurements) : null,
        data.recommendations,
        data.estimatedCost,
        data.priority || 1,
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
  
  // Find all items for an inspection
  async findByInspectionId(inspectionId: string, shopId: string): Promise<InspectionItem[]> {
    const query = `
      SELECT ii.*
      FROM inspection_items ii
      JOIN inspections i ON ii.inspection_id = i.id
      WHERE ii.inspection_id = $1 AND i.shop_id = $2
      ORDER BY ii.sort_order, ii.category, ii.component
    `;
    
    const result = await this.query(query, [inspectionId, shopId]);
    return result.rows;
  }
  
  // Find items by condition (for critical/poor items)
  async findByCondition(
    inspectionId: string, 
    condition: string, 
    shopId: string
  ): Promise<InspectionItem[]> {
    const query = `
      SELECT ii.*
      FROM inspection_items ii
      JOIN inspections i ON ii.inspection_id = i.id
      WHERE ii.inspection_id = $1 AND ii.condition = $2 AND i.shop_id = $3
      ORDER BY ii.priority DESC, ii.sort_order
    `;
    
    const result = await this.query(query, [inspectionId, condition, shopId]);
    return result.rows;
  }
  
  // Find items by category
  async findByCategory(
    inspectionId: string, 
    category: string, 
    shopId: string
  ): Promise<InspectionItem[]> {
    const query = `
      SELECT ii.*
      FROM inspection_items ii
      JOIN inspections i ON ii.inspection_id = i.id
      WHERE ii.inspection_id = $1 AND ii.category = $2 AND i.shop_id = $3
      ORDER BY ii.sort_order, ii.component
    `;
    
    const result = await this.query(query, [inspectionId, category, shopId]);
    return result.rows;
  }
  
  // Update inspection item
  async update(
    id: string, 
    data: InspectionItemUpdateRequest, 
    shopId: string
  ): Promise<InspectionItem | null> {
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verify item exists and belongs to shop
      const itemCheck = await client.query(`
        SELECT ii.id 
        FROM inspection_items ii
        JOIN inspections i ON ii.inspection_id = i.id
        WHERE ii.id = $1 AND i.shop_id = $2
      `, [id, shopId]);
      
      if (itemCheck.rows.length === 0) {
        throw new Error('Inspection item not found or access denied');
      }
      
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 0;
      
      // Build dynamic update fields
      const updateFields = {
        condition: data.condition,
        notes: data.notes,
        measurements: data.measurements ? JSON.stringify(data.measurements) : undefined,
        recommendations: data.recommendations,
        estimated_cost: data.estimatedCost,
        priority: data.priority,
        voice_notes: data.voiceNotes ? `ARRAY[${data.voiceNotes.map(() => '?').join(',')}]` : undefined,
        photo_ids: data.photoIds ? `ARRAY[${data.photoIds.map(() => '?').join(',')}]::UUID[]` : undefined,
        sort_order: data.sortOrder
      };
      
      Object.entries(updateFields).forEach(([key, value]) => {
        if (value !== undefined) {
          paramCount++;
          updates.push(`${key} = $${paramCount}`);
          
          if (key === 'voice_notes' && data.voiceNotes) {
            values.push(data.voiceNotes);
          } else if (key === 'photo_ids' && data.photoIds) {
            values.push(data.photoIds);
          } else {
            values.push(value);
          }
        }
      });
      
      if (updates.length === 0) {
        throw new Error('No valid update fields provided');
      }
      
      updates.push('updated_at = NOW()');
      
      paramCount++;
      values.push(id);
      
      const query = `
        UPDATE inspection_items 
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
  
  // Delete inspection item
  async delete(id: string, shopId: string): Promise<boolean> {
    const query = `
      DELETE FROM inspection_items ii
      USING inspections i
      WHERE ii.inspection_id = i.id AND ii.id = $1 AND i.shop_id = $2
    `;
    
    const result = await this.query(query, [id, shopId]);
    return result.rowCount > 0;
  }
  
  // Add voice note to item
  async addVoiceNote(id: string, voiceNote: string, shopId: string): Promise<boolean> {
    const query = `
      UPDATE inspection_items ii
      SET voice_notes = COALESCE(voice_notes, ARRAY[]::TEXT[]) || ARRAY[$2],
          updated_at = NOW()
      FROM inspections i
      WHERE ii.inspection_id = i.id AND ii.id = $1 AND i.shop_id = $3
    `;
    
    const result = await this.query(query, [id, voiceNote, shopId]);
    return result.rowCount > 0;
  }
  
  // Add photo to item
  async addPhoto(id: string, photoId: string, shopId: string): Promise<boolean> {
    const query = `
      UPDATE inspection_items ii
      SET photo_ids = COALESCE(photo_ids, ARRAY[]::UUID[]) || ARRAY[$2::UUID],
          updated_at = NOW()
      FROM inspections i
      WHERE ii.inspection_id = i.id AND ii.id = $1 AND i.shop_id = $3
    `;
    
    const result = await this.query(query, [id, photoId, shopId]);
    return result.rowCount > 0;
  }
  
  // Remove photo from item
  async removePhoto(id: string, photoId: string, shopId: string): Promise<boolean> {
    const query = `
      UPDATE inspection_items ii
      SET photo_ids = array_remove(COALESCE(photo_ids, ARRAY[]::UUID[]), $2::UUID),
          updated_at = NOW()
      FROM inspections i
      WHERE ii.inspection_id = i.id AND ii.id = $1 AND i.shop_id = $3
    `;
    
    const result = await this.query(query, [id, photoId, shopId]);
    return result.rowCount > 0;
  }
  
  // Get item statistics for inspection
  async getInspectionStatistics(inspectionId: string, shopId: string): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN condition = 'good' THEN 1 END) as good_items,
        COUNT(CASE WHEN condition = 'fair' THEN 1 END) as fair_items,
        COUNT(CASE WHEN condition = 'poor' THEN 1 END) as poor_items,
        COUNT(CASE WHEN condition = 'needs_immediate' THEN 1 END) as critical_items,
        SUM(estimated_cost) as total_estimated_cost,
        COUNT(CASE WHEN array_length(voice_notes, 1) > 0 THEN 1 END) as items_with_voice_notes,
        COUNT(CASE WHEN array_length(photo_ids, 1) > 0 THEN 1 END) as items_with_photos
      FROM inspection_items ii
      JOIN inspections i ON ii.inspection_id = i.id
      WHERE ii.inspection_id = $1 AND i.shop_id = $2
    `;
    
    const result = await this.query(query, [inspectionId, shopId]);
    return result.rows[0];
  }
  
  // Get items requiring attention across all inspections in shop
  async getCriticalItemsByShop(shopId: string, limit: number = 50): Promise<any[]> {
    const query = `
      SELECT 
        ii.*,
        i.id as inspection_id,
        i.workflow_state,
        c.first_name || ' ' || c.last_name as customer_name,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_info
      FROM inspection_items ii
      JOIN inspections i ON ii.inspection_id = i.id
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      WHERE i.shop_id = $1 
        AND ii.condition IN ('poor', 'needs_immediate')
        AND i.workflow_state NOT IN ('completed', 'rejected')
        AND i.deleted_at IS NULL
      ORDER BY 
        CASE ii.condition 
          WHEN 'needs_immediate' THEN 1
          WHEN 'poor' THEN 2
          ELSE 3
        END,
        ii.priority DESC,
        i.created_at DESC
      LIMIT $2
    `;
    
    const result = await this.query(query, [shopId, limit]);
    return result.rows;
  }
  
  // Bulk create items (for predefined checklist)
  async createBulk(
    inspectionId: string, 
    items: InspectionItemCreateRequest[], 
    shopId: string
  ): Promise<InspectionItem[]> {
    
    if (items.length === 0) {
      return [];
    }
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verify inspection exists and belongs to shop
      const inspectionCheck = await client.query(
        'SELECT id FROM inspections WHERE id = $1 AND shop_id = $2',
        [inspectionId, shopId]
      );
      
      if (inspectionCheck.rows.length === 0) {
        throw new Error('Inspection not found or access denied');
      }
      
      const results: InspectionItem[] = [];
      
      for (const item of items) {
        const query = `
          INSERT INTO inspection_items (
            inspection_id, category, component, condition,
            notes, measurements, recommendations, estimated_cost,
            priority, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `;
        
        const values = [
          inspectionId,
          item.category,
          item.component,
          item.condition || 'good',
          item.notes,
          item.measurements ? JSON.stringify(item.measurements) : null,
          item.recommendations,
          item.estimatedCost,
          item.priority || 1,
          item.sortOrder || 0
        ];
        
        const result = await client.query(query, values);
        results.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Update sort order for multiple items
  async updateSortOrder(updates: { id: string; sortOrder: number }[], shopId: string): Promise<boolean> {
    if (updates.length === 0) {
      return true;
    }
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const update of updates) {
        const query = `
          UPDATE inspection_items ii
          SET sort_order = $2, updated_at = NOW()
          FROM inspections i
          WHERE ii.inspection_id = i.id AND ii.id = $1 AND i.shop_id = $3
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
}