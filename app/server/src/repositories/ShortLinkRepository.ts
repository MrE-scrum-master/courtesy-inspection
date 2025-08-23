import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';

export interface ShortLink {
  id: number;
  short_code: string;
  long_url: string;
  created_by: number | null;
  created_at: Date;
  expires_at: Date | null;
  click_count: number;
  last_clicked_at: Date | null;
  metadata: any;
  is_active: boolean;
}

export interface LinkClick {
  id: number;
  short_link_id: number;
  ip_address: string | null;
  user_agent: string | null;
  clicked_at: Date;
  referrer: string | null;
}

export interface CreateShortLinkData {
  short_code: string;
  long_url: string;
  created_by?: number;
  expires_at?: Date;
  metadata?: any;
}

export interface LinkAnalytics {
  total_clicks: number;
  unique_ips: number;
  clicks_today: number;
  clicks_this_week: number;
  clicks_this_month: number;
  top_user_agents: Array<{ user_agent: string; count: number }>;
  click_timeline: Array<{ date: string; clicks: number }>;
}

export class ShortLinkRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async createShortLink(data: CreateShortLinkData): Promise<ShortLink> {
    const query = `
      INSERT INTO short_links (
        short_code, long_url, created_by, expires_at, metadata
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      data.short_code,
      data.long_url,
      data.created_by || null,
      data.expires_at || null,
      JSON.stringify(data.metadata || {}),
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getShortLinkByCode(shortCode: string): Promise<ShortLink | null> {
    const query = `
      SELECT * FROM short_links 
      WHERE short_code = $1 
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    `;
    
    const result = await this.pool.query(query, [shortCode]);
    return result.rows[0] || null;
  }

  async getShortLinkById(id: number): Promise<ShortLink | null> {
    const query = 'SELECT * FROM short_links WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getShortLinksByUser(userId: number, limit: number = 50): Promise<ShortLink[]> {
    const query = `
      SELECT * FROM short_links 
      WHERE created_by = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [userId, limit]);
    return result.rows;
  }

  async updateClickCount(shortCode: string): Promise<ShortLink | null> {
    const query = `
      UPDATE short_links 
      SET 
        click_count = click_count + 1,
        last_clicked_at = NOW()
      WHERE short_code = $1 
      AND is_active = true
      RETURNING *
    `;

    const result = await this.pool.query(query, [shortCode]);
    return result.rows[0] || null;
  }

  async recordClick(
    shortLinkId: number,
    ipAddress: string | null,
    userAgent: string | null,
    referrer: string | null
  ): Promise<LinkClick> {
    const query = `
      INSERT INTO link_clicks (
        short_link_id, ip_address, user_agent, referrer
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [shortLinkId, ipAddress, userAgent, referrer];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async expireShortLink(shortCode: string): Promise<boolean> {
    const query = `
      UPDATE short_links 
      SET is_active = false 
      WHERE short_code = $1
    `;

    const result = await this.pool.query(query, [shortCode]);
    return result.rowCount > 0;
  }

  async expireExpiredLinks(): Promise<number> {
    const query = `
      UPDATE short_links 
      SET is_active = false 
      WHERE expires_at <= NOW() 
      AND is_active = true
    `;

    const result = await this.pool.query(query);
    return result.rowCount;
  }

  async isShortCodeAvailable(shortCode: string): Promise<boolean> {
    const query = 'SELECT 1 FROM short_links WHERE short_code = $1 LIMIT 1';
    const result = await this.pool.query(query, [shortCode]);
    return result.rows.length === 0;
  }

  async getClicksByShortLink(shortLinkId: number, limit: number = 100): Promise<LinkClick[]> {
    const query = `
      SELECT * FROM link_clicks 
      WHERE short_link_id = $1 
      ORDER BY clicked_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [shortLinkId, limit]);
    return result.rows;
  }

  async getLinkAnalytics(shortCode: string): Promise<LinkAnalytics | null> {
    const shortLink = await this.getShortLinkByCode(shortCode);
    if (!shortLink) {
      return null;
    }

    // Get total and unique click counts
    const countsQuery = `
      SELECT 
        COUNT(*) as total_clicks,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(*) FILTER (WHERE DATE(clicked_at) = CURRENT_DATE) as clicks_today,
        COUNT(*) FILTER (WHERE clicked_at >= DATE_TRUNC('week', CURRENT_DATE)) as clicks_this_week,
        COUNT(*) FILTER (WHERE clicked_at >= DATE_TRUNC('month', CURRENT_DATE)) as clicks_this_month
      FROM link_clicks 
      WHERE short_link_id = $1
    `;

    const countsResult = await this.pool.query(countsQuery, [shortLink.id]);
    const counts = countsResult.rows[0];

    // Get top user agents
    const userAgentsQuery = `
      SELECT 
        user_agent,
        COUNT(*) as count
      FROM link_clicks 
      WHERE short_link_id = $1 
      AND user_agent IS NOT NULL
      GROUP BY user_agent 
      ORDER BY count DESC 
      LIMIT 10
    `;

    const userAgentsResult = await this.pool.query(userAgentsQuery, [shortLink.id]);

    // Get click timeline for last 30 days
    const timelineQuery = `
      SELECT 
        DATE(clicked_at) as date,
        COUNT(*) as clicks
      FROM link_clicks 
      WHERE short_link_id = $1 
      AND clicked_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(clicked_at)
      ORDER BY date
    `;

    const timelineResult = await this.pool.query(timelineQuery, [shortLink.id]);

    return {
      total_clicks: parseInt(counts.total_clicks),
      unique_ips: parseInt(counts.unique_ips),
      clicks_today: parseInt(counts.clicks_today),
      clicks_this_week: parseInt(counts.clicks_this_week),
      clicks_this_month: parseInt(counts.clicks_this_month),
      top_user_agents: userAgentsResult.rows,
      click_timeline: timelineResult.rows.map(row => ({
        date: row.date.toISOString().split('T')[0],
        clicks: parseInt(row.clicks),
      })),
    };
  }

  async getExpiringSoon(days: number = 7): Promise<ShortLink[]> {
    const query = `
      SELECT * FROM short_links 
      WHERE expires_at IS NOT NULL 
      AND expires_at <= NOW() + INTERVAL '$1 days'
      AND expires_at > NOW()
      AND is_active = true
      ORDER BY expires_at ASC
    `;

    const result = await this.pool.query(query, [days]);
    return result.rows;
  }

  async getMostPopularLinks(limit: number = 10): Promise<ShortLink[]> {
    const query = `
      SELECT * FROM short_links 
      WHERE is_active = true
      ORDER BY click_count DESC 
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async bulkCreateShortLinks(links: CreateShortLinkData[]): Promise<ShortLink[]> {
    if (links.length === 0) {
      return [];
    }

    const values: any[] = [];
    const placeholders: string[] = [];
    
    links.forEach((link, index) => {
      const offset = index * 5;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      values.push(
        link.short_code,
        link.long_url,
        link.created_by || null,
        link.expires_at || null,
        JSON.stringify(link.metadata || {})
      );
    });

    const query = `
      INSERT INTO short_links (
        short_code, long_url, created_by, expires_at, metadata
      ) VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async getRecentClicks(limit: number = 50): Promise<Array<LinkClick & { short_code: string; long_url: string }>> {
    const query = `
      SELECT 
        lc.*,
        sl.short_code,
        sl.long_url
      FROM link_clicks lc
      JOIN short_links sl ON lc.short_link_id = sl.id
      ORDER BY lc.clicked_at DESC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async getClicksByDateRange(
    shortCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; clicks: number }>> {
    const query = `
      SELECT 
        DATE(lc.clicked_at) as date,
        COUNT(*) as clicks
      FROM link_clicks lc
      JOIN short_links sl ON lc.short_link_id = sl.id
      WHERE sl.short_code = $1
      AND lc.clicked_at BETWEEN $2 AND $3
      GROUP BY DATE(lc.clicked_at)
      ORDER BY date
    `;

    const result = await this.pool.query(query, [shortCode, startDate, endDate]);
    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      clicks: parseInt(row.clicks),
    }));
  }

  async deleteShortLink(shortCode: string): Promise<boolean> {
    const query = 'DELETE FROM short_links WHERE short_code = $1';
    const result = await this.pool.query(query, [shortCode]);
    return result.rowCount > 0;
  }

  async updateShortLink(
    shortCode: string,
    updates: Partial<Pick<ShortLink, 'long_url' | 'expires_at' | 'metadata' | 'is_active'>>
  ): Promise<ShortLink | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.long_url !== undefined) {
      fields.push(`long_url = $${paramCount++}`);
      values.push(updates.long_url);
    }

    if (updates.expires_at !== undefined) {
      fields.push(`expires_at = $${paramCount++}`);
      values.push(updates.expires_at);
    }

    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(shortCode);
    const query = `
      UPDATE short_links 
      SET ${fields.join(', ')}
      WHERE short_code = $${paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }
}