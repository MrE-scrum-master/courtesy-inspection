// Security Middleware Stack - Comprehensive security protection
// Includes Helmet, CORS, rate limiting, request validation, and security headers

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { DatabaseService, HttpStatus } from '../types/common';
import crypto from 'crypto';

export interface SecurityConfig {
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  authRateLimitMax: number;
  maxRequestSize: string;
  enableCSP: boolean;
  enableHSTS: boolean;
  trustProxy: boolean;
  logSecurity: boolean;
}

export interface RateLimitStore {
  incr: (key: string, cb: (err: any, value: number) => void) => void;
  decrement: (key: string) => void;
  resetKey: (key: string) => void;
  resetAll: () => void;
}

export class SecurityMiddleware {
  private db: DatabaseService;
  private config: SecurityConfig;
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(db: DatabaseService, config?: Partial<SecurityConfig>) {
    this.db = db;
    this.config = {
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8081'],
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 100,
      authRateLimitMax: 5,
      maxRequestSize: '10mb',
      enableCSP: true,
      enableHSTS: true,
      trustProxy: process.env.NODE_ENV === 'production',
      logSecurity: process.env.LOG_SECURITY === 'true',
      ...config
    };
  }

  // Helmet security headers
  getHelmetConfig() {
    return helmet({
      contentSecurityPolicy: this.config.enableCSP ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "https:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      } : false,
      crossOriginEmbedderPolicy: false, // Disable for now to allow uploads
      hsts: this.config.enableHSTS ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      } : false,
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
  }

  // CORS configuration
  getCORSConfig() {
    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (this.config.corsOrigins.includes(origin) || 
            this.config.corsOrigins.includes('*')) {
          return callback(null, true);
        }
        
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-CSRF-Token',
        'X-API-Key',
        'X-Correlation-ID'
      ],
      exposedHeaders: ['X-Correlation-ID', 'X-Rate-Limit-Remaining'],
      maxAge: 86400 // 24 hours
    });
  }

  // General rate limiting
  getGeneralRateLimit() {
    return rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMax,
      message: {
        success: false,
        error: 'Too many requests, please try again later',
        retryAfter: Math.ceil(this.config.rateLimitWindowMs / 1000)
      },
      headers: true,
      keyGenerator: (req: Request) => {
        return req.user?.id || req.ip;
      },
      skip: (req: Request) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
      },
      onLimitReached: async (req: Request) => {
        await this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          userId: req.user?.id
        });
      }
    });
  }

  // Authentication-specific rate limiting
  getAuthRateLimit() {
    return rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.authRateLimitMax,
      message: {
        success: false,
        error: 'Too many authentication attempts, please try again later',
        retryAfter: Math.ceil(this.config.rateLimitWindowMs / 1000)
      },
      keyGenerator: (req: Request) => {
        return `auth:${req.body.email || req.ip}`;
      },
      onLimitReached: async (req: Request) => {
        await this.logSecurityEvent('AUTH_RATE_LIMIT_EXCEEDED', {
          ip: req.ip,
          email: req.body.email,
          userAgent: req.get('User-Agent')
        });
      }
    });
  }

  // Progressive delay for suspicious activity
  getSlowDown() {
    return slowDown({
      windowMs: this.config.rateLimitWindowMs,
      delayAfter: Math.floor(this.config.rateLimitMax * 0.5), // Start slowing after 50% of limit
      delayMs: 500, // 500ms delay per request
      maxDelayMs: 10000, // Maximum 10 second delay
      keyGenerator: (req: Request) => {
        return req.user?.id || req.ip;
      }
    });
  }

  // Request size limiting
  getRequestSizeLimit() {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.get('content-length');
      if (contentLength) {
        const sizeInMB = parseInt(contentLength) / (1024 * 1024);
        const maxSizeMB = parseInt(this.config.maxRequestSize.replace('mb', ''));
        
        if (sizeInMB > maxSizeMB) {
          return res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
            success: false,
            error: `Request size exceeds ${this.config.maxRequestSize} limit`,
            details: {
              receivedSize: `${sizeInMB.toFixed(2)}MB`,
              maxSize: this.config.maxRequestSize
            }
          });
        }
      }
      next();
    };
  }

  // SQL injection prevention
  getSQLInjectionProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      const sqlInjectionPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
        /(UNION\s+SELECT)/i,
        /(OR\s+1\s*=\s*1)/i,
        /(AND\s+1\s*=\s*1)/i,
        /(';\s*(DROP|DELETE|INSERT|UPDATE))/i,
        /(script\s*:|javascript\s*:)/i,
        /(<script|<\/script>)/i
      ];

      const checkForSQLInjection = (obj: any, path = ''): string | null => {
        if (typeof obj === 'string') {
          for (const pattern of sqlInjectionPatterns) {
            if (pattern.test(obj)) {
              return path || 'request';
            }
          }
        } else if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            const result = checkForSQLInjection(value, path ? `${path}.${key}` : key);
            if (result) return result;
          }
        }
        return null;
      };

      // Check body, query, and params
      const suspiciousField = 
        checkForSQLInjection(req.body, 'body') ||
        checkForSQLInjection(req.query, 'query') ||
        checkForSQLInjection(req.params, 'params');

      if (suspiciousField) {
        this.logSecurityEvent('SQL_INJECTION_ATTEMPT', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          field: suspiciousField,
          userId: req.user?.id
        });

        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Invalid request data detected'
        });
      }

      next();
    };
  }

  // XSS protection
  getXSSProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      const xssPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /<iframe[^>]*>.*?<\/iframe>/gi,
        /javascript\s*:/gi,
        /on\w+\s*=/gi,
        /<img[^>]*onerror[^>]*>/gi,
        /<svg[^>]*onload[^>]*>/gi
      ];

      const checkForXSS = (obj: any, path = ''): string | null => {
        if (typeof obj === 'string') {
          for (const pattern of xssPatterns) {
            if (pattern.test(obj)) {
              return path || 'request';
            }
          }
        } else if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            const result = checkForXSS(value, path ? `${path}.${key}` : key);
            if (result) return result;
          }
        }
        return null;
      };

      const suspiciousField = 
        checkForXSS(req.body, 'body') ||
        checkForXSS(req.query, 'query');

      if (suspiciousField) {
        this.logSecurityEvent('XSS_ATTEMPT', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          field: suspiciousField,
          userId: req.user?.id
        });

        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Potentially malicious content detected'
        });
      }

      next();
    };
  }

  // Correlation ID middleware
  getCorrelationIdMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      req.correlationId = req.get('X-Correlation-ID') || crypto.randomUUID();
      res.set('X-Correlation-ID', req.correlationId);
      next();
    };
  }

  // Security headers middleware
  getSecurityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Custom security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });

      if (this.config.enableHSTS) {
        res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }

      next();
    };
  }

  // API key validation
  getAPIKeyValidation() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.get('X-API-Key');
      
      if (!apiKey) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'API key required'
        });
      }

      // Validate API key (in production, check against database)
      const validApiKey = process.env.API_KEY || 'default-api-key';
      
      if (apiKey !== validApiKey) {
        this.logSecurityEvent('INVALID_API_KEY', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          apiKey: apiKey.substring(0, 8) + '...'
        });

        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Invalid API key'
        });
      }

      next();
    };
  }

  // IP whitelist/blacklist
  getIPFiltering(options: { whitelist?: string[]; blacklist?: string[] } = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientIP = req.ip;

      // Check blacklist first
      if (options.blacklist && options.blacklist.includes(clientIP)) {
        await this.logSecurityEvent('BLOCKED_IP_ACCESS', {
          ip: clientIP,
          userAgent: req.get('User-Agent'),
          path: req.path
        });

        return res.status(HttpStatus.FORBIDDEN).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Check whitelist if provided
      if (options.whitelist && options.whitelist.length > 0) {
        if (!options.whitelist.includes(clientIP)) {
          await this.logSecurityEvent('NON_WHITELISTED_IP_ACCESS', {
            ip: clientIP,
            userAgent: req.get('User-Agent'),
            path: req.path
          });

          return res.status(HttpStatus.FORBIDDEN).json({
            success: false,
            error: 'Access denied'
          });
        }
      }

      next();
    };
  }

  // Request fingerprinting for anomaly detection
  getRequestFingerprinting() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const fingerprint = this.generateRequestFingerprint(req);
      
      // Store fingerprint for analysis
      req.fingerprint = fingerprint;
      
      // Check for anomalies (implement based on your needs)
      const isAnomalous = await this.checkForAnomalies(fingerprint, req);
      
      if (isAnomalous) {
        await this.logSecurityEvent('ANOMALOUS_REQUEST', {
          ip: req.ip,
          fingerprint,
          path: req.path,
          userId: req.user?.id
        });
      }

      next();
    };
  }

  // Comprehensive security middleware stack
  getSecurityStack() {
    return [
      this.getCorrelationIdMiddleware(),
      this.getHelmetConfig(),
      this.getCORSConfig(),
      this.getSecurityHeaders(),
      this.getRequestSizeLimit(),
      this.getSQLInjectionProtection(),
      this.getXSSProtection(),
      this.getSlowDown(),
      this.getGeneralRateLimit()
    ];
  }

  // Private helper methods
  private generateRequestFingerprint(req: Request): string {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.ip
    ];

    return crypto.createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  private async checkForAnomalies(fingerprint: string, req: Request): Promise<boolean> {
    // Implement anomaly detection logic
    // For now, just check for rapid requests from same fingerprint
    const key = `fingerprint:${fingerprint}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    
    const requests = this.rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (now > requests.resetTime) {
      requests.count = 1;
      requests.resetTime = now + windowMs;
    } else {
      requests.count++;
    }
    
    this.rateLimitStore.set(key, requests);
    
    // Flag as anomalous if more than 30 requests per minute
    return requests.count > 30;
  }

  private async logSecurityEvent(event: string, details: any): Promise<void> {
    if (!this.config.logSecurity) return;

    try {
      await this.db.query(
        `INSERT INTO audit_logs (action, resource, request_data, created_at)
         VALUES ($1, $2, $3, NOW())`,
        ['SECURITY_EVENT', event, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      fingerprint?: string;
      correlationId?: string;
    }
  }
}