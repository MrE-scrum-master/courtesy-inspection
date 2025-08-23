import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';

export interface SMSMessage {
  id: number;
  telnyx_message_id: string | null;
  to_phone: string;
  from_phone: string;
  message_text: string;
  message_type: 'outbound' | 'inbound';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'received';
  shop_id: number | null;
  customer_id: number | null;
  inspection_id: number | null;
  cost_cents: number;
  sent_at: Date;
  delivered_at: Date | null;
  failed_at: Date | null;
  error_message: string | null;
  webhook_data: any;
}

export interface SMSTemplate {
  id: number;
  shop_id: number | null;
  template_key: string;
  template_name: string;
  message_text: string;
  variables: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSMSMessageData {
  telnyx_message_id?: string;
  to_phone: string;
  from_phone: string;
  message_text: string;
  message_type: 'outbound' | 'inbound';
  shop_id?: number;
  customer_id?: number;
  inspection_id?: number;
  cost_cents?: number;
}

export interface UpdateSMSMessageData {
  telnyx_message_id?: string;
  status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'received';
  delivered_at?: Date;
  failed_at?: Date;
  error_message?: string;
  webhook_data?: any;
  cost_cents?: number;
}

export interface SMSStats {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  delivery_rate: number;
  total_cost_cents: number;
  period_start: Date;
  period_end: Date;
}

export class SMSRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async createMessage(data: CreateSMSMessageData): Promise<SMSMessage> {
    const query = `
      INSERT INTO sms_messages (
        telnyx_message_id, to_phone, from_phone, message_text, message_type,
        shop_id, customer_id, inspection_id, cost_cents
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      data.telnyx_message_id || null,
      data.to_phone,
      data.from_phone,
      data.message_text,
      data.message_type,
      data.shop_id || null,
      data.customer_id || null,
      data.inspection_id || null,
      data.cost_cents || 0,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async updateMessage(id: number, data: UpdateSMSMessageData): Promise<SMSMessage | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.telnyx_message_id !== undefined) {
      fields.push(`telnyx_message_id = $${paramCount++}`);
      values.push(data.telnyx_message_id);
    }

    if (data.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(data.status);
    }

    if (data.delivered_at !== undefined) {
      fields.push(`delivered_at = $${paramCount++}`);
      values.push(data.delivered_at);
    }

    if (data.failed_at !== undefined) {
      fields.push(`failed_at = $${paramCount++}`);
      values.push(data.failed_at);
    }

    if (data.error_message !== undefined) {
      fields.push(`error_message = $${paramCount++}`);
      values.push(data.error_message);
    }

    if (data.webhook_data !== undefined) {
      fields.push(`webhook_data = $${paramCount++}`);
      values.push(JSON.stringify(data.webhook_data));
    }

    if (data.cost_cents !== undefined) {
      fields.push(`cost_cents = $${paramCount++}`);
      values.push(data.cost_cents);
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(id);
    const query = `
      UPDATE sms_messages 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async updateMessageByTelnyxId(telnyxId: string, data: UpdateSMSMessageData): Promise<SMSMessage | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(data.status);
    }

    if (data.delivered_at !== undefined) {
      fields.push(`delivered_at = $${paramCount++}`);
      values.push(data.delivered_at);
    }

    if (data.failed_at !== undefined) {
      fields.push(`failed_at = $${paramCount++}`);
      values.push(data.failed_at);
    }

    if (data.error_message !== undefined) {
      fields.push(`error_message = $${paramCount++}`);
      values.push(data.error_message);
    }

    if (data.webhook_data !== undefined) {
      fields.push(`webhook_data = $${paramCount++}`);
      values.push(JSON.stringify(data.webhook_data));
    }

