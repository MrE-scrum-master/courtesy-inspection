import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';

export interface Communication {
  id: number;
  shop_id: number;
  customer_id: number | null;
  inspection_id: number | null;
  user_id: number | null;
  communication_type: 'sms' | 'email' | 'phone' | 'in_person';
  direction: 'outbound' | 'inbound';
  subject: string | null;
  content: string;
  status: 'sent' | 'delivered' | 'failed' | 'read';
  scheduled_at: Date | null;
  sent_at: Date;
  delivered_at: Date | null;
  metadata: any;
}

export interface CustomerPreference {
  id: number;
  customer_id: number;
  sms_enabled: boolean;
  email_enabled: boolean;
  preferred_time_start: string;
  preferred_time_end: string;
  timezone: string;
  language: string;
  opt_out_date: Date | null;
  opt_out_reason: string | null;
  updated_at: Date;
}

export interface CreateCommunicationData {
  shop_id: number;
  customer_id?: number;
  inspection_id?: number;
  user_id?: number;
  communication_type: 'sms' | 'email' | 'phone' | 'in_person';
  direction: 'outbound' | 'inbound';
  subject?: string;
  content: string;
  status?: 'sent' | 'delivered' | 'failed' | 'read';
  scheduled_at?: Date;
  metadata?: any;
}

export interface CommunicationStats {
  total_communications: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  response_rate: number;
  average_response_time: number; // in minutes
}

