// Authentication Middleware - Enhanced JWT token validation and user context
// Integrated with TokenService and comprehensive security features

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { TokenService } from '../services/TokenService';
import { AuditService } from '../services/AuditService';
import { RequestUser, AppError, HttpStatus, DatabaseService } from '../types/common';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      correlationId?: string;
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;
  private tokenService: TokenService;
  private auditService: AuditService;

  constructor(db: DatabaseService) {
    this.authService = new AuthService(db);
    this.tokenService = new TokenService(db);
    this.auditService = new AuditService(db);
  }

  // Enhanced JWT Authentication middleware
  authenticate() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          await this.auditService.logSecurityEvent({
            type: 'LOGIN_FAILURE',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: { reason: 'no_token_provided' },
            severity: 'low'
          });

          return res.status(HttpStatus.UNAUTHORIZED).json({
            success: false,
            error: 'No token provided'
          });
        }

        const token = authHeader.substring(7);
        
        // Use TokenService to verify token
        try {
          const payload = this.tokenService.verifyAccessToken(token);
          
          // Get user details
          const userResult = await this.authService.getUserFromToken(token);
          
          if (!userResult.success) {
            await this.auditService.logSecurityEvent({
              type: 'LOGIN_FAILURE',
              userId: payload.userId,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              details: { reason: 'invalid_token_user', error: userResult.error },
              severity: 'medium'
            });

            return res.status(userResult.statusCode || HttpStatus.UNAUTHORIZED).json({
              success: false,
              error: userResult.error
            });
          }

          // Add user to request context
          req.user = {
            id: userResult.data.id,
            email: userResult.data.email,
            full_name: userResult.data.full_name,
            phone: userResult.data.phone,
            role: userResult.data.role,
            shop_id: userResult.data.shop_id
          };

          // Log successful authentication
          await this.auditService.logApiAccess(req, res, Date.now() - startTime, req.user);

          next();

        } catch (tokenError) {
          await this.auditService.logSecurityEvent({
            type: 'LOGIN_FAILURE',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: { 
              reason: 'token_verification_failed',
              error: tokenError instanceof Error ? tokenError.message : 'Unknown error'
            },
            severity: 'medium'
          });

          return res.status(HttpStatus.UNAUTHORIZED).json({
            success: false,
            error: 'Invalid or expired token'
          });
        }

      } catch (error) {
        console.error('Authentication middleware error:', error);
        
        await this.auditService.logSecurityEvent({
          type: 'LOGIN_FAILURE',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: { 
            reason: 'authentication_error',
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          severity: 'high'
        });

        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Authentication failed'
        });
      }
    };
  }

  // Role-based authorization middleware
  authorize(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Not authenticated'
        });
      }

      // Allow all roles if none specified
      if (allowedRoles.length === 0) {
        return next();
      }

      // Check if user role is allowed
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(HttpStatus.FORBIDDEN).json({
          success: false,
          error: 'Insufficient permissions',
          details: {
            required: allowedRoles,
            current: req.user.role
          }
        });
      }

      next();
    };
  }

  // Shop access control middleware
  requireShopAccess() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Not authenticated'
        });
      }

      // Get shop ID from various sources
      const shopId = req.params.shopId || 
                   req.body.shop_id || 
                   req.query.shop_id as string;

      if (!shopId) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Shop ID required'
        });
      }

      // Admin can access any shop
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user belongs to the requested shop
      if (req.user.shop_id !== shopId) {
        return res.status(HttpStatus.FORBIDDEN).json({
          success: false,
          error: 'Access denied to this shop',
          details: {
            userShop: req.user.shop_id,
            requestedShop: shopId
          }
        });
      }

      next();
    };
  }

  // Ownership check for mechanics (can only access their own inspections)
  requireOwnership(resourceIdParam: string = 'id', ownershipField: string = 'technician_id') {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Not authenticated'
        });
      }

      // Admin and shop managers can access all resources
      if (['admin', 'shop_manager'].includes(req.user.role)) {
        return next();
      }

      // For mechanics, check ownership in the service layer
      // This middleware just ensures the user ID is available
      next();
    };
  }

  // Optional authentication (for public endpoints with enhanced features for authenticated users)
  optionalAuth() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const userResult = await this.authService.getUserFromToken(token);

          if (userResult.success) {
            req.user = {
              id: userResult.data.id,
              email: userResult.data.email,
              full_name: userResult.data.full_name,
              phone: userResult.data.phone,
              role: userResult.data.role,
              shop_id: userResult.data.shop_id
            };
          }
        }

        // Continue regardless of authentication status
        next();
      } catch (error) {
        // Ignore authentication errors for optional auth
        next();
      }
    };
  }

  // Rate limiting by user
  rateLimitByUser(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
    const requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

    return (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id || req.ip;
      const now = Date.now();
      
      const userRequests = requestCounts.get(userId);
      
      if (!userRequests || now > userRequests.resetTime) {
        // Reset or initialize counter
        requestCounts.set(userId, {
          count: 1,
          resetTime: now + windowMs
        });
        return next();
      }

      if (userRequests.count >= maxRequests) {
        return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          success: false,
          error: 'Rate limit exceeded',
          details: {
            limit: maxRequests,
            windowMs,
            resetTime: userRequests.resetTime
          }
        });
      }

      // Increment counter
      userRequests.count++;
      next();
    };
  }

  // API key authentication (for external integrations)
  authenticateApiKey() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'API key required'
        });
      }

      // In production, validate against database
      const validApiKey = process.env.API_KEY;
      
      if (!validApiKey || apiKey !== validApiKey) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Invalid API key'
        });
      }

      next();
    };
  }

  // Session cleanup middleware (remove expired tokens)
  cleanupExpiredSessions() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Run cleanup in background every 24 hours
        const lastCleanup = req.app.locals.lastSessionCleanup || 0;
        const now = Date.now();
        const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours

        if (now - lastCleanup > cleanupInterval) {
          // Don't await this - run in background
          setImmediate(async () => {
            try {
              // This would typically be done via the database service
              console.log('Running session cleanup...');
              req.app.locals.lastSessionCleanup = now;
            } catch (error) {
              console.error('Session cleanup error:', error);
            }
          });
        }

        next();
      } catch (error) {
        next();
      }
    };
  }
}

// HTTP Status Code for rate limiting
declare module '../types/common' {
  namespace HttpStatus {
    const TOO_MANY_REQUESTS = 429;
  }
}