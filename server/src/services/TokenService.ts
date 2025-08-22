// Token Service - Enhanced JWT and Refresh Token Management
// Handles access tokens, refresh tokens, CSRF tokens with security best practices

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { DatabaseService, JwtPayload, ServiceResult, HttpStatus, AppError } from '../types/common';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: Date;
  refreshTokenExpires: Date;
}

export interface RefreshTokenData {
  id: string;
  userId: string;
  tokenHash: string;
  deviceInfo?: any;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  revokedAt?: Date;
}

export interface DeviceInfo {
  fingerprint: string;
  platform?: string;
  browser?: string;
  version?: string;
}

export interface SessionContext {
  userId: string;
  email: string;
  role: string;
  shopId?: string;
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
  userAgent?: string;
}

export class TokenService {
  private db: DatabaseService;
  private jwtSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;
  private csrfTokenExpiry: number;
  private maxSessionsPerUser: number;

  constructor(db: DatabaseService) {
    this.db = db;
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    this.accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    this.csrfTokenExpiry = 1000 * 60 * 30; // 30 minutes
    this.maxSessionsPerUser = parseInt(process.env.MAX_SESSIONS_PER_USER || '5');

    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not set in environment variables');
    }
  }

  // Generate token pair with session tracking
  async generateTokenPair(context: SessionContext): Promise<ServiceResult<TokenPair>> {
    try {
      // Check session limits
      const sessionCount = await this.getActiveSessionCount(context.userId);
      if (sessionCount >= this.maxSessionsPerUser) {
        // Remove oldest session
        await this.removeOldestSession(context.userId);
      }

      // Generate access token
      const accessToken = this.generateAccessToken({
        userId: context.userId,
        email: context.email,
        role: context.role,
        shopId: context.shopId
      });

      // Generate refresh token
      const refreshTokenData = this.generateRefreshToken();
      const refreshTokenHash = this.hashToken(refreshTokenData);

      // Calculate expiry dates
      const accessTokenExpires = new Date(Date.now() + this.parseExpiry(this.accessTokenExpiry));
      const refreshTokenExpires = new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry));

      // Store refresh token in database
      await this.storeRefreshToken({
        userId: context.userId,
        tokenHash: refreshTokenHash,
        deviceInfo: context.deviceInfo,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        expiresAt: refreshTokenExpires
      });

      // Create session record
      await this.createSession({
        userId: context.userId,
        refreshTokenHash,
        deviceInfo: context.deviceInfo,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        expiresAt: refreshTokenExpires
      });

      return {
        success: true,
        data: {
          accessToken,
          refreshToken: refreshTokenData,
          accessTokenExpires,
          refreshTokenExpires
        }
      };

    } catch (error) {
      console.error('Token generation error:', error);
      return {
        success: false,
        error: 'Failed to generate tokens',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Refresh access token with rotation
  async refreshAccessToken(refreshToken: string, context: Partial<SessionContext>): Promise<ServiceResult<TokenPair>> {
    try {
      // Verify refresh token structure
      const payload = this.verifyToken(refreshToken);
      if (payload.type !== 'refresh') {
        return {
          success: false,
          error: 'Invalid token type',
          statusCode: HttpStatus.UNAUTHORIZED
        };
      }

      const tokenHash = this.hashToken(refreshToken);

      // Check if refresh token exists and is valid
      const tokenResult = await this.db.query(
        `SELECT rt.*, u.email, u.role, u.shop_id 
         FROM refresh_tokens rt
         JOIN users u ON rt.user_id = u.id
         WHERE rt.token_hash = $1 AND rt.expires_at > NOW() AND rt.revoked_at IS NULL AND u.active = true`,
        [tokenHash]
      );

      if (tokenResult.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid or expired refresh token',
          statusCode: HttpStatus.UNAUTHORIZED
        };
      }

      const tokenData = tokenResult.rows[0];

      // Check for suspicious activity (different IP/user agent)
      if (this.isSuspiciousActivity(tokenData, context)) {
        // Revoke token and log security event
        await this.revokeRefreshToken(refreshToken);
        await this.logSecurityEvent('SUSPICIOUS_TOKEN_USE', {
          userId: tokenData.user_id,
          storedIp: tokenData.ip_address,
          requestIp: context.ipAddress,
          storedUserAgent: tokenData.user_agent,
          requestUserAgent: context.userAgent
        });

        return {
          success: false,
          error: 'Security violation detected',
          statusCode: HttpStatus.UNAUTHORIZED
        };
      }

      // Generate new token pair (token rotation)
      const newTokenPair = await this.generateTokenPair({
        userId: tokenData.user_id,
        email: tokenData.email,
        role: tokenData.role,
        shopId: tokenData.shop_id,
        deviceInfo: context.deviceInfo,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      if (!newTokenPair.success) {
        return newTokenPair;
      }

      // Revoke old refresh token
      await this.revokeRefreshToken(refreshToken);

      return newTokenPair;

    } catch (error) {
      console.error('Token refresh error:', error);
      return {
        success: false,
        error: 'Token refresh failed',
        statusCode: HttpStatus.UNAUTHORIZED
      };
    }
  }

  // Revoke refresh token
  async revokeRefreshToken(refreshToken: string): Promise<ServiceResult<boolean>> {
    try {
      const tokenHash = this.hashToken(refreshToken);
      
      await this.db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );

      // Also mark session as revoked
      await this.db.query(
        'UPDATE user_sessions SET revoked_at = NOW() WHERE refresh_token_id IN (SELECT id FROM refresh_tokens WHERE token_hash = $1)',
        [tokenHash]
      );

      return {
        success: true,
        data: true
      };

    } catch (error) {
      console.error('Token revocation error:', error);
      return {
        success: false,
        error: 'Failed to revoke token',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Revoke all user sessions
  async revokeAllUserSessions(userId: string): Promise<ServiceResult<boolean>> {
    try {
      await this.db.transaction(async (client) => {
        // Revoke all refresh tokens
        await client.query(
          'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
          [userId]
        );

        // Revoke all sessions
        await client.query(
          'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
          [userId]
        );
      });

      return {
        success: true,
        data: true
      };

    } catch (error) {
      console.error('Session revocation error:', error);
      return {
        success: false,
        error: 'Failed to revoke sessions',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Verify access token
  verifyAccessToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      
      if (payload.type && payload.type !== 'access') {
        throw new AppError('Invalid token type', HttpStatus.UNAUTHORIZED);
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Access token expired', HttpStatus.UNAUTHORIZED);
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid access token', HttpStatus.UNAUTHORIZED);
      }
      throw error;
    }
  }

  // Generate CSRF token
  async generateCSRFToken(userId: string): Promise<ServiceResult<string>> {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(token);
      const expiresAt = new Date(Date.now() + this.csrfTokenExpiry);

      await this.db.query(
        'INSERT INTO csrf_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [userId, tokenHash, expiresAt]
      );

      return {
        success: true,
        data: token
      };

    } catch (error) {
      console.error('CSRF token generation error:', error);
      return {
        success: false,
        error: 'Failed to generate CSRF token',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Verify CSRF token
  async verifyCSRFToken(userId: string, token: string): Promise<ServiceResult<boolean>> {
    try {
      const tokenHash = this.hashToken(token);

      const result = await this.db.query(
        'SELECT id FROM csrf_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW() AND used_at IS NULL',
        [userId, tokenHash]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid or expired CSRF token',
          statusCode: HttpStatus.FORBIDDEN
        };
      }

      // Mark token as used
      await this.db.query(
        'UPDATE csrf_tokens SET used_at = NOW() WHERE user_id = $1 AND token_hash = $2',
        [userId, tokenHash]
      );

      return {
        success: true,
        data: true
      };

    } catch (error) {
      console.error('CSRF token verification error:', error);
      return {
        success: false,
        error: 'CSRF token verification failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Get user sessions
  async getUserSessions(userId: string): Promise<ServiceResult<any[]>> {
    try {
      const result = await this.db.query(
        `SELECT 
          s.id,
          s.device_fingerprint,
          s.ip_address,
          s.user_agent,
          s.last_activity,
          s.created_at,
          CASE WHEN s.revoked_at IS NOT NULL THEN true ELSE false END as revoked,
          CASE WHEN s.expires_at < NOW() THEN true ELSE false END as expired
         FROM user_sessions s
         WHERE s.user_id = $1
         ORDER BY s.last_activity DESC`,
        [userId]
      );

      return {
        success: true,
        data: result.rows
      };

    } catch (error) {
      console.error('Get user sessions error:', error);
      return {
        success: false,
        error: 'Failed to retrieve sessions',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Cleanup expired tokens and sessions
  async cleanupExpiredTokens(): Promise<ServiceResult<{ deletedTokens: number; deletedSessions: number }>> {
    try {
      const tokenResult = await this.db.query(
        'DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING id'
      );

      const sessionResult = await this.db.query(
        'DELETE FROM user_sessions WHERE expires_at < NOW() OR revoked_at IS NOT NULL RETURNING id'
      );

      const csrfResult = await this.db.query(
        'DELETE FROM csrf_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL RETURNING id'
      );

      return {
        success: true,
        data: {
          deletedTokens: tokenResult.rows.length,
          deletedSessions: sessionResult.rows.length
        }
      };

    } catch (error) {
      console.error('Token cleanup error:', error);
      return {
        success: false,
        error: 'Token cleanup failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Private helper methods
  private generateAccessToken(payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>): string {
    return jwt.sign(
      { ...payload, type: 'access' },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    );
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload;
    } catch (error) {
      throw new AppError('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000; // Default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000;
    }
  }

  private async storeRefreshToken(data: {
    userId: string;
    tokenHash: string;
    deviceInfo?: any;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.userId,
        data.tokenHash,
        JSON.stringify(data.deviceInfo),
        data.ipAddress,
        data.userAgent,
        data.expiresAt
      ]
    );
  }

  private async createSession(data: {
    userId: string;
    refreshTokenHash: string;
    deviceInfo?: any;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<void> {
    const sessionId = crypto.randomUUID();
    const deviceFingerprint = data.deviceInfo?.fingerprint || crypto.randomBytes(16).toString('hex');

    await this.db.query(
      `INSERT INTO user_sessions (session_id, user_id, device_fingerprint, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sessionId,
        data.userId,
        deviceFingerprint,
        data.ipAddress,
        data.userAgent,
        data.expiresAt
      ]
    );
  }

  private async getActiveSessionCount(userId: string): Promise<number> {
    const result = await this.db.query(
      'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1 AND expires_at > NOW() AND revoked_at IS NULL',
      [userId]
    );
    return parseInt(result.rows[0]?.count || '0');
  }

  private async removeOldestSession(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE user_sessions 
       SET revoked_at = NOW() 
       WHERE id = (
         SELECT id FROM user_sessions 
         WHERE user_id = $1 AND expires_at > NOW() AND revoked_at IS NULL 
         ORDER BY created_at ASC 
         LIMIT 1
       )`,
      [userId]
    );
  }

  private isSuspiciousActivity(tokenData: any, context: Partial<SessionContext>): boolean {
    // Check IP address change (if strict mode enabled)
    if (process.env.STRICT_IP_VALIDATION === 'true' && 
        tokenData.ip_address && 
        context.ipAddress && 
        tokenData.ip_address !== context.ipAddress) {
      return true;
    }

    // Check for dramatically different user agent
    if (tokenData.user_agent && context.userAgent) {
      const storedAgent = tokenData.user_agent.toLowerCase();
      const requestAgent = context.userAgent.toLowerCase();
      
      // Simple check for different browsers/platforms
      const browserChange = 
        (storedAgent.includes('chrome') && !requestAgent.includes('chrome')) ||
        (storedAgent.includes('firefox') && !requestAgent.includes('firefox')) ||
        (storedAgent.includes('safari') && !requestAgent.includes('safari'));

      if (browserChange) {
        return true;
      }
    }

    return false;
  }

  private async logSecurityEvent(event: string, details: any): Promise<void> {
    try {
      await this.db.query(
        'INSERT INTO audit_logs (action, request_data, created_at) VALUES ($1, $2, NOW())',
        [event, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}