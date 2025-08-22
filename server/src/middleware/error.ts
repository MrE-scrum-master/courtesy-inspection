// Error Handling Middleware - Centralized error processing and logging
// Production-ready error handling with security and debugging features

import { Request, Response, NextFunction } from 'express';
import { AppError, HttpStatus, LogContext } from '../types/common';

export class ErrorMiddleware {
  
  // Main error handling middleware
  static handle() {
    return (error: Error | AppError, req: Request, res: Response, next: NextFunction) => {
      console.error('Error occurred:', {
        message: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        correlationId: req.correlationId,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });

      // Handle AppError (operational errors)
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
          details: error.details,
          correlationId: req.correlationId
        });
      }

      // Handle validation errors from Joi
      if (error.name === 'ValidationError') {
        return res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
          success: false,
          error: 'Validation failed',
          details: error.message,
          correlationId: req.correlationId
        });
      }

      // Handle JWT errors
      if (error.name === 'JsonWebTokenError') {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Invalid token',
          correlationId: req.correlationId
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          error: 'Token expired',
          correlationId: req.correlationId
        });
      }

      // Handle database connection errors
      if (error.message.includes('connect ECONNREFUSED')) {
        console.error('Database connection error:', error);
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          success: false,
          error: 'Database connection failed',
          correlationId: req.correlationId
        });
      }

      // Handle foreign key constraint errors
      if (error.message.includes('foreign key constraint')) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Referenced resource not found',
          correlationId: req.correlationId
        });
      }

      // Handle unique constraint errors
      if (error.message.includes('duplicate key value') || error.message.includes('UNIQUE constraint')) {
        return res.status(HttpStatus.CONFLICT).json({
          success: false,
          error: 'Resource already exists',
          correlationId: req.correlationId
        });
      }

      // Handle syntax errors in production vs development
      if (error instanceof SyntaxError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Invalid request format',
          correlationId: req.correlationId
        });
      }

      // Handle generic errors
      const isDevelopment = process.env.NODE_ENV === 'development';
      const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

      if (isDevelopment) {
        // Development: return detailed error information
        return res.status(statusCode).json({
          success: false,
          error: error.message,
          stack: error.stack,
          correlationId: req.correlationId
        });
      } else {
        // Production: return generic error message
        return res.status(statusCode).json({
          success: false,
          error: 'Internal server error',
          correlationId: req.correlationId
        });
      }
    };
  }

  // 404 Not Found handler
  static notFound() {
    return (req: Request, res: Response, next: NextFunction) => {
      const error = new AppError(
        `Route not found: ${req.method} ${req.originalUrl}`,
        HttpStatus.NOT_FOUND
      );
      next(error);
    };
  }

  // Async error wrapper for controllers
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Request timeout handler
  static timeout(timeoutMs: number = 30000) {
    return (req: Request, res: Response, next: NextFunction) => {
      const timeout = setTimeout(() => {
        const error = new AppError(
          'Request timeout',
          HttpStatus.REQUEST_TIMEOUT
        );
        next(error);
      }, timeoutMs);

      // Clear timeout when response finishes
      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));

      next();
    };
  }

  // Health check error handler
  static healthCheck() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Basic health indicators
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: process.env.NODE_ENV || 'development'
        };

        res.json(health);
      } catch (error) {
        next(error);
      }
    };
  }

  // CORS error handler
  static corsError() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

      if (origin && !allowedOrigins.includes(origin)) {
        const error = new AppError(
          'CORS policy violation',
          HttpStatus.FORBIDDEN
        );
        return next(error);
      }

      next();
    };
  }

  // Rate limit error handler
  static rateLimitError() {
    return (req: Request, res: Response, next: NextFunction) => {
      const error = new AppError(
        'Too many requests, please try again later',
        429 // Too Many Requests
      );
      next(error);
    };
  }

  // Security headers middleware
  static securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Set security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Remove server information
      res.removeHeader('X-Powered-By');

      next();
    };
  }

  // Request logging middleware
  static logging() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Generate correlation ID if not present
      if (!req.correlationId) {
        req.correlationId = this.generateCorrelationId();
      }

      // Log request
      console.log('Request:', {
        method: req.method,
        url: req.originalUrl,
        correlationId: req.correlationId,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });

      // Log response when finished
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log('Response:', {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          correlationId: req.correlationId,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        });
      });

      next();
    };
  }

  // Performance monitoring
  static performanceMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime.bigint();

      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        // Log slow requests
        if (duration > 1000) { // Slower than 1 second
          console.warn('Slow request detected:', {
            method: req.method,
            url: req.originalUrl,
            duration: `${duration.toFixed(2)}ms`,
            correlationId: req.correlationId,
            userId: req.user?.id
          });
        }

        // Log performance metrics
        if (process.env.NODE_ENV === 'development') {
          console.log('Performance:', {
            url: req.originalUrl,
            duration: `${duration.toFixed(2)}ms`,
            memory: process.memoryUsage().rss / 1024 / 1024, // MB
            correlationId: req.correlationId
          });
        }
      });

      next();
    };
  }

  // Database error parser
  static parseDBError(error: any): AppError {
    if (error.code === '23505') { // Unique violation
      return new AppError('Resource already exists', HttpStatus.CONFLICT);
    }

    if (error.code === '23503') { // Foreign key violation
      return new AppError('Referenced resource not found', HttpStatus.BAD_REQUEST);
    }

    if (error.code === '23502') { // Not null violation
      return new AppError('Required field missing', HttpStatus.BAD_REQUEST);
    }

    if (error.code === '42P01') { // Undefined table
      return new AppError('Database table not found', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return new AppError('Database error', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  // Generate correlation ID
  private static generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Additional HTTP status code
declare module '../types/common' {
  namespace HttpStatus {
    const REQUEST_TIMEOUT = 408;
  }
}