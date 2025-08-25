// Token Repository - Database operations for tokens and sessions
// Handles refresh tokens, CSRF tokens, and session management

import { BaseRepository } from './BaseRepository';
import { DatabaseService, RepositoryOptions } from '../types/common';

export interface RefreshTokenEntity {
  id: string;
  user_id: string;
  token_hash: string;
  device_info?: any;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  revoked_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SessionEntity {
  id: string;
  user_id: string;
  session_id: string;
  refresh_token_id?: string;
  device_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  last_activity: Date;
  expires_at: Date;
  revoked_at?: Date;
  created_at: Date;
}

export interface CSRFTokenEntity {
  id: string;
  user_id?: string;
  token_hash: string;
  expires_at: Date;
  used_at?: Date;
  created_at: Date;
}

export class TokenRepository extends BaseRepository {
  constructor(db: DatabaseService) {
    super(db, 'refresh_tokens');
  }

  // Refresh Token Operations
  async createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    deviceInfo?: any;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }, options?: RepositoryOptions): Promise<RefreshTokenEntity> {
    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await this.query(
      query,
      [
        data.userId,
        data.tokenHash,
        JSON.stringify(data.deviceInfo),
        data.ipAddress,
        data.userAgent,
        data.expiresAt
      ],
      options
    );

    return result.rows[0];
  }

  async findRefreshTokenByHash(tokenHash: string, options?: RepositoryOptions): Promise<RefreshTokenEntity | null> {
    const query = `
      SELECT rt.*, u.email, u.role, u.shop_id, u.active as user_active
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token_hash = $1 AND rt.expires_at > NOW() AND rt.revoked_at IS NULL
    `;

    const result = await this.query(query, [tokenHash], options);
    return result.rows[0] || null;
  }

  async revokeRefreshToken(tokenHash: string, options?: RepositoryOptions): Promise<boolean> {
    const query = 'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1';
    const result = await this.query(query, [tokenHash], options);
    return result.rowCount > 0;
  }

  async revokeAllUserRefreshTokens(userId: string, options?: RepositoryOptions): Promise<number> {
    const query = `
      UPDATE refresh_tokens 
      SET revoked_at = NOW() 
      WHERE user_id = $1 AND revoked_at IS NULL
    `;
    const result = await this.query(query, [userId], options);
    return result.rowCount;
  }

  async getUserRefreshTokens(userId: string, options?: RepositoryOptions): Promise<RefreshTokenEntity[]> {
    const query = `
      SELECT * FROM refresh_tokens 
      WHERE user_id = $1 AND expires_at > NOW() 
      ORDER BY created_at DESC
    `;
    const result = await this.query(query, [userId], options);
    return result.rows;
  }

  async cleanupExpiredRefreshTokens(options?: RepositoryOptions): Promise<number> {
    const query = 'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL';
    const result = await this.query(query, [], options);
    return result.rowCount;
  }

  // Session Operations
  async createSession(data: {
    sessionId: string;
    userId: string;
    refreshTokenId?: string;
    deviceFingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }, options?: RepositoryOptions): Promise<SessionEntity> {
    const query = `
      INSERT INTO user_sessions (session_id, user_id, refresh_token_id, device_fingerprint, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.query(
      query,
      [
        data.sessionId,
        data.userId,
        data.refreshTokenId,
        data.deviceFingerprint,
        data.ipAddress,
        data.userAgent,
        data.expiresAt
      ],
      options
    );

    return result.rows[0];
  }

  async findSessionById(sessionId: string, options?: RepositoryOptions): Promise<SessionEntity | null> {
    const query = 'SELECT * FROM user_sessions WHERE session_id = $1 AND expires_at > NOW() AND revoked_at IS NULL';
    const result = await this.query(query, [sessionId], options);
    return result.rows[0] || null;
  }

  async updateSessionActivity(sessionId: string, options?: RepositoryOptions): Promise<boolean> {
    const query = `
      UPDATE user_sessions 
      SET last_activity = NOW() 
      WHERE session_id = $1 AND expires_at > NOW() AND revoked_at IS NULL
    `;
    const result = await this.query(query, [sessionId], options);
    return result.rowCount > 0;
  }

  async getUserSessions(userId: string, includeExpired = false, options?: RepositoryOptions): Promise<SessionEntity[]> {
    const whereClause = includeExpired 
      ? 'WHERE user_id = $1' 
      : 'WHERE user_id = $1 AND expires_at > NOW() AND revoked_at IS NULL';

    const query = `
      SELECT 
        id,
        session_id,
        device_fingerprint,
        ip_address,
        user_agent,
        last_activity,
        expires_at,
        revoked_at,
        created_at,
        CASE WHEN revoked_at IS NOT NULL THEN true ELSE false END as revoked,
        CASE WHEN expires_at < NOW() THEN true ELSE false END as expired
      FROM user_sessions 
      ${whereClause}
      ORDER BY last_activity DESC
    `;

    const result = await this.query(query, [userId], options);
    return result.rows;
  }

  async revokeSession(sessionId: string, options?: RepositoryOptions): Promise<boolean> {
    const query = 'UPDATE user_sessions SET revoked_at = NOW() WHERE session_id = $1';
    const result = await this.query(query, [sessionId], options);
    return result.rowCount > 0;
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string, options?: RepositoryOptions): Promise<number> {
    let query = 'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL';
    const params = [userId];

    if (exceptSessionId) {
      query += ' AND session_id != $2';
      params.push(exceptSessionId);
    }

    const result = await this.query(query, params, options);
    return result.rowCount;
  }

  async getActiveSessionCount(userId: string, options?: RepositoryOptions): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM user_sessions 
      WHERE user_id = $1 AND expires_at > NOW() AND revoked_at IS NULL
    `;
    const result = await this.query(query, [userId], options);
    return parseInt(result.rows[0]?.count || '0');
  }

  async removeOldestSession(userId: string, options?: RepositoryOptions): Promise<boolean> {
    const query = `
      UPDATE user_sessions 
      SET revoked_at = NOW() 
      WHERE id = (
        SELECT id FROM user_sessions 
        WHERE user_id = $1 AND expires_at > NOW() AND revoked_at IS NULL 
        ORDER BY created_at ASC 
        LIMIT 1
      )
    `;
    const result = await this.query(query, [userId], options);
    return result.rowCount > 0;
  }

  async cleanupExpiredSessions(options?: RepositoryOptions): Promise<number> {
    const query = 'DELETE FROM user_sessions WHERE expires_at < NOW() OR revoked_at IS NOT NULL';
    const result = await this.query(query, [], options);
    return result.rowCount;
  }

  // CSRF Token Operations
  async createCSRFToken(data: {
    userId?: string;
    tokenHash: string;
    expiresAt: Date;
  }, options?: RepositoryOptions): Promise<CSRFTokenEntity> {
    const query = `
      INSERT INTO csrf_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await this.query(
      query,
      [data.userId, data.tokenHash, data.expiresAt],
      options
    );

    return result.rows[0];
  }

  async findCSRFToken(
    tokenHash: string, 
    userId?: string, 
    options?: RepositoryOptions
  ): Promise<CSRFTokenEntity | null> {
    let query = `
      SELECT * FROM csrf_tokens 
      WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL
    `;
    const params = [tokenHash];

    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    const result = await this.query(query, params, options);
    return result.rows[0] || null;
  }

  async markCSRFTokenAsUsed(tokenHash: string, options?: RepositoryOptions): Promise<boolean> {
    const query = 'UPDATE csrf_tokens SET used_at = NOW() WHERE token_hash = $1';
    const result = await this.query(query, [tokenHash], options);
    return result.rowCount > 0;
  }

  async cleanupExpiredCSRFTokens(options?: RepositoryOptions): Promise<number> {
    const query = 'DELETE FROM csrf_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL';
    const result = await this.query(query, [], options);
    return result.rowCount;
  }

  // Security Analytics
  async getTokenStatistics(userId?: string, options?: RepositoryOptions): Promise<any> {
    let query = `
      SELECT 
        COUNT(CASE WHEN expires_at > NOW() AND revoked_at IS NULL THEN 1 END) as active_refresh_tokens,
        COUNT(CASE WHEN expires_at <= NOW() OR revoked_at IS NOT NULL THEN 1 END) as inactive_refresh_tokens,
        COUNT(*) as total_refresh_tokens
      FROM refresh_tokens
    `;
    const params: any[] = [];

    if (userId) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }

    const refreshTokenStats = await this.query(query, params, options);

    // Session statistics
    let sessionQuery = `
      SELECT 
        COUNT(CASE WHEN expires_at > NOW() AND revoked_at IS NULL THEN 1 END) as active_sessions,
        COUNT(CASE WHEN expires_at <= NOW() OR revoked_at IS NOT NULL THEN 1 END) as inactive_sessions,
        COUNT(*) as total_sessions,
        AVG(EXTRACT(EPOCH FROM (last_activity - created_at))) as avg_session_duration
      FROM user_sessions
    `;

    if (userId) {
      sessionQuery += ' WHERE user_id = $1';
    }

    const sessionStats = await this.query(sessionQuery, params, options);

    return {
      refreshTokens: refreshTokenStats.rows[0],
      sessions: sessionStats.rows[0]
    };
  }

  async getSuspiciousActivity(timeWindow = '24 hours', options?: RepositoryOptions): Promise<any[]> {
    const query = `
      SELECT 
        user_id,
        COUNT(DISTINCT ip_address) as distinct_ips,
        COUNT(DISTINCT user_agent) as distinct_user_agents,
        COUNT(*) as total_tokens,
        array_agg(DISTINCT ip_address) as ip_addresses,
        MIN(created_at) as first_seen,
        MAX(created_at) as last_seen
      FROM refresh_tokens
      WHERE created_at > NOW() - INTERVAL '${timeWindow}'
      GROUP BY user_id
      HAVING COUNT(DISTINCT ip_address) > 3 OR COUNT(DISTINCT user_agent) > 2
      ORDER BY total_tokens DESC
    `;

    const result = await this.query(query, [], options);
    return result.rows;
  }

  // Maintenance Operations
  async performMaintenance(options?: RepositoryOptions): Promise<{
    deletedRefreshTokens: number;
    deletedSessions: number;
    deletedCSRFTokens: number;
  }> {
    const refreshTokens = await this.cleanupExpiredRefreshTokens(options);
    const sessions = await this.cleanupExpiredSessions(options);
    const csrfTokens = await this.cleanupExpiredCSRFTokens(options);

    return {
      deletedRefreshTokens: refreshTokens,
      deletedSessions: sessions,
      deletedCSRFTokens: csrfTokens
    };
  }
}