// Enhanced Inspection Repository for PostgreSQL
// Repository pattern with comprehensive inspection data access
// Includes multi-tenant security, workflow management, and audit trails

import { BaseRepository } from './BaseRepository';
import { Inspection, Customer, Vehicle, User } from '../types/entities';
import { InspectionCreateRequest, InspectionUpdateRequest, PaginationOptions, InspectionFilters } from '../types/dtos';
import { QueryResult } from 'pg';

interface InspectionWithDetails extends Inspection {
  customer_name?: string;
  customer_phone?: string;
  vehicle_info?: string;
  technician_name?: string;
  total_items?: number;
  critical_items?: number;
  poor_items?: number;
}

export class InspectionRepository extends BaseRepository {
  
  // Create new inspection with workflow initialization
  async create(data: InspectionCreateRequest, userId: string, shopId: string): Promise<Inspection> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Set context for RLS and triggers
      await client.query('SELECT set_config($1, $2, true)', ['app.current_shop_id', shopId]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_role', data.userRole || 'mechanic']);
      
      const query = `
        INSERT INTO inspections (
          shop_id, vehicle_id, created_by, assigned_to,
          workflow_state, customer_concerns, odometer_reading,
          internal_notes, started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const values = [
        shopId,
        data.vehicleId,
        userId,
        data.assignedTo || userId,
        'draft',
        JSON.stringify(data.customerConcerns || []),
        data.odometerReading,
        data.internalNotes,
        new Date()
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
  
  // Find inspection by ID with full details
  async findById(id: string, shopId: string): Promise<InspectionWithDetails | null> {
    const query = `
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
        v.vin, v.license_plate, v.mileage,
        u.first_name || ' ' || u.last_name as technician_name,
        assigned_user.first_name || ' ' || assigned_user.last_name as assigned_technician_name,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id
        ) as total_items,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition = 'needs_immediate'
        ) as critical_items,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition = 'poor'
        ) as poor_items
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      LEFT JOIN users assigned_user ON i.assigned_to = assigned_user.id
      WHERE i.id = $1 AND i.shop_id = $2 AND i.deleted_at IS NULL
    `;
    
    const result = await this.query(query, [id, shopId]);
    return result.rows[0] || null;
  }
  
  // Find inspections with comprehensive filtering and pagination
  async findByShop(
    shopId: string, 
    filters: InspectionFilters = {}, 
    pagination: PaginationOptions = {}
  ): Promise<{ inspections: InspectionWithDetails[], total: number }> {
    
    const { page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC' } = pagination;
    const offset = (page - 1) * limit;
    
    let whereConditions = ['i.shop_id = $1', 'i.deleted_at IS NULL'];
    let values = [shopId];
    let paramCount = 1;
    
    // Apply filters
    if (filters.workflowState) {
      paramCount++;
      whereConditions.push(`i.workflow_state = $${paramCount}`);
      values.push(filters.workflowState);
    }
    
    if (filters.assignedTo) {
      paramCount++;
      whereConditions.push(`i.assigned_to = $${paramCount}`);
      values.push(filters.assignedTo);
    }
    
    if (filters.urgencyLevel) {
      paramCount++;
      whereConditions.push(`i.urgency_level = $${paramCount}`);
      values.push(filters.urgencyLevel);
    }
    
    if (filters.dateFrom) {
      paramCount++;
      whereConditions.push(`i.created_at >= $${paramCount}`);
      values.push(filters.dateFrom);
    }
    
    if (filters.dateTo) {
      paramCount++;
      whereConditions.push(`i.created_at <= $${paramCount}`);
      values.push(filters.dateTo);
    }
    
    if (filters.customerId) {
      paramCount++;
      whereConditions.push(`c.id = $${paramCount}`);
      values.push(filters.customerId);
    }
    
    if (filters.vehicleId) {
      paramCount++;
      whereConditions.push(`v.id = $${paramCount}`);
      values.push(filters.vehicleId);
    }
    
    if (filters.searchTerm) {
      paramCount++;
      whereConditions.push(`(
        c.first_name ILIKE $${paramCount} OR 
        c.last_name ILIKE $${paramCount} OR 
        v.make ILIKE $${paramCount} OR 
        v.model ILIKE $${paramCount} OR 
        v.vin ILIKE $${paramCount} OR 
        v.license_plate ILIKE $${paramCount}
      )`);
      values.push(`%${filters.searchTerm}%`);
    }
    
    // Build main query
    const baseQuery = `
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      LEFT JOIN users assigned_user ON i.assigned_to = assigned_user.id
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await this.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    const dataQuery = `
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone as customer_phone,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
        v.license_plate,
        u.first_name || ' ' || u.last_name as technician_name,
        assigned_user.first_name || ' ' || assigned_user.last_name as assigned_technician_name,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id
        ) as total_items,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition = 'needs_immediate'
        ) as critical_items
      ${baseQuery}
      ORDER BY i.${sortBy} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    values.push(limit, offset);
    const dataResult = await this.query(dataQuery, values);
    
    return {
      inspections: dataResult.rows,
      total
    };
  }
  
  // Update inspection with optimistic locking and audit trail
  async update(
    id: string, 
    data: InspectionUpdateRequest, 
    userId: string, 
    shopId: string,
    expectedVersion?: number
  ): Promise<InspectionWithDetails | null> {
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Set context for triggers
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_shop_id', shopId]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_role', data.userRole || 'mechanic']);
      
      // Check optimistic locking if version provided
      if (expectedVersion !== undefined) {
        const versionCheck = await client.query(
          'SELECT version FROM inspections WHERE id = $1 AND shop_id = $2',
          [id, shopId]
        );
        
        if (versionCheck.rows.length === 0) {
          throw new Error('Inspection not found');
        }
        
        if (versionCheck.rows[0].version !== expectedVersion) {
          throw new Error('Inspection was modified by another user. Please refresh and try again.');
        }
      }
      
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 0;
      
      // Build dynamic update fields
      const updateFields = {
        workflow_state: data.workflowState,
        assigned_to: data.assignedTo,
        customer_concerns: data.customerConcerns ? JSON.stringify(data.customerConcerns) : undefined,
        odometer_reading: data.odometerReading,
        internal_notes: data.internalNotes,
        completed_at: data.completedAt,
        urgency_level: data.urgencyLevel,
        estimated_cost: data.estimatedCost,
        next_service_date: data.nextServiceDate,
        warranty_info: data.warrantyInfo ? JSON.stringify(data.warrantyInfo) : undefined
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
      
      // Increment version for optimistic locking
      paramCount++;
      updates.push(`version = version + 1`);
      updates.push(`updated_at = NOW()`);
      
      paramCount++;
      values.push(id);
      paramCount++;
      values.push(shopId);
      
      const query = `
        UPDATE inspections 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount - 1} AND shop_id = $${paramCount}
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Return full inspection details
      return await this.findById(id, shopId);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Soft delete inspection
  async delete(id: string, userId: string, shopId: string): Promise<boolean> {
    const query = `
      UPDATE inspections 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL
    `;
    const result = await this.query(query, [id, shopId]);
    return result.rowCount > 0;
  }
  
  // Find inspections by customer with history
  async findByCustomer(customerId: string, shopId: string): Promise<InspectionWithDetails[]> {
    const query = `
      SELECT 
        i.*,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
        v.license_plate,
        u.first_name || ' ' || u.last_name as technician_name,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition IN ('poor', 'needs_immediate')
        ) as critical_items
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN users u ON i.created_by = u.id
      WHERE v.customer_id = $1 AND i.shop_id = $2 AND i.deleted_at IS NULL
      ORDER BY i.created_at DESC
    `;
    
    const result = await this.query(query, [customerId, shopId]);
    return result.rows;
  }
  
  // Find inspections by vehicle with maintenance history
  async findByVehicle(vehicleId: string, shopId: string): Promise<InspectionWithDetails[]> {
    const query = `
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone as customer_phone,
        u.first_name || ' ' || u.last_name as technician_name,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition IN ('poor', 'needs_immediate')
        ) as critical_items
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      WHERE i.vehicle_id = $1 AND i.shop_id = $2 AND i.deleted_at IS NULL
      ORDER BY i.created_at DESC
    `;
    
    const result = await this.query(query, [vehicleId, shopId]);
    return result.rows;
  }
  
  // Get inspection statistics for dashboard
  async getStatistics(shopId: string, dateFrom?: Date, dateTo?: Date): Promise<any> {
    let whereClause = 'WHERE i.shop_id = $1 AND i.deleted_at IS NULL';
    const values = [shopId];
    let paramCount = 1;
    
    if (dateFrom) {
      paramCount++;
      whereClause += ` AND i.created_at >= $${paramCount}`;
      values.push(dateFrom);
    }
    
    if (dateTo) {
      paramCount++;
      whereClause += ` AND i.created_at <= $${paramCount}`;
      values.push(dateTo);
    }
    
    const query = `
      SELECT 
        COUNT(*) as total_inspections,
        COUNT(CASE WHEN i.workflow_state = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN i.workflow_state = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN i.workflow_state = 'pending_review' THEN 1 END) as pending_review_count,
        COUNT(CASE WHEN i.workflow_state = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN i.workflow_state = 'sent_to_customer' THEN 1 END) as sent_count,
        COUNT(CASE WHEN i.workflow_state = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN i.urgency_level = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN i.urgency_level = 'high' THEN 1 END) as high_urgency_count,
        AVG(i.inspection_duration) as avg_duration_minutes,
        SUM(i.estimated_cost) as total_estimated_value
      FROM inspections i
      ${whereClause}
    `;
    
    const result = await this.query(query, values);
    return result.rows[0];
  }
  
  // Get inspections requiring attention (overdue, critical, etc.)
  async getRequiringAttention(shopId: string): Promise<InspectionWithDetails[]> {
    const query = `
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone as customer_phone,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
        u.first_name || ' ' || u.last_name as technician_name,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition = 'needs_immediate'
        ) as critical_items
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      WHERE i.shop_id = $1 
        AND i.deleted_at IS NULL
        AND (
          i.urgency_level IN ('critical', 'high') OR
          (i.workflow_state = 'in_progress' AND i.started_at < NOW() - INTERVAL '2 hours') OR
          (i.workflow_state = 'pending_review' AND i.state_changed_at < NOW() - INTERVAL '24 hours')
        )
      ORDER BY 
        CASE i.urgency_level 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          ELSE 4
        END,
        i.created_at ASC
    `;
    
    const result = await this.query(query, [shopId]);
    return result.rows;
  }

  // Find inspections by mechanic with filters
  async findByMechanic(
    mechanicId: string, 
    shopId: string, 
    filters: { 
      states?: string[], 
      dateFrom?: Date, 
      dateTo?: Date,
      urgencyLevel?: string 
    } = {},
    pagination: PaginationOptions = {}
  ): Promise<{ inspections: InspectionWithDetails[], total: number }> {
    
    const { page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC' } = pagination;
    const offset = (page - 1) * limit;
    
    let whereConditions = [
      'i.shop_id = $1', 
      '(i.assigned_to = $2 OR i.created_by = $2)', 
      'i.deleted_at IS NULL'
    ];
    let values = [shopId, mechanicId];
    let paramCount = 2;
    
    // Apply filters
    if (filters.states && filters.states.length > 0) {
      paramCount++;
      const statePlaceholders = filters.states.map((_, index) => `$${paramCount + index}`).join(', ');
      whereConditions.push(`i.workflow_state IN (${statePlaceholders})`);
      values.push(...filters.states);
      paramCount += filters.states.length - 1;
    }
    
    if (filters.dateFrom) {
      paramCount++;
      whereConditions.push(`i.created_at >= $${paramCount}`);
      values.push(filters.dateFrom);
    }
    
    if (filters.dateTo) {
      paramCount++;
      whereConditions.push(`i.created_at <= $${paramCount}`);
      values.push(filters.dateTo);
    }
    
    if (filters.urgencyLevel) {
      paramCount++;
      whereConditions.push(`i.urgency_level = $${paramCount}`);
      values.push(filters.urgencyLevel);
    }
    
    // Base query
    const baseQuery = `
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      LEFT JOIN users assigned_user ON i.assigned_to = assigned_user.id
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await this.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    const dataQuery = `
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone as customer_phone,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
        v.license_plate,
        u.first_name || ' ' || u.last_name as technician_name,
        assigned_user.first_name || ' ' || assigned_user.last_name as assigned_technician_name,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id
        ) as total_items,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition = 'needs_immediate'
        ) as critical_items
      ${baseQuery}
      ORDER BY i.${sortBy} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    values.push(limit, offset);
    const dataResult = await this.query(dataQuery, values);
    
    return {
      inspections: dataResult.rows,
      total
    };
  }

  // Find inspections by status with date range
  async findByStatus(
    status: string, 
    shopId: string, 
    dateRange?: { from: Date, to: Date },
    pagination: PaginationOptions = {}
  ): Promise<{ inspections: InspectionWithDetails[], total: number }> {
    
    const { page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC' } = pagination;
    const offset = (page - 1) * limit;
    
    let whereConditions = ['i.shop_id = $1', 'i.workflow_state = $2', 'i.deleted_at IS NULL'];
    let values = [shopId, status];
    let paramCount = 2;
    
    if (dateRange) {
      if (dateRange.from) {
        paramCount++;
        whereConditions.push(`i.created_at >= $${paramCount}`);
        values.push(dateRange.from);
      }
      if (dateRange.to) {
        paramCount++;
        whereConditions.push(`i.created_at <= $${paramCount}`);
        values.push(dateRange.to);
      }
    }
    
    const baseQuery = `
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      LEFT JOIN users assigned_user ON i.assigned_to = assigned_user.id
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await this.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    const dataQuery = `
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone as customer_phone,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
        v.license_plate,
        u.first_name || ' ' || u.last_name as technician_name,
        assigned_user.first_name || ' ' || assigned_user.last_name as assigned_technician_name,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id
        ) as total_items,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition = 'needs_immediate'
        ) as critical_items
      ${baseQuery}
      ORDER BY i.${sortBy} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    values.push(limit, offset);
    const dataResult = await this.query(dataQuery, values);
    
    return {
      inspections: dataResult.rows,
      total
    };
  }

  // Find inspections pending review for shop managers
  async findPendingReview(shopId: string): Promise<InspectionWithDetails[]> {
    const query = `
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone as customer_phone,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
        v.license_plate, v.vin,
        u.first_name || ' ' || u.last_name as technician_name,
        assigned_user.first_name || ' ' || assigned_user.last_name as assigned_technician_name,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id
        ) as total_items,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition = 'needs_immediate'
        ) as critical_items,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition = 'poor'
        ) as poor_items,
        EXTRACT(EPOCH FROM (NOW() - i.state_changed_at))/3600 as hours_in_review
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      LEFT JOIN users assigned_user ON i.assigned_to = assigned_user.id
      WHERE i.shop_id = $1 
        AND i.workflow_state = 'pending_review' 
        AND i.deleted_at IS NULL
      ORDER BY 
        CASE 
          WHEN i.urgency_level = 'critical' THEN 1
          WHEN i.urgency_level = 'high' THEN 2
          WHEN i.urgency_level = 'normal' THEN 3
          ELSE 4
        END,
        i.state_changed_at ASC
    `;
    
    const result = await this.query(query, [shopId]);
    return result.rows;
  }

  // Find inspection with full details (includes items, photos, customer, vehicle)
  async findWithFullDetails(inspectionId: string, shopId: string): Promise<any | null> {
    const query = `
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone as customer_phone,
        c.email as customer_email,
        c.preferred_contact_method,
        v.year || ' ' || v.make || ' ' || v.model as vehicle_info,
        v.vin, v.license_plate, v.mileage, v.color,
        u.first_name || ' ' || u.last_name as technician_name,
        u.email as technician_email,
        assigned_user.first_name || ' ' || assigned_user.last_name as assigned_technician_name,
        assigned_user.email as assigned_technician_email,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id
        ) as total_items,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition = 'needs_immediate'
        ) as critical_items,
        (
          SELECT COUNT(*) 
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id AND ii.condition = 'poor'
        ) as poor_items,
        (
          SELECT COUNT(*) 
          FROM inspection_photos ip 
          WHERE ip.inspection_id = i.id AND ip.status = 'active'
        ) as total_photos,
        (
          SELECT COUNT(*) 
          FROM inspection_voice_notes ivn 
          WHERE ivn.inspection_id = i.id
        ) as total_voice_notes,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', ii.id,
              'name', ii.name,
              'description', ii.description,
              'condition', ii.condition,
              'measurements', ii.measurements,
              'recommendations', ii.recommendations,
              'estimated_cost', ii.estimated_cost,
              'priority', ii.priority,
              'created_at', ii.created_at,
              'updated_at', ii.updated_at
            ) ORDER BY ii.priority, ii.created_at
          ), '[]'::json)
          FROM inspection_items ii 
          WHERE ii.inspection_id = i.id
        ) as inspection_items,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', ip.id,
              'inspection_item_id', ip.inspection_item_id,
              'file_url', ip.file_url,
              'file_path', ip.file_path,
              'original_name', ip.original_name,
              'file_size', ip.file_size,
              'mime_type', ip.mime_type,
              'width', ip.width,
              'height', ip.height,
              'thumbnail_path', ip.thumbnail_path,
              'category', ip.category,
              'description', ip.description,
              'tags', ip.tags,
              'created_at', ip.created_at
            ) ORDER BY ip.sort_order, ip.created_at
          ), '[]'::json)
          FROM inspection_photos ip 
          WHERE ip.inspection_id = i.id AND ip.status = 'active'
        ) as photos,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'id', ivn.id,
              'inspection_item_id', ivn.inspection_item_id,
              'original_text', ivn.original_text,
              'processed_data', ivn.processed_data,
              'confidence_score', ivn.confidence_score,
              'audio_duration', ivn.audio_duration,
              'processed_by', ivn.processed_by,
              'created_at', ivn.created_at
            ) ORDER BY ivn.created_at
          ), '[]'::json)
          FROM inspection_voice_notes ivn 
          WHERE ivn.inspection_id = i.id
        ) as voice_notes
      FROM inspections i
      JOIN vehicles v ON i.vehicle_id = v.id
      JOIN customers c ON v.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      LEFT JOIN users assigned_user ON i.assigned_to = assigned_user.id
      WHERE i.id = $1 AND i.shop_id = $2 AND i.deleted_at IS NULL
    `;
    
    const result = await this.query(query, [inspectionId, shopId]);
    return result.rows[0] || null;
  }

  // Get performance metrics for inspections
  async getPerformanceMetrics(shopId: string, days: number = 30): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_inspections,
        COUNT(CASE WHEN i.workflow_state = 'completed' THEN 1 END) as completed_inspections,
        ROUND(AVG(i.inspection_duration), 2) as avg_duration_minutes,
        ROUND(AVG(CASE WHEN i.workflow_state = 'completed' THEN i.inspection_duration END), 2) as avg_completed_duration,
        COUNT(CASE WHEN i.inspection_duration > 60 THEN 1 END) as over_hour_count,
        COUNT(CASE WHEN i.urgency_level = 'critical' THEN 1 END) as critical_urgency_count,
        ROUND(
          (COUNT(CASE WHEN i.workflow_state = 'completed' THEN 1 END) * 100.0 / 
           NULLIF(COUNT(CASE WHEN i.workflow_state != 'draft' THEN 1 END), 0)), 2
        ) as completion_rate,
        ROUND(AVG(
          CASE 
            WHEN i.workflow_state = 'completed' AND i.created_at IS NOT NULL AND i.completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (i.completed_at - i.created_at))/3600 
          END
        ), 2) as avg_total_completion_hours
      FROM inspections i
      WHERE i.shop_id = $1 
        AND i.created_at >= NOW() - INTERVAL '${days} days'
        AND i.deleted_at IS NULL
    `;
    
    const result = await this.query(query, [shopId]);
    return result.rows[0];
  }
}