    if (data.cost_cents !== undefined) {
      fields.push(`cost_cents = $${paramCount++}`);
      values.push(data.cost_cents);
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(telnyxId);
    const query = `
      UPDATE sms_messages 
      SET ${fields.join(', ')}
      WHERE telnyx_message_id = $${paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async getMessageById(id: number): Promise<SMSMessage | null> {
    const query = 'SELECT * FROM sms_messages WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getMessageByTelnyxId(telnyxId: string): Promise<SMSMessage | null> {
    const query = 'SELECT * FROM sms_messages WHERE telnyx_message_id = $1';
    const result = await this.pool.query(query, [telnyxId]);
    return result.rows[0] || null;
  }

  async getMessagesByCustomer(customerId: number, limit: number = 50): Promise<SMSMessage[]> {
    const query = `
      SELECT * FROM sms_messages 
      WHERE customer_id = $1 
      ORDER BY sent_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [customerId, limit]);
    return result.rows;
  }

  async getMessagesByInspection(inspectionId: number): Promise<SMSMessage[]> {
    const query = `
      SELECT * FROM sms_messages 
      WHERE inspection_id = $1 
      ORDER BY sent_at DESC
    `;
    const result = await this.pool.query(query, [inspectionId]);
    return result.rows;
  }

  async getMessagesByShop(shopId: number, limit: number = 100): Promise<SMSMessage[]> {
    const query = `
      SELECT * FROM sms_messages 
      WHERE shop_id = $1 
      ORDER BY sent_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [shopId, limit]);
    return result.rows;
  }

  async getPendingMessages(limit: number = 50): Promise<SMSMessage[]> {
    const query = `
      SELECT * FROM sms_messages 
      WHERE status = 'pending' 
      AND sent_at > NOW() - INTERVAL '1 hour'
      ORDER BY sent_at ASC 
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async getFailedMessages(limit: number = 50): Promise<SMSMessage[]> {
    const query = `
      SELECT * FROM sms_messages 
      WHERE status = 'failed' 
      AND sent_at > NOW() - INTERVAL '24 hours'
      ORDER BY failed_at DESC 
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async getSMSStats(shopId: number, startDate: Date, endDate: Date): Promise<SMSStats> {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE message_type = 'outbound') as total_sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as total_delivered,
        COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
        ROUND(
          CASE 
            WHEN COUNT(*) FILTER (WHERE message_type = 'outbound') > 0 
            THEN (COUNT(*) FILTER (WHERE status = 'delivered')::decimal / COUNT(*) FILTER (WHERE message_type = 'outbound')) * 100
            ELSE 0 
          END, 2
        ) as delivery_rate,
        COALESCE(SUM(cost_cents), 0) as total_cost_cents
      FROM sms_messages 
      WHERE shop_id = $1 
      AND sent_at BETWEEN $2 AND $3
    `;

    const result = await this.pool.query(query, [shopId, startDate, endDate]);
    const row = result.rows[0];

    return {
      total_sent: parseInt(row.total_sent),
      total_delivered: parseInt(row.total_delivered),
      total_failed: parseInt(row.total_failed),
      delivery_rate: parseFloat(row.delivery_rate),
      total_cost_cents: parseInt(row.total_cost_cents),
      period_start: startDate,
      period_end: endDate,
    };
  }

  async getTemplate(shopId: number | null, templateKey: string): Promise<SMSTemplate | null> {
    const query = `
      SELECT template_text as message_text, variables 
      FROM get_sms_template($1, $2)
    `;
    const result = await this.pool.query(query, [shopId, templateKey]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: 0, // Function doesn't return ID
      shop_id: shopId,
      template_key: templateKey,
      template_name: templateKey,
      message_text: row.template_text,
      variables: row.variables,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  async getAllTemplates(shopId: number | null): Promise<SMSTemplate[]> {
    const query = `
      SELECT * FROM sms_templates 
      WHERE (shop_id = $1 OR shop_id IS NULL)
      AND is_active = true
      ORDER BY shop_id NULLS LAST, template_key
    `;
    const result = await this.pool.query(query, [shopId]);
    return result.rows;
  }

  async createTemplate(data: Omit<SMSTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<SMSTemplate> {
    const query = `
      INSERT INTO sms_templates (
        shop_id, template_key, template_name, message_text, variables, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (shop_id, template_key) 
      DO UPDATE SET 
        template_name = EXCLUDED.template_name,
        message_text = EXCLUDED.message_text,
        variables = EXCLUDED.variables,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      data.shop_id,
      data.template_key,
      data.template_name,
      data.message_text,
      JSON.stringify(data.variables),
      data.is_active,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getRecentConversation(phoneNumber: string, limit: number = 20): Promise<SMSMessage[]> {
    const query = `
      SELECT * FROM sms_messages 
      WHERE to_phone = $1 OR from_phone = $1
      ORDER BY sent_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [phoneNumber, limit]);
    return result.rows.reverse(); // Return chronological order
  }

  async getDailySMSCount(shopId: number, date: Date): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM sms_messages 
      WHERE shop_id = $1 
      AND message_type = 'outbound'
      AND DATE(sent_at) = DATE($2)
    `;
    const result = await this.pool.query(query, [shopId, date]);
    return parseInt(result.rows[0].count);
  }

  async getMonthlyCost(shopId: number, year: number, month: number): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(cost_cents), 0) as total_cost
      FROM sms_messages 
      WHERE shop_id = $1 
      AND EXTRACT(YEAR FROM sent_at) = $2
      AND EXTRACT(MONTH FROM sent_at) = $3
    `;
    const result = await this.pool.query(query, [shopId, year, month]);
    return parseInt(result.rows[0].total_cost);
  }
}