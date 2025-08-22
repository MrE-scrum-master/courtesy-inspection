// Authentication Service - Business logic for user authentication
// Handles login, registration, token management with full validation

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserRepository } from '../repositories/UserRepository';
import { TokenService, SessionContext } from './TokenService';
import { LoginDTO, RegisterDTO, RefreshTokenDTO, AuthResponseDTO } from '../types/dtos';
import { ServiceResult, JwtPayload, AppError, HttpStatus } from '../types/common';
import { DatabaseService } from '../types/common';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number; // days
  preventReuse: number; // number of previous passwords to check
  lockoutAttempts: number;
  lockoutDuration: number; // minutes
}

export interface DeviceInfo {
  fingerprint: string;
  userAgent?: string;
  platform?: string;
  browser?: string;
}

export class AuthService {
  private userRepository: UserRepository;
  private tokenService: TokenService;
  private jwtSecret: string;
  private saltRounds: number = 12;
  private db: DatabaseService;
  private passwordPolicy: PasswordPolicy;

  constructor(db: DatabaseService) {
    this.db = db;
    this.userRepository = new UserRepository(db);
    this.tokenService = new TokenService(db);
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    
    // Password policy configuration
    this.passwordPolicy = {
      minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
      requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
      requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
      requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
      requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
      maxAge: parseInt(process.env.PASSWORD_MAX_AGE_DAYS || '90'),
      preventReuse: parseInt(process.env.PASSWORD_PREVENT_REUSE || '5'),
      lockoutAttempts: parseInt(process.env.LOCKOUT_ATTEMPTS || '5'),
      lockoutDuration: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15')
    };

    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not set in environment, using random secret');
    }
  }

  // User registration with validation and conflict checking
  async register(data: RegisterDTO): Promise<ServiceResult<AuthResponseDTO>> {
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(data.email);
      if (existingUser) {
        return {
          success: false,
          error: 'Email already registered',
          statusCode: HttpStatus.CONFLICT
        };
      }

      // Validate shop exists if provided
      if (data.shopId) {
        const shopExists = await this.db.exists('shops', { id: data.shopId, active: true });
        if (!shopExists) {
          return {
            success: false,
            error: 'Invalid shop ID',
            statusCode: HttpStatus.BAD_REQUEST
          };
        }
      }

      // Validate password policy
      const passwordValidation = this.validatePassword(data.password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: 'Password does not meet security requirements',
          statusCode: HttpStatus.BAD_REQUEST,
          details: { violations: passwordValidation.violations }
        };
      }

      // Hash password
      const hashedPassword = await this.hashPassword(data.password);

      // Create user
      const userData = {
        email: data.email,
        password_hash: hashedPassword,
        full_name: data.fullName,
        phone: data.phone || null,
        role: data.role || 'mechanic',
        shop_id: data.shopId || null
      };

      const user = await this.userRepository.create(userData);

      // Generate tokens
      const accessToken = this.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        shopId: user.shop_id
      });

      const refreshToken = this.generateRefreshToken(user.id);

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      // Get shop name if available
      let shopName = null;
      if (user.shop_id) {
        const shop = await this.db.findOne('shops', { id: user.shop_id });
        shopName = shop?.name || null;
      }

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            phone: user.phone,
            role: user.role,
            shopId: user.shop_id,
            shopName
          },
          accessToken,
          refreshToken
        }
      };

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // User login with credential validation
  async login(data: LoginDTO): Promise<ServiceResult<AuthResponseDTO>> {
    try {
      // Find user with shop information
      const userResult = await this.db.query(
        `SELECT u.*, s.name as shop_name 
         FROM users u 
         LEFT JOIN shops s ON u.shop_id = s.id 
         WHERE u.email = $1 AND u.active = true`,
        [data.email]
      );

      if (userResult.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid credentials',
          statusCode: HttpStatus.UNAUTHORIZED
        };
      }

      const user = userResult.rows[0];

      // Verify password
      const isValidPassword = await this.verifyPassword(data.password, user.password_hash);
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid credentials',
          statusCode: HttpStatus.UNAUTHORIZED
        };
      }

      // Generate token pair using TokenService
      const sessionContext: SessionContext = {
        userId: user.id,
        email: user.email,
        role: user.role,
        shopId: user.shop_id,
        deviceInfo: data.deviceInfo,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      };

      const tokenResult = await this.tokenService.generateTokenPair(sessionContext);
      if (!tokenResult.success) {
        return {
          success: false,
          error: 'Token generation failed',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR
        };
      }

      // Reset failed attempts and update last login
      await Promise.all([
        this.resetFailedAttempts(data.email, data.ipAddress),
        this.resetUserFailedAttempts(user.id),
        this.userRepository.updateLastLogin(user.id),
        this.logLoginAttempt(data.email, data.ipAddress, data.userAgent, true, 'SUCCESS')
      ]);

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            phone: user.phone,
            role: user.role,
            shopId: user.shop_id,
            shopName: user.shop_name
          },
          accessToken: tokenResult.data.accessToken,
          refreshToken: tokenResult.data.refreshToken
        }
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Refresh access token using valid refresh token
  async refreshToken(data: RefreshTokenDTO): Promise<ServiceResult<{ accessToken: string }>> {
    try {
      // Verify refresh token
      const payload = this.verifyToken(data.refreshToken) as JwtPayload;
      
      if (payload.type !== 'refresh') {
        return {
          success: false,
          error: 'Invalid token type',
          statusCode: HttpStatus.UNAUTHORIZED
        };
      }

      // Check if refresh token exists in database and is valid
      const sessionResult = await this.db.query(
        'SELECT user_id FROM user_sessions WHERE refresh_token = $1 AND expires_at > NOW()',
        [data.refreshToken]
      );

      if (sessionResult.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid refresh token',
          statusCode: HttpStatus.UNAUTHORIZED
        };
      }

      // Get user data
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.active) {
        return {
          success: false,
          error: 'User not found or inactive',
          statusCode: HttpStatus.UNAUTHORIZED
        };
      }

      // Generate new access token
      const accessToken = this.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        shopId: user.shop_id
      });

      return {
        success: true,
        data: { accessToken }
      };

    } catch (error) {
      console.error('Refresh token error:', error);
      return {
        success: false,
        error: 'Token refresh failed',
        statusCode: HttpStatus.UNAUTHORIZED
      };
    }
  }

  // Logout user by invalidating refresh token
  async logout(refreshToken: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
      await this.db.query(
        'DELETE FROM user_sessions WHERE refresh_token = $1',
        [refreshToken]
      );

      return {
        success: true,
        data: { success: true }
      };

    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'Logout failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Verify JWT token and return payload
  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload;
    } catch (error) {
      throw new AppError('Invalid or expired token', HttpStatus.UNAUTHORIZED);
    }
  }

  // Get user from token (for middleware)
  async getUserFromToken(token: string): Promise<ServiceResult<any>> {
    try {
      const payload = this.verifyAccessToken(token);
      const user = await this.userRepository.findByIdWithShop(payload.userId);

      if (!user || !user.active) {
        return {
          success: false,
          error: 'User not found or inactive',
          statusCode: HttpStatus.UNAUTHORIZED
        };
      }

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role,
          shop_id: user.shop_id,
          shop_name: user.shop_name
        }
      };

    } catch (error) {
      return {
        success: false,
        error: 'Invalid token',
        statusCode: HttpStatus.UNAUTHORIZED
      };
    }
  }

  // Change password with enhanced security
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
      // Get user with current password hash
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          statusCode: HttpStatus.NOT_FOUND
        };
      }

      // Verify old password
      const isValidPassword = await this.verifyPassword(oldPassword, user.password_hash);
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Current password is incorrect',
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      // Validate new password policy
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: 'New password does not meet security requirements',
          statusCode: HttpStatus.BAD_REQUEST,
          details: { violations: passwordValidation.violations }
        };
      }

      // Check password history
      const historyCheck = await this.checkPasswordHistory(userId, newPassword);
      if (!historyCheck.allowed) {
        return {
          success: false,
          error: `Cannot reuse any of the last ${this.passwordPolicy.preventReuse} passwords`,
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password (trigger will handle password history)
      const updated = await this.userRepository.updatePassword(userId, hashedPassword);
      
      if (!updated) {
        return {
          success: false,
          error: 'Failed to update password',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR
        };
      }

      // Revoke all sessions (force re-login on all devices)
      await this.tokenService.revokeAllUserSessions(userId);

      return {
        success: true,
        data: { success: true }
      };

    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: 'Password change failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Revoke all sessions for user (using TokenService)
  async revokeAllSessions(userId: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const result = await this.tokenService.revokeAllUserSessions(userId);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to revoke sessions',
          statusCode: result.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
        };
      }

      return {
        success: true,
        data: { success: true }
      };

    } catch (error) {
      console.error('Revoke sessions error:', error);
      return {
        success: false,
        error: 'Failed to revoke sessions',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Password reset with secure token
  async requestPasswordReset(email: string, ipAddress?: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        return {
          success: true,
          data: { success: true }
        };
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await this.db.query(
        'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
        [resetTokenHash, expiresAt, user.id]
      );

      // Log password reset request
      await this.logAuditEvent('PASSWORD_RESET_REQUESTED', {
        userId: user.id,
        email: user.email,
        ipAddress
      });

      // In production, send email with resetToken
      // For now, return success (token would be in email)
      
      return {
        success: true,
        data: { success: true }
      };

    } catch (error) {
      console.error('Password reset request error:', error);
      return {
        success: false,
        error: 'Password reset request failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Reset password with token
  async resetPassword(token: string, newPassword: string, ipAddress?: string): Promise<ServiceResult<{ success: boolean }>> {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find user with valid reset token
      const userResult = await this.db.query(
        'SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW() AND active = true',
        [tokenHash]
      );

      if (userResult.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid or expired reset token',
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      const user = userResult.rows[0];

      // Validate new password
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: 'Password does not meet security requirements',
          statusCode: HttpStatus.BAD_REQUEST,
          details: { violations: passwordValidation.violations }
        };
      }

      // Check password history
      const historyCheck = await this.checkPasswordHistory(user.id, newPassword);
      if (!historyCheck.allowed) {
        return {
          success: false,
          error: `Cannot reuse any of the last ${this.passwordPolicy.preventReuse} passwords`,
          statusCode: HttpStatus.BAD_REQUEST
        };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password and clear reset token
      await this.db.transaction(async (client) => {
        await client.query(
          'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, failed_login_attempts = 0, locked_until = NULL WHERE id = $2',
          [hashedPassword, user.id]
        );

        // Add to password history
        await client.query(
          'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
          [user.id, user.password_hash] // Store old password
        );
      });

      // Revoke all sessions
      await this.tokenService.revokeAllUserSessions(user.id);

      // Log password reset
      await this.logAuditEvent('PASSWORD_RESET_COMPLETED', {
        userId: user.id,
        email: user.email,
        ipAddress
      });

      return {
        success: true,
        data: { success: true }
      };

    } catch (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        error: 'Password reset failed',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      };
    }
  }

  // Get user sessions
  async getUserSessions(userId: string): Promise<ServiceResult<any[]>> {
    return await this.tokenService.getUserSessions(userId);
  }

  // Revoke specific session
  async revokeSession(refreshToken: string): Promise<ServiceResult<boolean>> {
    return await this.tokenService.revokeRefreshToken(refreshToken);
  }

  // Private helper methods
  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  private generateAccessToken(payload: Omit<JwtPayload, 'type'>): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpires });
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign({ userId, type: 'refresh' }, this.jwtSecret, { expiresIn: this.refreshExpires });
  }

  private verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JwtPayload;
    } catch (error) {
      throw new AppError('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    // This is now handled by TokenService
    console.warn('storeRefreshToken is deprecated, use TokenService instead');
  }

  // Password policy validation
  private validatePassword(password: string): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];

    if (password.length < this.passwordPolicy.minLength) {
      violations.push(`Password must be at least ${this.passwordPolicy.minLength} characters long`);
    }

    if (this.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      violations.push('Password must contain at least one uppercase letter');
    }

    if (this.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      violations.push('Password must contain at least one lowercase letter');
    }

    if (this.passwordPolicy.requireNumbers && !/\d/.test(password)) {
      violations.push('Password must contain at least one number');
    }

    if (this.passwordPolicy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      violations.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = ['password', '123456', 'password123', 'admin', 'letmein'];
    if (commonPasswords.includes(password.toLowerCase())) {
      violations.push('Password is too common');
    }

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  // Check password history to prevent reuse
  private async checkPasswordHistory(userId: string, newPassword: string): Promise<{ allowed: boolean }> {
    try {
      const historyResult = await this.db.query(
        `SELECT password_hash FROM password_history 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, this.passwordPolicy.preventReuse]
      );

      for (const row of historyResult.rows) {
        const matches = await bcrypt.compare(newPassword, row.password_hash);
        if (matches) {
          return { allowed: false };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error('Password history check error:', error);
      return { allowed: true }; // Allow on error to prevent lockout
    }
  }

  // Check if password needs to be changed due to policy
  private async checkPasswordPolicy(user: any): Promise<{ requiresChange: boolean; reason?: string }> {
    try {
      const passwordAge = user.password_changed_at 
        ? Math.floor((new Date().getTime() - new Date(user.password_changed_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (passwordAge > this.passwordPolicy.maxAge) {
        return {
          requiresChange: true,
          reason: `Password is ${passwordAge} days old, maximum allowed is ${this.passwordPolicy.maxAge} days`
        };
      }

      return { requiresChange: false };
    } catch (error) {
      console.error('Password policy check error:', error);
      return { requiresChange: false };
    }
  }

  // Account lockout checking
  private async checkAccountLockout(email: string, ipAddress?: string): Promise<{ locked: boolean; lockedUntil?: string }> {
    try {
      // Check email-based lockout
      const emailLockResult = await this.db.query(
        'SELECT locked_until FROM login_attempts WHERE email = $1 AND locked_until > NOW() ORDER BY created_at DESC LIMIT 1',
        [email]
      );

      if (emailLockResult.rows.length > 0) {
        return {
          locked: true,
          lockedUntil: emailLockResult.rows[0].locked_until
        };
      }

      // Check IP-based lockout if provided
      if (ipAddress) {
        const ipLockResult = await this.db.query(
          'SELECT locked_until FROM login_attempts WHERE ip_address = $1 AND locked_until > NOW() ORDER BY created_at DESC LIMIT 1',
          [ipAddress]
        );

        if (ipLockResult.rows.length > 0) {
          return {
            locked: true,
            lockedUntil: ipLockResult.rows[0].locked_until
          };
        }
      }

      return { locked: false };
    } catch (error) {
      console.error('Account lockout check error:', error);
      return { locked: false };
    }
  }

  // Increment failed login attempts
  private async incrementFailedAttempts(email: string, ipAddress?: string): Promise<void> {
    try {
      await this.db.transaction(async (client) => {
        // Check current attempts
        const existingResult = await client.query(
          'SELECT attempts_count FROM login_attempts WHERE email = $1 AND ip_address = $2 AND created_at > NOW() - INTERVAL \'15 minutes\' ORDER BY created_at DESC LIMIT 1',
          [email, ipAddress]
        );

        let attempts = 1;
        if (existingResult.rows.length > 0) {
          attempts = existingResult.rows[0].attempts_count + 1;
        }

        let lockedUntil = null;
        if (attempts >= this.passwordPolicy.lockoutAttempts) {
          lockedUntil = new Date(Date.now() + this.passwordPolicy.lockoutDuration * 60 * 1000);
        }

        // Insert or update login attempt
        await client.query(
          `INSERT INTO login_attempts (email, ip_address, attempts_count, locked_until, success) 
           VALUES ($1, $2, $3, $4, false)
           ON CONFLICT (email, ip_address) 
           DO UPDATE SET attempts_count = $3, locked_until = $4, updated_at = NOW()`,
          [email, ipAddress, attempts, lockedUntil]
        );
      });
    } catch (error) {
      console.error('Failed to increment login attempts:', error);
    }
  }

  // Increment user-specific failed attempts
  private async incrementUserFailedAttempts(userId: string): Promise<void> {
    try {
      await this.db.transaction(async (client) => {
        const result = await client.query(
          'SELECT failed_login_attempts FROM users WHERE id = $1',
          [userId]
        );

        if (result.rows.length > 0) {
          const attempts = (result.rows[0].failed_login_attempts || 0) + 1;
          let lockedUntil = null;

          if (attempts >= this.passwordPolicy.lockoutAttempts) {
            lockedUntil = new Date(Date.now() + this.passwordPolicy.lockoutDuration * 60 * 1000);
          }

          await client.query(
            'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
            [attempts, lockedUntil, userId]
          );
        }
      });
    } catch (error) {
      console.error('Failed to increment user login attempts:', error);
    }
  }

  // Reset failed login attempts
  private async resetFailedAttempts(email: string, ipAddress?: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE login_attempts SET attempts_count = 0, locked_until = NULL WHERE email = $1',
        [email]
      );
    } catch (error) {
      console.error('Failed to reset login attempts:', error);
    }
  }

  // Reset user failed login attempts
  private async resetUserFailedAttempts(userId: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Failed to reset user login attempts:', error);
    }
  }

  // Log login attempts
  private async logLoginAttempt(
    email: string, 
    ipAddress?: string, 
    userAgent?: string, 
    success: boolean = false, 
    reason?: string
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [email, ipAddress, userAgent, success, reason]
      );
    } catch (error) {
      console.error('Failed to log login attempt:', error);
    }
  }

  // Log audit events
  private async logAuditEvent(action: string, details: any): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_logs (action, resource, user_id, ip_address, request_data, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [action, 'AUTH', details.userId, details.ipAddress, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}