export class CommunicationRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async createCommunication(data: CreateCommunicationData): Promise<Communication> {
    const query = `
      INSERT INTO communications (
        shop_id, customer_id, inspection_id, user_id, communication_type,
        direction, subject, content, status, scheduled_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      data.shop_id,
      data.customer_id || null,
      data.inspection_id || null,
      data.user_id || null,
      data.communication_type,
      data.direction,
      data.subject || null,
      data.content,
      data.status || 'sent',
      data.scheduled_at || null,
      JSON.stringify(data.metadata || {}),
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getCommunicationById(id: number): Promise<Communication | null> {
    const query = 'SELECT * FROM communications WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getCustomerCommunications(customerId: number, limit: number = 50): Promise<Communication[]> {
    const query = `
      SELECT * FROM communications 
      WHERE customer_id = $1 
      ORDER BY sent_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [customerId, limit]);
    return result.rows;
  }

  async getInspectionCommunications(inspectionId: number): Promise<Communication[]> {
    const query = `
      SELECT * FROM communications 
      WHERE inspection_id = $1 
      ORDER BY sent_at DESC
    `;
    const result = await this.pool.query(query, [inspectionId]);
    return result.rows;
  }

  async getShopCommunications(
    shopId: number,
    type?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<Communication[]> {
    let query = `
      SELECT c.*, cu.name as customer_name, u.full_name as user_name
      FROM communications c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.shop_id = $1
    `;
    const values: any[] = [shopId];
    let paramCount = 2;

    if (type) {
      query += ` AND c.communication_type = $${paramCount}`;
      values.push(type);
      paramCount++;
    }

    if (startDate) {
      query += ` AND c.sent_at >= $${paramCount}`;
      values.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND c.sent_at <= $${paramCount}`;
      values.push(endDate);
      paramCount++;
    }

    query += ` ORDER BY c.sent_at DESC LIMIT $${paramCount}`;
    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async updateCommunicationStatus(
    id: number,
    status: 'sent' | 'delivered' | 'failed' | 'read',
    deliveredAt?: Date
  ): Promise<Communication | null> {
    const query = `
      UPDATE communications 
      SET status = $1, delivered_at = $2
      WHERE id = $3
      RETURNING *
    `;

    const result = await this.pool.query(query, [status, deliveredAt || null, id]);
    return result.rows[0] || null;
  }

  async getScheduledCommunications(beforeDate: Date): Promise<Communication[]> {
    const query = `
      SELECT * FROM communications 
      WHERE scheduled_at IS NOT NULL 
      AND scheduled_at <= $1 
      AND status = 'sent'
      ORDER BY scheduled_at ASC
    `;
    const result = await this.pool.query(query, [beforeDate]);
    return result.rows;
  }

  async getCommunicationStats(
    shopId: number,
    startDate: Date,
    endDate: Date
  ): Promise<CommunicationStats> {
    // Get basic stats
    const basicQuery = `
      SELECT 
        COUNT(*) as total_communications,
        communication_type,
        status,
        COUNT(*) as count
      FROM communications 
      WHERE shop_id = $1 
      AND sent_at BETWEEN $2 AND $3
      GROUP BY communication_type, status
    `;

    const basicResult = await this.pool.query(basicQuery, [shopId, startDate, endDate]);

    // Calculate totals and groupings
    let totalCommunications = 0;
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const row of basicResult.rows) {
      totalCommunications += parseInt(row.count);
      
      byType[row.communication_type] = (byType[row.communication_type] || 0) + parseInt(row.count);
      byStatus[row.status] = (byStatus[row.status] || 0) + parseInt(row.count);
    }

    // Calculate response rate (for inbound vs outbound)
    const responseQuery = `
      SELECT 
        direction,
        COUNT(*) as count
      FROM communications 
      WHERE shop_id = $1 
      AND sent_at BETWEEN $2 AND $3
      AND communication_type IN ('sms', 'email')
      GROUP BY direction
    `;

    const responseResult = await this.pool.query(responseQuery, [shopId, startDate, endDate]);
    
    let outboundCount = 0;
    let inboundCount = 0;
    
    for (const row of responseResult.rows) {
      if (row.direction === 'outbound') {
        outboundCount = parseInt(row.count);
      } else if (row.direction === 'inbound') {
        inboundCount = parseInt(row.count);
      }
    }

    const responseRate = outboundCount > 0 ? (inboundCount / outboundCount) * 100 : 0;

    // Calculate average response time
    const responseTimeQuery = `
      SELECT AVG(
        EXTRACT(EPOCH FROM (inbound.sent_at - outbound.sent_at))/60
      ) as avg_response_time
      FROM communications outbound
      JOIN communications inbound ON inbound.customer_id = outbound.customer_id
      WHERE outbound.shop_id = $1
      AND outbound.direction = 'outbound'
      AND inbound.direction = 'inbound'
      AND outbound.sent_at BETWEEN $2 AND $3
      AND inbound.sent_at > outbound.sent_at
      AND inbound.sent_at <= outbound.sent_at + INTERVAL '24 hours'
    `;

    const responseTimeResult = await this.pool.query(responseTimeQuery, [shopId, startDate, endDate]);
    const averageResponseTime = Math.round(parseFloat(responseTimeResult.rows[0]?.avg_response_time) || 0);

    return {
      total_communications: totalCommunications,
      by_type: byType,
      by_status: byStatus,
      response_rate: Math.round(responseRate * 100) / 100,
      average_response_time: averageResponseTime,
    };
  }

  // Customer Preferences

  async getCustomerPreferences(customerId: number): Promise<CustomerPreference | null> {
    const query = 'SELECT * FROM customer_preferences WHERE customer_id = $1';
    const result = await this.pool.query(query, [customerId]);
    return result.rows[0] || null;
  }

  async createOrUpdateCustomerPreferences(
    customerId: number,
    preferences: Partial<Omit<CustomerPreference, 'id' | 'customer_id' | 'updated_at'>>
  ): Promise<CustomerPreference> {
    const query = `
      INSERT INTO customer_preferences (
        customer_id, sms_enabled, email_enabled, preferred_time_start,
        preferred_time_end, timezone, language, opt_out_date, opt_out_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (customer_id) 
      DO UPDATE SET 
        sms_enabled = COALESCE(EXCLUDED.sms_enabled, customer_preferences.sms_enabled),
        email_enabled = COALESCE(EXCLUDED.email_enabled, customer_preferences.email_enabled),
        preferred_time_start = COALESCE(EXCLUDED.preferred_time_start, customer_preferences.preferred_time_start),
        preferred_time_end = COALESCE(EXCLUDED.preferred_time_end, customer_preferences.preferred_time_end),
        timezone = COALESCE(EXCLUDED.timezone, customer_preferences.timezone),
        language = COALESCE(EXCLUDED.language, customer_preferences.language),
        opt_out_date = EXCLUDED.opt_out_date,
        opt_out_reason = EXCLUDED.opt_out_reason,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      customerId,
      preferences.sms_enabled ?? null,
      preferences.email_enabled ?? null,
      preferences.preferred_time_start ?? null,
      preferences.preferred_time_end ?? null,
      preferences.timezone ?? null,
      preferences.language ?? null,
      preferences.opt_out_date ?? null,
      preferences.opt_out_reason ?? null,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async optOutCustomer(
    customerId: number,
    communicationType: 'sms' | 'email' | 'all',
    reason?: string
  ): Promise<CustomerPreference> {
    const updates: any = {
      opt_out_date: new Date(),
      opt_out_reason: reason,
    };

    if (communicationType === 'sms' || communicationType === 'all') {
      updates.sms_enabled = false;
    }

    if (communicationType === 'email' || communicationType === 'all') {
      updates.email_enabled = false;
    }

    return this.createOrUpdateCustomerPreferences(customerId, updates);
  }

  async getOptedOutCustomers(shopId: number): Promise<Array<CustomerPreference & { customer_name: string }>> {
    const query = `
      SELECT cp.*, c.name as customer_name
      FROM customer_preferences cp
      JOIN customers c ON cp.customer_id = c.id
      WHERE c.shop_id = $1
      AND (cp.sms_enabled = false OR cp.email_enabled = false OR cp.opt_out_date IS NOT NULL)
      ORDER BY cp.opt_out_date DESC
    `;

    const result = await this.pool.query(query, [shopId]);
    return result.rows;
  }

  async getCustomersInTimeZone(
    shopId: number,
    timezone: string,
    communicationType: 'sms' | 'email'
  ): Promise<Array<{ customer_id: number; customer_name: string; phone?: string; email?: string }>> {
    const enabledField = communicationType === 'sms' ? 'sms_enabled' : 'email_enabled';
    
    const query = `
      SELECT 
        c.id as customer_id,
        c.name as customer_name,
        c.phone,
        c.email
      FROM customers c
      LEFT JOIN customer_preferences cp ON c.id = cp.customer_id
      WHERE c.shop_id = $1
      AND (cp.timezone = $2 OR (cp.timezone IS NULL AND $2 = 'America/Chicago'))
      AND (cp.${enabledField} = true OR cp.${enabledField} IS NULL)
      AND c.is_active = true
    `;

    const result = await this.pool.query(query, [shopId, timezone]);
    return result.rows;
  }

  async scheduleCommunication(
    data: CreateCommunicationData & { scheduled_at: Date }
  ): Promise<Communication> {
    return this.createCommunication({
      ...data,
      status: 'sent', // Will be processed later
    });
  }

  async markCommunicationProcessed(id: number): Promise<void> {
    await this.pool.query(
      'UPDATE communications SET status = $1 WHERE id = $2',
      ['delivered', id]
    );
  }

  async getUndeliveredCommunications(olderThanMinutes: number = 30): Promise<Communication[]> {
    const query = `
      SELECT * FROM communications 
      WHERE status = 'sent'
      AND communication_type = 'sms'
      AND sent_at <= NOW() - INTERVAL '${olderThanMinutes} minutes'
      ORDER BY sent_at ASC
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  async getCommunicationHistory(
    customerId: number,
    inspectionId?: number,
    limit: number = 20
  ): Promise<Communication[]> {
    let query = `
      SELECT c.*, u.full_name as user_name
      FROM communications c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.customer_id = $1
    `;
    const values: any[] = [customerId];
    let paramCount = 2;

    if (inspectionId) {
      query += ` AND c.inspection_id = $${paramCount}`;
      values.push(inspectionId);
      paramCount++;
    }

    query += ` ORDER BY c.sent_at DESC LIMIT $${paramCount}`;
    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async updateCommunicationMetadata(id: number, metadata: any): Promise<Communication | null> {
    const query = `
      UPDATE communications 
      SET metadata = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, [JSON.stringify(metadata), id]);
    return result.rows[0] || null;
  }
}